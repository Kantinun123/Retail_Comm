import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanAnswers, examEnabled, gradeAttempt, isExaminee } from "@/lib/server/exam";

type Ctx = { params: Promise<{ id: string }> };

async function loadMine(idRaw: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { err: NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 }) } as const;
  if (!isExaminee(ctx) || !examEnabled(ctx)) return { err: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) } as const;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) return { err: NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 }) } as const;
  const sb = createServiceClient();
  const { data } = await sb.from("exam_attempts").select("id, round_id, rep_code, is_test, status, question_ids").eq("id", id).maybeSingle();
  // ดูได้เฉพาะการสอบของตัวเอง (รหัสพนักงานจาก session ไม่ใช่จาก client)
  if (!data || data.rep_code !== ctx.repCode || data.is_test !== ctx.isTest) return { err: NextResponse.json({ ok: false, error: "not_found" }, { status: 404 }) } as const;
  return { sb, ctx, attempt: data } as const;
}

/** PUT /api/exam/attempt/[id] {answers} -> บันทึกคำตอบที่ทำไว้ (ทำต่อทีหลังได้) */
export async function PUT(req: Request, { params }: Ctx) {
  const m = await loadMine((await params).id);
  if ("err" in m) return m.err;
  if (m.attempt.status !== "in_progress") return NextResponse.json({ ok: false, error: "already_submitted" }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { answers?: unknown } | null;
  const answers = cleanAnswers(body?.answers, m.attempt.question_ids as number[]);
  const { error } = await m.sb.from("exam_attempts").update({ answers }).eq("id", m.attempt.id).eq("status", "in_progress");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** POST /api/exam/attempt/[id] {answers} -> ส่งข้อสอบ ตรวจคะแนนที่ server ; ไม่ส่งเฉลยกลับ */
export async function POST(req: Request, { params }: Ctx) {
  const m = await loadMine((await params).id);
  if ("err" in m) return m.err;
  if (m.attempt.status !== "in_progress") return NextResponse.json({ ok: false, error: "already_submitted" }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { answers?: unknown } | null;
  const answers = cleanAnswers(body?.answers, m.attempt.question_ids as number[]);
  // ต้องตอบครบทุกข้อก่อนส่ง (บังคับที่ server ด้วย ไม่พึ่งแค่ปุ่มบนหน้าจอ)
  const missing = (m.attempt.question_ids as number[]).filter((q) => !(answers[String(q)]?.length));
  if (missing.length) return NextResponse.json({ ok: false, error: `ตอบยังไม่ครบ เหลืออีก ${missing.length} ข้อ`, missing: missing.length }, { status: 400 });
  const { data: round } = await m.sb.from("exam_rounds").select("pass_percent").eq("id", m.attempt.round_id).single();
  const passPercent = (round?.pass_percent as number | undefined) ?? 80;
  const g = await gradeAttempt(m.sb, m.attempt.question_ids as number[], answers, passPercent);
  // เงื่อนไข status = in_progress ทำให้กดส่งซ้ำ/ส่งจาก 2 เครื่องพร้อมกันได้ผลเดียว
  const { data: done, error } = await m.sb
    .from("exam_attempts")
    .update({ answers, status: "submitted", submitted_at: new Date().toISOString(), score: g.score, total: g.total, percent: g.percent, passed: g.passed })
    .eq("id", m.attempt.id)
    .eq("status", "in_progress")
    .select("id, seq")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!done) return NextResponse.json({ ok: false, error: "already_submitted" }, { status: 409 });
  return NextResponse.json({ ok: true, seq: done.seq, score: g.score, total: g.total, percent: g.percent, passed: g.passed, passPercent });
}
