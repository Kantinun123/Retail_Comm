"use client";

/* =============================================================
   Live dataset store.

   The app ships with the mock data in raw-data.ts. An admin can
   replace any of the three logical sections by uploading Excel
   files on the /app/database page. The chosen dataset is what
   every screen (dashboard, analysis, points) reads through
   logic.ts. Uploaded data is persisted in localStorage so it
   survives reloads.
   ============================================================= */
import {
  DEALERS as DEFAULT_DEALERS,
  SOLUTIONS as DEFAULT_SOLUTIONS,
  SALES_TEAM as DEFAULT_SALES_TEAM,
  SALES as DEFAULT_SALES,
  POINT_COMPANIES as DEFAULT_POINT_COMPANIES,
  POINT_EMPLOYEES as DEFAULT_POINT_EMPLOYEES,
} from "./raw-data";
import type {
  Dealer,
  PointCompany,
  PointEmployee,
  Sale,
  Solution,
  TeamMember,
} from "./types";

export interface Dataset {
  dealers: Dealer[];
  solutions: Solution[];
  salesTeam: TeamMember[];
  sales: Sale[];
  pointCompanies: PointCompany[];
  pointEmployees: PointEmployee[];
}

/** Which logical section a value belongs to (matches the 3 upload cards) */
export type DatasetSection = "staff" | "commission" | "points";

const STORAGE_KEY = "cmDataset";

function defaultDataset(): Dataset {
  return {
    dealers: DEFAULT_DEALERS,
    solutions: DEFAULT_SOLUTIONS,
    salesTeam: DEFAULT_SALES_TEAM,
    sales: DEFAULT_SALES,
    pointCompanies: DEFAULT_POINT_COMPANIES,
    pointEmployees: DEFAULT_POINT_EMPLOYEES,
  };
}

/* -------- persisted overrides (only what the admin uploaded) -------- */
type Overrides = Partial<Dataset>;

function readOverrides(): Overrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Overrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverrides(o: Overrides) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    /* ignore quota errors */
  }
}

/* -------- in-memory current dataset (rebuilt from overrides) -------- */
let overrides: Overrides = readOverrides();
let current: Dataset = { ...defaultDataset(), ...overrides };

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function subscribeDataset(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The dataset all logic reads from. Safe to call on server (returns defaults). */
export function getDataset(): Dataset {
  return current;
}

/** Replace a whole section's arrays and persist. */
export function applyUpload(
  section: DatasetSection,
  data: Partial<Dataset>
) {
  overrides = { ...overrides, ...data };
  writeOverrides(overrides);
  current = { ...defaultDataset(), ...overrides };
  emit();
}

/** Which sections currently use uploaded (non-default) data. */
export function uploadedSections(): Record<DatasetSection, boolean> {
  return {
    staff:
      "dealers" in overrides ||
      "salesTeam" in overrides ||
      "solutions" in overrides,
    commission: "sales" in overrides,
    points:
      "pointCompanies" in overrides || "pointEmployees" in overrides,
  };
}

/** Reset everything back to the bundled mock data. */
export function resetDataset() {
  overrides = {};
  writeOverrides(overrides);
  current = defaultDataset();
  emit();
}
