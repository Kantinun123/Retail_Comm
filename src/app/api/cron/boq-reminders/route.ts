import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pushConfigError, pushConfigured, pushToUser } from "@/lib/server/push";
import { designerIds, dueAfterBusinessDays, loadHolidays, marketingIds, salesUserIds } from "@/lib/server/boq";

/**
 * เตือนงาน BOQ DECAAR ที่ค้าง — Vercel Cron 09:00 และ 13:00 (เวลาไทย)
 * - ไม่มีห้องแบบรับเกิน 4 ชม.          -> ห้องแบบทุกคน + Marketing (ครั้งเดียวต่องาน)
 * - ห้องแบบเกินกำหนดส่ง (SLA)          -> ห้องแบบที่รับงาน (ยังไม่มีคนรับ = ทุกคน) + Marketing (ครั้งเดียวต่องาน)
 * - BOQ ผ่านเกิน 7 วัน ไม่มีใบเสนอราคา -> พนักงานขาย (ทุก 7 วัน)
 * - เสนอราคาเกิน 30 วัน ไม่มีผล         -> พนักงานขาย (ทุก 30 วัน)
 * - ห้องแบบขอข้อมูลเพิ่มเกิน 2 วันทำการ   -> พนักงานขาย (ทุก 2 วันทำการ)
 * - วันจันทร์รอบเช้า: สรุปรายสัปดาห์      -> Marketing
 * ป้องกันด้วย CRON_SECRET ; กันส่งซ้ำด้วย reminder_log (kind + user + ref) ; ?dry=1 = ดูแผนอย่างเดียว
 */
const DAY = 86400000;
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const sb = createServiceClient();
  const now = Date.now();
  const bkk = new Date(now + 7 * 3600 * 1000);
  const today = bkk.toISOString().slice(0, 10);
  const morning = bkk.getUTCHours() < 12;
  const monday = bkk.getUTCDay() === 1;

  const { data: reqs } = await sb
    .from("boq_requests")
    .select("id, req_no, status, customer_name, rep_code, designer_id, created_at, due_at, boq_ok_at, need_info_at, is_test, dealer_code")
    .in("status", ["waiting", "working", "revise", "need_info", "boq_ok", "quoted"]);
  const holidays = await loadHolidays(sb);
  const rows = reqs ?? [];
  const quotedIds = rows.filter((r) => r.status === "quoted").map((r) => r.id as number);
  const { data: quotes } = quotedIds.length ? await sb.from("boq_quotes").select("request_id, created_at").in("request_id", quotedIds) : { data: [] };
  const firstQuote = new Map<number, number>();
  (quotes ?? []).forEach((q) => {
    const t = new Date(q.created_at as string).getTime();
    const id = q.request_id as number;
    if (!firstQuote.has(id) || t < firstQuote.get(id)!) firstQuote.set(id, t);
  });

  const cache = new Map<string, string[]>();
  const ids = async (key: string, fn: () => Promise<string[]>) => {
    if (!cache.has(key)) cache.set(key, await fn());
    return cache.get(key)!;
  };
  type Msg = { kind: string; to: string; ref: string; title: string; body: string; url: string };
  const plan: Msg[] = [];
  const add = (kind: string, to: string[], ref: string, title: string, body: string, url: string) => to.forEach((u) => plan.push({ kind, to: u, ref, title, body, url }));

  for (const r of rows) {
    const t = !!r.is_test;
    const who = `${r.req_no} · ${r.customer_name}`;
    const url = `/app/boq/${r.id}`;
    const mk = () => ids(`mk${t}`, () => marketingIds(sb, t));
    const ds = () => ids(`ds${t}`, () => designerIds(sb, t));
    const se = () => ids(`se${t}${r.rep_code}`, () => salesUserIds(sb, r.rep_code as string, t));
    if (r.status === "waiting" && now - new Date(r.created_at as string).getTime() > 4 * 3600 * 1000) {
      add("boq-unclaimed", [...(await ds()), ...(await mk())], String(r.id), "งาน BOQ ยังไม่มีห้องแบบรับ", `${who} — รอเกิน 4 ชั่วโมง`, url);
    }
    if (["waiting", "working", "revise"].includes(r.status as string) && new Date(r.due_at as string).getTime() < now) {
      const to = r.designer_id ? [r.designer_id as string] : await ds();
      add("boq-overdue", [...to, ...(await mk())], String(r.id), "BOQ เกินกำหนดส่ง", `${who} — เลยกำหนดส่งของห้องแบบแล้ว`, url);
    }
    if (r.status === "need_info" && r.need_info_at) {
      // ทุก 2 วันทำการที่ยังไม่เติมข้อมูล
      let k = 0;
      let t = new Date(r.need_info_at as string);
      while (k < 30) {
        const next = dueAfterBusinessDays(t, 2, holidays);
        if (next.getTime() > now) break;
        t = next;
        k++;
      }
      if (k > 0) add("boq-need-info", await se(), `${r.id}:${r.need_info_at}:${k}`, "ห้องแบบรอข้อมูลจากคุณ", `${who} — ยังไม่ได้เติมข้อมูลที่ห้องแบบขอ`, url);
    }
    if (r.status === "boq_ok" && r.boq_ok_at) {
      const d = Math.floor((now - new Date(r.boq_ok_at as string).getTime()) / DAY);
      if (d >= 7) add("boq-stale-ok", await se(), `${r.id}:${Math.floor(d / 7)}`, "อย่าลืมบันทึกใบเสนอราคา", `${who} — BOQ ผ่านมา ${d} วันแล้ว`, url);
    }
    if (r.status === "quoted" && firstQuote.has(r.id as number)) {
      const d = Math.floor((now - firstQuote.get(r.id as number)!) / DAY);
      if (d >= 30) add("boq-stale-quote", await se(), `${r.id}:${Math.floor(d / 30)}`, "อัปเดตผล Win / Loss", `${who} — เสนอราคามา ${d} วันแล้ว`, url);
    }
  }

  // สรุปรายสัปดาห์ (จันทร์เช้า) ให้ Marketing — 7 วันที่ผ่านมา (เฉพาะงานจริง)
  if (monday && morning) {
    const since = new Date(now - 7 * DAY).toISOString();
    const [{ data: created }, { data: closed }] = await Promise.all([
      sb.from("boq_requests").select("id").eq("is_test", false).gte("created_at", since),
      sb.from("boq_requests").select("status, final_amount").eq("is_test", false).gte("closed_at", since).in("status", ["win", "loss"]),
    ]);
    const wins = (closed ?? []).filter((c) => c.status === "win");
    const real = rows.filter((r) => !r.is_test);
    const overdue = real.filter((r) => ["waiting", "working", "revise"].includes(r.status as string) && new Date(r.due_at as string).getTime() < now).length;
    const body = `7 วันที่ผ่านมา: ขอใหม่ ${created?.length ?? 0} · Win ${wins.length} (${baht(wins.reduce((s, w) => s + Number(w.final_amount ?? 0), 0))}) · Loss ${(closed?.length ?? 0) - wins.length} · ค้างอยู่ ${real.length}${overdue ? ` · เกินกำหนด ${overdue}` : ""}`;
    add("boq-weekly", await marketingIds(sb, false), today, "สรุป BOQ DECAAR รายสัปดาห์", body, "/app/boq/overview");
  }

  const pushReady = pushConfigured();
  if (dry) return NextResponse.json({ ok: true, dry: true, today, pushReady, pushError: pushReady ? null : pushConfigError, plan });

  let sent = 0;
  let skipped = 0;
  for (const m of plan) {
    // ครั้งเดียวต่อ (kind, user, ref) — ไม่ขึ้นกับวัน
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
