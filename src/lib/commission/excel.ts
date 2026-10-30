"use client";

/* =============================================================
   Excel (.xlsx/.csv) parsing for the admin database page.
   Each upload maps to one dataset section. Column headers are
   matched to the domain-type field names (case/space tolerant).
   ============================================================= */
import * as XLSX from "xlsx";
import type {
  Dataset,
  DatasetSection,
} from "./dataset";
import type {
  Dealer,
  GroupKey,
  PointCompany,
  PointEmployee,
  Sale,
  SaleStatus,
  Solution,
  TeamMember,
  TrackingKey,
} from "./types";
import { RAW_COLUMNS, buildStoreRow, buildEmpRow } from "./sales-table";

type Row = Record<string, unknown>;

export interface ParseResult {
  data: Partial<Dataset>;
  /** human-readable counts per array parsed, for UI feedback */
  summary: string[];
  errors: string[];
}

/* ---------- helpers ---------- */

function normKey(k: string): string {
  return k.toLowerCase().replace(/[\s_-]+/g, "");
}

/** build a normalized-key -> original-value getter for a row */
function pick(row: Row) {
  const map: Record<string, unknown> = {};
  Object.keys(row).forEach((k) => (map[normKey(k)] = row[k]));
  return (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = map[normKey(k)];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  };
}

function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}
function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[, ฿]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array" });
}

/** rows of a sheet by (normalized) name; falls back to nth sheet */
function sheetRows(
  wb: XLSX.WorkBook,
  names: string[],
  fallbackIndex = -1
): Row[] | null {
  const wanted = names.map(normKey);
  let sheetName = wb.SheetNames.find((n) => wanted.includes(normKey(n)));
  if (!sheetName && fallbackIndex >= 0) sheetName = wb.SheetNames[fallbackIndex];
  if (!sheetName) return null;
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
}

/* ---------- mappers ---------- */

function toGroup(v: unknown): GroupKey {
  const s = normKey(str(v));
  if (s === "product" || s.includes("สินค้า")) return "product";
  return "solution";
}
function toStatus(v: unknown): SaleStatus {
  const s = normKey(str(v));
  if (s.includes("pending") || s.includes("รอ")) return "pending";
  if (s.includes("processing") || s.includes("ดำเนิน")) return "processing";
  return "paid";
}
function toTracking(v: unknown): TrackingKey {
  const s = normKey(str(v));
  const allowed: TrackingKey[] = [
    "contract",
    "survey",
    "install",
    "qc",
    "delivered",
  ];
  return (allowed.find((t) => s.includes(t)) as TrackingKey) || "delivered";
}

function mapDealers(rows: Row[]): Dealer[] {
  return rows
    .map((r) => {
      const g = pick(r);
      return {
        code: str(g("code", "dealerCode", "รหัสร้านค้า")),
        name: str(g("name", "ชื่อร้าน", "ชื่อบริษัท")),
        branch: str(g("branch", "สาขา")),
        taxId: str(g("taxId", "taxid", "เลขภาษี")),
        tier: str(g("tier", "ระดับ")),
        model: str(g("model", "โมเดล")),
        pointCompanyCode: str(g("pointCompanyCode", "companyCode", "รหัสแต้ม")),
      } satisfies Dealer;
    })
    .filter((d) => d.code);
}

function mapSolutions(rows: Row[]): Solution[] {
  return rows
    .map((r) => {
      const g = pick(r);
      let rate = num(g("rate", "เรท", "อัตรา"));
      if (rate > 1) rate = rate / 100; // accept "5" as 5%
      return {
        id: str(g("id", "solId", "รหัส")),
        group: toGroup(g("group", "กลุ่ม", "ประเภท")),
        name: str(g("name", "ชื่อ")),
        category: str(g("category", "หมวด")),
        rate,
        icon: str(g("icon")) || "widgets",
      } satisfies Solution;
    })
    .filter((s) => s.id);
}

function mapTeam(rows: Row[]): TeamMember[] {
  return rows
    .map((r) => {
      const g = pick(r);
      const dealerCode = str(
        g("dealerCode", "dealercode", "รหัสร้านค้า", "ร้านค้า")
      );
      return {
        id: str(g("id", "empId", "รหัสพนักงาน")),
        name: str(g("name", "ชื่อ")),
        role: str(g("role", "ตำแหน่ง")) || "Sales",
        avatar: str(g("avatar", "ย่อ")),
        phone: str(g("phone", "เบอร์โทร")),
        ...(dealerCode ? { dealerCode } : {}),
      } satisfies TeamMember;
    })
    .filter((e) => e.id);
}

function mapSales(rows: Row[]): Sale[] {
  return rows
    .map((r, i) => {
      const g = pick(r);
      const date = str(g("date", "วันที่"));
      let period = str(g("period", "รอบ"));
      if (!period && /^\d{4}-\d{2}/.test(date)) period = date.slice(0, 7);
      return {
        id: str(g("id", "txId", "รหัส")) || `TX-UP-${i + 1}`,
        period,
        empId: str(g("empId", "empid", "รหัสพนักงาน")),
        solId: str(g("solId", "solid", "รหัสสินค้า")),
        date,
        soldDate: str(g("soldDate", "solddate", "วันที่ขาย")) || date,
        customer: str(g("customer", "ลูกค้า")),
        amount: num(g("amount", "ยอดขาย", "จำนวนเงิน")),
        status: toStatus(g("status", "สถานะ")),
        projectId: str(g("projectId", "projectid", "รหัสโปรเจกต์")),
        tracking: toTracking(g("tracking", "ขั้นตอน")),
      } satisfies Sale;
    })
    .filter((s) => s.period && s.empId && s.solId);
}

function mapPointCompanies(rows: Row[]): PointCompany[] {
  return rows
    .map((r) => {
      const g = pick(r);
      return {
        code: str(g("code", "companyCode", "รหัสบริษัท")),
        name: str(g("name", "ชื่อบริษัท")),
        model: str(g("model", "โมเดล")),
        region: str(g("region", "ภาค")),
        points: num(g("points", "แต้ม")),
      } satisfies PointCompany;
    })
    .filter((c) => c.code);
}

function mapPointEmployees(rows: Row[]): PointEmployee[] {
  return rows
    .map((r) => {
      const g = pick(r);
      return {
        empCode: str(g("empCode", "empcode", "รหัสพนักงาน")),
        name: str(g("name", "ชื่อ")),
        companyCode: str(g("companyCode", "companycode", "รหัสบริษัท")),
        avatar: str(g("avatar", "ย่อ")),
        points: num(g("points", "แต้ม")),
      } satisfies PointEmployee;
    })
    .filter((e) => e.empCode);
}

/* ---------- section entry points ---------- */

export async function parseSection(
  section: DatasetSection,
  file: File
): Promise<ParseResult> {
  const wb = await readWorkbook(file);
  const data: Partial<Dataset> = {};
  const summary: string[] = [];
  const errors: string[] = [];

  if (section === "staff") {
    const dealerRows = sheetRows(wb, ["dealers", "ร้านค้า", "stores"]);
    const empRows = sheetRows(wb, ["employees", "พนักงาน", "team", "salesteam"]);
    const solRows = sheetRows(wb, ["solutions", "สินค้า", "products"]);
    // single-sheet convenience: infer by columns of the first sheet
    if (!dealerRows && !empRows && !solRows) {
      const first = sheetRows(wb, [], 0);
      if (first && first.length) {
        const keys = Object.keys(first[0]).map(normKey);
        if (keys.includes("code")) data.dealers = mapDealers(first);
        else if (keys.some((k) => k === "solid" || k === "rate"))
          data.solutions = mapSolutions(first);
        else data.salesTeam = mapTeam(first);
      }
    } else {
      if (dealerRows) data.dealers = mapDealers(dealerRows);
      if (empRows) data.salesTeam = mapTeam(empRows);
      if (solRows) data.solutions = mapSolutions(solRows);
    }
    if (data.dealers) summary.push(`ร้านค้า ${data.dealers.length} ราย`);
    if (data.salesTeam) summary.push(`พนักงาน ${data.salesTeam.length} คน`);
    if (data.solutions) summary.push(`สินค้า/บริการ ${data.solutions.length} รายการ`);
    if (!summary.length)
      errors.push("ไม่พบข้อมูล — ต้องมีชีท dealers / employees / solutions");
  } else if (section === "commission") {
    const rows = sheetRows(wb, ["sales", "commission", "ค่าคอมมิชชัน"], 0);
    if (rows) {
      data.sales = mapSales(rows);
      summary.push(`รายการขาย ${data.sales.length} รายการ`);
      if (data.sales.length === 0)
        errors.push("ไม่พบแถวที่ถูกต้อง (ต้องมี period, empId, solId)");
    } else {
      errors.push("ไม่พบชีทข้อมูลการขาย");
    }
  } else if (section === "points") {
    const compRows = sheetRows(wb, ["companies", "บริษัท", "stores"]);
    const empRows = sheetRows(wb, ["employees", "พนักงาน", "staff"]);
    if (!compRows && !empRows) {
      const first = sheetRows(wb, [], 0);
      if (first && first.length) {
        const keys = Object.keys(first[0]).map(normKey);
        if (keys.includes("empcode")) data.pointEmployees = mapPointEmployees(first);
        else data.pointCompanies = mapPointCompanies(first);
      }
    } else {
      if (compRows) data.pointCompanies = mapPointCompanies(compRows);
      if (empRows) data.pointEmployees = mapPointEmployees(empRows);
    }
    if (data.pointCompanies)
      summary.push(`บริษัท ${data.pointCompanies.length} ราย`);
    if (data.pointEmployees)
      summary.push(`พนักงาน ${data.pointEmployees.length} คน`);
    if (!summary.length)
      errors.push("ไม่พบข้อมูล — ต้องมีชีท companies / employees");
  }

  return { data, summary, errors };
}

/* ---------- downloadable templates ---------- */

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export function downloadTemplate(section: DatasetSection) {
  const wb = XLSX.utils.book_new();
  if (section === "staff") {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          code: "SCG-NW-1048",
          name: "บจก. ตัวอย่าง",
          branch: "สำนักงานใหญ่",
          taxId: "0000000000000",
          tier: "Gold Partner",
          model: "SCG Home",
          pointCompanyCode: "1001001",
        },
      ]),
      "dealers"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          id: "EMP-101",
          name: "สมชาย ใจดี",
          role: "Senior Sales",
          avatar: "SD",
          phone: "081-000-0000",
          dealerCode: "SCG-NW-1048",
        },
      ]),
      "employees"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          id: "SL01",
          group: "solution",
          name: "Solar Roof",
          category: "Energy",
          rate: 5,
          icon: "solar_power",
        },
      ]),
      "solutions"
    );
    download(wb, "template-staff.xlsx");
  } else if (section === "commission") {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          id: "TX-0001",
          period: "2025-12",
          empId: "EMP-101",
          solId: "SL01",
          date: "2025-12-05",
          soldDate: "2025-11-21",
          customer: "คุณลูกค้า ตัวอย่าง",
          amount: 480000,
          status: "paid",
          projectId: "PJ-0001",
          tracking: "delivered",
        },
      ]),
      "sales"
    );
    download(wb, "template-commission.xlsx");
  } else {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          code: "1001001",
          name: "บจก.A",
          model: "SCG HOME",
          region: "เหนือ",
          points: 9850,
        },
      ]),
      "companies"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          empCode: "SCGH_N_JB001",
          name: "นาย AA",
          companyCode: "1001001",
          avatar: "AA",
          points: 4200,
        },
      ]),
      "employees"
    );
    download(wb, "template-points.xlsx");
  }
}

/* ---------- export current data (same as the on-screen tables) ---------- */

/** ทำให้คอลัมน์เรียงตามที่กำหนด และช่องว่างเป็น "" (ตรงกับที่ตารางแสดง) */
function sheetFrom<T extends Record<string, unknown>>(
  rows: T[],
  columns: string[]
) {
  const shaped = rows.map((r) => {
    const o: Record<string, unknown> = {};
    columns.forEach((c) => (o[c] = r[c] ?? ""));
    return o;
  });
  return XLSX.utils.json_to_sheet(shaped, { header: columns });
}

/** คอลัมน์ของตารางค่าคอมมิชชัน (sales) — ใช้ร่วมกันทั้ง export ทั้งชุดและแบบกรองแล้ว */
const SALES_COLUMNS = [
  "id",
  "period",
  "empId",
  "solId",
  "date",
  "soldDate",
  "customer",
  "amount",
  "status",
  "projectId",
  "tracking",
];

/** number format แสดงตัวคั่นหลักพัน + ทศนิยม 2 ตำแหน่ง (ยังเป็นตัวเลขที่คำนวณได้ใน Excel) */
const MONEY_FMT = "#,##0.00";

/** คอลัมน์ตัวเงินของตารางค่าคอมมิชชันแบบดิบ (หัวไทยตรงกับไฟล์) */
const MONEY_COLUMNS_TH = ["ยอดขายที่ใช้คำนวณ", "รวมผลประโยชน์"];

/** สร้างชีทจาก rows + columns พร้อมใส่ number format ให้คอลัมน์ตัวเงิน และแถวรวมท้ายตาราง */
function moneySheet(
  rows: Row[],
  columns: string[],
  moneyCols: string[]
) {
  const shaped = rows.map((r) => {
    const o: Record<string, unknown> = {};
    columns.forEach((c) => (o[c] = r[c] ?? ""));
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(shaped, { header: columns });

  // number format ให้คอลัมน์ตัวเงินทุกแถว
  moneyCols.forEach((mc) => {
    const col = columns.indexOf(mc);
    if (col < 0) return;
    for (let i = 0; i < shaped.length; i++) {
      const addr = XLSX.utils.encode_cell({ r: i + 1, c: col });
      const cell = ws[addr];
      if (cell && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = MONEY_FMT;
      }
    }
  });

  // แถวรวมท้ายตาราง
  const totalRowIdx = shaped.length + 1;
  const firstCol = 0;
  const labelAddr = XLSX.utils.encode_cell({ r: totalRowIdx, c: firstCol });
  ws[labelAddr] = { t: "s", v: "รวมทั้งหมด" };
  moneyCols.forEach((mc) => {
    const col = columns.indexOf(mc);
    if (col < 0) return;
    const sum = rows.reduce((a, r) => a + (Number(r[mc]) || 0), 0);
    const addr = XLSX.utils.encode_cell({ r: totalRowIdx, c: col });
    ws[addr] = { t: "n", v: sum, z: MONEY_FMT };
  });
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRowIdx, c: columns.length - 1 },
  });
  return ws;
}

/**
 * ดาวน์โหลดรายการขายที่ส่งเข้ามา (ชุดที่ถูกกรองในหน้าภาพรวม)
 * ให้ไฟล์ตรงกับตารางบนหน้าจอ: คอลัมน์ครบตามไฟล์ดิบ แยกตามมุมมอง
 *   view = "store" -> มุมมองร้านค้า (Commission)
 *   view = "emp"   -> มุมมองพนักงาน (Incentive)
 */
export function downloadSales(
  rows: Sale[],
  view: "store" | "emp",
  ds: Dataset,
  filename = "ค่าคอมมิชชัน.xlsx"
) {
  const built = rows.map((s) =>
    view === "emp" ? buildEmpRow(s, ds) : buildStoreRow(s, ds)
  ) as Row[];
  const ws = moneySheet(built, RAW_COLUMNS, MONEY_COLUMNS_TH);
  const wb = XLSX.utils.book_new();
  const sheetName = view === "emp" ? "พนักงาน (Incentive)" : "ร้านค้า (Commission)";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  download(wb, filename);
}

/** ดาวน์โหลดข้อมูลปัจจุบันของ section เป็น .xlsx (ชุดเดียวกับตารางบนหน้าจอ) */
export function downloadSection(section: DatasetSection, ds: Dataset) {
  const wb = XLSX.utils.book_new();

  if (section === "staff") {
    // รวมร้านค้า + พนักงานเป็นชีทเดียว (1 แถว = พนักงาน 1 คน, ข้อมูลร้านต่อท้าย)
    const staffRows: Row[] = [];
    ds.dealers.forEach((d) => {
      const emps = ds.salesTeam.filter((e) => e.dealerCode === d.code);
      const dealerCells: Row = {
        dealerCode: d.code,
        dealerName: d.name,
        branch: d.branch,
        model: d.model,
        tier: d.tier,
        taxId: d.taxId,
        pointCompanyCode: d.pointCompanyCode,
      };
      if (emps.length === 0) {
        staffRows.push({ ...dealerCells });
      } else {
        emps.forEach((e) =>
          staffRows.push({
            ...dealerCells,
            empId: e.id,
            empName: e.name,
            role: e.role,
            avatar: e.avatar,
            phone: e.phone,
          })
        );
      }
    });
    ds.salesTeam
      .filter((e) => !ds.dealers.some((d) => d.code === e.dealerCode))
      .forEach((e) =>
        staffRows.push({
          dealerCode: e.dealerCode ?? "",
          empId: e.id,
          empName: e.name,
          role: e.role,
          avatar: e.avatar,
          phone: e.phone,
        })
      );

    XLSX.utils.book_append_sheet(
      wb,
      sheetFrom(staffRows, [
        "dealerCode",
        "dealerName",
        "branch",
        "model",
        "tier",
        "taxId",
        "pointCompanyCode",
        "empId",
        "empName",
        "role",
        "avatar",
        "phone",
      ]),
      "dealers_employees"
    );
    XLSX.utils.book_append_sheet(
      wb,
      sheetFrom(ds.solutions as unknown as Row[], [
        "id",
        "group",
        "name",
        "category",
        "rate",
        "icon",
      ]),
      "solutions"
    );
    download(wb, "ฐานข้อมูลพนักงานและร้านค้า.xlsx");
  } else if (section === "commission") {
    const hasReal = ds.sales.some(
      (s) => s.src !== undefined || s.commRate !== undefined
    );
    if (hasReal) {
      // แยก 2 ชีทตามตารางบนหน้าจอ (ร้านค้า = Commission, พนักงาน = Incentive)
      const storeRows = ds.sales.map((s) => buildStoreRow(s, ds)) as Row[];
      const empRows = ds.sales.map((s) => buildEmpRow(s, ds)) as Row[];
      XLSX.utils.book_append_sheet(
        wb,
        moneySheet(storeRows, RAW_COLUMNS, MONEY_COLUMNS_TH),
        "ร้านค้า (Commission)"
      );
      XLSX.utils.book_append_sheet(
        wb,
        moneySheet(empRows, RAW_COLUMNS, MONEY_COLUMNS_TH),
        "พนักงาน (Incentive)"
      );
    } else {
      XLSX.utils.book_append_sheet(
        wb,
        sheetFrom(ds.sales as unknown as Row[], SALES_COLUMNS),
        "sales"
      );
    }
    download(wb, "ฐานข้อมูลค่าคอมมิชชัน.xlsx");
  } else {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFrom(ds.pointCompanies as unknown as Row[], [
        "code",
        "name",
        "model",
        "region",
        "points",
      ]),
      "companies"
    );
    XLSX.utils.book_append_sheet(
      wb,
      sheetFrom(ds.pointEmployees as unknown as Row[], [
        "empCode",
        "name",
        "companyCode",
        "avatar",
        "points",
      ]),
      "employees"
    );
    download(wb, "ฐานข้อมูลแต้มกิจกรรม.xlsx");
  }
}

/* =============================================================
   ดาวน์โหลดข้อมูลหน้า Back Margin / ค่าคอมฯ สินค้า / ค่าคอมฯ BA
   - รับ "รายบรรทัดทุกเดือน" (ที่หน้าจอ fetch มาแล้ว) + ชื่อร้าน/ช่วง
   - สร้างชีทเดียว หัวคอลัมน์ภาษาไทย + number format + แถวรวมท้ายตาราง
   ใช้ moneySheet เดิมเพื่อให้รูปแบบตรงกับไฟล์อื่นในระบบ
   ============================================================= */

/** แถว back margin สำหรับ export (period มาจากเดือนที่ fetch) */
export interface BmExportRow {
  period: string;
  dealerCode: string;
  dealerName: string | null;
  docNo: string | null;
  salesDate: string | null;
  custName: string | null;
  itemName: string | null;
  saleName: string | null;
  qty: number | null;
  netAmount: number;
  backMargin: number;
}

export function downloadBackMargin(rows: BmExportRow[], filename = "แบ็คมาร์จิน.xlsx") {
  const COLS = [
    "เดือน", "รหัสร้าน", "ชื่อร้าน", "เลขที่เอกสาร", "วันที่ขาย",
    "ลูกค้า", "สินค้า", "พนักงานขาย", "จำนวน", "ยอดขายที่ใช้คำนวณ", "แบ็คมาร์จิน",
  ];
  const MONEY = ["ยอดขายที่ใช้คำนวณ", "แบ็คมาร์จิน"];
  const built: Row[] = rows.map((r) => ({
    "เดือน": r.period,
    "รหัสร้าน": r.dealerCode,
    "ชื่อร้าน": r.dealerName ?? "",
    "เลขที่เอกสาร": r.docNo ?? "",
    "วันที่ขาย": r.salesDate ?? "",
    "ลูกค้า": r.custName ?? "",
    "สินค้า": r.itemName ?? "",
    "พนักงานขาย": r.saleName ?? "",
    "จำนวน": r.qty ?? "",
    "ยอดขายที่ใช้คำนวณ": r.netAmount,
    "แบ็คมาร์จิน": r.backMargin,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, moneySheet(built, COLS, MONEY), "แบ็คมาร์จิน");
  download(wb, filename);
}

/** แถวค่าคอมฯ สินค้า สำหรับ export */
export interface CpExportRow {
  period: string;
  dealerCode: string;
  dealerName: string | null;
  vendorName: string | null;
  saleName: string | null;
  docNo: string | null;
  salesDate: string | null;
  custName: string | null;
  itemName: string | null;
  qty: number | null;
  netAmount: number;
  gross: number;
  net: number;
}

export function downloadCommissionProduct(rows: CpExportRow[], filename = "ค่าคอมมิชชั่นสินค้า.xlsx") {
  const COLS = [
    "เดือน", "รหัสร้าน", "ชื่อร้าน", "ผู้รับเงิน", "พนักงานขาย", "เลขที่เอกสาร",
    "วันที่ขาย", "ลูกค้า", "สินค้า", "จำนวน", "ยอดขาย", "ค่าคอมฯ (ก่อนหัก)", "ค่าคอมฯ (หลังหัก 3%)",
  ];
  const MONEY = ["ยอดขาย", "ค่าคอมฯ (ก่อนหัก)", "ค่าคอมฯ (หลังหัก 3%)"];
  const built: Row[] = rows.map((r) => ({
    "เดือน": r.period,
    "รหัสร้าน": r.dealerCode,
    "ชื่อร้าน": r.dealerName ?? "",
    "ผู้รับเงิน": r.vendorName ?? "",
    "พนักงานขาย": r.saleName ?? "",
    "เลขที่เอกสาร": r.docNo ?? "",
    "วันที่ขาย": r.salesDate ?? "",
    "ลูกค้า": r.custName ?? "",
    "สินค้า": r.itemName ?? "",
    "จำนวน": r.qty ?? "",
    "ยอดขาย": r.netAmount,
    "ค่าคอมฯ (ก่อนหัก)": r.gross,
    "ค่าคอมฯ (หลังหัก 3%)": r.net,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, moneySheet(built, COLS, MONEY), "ค่าคอมฯ สินค้า");
  download(wb, filename);
}

/** แถวค่าคอมฯ BA (งานบริการ) สำหรับ export */
export interface BaExportRow {
  period: string;
  dealerCode: string;
  dealerName: string | null;
  channelName: string | null;
  empId: string | null;
  saleRepName: string | null;
  empCode: string | null;
  jobCode: string | null;
  worktypeName: string | null;
  serviceGroup: string | null;
  customerName: string | null;
  winDate: string | null;
  datePayment: string | null;
  gmvService: number;
  totalIncentive: number;
}

export function downloadBaIncentive(rows: BaExportRow[], filename = "ค่าคอมมิชชั่นงานบริการBA.xlsx") {
  const COLS = [
    "เดือน", "รหัสร้าน", "ชื่อร้าน", "ชื่อร้าน (ต้นทาง)", "รหัสพนักงาน (BA)", "ชื่อพนักงานขาย",
    "รหัส CR", "เลขที่งาน", "ประเภทงาน", "กลุ่มบริการ", "ลูกค้า", "วันปิดงาน", "วันที่จ่าย",
    "ยอดงาน (GMV)", "ค่าคอมมิชชั่น",
  ];
  const MONEY = ["ยอดงาน (GMV)", "ค่าคอมมิชชั่น"];
  const built: Row[] = rows.map((r) => ({
    "เดือน": r.period,
    "รหัสร้าน": r.dealerCode,
    "ชื่อร้าน": r.dealerName ?? "",
    "ชื่อร้าน (ต้นทาง)": r.channelName ?? "",
    "รหัสพนักงาน (BA)": r.empId ?? "",
    "ชื่อพนักงานขาย": r.saleRepName ?? "",
    "รหัส CR": r.empCode ?? "",
    "เลขที่งาน": r.jobCode ?? "",
    "ประเภทงาน": r.worktypeName ?? "",
    "กลุ่มบริการ": r.serviceGroup ?? "",
    "ลูกค้า": r.customerName ?? "",
    "วันปิดงาน": r.winDate ?? "",
    "วันที่จ่าย": r.datePayment ?? "",
    "ยอดงาน (GMV)": r.gmvService,
    "ค่าคอมมิชชั่น": r.totalIncentive,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, moneySheet(built, COLS, MONEY), "ค่าคอมฯ BA");
  download(wb, filename);
}
