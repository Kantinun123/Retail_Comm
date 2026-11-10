/* อ่านไฟล์ BA Commission (BA Incentive) -> แถว ba_incentive_lines (ฝั่ง server, ไม่แตะ DB)
   รองรับ 2 รูปแบบ (ตรวจจากหัวคอลัมน์):
   - store        : ไฟล์แยกรายร้าน I-<MMM><YY>_<ร้าน>.xlsx (Sheet1) — channel_name, store_name, emp_id, payment_condition, ...
   - consolidated : ไฟล์รวมทุกร้าน (sheet "All") — Year, Report_Month, channel_name, DealerCode, ภาค, ..., date_payment, Status_payment
                    มีหลายเดือน -> ใช้เฉพาะแถวของเดือนที่เลือก
   กติกาเดียวกับ scripts/import-ba-sep.mjs (ร้านจาก alias ของ BA App, CR จาก Master_Member, rep_code จาก sale_reps)
   win_date เติมทีหลังจาก ba_service_sales_lines (ต้องใช้ DB) */
import * as XLSX from "xlsx";

export interface BaLookups {
  /** channel_name/store_name (BA App) -> dealer_code */
  channelToDealer: Map<string, string>;
  /** dealer_code -> ชื่อร้าน */
  dealerName: Map<string, string>;
  /** emp_id (BA App) -> CR */
  empToCr: Map<string, string>;
  /** emp_id (BA App) -> rep_code (SR) */
  empToRep: Map<string, string>;
}

export interface BaRow {
  period: string;
  year: number;
  report_month: number;
  channel_name: string | null;
  dealer_code: string | null;
  dealer_name: string | null;
  region: string | null;
  province_name: string | null;
  emp_id: string | null;
  sale_rep_name: string | null;
  emp_code: string | null;
  rep_code: string | null;
  job_code: string;
  job_type: string | null;
  worktype_name: string | null;
  product_code: string | null;
  product_name: string | null;
  service_group: string | null;
  service_port: string | null;
  service_brand: string | null;
  sale_model: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  customer_accepted_date: string | null;
  win_date: string | null;
  date_payment: string | null;
  invoice_net_amount: number | null;
  gmv_service: number | null;
  base_incentive: number;
  topup_amount: number;
  total_incentive: number;
  status_payment: string | null;
  source_file: string;
}

export interface ParsedFile {
  name: string;
  kind: "store" | "consolidated" | null;
  status: "ok" | "warn" | "error";
  messages: string[];
  rows: BaRow[];
  amount: number;
  unknownChannels: string[];
}

const MON: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

/** เดาเดือนจากชื่อไฟล์ I-OCT26_... -> '2026-10' */
export function periodFromFileName(name: string): string | null {
  const m = name.match(/I-([A-Z]{3})(\d{2})_/i);
  if (!m) return null;
  const mm = MON[m[1].toUpperCase()];
  return mm ? `20${m[2]}-${String(mm).padStart(2, "0")}` : null;
}

const str = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" || s === "NULL" ? null : s;
};
const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "" || v === "NULL") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
function toDate(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    const s = String(v).trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }
  const dt = new Date(Math.round((n - 25569) * 86400 * 1000));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

const REQUIRED = ["channel_name", "emp_id", "sale_rep_name", "job_code", "total_incentive"];

export function parseBaFile(name: string, buf: ArrayBuffer | Uint8Array, period: string, L: BaLookups): ParsedFile {
  const res: ParsedFile = { name, kind: null, status: "ok", messages: [], rows: [], amount: 0, unknownChannels: [] };
  const fail = (msg: string) => ({ ...res, status: "error" as const, messages: [msg] });
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch {
    return fail("เปิดไฟล์ไม่ได้ (ไม่ใช่ Excel หรือไฟล์เสีย)");
  }
  const [year, month] = period.split("-").map(Number);
  // เลือก sheet: consolidated ใช้ "All" ; ไม่งั้น Sheet1 / sheet แรก
  const sheetName = wb.SheetNames.find((s) => s === "All") ?? wb.SheetNames.find((s) => s === "Sheet1") ?? wb.SheetNames[0];
  const d = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, blankrows: false });
  if (!d.length) return fail("ไฟล์ว่าง");
  const H = new Map<string, number>();
  (d[0] ?? []).forEach((c, i) => H.set(String(c ?? "").trim(), i));
  const missing = REQUIRED.filter((k) => !H.has(k));
  if (missing.length) return fail(`ไม่ใช่รูปแบบ BA Commission: ไม่พบคอลัมน์ ${missing.join(", ")}`);
  const consolidated = H.has("Year") && H.has("Report_Month");
  res.kind = consolidated ? "consolidated" : "store";
  const col = (row: unknown[], k: string) => (H.has(k) ? row[H.get(k)!] : undefined);

  if (!consolidated) {
    const fp = periodFromFileName(name);
    if (fp && fp !== period) res.messages.push(`ชื่อไฟล์เป็นเดือน ${fp} แต่เลือกเดือน ${period}`);
  }

  const unknown = new Set<string>();
  let skippedOtherMonth = 0;
  for (let r = 1; r < d.length; r++) {
    const row = d[r];
    if (!row) continue;
    const jobCode = str(col(row, "job_code"));
    if (!jobCode) continue; // subtotal / แถวว่าง
    if (consolidated) {
      if (Number(col(row, "Year")) !== year || Number(col(row, "Report_Month")) !== month) { skippedOtherMonth++; continue; }
    }
    const channel = str(col(row, "channel_name"));
    const storeNm = str(col(row, "store_name"));
    const codeInFile = str(col(row, "DealerCode"));
    const dealer =
      (codeInFile && L.dealerName.has(codeInFile) ? codeInFile : null) ??
      (channel ? L.channelToDealer.get(channel) : undefined) ??
      (storeNm ? L.channelToDealer.get(storeNm) : undefined) ??
      null;
    if (!dealer && channel) unknown.add(channel);
    const empId = str(col(row, "emp_id"));
    const inc = num(col(row, "total_incentive")) ?? 0;
    res.rows.push({
      period, year, report_month: month,
      channel_name: channel,
      dealer_code: dealer,
      dealer_name: dealer ? L.dealerName.get(dealer) ?? str(col(row, "DealerName")) : null,
      region: str(col(row, "ภาค")),
      province_name: str(col(row, "province_name")),
      emp_id: empId,
      sale_rep_name: str(col(row, "sale_rep_name")),
      emp_code: empId ? L.empToCr.get(empId) ?? null : null,
      rep_code: empId ? L.empToRep.get(empId) ?? null : null,
      job_code: jobCode,
      job_type: str(col(row, "job_type")),
      worktype_name: str(col(row, "worktype_name")),
      product_code: str(col(row, "product_code")),
      product_name: str(col(row, "product_name")),
      service_group: str(col(row, "service_group")),
      service_port: str(col(row, "service_port")),
      service_brand: str(col(row, "service_brand")),
      sale_model: str(col(row, "sale_model")),
      customer_name: str(col(row, "customer_name")),
      invoice_date: toDate(col(row, "invoice_date")),
      customer_accepted_date: toDate(col(row, "customer_accepted_date")),
      win_date: null,
      date_payment: toDate(col(row, "date_payment")),
      invoice_net_amount: num(col(row, "invoice_net_amount")),
      gmv_service: num(col(row, "gmv_service")),
      base_incentive: num(col(row, "base_incentive")) ?? 0,
      topup_amount: num(col(row, "topup_amount")) ?? 0,
      total_incentive: inc,
      status_payment: str(col(row, "payment_condition")) ?? str(col(row, "Status_payment")),
      source_file: name,
    });
    res.amount += inc;
  }
  res.unknownChannels = [...unknown];
  if (consolidated && skippedOtherMonth) res.messages.push(`ไฟล์รวม: ใช้เฉพาะ ${res.rows.length} แถวของเดือนที่เลือก (ข้ามเดือนอื่น ${skippedOtherMonth} แถว)`);
  if (!res.rows.length) return { ...res, status: "error", messages: [...res.messages, "ไม่มีรายการของเดือนที่เลือก"] };
  if (unknown.size) res.messages.push(`map ร้านไม่ได้: ${[...unknown].slice(0, 3).join(", ")}${unknown.size > 3 ? ` +${unknown.size - 3}` : ""} → ยอดเข้า "ไม่ระบุร้าน"`);
  if (res.messages.length) res.status = "warn";
  return res;
}
