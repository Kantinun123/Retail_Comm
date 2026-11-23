import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pushConfigError, pushConfigured, pushToUser } from "@/lib/server/push";
import { activeTopics, daysBetween, todayBkk } from "@/lib/server/exam";

/**
 * เตือนพนักงานขาย (SE) ที่ยังสอบ Competency ไม่ครบ — Vercel Cron 09:00 (เวลาไทย) ทุกวัน
 * - เตือนเมื่อเหลือ 7 / 3 / 1 วัน และวันครบกำหนด ; เลยกำหนดแล้วเตือนทุกวันจันทร์
 * - เฉพาะรอบที่เปิดอยู่และเริ่มแล้ว ; ส่งเฉพาะบัญชีจริง (ไม่ส่งบัญชีทดสอบ) ; ส่งเมื่อ EXAM_ENABLED=1 เท่านั้น
 * ป้องกันด้วย CRON_SECRET ; กันส่งซ้ำด้วย reminder_log ; ?dry=1 = ดูแผนอย่างเดียว
 */
const REMIND_DAYS = [7, 3, 1, 0];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const sb = createServiceClient();
  const today = req.nextUrl.searchParams.get("date") && dry ? req.nextUrl.searchParams.get("date")! : todayBkk();
  const weekday = new Date(today + "T00:00:00Z").getUTCDay();
  if (process.env.EXAM_ENABLED !== "1" && !dry) return NextResponse.json({ ok: true, today, skipped: "exam_not_enabled" });

  const { data: rounds } = await sb.from("exam_rounds").select("id, title, deadline_on, starts_on").eq("status", "open").lte("starts_on", today);
  const topicCount = (await activeTopics(sb)).length;
  type Msg = { kind: string; to: string; ref: string; title: string; body: string };
  const plan: Msg[] = [];

  for (const r of rounds ?? []) {
    const left = daysBetween(today, r.deadline_on as string);
    const due = REMIND_DAYS.includes(left) || (left < 0 && weekday === 1);
    if (!due) continue;
    const { data: reps } = await sb.from("sale_reps").select("rep_code").eq("position", "se").eq("is_active", true).limit(1000);
    const codes = (reps ?? []).map((x) => x.rep_code as string);
    if (!codes.length) continue;
    const [{ data: users }, prog] = await Promise.all([
      sb.from("profiles").select("id, rep_code").eq("role", "sales").eq("status", "approved").eq("is_test", false).in("rep_code", codes),
      sb.rpc("exam_progress", { p_round: r.id, p_include_test: false }),
    ]);
    const passed = new Map<string, number>();
    for (const p of (prog.data ?? []) as { rep_code: string; passed: boolean }[]) if (p.passed) passed.set(p.rep_code, (passed.get(p.rep_code) ?? 0) + 1);
    for (const u of users ?? []) {
      const done = passed.get(u.rep_code as string) ?? 0;
      if (done >= topicCount) continue;
      const remain = topicCount - done;
      const title = left < 0 ? "ข้อสอบ Competency เลยกำหนดแล้ว" : left === 0 ? "ข้อสอบ Competency ครบกำหนดวันนี้" : `ข้อสอบ Competency เหลืออีก ${left} วัน`;
      plan.push({ kind: "exam-deadline", to: u.id as string, ref: `${r.id}:${today}`, title, body: `${r.title} — ยังเหลือ ${remain} หัวข้อ (ครบกำหนด ${r.deadline_on})` });
    }
  }

  const pushReady = pushConfigured();
  if (dry) return NextResponse.json({ ok: true, dry: true, today, pushReady, pushError: pushReady ? null : pushConfigError, planned: plan.length, sample: plan.slice(0, 3) });
  let sent = 0;
  let skipped = 0;
  for (const m of plan) {
    const { data: seen } = await sb.from("reminder_log").select("id").eq("kind", m.kind).eq("user_id", m.to).eq("ref", m.ref).limit(1);
    if (seen?.length) {
      skipped++;
      continue;
    }
    const { error } = await sb.from("reminder_log").insert({ kind: m.kind, user_id: m.to, ref: m.ref, sent_on: today });
    if (error) {
      skipped++;
      continue;
    }
    const n = await pushToUser(sb, m.to, { title: m.title, body: m.body, url: "/app/exam", tag: `${m.kind}-${m.ref}` });
    await sb.from("reminder_log").update({ devices: n }).eq("kind", m.kind).eq("user_id", m.to).eq("ref", m.ref).eq("sent_on", today);
    sent += n;
  }
  return NextResponse.json({ ok: true, today, planned: plan.length, devicesSent: sent, skipped });
}
