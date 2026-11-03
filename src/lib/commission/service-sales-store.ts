"use client";

/* =============================================================
   ยอดขายงานบริการ (Service Sales) — client data layer
   อ่านผ่าน /api/service-sales
   - dealer: เห็นเฉพาะยอดของร้านตัวเอง
   - admin: เห็นรวมทุกร้าน + ยอด "ไม่ระบุร้าน"
   ============================================================= */

export interface SsMonth {
  period: string;    // 'YYYY-MM'
  amount: number;
  jobCount: number;
}

export interface SsSummary {
  ok: boolean;
  count: number;     // จำนวนงานทั้งหมด
  total: number;     // ยอดรวมทั้งหมด (รวม VAT)
  months: SsMonth[];
  error?: string;
}

export interface SsSubGroup {
  label: string;
  amount: number;
  jobCount: number;
}

export interface SsGroup {
  group3: string;    // 'ROOF SERVICE' | 'SMART SOLUTION' | 'Qchang'
  amount: number;
  jobCount: number;
  subs: SsSubGroup[];
}

/** กลุ่มย่อยใต้เดือน (ไม่มี subs ลึก — ใช้ drill ไป job) */
export interface SsMonthGroup {
  group3: string;
  amount: number;
  jobCount: number;
}

/** เดือน + 3 กลุ่มใต้เดือน */
export interface SsMonthDetail {
  period: string;
  amount: number;
  jobCount: number;
  groups: SsMonthGroup[];
}

/** 1 job (ตัด PII ชื่อลูกค้า) */
export interface SsJob {
  closeDate: string | null;
  group3: string;
  subGroup: string | null;
  subSolutionName: string | null;
  solutionName: string | null;
  provinceName: string | null;
  projectNumber: string | null;
  amount: number;
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, SsSummary>();
const listeners = new Set<() => void>();
function keyOf(dealerCode: string | null): string {
  return dealerCode || "__all__";
}
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeServiceSales(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getCachedServiceSalesSummary(dealerCode: string | null): SsSummary | null {
  return summaryCache.get(keyOf(dealerCode)) ?? null;
}

/* ---------------- map helpers ---------------- */
type RawMonth = { period: string; amount: number | string; job_count: number | string };
function mapMonth(r: RawMonth): SsMonth {
  return { period: r.period, amount: Number(r.amount ?? 0), jobCount: Number(r.job_count ?? 0) };
}

type RawGroup = {
  group3: string;
  amount: number | string;
  job_count: number | string;
  subs: { label: string; amount: number | string; job_count: number | string }[];
};
function mapGroup(r: RawGroup): SsGroup {
  return {
    group3: r.group3,
    amount: Number(r.amount ?? 0),
    jobCount: Number(r.job_count ?? 0),
    subs: Array.isArray(r.subs)
      ? r.subs.map((s) => ({ label: s.label, amount: Number(s.amount ?? 0), jobCount: Number(s.job_count ?? 0) }))
      : [],
  };
}

/* ---------------- API calls ---------------- */
export async function fetchServiceSalesSummary(dealerCode: string | null): Promise<SsSummary> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/service-sales${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    count?: number | string;
    total?: number | string;
    months?: RawMonth[];
    error?: string;
  };
  const summary: SsSummary = {
    ok: !!raw.ok,
    count: Number(raw.count ?? 0),
    total: Number(raw.total ?? 0),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode), summary);
    emit();
  }
  return summary;
}

export async function fetchServiceSalesGroups(dealerCode: string | null, year: string | null): Promise<SsGroup[]> {
  const params = new URLSearchParams({ mode: "groups" });
  if (dealerCode) params.set("dealerCode", dealerCode);
  if (year) params.set("year", year);
  const res = await fetch(`/api/service-sales?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; groups?: RawGroup[] };
  return raw.ok && Array.isArray(raw.groups) ? raw.groups.map(mapGroup) : [];
}

type RawMonthDetail = {
  period: string;
  amount: number | string;
  job_count: number | string;
  groups: { group3: string; amount: number | string; job_count: number | string }[];
};
function mapMonthDetail(r: RawMonthDetail): SsMonthDetail {
  return {
    period: r.period,
    amount: Number(r.amount ?? 0),
    jobCount: Number(r.job_count ?? 0),
    groups: Array.isArray(r.groups)
      ? r.groups.map((g) => ({ group3: g.group3, amount: Number(g.amount ?? 0), jobCount: Number(g.job_count ?? 0) }))
      : [],
  };
}

export async function fetchServiceSalesMonths(dealerCode: string | null, year: string | null): Promise<SsMonthDetail[]> {
  const params = new URLSearchParams({ mode: "months" });
  if (dealerCode) params.set("dealerCode", dealerCode);
  if (year) params.set("year", year);
  const res = await fetch(`/api/service-sales?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; months?: RawMonthDetail[] };
  return raw.ok && Array.isArray(raw.months) ? raw.months.map(mapMonthDetail) : [];
}

type RawJob = {
  close_date: string | null;
  group3: string;
  sub_group: string | null;
  sub_solution_name: string | null;
  solution_name: string | null;
  province_name: string | null;
  project_number: string | null;
  amount_incl_vat: number | string;
};
function mapJob(r: RawJob): SsJob {
  return {
    closeDate: r.close_date,
    group3: r.group3,
    subGroup: r.sub_group,
    subSolutionName: r.sub_solution_name,
    solutionName: r.solution_name,
    provinceName: r.province_name,
    projectNumber: r.project_number,
    amount: Number(r.amount_incl_vat ?? 0),
  };
}

export async function fetchServiceSalesJobs(
  dealerCode: string | null,
  period: string,
  group: string | null
): Promise<SsJob[]> {
  const params = new URLSearchParams({ mode: "jobs", period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  if (group) params.set("group", group);
  const res = await fetch(`/api/service-sales?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; jobs?: RawJob[] };
  return raw.ok && Array.isArray(raw.jobs) ? raw.jobs.map(mapJob) : [];
}
