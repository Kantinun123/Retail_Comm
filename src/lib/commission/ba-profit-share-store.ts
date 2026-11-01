"use client";

/* =============================================================
   BA Profit Share — client data layer (ผลประโยชน์ร้านค้า Q-CHANG BA)

   แนวทาง B (server-authoritative): อ่านผ่าน /api/ba-profit-share
   - fetchProfitShareSummary(dealerCode): สรุปต่อเดือน
   - fetchProfitShareMonthLines(dealerCode, period): รายบรรทัด (drill-down)
   แสดงเฉพาะแถวที่ map ร้านเจอ
   ============================================================= */

export interface ProfitShareMonth {
  period: string;
  profitShare: number;
  margin: number;
  lineCount: number;
  paidDate: string | null;
}

export interface ProfitShareSummary {
  ok: boolean;
  totalProfitShare: number;
  totalMargin: number;
  months: ProfitShareMonth[];
  error?: string;
}

export interface ProfitShareLine {
  dealerCode: string;
  dealerName: string | null;
  channelName: string | null;
  storeName: string | null;
  storeModel: string | null;
  saleOrderNo: string | null;
  customerName: string | null;
  jobCode: string | null;
  jobType: string | null;
  worktypeName: string | null;
  productName: string | null;
  skuName: string | null;
  jobStatus: string | null;
  paymentDate: string | null;
  customerAcceptedDate: string | null;
  actualPaid: number | null;
  joAmount: number | null;
  margin: number | null;
  profitShareRate: number | null;
  profitShareAmount: number;
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, ProfitShareSummary>();
const listeners = new Set<() => void>();

function keyOf(dealerCode: string | null): string {
  return dealerCode || "__all__";
}
function emit() {
  listeners.forEach((l) => l());
}

export function subscribeProfitShare(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCachedProfitShareSummary(dealerCode: string | null): ProfitShareSummary | null {
  return summaryCache.get(keyOf(dealerCode)) ?? null;
}

/* ---------------- map helpers (snake -> camel) ---------------- */
type RawMonth = {
  period: string;
  profit_share: number | string;
  margin: number | string;
  line_count: number | string;
  paid_date: string | null;
};

function mapMonth(r: RawMonth): ProfitShareMonth {
  return {
    period: r.period,
    profitShare: Number(r.profit_share ?? 0),
    margin: Number(r.margin ?? 0),
    lineCount: Number(r.line_count ?? 0),
    paidDate: r.paid_date,
  };
}

type RawLine = {
  dealer_code: string;
  dealer_name: string | null;
  channel_name: string | null;
  store_name: string | null;
  store_model: string | null;
  sale_order_no: string | null;
  customer_name: string | null;
  job_code: string | null;
  job_type: string | null;
  worktype_name: string | null;
  product_name: string | null;
  sku_name: string | null;
  job_status: string | null;
  payment_date: string | null;
  customer_accepted_date: string | null;
  actual_paid: number | string | null;
  jo_amount: number | string | null;
  margin: number | string | null;
  profit_share_rate: number | string | null;
  profit_share_amount: number | string;
};

function mapLine(r: RawLine): ProfitShareLine {
  return {
    dealerCode: r.dealer_code,
    dealerName: r.dealer_name,
    channelName: r.channel_name,
    storeName: r.store_name,
    storeModel: r.store_model,
    saleOrderNo: r.sale_order_no,
    customerName: r.customer_name,
    jobCode: r.job_code,
    jobType: r.job_type,
    worktypeName: r.worktype_name,
    productName: r.product_name,
    skuName: r.sku_name,
    jobStatus: r.job_status,
    paymentDate: r.payment_date,
    customerAcceptedDate: r.customer_accepted_date,
    actualPaid: r.actual_paid === null ? null : Number(r.actual_paid),
    joAmount: r.jo_amount === null ? null : Number(r.jo_amount),
    margin: r.margin === null ? null : Number(r.margin),
    profitShareRate: r.profit_share_rate === null ? null : Number(r.profit_share_rate),
    profitShareAmount: Number(r.profit_share_amount ?? 0),
  };
}

/* ---------------- API calls ---------------- */

export async function fetchProfitShareSummary(dealerCode: string | null): Promise<ProfitShareSummary> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/ba-profit-share${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    total_profit_share?: number | string;
    total_margin?: number | string;
    months?: RawMonth[];
    error?: string;
  };
  const summary: ProfitShareSummary = {
    ok: !!raw.ok,
    totalProfitShare: Number(raw.total_profit_share ?? 0),
    totalMargin: Number(raw.total_margin ?? 0),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode), summary);
    emit();
  }
  return summary;
}

export async function fetchProfitShareMonthLines(
  dealerCode: string | null,
  period: string
): Promise<ProfitShareLine[]> {
  const params = new URLSearchParams({ period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  const res = await fetch(`/api/ba-profit-share?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const raw = (await res.json()) as { ok?: boolean; lines?: RawLine[] };
  return raw.ok && Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [];
}
