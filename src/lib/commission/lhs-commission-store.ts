"use client";

/* =============================================================
   LHS Commission — client data layer (ผลประโยชน์พนักงาน ระบบ Rudy)
   อ่านผ่าน /api/lhs-commission ; แสดงเฉพาะร้านที่ map เจอ
   ============================================================= */

export interface LhsMonth {
  period: string;
  commission: number;
  sales: number;
  payment: number;
  lineCount: number;
  empCount: number;
  paidDate: string | null;
}

export interface LhsSummary {
  ok: boolean;
  totalCommission: number;
  totalSales: number;
  totalPayment: number;
  months: LhsMonth[];
  error?: string;
}

export interface LhsLine {
  dealerCode: string;
  dealerName: string | null;
  shopName: string | null;
  shopGroup: string | null;
  vendorName: string | null;
  vendorCode: string | null;
  orderNumber: string | null;
  subSolutionName: string | null;
  customerName: string | null;
  projectName: string | null;
  status: string | null;
  approveStatus: string | null;
  soCreatedDate: string | null;
  transferDate: string | null;
  soAmount: number;
  commission: number;
  whTax: number;
  payment: number;
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, LhsSummary>();
const listeners = new Set<() => void>();
function keyOf(dealerCode: string | null): string {
  return dealerCode || "__all__";
}
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeLhs(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getCachedLhsSummary(dealerCode: string | null): LhsSummary | null {
  return summaryCache.get(keyOf(dealerCode)) ?? null;
}

/* ---------------- map helpers ---------------- */
type RawMonth = {
  period: string;
  commission: number | string;
  sales: number | string;
  payment: number | string;
  line_count: number | string;
  emp_count: number | string;
  paid_date: string | null;
};
function mapMonth(r: RawMonth): LhsMonth {
  return {
    period: r.period,
    commission: Number(r.commission ?? 0),
    sales: Number(r.sales ?? 0),
    payment: Number(r.payment ?? 0),
    lineCount: Number(r.line_count ?? 0),
    empCount: Number(r.emp_count ?? 0),
    paidDate: r.paid_date,
  };
}

type RawLine = {
  dealer_code: string;
  dealer_name: string | null;
  shop_name: string | null;
  shop_group: string | null;
  vendor_name: string | null;
  vendor_code: string | null;
  order_number: string | null;
  sub_solution_name: string | null;
  customer_name: string | null;
  project_name: string | null;
  status: string | null;
  approve_status: string | null;
  so_created_date: string | null;
  transfer_date: string | null;
  so_amount: number | string;
  commission: number | string;
  wh_tax: number | string;
  payment: number | string;
};
function mapLine(r: RawLine): LhsLine {
  return {
    dealerCode: r.dealer_code,
    dealerName: r.dealer_name,
    shopName: r.shop_name,
    shopGroup: r.shop_group,
    vendorName: r.vendor_name,
    vendorCode: r.vendor_code,
    orderNumber: r.order_number,
    subSolutionName: r.sub_solution_name,
    customerName: r.customer_name,
    projectName: r.project_name,
    status: r.status,
    approveStatus: r.approve_status,
    soCreatedDate: r.so_created_date,
    transferDate: r.transfer_date,
    soAmount: Number(r.so_amount ?? 0),
    commission: Number(r.commission ?? 0),
    whTax: Number(r.wh_tax ?? 0),
    payment: Number(r.payment ?? 0),
  };
}

/* ---------------- API calls ---------------- */
export async function fetchLhsSummary(dealerCode: string | null): Promise<LhsSummary> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/lhs-commission${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    total_commission?: number | string;
    total_sales?: number | string;
    total_payment?: number | string;
    months?: RawMonth[];
    error?: string;
  };
  const summary: LhsSummary = {
    ok: !!raw.ok,
    totalCommission: Number(raw.total_commission ?? 0),
    totalSales: Number(raw.total_sales ?? 0),
    totalPayment: Number(raw.total_payment ?? 0),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode), summary);
    emit();
  }
  return summary;
}

export async function fetchLhsMonthLines(
  dealerCode: string | null,
  period: string
): Promise<LhsLine[]> {
  const params = new URLSearchParams({ period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  const res = await fetch(`/api/lhs-commission?${params.toString()}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; lines?: RawLine[] };
  return raw.ok && Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [];
}
