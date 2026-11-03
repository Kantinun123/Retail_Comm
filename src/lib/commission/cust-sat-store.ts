"use client";

/* =============================================================
   ความพึงพอใจของลูกค้า (Cust. Sat.) — client data layer
   อ่านผ่าน /api/cust-sat ; แสดงเฉพาะร้านที่มีข้อมูล (dealer scope)
   ============================================================= */

export interface CsMonth {
  period: string;        // 'YYYY-MM'
  pct: number;           // 0..1 (เฉลี่ยเดือนนั้น)
  overall: number;       // เฉลี่ย 0-10
  reviewCount: number;
}

export interface CsSummary {
  ok: boolean;
  count: number;         // จำนวนรีวิวทั้งหมด
  avgPct: number;        // 0..1
  months: CsMonth[];
  error?: string;
}

/** คะแนนย่อย 6 ด้าน (เฉลี่ยของเดือน) */
export interface CsCategory {
  key: string;
  label: string;
  score: number;         // 0-10
}

export interface CsAgg {
  period: string;
  reviewCount: number;
  pct: number;
  overall: number;
  categories: CsCategory[];
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, CsSummary>();
const listeners = new Set<() => void>();
function keyOf(dealerCode: string | null): string {
  return dealerCode || "__all__";
}
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeCustSat(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getCachedCustSatSummary(dealerCode: string | null): CsSummary | null {
  return summaryCache.get(keyOf(dealerCode)) ?? null;
}

/* ---------------- map helpers ---------------- */
type RawMonth = { period: string; pct: number | string; overall: number | string; review_count: number | string };
function mapMonth(r: RawMonth): CsMonth {
  return {
    period: r.period,
    pct: Number(r.pct ?? 0),
    overall: Number(r.overall ?? 0),
    reviewCount: Number(r.review_count ?? 0),
  };
}

type RawAgg = {
  period: string;
  review_count: number | string;
  pct: number | string;
  overall: number | string;
  q_welcome: number | string;
  q_recommend: number | string;
  q_inform: number | string;
  q_ontime: number | string;
  q_estimate: number | string;
  q_refer: number | string;
} | null;
function mapAgg(r: RawAgg): CsAgg | null {
  if (!r) return null;
  const n = (v: number | string) => Number(v ?? 0);
  return {
    period: r.period,
    reviewCount: n(r.review_count),
    pct: n(r.pct),
    overall: n(r.overall),
    categories: [
      { key: "welcome", label: "ต้อนรับดูแล เอาใจใส่", score: n(r.q_welcome) },
      { key: "recommend", label: "แนะนำสินค้า/บริการ ตรงความต้องการ", score: n(r.q_recommend) },
      { key: "inform", label: "แจ้งระยะเวลา/ขั้นตอนชัดเจน", score: n(r.q_inform) },
      { key: "ontime", label: "ได้รับบริการตรงเวลาที่แจ้ง", score: n(r.q_ontime) },
      { key: "estimate", label: "ระยะเวลาถอดแบบ/ประมาณการ", score: n(r.q_estimate) },
      { key: "refer", label: "พร้อมแนะนำบอกต่อ", score: n(r.q_refer) },
    ],
  };
}

/* ---------------- API calls ---------------- */
export async function fetchCustSatSummary(dealerCode: string | null): Promise<CsSummary> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/cust-sat${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    count?: number | string;
    avg_pct?: number | string;
    months?: RawMonth[];
    error?: string;
  };
  const summary: CsSummary = {
    ok: !!raw.ok,
    count: Number(raw.count ?? 0),
    avgPct: Number(raw.avg_pct ?? 0),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode), summary);
    emit();
  }
  return summary;
}

export async function fetchCustSatMonthAgg(dealerCode: string | null, period: string): Promise<CsAgg | null> {
  const params = new URLSearchParams({ period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  const res = await fetch(`/api/cust-sat?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; agg?: RawAgg };
  return raw.ok ? mapAgg(raw.agg ?? null) : null;
}
