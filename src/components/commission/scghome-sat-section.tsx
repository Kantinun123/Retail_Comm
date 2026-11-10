"use client";

/* ความพึงพอใจด้าน "สินค้าและร้าน" (SCG Home) — แบบสอบถามแยกจากงานบริการ ไม่รวมกับคะแนนหลักของหน้า
   แสดงเมื่อมีข้อมูลเท่านั้น (ร้าน Housing Expert จะไม่เห็นส่วนนี้) */

import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

interface Summary {
  count: number;
  overall: number | null;
  questions: { key: string; label: string; avg: number | null; n: number }[];
  months: { period: string; count: number; overall: number | null }[];
  improve: { date: string; text: string }[];
}

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthLabel = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${TH_MONTH[m - 1]} ${String(y + 543).slice(-2)}`;
};
const score = (v: number | null) => (v == null ? "-" : v.toFixed(1));

export function ScghomeSatSection({ dealerCode }: { dealerCode: string | null }) {
  const [data, setData] = useState<{ code: string | null; s: Summary } | null>(null);
  const [showAllMonths, setShowAllMonths] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
    fetch(`/api/scghome-sat${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.ok) setData({ code: dealerCode, s: j as Summary });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  const s = data && data.code === dealerCode ? data.s : null;
  if (!s || s.count === 0) return null;

  const months = showAllMonths ? s.months : s.months.slice(0, 4);
  const qs = [...s.questions].filter((q) => q.avg != null).sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));

  return (
    <section className="rounded-2xl bg-white border border-amber-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-1.5">
            <Icon name="storefront" className="text-lg text-amber-600" />
            ความพึงพอใจด้านสินค้าและร้าน
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            แบบสอบถามของ SCG Home · แยกจากคะแนนงานบริการด้านบน
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="tnum text-[22px] font-bold text-amber-700 leading-none">{score(s.overall)}</p>
          <p className="text-[10.5px] text-slate-400 mt-0.5">/ 10 · {s.count.toLocaleString()} รายการ</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-[11px] font-semibold text-slate-500">คะแนนรายข้อ (เรียงจากต่ำไปสูง)</p>
        {qs.map((q) => {
          const v = q.avg ?? 0;
          const low = v < 7;
          return (
            <div key={q.key} className="flex items-center gap-2">
              <span className={cn("text-[11px] w-[170px] shrink-0 truncate", low ? "text-[#b91c1c] font-semibold" : "text-slate-700")}>
                {q.label}
              </span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                <div className={cn("h-full rounded-full", low ? "bg-[#ef4444]" : "bg-amber-400")} style={{ width: `${Math.max(4, v * 10)}%` }} />
              </div>
              <span className={cn("tnum text-[11px] font-bold w-8 text-right shrink-0", low ? "text-[#b91c1c]" : "text-slate-800")}>
                {score(q.avg)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold text-slate-500 mb-1.5">รายเดือน</p>
        <div className="grid grid-cols-2 gap-2">
          {months.map((m) => (
            <div key={m.period} className="rounded-xl bg-amber-50/60 border border-amber-100 px-3 py-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-700">{monthLabel(m.period)}</span>
              <span className="text-right">
                <span className="tnum text-[13px] font-bold text-slate-900">{score(m.overall)}</span>
                <span className="text-[10px] text-slate-400"> · {m.count}</span>
              </span>
            </div>
          ))}
        </div>
        {s.months.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAllMonths((v) => !v)}
            className="mt-2 text-[11px] font-bold text-amber-700 hover:underline"
          >
            {showAllMonths ? "แสดงน้อยลง" : `ดูทั้งหมด ${s.months.length} เดือน`}
          </button>
        )}
      </div>

      {s.improve.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-slate-500 mb-1.5">สิ่งที่ลูกค้าอยากให้ปรับปรุง (ล่าสุด)</p>
          <ul className="space-y-1.5">
            {s.improve.map((c, i) => (
              <li key={i} className="text-[11.5px] text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
