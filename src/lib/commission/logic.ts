/* =============================================================
   Commission portal computation helpers.
   Ported from commission-app/data.js — filter state is passed in
   explicitly (instead of reading sessionStorage) so it composes
   cleanly with React state.
   ============================================================= */
import { getDataset } from "./dataset";
import { adjustmentTotal } from "./point-adjustments";
import type {
  Dealer,
  FilterState,
  GroupKey,
  PaymentStatus,
  GroupMeta,
  Sale,
  Solution,
  TeamMember,
  Totals,
  TrackingKey,
} from "./types";

/* ---------------- Live dataset accessors ----------------
   These read from the dataset store so uploaded Excel data
   flows through every calculation below. */
export function getDealers(): Dealer[] {
  return getDataset().dealers;
}
export function getSolutions(): Solution[] {
  return getDataset().solutions;
}
export function getSalesTeam(): TeamMember[] {
  return getDataset().salesTeam;
}
export function getSales(): Sale[] {
  return getDataset().sales;
}
export function getPointCompanies() {
  return getDataset().pointCompanies;
}
export function getPointEmployees() {
  return getDataset().pointEmployees;
}

/* ---------------- Constants ---------------- */

export const FALLBACK_CURRENT_PERIOD = "2025-12";

/** Distinct periods present in the current sales data, newest first. */
export function getPeriods(): string[] {
  const set = new Set<string>();
  getSales().forEach((s) => set.add(s.period));
  const list = Array.from(set).sort().reverse();
  return list.length ? list : [FALLBACK_CURRENT_PERIOD];
}

/** Newest period that has data. */
export function currentPeriod(): string {
  return getPeriods()[0] || FALLBACK_CURRENT_PERIOD;
}

export const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const GROUPS: Record<GroupKey, GroupMeta> = {
  solution: { key: "solution", label: "บริการ", icon: "widgets" },
  product: { key: "product", label: "สินค้า", icon: "inventory_2" },
};

export const STATUS_META: Record<
  Sale["status"],
  { label: string; bg: string; text: string; dot: string }
> = {
  paid: { label: "จ่ายแล้ว", bg: "bg-red-50", text: "text-[#a11119]", dot: "bg-[#d32029]" },
  pending: { label: "รอจ่าย", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  // รวม "กำลังดำเนินการ" เข้าเป็น "รอจ่าย" (แสดงเหมือน pending)
  processing: { label: "รอจ่าย", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
};

export const TRACKING_STAGES: Record<
  TrackingKey,
  { step: number; label: string; icon: string; color: string }
> = {
  contract: { step: 1, label: "ทำสัญญา", icon: "contract", color: "#94a3b8" },
  survey: { step: 2, label: "สำรวจหน้างาน", icon: "explore", color: "#0ea5e9" },
  install: { step: 3, label: "ติดตั้งงาน", icon: "construction", color: "#f59e0b" },
  qc: { step: 4, label: "ตรวจรับ (QC)", icon: "fact_check", color: "#8b5cf6" },
  delivered: { step: 5, label: "ส่งมอบแล้ว", icon: "task_alt", color: "#16a34a" },
};

/* ---------------- Formatting ---------------- */

export function formatBaht(n: number): string {
  return "฿" + Number(n).toLocaleString("th-TH");
}

export function formatBahtShort(n: number): string {
  if (n >= 1_000_000) return "฿" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return "฿" + (n / 1000).toFixed(0) + "K";
  return "฿" + n;
}

export function periodShort(p: string): string {
  const [y, m] = p.split("-");
  return m + "/" + y;
}

export function periodLabel(p: string): string {
  const [y, m] = p.split("-");
  return TH_MONTHS[parseInt(m, 10) - 1] + " " + y + " (" + m + "/" + y + ")";
}

/* ---------------- Lookups ---------------- */

export function dealerByCode(code: string): Dealer | null {
  return getDealers().find((d) => d.code === code) ?? null;
}

export function solutionById(id: string): Solution | undefined {
  return getSolutions().find((s) => s.id === id);
}

export function employeeById(id: string): TeamMember | undefined {
  return getSalesTeam().find((e) => e.id === id);
}

/** พนักงานที่สังกัดร้านนี้ (ถ้าพนักงานไม่มี dealerCode = ถือว่าอยู่ทุกร้าน) */
export function employeesOfDealer(dealerCode?: string | null): TeamMember[] {
  const team = getSalesTeam();
  if (!dealerCode) return team;
  const scoped = team.filter((e) => e.dealerCode === dealerCode);
  // เผื่อชุดข้อมูลที่ยังไม่ได้ระบุร้าน (เช่นอัปโหลดใหม่โดยไม่มีคอลัมน์ร้าน)
  return scoped.length ? scoped : team.filter((e) => !e.dealerCode);
}

/**
 * พนักงานที่ "มีรายการขายจริง" ให้ร้านนี้ (อนุมานจาก SALES.dealerCode)
 * แม่นกว่า employeesOfDealer เพราะพนักงานหนึ่งคนทำงานได้หลายร้าน
 * ถ้าชุดข้อมูลไม่มี dealerCode ในรายการขาย -> fallback เป็น employeesOfDealer
 */
export function employeesWithSalesForDealer(
  dealerCode?: string | null
): TeamMember[] {
  const team = getSalesTeam();
  if (!dealerCode) return team;
  const sales = getSales();
  const hasDealerCode = sales.some((s) => s.dealerCode !== undefined);
  if (!hasDealerCode) return employeesOfDealer(dealerCode);
  const ids = new Set(
    sales.filter((s) => s.dealerCode === dealerCode).map((s) => s.empId)
  );
  const list = team.filter((e) => ids.has(e.id));
  return list.sort((a, b) => a.name.localeCompare(b.name, "th"));
}

function empIdsOfDealer(dealerCode?: string | null): Set<string> | null {
  if (!dealerCode) return null;
  const ids = employeesOfDealer(dealerCode).map((e) => e.id);
  return new Set(ids);
}

/** อ่าน role ปัจจุบันจาก sessionStorage (ปลอดภัยกับ SSR)
 *  คืนเฉพาะว่าเป็น "sales" หรือไม่ (admin/dealer ถือเป็นมุมมองร้าน = ใช้ comm) */
function currentRole(): "dealer" | "sales" {
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("role") === "sales") {
      return "sales";
    }
  } catch {
    /* ignore */
  }
  return "dealer";
}

/* ---------------- มุมมองค่าคอมมิชชัน (benefit view) ----------------
   ปกติค่าคอมฯ อิง role ที่ล็อกอิน (ร้านค้า = comm, พนักงาน = inc)
   แต่บางหน้า (เช่น "ผลประโยชน์ของพนักงานในร้าน" ที่ admin เปิด) ต้องการ
   บังคับใช้มุมมองพนักงานเสมอ จึงเปิดให้ตั้ง override ชั่วคราวได้ */
export type BenefitView = "store" | "emp";
let benefitViewOverride: BenefitView | null = null;

/** ตั้งมุมมองค่าคอมฯ (null = อิง role ตามปกติ) — เรียกตอนเริ่ม render ของหน้า */
export function setBenefitView(view: BenefitView | null): void {
  benefitViewOverride = view;
}

/** มุมมองค่าคอมฯ ที่ใช้งานจริง: override ก่อน, ไม่งั้นอิง role */
function activeBenefitView(): BenefitView {
  if (benefitViewOverride) return benefitViewOverride;
  return currentRole() === "sales" ? "emp" : "store";
}

/**
 * ค่าคอมมิชชันของงานหนึ่งแถว
 * - ถ้ามีค่าจริงจากไฟล์ (comm = ร้านค้า, inc = พนักงาน) ใช้ตามมุมมองที่ใช้งาน
 * - ถ้าไม่มี (ชุดข้อมูล mock เดิม) คำนวณจาก amount * rate ของ solution
 */
export function commissionOf(sale: Sale): number {
  if (sale.comm !== undefined || sale.inc !== undefined) {
    const v = activeBenefitView() === "emp" ? sale.inc : sale.comm;
    return Math.round(v ?? 0);
  }
  const sol = solutionById(sale.solId);
  return Math.round(sale.amount * (sol ? sol.rate : 0));
}

/* ---------------- Period helpers ---------------- */

export function availableYears(): string[] {
  const set: Record<string, boolean> = {};
  getPeriods().forEach((p) => (set[p.split("-")[0]] = true));
  return Object.keys(set).sort().reverse();
}

export function periodsOfYear(year: string): string[] {
  return getPeriods()
    .filter((p) => p.split("-")[0] === String(year))
    .sort()
    .reverse();
}

export function latestYear(): string {
  return availableYears()[0] || currentPeriod().split("-")[0];
}

export function latestMonthNumOfYear(year: string): string | null {
  const list = periodsOfYear(year);
  return list.length ? list[0].split("-")[1] : null;
}

/* ---------------- Default filter state ---------------- */

export function defaultFilterState(): FilterState {
  const [y, m] = currentPeriod().split("-");
  return {
    years: [y],
    monthsByYear: { [y]: [m] },
    groups: "all",
    statuses: "all",
  };
}

/* ---------------- Selection resolvers ---------------- */

export function selectedYears(state: FilterState): string[] {
  const years = availableYears();
  const filtered = (state.years || []).filter((y) => years.includes(y));
  return filtered.length ? filtered : [latestYear()];
}

export function selectedMonthsOfYear(
  state: FilterState,
  year: string
): "all" | string[] {
  const map = state.monthsByYear || {};
  if (!Object.prototype.hasOwnProperty.call(map, year)) {
    const mm = latestMonthNumOfYear(year);
    return mm ? [mm] : [];
  }
  const val = map[year];
  if (val === "all") return "all";
  if (Array.isArray(val)) return val;
  const mm = latestMonthNumOfYear(year);
  return mm ? [mm] : [];
}

export function selectedPeriods(state: FilterState): string[] {
  const years = selectedYears(state);
  const result: string[] = [];
  years.forEach((y) => {
    const months = selectedMonthsOfYear(state, y);
    periodsOfYear(y).forEach((p) => {
      const mm = p.split("-")[1];
      if (months === "all" || months.includes(mm)) result.push(p);
    });
  });
  return result;
}

export function selectedGroups(state: FilterState): GroupKey[] {
  const all = Object.keys(GROUPS) as GroupKey[];
  const g = state.groups;
  if (g === "all" || g === undefined || g === null) return all;
  if (!Array.isArray(g)) return all;
  return g.filter((x) => all.includes(x));
}

/**
 * กลุ่มของงานที่เลือก (solId) — คืนรายการ solId ที่ถูกเลือก โดยจำกัดให้อยู่ใน
 * ประเภทการขายที่เลือกอยู่ (groups) ด้วย; ค่าเริ่มต้น "all" = ทุกกลุ่มในประเภทที่เลือก
 */
export function selectedJobGroups(state: FilterState): string[] {
  const groups = selectedGroups(state);
  // solId ทั้งหมดที่อยู่ในประเภทการขายที่เลือก
  const inGroup = getSolutions()
    .filter((s) => groups.includes(s.group))
    .map((s) => s.id);
  const jg = state.jobGroups;
  if (jg === "all" || jg === undefined || jg === null) return inGroup;
  if (!Array.isArray(jg)) return inGroup;
  // เลือกเฉพาะที่ยังอยู่ในประเภทที่เลือก (กันค่าค้างเมื่อสลับประเภทการขาย)
  const picked = jg.filter((id) => inGroup.includes(id));
  return picked;
}

function saleMatchesJobGroups(sale: Sale, jobGroupIds: string[]): boolean {
  return jobGroupIds.includes(sale.solId);
}

/* ---------------- ประเภทผลประโยชน์ (Commission / Back Margin / Incentive) ---------------- */

/** ประเภทผลประโยชน์ของงานหนึ่งแถว ตามมุมมองค่าคอมฯ ที่ใช้งานอยู่
 *  - มุมมองพนักงาน (emp): Incentive
 *  - มุมมองร้านค้า (store): DI => Back Margin, อื่นๆ => Commission */
export function benefitTypeOf(sale: Sale): string {
  if (activeBenefitView() === "emp") return "Incentive";
  return (sale.src ?? "").trim().toUpperCase() === "DI"
    ? "Back Margin"
    : "Commission";
}

/** ประเภทผลประโยชน์ทั้งหมดที่ปรากฏในชุดข้อมูลที่ให้มา (เรียงคงที่) */
export function availableBenefitTypes(sales: Sale[]): string[] {
  const set = new Set<string>();
  sales.forEach((s) => set.add(benefitTypeOf(s)));
  const order = ["Commission", "Back Margin", "Incentive"];
  return Array.from(set).sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
  );
}

/** ประเภทผลประโยชน์ที่เลือกอยู่ (จำกัดเฉพาะที่มีจริงใน available) — ค่าเริ่มต้น = ทั้งหมด */
export function selectedBenefitTypes(
  state: FilterState,
  available: string[]
): string[] {
  const bt = state.benefitTypes;
  if (bt === "all" || bt === undefined || bt === null) return available;
  if (!Array.isArray(bt)) return available;
  const picked = bt.filter((t) => available.includes(t));
  return picked;
}

const ALL_PAYMENT_STATUSES: PaymentStatus[] = ["paid", "pending"];

/** สถานะการจ่ายที่เลือกอยู่ (รอจ่าย = pending + processing) — ค่าเริ่มต้น = ทั้งหมด */
export function selectedStatuses(state: FilterState): PaymentStatus[] {
  const s = state.statuses;
  if (s === "all" || s === undefined || s === null) return ALL_PAYMENT_STATUSES;
  if (!Array.isArray(s)) return ALL_PAYMENT_STATUSES;
  return s.filter((x) => ALL_PAYMENT_STATUSES.includes(x));
}

/** จับกลุ่มสถานะจริงของงานเป็นสถานะการจ่าย (paid เป็น paid, ที่เหลือเป็น pending/รอจ่าย) */
function paymentStatusOf(sale: Sale): PaymentStatus {
  return sale.status === "paid" ? "paid" : "pending";
}

function saleMatchesStatuses(sale: Sale, statuses: PaymentStatus[]): boolean {
  return statuses.includes(paymentStatusOf(sale));
}

/* ---------------- Date filter (ประเภทวันที่ + โหมดปี-เดือน/ช่วงวันที่) ---------------- */

/** ประเภทวันที่ที่เลือก (ค่าเริ่มต้น = วันที่โอนจ่าย) */
export function selectedDateField(state: FilterState): "pay" | "close" {
  return state.dateField === "close" ? "close" : "pay";
}
/** โหมดการเลือกช่วงเวลา (ค่าเริ่มต้น = ปี-เดือน) */
export function selectedDateMode(state: FilterState): "period" | "range" {
  return state.dateMode === "range" ? "range" : "period";
}

/** แปลงวันที่โอนจ่ายดิบ DD-MM-YY (ปี 2 หลักท้าย ค.ศ.) -> YYYY-MM-DD */
function payDateISO(sale: Sale): string | null {
  const raw = sale.payDateRaw;
  if (!raw) {
    // ไม่มีวันโอนจ่ายดิบ -> ใช้ period เป็น YYYY-MM-01 (เผื่อข้อมูลรอสรุป)
    return sale.period ? sale.period + "-01" : null;
  }
  const m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (!m) return sale.period ? sale.period + "-01" : null;
  const yyyy = 2000 + parseInt(m[3], 10);
  return `${yyyy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** วันที่ของงาน (ISO YYYY-MM-DD) ตามประเภทที่เลือก */
function saleDateISO(sale: Sale, field: "pay" | "close"): string | null {
  if (field === "close") return sale.soldDate || sale.date || null;
  return payDateISO(sale);
}

/** YYYY-MM ของงานตามประเภทวันที่ (ใช้กับโหมดปี-เดือน) */
function saleYearMonth(sale: Sale, field: "pay" | "close"): string | null {
  if (field === "pay") return sale.period || null;
  const iso = saleDateISO(sale, "close");
  return iso ? iso.slice(0, 7) : null;
}

/** งานนี้ผ่านตัวกรองวันที่หรือไม่ (รองรับทั้งโหมดปี-เดือน และช่วงวันที่) */
function saleMatchesDate(sale: Sale, state: FilterState): boolean {
  const field = selectedDateField(state);
  if (selectedDateMode(state) === "range") {
    const iso = saleDateISO(sale, field);
    if (!iso) return false;
    const from = state.dateFrom;
    const to = state.dateTo;
    if (from && iso < from) return false;
    if (to && iso > to) return false;
    return true;
  }
  // โหมดปี-เดือน: เทียบ YYYY-MM กับรอบที่เลือก
  const ym = saleYearMonth(sale, field);
  if (!ym) return false;
  return selectedPeriods(state).includes(ym);
}

/* ---------------- Scope ---------------- */

/**
 * empId  = โหมดพนักงานขาย (เห็นเฉพาะงานของตน)
 * dealerCode = โหมดร้านค้า (เห็นเฉพาะงานของพนักงานในร้านนั้น)
 * ไม่ระบุทั้งคู่ = เห็นทั้งหมด
 */
/** ข้อมูลจริงมี sale.dealerCode -> scope ตามร้านตรงๆ; ไม่งั้น fallback เป็นชุดพนักงานของร้าน */
function salesOfDealer(all: Sale[], dealerCode?: string | null): Sale[] {
  if (!dealerCode) return all.slice();
  const hasDealerCode = all.some((s) => s.dealerCode !== undefined);
  if (hasDealerCode) return all.filter((s) => s.dealerCode === dealerCode);
  const storeIds = empIdsOfDealer(dealerCode);
  return storeIds ? all.filter((s) => storeIds.has(s.empId)) : all.slice();
}

export function scopedSales(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): Sale[] {
  const groups = selectedGroups(state);
  const statuses = selectedStatuses(state);
  const all = getSales();
  let rows: Sale[];
  if (empId) {
    rows = all.filter((s) => s.empId === empId && (!dealerCode || s.dealerCode === undefined || s.dealerCode === dealerCode));
  } else {
    rows = salesOfDealer(all, dealerCode);
  }
  const jobGroups = selectedJobGroups(state);
  const benefitTypes = selectedBenefitTypes(state, availableBenefitTypes(all));
  rows = rows.filter((s) => saleMatchesDate(s, state));
  rows = rows.filter((s) => {
    const sol = solutionById(s.solId);
    return sol ? groups.includes(sol.group) : false;
  });
  rows = rows.filter((s) => saleMatchesJobGroups(s, jobGroups));
  rows = rows.filter((s) => saleMatchesStatuses(s, statuses));
  rows = rows.filter((s) => benefitTypes.includes(benefitTypeOf(s)));
  return rows;
}

export function totals(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): Totals {
  const rows = scopedSales(state, empId, dealerCode);
  let totalSales = 0,
    totalCommission = 0,
    paidCommission = 0,
    pendingCommission = 0;
  rows.forEach((s) => {
    const c = commissionOf(s);
    totalSales += s.amount;
    totalCommission += c;
    if (s.status === "paid") paidCommission += c;
    else pendingCommission += c;
  });
  return {
    totalSales,
    totalCommission,
    paidCommission,
    pendingCommission,
    count: rows.length,
  };
}

/* ---------------- Aggregations ---------------- */

export interface EmployeeAgg extends TeamMember {
  sales: number;
  commission: number;
  deals: number;
}

export function perEmployee(
  state: FilterState,
  dealerCode?: string | null
): EmployeeAgg[] {
  const groups = selectedGroups(state);
  const statuses = selectedStatuses(state);
  const jobGroups = selectedJobGroups(state);
  const benefitTypes = selectedBenefitTypes(
    state,
    availableBenefitTypes(getSales())
  );
  const base = salesOfDealer(getSales(), dealerCode);
  const src = base.filter((s) => {
    if (!saleMatchesDate(s, state)) return false;
    if (!saleMatchesStatuses(s, statuses)) return false;
    if (!saleMatchesJobGroups(s, jobGroups)) return false;
    if (!benefitTypes.includes(benefitTypeOf(s))) return false;
    const sol = solutionById(s.solId);
    return sol ? groups.includes(sol.group) : false;
  });
  // รายชื่อพนักงานที่ปรากฏในข้อมูลของร้านนี้ (อนุมานจากรายการขายจริง)
  const empIds = Array.from(new Set(src.map((s) => s.empId)));
  const team = getSalesTeam();
  const fromData = empIds
    .map((id) => team.find((e) => e.id === id))
    .filter((e): e is TeamMember => !!e);
  const teamList = fromData.length ? fromData : employeesOfDealer(dealerCode);
  return teamList
    .map((emp) => {
      const rows = src.filter((s) => s.empId === emp.id);
      return {
        ...emp,
        sales: rows.reduce((a, s) => a + s.amount, 0),
        commission: rows.reduce((a, s) => a + commissionOf(s), 0),
        deals: rows.length,
      };
    })
    .sort((a, b) => b.commission - a.commission);
}

export interface SolutionAgg extends Solution {
  sales: number;
  commission: number;
  deals: number;
}

export function perSolution(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): SolutionAgg[] {
  const src = scopedSales(state, empId, dealerCode);
  return getSolutions().map((sol) => {
    const rows = src.filter((s) => s.solId === sol.id);
    return {
      ...sol,
      sales: rows.reduce((a, s) => a + s.amount, 0),
      commission: rows.reduce((a, s) => a + commissionOf(s), 0),
      deals: rows.length,
    };
  })
    .filter((s) => s.deals > 0)
    .sort((a, b) => b.commission - a.commission);
}

export function perSolutionByGroup(
  state: FilterState,
  group: GroupKey,
  empId?: string | null,
  dealerCode?: string | null
): SolutionAgg[] {
  return perSolution(state, empId, dealerCode).filter((s) => s.group === group);
}

export interface GroupAgg extends GroupMeta {
  sales: number;
  commission: number;
  /** ค่าคอมฯ ที่จ่ายแล้ว (status = paid) */
  paidCommission: number;
  /** ค่าคอมฯ ที่รอจ่าย (status = pending/processing) */
  pendingCommission: number;
  deals: number;
}

export function perGroup(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): GroupAgg[] {
  const src = scopedSales(state, empId, dealerCode);
  return (Object.keys(GROUPS) as GroupKey[]).map((g) => {
    const rows = src.filter((s) => {
      const sol = solutionById(s.solId);
      return sol ? sol.group === g : false;
    });
    let commission = 0,
      paidCommission = 0,
      pendingCommission = 0;
    rows.forEach((s) => {
      const c = commissionOf(s);
      commission += c;
      if (s.status === "paid") paidCommission += c;
      else pendingCommission += c;
    });
    return {
      ...GROUPS[g],
      sales: rows.reduce((a, s) => a + s.amount, 0),
      commission,
      paidCommission,
      pendingCommission,
      deals: rows.length,
    };
  });
}

export function commissionByGroupAll(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): GroupAgg[] {
  return perGroup(state, empId, dealerCode);
}

/* ---------------- Analysis (charts) ---------------- */

/** Source scoped by employee/store + selected groups, NOT bound to selected periods */
function analysisSrc(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): Sale[] {
  const groups = selectedGroups(state);
  const statuses = selectedStatuses(state);
  const all = getSales();
  let rows: Sale[];
  if (empId) {
    rows = all.filter((s) => s.empId === empId && (!dealerCode || s.dealerCode === undefined || s.dealerCode === dealerCode));
  } else {
    rows = salesOfDealer(all, dealerCode);
  }
  const jobGroups = selectedJobGroups(state);
  const benefitTypes = selectedBenefitTypes(
    state,
    availableBenefitTypes(getSales())
  );
  return rows.filter((s) => {
    if (!saleMatchesStatuses(s, statuses)) return false;
    if (!saleMatchesJobGroups(s, jobGroups)) return false;
    if (!benefitTypes.includes(benefitTypeOf(s))) return false;
    const sol = solutionById(s.solId);
    return sol ? groups.includes(sol.group) : false;
  });
}

export interface GroupSlice {
  commission: number;
  paidCommission: number;
  pendingCommission: number;
  sales: number;
  deals: number;
}
export interface MonthBucket {
  period?: string;
  month?: string;
  label: string;
  commission: number;
  sales: number;
  deals: number;
  solution: GroupSlice;
  product: GroupSlice;
}

function emptySlices() {
  return {
    solution: { commission: 0, paidCommission: 0, pendingCommission: 0, sales: 0, deals: 0 },
    product: { commission: 0, paidCommission: 0, pendingCommission: 0, sales: 0, deals: 0 },
  };
}

export function commissionLast3Months(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): MonthBucket[] {
  const src = analysisSrc(state, empId, dealerCode);
  const chosen = selectedPeriods(state).slice().sort().slice(-3);
  return chosen.map((p) => {
    const rows = src.filter((s) => s.period === p);
    const grp = emptySlices();
    rows.forEach((s) => {
      const sol = solutionById(s.solId);
      if (!sol) return;
      const g = grp[sol.group];
      const c = commissionOf(s);
      g.commission += c;
      if (s.status === "paid") g.paidCommission += c;
      else g.pendingCommission += c;
      g.sales += s.amount;
      g.deals += 1;
    });
    return {
      period: p,
      label: periodShort(p),
      commission: grp.solution.commission + grp.product.commission,
      sales: grp.solution.sales + grp.product.sales,
      deals: rows.length,
      solution: grp.solution,
      product: grp.product,
    };
  });
}

export function commissionByMonthOfYear(
  state: FilterState,
  year: string,
  empId?: string | null,
  dealerCode?: string | null
): MonthBucket[] {
  const src = analysisSrc(state, empId, dealerCode);
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  return months.map((mm) => {
    const period = year + "-" + mm;
    const rows = src.filter((s) => s.period === period);
    const grp = emptySlices();
    rows.forEach((s) => {
      const sol = solutionById(s.solId);
      if (!sol) return;
      const g = grp[sol.group];
      const c = commissionOf(s);
      g.commission += c;
      if (s.status === "paid") g.paidCommission += c;
      else g.pendingCommission += c;
      g.sales += s.amount;
      g.deals += 1;
    });
    return {
      month: mm,
      label: TH_MONTHS[parseInt(mm, 10) - 1],
      commission: rows.reduce((a, s) => a + commissionOf(s), 0),
      sales: rows.reduce((a, s) => a + s.amount, 0),
      deals: rows.length,
      solution: grp.solution,
      product: grp.product,
    };
  });
}

/* ---------------- Points / leaderboard ---------------- */

function sameModel(a?: string | null, b?: string | null): boolean {
  const norm = (s?: string | null) =>
    String(s || "").toLowerCase().replace(/\s+/g, "");
  return norm(a) === norm(b);
}

export function pointCompanyName(code: string): string {
  return getPointCompanies().find((c) => c.code === code)?.name ?? "";
}
export function pointCompanyModel(code: string): string {
  return getPointCompanies().find((c) => c.code === code)?.model ?? "";
}

export interface RankedCompany {
  code: string;
  name: string;
  model: string;
  region: string;
  points: number;
  rank: number;
}

export function pointsRankCompanies(model?: string | null): RankedCompany[] {
  return getPointCompanies().slice()
    .filter((c) => !model || sameModel(c.model, model))
    .sort((a, b) => b.points - a.points)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

export interface RankedEmployee {
  empCode: string;
  name: string;
  companyCode: string;
  avatar: string;
  points: number;
  rank: number;
  companyName: string;
}

export function pointsRankEmployees(model?: string | null): RankedEmployee[] {
  return getPointEmployees().slice()
    .filter((e) => !model || sameModel(pointCompanyModel(e.companyCode), model))
    // รวมแต้มที่แอดมินเพิ่ม (adjustments) เข้ากับยอดสะสม -> อันดับ=คงเหลือ
    .map((e) => ({ ...e, points: e.points + adjustmentTotal(e.empCode) }))
    .sort((a, b) => b.points - a.points)
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      companyName: pointCompanyName(e.companyCode),
    }));
}

/** รหัสในระบบแต้มของพนักงานที่ล็อกอิน = empId ตรง ๆ
 *  (ข้อมูลแต้มใช้ empCode = empId จริงแล้ว จึงไม่ต้อง map อีก) */
export function myPointEmpCode(empId?: string | null): string | null {
  return empId ?? null;
}


/* ---------------- ค้นหาข้อมูล (universal search) ---------------- */

export interface SearchGroupHit {
  code: string;
  name: string;
  deals: number;
  commission: number;
  sales: number;
}
export interface SearchResult {
  rows: Sale[];
  dealers: SearchGroupHit[];
  employees: SearchGroupHit[];
  totalDeals: number;
  totalCommission: number;
}

/**
 * ค้นหางานจากคำค้นเดียว — จับคู่ ชื่อร้าน/รหัสร้าน, ชื่อพนักงาน/รหัส, ชื่อลูกค้า, เลขที่งาน
 * เคารพ scope ตาม role (empId / dealerCode) แต่ไม่ผูกกับตัวกรองวันที่/สถานะ (ค้นทุกรอบของ scope)
 */
export function searchSales(
  query: string,
  empId?: string | null,
  dealerCode?: string | null
): SearchResult {
  const q = query.trim().toLowerCase();
  const empty: SearchResult = {
    rows: [],
    dealers: [],
    employees: [],
    totalDeals: 0,
    totalCommission: 0,
  };
  if (!q) return empty;

  const all = getSales();
  // scope ตาม role
  let scoped: Sale[];
  if (empId) {
    scoped = all.filter((s) => s.empId === empId);
  } else {
    scoped = salesOfDealer(all, dealerCode);
  }

  const dealers = getDealers();
  const team = getSalesTeam();
  const dealerName = (code?: string) =>
    dealers.find((d) => d.code === code)?.name ?? "";
  const empName = (id?: string) =>
    team.find((e) => e.id === id)?.name ?? "";

  const rows = scoped.filter((s) => {
    const fields = [
      s.dealerCode ?? "",
      dealerName(s.dealerCode),
      s.empId,
      empName(s.empId),
      s.seller ?? "",
      s.customer,
      s.projectId,
    ];
    return fields.some((f) => String(f).toLowerCase().includes(q));
  });

  // สรุปแยกตามร้าน
  const dmap = new Map<string, SearchGroupHit>();
  const emap = new Map<string, SearchGroupHit>();
  rows.forEach((s) => {
    const c = commissionOf(s);
    const dc = s.dealerCode ?? "-";
    const dh =
      dmap.get(dc) ??
      { code: dc, name: dealerName(s.dealerCode), deals: 0, commission: 0, sales: 0 };
    dh.deals += 1;
    dh.commission += c;
    dh.sales += s.amount;
    dmap.set(dc, dh);

    const eh =
      emap.get(s.empId) ??
      { code: s.empId, name: empName(s.empId), deals: 0, commission: 0, sales: 0 };
    eh.deals += 1;
    eh.commission += c;
    eh.sales += s.amount;
    emap.set(s.empId, eh);
  });

  const sortHit = (a: SearchGroupHit, b: SearchGroupHit) =>
    b.commission - a.commission;

  return {
    rows: rows.slice().sort((a, b) => b.date.localeCompare(a.date)),
    dealers: [...dmap.values()].sort(sortHit),
    employees: [...emap.values()].sort(sortHit),
    totalDeals: rows.length,
    totalCommission: rows.reduce((a, s) => a + commissionOf(s), 0),
  };
}

/* ============================================================
   Analysis aggregations (ชุดกราฟวิเคราะห์เพิ่มเติม 7 แบบ)
   ใช้ scopedSales (ผูกกับตัวกรอง) สำหรับมุมมองช่วงที่เลือก
   และ analysisSrc (ไม่ผูกช่วงเวลา) สำหรับกราฟรายปี/สะสม
   ============================================================ */

/* ---- 1) สถานะการจ่าย: จ่ายแล้ว vs รอจ่าย ---- */
export interface PaymentSplit {
  paidCommission: number;
  pendingCommission: number;
  totalCommission: number;
  paidDeals: number;
  pendingDeals: number;
  totalDeals: number;
}
export function paymentSplit(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): PaymentSplit {
  const rows = scopedSales(state, empId, dealerCode);
  const out: PaymentSplit = {
    paidCommission: 0,
    pendingCommission: 0,
    totalCommission: 0,
    paidDeals: 0,
    pendingDeals: 0,
    totalDeals: rows.length,
  };
  rows.forEach((s) => {
    const c = commissionOf(s);
    out.totalCommission += c;
    if (s.status === "paid") {
      out.paidCommission += c;
      out.paidDeals += 1;
    } else {
      out.pendingCommission += c;
      out.pendingDeals += 1;
    }
  });
  return out;
}

/* ---- 2) Top ranking: พนักงาน / ร้านค้า ---- */
export interface RankRow {
  code: string;
  name: string;
  commission: number;
  sales: number;
  deals: number;
}

/** Top พนักงานขายตามค่าคอมฯ (ตามขอบเขตที่กำหนด) */
export function topEmployees(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null,
  limit = 10
): RankRow[] {
  const rows = scopedSales(state, empId, dealerCode);
  const team = getSalesTeam();
  const map = new Map<string, RankRow>();
  rows.forEach((s) => {
    const r =
      map.get(s.empId) ??
      {
        code: s.empId,
        name: team.find((e) => e.id === s.empId)?.name ?? s.empId,
        commission: 0,
        sales: 0,
        deals: 0,
      };
    r.commission += commissionOf(s);
    r.sales += s.amount;
    r.deals += 1;
    map.set(s.empId, r);
  });
  return [...map.values()]
    .sort((a, b) => b.commission - a.commission)
    .slice(0, limit);
}

/** Top ร้านค้าตามค่าคอมฯ (ตามขอบเขตที่กำหนด) */
export function topDealers(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null,
  limit = 10
): RankRow[] {
  const rows = scopedSales(state, empId, dealerCode);
  const dealers = getDealers();
  const map = new Map<string, RankRow>();
  rows.forEach((s) => {
    const dc = s.dealerCode ?? "-";
    const r =
      map.get(dc) ??
      {
        code: dc,
        name: dealers.find((d) => d.code === dc)?.name ?? dc,
        commission: 0,
        sales: 0,
        deals: 0,
      };
    r.commission += commissionOf(s);
    r.sales += s.amount;
    r.deals += 1;
    map.set(dc, r);
  });
  return [...map.values()]
    .sort((a, b) => b.commission - a.commission)
    .slice(0, limit);
}

/* ---- 3) สัดส่วนตามประเภทผลประโยชน์ (Commission / Back Margin / Incentive) ---- */
export interface BenefitSlice {
  type: string;
  commission: number;
  deals: number;
}
export function commissionByBenefitType(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): BenefitSlice[] {
  const rows = scopedSales(state, empId, dealerCode);
  const map = new Map<string, BenefitSlice>();
  rows.forEach((s) => {
    const t = benefitTypeOf(s);
    const r = map.get(t) ?? { type: t, commission: 0, deals: 0 };
    r.commission += commissionOf(s);
    r.deals += 1;
    map.set(t, r);
  });
  const order = ["Commission", "Back Margin", "Incentive"];
  return [...map.values()].sort(
    (a, b) =>
      (order.indexOf(a.type) + 1 || 99) - (order.indexOf(b.type) + 1 || 99)
  );
}

/* ---- 4) Funnel สถานะงาน (processing -> pending -> paid) ---- */
export interface FunnelStage {
  key: Sale["status"];
  label: string;
  deals: number;
  commission: number;
}
export function statusFunnel(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): FunnelStage[] {
  // ไม่ผูกตัวกรองสถานะ (ต้องเห็นครบทุกขั้น) จึงใช้ analysisSrc
  const rows = analysisSrc(state, empId, dealerCode);
  const defs: { key: Sale["status"]; label: string }[] = [
    { key: "processing", label: "กำลังดำเนินการ" },
    { key: "pending", label: "รอจ่าย" },
    { key: "paid", label: "จ่ายแล้ว" },
  ];
  return defs.map((d) => {
    const r = rows.filter((s) => s.status === d.key);
    return {
      key: d.key,
      label: d.label,
      deals: r.length,
      commission: r.reduce((a, s) => a + commissionOf(s), 0),
    };
  });
}

/* ---- 5) ช่องว่างเวลา ปิดขาย -> โอนจ่าย (วัน) ---- */
export interface GapBucket {
  label: string;
  deals: number;
}
export interface GapResult {
  buckets: GapBucket[];
  avgDays: number | null;
  sampled: number;
}
/** แปลงวันที่ปิดขาย ISO (soldDate/date = YYYY-MM-DD) */
function closeISO(sale: Sale): string | null {
  return sale.soldDate || sale.date || null;
}
export function payGapHistogram(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): GapResult {
  const rows = scopedSales(state, empId, dealerCode);
  const defs: { label: string; min: number; max: number }[] = [
    { label: "0-30 วัน", min: 0, max: 30 },
    { label: "31-60 วัน", min: 31, max: 60 },
    { label: "61-90 วัน", min: 61, max: 90 },
    { label: "91-120 วัน", min: 91, max: 120 },
    { label: "120+ วัน", min: 121, max: Infinity },
  ];
  const buckets: GapBucket[] = defs.map((d) => ({ label: d.label, deals: 0 }));
  let sum = 0;
  let sampled = 0;
  rows.forEach((s) => {
    const cIso = closeISO(s);
    const pIso = payDateISO(s);
    if (!cIso || !pIso) return;
    const c = new Date(cIso + "T00:00:00").getTime();
    const p = new Date(pIso + "T00:00:00").getTime();
    if (isNaN(c) || isNaN(p)) return;
    const days = Math.round((p - c) / 86400000);
    if (days < 0) return; // ข้ามข้อมูลผิดปกติ (จ่ายก่อนปิดขาย)
    sum += days;
    sampled += 1;
    const idx = defs.findIndex((d) => days >= d.min && days <= d.max);
    if (idx >= 0) buckets[idx].deals += 1;
  });
  return {
    buckets,
    avgDays: sampled > 0 ? Math.round(sum / sampled) : null,
    sampled,
  };
}

/* ---- 6) ค่าคอมฯ สะสม (cumulative) รายปี เทียบปีก่อน ---- */
export interface CumulativeSeries {
  year: string;
  points: { label: string; value: number }[];
}
/** คืนเส้นสะสมของปีที่เลือก + ปีก่อนหน้า (ถ้ามีข้อมูล) */
export function cumulativeByYear(
  state: FilterState,
  year: string,
  empId?: string | null,
  dealerCode?: string | null
): CumulativeSeries[] {
  const src = analysisSrc(state, empId, dealerCode);
  const years = availableYears();
  const prev = String(parseInt(year, 10) - 1);
  const wanted = [year, ...(years.includes(prev) ? [prev] : [])];
  const months = [
    "01", "02", "03", "04", "05", "06",
    "07", "08", "09", "10", "11", "12",
  ];
  return wanted.map((y) => {
    let acc = 0;
    const points = months.map((mm) => {
      const period = y + "-" + mm;
      const monthComm = src
        .filter((s) => s.period === period)
        .reduce((a, s) => a + commissionOf(s), 0);
      acc += monthComm;
      return { label: TH_MONTHS[parseInt(mm, 10) - 1], value: acc };
    });
    return { year: y, points };
  });
}

/* ---- 7) Heatmap เดือน x กลุ่มงานย่อย (solution) ---- */
export interface HeatRow {
  code: string;
  name: string;
  group: GroupKey;
  cells: number[]; // ค่าคอมฯ ต่อเดือน (index 0 = ม.ค.)
  total: number;
}
export interface HeatmapResult {
  months: string[]; // label ย่อของเดือน
  rows: HeatRow[];
  max: number;
}
export function commissionHeatmap(
  state: FilterState,
  year: string,
  empId?: string | null,
  dealerCode?: string | null,
  limit = 8
): HeatmapResult {
  const src = analysisSrc(state, empId, dealerCode).filter(
    (s) => (s.period ?? "").split("-")[0] === String(year)
  );
  const map = new Map<string, HeatRow>();
  src.forEach((s) => {
    const sol = solutionById(s.solId);
    if (!sol) return;
    const mm = parseInt((s.period ?? "").split("-")[1] ?? "0", 10);
    if (mm < 1 || mm > 12) return;
    const r =
      map.get(sol.id) ??
      {
        code: sol.id,
        name: sol.name,
        group: sol.group,
        cells: new Array(12).fill(0),
        total: 0,
      };
    const c = commissionOf(s);
    r.cells[mm - 1] += c;
    r.total += c;
    map.set(sol.id, r);
  });
  const rows = [...map.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
  const max = rows.reduce(
    (m, r) => Math.max(m, ...r.cells),
    0
  );
  return { months: TH_MONTHS, rows, max };
}


/* ---- สรุปสถานะการจ่าย โดย "ไม่สน" ตัวกรองสถานะปัจจุบัน ----
   ใช้สำหรับการ์ด/แถบสรุปในกล่องแรก ให้เห็นยอดจ่ายแล้ว/รอจ่ายจริงเสมอ
   แม้ขณะที่กำลังกรองอยู่สถานะเดียว (จึงยังกดสลับการ์ดได้) */
export interface StatusSummary {
  paidCommission: number;
  pendingCommission: number;
  totalCommission: number;
  paidDeals: number;
  pendingDeals: number;
  totalDeals: number;
}
export function statusSummary(
  state: FilterState,
  empId?: string | null,
  dealerCode?: string | null
): StatusSummary {
  const groups = selectedGroups(state);
  const all = getSales();
  let rows: Sale[];
  if (empId) {
    rows = all.filter(
      (s) =>
        s.empId === empId &&
        (!dealerCode || s.dealerCode === undefined || s.dealerCode === dealerCode)
    );
  } else {
    rows = salesOfDealer(all, dealerCode);
  }
  const jobGroups = selectedJobGroups(state);
  const benefitTypes = selectedBenefitTypes(state, availableBenefitTypes(all));
  // ใช้ตัวกรองทุกชนิด "ยกเว้น" สถานะการจ่าย
  rows = rows.filter((s) => {
    if (!saleMatchesDate(s, state)) return false;
    if (!saleMatchesJobGroups(s, jobGroups)) return false;
    if (!benefitTypes.includes(benefitTypeOf(s))) return false;
    const sol = solutionById(s.solId);
    return sol ? groups.includes(sol.group) : false;
  });
  const out: StatusSummary = {
    paidCommission: 0,
    pendingCommission: 0,
    totalCommission: 0,
    paidDeals: 0,
    pendingDeals: 0,
    totalDeals: rows.length,
  };
  rows.forEach((s) => {
    const c = commissionOf(s);
    out.totalCommission += c;
    if (s.status === "paid") {
      out.paidCommission += c;
      out.paidDeals += 1;
    } else {
      out.pendingCommission += c;
      out.pendingDeals += 1;
    }
  });
  return out;
}


/* ---- สรุปผลประโยชน์ตลอดทุกช่วงเวลา (ไม่ผูกตัวกรองใด ๆ) ----
   ใช้ในหน้าสมาชิก/โปรไฟล์ เพื่อสรุปภาพรวมของพนักงาน/ร้านทั้งหมด */
export function lifetimeTotals(
  empId?: string | null,
  dealerCode?: string | null
): Totals {
  const all = getSales();
  let rows: Sale[];
  if (empId) {
    rows = all.filter((s) => s.empId === empId);
  } else {
    rows = salesOfDealer(all, dealerCode);
  }
  let totalSales = 0,
    totalCommission = 0,
    paidCommission = 0,
    pendingCommission = 0;
  rows.forEach((s) => {
    const c = commissionOf(s);
    totalSales += s.amount;
    totalCommission += c;
    if (s.status === "paid") paidCommission += c;
    else pendingCommission += c;
  });
  return {
    totalSales,
    totalCommission,
    paidCommission,
    pendingCommission,
    count: rows.length,
  };
}


/* ============================================================
   คำแนะนำ (Recommendations) สำหรับหน้าวิเคราะห์
   - ขั้นบันได (tier) อิงยอดขายสะสมต่อกลุ่มงานย่อย (solution)
   - อัตราผลประโยชน์ตามขั้น (ตัวอย่าง 3 ขั้น: 3% / 5% / 7%)
   เป็น business rule ตัวอย่าง ไม่ใช่เงื่อนไขจริงจากไฟล์
   ============================================================ */

export interface Tier {
  index: number; // 0,1,2
  label: string;
  min: number; // ยอดขายสะสมขั้นต่ำ
  max: number | null; // null = ไม่มีเพดาน (ขั้นสูงสุด)
  rate: number; // อัตราผลประโยชน์ (เศษส่วน เช่น 0.03)
}

export const SALES_TIERS: Tier[] = [
  { index: 0, label: "ขั้นที่ 1", min: 0, max: 1_000_000, rate: 0.03 },
  { index: 1, label: "ขั้นที่ 2", min: 1_000_000, max: 3_000_000, rate: 0.05 },
  { index: 2, label: "ขั้นที่ 3", min: 3_000_000, max: null, rate: 0.07 },
];

/** ขั้นปัจจุบันจากยอดขายสะสม */
export function tierOf(sales: number): Tier {
  for (let i = SALES_TIERS.length - 1; i >= 0; i--) {
    if (sales >= SALES_TIERS[i].min) return SALES_TIERS[i];
  }
  return SALES_TIERS[0];
}

/** ยอดขาย/ค่าคอมฯ สะสมตลอดทุกช่วงเวลา แยกตามกลุ่มงานย่อย (solution) ในขอบเขต */
function lifetimeBySolution(
  empId?: string | null,
  dealerCode?: string | null
): SolutionAgg[] {
  const all = getSales();
  const rows = empId
    ? all.filter((s) => s.empId === empId)
    : salesOfDealer(all, dealerCode);
  return getSolutions()
    .map((sol) => {
      const r = rows.filter((s) => s.solId === sol.id);
      let pending = 0;
      let commission = 0;
      r.forEach((s) => {
        const c = commissionOf(s);
        commission += c;
        if (s.status !== "paid") pending += c;
      });
      return {
        ...sol,
        sales: r.reduce((a, s) => a + s.amount, 0),
        commission,
        deals: r.length,
        // แนบ pending ไว้ใช้ต่อ (ขยาย type ภายในฟังก์ชันนี้)
        pending,
      } as SolutionAgg & { pending: number };
    })
    .filter((s) => s.deals > 0);
}

export interface NearTierHit {
  solId: string;
  name: string;
  group: GroupKey;
  sales: number;
  currentRate: number;
  nextRate: number;
  nextTierLabel: string;
  remaining: number; // ขายอีกเท่าไรถึงขั้นถัดไป
  extraBenefit: number; // ผลประโยชน์โดยประมาณที่ได้เพิ่มเมื่อถึงขั้นถัดไป
}

export interface BenefitRankHit {
  solId: string;
  name: string;
  group: GroupKey;
  commission: number;
  deals: number;
  /** สัดส่วน % ของค่าคอมฯ กลุ่มนี้เทียบยอดรวมทุกกลุ่ม */
  pct: number;
  /** ยอดขายสะสมของกลุ่ม */
  sales: number;
  /** อัตราผลประโยชน์เฉลี่ยถ่วงน้ำหนัก (%) = คอมฯรวม ÷ ยอดขายรวม × 100 */
  rate: number;
}

/** กลุ่มดาวรุ่ง — ระดับกลุ่มงานย่อย (solution) */
export interface RisingHit {
  solId: string;
  name: string;
  group: GroupKey;
  latest: number;
  prev: number;
  changePct: number;
}

export interface Recommendations {
  nearNextTier: NearTierHit[];
  benefitRank: BenefitRankHit[];
  risingGroups: RisingHit[];
}

export function recommendations(
  empId?: string | null,
  dealerCode?: string | null
): Recommendations {
  const bySol = lifetimeBySolution(empId, dealerCode) as (SolutionAgg & {
    pending: number;
  })[];

  /* 1) ใกล้ถึงขั้นบันไดถัดไป — เรียงตามเหลืออีกน้อยสุด */
  const nearNextTier: NearTierHit[] = bySol
    .map((s) => {
      const cur = tierOf(s.sales);
      const next = SALES_TIERS[cur.index + 1];
      if (!next) return null; // อยู่ขั้นสูงสุดแล้ว
      const remaining = next.min - s.sales;
      if (remaining <= 0) return null;
      return {
        solId: s.id,
        name: s.name,
        group: s.group,
        sales: s.sales,
        currentRate: cur.rate,
        nextRate: next.rate,
        nextTierLabel: next.label,
        remaining,
        // ผลประโยชน์เพิ่มโดยประมาณ = ยอดใหม่ทั้งก้อน × ส่วนต่าง rate
        extraBenefit: Math.round(next.min * (next.rate - cur.rate)),
      };
    })
    .filter((x): x is NearTierHit => x !== null)
    .sort((a, b) => a.remaining - b.remaining);

  /* 2) กลุ่มที่ได้ผลประโยชน์มาก -> น้อย (พร้อม % เทียบยอดรวม) */
  const totalComm = bySol.reduce((a, s) => a + s.commission, 0);
  const benefitRank: BenefitRankHit[] = bySol
    .map((s) => ({
      solId: s.id,
      name: s.name,
      group: s.group,
      commission: s.commission,
      deals: s.deals,
      pct: totalComm > 0 ? (s.commission / totalComm) * 100 : 0,
      sales: s.sales,
      rate: s.sales > 0 ? (s.commission / s.sales) * 100 : 0,
    }))
    .sort((a, b) => b.commission - a.commission);

  /* 3) กลุ่มดาวรุ่ง — เทียบ 2 รอบล่าสุด ระดับกลุ่มงานย่อย (solution)
     แสดงเฉพาะกลุ่มย่อยที่มียอดทั้ง 2 รอบ (เทียบได้จริง) และโตขึ้น */
  const all = getSales();
  const scoped = empId
    ? all.filter((s) => s.empId === empId)
    : salesOfDealer(all, dealerCode);
  const periods = Array.from(new Set(scoped.map((s) => s.period)))
    .sort()
    .slice(-2);
  const risingGroups: RisingHit[] = [];
  if (periods.length === 2) {
    const [prevP, latestP] = periods;
    const commOf = (solId: string, p: string) =>
      scoped
        .filter((s) => s.solId === solId && s.period === p)
        .reduce((a, s) => a + commissionOf(s), 0);
    getSolutions().forEach((sol) => {
      const prev = commOf(sol.id, prevP);
      const latest = commOf(sol.id, latestP);
      // เทียบได้จริงเฉพาะเมื่อมียอดทั้ง 2 รอบ
      if (prev <= 0 || latest <= 0) return;
      const changePct = ((latest - prev) / prev) * 100;
      if (changePct <= 0) return; // เฉพาะที่โตขึ้น
      risingGroups.push({
        solId: sol.id,
        name: sol.name,
        group: sol.group,
        latest,
        prev,
        changePct,
      });
    });
    risingGroups.sort((a, b) => b.changePct - a.changePct);
  }

  return { nearNextTier, benefitRank, risingGroups };
}
