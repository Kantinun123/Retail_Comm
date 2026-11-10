"use client";

/* =============================================================
   ยอดขายงานบริการ (Service Sales) — client data layer
   อ่านผ่าน /api/service-sales — รวม 2 แหล่ง: 'rudy' (LHS/Rudy) + 'ba' (BA ร้านค้า)
   - dealer: เห็นเฉพาะยอดของร้านตัวเอง (+ แยกรายพนักงาน)
   - พนักงาน: เฉพาะงานที่ตัวเองขาย (repCode)
   - admin: เห็นรวมทุกร้าน + ยอด "ไม่ระบุร้าน" (+ แยกรายร้าน)
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
  total: number;     // ยอดรวมทั้งหมด
  months: SsMonth[];
  latestDate: string | null;
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

/** กลุ่มใต้เดือน (+ หมวดย่อย) */
export type SsMonthGroup = SsGroup;

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
  period: string | null;
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
  salesName: string | null; // LHS/Rudy: ผู้สร้างโครงการ ; BA: พนักงาน BA (จาก BA Incentive)
  repCode: string | null;
}

/** ยอดแยกตามแหล่งข้อมูล (rudy/ba) */
export interface SsSourceAmount {
  source: SsSource;
  amount: number;
  jobCount: number;
}

/** แถวแยกรายพนักงาน (ต่อเดือน × กลุ่ม) */
export interface SsPersonRow {
  period: string;
  group3: string;
  repCode: string | null;
  /** ชื่อในไฟล์ (เฉพาะคนที่ไม่ได้อยู่ในระบบ) */
  salesName: string | null;
  name: string | null;
  nickname: string | null;
  amount: number;
  jobCount: number;
}
/** แถวแยกรายร้าน (ต่อเดือน) — admin ทุกร้าน */
export interface SsStoreRow {
  period: string;
  dealerCode: string | null;
  dealerName: string | null;
  model: string | null;
  amount: number;
  jobCount: number;
}
export interface SsBreakdown {
  people: SsPersonRow[];
  stores: SsStoreRow[];
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, SsSummary>();
const listeners = new Set<() => void>();
function keyOf(dealerCode: string | null, source: SsSource | null, repCode: string | null = null): string {
  return (dealerCode || "__all__") + "|" + (source ?? "__both__") + "|" + (repCode ?? "");
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
export function getCachedServiceSalesSummary(dealerCode: string | null, source: SsSource | null = null, repCode: string | null = null): SsSummary | null {
  return summaryCache.get(keyOf(dealerCode, source, repCode)) ?? null;
}

/* ---------------- map helpers ---------------- */
const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (v == null || v === "" ? null : String(v));

type RawMonth = { period: string; amount: number | string; job_count: number | string };
function mapMonth(r: RawMonth): SsMonth {
  return { period: r.period, amount: num(r.amount), jobCount: num(r.job_count) };
}

type RawSub = { label: string; amount: number | string; job_count: number | string };
type RawGroup = { group3: string; amount: number | string; job_count: number | string; subs?: RawSub[] };
const mapSub = (s: RawSub): SsSubGroup => ({ label: s.label, amount: num(s.amount), jobCount: num(s.job_count) });
function mapGroup(r: RawGroup): SsGroup {
  return { group3: r.group3, amount: num(r.amount), jobCount: num(r.job_count), subs: Array.isArray(r.subs) ? r.subs.map(mapSub) : [] };
}

function qs(base: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(base).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}
async function getJson<T>(q: string): Promise<T> {
  const res = await fetch(`/api/service-sales${q}`, { method: "GET", cache: "no-store" });
  return (await res.json()) as T;
}

/* ---------------- API calls ---------------- */
export async function fetchServiceSalesSummary(
  dealerCode: string | null,
  source: SsSource | null = null,
  repCode: string | null = null
): Promise<SsSummary> {
  const raw = await getJson<{ ok?: boolean; count?: number | string; total?: number | string; months?: RawMonth[]; latest_date?: string | null; error?: string }>(
    qs({ dealerCode, source, repCode })
  );
  const summary: SsSummary = {
    ok: !!raw.ok,
    count: num(raw.count),
    total: num(raw.total),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    latestDate: raw.latest_date ?? null,
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode, source, repCode), summary);
    emit();
  }
  return summary;
}

export async function fetchServiceSalesGroups(
  dealerCode: string | null,
  year: string | null,
  source: SsSource | null = null,
  repCode: string | null = null
): Promise<SsGroup[]> {
  const raw = await getJson<{ ok?: boolean; groups?: RawGroup[] }>(qs({ mode: "groups", dealerCode, year, source, repCode }));
  return raw.ok && Array.isArray(raw.groups) ? raw.groups.map(mapGroup) : [];
}

type RawMonthDetail = { period: string; amount: number | string; job_count: number | string; groups: RawGroup[] };
export async function fetchServiceSalesMonths(
  dealerCode: string | null,
  year: string | null,
  source: SsSource | null = null,
  repCode: string | null = null
): Promise<SsMonthDetail[]> {
  const raw = await getJson<{ ok?: boolean; months?: RawMonthDetail[] }>(qs({ mode: "months", dealerCode, year, source, repCode }));
  return raw.ok && Array.isArray(raw.months)
    ? raw.months.map((r) => ({
        period: r.period,
        amount: num(r.amount),
        jobCount: num(r.job_count),
        groups: Array.isArray(r.groups) ? r.groups.map(mapGroup) : [],
      }))
    : [];
}

export async function fetchServiceSalesBreakdown(
  dealerCode: string | null,
  year: string | null,
  source: SsSource | null = null
): Promise<SsBreakdown> {
  const raw = await getJson<{ ok?: boolean; people?: Record<string, unknown>[]; stores?: Record<string, unknown>[] }>(
    qs({ mode: "breakdown", dealerCode, year, source })
  );
  if (!raw.ok) return { people: [], stores: [] };
  return {
    people: (raw.people ?? []).map((x) => ({
      period: String(x.period),
      group3: String(x.group3 ?? ""),
      repCode: str(x.rep_code),
      salesName: str(x.sales_name),
      name: str(x.name),
      nickname: str(x.nickname),
      amount: num(x.amount),
      jobCount: num(x.job_count),
    })),
    stores: (raw.stores ?? []).map((x) => ({
      period: String(x.period),
      dealerCode: str(x.dealer_code),
      dealerName: str(x.dealer_name),
      model: str(x.model),
      amount: num(x.amount),
      jobCount: num(x.job_count),
    })),
  };
}

type RawJob = {
  source: SsSource;
  period: string | null;
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
  rep_code: string | null;
};
function mapJob(r: RawJob): SsJob {
  return {
    source: r.source,
    period: r.period ?? null,
    closeDate: r.close_date,
    group3: r.group3,
    subGroup: r.sub_group,
    subSolutionName: r.sub_solution_name,
    solutionName: r.solution_name,
    provinceName: r.province_name,
    projectNumber: r.project_number,
    amount: num(r.amount_incl_vat),
    customerName: r.customer_name,
    typeOfJob: r.type_of_job,
    salesName: r.sales_name,
    repCode: r.rep_code ?? null,
  };
}

/** ตัวกรองรายการงาน: เดือน (period) หรือทั้งปี (year) + กลุ่ม/หมวดย่อย/ร้าน/พนักงาน */
export interface SsJobQuery {
  dealerCode?: string | null;
  source?: SsSource | null;
  period?: string | null;
  year?: string | null;
  group?: string | null;
  sub?: string | null;
  repCode?: string | null;
  /** ชื่อในไฟล์ (คนที่ไม่ได้อยู่ในระบบ) — ต้องมี dealerCode */
  sales?: string | null;
  /** งานที่ไม่มีชื่อพนักงาน */
  unassigned?: boolean;
  order?: "amount" | "date";
  offset?: number;
  limit?: number;
}
export interface SsJobsResult {
  jobs: SsJob[];
  total: number;
  totalAmount: number;
  subs: SsSubGroup[];
}

export async function fetchServiceSalesJobs(q: SsJobQuery): Promise<SsJobsResult> {
  const raw = await getJson<{ ok?: boolean; jobs?: RawJob[]; total?: number | string; total_amount?: number | string; subs?: RawSub[] }>(
    qs({
      mode: "jobs",
      dealerCode: q.dealerCode,
      source: q.source,
      period: q.period,
      year: q.period ? null : q.year,
      group: q.group,
      sub: q.sub,
      repCode: q.repCode,
      sales: q.sales,
      unassigned: q.unassigned ? "1" : null,
      order: q.order === "date" ? "date" : null,
      offset: q.offset ? String(q.offset) : null,
      limit: q.limit ? String(q.limit) : null,
    })
  );
  if (!raw.ok) return { jobs: [], total: 0, totalAmount: 0, subs: [] };
  return {
    jobs: Array.isArray(raw.jobs) ? raw.jobs.map(mapJob) : [],
    total: num(raw.total),
    totalAmount: num(raw.total_amount),
    subs: Array.isArray(raw.subs) ? raw.subs.map(mapSub) : [],
  };
}

type RawSource = { source: SsSource; amount: number | string; job_count: number | string };

/** ยอดแยกตามแหล่ง (rudy/ba) ของปีที่เลือก — ใช้โชว์การ์ดย่อย "ยอดขาย LHS/Rudy" / "ยอดขาย BA" */
export async function fetchServiceSalesSources(dealerCode: string | null, year: string | null, repCode: string | null = null): Promise<SsSourceAmount[]> {
  const raw = await getJson<{ ok?: boolean; sources?: RawSource[] }>(qs({ mode: "sources", dealerCode, year, repCode }));
  return raw.ok && Array.isArray(raw.sources)
    ? raw.sources.map((r) => ({ source: r.source, amount: num(r.amount), jobCount: num(r.job_count) }))
    : [];
}

/** ชื่อแสดงของพนักงานในรายการ */
export function ssPersonLabel(p: { repCode: string | null; salesName: string | null; name: string | null; nickname: string | null }): string {
  if (p.repCode) return p.name ? `${p.name}${p.nickname ? ` (${p.nickname})` : ""}` : p.repCode;
  return p.salesName ?? "ไม่ระบุพนักงาน";
}
