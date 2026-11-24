import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { activeTopics, examinees } from "@/lib/server/exam";

/**
 * GET /api/exam/ranking?roundId=&includeTest=1  (admin เท่านั้น — ไว้ดูผู้ให้ความร่วมมือเพื่อแจกรางวัล)
 * "ครบ" = ผ่านทุกหัวข้อที่เปิดใช้อยู่ ; เวลาที่ใช้ = จากเริ่มสอบครั้งแรก ถึง เวลาที่ผ่านหัวข้อสุดท้าย (วินาที)
 * ส่งเฉพาะคนที่ครบ ; คนที่ยังไม่ครบนับเป็นจำนวนในสรุป
 */
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const includeTest = url.searchParams.get("includeTest") === "1";
  const sb = createServiceClient();

  const { data: rounds } = await sb.from("exam_rounds").select("id, title, starts_on, deadline_on, status").order("deadline_on", { ascending: false }).limit(50);
  const roundList = (rounds ?? []).map((r) => ({ id: r.id as number, title: r.title as string, startsOn: r.starts_on as string, deadlineOn: r.deadline_on as string, status: r.status as "open" | "closed" }));
  const wanted = Number(url.searchParams.get("roundId"));
  const round = roundList.find((r) => r.id === wanted) ?? roundList.find((r) => r.status === "open") ?? roundList[0] ?? null;
  if (!round) return NextResponse.json({ ok: true, rounds: roundList, round: null, topicCount: 0, rows: [], summary: { total: 0, completed: 0 } });

  const topics = await activeTopics(sb);
  const topicIds = topics.map((t) => t.id);
  const [reps, rpc] = await Promise.all([examinees(sb, "all"), sb.rpc("exam_ranking", { p_round: round.id, p_include_test: includeTest })]);
  const repMap = new Map(reps.map((r) => [r.rep_code, r]));
  const dealerCodes = [...new Set(reps.map((r) => r.dealer_code))];
  const { data: dn } = dealerCodes.length ? await sb.from("dealers").select("code, name").in("code", dealerCodes) : { data: [] };
  const names = new Map((dn ?? []).map((d) => [d.code as string, d.name as string]));

  type Raw = { rep_code: string; first_start: string; attempts: number; passes: number; topics: { topic_id: number; pass_at: string }[] };
  const rows = [];
  for (const x of (rpc.data ?? []) as Raw[]) {
    const rep = repMap.get(x.rep_code);
    if (!rep || !topicIds.length) continue;
    const passAt = new Map(x.topics.map((t) => [t.topic_id, t.pass_at]));
    if (!topicIds.every((id) => passAt.has(id))) continue;
    const finishedAt = topicIds.map((id) => passAt.get(id)!).sort().at(-1)!;
    const elapsedSec = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(x.first_start)) / 1000));
    rows.push({
      repCode: x.rep_code,
      name: rep.name,
      nickname: rep.nickname,
      dealerCode: rep.dealer_code,
      dealerName: names.get(rep.dealer_code) ?? rep.dealer_code,
      level: rep.level,
      firstStartAt: x.first_start,
      finishedAt,
      elapsedSec,
      attempts: x.attempts,
      passes: x.passes,
    });
  }
  return NextResponse.json({ ok: true, rounds: roundList, round, topicCount: topicIds.length, rows, summary: { total: reps.length, completed: rows.length } });
}
