import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { EXAM_VIEWER_ROLES, activeTopics, daysBetween, examinees, todayBkk } from "@/lib/server/exam";

interface Cell {
  topicId: number;
  attempts: number;
  passes: number;
  firstPassNo: number | null;
  bestPercent: number | null;
  passed: boolean;
}

/**
 * GET /api/exam/progress?roundId= -> ความคืบหน้าการสอบของ SE ตามขอบเขตของผู้ดู
 *   admin / หัวหน้า Area = ทุกร้าน ; Area / Coach = ร้านที่ดูแล ; ร้านค้า = ร้านตัวเอง
 *   ?includeTest=1 (admin) รวมการสอบของบัญชีทดสอบ
 */
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!EXAM_VIEWER_ROLES.includes(ctx.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const includeTest = ctx.role === "admin" && url.searchParams.get("includeTest") === "1";
  const sb = createServiceClient();

  const { data: rounds } = await sb
    .from("exam_rounds")
    .select("id, title, starts_on, deadline_on, pass_percent, status, created_at")
    .order("deadline_on", { ascending: false })
    .limit(50);
  const today = todayBkk();
  const roundList = (rounds ?? []).map((r) => ({
    id: r.id as number,
    title: r.title as string,
    startsOn: r.starts_on as string,
    deadlineOn: r.deadline_on as string,
    passPercent: r.pass_percent as number,
    status: r.status as "open" | "closed",
    daysLeft: daysBetween(today, r.deadline_on as string),
  }));
  const wanted = Number(url.searchParams.get("roundId"));
  const round = roundList.find((r) => r.id === wanted) ?? roundList.find((r) => r.status === "open") ?? roundList[0] ?? null;

  const topics = await activeTopics(sb);
  let adminInfo: unknown = undefined;
  if (ctx.role === "admin") {
    const [t, q] = await Promise.all([
      sb.from("exam_topics").select("id, title, sort").order("sort"),
      sb.from("exam_questions").select("topic_id, is_active, problem, sort").limit(5000),
    ]);
    adminInfo = {
      topics: (t.data ?? []).map((x) => {
        const qs = (q.data ?? []).filter((y) => y.topic_id === x.id);
        return {
          id: x.id,
          title: x.title,
          active: qs.filter((y) => y.is_active).length,
          inactive: qs.filter((y) => !y.is_active).map((y) => ({ sort: y.sort, problem: y.problem })),
        };
      }),
    };
  }
  if (!round) return NextResponse.json({ ok: true, role: ctx.role, rounds: roundList, round: null, topics, reps: [], summary: null, adminInfo });

  const reps = await examinees(sb, ctx.allowedDealerCodes);
  const dealerCodes = [...new Set(reps.map((r) => r.dealer_code))];
  const [dn, prog] = await Promise.all([
    dealerCodes.length ? sb.from("dealers").select("code, name").in("code", dealerCodes) : Promise.resolve({ data: [] }),
    sb.rpc("exam_progress", { p_round: round.id, p_include_test: includeTest }),
  ]);
  const names = new Map((dn.data ?? []).map((d) => [d.code as string, d.name as string]));
  const byRep = new Map<string, Map<number, Cell>>();
  for (const p of (prog.data ?? []) as { rep_code: string; topic_id: number; attempts: number; passes: number; first_pass_no: number | null; best_percent: number | null; passed: boolean }[]) {
    if (!byRep.has(p.rep_code)) byRep.set(p.rep_code, new Map());
    byRep.get(p.rep_code)!.set(p.topic_id, { topicId: p.topic_id, attempts: p.attempts, passes: p.passes, firstPassNo: p.first_pass_no, bestPercent: p.best_percent === null ? null : Number(p.best_percent), passed: p.passed });
  }
  const topicIds = topics.map((t) => t.id);
  const rows = reps
    .map((r) => {
      const cells = byRep.get(r.rep_code) ?? new Map<number, Cell>();
      const per = topicIds.map((id) => cells.get(id) ?? { topicId: id, attempts: 0, passes: 0, firstPassNo: null, bestPercent: null, passed: false });
      const done = per.filter((c) => c.passed).length;
      const attempts = per.reduce((s, c) => s + c.attempts, 0);
      return {
        repCode: r.rep_code,
        name: r.name,
        nickname: r.nickname,
        dealerCode: r.dealer_code,
        dealerName: names.get(r.dealer_code) ?? r.dealer_code,
        level: r.level,
        doneCount: done,
        attempts,
        passes: per.reduce((s, c) => s + c.passes, 0),
        completed: topicIds.length > 0 && done === topicIds.length,
        started: attempts > 0,
        topics: per,
      };
    })
    .sort((a, b) => Number(a.completed) - Number(b.completed) || a.doneCount - b.doneCount || a.dealerName.localeCompare(b.dealerName, "th"));
  const summary = {
    total: rows.length,
    completed: rows.filter((r) => r.completed).length,
    inProgress: rows.filter((r) => !r.completed && r.started).length,
    notStarted: rows.filter((r) => !r.started).length,
    topicCount: topicIds.length,
    totalAttempts: rows.reduce((s, r) => s + r.attempts, 0),
    totalPasses: rows.reduce((s, r) => s + r.passes, 0),
  };
  return NextResponse.json({ ok: true, role: ctx.role, rounds: roundList, round, topics, reps: rows, summary, adminInfo });
}
