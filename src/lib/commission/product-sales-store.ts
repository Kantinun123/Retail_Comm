"use client";

/* ยอดขายสินค้า (DI / Odoo) — client data layer ; อ่านผ่าน /api/product-sales */

export type PsSource = "di" | "odoo";

export interface PsMonth {
  period: string;
  amount: number;
  qty: number;
  lines: number;
}
export interface PsGroupRow {
  period: string;
  source: PsSource;
  group: string;
  amount: number;
}
export interface PsPersonRow {
  period: string;
  repCode: string | null;
  /** ชื่อในไฟล์ (เฉพาะคนที่ไม่ได้อยู่ในระบบ) */
  salesperson: string | null;
  name: string | null;
  nickname: string | null;
  amount: number;
  lines: number;
}
export interface PsStoreRow {
  period: string;
  dealerCode: string;
  dealerName: string | null;
  model: string | null;
  amount: number;
}
export interface PsUnmappedRow {
  period: string;
  source: PsSource;
  sourceDealer: string | null;
  amount: number;
}
export interface PsSummary {
  sources: PsSource[];
  months: PsMonth[];
  groups: PsGroupRow[];
  people: PsPersonRow[];
  stores: PsStoreRow[];
  unmapped: PsUnmappedRow[];
  updatedAt: string | null;
  latestDate: string | null;
}

const n = (v: unknown) => Number(v ?? 0) || 0;
const s = (v: unknown) => (v == null || v === "" ? null : String(v));
const src = (v: unknown): PsSource => (v === "odoo" ? "odoo" : "di");

export async function fetchProductSales(opts: {
  source?: PsSource | null;
  dealerCode?: string | null;
  repCode?: string | null;
  salesperson?: string | null;
  /** เฉพาะยอดรายเดือน (การ์ดหน้าหลัก) */
  lite?: boolean;
}): Promise<PsSummary | null> {
  const p = new URLSearchParams();
  if (opts.lite) p.set("lite", "1");
  if (opts.source) p.set("source", opts.source);
  if (opts.dealerCode) p.set("dealerCode", opts.dealerCode);
  if (opts.repCode) p.set("repCode", opts.repCode);
  if (opts.salesperson) p.set("salesperson", opts.salesperson);
  const q = p.toString();
  const res = await fetch(`/api/product-sales${q ? `?${q}` : ""}`, { cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    sources?: string[];
    months?: Record<string, unknown>[];
    groups?: Record<string, unknown>[];
    people?: Record<string, unknown>[];
    stores?: Record<string, unknown>[];
    unmapped?: Record<string, unknown>[];
    updated_at?: string | null;
    latest_date?: string | null;
  };
  if (!raw.ok) return null;
  return {
    sources: (raw.sources ?? []).map(src),
    months: (raw.months ?? []).map((m) => ({ period: String(m.period), amount: n(m.amount), qty: n(m.qty), lines: n(m.lines) })),
    groups: (raw.groups ?? []).map((g) => ({ period: String(g.period), source: src(g.source), group: String(g.product_group ?? "ไม่ระบุ"), amount: n(g.amount) })),
    people: (raw.people ?? []).map((x) => ({
      period: String(x.period),
      repCode: s(x.rep_code),
      salesperson: s(x.salesperson),
      name: s(x.name),
      nickname: s(x.nickname),
      amount: n(x.amount),
      lines: n(x.lines),
    })),
    stores: (raw.stores ?? []).map((x) => ({
      period: String(x.period),
      dealerCode: String(x.dealer_code),
      dealerName: s(x.dealer_name),
      model: s(x.model),
      amount: n(x.amount),
    })),
    unmapped: (raw.unmapped ?? []).map((x) => ({ period: String(x.period), source: src(x.source), sourceDealer: s(x.source_dealer), amount: n(x.amount) })),
    updatedAt: raw.updated_at ?? null,
    latestDate: raw.latest_date ?? null,
  };
}

/** ชื่อแสดงของพนักงานในรายการ */
export function personLabel(p: Pick<PsPersonRow, "repCode" | "salesperson" | "name" | "nickname">): string {
  if (p.repCode) return p.name ? `${p.name}${p.nickname ? ` (${p.nickname})` : ""}` : p.repCode;
  if (!p.salesperson || p.salesperson === "ไม่ระบุ") return "ไม่ระบุพนักงาน";
  return p.salesperson;
}

/** ชื่อสาขา Odoo/DI ที่ไม่ได้อยู่ในแอป (ไว้แสดงในกล่อง "ไม่ระบุร้าน") */
export const UNMAPPED_LABEL: Record<string, string> = {
  "8B10": "สำนักงานกลาง",
  "8B20": "Ecommerce",
  "8180": "ฮาร์ดแวร์เฮาส์ ศรีราชา",
  "8330": "ฮาร์ดแวร์ ปราจีนบุรี",
  "5100858": "กิจเจริญสะเดา",
  "5100990": "สว่างแดนดิน",
  "5100998": "เอกภัณฑ์อรัญ",
  "5102804": "กิจเจริญโฮม อุบล",
};
