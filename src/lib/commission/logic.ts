/* =============================================================
   Commission portal computation helpers.
   Ported from commission-app/data.js — filter state is passed in
   explicitly (instead of reading sessionStorage) so it composes
   cleanly with React state.
   ============================================================= */
import {
  DEALERS,
  SOLUTIONS,
  SALES_TEAM,
  SALES,
  POINT_COMPANIES,
  POINT_EMPLOYEES,
} from "./raw-data";
import type {
  Dealer,
  FilterState,
  GroupKey,
  GroupMeta,
  Sale,
  Solution,
  TeamMember,
  Totals,
  TrackingKey,
} from "./types";

/* ---------------- Constants ---------------- */

export const CURRENT_PERIOD = "2025-12";

export const PERIODS: string[] = [
  "2025-12", "2025-11", "2025-10", "2025-09", "2025-08", "2025-07",
  "2025-06", "2025-05", "2025-04", "2025-03", "2025-02", "2025-01",
  "2024-12", "2024-11", "2024-10", "2024-09", "2024-08", "2024-07",
  "2024-06", "2024-05", "2024-04", "2024-03", "2024-02", "2024-01",
];

export const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const GROUPS: Record<GroupKey, GroupMeta> = {
  solution: { key: "solution", label: "โซลูชัน", icon: "widgets" },
  product: { key: "product", label: "สินค้า", icon: "inventory_2" },
};

export const STATUS_META: Record<
  Sale["status"],
  { label: string; bg: string; text: string; dot: string }
> = {
  paid: { label: "จ่ายแล้ว", bg: "bg-red-50", text: "text-[#a11119]", dot: "bg-[#d32029]" },
  pending: { label: "รอตัดรอบ", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  processing: { label: "กำลังดำเนินการ", bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
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

export { DEALERS, SOLUTIONS, SALES_TEAM, SALES, POINT_COMPANIES, POINT_EMPLOYEES };

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
  return DEALERS.find((d) => d.code === code) ?? null;
}

export function solutionById(id: string): Solution | undefined {
  return SOLUTIONS.find((s) => s.id === id);
}

export function employeeById(id: string): TeamMember | undefined {
  return SALES_TEAM.find((e) => e.id === id);
}

export function commissionOf(sale: Sale): number {
  const sol = solutionById(sale.solId);
  return Math.round(sale.amount * (sol ? sol.rate : 0));
}

/* ---------------- Period helpers ---------------- */

export function availableYears(): string[] {
  const set: Record<string, boolean> = {};
  PERIODS.forEach((p) => (set[p.split("-")[0]] = true));
  return Object.keys(set).sort().reverse();
}

export function periodsOfYear(year: string): string[] {
  return PERIODS.filter((p) => p.split("-")[0] === String(year))
    .sort()
    .reverse();
}

export function latestYear(): string {
  return availableYears()[0] || CURRENT_PERIOD.split("-")[0];
}

export function latestMonthNumOfYear(year: string): string | null {
  const list = periodsOfYear(year);
  return list.length ? list[0].split("-")[1] : null;
}

/* ---------------- Default filter state ---------------- */

export function defaultFilterState(): FilterState {
  const [y, m] = CURRENT_PERIOD.split("-");
  return { years: [y], monthsByYear: { [y]: [m] }, groups: "all" };
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

/* ---------------- Scope ---------------- */

/** empId is passed for the sales role; null/undefined = dealer sees the whole store */
export function scopedSales(
  state: FilterState,
  empId?: string | null
): Sale[] {
  const periods = selectedPeriods(state);
  const groups = selectedGroups(state);
  let rows = empId ? SALES.filter((s) => s.empId === empId) : SALES.slice();
  rows = rows.filter((s) => periods.includes(s.period));
  rows = rows.filter((s) => {
    const sol = solutionById(s.solId);
    return sol ? groups.includes(sol.group) : false;
  });
  return rows;
}

export function totals(state: FilterState, empId?: string | null): Totals {
  const rows = scopedSales(state, empId);
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

export function perEmployee(state: FilterState): EmployeeAgg[] {
  const periods = selectedPeriods(state);
  const groups = selectedGroups(state);
  const src = SALES.filter((s) => {
    if (!periods.includes(s.period)) return false;
    const sol = solutionById(s.solId);
    return sol ? groups.includes(sol.group) : false;
  });
  return SALES_TEAM.map((emp) => {
    const rows = src.filter((s) => s.empId === emp.id);
    return {
      ...emp,
      sales: rows.reduce((a, s) => a + s.amount, 0),
      commission: rows.reduce((a, s) => a + commissionOf(s), 0),
      deals: rows.length,
    };
  }).sort((a, b) => b.commission - a.commission);
}

export interface SolutionAgg extends Solution {
  sales: number;
  commission: number;
  deals: number;
}

export function perSolution(
  state: FilterState,
  empId?: string | null
): SolutionAgg[] {
  const src = scopedSales(state, empId);
  return SOLUTIONS.map((sol) => {
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
  empId?: string | null
): SolutionAgg[] {
  return perSolution(state, empId).filter((s) => s.group === group);
}

export interface GroupAgg extends GroupMeta {
  sales: number;
  commission: number;
  deals: number;
}

export function perGroup(
  state: FilterState,
  empId?: string | null
): GroupAgg[] {
  const src = scopedSales(state, empId);
  return (Object.keys(GROUPS) as GroupKey[]).map((g) => {
    const rows = src.filter((s) => {
      const sol = solutionById(s.solId);
      return sol ? sol.group === g : false;
    });
    return {
      ...GROUPS[g],
      sales: rows.reduce((a, s) => a + s.amount, 0),
      commission: rows.reduce((a, s) => a + commissionOf(s), 0),
      deals: rows.length,
    };
  });
}

export function commissionByGroupAll(
  state: FilterState,
  empId?: string | null
): GroupAgg[] {
  return perGroup(state, empId);
}

/* ---------------- Analysis (charts) ---------------- */

/** Source scoped by sales employee + selected groups, NOT bound to selected periods */
function analysisSrc(state: FilterState, empId?: string | null): Sale[] {
  const groups = selectedGroups(state);
  const rows = empId ? SALES.filter((s) => s.empId === empId) : SALES;
  return rows.filter((s) => {
    const sol = solutionById(s.solId);
    return sol ? groups.includes(sol.group) : false;
  });
}

export interface GroupSlice {
  commission: number;
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
    solution: { commission: 0, sales: 0, deals: 0 },
    product: { commission: 0, sales: 0, deals: 0 },
  };
}

export function commissionLast3Months(
  state: FilterState,
  empId?: string | null
): MonthBucket[] {
  const src = analysisSrc(state, empId);
  const chosen = selectedPeriods(state).slice().sort().slice(-3);
  return chosen.map((p) => {
    const rows = src.filter((s) => s.period === p);
    const grp = emptySlices();
    rows.forEach((s) => {
      const sol = solutionById(s.solId);
      if (!sol) return;
      const g = grp[sol.group];
      g.commission += commissionOf(s);
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
  empId?: string | null
): MonthBucket[] {
  const src = analysisSrc(state, empId);
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  return months.map((mm) => {
    const period = year + "-" + mm;
    const rows = src.filter((s) => s.period === period);
    const grp = emptySlices();
    rows.forEach((s) => {
      const sol = solutionById(s.solId);
      if (!sol) return;
      const g = grp[sol.group];
      g.commission += commissionOf(s);
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
  return POINT_COMPANIES.find((c) => c.code === code)?.name ?? "";
}
export function pointCompanyModel(code: string): string {
  return POINT_COMPANIES.find((c) => c.code === code)?.model ?? "";
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
  return POINT_COMPANIES.slice()
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
  return POINT_EMPLOYEES.slice()
    .filter((e) => !model || sameModel(pointCompanyModel(e.companyCode), model))
    .sort((a, b) => b.points - a.points)
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      companyName: pointCompanyName(e.companyCode),
    }));
}

/** map the logged-in EMP-1xx to its points-system code */
const MY_EMP_POINT_MAP: Record<string, string> = {
  "EMP-101": "SCGH_N_JB001",
  "EMP-102": "SCGH_N_JB002",
  "EMP-103": "SCGH_N_JB003",
  "EMP-104": "SCGH_S_CR001",
  "EMP-105": "SCGH_E_CM001",
};
export function myPointEmpCode(empId?: string | null): string | null {
  return empId && MY_EMP_POINT_MAP[empId] ? MY_EMP_POINT_MAP[empId] : null;
}
