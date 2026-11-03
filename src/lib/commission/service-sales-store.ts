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
