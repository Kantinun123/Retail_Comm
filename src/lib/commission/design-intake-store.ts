"use client";

/* แบบรับเข้า (CRM Opportunity) — client data layer ; อ่านผ่าน /api/design-intake */

export interface DiMonth {
  period: string;
  material: number;
  solution: number;
  wonMaterial: number;
  wonSolution: number;
}
export interface DiStoreRow {
  period: string;
  dealerCode: string | null;
  dealerName: string | null;
  model: string | null;
  material: number;
  solution: number;
}
export interface DiRepRow {
  period: string;
  repCode: string | null;
  name: string | null;
  nickname: string | null;
  material: number;
  solution: number;
}
export interface DiSummary {
  months: DiMonth[];
  stores: DiStoreRow[];
  reps: DiRepRow[];
  updatedAt: string | null;
  latestDate: string | null;
}

const n = (v: unknown) => Number(v ?? 0) || 0;

export async function fetchDesignIntake(opts: { dealerCode?: string | null; repCode?: string | null }): Promise<DiSummary | null> {
  const p = new URLSearchParams();
  if (opts.dealerCode) p.set("dealerCode", opts.dealerCode);
  if (opts.repCode) p.set("repCode", opts.repCode);
  const q = p.toString();
  const res = await fetch(`/api/design-intake${q ? `?${q}` : ""}`, { cache: "no-store" });
  const raw = (await res.json()) as {
    ok?: boolean;
    months?: Record<string, unknown>[];
    stores?: Record<string, unknown>[];
    reps?: Record<string, unknown>[];
    updated_at?: string | null;
    latest_date?: string | null;
  };
  if (!raw.ok) return null;
  return {
    months: (raw.months ?? []).map((m) => ({
      period: String(m.period),
      material: n(m.material),
      solution: n(m.solution),
      wonMaterial: n(m.won_material),
      wonSolution: n(m.won_solution),
    })),
    stores: (raw.stores ?? []).map((s) => ({
      period: String(s.period),
      dealerCode: (s.dealer_code as string | null) ?? null,
      dealerName: (s.dealer_name as string | null) ?? null,
      model: (s.model as string | null) ?? null,
      material: n(s.material),
      solution: n(s.solution),
    })),
    reps: (raw.reps ?? []).map((r) => ({
      period: String(r.period),
      repCode: (r.rep_code as string | null) ?? null,
      name: (r.name as string | null) ?? null,
      nickname: (r.nickname as string | null) ?? null,
      material: n(r.material),
      solution: n(r.solution),
    })),
    updatedAt: raw.updated_at ?? null,
    latestDate: raw.latest_date ?? null,
  };
}

export interface DiJob {
  oppId: string;
  createdDate: string;
  dealerCode: string | null;
  dealerName: string | null;
  designType: "material" | "solution";
  serviceCategory: string | null;
  serviceSub: string | null;
  productSub: string | null;
  stage: string | null;
  reason: string | null;
  origin: string | null;
  subOrigin: string | null;
  repName: string | null;
  creator: string | null;
  expectedProduct: number;
  expectedService: number;
  rudyId: string | null;
}

/** รายการแบบของเดือนเดียว (ตามขอบเขตร้าน/พนักงาน) */
export async function fetchDesignIntakeJobs(opts: {
  period: string;
  dealerCode?: string | null;
  repCode?: string | null;
  /** เฉพาะงานที่จับคู่พนักงาน/ร้านไม่ได้ */
  unassigned?: "rep" | "store" | null;
}): Promise<{ jobs: DiJob[]; truncated: boolean; total: number } | null> {
  const p = new URLSearchParams({ mode: "jobs", period: opts.period });
  if (opts.dealerCode) p.set("dealerCode", opts.dealerCode);
  if (opts.repCode) p.set("repCode", opts.repCode);
  if (opts.unassigned) p.set("unassigned", opts.unassigned);
  const res = await fetch(`/api/design-intake?${p.toString()}`, { cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; truncated?: boolean; total?: number; jobs?: Record<string, unknown>[] };
  if (!raw.ok) return null;
  const s = (v: unknown) => (v == null || v === "" ? null : String(v));
  return {
    truncated: !!raw.truncated,
    total: Number(raw.total ?? raw.jobs?.length ?? 0),
    jobs: (raw.jobs ?? []).map((j) => ({
      oppId: String(j.opp_id),
      createdDate: String(j.created_date),
      dealerCode: s(j.dealer_code),
      dealerName: s(j.dealer_name),
      designType: j.design_type === "material" ? "material" : "solution",
      serviceCategory: s(j.service_category),
      serviceSub: s(j.service_sub_solution),
      productSub: s(j.product_sub_solution),
      stage: s(j.stage),
      reason: s(j.reason),
      origin: s(j.origin),
      subOrigin: s(j.sub_origin),
      repName: s(j.rep_name),
      creator: s(j.creator),
      expectedProduct: Number(j.expected_product ?? 0) || 0,
      expectedService: Number(j.expected_service ?? 0) || 0,
      rudyId: s(j.rudy_id),
    })),
  };
}
