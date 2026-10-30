"use client";

/* =============================================================
   BA Incentive — client data layer (ค่าคอมมิชชั่นงานบริการ Q-CHANG)

   แนวทาง B (server-authoritative): อ่านผ่าน /api/ba-incentive
   - fetchBaSummary(dealerCode): สรุปต่อเดือน
   - fetchBaMonthLines(dealerCode, period): รายบรรทัด (drill-down)
   แสดงเฉพาะแถวที่ map ร้านเจอ (RPC กรอง dealer_code is not null แล้ว)
   cache + pub/sub ต่อ dealerCode (null = ทุกร้าน -> key "__all__")
   ============================================================= */

export interface BaMonth {
  period: string;          // 'YYYY-MM'
  incentive: number;       // รวม total_incentive
  gmv: number;             // รวม gmv_service
  lineCount: number;
  empCount: number;        // จำนวนพนักงานขาย (distinct emp_id)
  paidDate: string | null; // วันที่ทำจ่ายล่าสุดของเดือน
}

export interface BaSummary {
  ok: boolean;
  totalIncentive: number;
  months: BaMonth[];
  error?: string;
}

export interface BaLine {
  dealerCode: string;
  dealerName: string | null;
  channelName: string | null;
  empId: string | null;
  saleRepName: string | null;
  empCode: string | null;     // CR# (null ถ้ายังไม่ map)
  jobCode: string | null;
  worktypeName: string | null;
  serviceGroup: string | null;
  productName: string | null;
  customerName: string | null;
  winDate: string | null;
  datePayment: string | null;
  gmvService: number;
  totalIncentive: number;
}

/* ---------------- cache + pub/sub ---------------- */
const summaryCache = new Map<string, BaSummary>();
const listeners = new Set<() => void>();

function keyOf(dealerCode: string | null): string {
  return dealerCode || "__all__";
}
function emit() {
  listeners.forEach((l) => l());
}

export function subscribeBa(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCachedBaSummary(dealerCode: string | null): BaSummary | null {
  return summaryCache.get(keyOf(dealerCode)) ?? null;
}

/* ---------------- map helpers (snake -> camel) ---------------- */
type RawMonth = {
  period: string;
  incentive: number | string;
  gmv: number | string;
  line_count: number | string;
  emp_count: number | string;
  paid_date: string | null;
};

function mapMonth(r: RawMonth): BaMonth {
  return {
    period: r.period,
    incentive: Number(r.incentive ?? 0),
    gmv: Number(r.gmv ?? 0),
    lineCount: Number(r.line_count ?? 0),
    empCount: Number(r.emp_count ?? 0),
    paidDate: r.paid_date,
  };
}

type RawLine = {
  dealer_code: string;
  dealer_name: string | null;
  channel_name: string | null;
  emp_id: string | null;
  sale_rep_name: string | null;
  emp_code: string | null;
  job_code: string | null;
  worktype_name: string | null;
  service_group: string | null;
  product_name: string | null;
  customer_name: string | null;
  win_date: string | null;
  date_payment: string | null;
  gmv_service: number | string | null;
  total_incentive: number | string;
};

function mapLine(r: RawLine): BaLine {
  return {
    dealerCode: r.dealer_code,
    dealerName: r.dealer_name,
    channelName: r.channel_name,
    empId: r.emp_id,
    saleRepName: r.sale_rep_name,
    empCode: r.emp_code,
    jobCode: r.job_code,
    worktypeName: r.worktype_name,
    serviceGroup: r.service_group,
    productName: r.product_name,
    customerName: r.customer_name,
    winDate: r.win_date,
    datePayment: r.date_payment,
    gmvService: Number(r.gmv_service ?? 0),
    totalIncentive: Number(r.total_incentive ?? 0),
  };
}

/* ---------------- API calls ---------------- */

export async function fetchBaSummary(dealerCode: string | null): Promise<BaSummary> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/ba-incentive${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    total_incentive?: number | string;
    months?: RawMonth[];
    error?: string;
  };
  const summary: BaSummary = {
    ok: !!raw.ok,
    totalIncentive: Number(raw.total_incentive ?? 0),
    months: Array.isArray(raw.months) ? raw.months.map(mapMonth) : [],
    error: raw.error,
  };
  if (summary.ok) {
    summaryCache.set(keyOf(dealerCode), summary);
    emit();
  }
  return summary;
}

export async function fetchBaMonthLines(
  dealerCode: string | null,
  period: string
): Promise<BaLine[]> {
  const params = new URLSearchParams({ period });
  if (dealerCode) params.set("dealerCode", dealerCode);
  const res = await fetch(`/api/ba-incentive?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const raw = (await res.json()) as { ok?: boolean; lines?: RawLine[] };
  return raw.ok && Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [];
}
