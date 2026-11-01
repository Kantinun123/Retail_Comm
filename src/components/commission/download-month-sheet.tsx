"use client";

/* =============================================================
   แผ่นเลือกเดือนก่อนดาวน์โหลด (bottom sheet) — reusable
   - รับรายการ period ที่มีข้อมูล (YYYY-MM) + ปีที่ active จาก YearFilter
   - ติ๊กได้หลายเดือน, ปุ่มเลือกทั้งปี/ล้าง, ยืนยันแล้ว onConfirm(periods)
   ============================================================= */
import { useMemo, useState } from "react";
import { Icon } from "./icon";

const MONTH_TH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function DownloadMonthSheet({
  periods,
  defaultYear,
  onConfirm,
  onClose,
}: {
  /** period ทั้งหมดที่มีข้อมูล (YYYY-MM) */
  periods: string[];
  /** ปีที่ active จาก YearFilter (ค.ศ.) — ใช้เป็นค่าตั้งต้น */
  defaultYear: string | null;
  onConfirm: (selectedPeriods: string[]) => void;
  onClose: () => void;
}) {
  // จัดกลุ่ม period ตามปี
  const byYear = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of periods) {
      const y = p.split("-")[0];
      if (!m.has(y)) m.set(y, []);
      m.get(y)!.push(p);
    }
    for (const arr of m.values()) arr.sort((a, b) => b.localeCompare(a));
    return m;
  }, [periods]);

  const years = useMemo(() => [...byYear.keys()].sort((a, b) => b.localeCompare(a)), [byYear]);
  const [year, setYear] = useState<string>(
    defaultYear && byYear.has(defaultYear) ? defaultYear : years[0] ?? ""
  );
  // ค่าเริ่มต้น: ติ๊กทุกเดือนของปีที่เลือก
  const [selected, setSelected] = useState<Set<string>>(() => new Set(byYear.get(year) ?? []));

  const monthsOfYear = byYear.get(year) ?? [];

  function switchYear(y: string) {
    setYear(y);
    setSelected(new Set(byYear.get(y) ?? [])); // ติ๊กทุกเดือนของปีใหม่
  }
  function toggle(p: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(monthsOfYear));
  }
  function clearAll() {
    setSelected(new Set());
  }

  const count = [...selected].filter((p) => p.startsWith(year)).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold text-slate-900">เลือกเดือนที่จะดาวน์โหลด</p>
            <p className="text-[11px] text-slate-400">เลือกได้หลายเดือน · เลือก {count} เดือน</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95"
          >
            <Icon name="close" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* เลือกปี */}
          {years.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => switchYear(y)}
                  className={
                    "px-3 py-1.5 rounded-full text-[12px] font-semibold transition " +
                    (y === year ? "bg-[#d32029] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")
                  }
                >
                  ปี {Number(y) + 543}
                </button>
              ))}
            </div>
          )}

          {/* เลือกทั้งหมด/ล้าง */}
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-slate-600">เดือน (ปี {Number(year) + 543})</span>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="text-[11px] font-semibold text-[#d32029]">
                เลือกทั้งปี
              </button>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={clearAll} className="text-[11px] font-semibold text-slate-400">
                ล้าง
              </button>
            </div>
          </div>

          {/* grid เดือน */}
          <div className="grid grid-cols-3 gap-2">
            {monthsOfYear.map((p) => {
              const mm = Number(p.split("-")[1]);
              const on = selected.has(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggle(p)}
                  className={
                    "py-2.5 rounded-xl text-[13px] font-semibold border transition flex items-center justify-center gap-1 " +
                    (on
                      ? "bg-red-50 border-[#d32029] text-[#a11119]"
                      : "bg-white border-slate-200 text-slate-500 hover:border-red-200")
                  }
                >
                  {on && <Icon name="check" style={{ fontSize: 14 }} />}
                  {MONTH_TH[mm] ?? p}
                </button>
              );
            })}
          </div>
        </div>

        {/* ปุ่มยืนยัน */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-3">
          <button
            type="button"
            disabled={count === 0}
            onClick={() => onConfirm([...selected].filter((p) => p.startsWith(year)).sort((a, b) => b.localeCompare(a)))}
            className="w-full py-3 rounded-xl bg-[#d32029] text-white text-[14px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.99] transition disabled:opacity-50"
          >
            <Icon name="download" style={{ fontSize: 18 }} />
            ดาวน์โหลด {count > 0 ? `${count} เดือน` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
