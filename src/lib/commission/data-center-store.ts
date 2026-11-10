"use client";

/* ศูนย์ข้อมูล — client data layer ; อ่านผ่าน /api/admin/data-center (admin เท่านั้น) */

export type RunStatus = "ok" | "skipped" | "failed" | "guard";

export interface DcRun {
  status: RunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  summary: string | null;
  fileMtime: string | null;
}
export interface DcDaily {
  job: string;
  lastRun: DcRun | null;
  lastOk: DcRun | null;
  days: { d: string; status: RunStatus; runs: number }[];
  dataDate: string | null;
  total: number;
}
export interface DcMonthly {
  source: string;
  period: string;
  rows: number;
  amount: number;
  files: number;
  stores: number;
  loadedAt: string | null;
}
export interface DcUpload {
  id: number;
  source: string;
  period: string;
  status: "applied" | "cancelled" | "failed";
  fileCount: number;
  fileNames: string[];
  rowsBefore: number | null;
  rowsAfter: number | null;
  amountBefore: number | null;
  amountAfter: number | null;
  message: string | null;
  uploadedBy: string | null;
  createdAt: string;
}
export interface DcSummary {
  now: string;
  daily: DcDaily[];
  monthly: DcMonthly[];
  uploads: DcUpload[];
}

const n = (v: unknown) => Number(v ?? 0) || 0;
const nn = (v: unknown) => (v == null ? null : Number(v));
const s = (v: unknown) => (v == null || v === "" ? null : String(v));
function run(r: Record<string, unknown> | null | undefined): DcRun | null {
  if (!r) return null;
  return { status: (r.status as RunStatus) ?? "ok", startedAt: s(r.started_at), finishedAt: s(r.finished_at), summary: s(r.summary), fileMtime: s(r.file_mtime) };
}

/** null = ไม่ใช่ admin / ยังไม่ล็อกอินจริง ; throw = เครือข่ายผิดพลาด */
export async function fetchDataCenter(): Promise<{ ok: true; data: DcSummary } | { ok: false; status: number; error: string }> {
  const res = await fetch("/api/admin/data-center", { cache: "no-store" });
  const raw = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !raw.ok) return { ok: false, status: res.status, error: String(raw.error ?? "error") };
  return {
    ok: true,
    data: {
      now: String(raw.now),
      daily: ((raw.daily as Record<string, unknown>[]) ?? []).map((d) => ({
        job: String(d.job),
        lastRun: run(d.last_run as Record<string, unknown> | null),
        lastOk: run(d.last_ok as Record<string, unknown> | null),
        days: ((d.days as Record<string, unknown>[]) ?? []).map((x) => ({ d: String(x.d), status: x.status as RunStatus, runs: n(x.runs) })),
        dataDate: s(d.data_date),
        total: n(d.total),
      })),
      monthly: ((raw.monthly as Record<string, unknown>[]) ?? []).map((m) => ({
        source: String(m.source),
        period: String(m.period),
        rows: n(m.rows),
        amount: n(m.amount),
        files: n(m.files),
        stores: n(m.stores),
        loadedAt: s(m.loaded_at),
      })),
      uploads: ((raw.uploads as Record<string, unknown>[]) ?? []).map((u) => ({
        id: n(u.id),
        source: String(u.source),
        period: String(u.period),
        status: u.status as DcUpload["status"],
        fileCount: n(u.file_count),
        fileNames: (u.file_names as string[]) ?? [],
        rowsBefore: nn(u.rows_before),
        rowsAfter: nn(u.rows_after),
        amountBefore: nn(u.amount_before),
        amountAfter: nn(u.amount_after),
        message: s(u.message),
        uploadedBy: s(u.uploaded_by),
        createdAt: String(u.created_at),
      })),
    },
  };
}

/** แหล่งข้อมูลรายวัน (ตรงกับ JOBS ใน scripts/sync-runner.mjs) */
export const DAILY_JOBS: { job: string; label: string; group: "gsheet" | "sharepoint"; unit: string; href: string }[] = [
  { job: "ba", label: "ยอดขาย BA", group: "gsheet", unit: "งาน", href: "/app/service-sales/ba" },
  { job: "cust-sat", label: "ความพึงพอใจ (บริการ)", group: "gsheet", unit: "รีวิว", href: "/app/cust-sat" },
  { job: "scghome-sat", label: "ความพึงพอใจ SCG Home", group: "gsheet", unit: "แบบสอบถาม", href: "/app/cust-sat" },
  { job: "store-eval", label: "ผลตรวจประเมินร้าน", group: "gsheet", unit: "การตรวจ", href: "/app/store-eval" },
  { job: "product-di", label: "ยอดขายสินค้า DI", group: "sharepoint", unit: "แถวสรุป", href: "/app/product-sales" },
  { job: "product-odoo", label: "ยอดขายสินค้า Odoo", group: "sharepoint", unit: "แถวสรุป", href: "/app/product-sales" },
  { job: "lhs", label: "ยอดขาย LHS/Rudy", group: "sharepoint", unit: "งาน", href: "/app/service-sales/lhs" },
  { job: "design-intake", label: "แบบรับเข้า (CRM)", group: "sharepoint", unit: "แบบ", href: "/app/design-intake" },
];

/** แหล่งข้อมูลรายเดือน (อัปโหลดเอง) */
export const MONTHLY_SOURCES: { source: string; label: string; href: string; uploadable: boolean }[] = [
  { source: "back-margin", label: "Back Margin", href: "/app/back-margin", uploadable: false },
  { source: "profit-share-ba", label: "Profit Share BA", href: "/app/ba-profit-share", uploadable: false },
  { source: "product-commission", label: "Product Commission", href: "/app/commission-product", uploadable: false },
  { source: "ba-commission", label: "BA Commission", href: "/app/ba-incentive", uploadable: true },
  { source: "lhs-commission", label: "LHS Commission", href: "/app/lhs-commission", uploadable: false },
  { source: "lhs-discount", label: "LHS Channel Discount", href: "/app/lhs-purchase-discount", uploadable: false },
];

/** สรุปผลรอบ sync ให้สั้น: ดึงส่วน "DONE ..." ถ้ามี */
export function shortSummary(summary: string | null): string | null {
  if (!summary) return null;
  const parts = summary.split(" | ");
  const done = parts.filter((p) => /^DONE/.test(p)).map((p) => p.replace(/^DONE:?\s*(di|odoo)?:?\s*/, ""));
  if (done.length) return done.join(" · ");
  const stop = parts.find((p) => /หยุด|ไม่สำเร็จ|ผิดพลาด|ไม่พบ/.test(p));
  return stop ?? parts[parts.length - 1] ?? summary;
}
