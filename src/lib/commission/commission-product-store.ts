"use client";

/* =============================================================
   Commission Product — client data layer (ฝั่งพนักงาน/vendor)

   แนวทาง B (server-authoritative): อ่านผ่าน /api/commission-product
   - fetchCommissionSummary(dealerCode): สรุปต่อเดือน
   - fetchCommissionMonthLines(dealerCode, period): รายบรรทัด (drill-down)
   cache + pub/sub ต่อ dealerCode (null = ทุกร้าน -> key "__all__")
   ============================================================= */

export interface CommissionMonth {
  period: string;          // 'YYYY-MM' (เดือนขาย)
  gross: number;           // commission ก่อนหัก
  net: number;             // หัก 3% แล้ว
  netSales: number;        // ยอดขายฐาน
  lineCount: number;
  vendorCount: number;
  paidDate: string | null; // วันที่ทำจ่าย (จาก payouts)
}

export interface CommissionSummary {
  ok: boolean;
  totalGross: number;
  totalNet: number;
  months: CommissionMonth[];
  error?: string;
}

export interface CommissionLine {
  vendorCode: string | null;
  vendorName: string | null;
  dealerCode: string;
  dealerName: string | null;
  docNo: string | null;
  salesDate: string | null;
  custName: string | null;
  itemName: string | null;
  qty: number | null;
  netAmount: number;
  gross: number;
  net: number;
  saleName: string | null;
  productGroup: string | null;
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, CommissionSummary>();
const listeners = new Set<() => void>();

function keyOf(dealerCode: string | null): string {
  return dealerCode || "__all__";
}
function emit() {
  listeners.forEach((l) => l());
}

export function subscribeCommission(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCachedCommissionSummary(dealerCode: string | null): CommissionSummary | null {
  return summaryCache.get(keyOf(dealerCode)) ?? null;
}

/* ---------------- map helpers (snake -> camel) ---------------- */
type RawMonth = {
  period: string;
  gross: number | string;
  net: number | string;
  net_sales: number | string;
  line_count: number | string;
  vendor_count: number | string;
  paid_date: string | null;
};

function mapMonth(r: RawMonth): CommissionMonth {
  return {
    period: r.period,
    gross: Number(r.gross ?? 0),
    net: Number(r.net ?? 0),
    netSales: Number(r.net_sales ?? 0),
    lineCount: Number(r.line_count ?? 0),
    vendorCount: Number(r.vendor_count ?? 0),
    paidDate: r.paid_date,
  };
}

type RawLine = {
  vendor_code: string | null;
  vendor_name: string | null;
  dealer_code: string;
  dealer_name: string | null;
  doc_no: string | null;
  sales_date: string | null;
  cust_name: string | null;
  item_name: string | null;
  qty: number | string | null;
  net_amount: number | string;
  commission_gross: number | string;
  commission_net: number | string;
  sale_name: string | null;
  product_group: string | null;
};

function mapLine(r: RawLine): CommissionLine {
  return {
    vendorCode: r.vendor_code,
    vendorName: r.vendor_name,
    dealerCode: r.dealer_code,
    dealerName: r.dealer_name,
    docNo: r.doc_no,
    salesDate: r.sales_date,
    custName: r.cust_name,
    itemName: r.item_name,
    qty: r.qty === null || r.qty === undefined ? null : Number(r.qty),
    netAmount: Number(r.net_amount ?? 0),
    gross: Number(r.commission_gross ?? 0),
    net: Number(r.commission_net ?? 0),
    saleName: r.sale_name,
    productGroup: r.product_group,
  };
}

/* ---------------- API calls ---------------- */

export async function fetchCommissionSummary(
  dealerCode: string | null
): Promise<CommissionSummary> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/commission-product${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    total_gross?: number | string;
    total_net?: number | string;
    months?: RawMonth[];
    error?: string;
  };
  const summary: CommissionSummary = {
    ok: !!raw.ok,
    totalGross: Number(raw.total_gross ?? 0),
    totalNet: Number(raw.total_net ?? 0),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode), summary);
    emit();
  }
  return summary;
}

export async function fetchCommissionMonthLines(
  dealerCode: string | null,
  period: string
): Promise<CommissionLine[]> {
  const params = new URLSearchParams({ period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  const res = await fetch(`/api/commission-product?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const raw = (await res.json()) as { ok?: boolean; lines?: RawLine[] };
  return raw.ok && Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [];
}
