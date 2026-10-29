"use client";

/* =============================================================
   Back margin — client data layer (ฝั่งร้านค้า)

   แนวทาง B (server-authoritative): อ่านผ่าน /api/back-margin
   - fetchBackMarginSummary(dealerCode): สรุปต่อเดือน
   - fetchBackMarginMonthLines(dealerCode, period): รายบรรทัด (drill-down)
   cache + pub/sub ต่อ dealerCode (null = ทุกร้าน -> key "__all__")
   ============================================================= */

export interface BackMarginMonth {
  period: string;          // 'YYYY-MM' (เดือนขาย)
  lineTotal: number;       // ยอด back margin จากรายบรรทัด
  payoutTotal: number | null; // ยอดจ่ายจริง (จาก data22) — null ถ้าไม่มี
  paidDate: string | null; // วันที่ทำจ่าย
  netSales: number;        // ยอดขายฐาน
  jobCount: number;        // จำนวน job
}

export interface BackMarginSummary {
  ok: boolean;
  totalLines: number;
  totalPayout: number;
  months: BackMarginMonth[];
  error?: string;
}

export interface BackMarginLine {
  dealerCode: string;
  dealerName: string | null;
  docNo: string | null;
  salesDate: string | null;
  custName: string | null;
  itemName: string | null;
  qty: number | null;
  netAmount: number;
  backMargin: number;
  saleName: string | null;
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, BackMarginSummary>();
const listeners = new Set<() => void>();

function keyOf(dealerCode: string | null): string {
  return dealerCode || "__all__";
}
function emit() {
  listeners.forEach((l) => l());
}

export function subscribeBackMargin(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCachedSummary(dealerCode: string | null): BackMarginSummary | null {
  return summaryCache.get(keyOf(dealerCode)) ?? null;
}

/* ---------------- map helpers (snake -> camel) ---------------- */
type RawMonth = {
  period: string;
  line_total: number | string;
  payout_total: number | string | null;
  paid_date: string | null;
  net_sales: number | string;
  job_count: number | string;
};

function mapMonth(r: RawMonth): BackMarginMonth {
  return {
    period: r.period,
    lineTotal: Number(r.line_total ?? 0),
    payoutTotal: r.payout_total === null || r.payout_total === undefined ? null : Number(r.payout_total),
    paidDate: r.paid_date,
    netSales: Number(r.net_sales ?? 0),
    jobCount: Number(r.job_count ?? 0),
  };
}

type RawLine = {
  dealer_code: string;
  dealer_name: string | null;
  doc_no: string | null;
  sales_date: string | null;
  cust_name: string | null;
  item_name: string | null;
  qty: number | string | null;
  champ_net_amount: number | string;
  total_back_margin: number | string;
  sale_name: string | null;
};

function mapLine(r: RawLine): BackMarginLine {
  return {
    dealerCode: r.dealer_code,
    dealerName: r.dealer_name,
    docNo: r.doc_no,
    salesDate: r.sales_date,
    custName: r.cust_name,
    itemName: r.item_name,
    qty: r.qty === null || r.qty === undefined ? null : Number(r.qty),
    netAmount: Number(r.champ_net_amount ?? 0),
    backMargin: Number(r.total_back_margin ?? 0),
    saleName: r.sale_name,
  };
}

/* ---------------- API calls ---------------- */

/** โหลดสรุป back margin ต่อเดือนของร้าน (dealerCode=null -> ทุกร้าน) */
export async function fetchBackMarginSummary(
  dealerCode: string | null
): Promise<BackMarginSummary> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/back-margin${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    total_lines?: number | string;
    total_payout?: number | string;
    months?: RawMonth[];
    error?: string;
  };
  const summary: BackMarginSummary = {
    ok: !!raw.ok,
    totalLines: Number(raw.total_lines ?? 0),
    totalPayout: Number(raw.total_payout ?? 0),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode), summary);
    emit();
  }
  return summary;
}

/** โหลดรายบรรทัดของเดือนหนึ่ง (drill-down) */
export async function fetchBackMarginMonthLines(
  dealerCode: string | null,
  period: string
): Promise<BackMarginLine[]> {
  const params = new URLSearchParams({ period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  const res = await fetch(`/api/back-margin?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const raw = (await res.json()) as { ok?: boolean; lines?: RawLine[] };
  return raw.ok && Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [];
}
