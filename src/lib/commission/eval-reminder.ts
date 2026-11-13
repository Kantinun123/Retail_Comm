"use client";

/* เตือนในแอป (กระดิ่ง) เรื่องตรวจประเมินร้าน — กติกาเดียวกับแจ้งเตือนรายวันบนมือถือ
   - Coach: ตั้งแต่วันที่ 15 ถ้ายังมีร้านค้างตรวจในเดือนนี้
   - Area / หัวหน้า Area: 5 วันสุดท้ายของเดือน ถ้าทีมยังตรวจไม่ครบ
   ดึงครั้งเดียวต่อการโหลดแอป (cache ใน module) */
import { useEffect, useState } from "react";
import { fetchTracking, monthLabel } from "./eval-tracking-store";

export interface EvalReminder {
  title: string;
  detail: string;
}

let cache: Promise<EvalReminder | null> | null = null;

async function load(): Promise<EvalReminder | null> {
  const r = await fetchTracking();
  if (!r.ok) return null;
  const day = Number(r.today.slice(8, 10));
  const missing = r.totals.missing;
  if (missing <= 0) return null;
  const isCoach = r.me.role === "coach" || r.me.role === "re";
  if (isCoach && day >= 15) {
    return { title: `ตรวจประเมินร้าน ${monthLabel(r.period)}: เหลือ ${missing} ร้าน`, detail: `ตรวจแล้ว ${r.totals.done}/${r.totals.stores} · เหลือเวลา ${r.daysLeft} วัน` };
  }
  if (!isCoach && r.daysLeft <= 4) {
    const behind = r.coaches.filter((c) => c.repCode && c.done < c.total).length;
    return { title: `ทีมยังตรวจร้านไม่ครบ ${missing} ร้าน`, detail: `Coach ที่ยังไม่ครบ ${behind} คน · อีก ${r.daysLeft} วันสิ้นเดือน` };
  }
  return null;
}

export function useEvalReminder(enabled: boolean): EvalReminder | null {
  const [value, setValue] = useState<EvalReminder | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    cache ??= load().catch(() => null);
    cache.then((v) => !cancelled && setValue(v));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return enabled ? value : null;
}
