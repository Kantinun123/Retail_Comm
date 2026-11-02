"use client";

/* =============================================================
   ตัวกรองปี (auto-show) — ใช้ร่วมหน้า back margin / commission product
   - โผล่เฉพาะเมื่อข้อมูลมี >1 ปี; ปีเดียว = ซ่อน (ไม่รก)
   - ปุ่มปีแนวนอน (พ.ศ.), default = ปีล่าสุด
   ============================================================= */
/** ดึงรายการปี (ค.ศ. จาก period 'YYYY-MM') เรียงใหม่->เก่า */
export function yearsOf(periods: string[]): string[] {
  const set = new Set<string>();
  periods.forEach((p) => {
    const y = p.split("-")[0];
    if (/^\d{4}$/.test(y)) set.add(y);
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
  const filtered =
    multiYear && activeYear
      ? items.filter((i) => i.period.startsWith(activeYear + "-"))
      : items;
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

/** แถบปุ่มเลือกปีแบบกะทัดรัด (มี "ทุกปี") สำหรับหน้าหลัก — render เสมอถ้ามี >=1 ปี */
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
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={
          "px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition active:scale-95 " +
          (activeYear === null ? "bg-[#d32029] text-white" : "bg-white border border-slate-200 text-slate-600")
        }
      >
        ทุกปี
      </button>
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
