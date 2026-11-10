"use client";

/* ตัวเลือกช่วงเวลาของหน้าหลัก (ใช้ร่วมหน้าร้าน/พนักงาน)
   [ 📅 เดือน ต.ค. 2569 ▾ ] [ สะสมปี 2569 ▾ ] — คุมทุกการ์ดในหน้า ; ติดด้านบนเวลาเลื่อน
   แผ่นเลือกเดือนแสดงจุดความครบของข้อมูลรายเดือนของเดือนนั้น */
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { currentPeriod, lastFullPeriod, periodFull, periodLong, type HubView } from "@/lib/commission/freshness-store";
import { cn } from "@/lib/utils";

export interface PeriodPick {
  mode: "month" | "year";
  period: string;
  year: string;
}
export const toView = (p: PeriodPick): HubView => (p.mode === "month" ? { mode: "month", period: p.period } : { mode: "year", year: p.year });
export const defaultPick = (): PeriodPick => {
  const p = lastFullPeriod();
  return { mode: "month", period: p, year: p.slice(0, 4) };
};

/** รายการเดือนตั้งแต่ ม.ค. 2568 ถึงเดือนปัจจุบัน (ใหม่ -> เก่า) */
export function hubPeriods(): string[] {
  const out: string[] = [];
  const cur = currentPeriod();
  for (let y = Number(cur.slice(0, 4)); y >= 2025; y--) {
    for (let m = 12; m >= 1; m--) {
      const p = `${y}-${String(m).padStart(2, "0")}`;
      if (p <= cur) out.push(p);
    }
  }
  return out;
}

export function PeriodBar({
  pick,
  onChange,
  years,
  completeness,
}: {
  pick: PeriodPick;
  onChange: (p: PeriodPick) => void;
  years: string[];
  /** จำนวนแหล่งรายเดือนที่ข้อมูลมาแล้ว / ทั้งหมด ของเดือนนั้น */
  completeness?: (period: string) => { have: number; total: number } | null;
}) {
  const [sheet, setSheet] = useState<"month" | "year" | null>(null);
  const cur = currentPeriod();
  const lastFull = lastFullPeriod();
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);
  const yearList = years.length ? years : [cur.slice(0, 4)];

  return (
    <>
      <div className="sticky top-[60px] z-10 -mx-1 px-1 py-1 bg-[#f7f4f4]/90 backdrop-blur">
        <div className="grid grid-cols-[1.35fr_1fr] gap-1 rounded-2xl bg-slate-200/80 p-1" role="group" aria-label="ช่วงเวลาที่แสดง">
          <button
            type="button"
            onClick={() => (pick.mode === "month" ? setSheet("month") : onChange({ ...pick, mode: "month" }))}
            aria-pressed={pick.mode === "month"}
            className={cn("rounded-xl px-3 py-2 text-left transition flex items-center gap-1.5 min-w-0", pick.mode === "month" ? "bg-white shadow-sm" : "hover:bg-white/50")}
          >
            <Icon name="calendar_month" className={pick.mode === "month" ? "text-[#d32029]" : "text-slate-400"} style={{ fontSize: 17 }} />
            <span className={cn("text-[12.5px] font-bold truncate", pick.mode === "month" ? "text-slate-900" : "text-slate-500")}>เดือน {periodLong(pick.period)}</span>
            {pick.mode === "month" && pick.period === lastFull && <span className="text-[9.5px] text-slate-400 shrink-0">ครบล่าสุด</span>}
            <Icon name="expand_more" className="text-slate-400 ml-auto shrink-0" style={{ fontSize: 17 }} />
          </button>
          <button
            type="button"
            onClick={() => (pick.mode === "year" ? setSheet("year") : onChange({ ...pick, mode: "year" }))}
            aria-pressed={pick.mode === "year"}
            className={cn("rounded-xl px-3 py-2 text-[12.5px] font-bold transition flex items-center justify-center gap-1", pick.mode === "year" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:bg-white/50")}
          >
            สะสมปี {Number(pick.year) + 543}
            {pick.mode === "year" && <Icon name="expand_more" className="text-slate-400" style={{ fontSize: 17 }} />}
          </button>
        </div>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-end sm:items-center justify-center" onClick={() => setSheet(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={sheet === "month" ? "เลือกเดือน" : "เลือกปี"}
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[75vh] overflow-y-auto p-5 animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[16px] font-bold text-slate-900">{sheet === "month" ? "เลือกเดือน" : "เลือกปี"}</h3>
              <button type="button" onClick={() => setSheet(null)} aria-label="ปิด" className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                <Icon name="close" style={{ fontSize: 18 }} />
              </button>
            </div>
            {sheet === "month" ? (
              <>
                {completeness && <p className="text-[10.5px] text-slate-500 mb-2.5">จุด = ข้อมูลผลประโยชน์ของเดือนนั้นมาครบกี่แหล่ง</p>}
                <ul className="space-y-1.5">
                  {hubPeriods().map((p) => {
                    const c = completeness?.(p) ?? null;
                    const active = p === pick.period;
                    return (
                      <li key={p}>
                        <button
                          type="button"
                          onClick={() => {
                            onChange({ mode: "month", period: p, year: p.slice(0, 4) });
                            setSheet(null);
                          }}
                          aria-pressed={active}
                          className={cn("w-full flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition", active ? "border-[#d32029] bg-red-50/50" : "border-slate-100 hover:bg-slate-50")}
                        >
                          <span className="flex-1 min-w-0">
                            <span className={cn("block text-[13px] font-bold", active ? "text-[#a11119]" : "text-slate-900")}>{periodFull(p)}</span>
                            <span className="block text-[10px] text-slate-400">
                              {p === cur ? "เดือนปัจจุบัน · ยังไม่ครบเดือน" : p === lastFull ? "ครบล่าสุด (ค่าเริ่มต้น)" : c ? (c.have >= c.total ? "ข้อมูลครบ" : `ข้อมูลมาแล้ว ${c.have}/${c.total} แหล่ง`) : ""}
                            </span>
                          </span>
                          {c && c.total > 0 && (
                            <span className="flex items-center gap-1 shrink-0" aria-label={`ข้อมูล ${c.have} จาก ${c.total} แหล่ง`}>
                              {Array.from({ length: c.total }, (_, i) => (
                                <span key={i} className={cn("w-2.5 h-2.5 rounded-full", i < c.have ? "bg-emerald-500" : "bg-slate-200")} />
                              ))}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <ul className="space-y-1.5 mt-2">
                {yearList.map((y) => (
                  <li key={y}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ ...pick, mode: "year", year: y });
                        setSheet(null);
                      }}
                      className={cn("w-full rounded-2xl border px-3.5 py-3 text-left text-[13px] font-bold transition", pick.year === y ? "border-[#d32029] bg-red-50/50 text-[#a11119]" : "border-slate-100 text-slate-900 hover:bg-slate-50")}
                    >
                      สะสมปี {Number(y) + 543}
                      {y === cur.slice(0, 4) && <span className="text-[10px] font-normal text-slate-400 ml-1.5">(ถึงปัจจุบัน)</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
