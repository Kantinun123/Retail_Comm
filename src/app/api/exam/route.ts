import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { activeTopics, daysBetween, examEnabled, isExaminee, todayBkk } from "@/lib/server/exam";

/**
 * GET /api/exam -> รอบสอบที่เปิดอยู่ + สถานะรายหัวข้อของพนักงานที่ล็อกอิน (ผู้สอบ = พนักงานขาย SE)
 * สถานะหัวข้อ: todo (ยังไม่ทำ) / in_progress (กำลังทำ) / failed (สอบแล้วยังไม่ผ่าน) / passed
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const enabled = examEnabled(ctx);
  const examinee = isExaminee(ctx);
  if (!examinee || !enabled) return NextResponse.json({ ok: true, enabled, examinee, rounds: [] });

  const sb = createServiceClient();
  const today = todayBkk();
  const { data: rounds } = await sb
    .from("exam_rounds")
    .select("id, title, starts_on, deadline_on, pass_percent, status")
    .eq("status", "open")
    .lte("starts_on", today)
    .order("deadline_on");
  const roundIds = (rounds ?? []).map((r) => r.id as number);
  if (!roundIds.length) return NextResponse.json({ ok: true, enabled, examinee, rounds: [] });

  const [topics, att] = await Promise.all([
    activeTopics(sb),
    sb
      .from("exam_attempts")
      .select("round_id, topic_id, status, passed, percent, seq")
      .eq("rep_code", ctx.repCode!)
      .eq("is_test", ctx.isTest)
      .in("round_id", roundIds)
      .limit(5000),
  ]);

  const out = (rounds ?? []).map((r) => {
    const mine = (att.data ?? []).filter((a) => a.round_id === r.id);
    const items = topics.map((t) => {
      const a = mine.filter((x) => x.topic_id === t.id);
      const submitted = a.filter((x) => x.status === "submitted");
      const passedRows = submitted.filter((x) => x.passed);
      const best = submitted.reduce((m, x) => Math.max(m, Number(x.percent ?? 0)), 0);
      const status = passedRows.length ? "passed" : a.some((x) => x.status === "in_progress") ? "in_progress" : submitted.length ? "failed" : "todo";
      return {
        id: t.id,
        title: t.title,
        group: t.group,
        questionCount: t.questionCount,
        status,
        attempts: submitted.length,
        passes: passedRows.length,
        firstPassNo: passedRows.length ? Math.min(...passedRows.map((x) => x.seq as number)) : null,
        bestPercent: submitted.length ? best : null,
      };
    });
    const done = items.filter((i) => i.status === "passed").length;
    const daysLeft = daysBetween(today, r.deadline_on as string);
    return {
      id: r.id,
      title: r.title,
      startsOn: r.starts_on,
      deadlineOn: r.deadline_on,
      passPercent: r.pass_percent,
      daysLeft,
      overdue: daysLeft < 0,
      topicCount: items.length,
      doneCount: done,
      completed: items.length > 0 && done === items.length,
      topics: items,
    };
  });
  return NextResponse.json({ ok: true, enabled, examinee, rounds: out });
}
