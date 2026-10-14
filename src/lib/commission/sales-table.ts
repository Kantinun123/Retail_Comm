/* =============================================================
   สร้างตารางรายการค่าคอมมิชชันจากข้อมูลดิบ (ใช้ร่วมกันทั้งหน้า
   ฐานข้อมูล และหน้าภาพรวม) — คอลัมน์ตรงกับไฟล์ CSV ต้นฉบับ
   แยกเป็นมุมมอง "ร้านค้า" (Commission) และ "พนักงาน" (Incentive)
   ============================================================= */
import type { Dataset } from "./dataset";
import type { Dealer, Sale, Solution, TeamMember } from "./types";

/** ตัวคั่นหลักพัน + ทศนิยม 2 ตำแหน่ง */
export function money2(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n))
    return value === undefined || value === null ? "" : String(value);
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** คอลัมน์ 20 ตัวตามไฟล์ CSV ต้นฉบับ (หัวเหมือนกันทั้งไฟล์ร้านค้าและพนักงาน) */
export const RAW_COLUMNS: string[] = [
  "ที่มาของข้อมูล",
  "ประเภทร้านค้า",
  "รหัสร้านค้า",
  "ชื่อร้านค้า",
  "เลขที่งาน",
  "ชื่อลูกค้า",
  "ชื่อผู้ขาย",
  "ประเภทของงาน",
  "กลุ่มของงาน",
  "ยอดขายที่ใช้คำนวณ",
  "รวมผลประโยชน์",
  "อัตราผลประโยชน์",
  "ประเภทผลประโยชน์",
  "กลุ่มผู้ที่รับผลประโยชน์",
  "ช่วงเวลาที่ปิดขาย",
  "วันที่ปิดขาย",
  "วันที่โอนจ่าย",
  "รหัสผู้รับเงิน",
  "ชื่อผู้รับเงิน",
  "สถานะการจ่ายเงิน",
];

/** คอลัมน์ที่เป็นตัวเงิน (format ตัวคั่นหลักพัน + ทศนิยม 2 ตำแหน่ง) */
export const MONEY_RAW_COLUMNS = new Set<string>([
  "ยอดขายที่ใช้คำนวณ",
  "รวมผลประโยชน์",
]);

const PAY_STATUS_TH: Record<string, string> = {
  paid: "ชำระแล้ว",
  pending: "มีกำหนดชำระแล้ว",
  processing: "รอสรุป",
};

/** ประเภทผลประโยชน์ฝั่งร้านค้า อิงตามที่มาของข้อมูล (ตรงกับไฟล์ดิบ)
 *  - DI  => Back Margin
 *  - อื่นๆ (BA / Netsuite) => Commission */
function storeBenefitType(src?: string): string {
  return (src ?? "").trim().toUpperCase() === "DI" ? "Back Margin" : "Commission";
}

/** ตัวแปรค้นหา dealer/solution/employee ที่ส่งเข้ามา (รับได้ทั้ง Dataset และ array) */
interface Lookups {
  dealers: Dealer[];
  solutions: Solution[];
  salesTeam: TeamMember[];
}
function toLookups(src: Dataset | Lookups): Lookups {
  return {
    dealers: src.dealers,
    solutions: src.solutions,
    salesTeam: src.salesTeam,
  };
}

/** คอลัมน์ 1-14 ที่เหมือนกันทั้งสองไฟล์ (ข้อมูลงาน) */
function commonCells(s: Sale, lk: Lookups): Record<string, unknown> {
  const dealer = lk.dealers.find((d) => d.code === s.dealerCode);
  const sol = lk.solutions.find((x) => x.id === s.solId);
  return {
    "ที่มาของข้อมูล": s.src ?? "",
    "ประเภทร้านค้า": dealer?.model ?? "",
    "รหัสร้านค้า": s.dealerCode ?? "",
    "ชื่อร้านค้า": dealer?.name ?? "",
    "เลขที่งาน": s.projectId,
    "ชื่อลูกค้า": s.customer,
    "ชื่อผู้ขาย": s.seller ?? "",
    "ประเภทของงาน": sol?.category ?? "",
    "กลุ่มของงาน": sol?.name ?? "",
    "ยอดขายที่ใช้คำนวณ": s.amount,
    "ช่วงเวลาที่ปิดขาย": s.closeRange ?? "",
    "วันที่ปิดขาย": s.closeDateRaw ?? "",
    "วันที่โอนจ่าย": s.payDateRaw ?? "",
    "สถานะการจ่ายเงิน": PAY_STATUS_TH[s.status] ?? s.status,
  };
}

/** 1 แถวของไฟล์ "ร้านค้า" — ผลประโยชน์/อัตรา = ของร้าน (Commission), ผู้รับเงิน = ร้าน */
export function buildStoreRow(
  s: Sale,
  src: Dataset | Lookups
): Record<string, unknown> {
  const lk = toLookups(src);
  const dealer = lk.dealers.find((d) => d.code === s.dealerCode);
  return {
    ...commonCells(s, lk),
    "รวมผลประโยชน์": s.comm ?? 0,
    "อัตราผลประโยชน์": s.commRate ?? "",
    "ประเภทผลประโยชน์": storeBenefitType(s.src),
    "กลุ่มผู้ที่รับผลประโยชน์": s.benGroup ?? "ร้านผู้แทนจำหน่าย",
    "รหัสผู้รับเงิน": s.dealerCode ?? "",
    "ชื่อผู้รับเงิน": dealer?.name ?? "",
  };
}

/** 1 แถวของไฟล์ "พนักงาน" — ผลประโยชน์/อัตรา = ของพนักงาน (Incentive), ผู้รับเงิน = พนักงาน */
export function buildEmpRow(
  s: Sale,
  src: Dataset | Lookups
): Record<string, unknown> {
  const lk = toLookups(src);
  const emp = lk.salesTeam.find((e) => e.id === s.empId);
  return {
    ...commonCells(s, lk),
    "รวมผลประโยชน์": s.inc ?? 0,
    "อัตราผลประโยชน์": s.incRate ?? "",
    "ประเภทผลประโยชน์": "Incentive",
    "กลุ่มผู้ที่รับผลประโยชน์": "พนักงาน",
    "รหัสผู้รับเงิน": s.empId,
    "ชื่อผู้รับเงิน": emp?.name ?? s.seller ?? "",
  };
}

export interface SalesTableColumn {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}
export interface SalesTableDef {
  name: string;
  columns: SalesTableColumn[];
  rows: Record<string, unknown>[];
  footer?: Record<string, string>;
}

/** คอลัมน์มาตรฐาน (เหมือนกันทุกมุมมอง) */
export function rawColumns(): SalesTableColumn[] {
  return RAW_COLUMNS.map((c) => ({
    key: c,
    label: c,
    format: MONEY_RAW_COLUMNS.has(c)
      ? (v: unknown) => (v === "" || v == null ? "—" : money2(v))
      : undefined,
  }));
}

function makeFooter(rows: Record<string, unknown>[]): Record<string, string> {
  const footer: Record<string, string> = { [RAW_COLUMNS[0]]: "รวมทั้งหมด" };
  MONEY_RAW_COLUMNS.forEach((c) => {
    const sum = rows.reduce((a, r) => a + (Number(r[c]) || 0), 0);
    footer[c] = money2(sum);
  });
  return footer;
}

/** ตารางมุมมองร้านค้า (Commission) */
export function storeTable(
  sales: Sale[],
  src: Dataset | Lookups,
  name = "รายการค่าคอมมิชชัน — ร้านค้า (Commission)"
): SalesTableDef {
  const rows = sales.map((s) => buildStoreRow(s, src));
  return { name, columns: rawColumns(), rows, footer: makeFooter(rows) };
}

/** ตารางมุมมองพนักงาน (Incentive) */
export function empTable(
  sales: Sale[],
  src: Dataset | Lookups,
  name = "รายการค่าคอมมิชชัน — พนักงาน (Incentive)"
): SalesTableDef {
  const rows = sales.map((s) => buildEmpRow(s, src));
  return { name, columns: rawColumns(), rows, footer: makeFooter(rows) };
}
