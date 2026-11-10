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
  improveCount: number;  // จำนวนรีวิวที่มีข้อเสนอให้แก้ไขในเดือนนั้น
  lowCount: number;      // จำนวนรีวิวที่มีด้านใดได้คะแนน < 7
}

export interface CsInsight {
  label: string;
  n: number;
}

export interface CsSummary {
  ok: boolean;
  count: number;         // จำนวนรีวิวทั้งหมด
  avgPct: number;        // 0..1
  improveTotal: number;  // จำนวนคอมเมนต์ที่ขอให้ปรับปรุงทั้งหมด
  insightTotal: number;  // คอมเมนต์ปรับปรุงเฉพาะรีวิวที่มีด้านใด < 7 (ฐานของ insight)
  insight: CsInsight[];  // จัดกลุ่มประเด็นปรับปรุงที่พบบ่อย (จากรีวิวที่มีด้าน < 7)
  months: CsMonth[];
  error?: string;
}

/** รีวิวรายรายการ (ตัด PII แล้ว) */
export interface CsReview {
  evalDate: string | null;
  overall: number;
  pct: number;
  product: string | null;
  purpose: string | null;
  useEstimate: string | null;
  impress: string | null;
  improve: string | null;
  lowCats: string[];   // ด้านที่คะแนน < 7 (label)
}

/** label 6 ด้าน (ใช้ร่วมกันทั้ง agg และ review) */
export const CS_CATEGORY_LABELS: { key: string; label: string }[] = [
  { key: "welcome", label: "ต้อนรับดูแล เอาใจใส่" },
  { key: "recommend", label: "แนะนำสินค้า/บริการ ตรงความต้องการ" },
  { key: "inform", label: "แจ้งระยะเวลา/ขั้นตอนชัดเจน" },
  { key: "ontime", label: "ได้รับบริการตรงเวลาที่แจ้ง" },
  { key: "estimate", label: "ระยะเวลาถอดแบบ/ประมาณการ" },
  { key: "refer", label: "พร้อมแนะนำบอกต่อ" },
];

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
type RawMonth = { period: string; pct: number | string; overall: number | string; review_count: number | string; improve_count?: number | string; low_count?: number | string };
function mapMonth(r: RawMonth): CsMonth {
  return {
    period: r.period,
    pct: Number(r.pct ?? 0),
    overall: Number(r.overall ?? 0),
    reviewCount: Number(r.review_count ?? 0),
    improveCount: Number(r.improve_count ?? 0),
    lowCount: Number(r.low_count ?? 0),
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
      { key: "welcome", label: CS_CATEGORY_LABELS[0].label, score: n(r.q_welcome) },
      { key: "recommend", label: CS_CATEGORY_LABELS[1].label, score: n(r.q_recommend) },
      { key: "inform", label: CS_CATEGORY_LABELS[2].label, score: n(r.q_inform) },
      { key: "ontime", label: CS_CATEGORY_LABELS[3].label, score: n(r.q_ontime) },
      { key: "estimate", label: CS_CATEGORY_LABELS[4].label, score: n(r.q_estimate) },
      { key: "refer", label: CS_CATEGORY_LABELS[5].label, score: n(r.q_refer) },
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
    improve_total?: number | string;
    insight_total?: number | string;
    insight?: { label: string; n: number | string }[];
    months?: RawMonth[];
    error?: string;
  };
  const summary: CsSummary = {
    ok: !!raw.ok,
    count: Number(raw.count ?? 0),
    avgPct: Number(raw.avg_pct ?? 0),
    improveTotal: Number(raw.improve_total ?? 0),
    insightTotal: Number(raw.insight_total ?? 0),
    insight: Array.isArray(raw.insight) ? raw.insight.map((i) => ({ label: i.label, n: Number(i.n ?? 0) })) : [],
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

type RawReview = {
  eval_date: string | null;
  overall: number | string;
  pct: number | string;
  product: string | null;
  purpose: string | null;
  use_estimate: string | null;
  impress_text: string | null;
  improve_text: string | null;
  q_welcome?: number | string | null;
  q_recommend?: number | string | null;
  q_inform?: number | string | null;
  q_ontime?: number | string | null;
  q_estimate?: number | string | null;
  q_refer?: number | string | null;
};
function mapReview(r: RawReview): CsReview {
  const cats: (number | string | null | undefined)[] = [
    r.q_welcome, r.q_recommend, r.q_inform, r.q_ontime, r.q_estimate, r.q_refer,
  ];
  const lowCats: string[] = [];
  cats.forEach((v, i) => {
    if (v != null && v !== "" && Number(v) < 7) lowCats.push(CS_CATEGORY_LABELS[i].label);
  });
  return {
    evalDate: r.eval_date,
    overall: Number(r.overall ?? 0),
    pct: Number(r.pct ?? 0),
    product: r.product,
    purpose: r.purpose,
    useEstimate: r.use_estimate,
    impress: r.impress_text,
    improve: r.improve_text,
    lowCats,
  };
}

export async function fetchCustSatReviews(dealerCode: string | null, period: string): Promise<CsReview[]> {
  const params = new URLSearchParams({ period, mode: "reviews" });
  if (dealerCode) params.set("dealerCode", dealerCode);
  const res = await fetch(`/api/cust-sat?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; reviews?: RawReview[] };
  return raw.ok && Array.isArray(raw.reviews) ? raw.reviews.map(mapReview) : [];
}
