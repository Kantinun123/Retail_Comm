"use client";

/* =============================================================
   ตัวกรองปี (auto-show) — ใช้ร่วมหน้า back margin / commission product
   - โผล่เฉพาะเมื่อข้อมูลมี >1 ปี; ปีเดียว = ซ่อน (ไม่รก)
   - ปุ่มปีแนวนอน (พ.ศ.), default = ปีล่าสุด
   ============================================================= */
/** แสดงข้อมูลย้อนหลังแค่ปีปัจจุบัน + ปีก่อนหน้า (ข้อมูลเก่ายังอยู่ในฐานข้อมูล แค่ไม่ให้เลือกบนหน้าจอ) */
export const VISIBLE_YEARS = 2;

/** ปี (ค.ศ.) เก่าสุดที่ให้เลือกบนหน้าจอ */
export function minVisibleYear(): string {
  return String(new Date().getFullYear() - (VISIBLE_YEARS - 1));
}

/** ดึงรายการปี (ค.ศ. จาก period 'YYYY-MM') เรียงใหม่->เก่า — เฉพาะปีที่แสดงได้ (ปีปัจจุบัน + ปีก่อน) */
export function yearsOf(periods: string[]): string[] {
  const min = minVisibleYear();
  const set = new Set<string>();
  periods.forEach((p) => {
    const y = p.split("-")[0];
    if (/^\d{4}$/.test(y) && y >= min) set.add(y);
  });
  return [...set].sort((a, b) => b.localeCompare(a));
}

/** pure helper (ไม่ใช่ hook): คำนวณปี + กรอง item ตามปีที่เลือก
 *  เรียกได้หลัง early-return ได้ (ไม่ผิดกฎ hooks) — รับ selected จาก useState ภายนอก
 *  T ต้องมี field period เป็น 'YYYY-MM' */
export function computeYearFilter<T extends { period: string }>(
  items: T[],
  selected: string | null
) {
  const years = yearsOf(items.map((i) => i.period));
  const activeYear = selected && years.includes(selected) ? selected : years[0] ?? null;
  const multiYear = years.length > 1;
  // ไม่ว่าจะมีกี่ปี ไม่แสดงรายการของปีที่เก่ากว่าช่วงที่กำหนด
  const filtered = activeYear
    ? items.filter((i) => i.period.startsWith(activeYear + "-"))
    : items.filter((i) => i.period.slice(0, 4) >= minVisibleYear());
  return { years, activeYear, multiYear, filtered };
}

/** รวมยอดของ months ตามปีที่เลือก (year=null -> ทุกปี). getVal ดึงค่าจากแต่ละ month */
export function sumByYear<T extends { period: string }>(
  months: T[] | undefined | null,
  year: string | null,
  getVal: (m: T) => number
): number {
  if (!months) return 0;
  return months.reduce((acc, m) => {
    if (year && !m.period.startsWith(year + "-")) return acc;
    return acc + (getVal(m) || 0);
  }, 0);
}

/** แถบปุ่มเลือกปีแบบกะทัดรัด สำหรับหน้ารายละเอียด — render เสมอถ้ามี >=1 ปี (onSelect รับ null ได้เพื่อความเข้ากันได้เดิม) */
export function YearChips({
  years,
  activeYear,
  onSelect,
}: {
  years: string[];
  /** null = ทุกปี */
  activeYear: string | null;
  onSelect: (y: string | null) => void;
}) {
  if (years.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <span className="text-[11px] text-slate-500 shrink-0 mr-0.5">เลือกปี:</span>
      {years.map((y) => {
        const active = y === activeYear;
        return (
          <button
            key={y}
            type="button"
            onClick={() => onSelect(y)}
            className={
              "px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition active:scale-95 " +
              (active ? "bg-[#d32029] text-white" : "bg-white border border-slate-200 text-slate-600")
            }
          >
            {Number(y) + 543}
          </button>
        );
      })}
      {/* ไม่มีปุ่ม "ทุกปี" — แสดงแค่ปีปัจจุบัน + ปีก่อน (ทุกปีจะรวมข้อมูลเก่าที่ซ่อนไว้) */}
    </div>
  );
}

/** แถบปุ่มเลือกปี (render เฉพาะเมื่อ multiYear) */
export function YearFilter({
  years,
  activeYear,
  onSelect,
}: {
  years: string[];
  activeYear: string | null;
  onSelect: (y: string) => void;
}) {
  if (years.length <= 1) return null;
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-2.5">
      <p className="text-[11px] font-semibold text-slate-500 mb-1.5 px-1">เลือกปี</p>
      <div className="flex flex-wrap gap-1.5">
        {years.map((y) => {
          const active = y === activeYear;
          return (
            <button
              key={y}
              type="button"
              onClick={() => onSelect(y)}
              className={
                "px-3.5 py-1.5 rounded-full text-[12px] font-bold transition active:scale-95 " +
                (active
                  ? "bg-[#d32029] text-white"
                  : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-red-200")
              }
            >
              ปี {Number(y) + 543}
            </button>
          );
        })}
      </div>
    </div>
  );
}
