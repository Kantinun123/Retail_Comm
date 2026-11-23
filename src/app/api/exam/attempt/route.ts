import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { buildAttemptView, examEnabled, isExaminee, shuffle, todayBkk } from "@/lib/server/exam";

/** POST /api/exam/attempt {roundId, topicId} -> เริ่มสอบ (หรือทำต่อจากครั้งที่ค้างไว้) */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!isExaminee(ctx) || !examEnabled(ctx)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { roundId?: number; topicId?: number } | null;
  const roundId = Number(body?.roundId);
  const topicId = Number(body?.topicId);
  if (!Number.isInteger(roundId) || !Number.isInteger(topicId)) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const sb = createServiceClient();
  const { data: round } = await sb.from("exam_rounds").select("id, status, starts_on, pass_percent").eq("id", roundId).maybeSingle();
  if (!round || round.status !== "open" || (round.starts_on as string) > todayBkk()) return NextResponse.json({ ok: false, error: "round_closed" }, { status: 409 });

  const keyFilter = { round_id: roundId, topic_id: topicId, rep_code: ctx.repCode!, is_test: ctx.isTest };
  const loadOpen = async () =>
    (await sb.from("exam_attempts").select("id, seq, question_ids, option_order, answers, started_at").match(keyFilter).eq("status", "in_progress").maybeSingle()).data;

  let attempt = await loadOpen();
  // ผ่านหัวข้อนี้แล้ว ไม่ต้องสอบซ้ำ
  if (!attempt) {
    const { count: passedCount } = await sb.from("exam_attempts").select("id", { count: "exact", head: true }).match(keyFilter).eq("passed", true);
    if ((passedCount ?? 0) > 0) return NextResponse.json({ ok: false, error: "already_passed" }, { status: 409 });
    const { data: qs } = await sb.from("exam_questions").select("id").eq("topic_id", topicId).eq("is_active", true);
    const ids = (qs ?? []).map((q) => q.id as number);
    if (!ids.length) return NextResponse.json({ ok: false, error: "no_questions" }, { status: 400 });
    const { data: os } = await sb.from("exam_options").select("id, question_id").in("question_id", ids);
    const byQ = new Map<number, number[]>();
    for (const o of os ?? []) byQ.set(o.question_id as number, [...(byQ.get(o.question_id as number) ?? []), o.id as number]);
    const questionIds = shuffle(ids);
    const optionOrder: Record<string, number[]> = {};
    for (const q of questionIds) optionOrder[String(q)] = shuffle(byQ.get(q) ?? []);
    const { count: prev } = await sb.from("exam_attempts").select("id", { count: "exact", head: true }).match(keyFilter);
    const { error } = await sb.from("exam_attempts").insert({
      ...keyFilter,
      user_id: ctx.userId,
      seq: (prev ?? 0) + 1,
      question_ids: questionIds,
      option_order: optionOrder,
    });
    // กดเริ่มซ้อนกัน: unique index ชน -> ใช้ชุดที่เพิ่งสร้าง
    if (error && error.code !== "23505") return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    attempt = await loadOpen();
  }
  if (!attempt) return NextResponse.json({ ok: false, error: "attempt_not_found" }, { status: 500 });
  const questions = await buildAttemptView(sb, { question_ids: attempt.question_ids as number[], option_order: attempt.option_order as Record<string, number[]> });
  return NextResponse.json({
    ok: true,
    attemptId: attempt.id,
    seq: attempt.seq,
    passPercent: round.pass_percent,
    answers: attempt.answers ?? {},
    questions,
  });
}
