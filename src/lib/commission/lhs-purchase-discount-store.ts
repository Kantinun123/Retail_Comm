"use client";

/* =============================================================
   LHS Purchase Discount — client data layer (ส่วนลดซื้อ 7% Housing Expert, Roof)
   อ่านผ่าน /api/lhs-purchase-discount ; แสดงเฉพาะร้านที่ map เจอ
   ============================================================= */

export interface PdMonth {
  period: string;
  discount: number;
  sales: number;
  lineCount: number;
}

export interface PdSummary {
  ok: boolean;
  totalDiscount: number;
  totalSales: number;
  months: PdMonth[];
  error?: string;
}

export interface PdLine {
  dealerCode: string;
  dealerName: string | null;
  shopGroup: string | null;
  orderNumber: string | null;
  projectName: string | null;
  solutionName: string | null;
  subSolutionName: string | null;
  subMerCate: string | null;
  serviceTypeName: string | null;
  customerName: string | null;
  provinceName: string | null;
  projectCloseDate: string | null;
  planAmountInclVat: number;
  salesExclVat: number;
  discountAmount: number;
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, PdSummary>();
const listeners = new Set<() => void>();
function keyOf(dealerCode: string | null): string {
  return dealerCode || "__all__";
}
function emit() {
  listeners.forEach((l) => l());
}
export function subscribePd(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getCachedPdSummary(dealerCode: string | null): PdSummary | null {
  return summaryCache.get(keyOf(dealerCode)) ?? null;
}

/* ---------------- map helpers ---------------- */
type RawMonth = { period: string; discount: number | string; sales: number | string; line_count: number | string };
function mapMonth(r: RawMonth): PdMonth {
  return {
    period: r.period,
    discount: Number(r.discount ?? 0),
    sales: Number(r.sales ?? 0),
    lineCount: Number(r.line_count ?? 0),
  };
}

type RawLine = {
  dealer_code: string;
  dealer_name: string | null;
  shop_group: string | null;
  order_number: string | null;
  project_name: string | null;
  solution_name: string | null;
  sub_solution_name: string | null;
  sub_mer_cate: string | null;
  service_type_name: string | null;
  customer_name: string | null;
  province_name: string | null;
  project_close_date: string | null;
  plan_amount_incl_vat: number | string;
  sales_excl_vat: number | string;
  discount_amount: number | string;
};
function mapLine(r: RawLine): PdLine {
  return {
    dealerCode: r.dealer_code,
    dealerName: r.dealer_name,
    shopGroup: r.shop_group,
    orderNumber: r.order_number,
    projectName: r.project_name,
    solutionName: r.solution_name,
    subSolutionName: r.sub_solution_name,
    subMerCate: r.sub_mer_cate,
    serviceTypeName: r.service_type_name,
    customerName: r.customer_name,
    provinceName: r.province_name,
    projectCloseDate: r.project_close_date,
    planAmountInclVat: Number(r.plan_amount_incl_vat ?? 0),
    salesExclVat: Number(r.sales_excl_vat ?? 0),
    discountAmount: Number(r.discount_amount ?? 0),
  };
}

/* ---------------- API calls ---------------- */
export async function fetchPdSummary(dealerCode: string | null): Promise<PdSummary> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/lhs-purchase-discount${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    total_discount?: number | string;
    total_sales?: number | string;
    months?: RawMonth[];
    error?: string;
  };
  const summary: PdSummary = {
    ok: !!raw.ok,
    totalDiscount: Number(raw.total_discount ?? 0),
    totalSales: Number(raw.total_sales ?? 0),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode), summary);
    emit();
  }
  return summary;
}

export async function fetchPdMonthLines(dealerCode: string | null, period: string): Promise<PdLine[]> {
  const params = new URLSearchParams({ period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  const res = await fetch(`/api/lhs-purchase-discount?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; lines?: RawLine[] };
  return raw.ok && Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [];
}
