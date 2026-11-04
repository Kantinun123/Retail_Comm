"use client";

/* =============================================================
   ยอดขายงานบริการ (Service Sales) — client data layer
   อ่านผ่าน /api/service-sales — รวม 2 แหล่ง: 'rudy' (LHS/Rudy) + 'ba' (BA ร้านค้า)
   - dealer: เห็นเฉพาะยอดของร้านตัวเอง
   - admin: เห็นรวมทุกร้าน + ยอด "ไม่ระบุร้าน"
   ============================================================= */

export type SsSource = "rudy" | "ba";

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

/** 1 job — แสดงชื่อลูกค้าทั้ง BA (customer_name) และ LHS/Rudy (project_name) ตามที่ผู้ใช้ยืนยัน */
export interface SsJob {
  source: SsSource;
  closeDate: string | null;
  group3: string;
  subGroup: string | null;
  subSolutionName: string | null;
  solutionName: string | null;
  provinceName: string | null;
  projectNumber: string | null;
  amount: number;
  customerName: string | null;
  typeOfJob: string | null; // 'S' สำรวจ | 'I' ติดตั้ง (เฉพาะ BA)
  salesName: string | null; // ชื่อพนักงานขาย (เฉพาะ LHS/Rudy: project_created_name_des)
}

/** ยอดแยกตามแหล่งข้อมูล (rudy/ba) */
export interface SsSourceAmount {
  source: SsSource;
  amount: number;
  jobCount: number;
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, SsSummary>();
const listeners = new Set<() => void>();
function keyOf(dealerCode: string | null, source: SsSource | null): string {
  return (dealerCode || "__all__") + "|" + (source ?? "__both__");
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
export function getCachedServiceSalesSummary(dealerCode: string | null, source: SsSource | null = null): SsSummary | null {
  return summaryCache.get(keyOf(dealerCode, source)) ?? null;
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
export async function fetchServiceSalesSummary(dealerCode: string | null, source: SsSource | null = null): Promise<SsSummary> {
  const params = new URLSearchParams();
  if (dealerCode) params.set("dealerCode", dealerCode);
  if (source) params.set("source", source);
  const qs = params.toString();
  const res = await fetch(`/api/service-sales${qs ? `?${qs}` : ""}`, { method: "GET", cache: "no-store" });
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
    summaryCache.set(keyOf(dealerCode, source), summary);
    emit();
  }
  return summary;
}

export async function fetchServiceSalesGroups(
  dealerCode: string | null,
  year: string | null,
  source: SsSource | null = null
): Promise<SsGroup[]> {
  const params = new URLSearchParams({ mode: "groups" });
  if (dealerCode) params.set("dealerCode", dealerCode);
  if (year) params.set("year", year);
  if (source) params.set("source", source);
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

export async function fetchServiceSalesMonths(
  dealerCode: string | null,
  year: string | null,
  source: SsSource | null = null
): Promise<SsMonthDetail[]> {
  const params = new URLSearchParams({ mode: "months" });
  if (dealerCode) params.set("dealerCode", dealerCode);
  if (year) params.set("year", year);
  if (source) params.set("source", source);
  const res = await fetch(`/api/service-sales?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; months?: RawMonthDetail[] };
  return raw.ok && Array.isArray(raw.months) ? raw.months.map(mapMonthDetail) : [];
}

type RawJob = {
  source: SsSource;
  close_date: string | null;
  group3: string;
  sub_group: string | null;
  sub_solution_name: string | null;
  solution_name: string | null;
  province_name: string | null;
  project_number: string | null;
  amount_incl_vat: number | string;
  customer_name: string | null;
  type_of_job: string | null;
  sales_name: string | null;
};
function mapJob(r: RawJob): SsJob {
  return {
    source: r.source,
    closeDate: r.close_date,
    group3: r.group3,
    subGroup: r.sub_group,
    subSolutionName: r.sub_solution_name,
    solutionName: r.solution_name,
    provinceName: r.province_name,
    projectNumber: r.project_number,
    amount: Number(r.amount_incl_vat ?? 0),
    customerName: r.customer_name,
    typeOfJob: r.type_of_job,
    salesName: r.sales_name,
  };
}

export async function fetchServiceSalesJobs(
  dealerCode: string | null,
  period: string,
  group: string | null,
  source: SsSource | null = null
): Promise<SsJob[]> {
  const params = new URLSearchParams({ mode: "jobs", period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  if (group) params.set("group", group);
  if (source) params.set("source", source);
  const res = await fetch(`/api/service-sales?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; jobs?: RawJob[] };
  return raw.ok && Array.isArray(raw.jobs) ? raw.jobs.map(mapJob) : [];
}

type RawSource = { source: SsSource; amount: number | string; job_count: number | string };
function mapSource(r: RawSource): SsSourceAmount {
  return { source: r.source, amount: Number(r.amount ?? 0), jobCount: Number(r.job_count ?? 0) };
}

/** ยอดแยกตามแหล่ง (rudy/ba) ของปีที่เลือก — ใช้โชว์การ์ดย่อย "ยอดขาย LHS/Rudy" / "ยอดขาย BA" */
export async function fetchServiceSalesSources(dealerCode: string | null, year: string | null): Promise<SsSourceAmount[]> {
  const params = new URLSearchParams({ mode: "sources" });
  if (dealerCode) params.set("dealerCode", dealerCode);
  if (year) params.set("year", year);
  const res = await fetch(`/api/service-sales?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; sources?: RawSource[] };
  return raw.ok && Array.isArray(raw.sources) ? raw.sources.map(mapSource) : [];
}
