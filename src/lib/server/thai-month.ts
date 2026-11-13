const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-11" -> "พ.ย. 69" */
export function thaiMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${String(y + 543).slice(-2)}`;
}
