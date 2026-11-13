import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { bangkokToday, buildTracking, daysInMonth } from "@/lib/server/eval-tracking";
import { pushConfigured, pushToUser } from "@/lib/server/push";
import { thaiMonth } from "@/lib/server/thai-month";

/**
 * แจ้งเตือนการตรวจประเมินร้านรายวัน — Vercel Cron 09:00 (เวลาไทย) ทุกวัน
 * - ตั้งแต่วันที่ 15: Coach ที่ยังมีร้านค้างตรวจในเดือนนี้
 * - 5 วันสุดท้ายของเดือน: Area ที่มี Coach ในทีมยังตรวจไม่ครบ
 * - วันที่ 1: Admin ได้สรุปเดือนก่อน (ขาด / ซ้ำ)
 * ป้องกัน: ต้องมี Authorization: Bearer <CRON_SECRET> (Vercel ส่งให้อัตโนมัติ) ; ส่งซ้ำวันเดียวกันไม่ได้ (reminder_log)
 * ?dry=1 = ดูแผนอย่างเดียว ไม่ส่ง ; ?date=YYYY-MM-DD = จำลองวันที่ (ใช้คู่กับ dry เท่านั้น)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const sim = req.nextUrl.searchParams.get("date");
  const today = dry && sim && /^\d{4}-\d{2}-\d{2}$/.test(sim) ? sim : bangkokToday();
  const period = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const dim = daysInMonth(period);
  const sb = createServiceClient();
  const plan: { kind: string; to: string; title: string; body: string; url: string; ref: string }[] = [];

  const { data: profiles } = await sb.from("profiles").select("id, role, rep_code, full_name").eq("status", "approved").in("role", ["coach", "re", "area", "admin"]);
  const usersByRep = new Map<string, string[]>();
  (profiles ?? []).forEach((p) => {
    if (p.rep_code) usersByRep.set(p.rep_code as string, [...(usersByRep.get(p.rep_code as string) ?? []), p.id as string]);
  });

  if (day >= 15) {
    const t = await buildTracking(sb, period, null);
    const left = dim - day;
    for (const c of t.coaches) {
      const missing = c.total - c.done;
      if (!c.repCode || missing <= 0) continue;
      for (const uid of usersByRep.get(c.repCode) ?? []) {
        plan.push({
          kind: "eval-coach",
          to: uid,
          ref: period,
          title: `ตรวจประเมินร้าน ${thaiMonth(period)}`,
          body: `ยังเหลือ ${missing} จาก ${c.total} ร้านที่ยังไม่ตรวจ · เหลือเวลา ${left} วัน`,
          url: "/app/eval-tracking",
        });
      }
    }
    if (day >= dim - 4) {
      const byArea = new Map<string, { missing: number; coaches: Set<string> }>();
      t.coaches.forEach((c) =>
        c.stores.forEach((s) => {
          if (s.status !== "missing" || !s.areaRep) return;
          const x = byArea.get(s.areaRep) ?? { missing: 0, coaches: new Set<string>() };
          x.missing++;
          x.coaches.add(c.nickname || c.name);
          byArea.set(s.areaRep, x);
        })
      );
      for (const [areaRep, x] of byArea) {
        for (const uid of usersByRep.get(areaRep) ?? []) {
          plan.push({
            kind: "eval-area",
            to: uid,
            ref: period,
            title: `ทีมยังตรวจร้านไม่ครบ · ${thaiMonth(period)}`,
            body: `เหลือ ${x.missing} ร้าน (Coach: ${[...x.coaches].join(", ")}) · อีก ${dim - day} วันสิ้นเดือน`,
            url: "/app/eval-tracking",
          });
        }
      }
    }
  }

  if (day === 1) {
    const d = new Date(`${period}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    const prev = d.toISOString().slice(0, 7);
    const t = await buildTracking(sb, prev, null);
    (profiles ?? [])
      .filter((p) => p.role === "admin")
      .forEach((p) =>
        plan.push({
          kind: "eval-admin",
          to: p.id as string,
          ref: prev,
          title: `สรุปตรวจประเมินร้าน ${thaiMonth(prev)}`,
          body: `ตรวจแล้ว ${t.totals.done}/${t.totals.stores} ร้าน · ขาด ${t.totals.missing} · ซ้ำ ${t.totals.duplicates}`,
          url: `/app/eval-tracking?p=${prev}`,
        })
      );
  }

  if (dry) return NextResponse.json({ ok: true, dry: true, today, pushReady: pushConfigured(), plan });

  // ส่งจริง: ข้ามที่ส่งไปแล้ววันนี้
  let sent = 0;
  let skipped = 0;
  for (const m of plan) {
    const { error } = await sb.from("reminder_log").insert({ kind: m.kind, user_id: m.to, ref: m.ref, sent_on: today });
    if (error) {
      skipped++;
      continue;
    }
    const n = await pushToUser(sb, m.to, { title: m.title, body: m.body, url: m.url, tag: m.kind });
    await sb.from("reminder_log").update({ devices: n }).eq("kind", m.kind).eq("user_id", m.to).eq("ref", m.ref).eq("sent_on", today);
    sent += n;
  }
  return NextResponse.json({ ok: true, today, planned: plan.length, devicesSent: sent, skipped });
}
