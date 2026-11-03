"use client";

/* =============================================================
   ผลตรวจประเมินร้านค้า — client data layer
   อ่านผ่าน /api/store-eval ; แสดงเฉพาะร้านที่มีผลตรวจ (dealer scope)
   ============================================================= */

export interface EvalMonth {
  period: string;            // 'YYYY-MM' (เดือนที่ตรวจ)
  evalDate: string | null;   // วันที่ตรวจ
  result: string | null;     // 'ผ่าน' / 'ไม่ผ่าน'
  pct: number;               // 0..1
  totalScore: number;
  maxScore: number;
  inspector: string | null;
  region: string | null;
}

export interface EvalLatest {
  period: string;
  evalDate: string | null;
  result: string | null;
  pct: number;
  totalScore: number;
  maxScore: number;
  inspector: string | null;
}

export interface EvalSummary {
  ok: boolean;
  count: number;             // จำนวนครั้งที่ตรวจ
  avgPct: number;            // 0..1
  passCount: number;
  latest: EvalLatest | null;
  months: EvalMonth[];
  error?: string;
}

/** 6 หมวดคะแนน */
export interface EvalCategory {
  key: string;
  label: string;
  score: number;
  max: number;
}

export interface EvalLine {
  submissionId: string | null;
  dealerCode: string;
  dealerName: string | null;
  region: string | null;
  evalDate: string | null;
  inspector: string | null;
  result: string | null;
  totalScore: number;
  maxScore: number;
  pct: number;
  categories: EvalCategory[];
}

/** ข้อย่อยของการตรวจ 1 ครั้ง */
export interface EvalItem {
  categoryKey: string;
  itemNo: number;
  itemLabel: string;
  passed: boolean;
}

/** สรุปข้อที่ตกบ่อยของร้าน */
export interface EvalFail {
  categoryKey: string;
  itemLabel: string;
  failCount: number;
  totalCount: number;
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, EvalSummary>();
const listeners = new Set<() => void>();
function keyOf(dealerCode: string | null): string {
  return dealerCode || "__all__";
}
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeEval(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getCachedEvalSummary(dealerCode: string | null): EvalSummary | null {
  return summaryCache.get(keyOf(dealerCode)) ?? null;
}

/* ---------------- map helpers ---------------- */
type RawMonth = {
  period: string;
  eval_date: string | null;
  result: string | null;
  pct: number | string;
  total_score: number | string;
  max_score: number | string;
  inspector: string | null;
  region: string | null;
};
function mapMonth(r: RawMonth): EvalMonth {
  return {
    period: r.period,
    evalDate: r.eval_date,
    result: r.result,
    pct: Number(r.pct ?? 0),
    totalScore: Number(r.total_score ?? 0),
    maxScore: Number(r.max_score ?? 0),
    inspector: r.inspector,
    region: r.region,
  };
}

type RawLatest = {
  period: string;
  eval_date: string | null;
  result: string | null;
  pct: number | string;
  total_score: number | string;
  max_score: number | string;
  inspector: string | null;
} | null;
function mapLatest(r: RawLatest): EvalLatest | null {
  if (!r) return null;
  return {
    period: r.period,
    evalDate: r.eval_date,
    result: r.result,
    pct: Number(r.pct ?? 0),
    totalScore: Number(r.total_score ?? 0),
    maxScore: Number(r.max_score ?? 0),
    inspector: r.inspector,
  };
}

type RawLine = {
  submission_id: string | null;
  dealer_code: string;
  dealer_name: string | null;
  region: string | null;
  eval_date: string | null;
  inspector: string | null;
  result: string | null;
  total_score: number | string;
  max_score: number | string;
  pct: number | string;
  s1_sign: number | string; s1_sign_max: number | string;
  s2_booth: number | string; s2_booth_max: number | string;
  s3_counter: number | string; s3_counter_max: number | string;
  s4_staff: number | string; s4_staff_max: number | string;
  s5_estimate: number | string; s5_estimate_max: number | string;
  s6_sales: number | string; s6_sales_max: number | string;
};
function mapLine(r: RawLine): EvalLine {
  const n = (v: number | string) => Number(v ?? 0);
  return {
    submissionId: r.submission_id,
    dealerCode: r.dealer_code,
    dealerName: r.dealer_name,
    region: r.region,
    evalDate: r.eval_date,
    inspector: r.inspector,
    result: r.result,
    totalScore: n(r.total_score),
    maxScore: n(r.max_score),
    pct: n(r.pct),
    // key ตรงกับ category_key ใน store_eval_items (เพื่อ match ข้อย่อย)
    categories: [
      { key: "s1_sign", label: "ป้าย Housing Expert นอกร้าน", score: n(r.s1_sign), max: n(r.s1_sign_max) },
      { key: "s2_booth", label: "Booth & Display", score: n(r.s2_booth), max: n(r.s2_booth_max) },
      { key: "s3_counter", label: "หน้าเคาน์เตอร์ให้บริการ", score: n(r.s3_counter), max: n(r.s3_counter_max) },
      { key: "s4_staff", label: "ความพร้อมของพนักงาน", score: n(r.s4_staff), max: n(r.s4_staff_max) },
      { key: "s5_estimate", label: "ทักษะพนักงานออกแบบประมาณการ", score: n(r.s5_estimate), max: n(r.s5_estimate_max) },
      { key: "s6_sales", label: "ทักษะพนักงานขาย", score: n(r.s6_sales), max: n(r.s6_sales_max) },
    ],
  };
}

/* ---------------- API calls ---------------- */
export async function fetchEvalSummary(dealerCode: string | null): Promise<EvalSummary> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/store-eval${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    count?: number | string;
    avg_pct?: number | string;
    pass_count?: number | string;
    latest?: RawLatest;
    months?: RawMonth[];
    error?: string;
  };
  const summary: EvalSummary = {
    ok: !!raw.ok,
    count: Number(raw.count ?? 0),
    avgPct: Number(raw.avg_pct ?? 0),
    passCount: Number(raw.pass_count ?? 0),
    latest: mapLatest(raw.latest ?? null),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode), summary);
    emit();
  }
  return summary;
}

export async function fetchEvalMonthLines(dealerCode: string | null, period: string): Promise<EvalLine[]> {
  const params = new URLSearchParams({ period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  const res = await fetch(`/api/store-eval?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; lines?: RawLine[] };
  return raw.ok && Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [];
}

type RawItem = { category_key: string; item_no: number | string; item_label: string; passed: boolean };
function mapItem(r: RawItem): EvalItem {
  return {
    categoryKey: r.category_key,
    itemNo: Number(r.item_no ?? 0),
    itemLabel: r.item_label,
    passed: !!r.passed,
  };
}

/** ข้อย่อยของการตรวจ 1 ครั้ง (ระบุด้วย submission_id) */
export async function fetchEvalItems(submissionId: string): Promise<EvalItem[]> {
  const res = await fetch(`/api/store-eval?submission=${encodeURIComponent(submissionId)}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; items?: RawItem[] };
  return raw.ok && Array.isArray(raw.items) ? raw.items.map(mapItem) : [];
}

type RawFail = { category_key: string; item_label: string; fail_count: number | string; total_count: number | string };
function mapFail(r: RawFail): EvalFail {
  return {
    categoryKey: r.category_key,
    itemLabel: r.item_label,
    failCount: Number(r.fail_count ?? 0),
    totalCount: Number(r.total_count ?? 0),
  };
}

/** สรุปข้อที่ร้านตกบ่อยสุด (รวมทุกครั้งที่ตรวจ) */
export async function fetchEvalFailSummary(dealerCode: string | null): Promise<EvalFail[]> {
  const q = dealerCode ? `&dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/store-eval?mode=fails${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; fails?: RawFail[] };
  return raw.ok && Array.isArray(raw.fails) ? raw.fails.map(mapFail) : [];
}
