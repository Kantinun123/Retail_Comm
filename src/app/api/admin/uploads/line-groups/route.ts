import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { computeLineTracking, parseLineGroupFile, replaceLineGroupFiles, writeLineTracking, type LineGroupEntry, type LineTrackingSummary } from "@/lib/server/line-groups-compute";

/**
 * ไฟล์กลุ่ม Line ลูกค้า (admin เท่านั้น) — ศูนย์ข้อมูล
 * - GET                          : ไฟล์ที่อยู่ในระบบ + สรุปผลปัจจุบัน
 * - POST multipart mode=preview  : อ่านไฟล์ + คำนวณผลถ้าบันทึก (ไม่เขียนอะไร)
 * - POST multipart mode=apply    : แทนที่ไฟล์ชื่อเดียวกัน + คำนวณใหม่ + บันทึกประวัติ
 * - POST json { action: "remove", file } : ลบไฟล์ออกจากระบบ + คำนวณใหม่
 * - POST json { action: "recompute" }    : คำนวณใหม่จากข้อมูลที่มี (เช่น หลังงาน Rudy ใหม่เข้ามา)
 */
const MAX_BYTES = 4 * 1024 * 1024; // Vercel จำกัด body ~4.5 MB
const SOURCE = "line-groups";
type Sb = ReturnType<typeof createServiceClient>;

async function requireAdmin() {
  const ctx = await getAuthContext();
  if (!ctx) return { res: NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 }) };
  if (ctx.role !== "admin") return { res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { ctx };
}

async function loadEntries(sb: Sb): Promise<(LineGroupEntry & { id: number; uploaded_at: string; uploaded_by: string | null })[]> {
  const out: (LineGroupEntry & { id: number; uploaded_at: string; uploaded_by: string | null })[] = [];
  for (let last = 0; ; ) {
    const { data, error } = await sb
      .from("line_group_entries")
      .select("id, source_file, kind, job_tokens, status, group_name, group_created, uploaded_at, uploaded_by")
      .gt("id", last)
      .order("id")
      .limit(1000);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as typeof out));
    if (!data || data.length < 1000) break;
    last = data[data.length - 1].id as number;
  }
  return out;
}

async function currentSummary(sb: Sb) {
  const { data: last } = await sb.from("line_tracking_jobs").select("batch, source_date").order("batch", { ascending: false }).limit(1).maybeSingle();
  if (!last) return null;
  const ids: { customer_id: string; customer_status: string | null }[] = [];
  for (let lastId = 0; ; ) {
    const { data } = await sb.from("line_tracking_jobs").select("id, customer_id, customer_status").eq("batch", last.batch).gt("id", lastId).order("id").limit(1000);
    ids.push(...((data ?? []) as typeof ids));
    if (!data || data.length < 1000) break;
    lastId = data[data.length - 1].id as number;
  }
  const cust = new Map(ids.map((r) => [r.customer_id, r.customer_status]));
  const n = (k: string | null) => [...cust.values()].filter((s) => s === k).length;
  return { computedAt: last.batch as string, sourceDate: last.source_date as string | null, jobs: ids.length, customers: cust.size, register: n("register"), not_register: n("not_register"), no_bot: n("no_bot"), none: n(null) };
}

function filesOf(entries: Awaited<ReturnType<typeof loadEntries>>) {
  const m = new Map<string, { name: string; rows: number; register: number; not_register: number; no_bot: number; uploadedAt: string; uploadedBy: string | null; latestGroup: string | null }>();
  for (const e of entries) {
    const f = m.get(e.source_file) ?? { name: e.source_file, rows: 0, register: 0, not_register: 0, no_bot: 0, uploadedAt: e.uploaded_at, uploadedBy: e.uploaded_by, latestGroup: null };
    f.rows++;
    f[e.status]++;
    if (e.uploaded_at > f.uploadedAt) { f.uploadedAt = e.uploaded_at; f.uploadedBy = e.uploaded_by; }
    if (e.group_created && (!f.latestGroup || e.group_created > f.latestGroup)) f.latestGroup = e.group_created;
    m.set(e.source_file, f);
  }
  return [...m.values()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

const summaryOut = (s: LineTrackingSummary) => ({ jobs: s.jobs, customers: s.customers, register: s.register, not_register: s.not_register, no_bot: s.no_bot, none: s.none, sourceDate: s.sourceDate, missingCustomer: s.missingCustomer });

async function log(sb: Sb, email: string | null, status: string, files: string[], before: { customers: number } | null, after: LineTrackingSummary | null, message: string | null) {
  await sb.from("data_uploads").insert({
    source: SOURCE,
    period: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7),
    status,
    file_names: files,
    file_count: files.length,
    rows_before: before?.customers ?? null,
    rows_after: after?.customers ?? null,
    amount_before: null,
    amount_after: after?.register ?? null,
    message,
    uploaded_by: email,
  });
}

export async function GET() {
  const a = await requireAdmin();
  if (a.res) return a.res;
  const sb = createServiceClient();
  try {
    const [entries, current, { data: rudy }] = await Promise.all([
      loadEntries(sb),
      currentSummary(sb),
      sb.from("rudy_job_customers").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return NextResponse.json({ ok: true, files: filesOf(entries), current, rudySyncedAt: (rudy?.synced_at as string | undefined) ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const a = await requireAdmin();
  if (a.res) return a.res;
  const ctx = a.ctx;
  const sb = createServiceClient();

  // ---------- JSON: remove / recompute ----------
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    let body: { action?: string; file?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
    }
    try {
      const before = await currentSummary(sb);
      if (body.action === "remove") {
        const file = String(body.file ?? "").trim();
        if (!file) return NextResponse.json({ ok: false, error: "missing file" }, { status: 400 });
        // คำนวณจากชุดที่ไม่มีไฟล์นี้ก่อน -> บันทึกผล -> แล้วค่อยลบแถวของไฟล์ (ถ้าคำนวณพัง ข้อมูลเดิมอยู่ครบ)
        const entries = (await loadEntries(sb)).filter((e) => e.source_file !== file);
        const { rows, summary } = await computeLineTracking(sb, { entries });
        await writeLineTracking(sb, rows);
        const { error } = await sb.from("line_group_entries").delete().eq("source_file", file);
        if (error) throw new Error(error.message);
        // status ของ data_uploads มีแค่ applied/cancelled/failed -> บอกการลบไว้ใน message
        await log(sb, ctx.email, "applied", [file], before, summary, "ลบไฟล์ออกจากระบบ");
        return NextResponse.json({ ok: true, summary: summaryOut(summary) });
      }
      if (body.action === "recompute") {
        const { rows, summary } = await computeLineTracking(sb);
        await writeLineTracking(sb, rows);
        await log(sb, ctx.email, "applied", [], before, summary, "คำนวณใหม่");
        return NextResponse.json({ ok: true, summary: summaryOut(summary) });
      }
      return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "server error" }, { status: 500 });
    }
  }

  // ---------- multipart: preview / apply ----------
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "อ่านไฟล์ที่ส่งมาไม่ได้ (อาจใหญ่เกินไป)" }, { status: 400 });
  }
  const mode = form.get("mode") === "apply" ? "apply" : "preview";
  const files = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!files.length) return NextResponse.json({ ok: false, error: "ยังไม่ได้เลือกไฟล์" }, { status: 400 });
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > MAX_BYTES) return NextResponse.json({ ok: false, error: `ไฟล์รวม ${(total / 1048576).toFixed(1)} MB เกิน 4 MB — อัปโหลดทีละไฟล์` }, { status: 413 });
  const names = files.map((f) => f.name);
  if (new Set(names).size !== names.length) return NextResponse.json({ ok: false, error: "มีไฟล์ชื่อซ้ำ" }, { status: 400 });

  try {
    const parsed = await Promise.all(files.map(async (f) => parseLineGroupFile(f.name, new Uint8Array(await f.arrayBuffer()))));
    const usable = parsed.filter((p) => p.status !== "error");
    const existing = await loadEntries(sb);
    const existingNames = new Set(existing.map((e) => e.source_file));
    const usableNames = new Set(usable.map((p) => p.name));
    const entries = [...existing.filter((e) => !usableNames.has(e.source_file)), ...usable.flatMap((p) => p.entries)];
    const before = await currentSummary(sb);
    const { rows, summary } = await computeLineTracking(sb, { entries });
    const preview = {
      files: parsed.map((p) => ({ name: p.name, status: p.status, messages: p.messages, rows: p.entries.length, replaces: existingNames.has(p.name), counts: p.counts })),
      before,
      after: summaryOut(summary),
    };
    if (mode === "preview") return NextResponse.json({ ok: true, mode, preview });

    if (!usable.length) return NextResponse.json({ ok: false, error: "ไม่มีไฟล์ที่ใช้ได้" }, { status: 400 });
    // บันทึกผลคำนวณก่อน แล้วค่อยแทนที่แถวของไฟล์ (ถ้าขั้นใดพัง ข้อมูลเดิมยังใช้ได้)
    await writeLineTracking(sb, rows);
    await replaceLineGroupFiles(sb, usable, ctx.email);
    const skipped = parsed.length - usable.length;
    await log(sb, ctx.email, "applied", usable.map((p) => p.name), before, summary, skipped ? `ข้าม ${skipped} ไฟล์ที่ใช้ไม่ได้` : null);
    return NextResponse.json({ ok: true, mode, preview });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    await log(sb, ctx.email, "failed", names, null, null, msg.slice(0, 300)).catch(() => {});
    return NextResponse.json({ ok: false, error: `บันทึกไม่สำเร็จ (ข้อมูลเดิมไม่ถูกแก้): ${msg}` }, { status: 500 });
  }
}
