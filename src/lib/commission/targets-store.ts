"use client";

/* =============================================================
   เป้าหมาย (TG) — client data layer ผ่าน /api/targets
   - service_sales : เป้ายอดขายงานบริการ (บาท, ไม่รวม VAT) แยก 3 กลุ่ม ; ACT = LHS/Rudy + BA (ตามรายงาน Power BI)
   - design_intake : เป้าจำนวนแบบรับเข้า
   - LY = ยอดเดือนเดียวกันของปีก่อน ; % ถึงเป้า = ACT ÷ TG (ไม่ปรับฐาน VAT เหมือน Power BI)
   ============================================================= */

export type TargetKind = "service_sales" | "design_intake" | "product_sales";

/** 6 กลุ่มสินค้าตามรายงาน Power BI (ลำดับเดียวกับรายงาน) — product_sales_lines.group6 / sales_targets.group3 */
export const PRODUCT_GROUP6 = ["ROOF", "ROOF C&W ACCESSORIES", "CW", "LANDSCAPE", "SFG", "WINDSOR"] as const;

export interface TgCell {
  period: string;          // 'YYYY-MM' (LY ถูกเลื่อนมาไว้ที่เดือนเดียวกันของปีนี้แล้ว)
  group3: string | null;   // service_sales: 'ROOF SERVICE' | 'SMART SOLUTION' | 'Qchang'
  target: number;
  actual: number;
  ly: number;
}
export interface TgStoreCell {
  dealerCode: string;
  dealerName: string;
  model: string | null;
  period: string;
  target: number;
  actual: number;
  ly: number;
}
export interface TgCompare {
  ok: boolean;
  kind: TargetKind;
  year: string;
  hasTarget: boolean;
  months: TgCell[];
  stores: TgStoreCell[];
  error?: string;
}
export interface TgTotals {
  target: number;
  actual: number;
  ly: number;
  /** ACT ÷ TG (null = ไม่มีเป้า) */
  pct: number | null;
  /** เทียบปีก่อน % (null = ปีก่อนเป็น 0) */
  growth: number | null;
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const cache = new Map<string, Promise<TgCompare>>();

export function fetchTargets(kind: TargetKind, dealerCode: string | null, year: string): Promise<TgCompare> {
  const key = `${kind}|${dealerCode ?? ""}|${year}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new URLSearchParams({ kind, year });
  if (dealerCode) p.set("dealerCode", dealerCode);
  const req = fetch(`/api/targets?${p}`, { cache: "no-store" })
    .then((r) => r.json())
    .then((raw): TgCompare => ({
      ok: !!raw?.ok,
      kind,
      year,
      hasTarget: !!raw?.has_target,
      months: Array.isArray(raw?.months)
        ? raw.months.map((m: Record<string, unknown>) => ({ period: String(m.period), group3: (m.group3 as string) ?? null, target: num(m.target), actual: num(m.actual), ly: num(m.ly) }))
        : [],
      stores: Array.isArray(raw?.stores)
        ? raw.stores.map((s: Record<string, unknown>) => ({
            dealerCode: String(s.dealer_code), dealerName: String(s.dealer_name ?? s.dealer_code), model: (s.model as string) ?? null,
            period: String(s.period), target: num(s.target), actual: num(s.actual), ly: num(s.ly),
          }))
        : [],
      error: raw?.error,
    }))
    .catch((e): TgCompare => {
      cache.delete(key);
      return { ok: false, kind, year, hasTarget: false, months: [], stores: [], error: String(e) };
    });
  cache.set(key, req);
  return req;
}

/** รวมค่าของเดือนที่ผ่าน filter (เช่น เดือนเดียว / สะสมถึงเดือนที่ครบล่าสุด) และกลุ่ม (null = ทุกกลุ่ม) */
export function tgTotals(cells: { period: string; group3?: string | null; target: number; actual: number; ly: number }[], keep: (period: string) => boolean, group?: string | null): TgTotals {
  let target = 0, actual = 0, ly = 0;
  for (const c of cells) {
    if (!keep(c.period)) continue;
    if (group != null && c.group3 !== group) continue;
    target += c.target; actual += c.actual; ly += c.ly;
  }
  return { target, actual, ly, pct: target > 0 ? actual / target : null, growth: ly > 0 ? ((actual - ly) / ly) * 100 : null };
}

/** สีตาม % ถึงเป้า: ≥100% เขียวเข้ม · 80–99% เขียว · 50–79% ส้ม · <50% แดง */
export function tgTone(pct: number | null): { bar: string; text: string; soft: string } {
  if (pct == null) return { bar: "bg-slate-300", text: "text-slate-500", soft: "bg-slate-100" };
  if (pct >= 1) return { bar: "bg-emerald-700", text: "text-emerald-700", soft: "bg-emerald-50" };
  if (pct >= 0.8) return { bar: "bg-emerald-500", text: "text-emerald-600", soft: "bg-emerald-50" };
  if (pct >= 0.5) return { bar: "bg-amber-500", text: "text-amber-700", soft: "bg-amber-50" };
  return { bar: "bg-[#d32029]", text: "text-[#d32029]", soft: "bg-red-50" };
}
export const pctLabel = (pct: number | null) => (pct == null ? "-" : `${Math.round(pct * 100)}%`);

/* ---------------- เป้าคะแนน: ตรวจประเมินร้าน / ความพึงพอใจ ----------------
   ปี 2026: ต้องได้ ≥ 90% ทุกเดือน และค่าเฉลี่ยทั้งปี ≥ 90% (ตามที่ทีมกำหนด)
   ปีใหม่ที่เป้าเปลี่ยน -> เพิ่มปีในตารางนี้ */
const SCORE_TARGETS: Record<string, number> = { "2026": 0.9 };
/** เป้าคะแนน (0–1) ของเดือน 'YYYY-MM' หรือปี 'YYYY' — null = ปีนั้นไม่มีเป้า */
export function scoreTarget(periodOrYear: string | null | undefined): number | null {
  if (!periodOrYear) return null;
  return SCORE_TARGETS[periodOrYear.slice(0, 4)] ?? null;
}
