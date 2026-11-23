import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { pushToUser } from "@/lib/server/push";
import { todayBkk } from "@/lib/server/exam";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** POST /api/exam/rounds {title, startsOn, deadlineOn, passPercent?, notify?} -> admin เปิดรอบสอบใหม่ (ทุก SE ต้องสอบทุกหัวข้อ) */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { title?: string; startsOn?: string; deadlineOn?: string; passPercent?: number; notify?: boolean } | null;
  const title = String(b?.title ?? "").trim().slice(0, 120);
  const startsOn = String(b?.startsOn ?? "");
  const deadlineOn = String(b?.deadlineOn ?? "");
  const passPercent = Number.isInteger(b?.passPercent) ? Number(b?.passPercent) : 80;
  if (!title) return NextResponse.json({ ok: false, error: "ใส่ชื่อรอบสอบ" }, { status: 400 });
  if (!DATE_RE.test(startsOn) || !DATE_RE.test(deadlineOn) || deadlineOn < startsOn) return NextResponse.json({ ok: false, error: "วันที่ไม่ถูกต้อง (วันสิ้นสุดต้องไม่ก่อนวันเริ่ม)" }, { status: 400 });
  if (passPercent < 1 || passPercent > 100) return NextResponse.json({ ok: false, error: "เกณฑ์ผ่านต้องอยู่ระหว่าง 1-100" }, { status: 400 });

  const sb = createServiceClient();
  const { data: round, error } = await sb
    .from("exam_rounds")
    .insert({ title, starts_on: startsOn, deadline_on: deadlineOn, pass_percent: passPercent, created_by: ctx.userId })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // แจ้งพนักงานขายทุกคน (บัญชีจริง) เมื่อเปิดรอบ ถ้ารอบเริ่มแล้ว
  let pushed = 0;
  if (b?.notify !== false && startsOn <= todayBkk() && process.env.EXAM_ENABLED === "1") {
    const { data: reps } = await sb.from("sale_reps").select("rep_code").eq("position", "se").eq("is_active", true).limit(1000);
    const codes = (reps ?? []).map((r) => r.rep_code as string);
    const { data: users } = codes.length
      ? await sb.from("profiles").select("id").eq("role", "sales").eq("status", "approved").eq("is_test", false).in("rep_code", codes)
      : { data: [] };
    await Promise.all(
      (users ?? []).map((u) =>
        pushToUser(sb, u.id as string, { title: "มีข้อสอบ Competency ใหม่", body: `${title} — ทำให้เสร็จภายใน ${deadlineOn}`, url: "/app/exam", tag: `exam-${round.id}` })
          .then((n) => (pushed += n > 0 ? 1 : 0))
          .catch(() => 0)
      )
    );
    await sb.from("exam_rounds").update({ notified_at: new Date().toISOString() }).eq("id", round.id);
  }
  return NextResponse.json({ ok: true, id: round.id, pushed });
}

/** PATCH /api/exam/rounds {id, status?, deadlineOn?, title?} -> ปิดรอบ / ขยายเดดไลน์ / แก้ชื่อ */
export async function PATCH(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { id?: number; status?: string; deadlineOn?: string; title?: string } | null;
  const id = Number(b?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const patch: Record<string, string> = {};
  if (b?.status === "open" || b?.status === "closed") patch.status = b.status;
  if (b?.deadlineOn !== undefined) {
    if (!DATE_RE.test(b.deadlineOn)) return NextResponse.json({ ok: false, error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
    patch.deadline_on = b.deadlineOn;
  }
  if (b?.title !== undefined && b.title.trim()) patch.title = b.title.trim().slice(0, 120);
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "ไม่มีข้อมูลที่แก้" }, { status: 400 });
  const { error } = await createServiceClient().from("exam_rounds").update(patch).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
