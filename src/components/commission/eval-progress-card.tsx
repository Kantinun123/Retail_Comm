"use client";

/* การ์ด "ตรวจประเมินร้าน เดือนนี้" บนหน้าแรกของกลุ่ม Area
   - Coach: ความคืบหน้าของตัวเอง + ร้านที่ยังไม่ตรวจ (ปุ่มเปิดแบบฟอร์ม JotForm)
   - Area / หัวหน้า Area: สรุปทีม (ตรวจแล้ว X/Y · Coach ที่ยังไม่ครบ) -> หน้าติดตาม */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { EVAL_FORM_URL, fetchTracking, monthLabel, pctText, shortDate, type Tracking } from "@/lib/commission/eval-tracking-store";
import { cn } from "@/lib/utils";

const SHOW = 3;

export function EvalProgressCard() {
  const [t, setT] = useState<Tracking | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTracking().then((r) => !cancelled && r.ok && setT(r));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!t || t.totals.stores === 0) return null;
  const isCoach = t.me.role === "coach" || t.me.role === "re";
  const { done, stores } = t.totals;
  const pct = Math.round((done / Math.max(1, stores)) * 100);
  const missingStores = t.coaches.flatMap((c) => c.stores).filter((s) => s.status === "missing");
  const doneStores = t.coaches.flatMap((c) => c.stores).filter((s) => s.status === "done");
  const behind = t.coaches.filter((c) => c.repCode && c.done < c.total);
  const urgent = Number(t.today.slice(8, 10)) >= 15 && missingStores.length > 0;

  return (
    <section className={cn("rounded-2xl bg-white border-2 shadow-sm p-3.5", urgent ? "border-amber-300" : "border-blue-200")} aria-labelledby="eval-card-title">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <Icon name="fact_check" className="text-2xl" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="eval-card-title" className="text-[14px] font-bold text-slate-900">ตรวจประเมินร้าน {monthLabel(t.period)}</h2>
          <p className="text-[11px] text-slate-500">
            ตรวจแล้ว {done} จาก {stores} ร้าน · เหลือ {t.daysLeft} วัน
          </p>
        </div>
        <span className={cn("tnum text-[15px] font-bold", pct === 100 ? "text-emerald-600" : urgent ? "text-amber-600" : "text-blue-700")}>{pct}%</span>
      </div>
      <div className="mt-2.5 h-2.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-blue-600")} style={{ width: `${pct}%` }} />
      </div>

      {isCoach ? (
        missingStores.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            <p className="text-[11.5px] font-bold text-slate-700">ยังไม่ได้ตรวจ ({missingStores.length})</p>
            {(all ? missingStores : missingStores.slice(0, SHOW)).map((s) => (
              <div key={s.code} className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-slate-900 truncate">{s.name}</span>
                  <span className="block text-[10.5px] text-amber-800">{s.code} · ยังไม่ตรวจเดือนนี้</span>
                </span>
                <a href={EVAL_FORM_URL} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-blue-600 text-white text-[11.5px] font-bold px-3 py-1.5 hover:-translate-y-0.5 transition-all">
                  ทำแบบประเมิน
                </a>
              </div>
            ))}
            {missingStores.length > SHOW && (
              <button type="button" onClick={() => setAll((x) => !x)} className="w-full text-[11.5px] font-semibold text-blue-700 py-1">
                {all ? "ย่อรายการ" : `ดูอีก ${missingStores.length - SHOW} ร้าน`}
              </button>
            )}
            <p className="text-[10.5px] text-slate-400">ส่งฟอร์มแล้ว ระบบจะอัปเดตภายใน ~1 ชั่วโมง (08:00–19:00)</p>
          </div>
        ) : (
          <p className="mt-3 text-[12px] font-semibold text-emerald-700 flex items-center gap-1">
            <Icon name="check_circle" style={{ fontSize: 16 }} fill />
            ตรวจครบทุกร้านแล้ว ขอบคุณครับ
          </p>
        )
      ) : (
        <p className="mt-2.5 text-[11.5px] text-slate-600">
          {behind.length > 0 ? `Coach ที่ยังไม่ครบ ${behind.length} คน · ขาด ${missingStores.length} ร้าน` : "ทุก Coach ตรวจครบแล้ว"}
          {t.totals.duplicates > 0 && <span className="text-[#a11119]"> · ซ้ำ {t.totals.duplicates}</span>}
        </p>
      )}

      {isCoach && doneStores.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11.5px] font-semibold text-slate-600 cursor-pointer">ตรวจแล้ว ({doneStores.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {doneStores.map((s) => (
              <li key={s.code} className="flex justify-between text-[11px] text-slate-700">
                <span className="truncate">✓ {s.name}</span>
                <span className={cn("shrink-0 ml-2", (s.submissions[0]?.pct ?? 1) < 0.8 ? "text-amber-700" : "text-emerald-700")}>
                  {shortDate(s.submissions[0]?.evalDate ?? null)} · {pctText(s.submissions[0]?.pct ?? null)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Link href="/app/eval-tracking" className="mt-2.5 flex items-center justify-end text-[11.5px] font-bold text-blue-700">
        {isCoach ? "ดูรายละเอียด" : "ติดตามการตรวจร้าน"}
        <Icon name="chevron_right" style={{ fontSize: 16 }} />
      </Link>
    </section>
  );
}
