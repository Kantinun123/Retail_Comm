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
