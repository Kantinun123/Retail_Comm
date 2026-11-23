import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pushConfigError, pushConfigured, pushToUser } from "@/lib/server/push";
import { loadHolidays } from "@/lib/server/boq";
import { roleIds } from "@/lib/server/refund";
/**
 * เตือนคำขอคืนเงินที่ค้าง — Vercel Cron 09:00 (เวลาไทย) วันทำการ ; วันละครั้งต่อคำขอต่อคน
 * - รออนุมัติข้ามวัน (SLA ผู้อนุมัติ 0 วัน)        -> ผู้อนุมัติของคำขอ
 * - รอ Finance รับงาน เลยกำหนด 3 วันทำการ           -> Finance ทุกคน
 * - Finance รับแล้ว เลยกำหนด                       -> Finance ที่รับงาน
 * - รอบัญชีโอน เลยกำหนด 7 วันทำการ                  -> บัญชี
 * ช่วงทีมขายแก้ไข (finance_returned) ไม่นับ SLA (due_at = null) จึงไม่เตือน
 * ป้องกันด้วย CRON_SECRET ; กันส่งซ้ำด้วย reminder_log ; ?dry=1 = ดูแผนอย่างเดียว
 */
const HOUR = 3600000;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const sb = createServiceClient();
  const now = Date.now();
  const bkk = new Date(now + 7 * HOUR);
  const today = bkk.toISOString().slice(0, 10);
  const holidays = await loadHolidays(sb);
  const offDay = bkk.getUTCDay() === 0 || bkk.getUTCDay() === 6 || holidays.has(today);
  if (offDay && !dry) return NextResponse.json({ ok: true, today, skipped: "holiday" });

  const { data: reqs } = await sb
    .from("refund_requests")
    .select("id, req_no, status, cust_name, refund_amount, approver_id, finance_id, due_at, updated_at, is_test")
    .in("status", ["pending_approval", "pending_finance", "finance_working", "pending_transfer"]);
  const cache = new Map<string, string[]>();
  const team = async (role: string, t: boolean) => {
    const k = `${role}${t}`;
    if (!cache.has(k)) cache.set(k, await roleIds(sb, role, t));
    return cache.get(k)!;
  };
  type Msg = { kind: string; to: string; ref: string; title: string; body: string; url: string };
  const plan: Msg[] = [];
  const add = (kind: string, to: (string | null)[], ref: string, title: string, body: string, url: string) =>
    to.filter((u): u is string => !!u).forEach((u) => plan.push({ kind, to: u, ref, title, body, url }));
  for (const r of reqs ?? []) {
    const t = !!r.is_test;
    const who = `${r.req_no} · ${r.cust_name} · ฿${Number(r.refund_amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
    const url = `/app/refund/${r.id}`;
    const ref = `${r.id}:${today}`;
    const late = !!r.due_at && new Date(r.due_at as string).getTime() < now;
    if (r.status === "pending_approval" && now - new Date(r.updated_at as string).getTime() > 20 * HOUR) {
      add("refund-approve", [r.approver_id as string], ref, "คำขอคืนเงินรอคุณอนุมัติ", who, url);
    }
    if (r.status === "pending_finance" && late) {
      add("refund-finance-late", await team("finance", t), ref, "คำขอคืนเงินเกินกำหนด · ยังไม่มี Finance รับงาน", who, url);
    }
    if (r.status === "finance_working" && late) {
      add("refund-finance-late", [r.finance_id as string], ref, "คำขอคืนเงินเกินกำหนดตรวจ (Finance)", who, url);
    }
    if (r.status === "pending_transfer" && late) {
      add("refund-transfer-late", await team("accounting", t), ref, "คำขอคืนเงินเกินกำหนดโอน", who, url);
    }
  }
  const pushReady = pushConfigured();
  if (dry) return NextResponse.json({ ok: true, dry: true, today, offDay, pushReady, pushError: pushReady ? null : pushConfigError, plan });
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
    const n = await pushToUser(sb, m.to, { title: m.title, body: m.body, url: m.url, tag: `${m.kind}-${m.ref}` });
    await sb.from("reminder_log").update({ devices: n }).eq("kind", m.kind).eq("user_id", m.to).eq("ref", m.ref).eq("sent_on", today);
    sent += n;
  }
  return NextResponse.json({ ok: true, today, planned: plan.length, devicesSent: sent, skipped });
}
