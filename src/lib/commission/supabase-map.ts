/* =============================================================
   แปลง row จาก Supabase (snake_case) -> โดเมน type (camelCase)
   สำคัญ: logic.ts แยกพฤติกรรมด้วย `undefined` vs มีค่า เช่น
     - sale.comm/inc undefined -> คำนวณ comm จาก rate แทนใช้ค่าจริง
     - sale.dealerCode undefined -> ข้ามการกรองร้าน
   ดังนั้น mapper ต้องคืน `undefined` (ไม่ใช่ null/"") สำหรับ optional field
   ที่ DB เก็บเป็น NULL เพื่อรักษาพฤติกรรมเดิมเป๊ะ
   ============================================================= */
import type {
  Dealer,
  Solution,
  TeamMember,
  Sale,
  PointCompany,
  PointEmployee,
  GroupKey,
  SaleStatus,
  TrackingKey,
} from "./types";

/** optional string: NULL/'' -> undefined */
function optStr(v: string | null | undefined): string | undefined {
  return v === null || v === undefined || v === "" ? undefined : v;
}
/** optional number: NULL -> undefined (0 ถือเป็นค่าจริง) */
function optNum(v: number | null | undefined): number | undefined {
  return v === null || v === undefined ? undefined : v;
}

/* ---- row shapes (ตรงกับ generated Database types) ---- */
export interface DealerRow {
  code: string; name: string; branch: string; tax_id: string;
  tier: string; model: string; point_company_code: string;
}
export interface SolutionRow {
  id: string; group: string; name: string; category: string; rate: number; icon: string;
}
export interface EmployeeRow {
  emp_code: string; name: string; role: string; avatar: string;
  phone: string; dealer_code: string | null; photo_url: string | null;
}
export interface SaleRow {
  id: string; period: string; emp_code: string | null; sol_id: string | null;
  dealer_code: string | null; sale_date: string | null; sold_date: string | null;
  customer: string; amount: number; comm: number | null; inc: number | null;
  status: string; project_id: string; tracking: string; src: string | null;
  seller: string | null; ben_group: string | null; close_range: string | null;
  close_date_raw: string | null; pay_date_raw: string | null;
  comm_rate: string | null; inc_rate: string | null;
}
export interface PointCompanyRow {
  code: string; name: string; model: string; region: string; points: number;
}
export interface PointEmployeeRow {
  emp_code: string; name: string; company_code: string | null; avatar: string; points: number;
}

/* ---- mappers ---- */
export function mapDealer(r: DealerRow): Dealer {
  return {
    code: r.code,
    name: r.name,
    branch: r.branch ?? "",
    taxId: r.tax_id ?? "",
    tier: r.tier ?? "",
    model: r.model ?? "",
    pointCompanyCode: r.point_company_code ?? "",
  };
}

export function mapSolution(r: SolutionRow): Solution {
  return {
    id: r.id,
    group: r.group as GroupKey,
    name: r.name,
    category: r.category ?? "",
    rate: r.rate ?? 0,
    icon: r.icon ?? "",
  };
}

export function mapEmployee(r: EmployeeRow): TeamMember {
  return {
    id: r.emp_code,
    name: r.name,
    role: r.role ?? "",
    avatar: r.avatar ?? "",
    phone: r.phone ?? "",
    dealerCode: optStr(r.dealer_code),
    photoUrl: optStr(r.photo_url),
  };
}

export function mapSale(r: SaleRow): Sale {
  return {
    id: r.id,
    period: r.period,
    empId: r.emp_code ?? "",
    solId: r.sol_id ?? "",
    date: r.sale_date ?? "",
    soldDate: r.sold_date ?? "",
    customer: r.customer ?? "",
    amount: r.amount ?? 0,
    status: (r.status ?? "pending") as SaleStatus,
    projectId: r.project_id ?? "",
    tracking: (r.tracking ?? "") as TrackingKey,
    dealerCode: optStr(r.dealer_code),
    comm: optNum(r.comm),
    inc: optNum(r.inc),
    src: optStr(r.src),
    seller: optStr(r.seller),
    benGroup: optStr(r.ben_group),
    closeRange: optStr(r.close_range),
    closeDateRaw: optStr(r.close_date_raw),
    payDateRaw: optStr(r.pay_date_raw),
    commRate: optStr(r.comm_rate),
    incRate: optStr(r.inc_rate),
  };
}

export function mapPointCompany(r: PointCompanyRow): PointCompany {
  return {
    code: r.code,
    name: r.name,
    model: r.model ?? "",
    region: r.region ?? "",
    points: r.points ?? 0,
  };
}

export function mapPointEmployee(r: PointEmployeeRow): PointEmployee {
  return {
    empCode: r.emp_code,
    name: r.name,
    companyCode: r.company_code ?? "",
    avatar: r.avatar ?? "",
    points: r.points ?? 0,
  };
}
