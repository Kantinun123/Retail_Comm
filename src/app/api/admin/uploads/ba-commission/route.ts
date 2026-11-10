import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { parseBaFile, type BaLookups, type BaRow } from "@/lib/server/ba-commission-parse";

/**
 * อัปโหลด BA Commission รายเดือน (admin เท่านั้น)
 * POST multipart/form-data: period=YYYY-MM, mode=preview|apply, files=<xlsx>...
 * - preview : อ่าน+ตรวจไฟล์ แสดงผลถ้าบันทึก (ไม่เขียนอะไร)
 * - apply   : แทนที่ข้อมูลทั้งเดือนใน transaction เดียว + เก็บไฟล์ต้นฉบับ + บันทึกประวัติ
 */
const MAX_BYTES = 4 * 1024 * 1024; // Vercel จำกัด body ~4.5 MB
const WARN_CHANGE = 0.4;

type Sb = ReturnType<typeof createServiceClient>;

async function pageAll<T>(fn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fn(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function loadLookups(sb: Sb): Promise<BaLookups> {
  const [al, ds, reps] = await Promise.all([
    pageAll<{ kind: string; alias: string; value: string }>((a, b) => sb.from("master_aliases").select("kind,alias,value").in("kind", ["ba_channel", "ba_emp"]).range(a, b)),
    pageAll<{ code: string; name: string }>((a, b) => sb.from("dealers").select("code,name").range(a, b)),
    pageAll<{ rep_code: string; ba_app_id_1: string | null; ba_app_id_2: string | null }>((a, b) => sb.from("sale_reps").select("rep_code,ba_app_id_1,ba_app_id_2").range(a, b)),
  ]);
  const empToRep = new Map<string, string>();
  reps.forEach((r) => {
    if (r.ba_app_id_1) empToRep.set(String(r.ba_app_id_1).trim(), r.rep_code);
    if (r.ba_app_id_2) empToRep.set(String(r.ba_app_id_2).trim(), r.rep_code);
  });
  return {
    channelToDealer: new Map(al.filter((a) => a.kind === "ba_channel").map((a) => [a.alias, a.value])),
    empToCr: new Map(al.filter((a) => a.kind === "ba_emp").map((a) => [a.alias, a.value])),
    dealerName: new Map(ds.map((d) => [d.code, d.name])),
    empToRep,
  };
}

/** win_date จาก ba_service_sales_lines (sync จาก Google Sheet ทุกชั่วโมง) */
async function fillWinDate(sb: Sb, rows: BaRow[]) {
  const codes = [...new Set(rows.map((r) => r.job_code))];
  const win = new Map<string, string>();
  for (let i = 0; i < codes.length; i += 300) {
    const { data, error } = await sb.from("ba_service_sales_lines").select("job_code,win_date").in("job_code", codes.slice(i, i + 300));
    if (error) throw new Error(error.message);
    (data ?? []).forEach((x) => x.win_date && !win.has(x.job_code) && win.set(x.job_code, x.win_date));
  }
  rows.forEach((r) => (r.win_date = win.get(r.job_code) ?? null));
}

const prevPeriod = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

async function periodStats(sb: Sb, period: string) {
  const rows = await pageAll<{ dealer_code: string | null; total_incentive: number | string }>((a, b) =>
    sb.from("ba_incentive_lines").select("dealer_code,total_incentive").eq("period", period).range(a, b)
  );
  const byDealer = new Map<string, number>();
  rows.forEach((r) => byDealer.set(r.dealer_code ?? "", (byDealer.get(r.dealer_code ?? "") ?? 0) + Number(r.total_incentive)));
  return { rows: rows.length, amount: rows.reduce((a, r) => a + Number(r.total_incentive), 0), byDealer };
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "อ่านไฟล์ที่ส่งมาไม่ได้ (อาจใหญ่เกินไป)" }, { status: 400 });
  }
  const period = String(form.get("period") ?? "");
  const mode = form.get("mode") === "apply" ? "apply" : "preview";
  if (!/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ ok: false, error: "เดือนไม่ถูกต้อง" }, { status: 400 });
  const files = form.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!files.length) return NextResponse.json({ ok: false, error: "ยังไม่ได้เลือกไฟล์" }, { status: 400 });
  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  if (totalBytes > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: `ไฟล์รวม ${(totalBytes / 1048576).toFixed(1)} MB เกิน 4 MB — แบ่งอัปโหลดเป็นหลายรอบไม่ได้เพราะเป็นการแทนที่ทั้งเดือน กรุณาติดต่อผู้ดูแลระบบ` }, { status: 413 });
  }

  const sb = createServiceClient();
  try {
    const L = await loadLookups(sb);
    const buffers = await Promise.all(files.map(async (f) => ({ name: f.name, buf: new Uint8Array(await f.arrayBuffer()), type: f.type })));
    const parsed = buffers.map((b) => parseBaFile(b.name, b.buf, period, L));
    const usable = parsed.filter((p) => p.status !== "error");
    const rows = usable.flatMap((p) => p.rows);
    // ไฟล์ซ้ำ (ชื่อเดียวกัน) = นับครั้งเดียว
    const dupNames = parsed.map((p) => p.name).filter((n, i, a) => a.indexOf(n) !== i);
    if (dupNames.length) return NextResponse.json({ ok: false, error: `มีไฟล์ชื่อซ้ำ: ${[...new Set(dupNames)].join(", ")}` }, { status: 400 });
    await fillWinDate(sb, rows);

    const [before, prev] = await Promise.all([periodStats(sb, period), periodStats(sb, prevPeriod(period))]);
    const afterAmount = rows.reduce((a, r) => a + r.total_incentive, 0);
    const afterByDealer = new Map<string, number>();
    rows.forEach((r) => afterByDealer.set(r.dealer_code ?? "", (afterByDealer.get(r.dealer_code ?? "") ?? 0) + r.total_incentive));
    // ร้านที่ยอดเปลี่ยนมากสุด: เทียบข้อมูลเดิมของเดือนนี้ (ถ้ามี) ไม่งั้นเทียบเดือนก่อน
    const base = before.rows ? before.byDealer : prev.byDealer;
    const changes = [...new Set([...afterByDealer.keys(), ...base.keys()])]
      .filter((k) => k)
      .map((k) => ({ dealerCode: k, dealerName: L.dealerName.get(k) ?? k, before: base.get(k) ?? 0, after: afterByDealer.get(k) ?? 0 }))
      .filter((x) => Math.abs(x.after - x.before) > 0.005)
      .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
      .slice(0, 5);
    const warnings: string[] = [];
    if (prev.amount > 0 && Math.abs(afterAmount - prev.amount) / prev.amount > WARN_CHANGE) {
      warnings.push(`ยอดรวมต่างจากเดือนก่อน ${(((afterAmount - prev.amount) / prev.amount) * 100).toFixed(0)}% — ตรวจว่าเลือกไฟล์ครบ/ถูกเดือน`);
    }
    if (before.rows && rows.length < before.rows * (1 - WARN_CHANGE)) warnings.push(`จำนวนแถวน้อยกว่าข้อมูลเดิมของเดือนนี้มาก (${before.rows} → ${rows.length})`);

    const preview = {
      period,
      files: parsed.map((p) => ({ name: p.name, kind: p.kind, status: p.status, messages: p.messages, rows: p.rows.length, amount: p.amount })),
      before: { rows: before.rows, amount: before.amount },
      prev: { period: prevPeriod(period), rows: prev.rows, amount: prev.amount },
      after: {
        rows: rows.length,
        amount: afterAmount,
        stores: new Set(rows.map((r) => r.dealer_code).filter(Boolean)).size,
        unmappedRows: rows.filter((r) => !r.dealer_code).length,
        people: new Set(rows.map((r) => r.emp_id).filter(Boolean)).size,
        repMatched: rows.filter((r) => r.rep_code).length,
        winDate: rows.filter((r) => r.win_date).length,
      },
      changes,
      warnings,
    };
    if (mode === "preview") return NextResponse.json({ ok: true, mode, preview });

    /* ---------- apply ---------- */
    if (!rows.length) return NextResponse.json({ ok: false, error: "ไม่มีไฟล์ที่ใช้ได้" }, { status: 400 });
    const { data: rep, error: rErr } = await sb.rpc("replace_ba_incentive_period", { p_period: period, p_rows: rows });
    if (rErr) {
      await sb.from("data_uploads").insert({
        source: "ba-commission", period, status: "failed", file_names: files.map((f) => f.name), file_count: files.length,
        rows_before: before.rows, amount_before: before.amount, message: rErr.message.slice(0, 300), uploaded_by: ctx.email,
      });
      return NextResponse.json({ ok: false, error: `บันทึกไม่สำเร็จ (ข้อมูลเดิมไม่ถูกแก้): ${rErr.message}` }, { status: 500 });
    }
    // เก็บไฟล์ต้นฉบับ (ไม่ให้การเก็บไฟล์พังทำให้การบันทึกล้ม)
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const paths: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
      const safe = buffers[i].name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
      const path = `ba-commission/${period}/${stamp}/${String(i + 1).padStart(3, "0")}-${safe}`;
      const { error } = await sb.storage.from("data-uploads").upload(path, buffers[i].buf, { contentType: buffers[i].type || "application/octet-stream", upsert: false });
      if (!error) paths.push(path);
    }
    const skipped = parsed.filter((p) => p.status === "error").length;
    await sb.from("data_uploads").insert({
      source: "ba-commission", period, status: "applied",
      file_names: files.map((f) => f.name), file_count: files.length,
      rows_before: before.rows, rows_after: rows.length, amount_before: before.amount, amount_after: afterAmount,
      message: skipped ? `ข้าม ${skipped} ไฟล์ที่ใช้ไม่ได้` : null,
      uploaded_by: ctx.email, storage_paths: paths,
    });
    // งานบริการ BA ผูกพนักงานผ่าน ba_incentive_lines -> ผูกใหม่
    await sb.rpc("refresh_service_sales_reps");
    return NextResponse.json({ ok: true, mode, result: rep, preview, storedFiles: paths.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "server error" }, { status: 500 });
  }
}
