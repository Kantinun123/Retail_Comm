"use client";

/* ความสดของข้อมูล (ข้อมูลถึง / อัปเดต) + ตัวช่วยช่วงเวลาของหน้าหลัก
   อ่านผ่าน /api/data-freshness — ดึงครั้งเดียวต่อการโหลดหน้า (cache ใน module) */

export type DailyJob = "product-di" | "product-odoo" | "lhs" | "ba" | "cust-sat" | "scghome-sat" | "store-eval" | "design-intake";
export type MonthlySource = "back-margin" | "profit-share-ba" | "product-commission" | "ba-commission" | "lhs-commission" | "lhs-discount";

export interface Freshness {
  now: string;
  daily: Partial<Record<DailyJob, { dataDate: string | null; syncedAt: string | null }>>;
  monthly: Partial<Record<MonthlySource, string | null>>;
}

let pending: Promise<Freshness | null> | null = null;
let cachedAt = 0;

export function fetchFreshness(): Promise<Freshness | null> {
  // cache 5 นาที (sync เร็วสุดทุก 1 ชม.)
  if (pending && Date.now() - cachedAt < 5 * 60 * 1000) return pending;
  cachedAt = Date.now();
  pending = fetch("/api/data-freshness", { cache: "no-store" })
    .then((r) => r.json())
    .then((raw: { ok?: boolean; now?: string; daily?: Record<string, { data_date: string | null; synced_at: string | null }>; monthly?: Record<string, string | null> }) => {
      if (!raw.ok) return null;
      const daily: Freshness["daily"] = {};
      Object.entries(raw.daily ?? {}).forEach(([k, v]) => (daily[k as DailyJob] = { dataDate: v?.data_date ?? null, syncedAt: v?.synced_at ?? null }));
      return { now: String(raw.now), daily, monthly: (raw.monthly ?? {}) as Freshness["monthly"] };
    })
    .catch(() => null);
  return pending;
}

const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const pad = (n: number) => String(n).padStart(2, "0");
export const periodShort = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_SHORT[m - 1]} ${String(y + 543).slice(-2)}`; };
export const periodLong = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_SHORT[m - 1]} ${y + 543}`; };
export const periodFull = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_MONTH[m - 1]} ${y + 543}`; };
export const prevPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
export const currentPeriod = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
/** เดือนที่ครบล่าสุด (ค่าเริ่มต้นของหน้าหลัก) */
export const lastFullPeriod = (d = new Date()) => prevPeriod(currentPeriod(d));

/** ช่วงเวลาของหน้าหลัก */
export type HubView = { mode: "month"; period: string } | { mode: "year"; year: string };
export const viewLabel = (v: HubView) => (v.mode === "month" ? periodLong(v.period) : `สะสมปี ${Number(v.year) + 543}`);

/** ข้อความ "ข้อมูลถึง … · อัปเดต …" + เตือนเมื่อไม่ได้อัปเดตเกิน 1 วัน */
export function freshText(f: Freshness | null, jobs: DailyJob[], opts: { showDataDate?: boolean } = {}): { text: string; stale: boolean } | null {
  if (!f) return null;
  const items = jobs.map((j) => f.daily[j]).filter(Boolean) as { dataDate: string | null; syncedAt: string | null }[];
  if (!items.length) return null;
  const dataDate = items.map((i) => i.dataDate).filter(Boolean).sort().pop() ?? null;
  const synced = items.map((i) => i.syncedAt).filter(Boolean).sort().pop() ?? null;
  const now = new Date(f.now).getTime();
  const parts: string[] = [];
  if (opts.showDataDate !== false && dataDate) {
    parts.push(`ข้อมูลถึง ${new Date(dataDate + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`);
  }
  let stale = false;
  if (synced) {
    const t = new Date(synced);
    const days = Math.floor((now - t.getTime()) / 86400000);
    stale = now - t.getTime() > 26 * 3600 * 1000;
    const sameDay = new Date(now).toDateString() === t.toDateString();
    parts.push(
      stale
        ? `อัปเดตล่าสุด ${days} วันก่อน`
        : sameDay
          ? `อัปเดต ${t.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`
          : `อัปเดต ${t.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
    );
  }
  return parts.length ? { text: parts.join(" · "), stale } : null;
}

/** ค่าของแหล่งรายเดือนตามช่วงเวลา
 *  - month: มียอด -> amount ; ไฟล์ของเดือนนั้นยังไม่มา -> waiting (+ยอดล่าสุดของร้าน) ; มาแล้วแต่ร้านไม่มี -> 0
 *  - year : ยอดสะสมของปี */
export interface SourceValue {
  amount: number | null;
  waiting: boolean;
  latest: { period: string; amount: number } | null;
  dataUntil: string | null;
}
export function monthlyValue(
  months: { period: string; amount: number }[] | null | undefined,
  view: HubView,
  sourceLatest: string | null | undefined
): SourceValue {
  const list = months ?? [];
  const latestStore = [...list].filter((m) => m.amount !== 0).sort((a, b) => b.period.localeCompare(a.period))[0] ?? null;
  if (view.mode === "year") {
    return { amount: list.filter((m) => m.period.startsWith(view.year + "-")).reduce((a, m) => a + m.amount, 0), waiting: false, latest: latestStore, dataUntil: sourceLatest ?? null };
  }
  const hit = list.filter((m) => m.period === view.period).reduce((a, m) => a + m.amount, 0);
  const waiting = !!sourceLatest && view.period > sourceLatest && hit === 0;
  return { amount: waiting ? null : hit, waiting, latest: latestStore, dataUntil: sourceLatest ?? null };
}
