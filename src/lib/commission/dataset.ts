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
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import {
  mapDealer,
  mapSolution,
  mapEmployee,
  mapSale,
  mapPointCompany,
  mapPointEmployee,
  type DealerRow,
  type SolutionRow,
  type EmployeeRow,
  type SaleRow,
  type PointCompanyRow,
  type PointEmployeeRow,
} from "./supabase-map";

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

/* =============================================================
   Supabase hydration (Phase ง/จ) — เปิดใช้งานแล้ว
   -------------------------------------------------------------
   AppGuard เรียก useDatasetReady() ซึ่ง trigger hydrateFromSupabase().
   เนื่องจากแอป login ด้วย sessionStorage (ไม่ใช่ Supabase Auth) ฝั่ง client
   จึงใช้ "anonymous sign-in" เป็นสะพาน (ensureAnonAuth) ให้ client เป็น role
   authenticated เพื่อผ่าน RLS policy (to authenticated) แล้วจึง query ได้.
   ต้องเปิด Anonymous Sign-ins ใน Supabase Dashboard ด้วย.

   ดีไซน์: getDataset() ยังคง synchronous เหมือนเดิม ทุก screen/logic ไม่ต้องแก้
   เราแค่ "เติม" current จาก Supabase แบบ async แล้ว emit() ให้ re-render

   ลำดับความสำคัญของข้อมูล:
     1) override ที่ admin อัปโหลด (localStorage) — ชนะเสมอ
     2) ข้อมูลจาก Supabase (ถ้าโหลดสำเร็จ)
     3) mock จาก raw-data.ts (fallback ก่อนโหลด/เมื่อ env ไม่ครบ)
   ============================================================= */

type ReadyState = "idle" | "loading" | "ready" | "error";
let readyState: ReadyState = "idle";
let hydratePromise: Promise<void> | null = null;

const readyListeners = new Set<() => void>();
function emitReady() {
  readyListeners.forEach((l) => l());
}

export function getDatasetReady(): ReadyState {
  return readyState;
}

/** ให้แน่ใจว่ามี Supabase session ก่อน query (ผ่าน RLS "to authenticated")
 *  - โหมดเดโม (ค่าเริ่มต้น): ใช้ anonymous sign-in เป็นสะพาน
 *    (dropdown login ไม่สร้าง Supabase session จริง)
 *  - โหมด real auth (NEXT_PUBLIC_REAL_AUTH=1): ต้องมี session จาก login จริงอยู่แล้ว
 *    ถ้าไม่มี session -> โยน error (flow login จะพาไป login) */
async function ensureAnonAuth(
  sb: ReturnType<typeof createClient>
): Promise<void> {
  const { data } = await sb.auth.getSession();
  if (data.session) return; // มี session อยู่แล้ว (จริง หรือ anon)

  const realAuth = process.env.NEXT_PUBLIC_REAL_AUTH === "1";
  if (!realAuth) {
    // โหมดเดโม: anon sign-in เป็นสะพาน
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    return;
  }
  // โหมด real auth: ไม่มี session = ยังไม่ login จริง
  throw new Error("no authenticated session (real-auth mode)");
}

/** ดึงข้อมูลทั้ง 6 ตารางจาก Supabase แล้วเติมเข้า current (ครั้งเดียว) */
export async function hydrateFromSupabase(): Promise<void> {
  // ถ้าไม่มี env (เช่น ตอน dev ยังไม่ตั้ง) -> ใช้ mock เดิม ถือว่าพร้อมเลย
  if (!hasEnvVars) {
    readyState = "ready";
    emitReady();
    return;
  }
  if (hydratePromise) return hydratePromise;

  readyState = "loading";
  emitReady();

  hydratePromise = (async () => {
    try {
      const sb = createClient();
      // ต้องมี Supabase session (authenticated) ก่อน ไม่งั้น RLS บล็อก
      // แอป login ด้วย sessionStorage จึงใช้ anonymous sign-in เป็นสะพานให้ client
      // เป็น role "authenticated" (RLS policy to authenticated ผ่าน)
      await ensureAnonAuth(sb);
      // ดึงทุกตารางขนานกัน; sales ต้องดึงเป็นหน้า ๆ (เกิน default 1000 แถว)
      const [dealers, solutions, employees, pointCompanies, pointEmployees] =
        await Promise.all([
          sb.from("dealers").select("*"),
          sb.from("solutions").select("*"),
          sb.from("employees").select("*"),
          sb.from("point_companies").select("*"),
          sb.from("point_employees").select("*"),
        ]);

      const firstErr =
        dealers.error ||
        solutions.error ||
        employees.error ||
        pointCompanies.error ||
        pointEmployees.error;
      if (firstErr) throw firstErr;

      const sales = await fetchAllSales(sb);

      const fromDb: Dataset = {
        dealers: (dealers.data as DealerRow[]).map(mapDealer),
        solutions: (solutions.data as SolutionRow[]).map(mapSolution),
        salesTeam: (employees.data as EmployeeRow[]).map(mapEmployee),
        sales: sales.map(mapSale),
        pointCompanies: (pointCompanies.data as PointCompanyRow[]).map(mapPointCompany),
        pointEmployees: (pointEmployees.data as PointEmployeeRow[]).map(mapPointEmployee),
      };

      // override ที่อัปโหลดไว้ชนะข้อมูล DB เสมอ
      current = { ...fromDb, ...overrides };
      readyState = "ready";
      emit(); // แจ้ง subscriber ของ dataset ให้คำนวณใหม่
      emitReady();
    } catch (e) {
      // โหลดไม่สำเร็จ -> คง mock เดิมไว้ (ไม่ทำแอปพัง) แต่บันทึกสถานะ error
      console.error("[dataset] hydrate from Supabase failed:", e);
      readyState = "error";
      emitReady();
    }
  })();

  return hydratePromise;
}

/** ดึง sales ทั้งหมดแบบแบ่งหน้า (Supabase จำกัด ~1000 แถว/คำขอ) */
async function fetchAllSales(
  sb: ReturnType<typeof createClient>
): Promise<SaleRow[]> {
  const PAGE = 1000;
  const all: SaleRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("sales")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as SaleRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/* ---- React hook: ให้ screen รอจนข้อมูลพร้อม ----
   เริ่ม hydrate ครั้งแรกที่ถูกเรียก (ฝั่ง client เท่านั้น) */
function subscribeReady(cb: () => void): () => void {
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}
function getReadySnapshot(): ReadyState {
  return readyState;
}
function getReadyServerSnapshot(): ReadyState {
  return "idle";
}

export function useDatasetReady(): ReadyState {
  const state = useSyncExternalStore(
    subscribeReady,
    getReadySnapshot,
    getReadyServerSnapshot
  );
  // kick off hydration on first client use
  if (typeof window !== "undefined" && readyState === "idle") {
    void hydrateFromSupabase();
  }
  return state;
}
