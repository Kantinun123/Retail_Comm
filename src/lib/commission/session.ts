"use client";

/* Client-side session store built on sessionStorage, mirroring the
   reference app's keys. React components read/write via useSession(). */
import { useCallback, useSyncExternalStore } from "react";
import {
  getDealers,
  defaultFilterState,
  dealerByCode,
  employeeById,
} from "./logic";
import type { Dealer, FilterState, Role, TeamMember } from "./types";

const KEYS = {
  loggedIn: "loggedIn",
  dealerCode: "dealerCode",
  role: "role",
  empId: "empId",
  filter: "cmFilter",
  panelOpen: "filterPanelOpen",
  storeFilter: "adminStoreFilter",
} as const;

export interface SessionData {
  loggedIn: boolean;
  role: Role;
  dealerCode: string | null;
  empId: string | null;
  /** ร้านที่ active (ถ้า admin ยังไม่เจาะร้าน = ร้านแรกเป็น fallback เพื่อแสดงผล) */
  dealer: Dealer;
  me: TeamMember | null;
  isSales: boolean;
  /** ผู้ดูแลระบบ: เห็นทุกร้านทุกข้อมูล */
  isAdmin: boolean;
  /**
   * ขอบเขตร้านที่ admin กำลังเจาะดู (รหัสร้าน) หรือ null = ดูทุกร้านรวมกัน
   * สำหรับ dealer/sales ค่านี้ไม่ใช้ (scope อิง dealerCode/empId ตามเดิม)
   */
  storeFilter: string | null;
  filter: FilterState;
}

function readFilter(): FilterState {
  try {
    const raw = sessionStorage.getItem(KEYS.filter);
    if (raw) {
      const parsed = JSON.parse(raw) as FilterState;
      if (parsed && Array.isArray(parsed.years)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return defaultFilterState();
}

function readSession(): SessionData {
  const dealerCode =
    (typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(KEYS.dealerCode)) ||
    null;
  const role = (sessionStorage.getItem(KEYS.role) as Role) || "dealer";
  const empId = sessionStorage.getItem(KEYS.empId);
  const me = empId ? employeeById(empId) ?? null : null;
  const isAdmin = role === "admin";
  // admin อาจเจาะดูร้านหนึ่ง (storeFilter) หรือดูทุกร้าน (null)
  const storeFilter = isAdmin
    ? sessionStorage.getItem(KEYS.storeFilter) || null
    : null;
  // dealer ที่ใช้แสดงผล: dealer/sales ใช้ dealerCode, admin ใช้ร้านที่เจาะ (ถ้ามี) ไม่งั้น fallback ร้านแรก
  const dealer =
    dealerByCode((isAdmin ? storeFilter : dealerCode) || "") ||
    getDealers()[0];
  return {
    loggedIn: sessionStorage.getItem(KEYS.loggedIn) === "true",
    role,
    dealerCode,
    empId,
    dealer,
    me,
    isSales: role === "sales" && !!empId,
    isAdmin,
    storeFilter,
    filter: readFilter(),
  };
}

export interface LoginInput {
  /** dealer/sales ต้องระบุร้าน; admin ไม่ต้อง (เห็นทุกร้าน) */
  dealerCode?: string;
  role: Role;
  empId?: string;
}

export function doLogin({ dealerCode, role, empId }: LoginInput) {
  sessionStorage.setItem(KEYS.loggedIn, "true");
  if (dealerCode) sessionStorage.setItem(KEYS.dealerCode, dealerCode);
  else sessionStorage.removeItem(KEYS.dealerCode);
  sessionStorage.setItem(KEYS.role, role);
  if (role === "sales" && empId) sessionStorage.setItem(KEYS.empId, empId);
  else sessionStorage.removeItem(KEYS.empId);
  // admin เริ่มต้นที่ "ทุกร้าน"
  sessionStorage.removeItem(KEYS.storeFilter);
  sessionStorage.setItem(KEYS.filter, JSON.stringify(defaultFilterState()));
  sessionStorage.setItem(KEYS.panelOpen, "0");
  // ล้าง cache แล้วแจ้ง subscriber เพื่อให้ทุกหน้าอ่าน session ใหม่ (role/empId ที่เพิ่งเปลี่ยน)
  emit();
}

/** admin: ตั้งร้านที่เจาะดู (null = ทุกร้าน) */
export function setStoreFilter(code: string | null) {
  if (code) sessionStorage.setItem(KEYS.storeFilter, code);
  else sessionStorage.removeItem(KEYS.storeFilter);
  emit();
}

export function doLogout() {
  sessionStorage.removeItem(KEYS.loggedIn);
  sessionStorage.removeItem(KEYS.dealerCode);
  sessionStorage.removeItem(KEYS.role);
  sessionStorage.removeItem(KEYS.empId);
  sessionStorage.removeItem(KEYS.storeFilter);
  emit();
}

/* ----- tiny external store over sessionStorage ----- */
const listeners = new Set<() => void>();
let cachedSnapshot: SessionData | null = null;
let cacheDirty = true;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit() {
  cacheDirty = true;
  listeners.forEach((l) => l());
}
function getSnapshot(): SessionData {
  if (cacheDirty || cachedSnapshot === null) {
    cachedSnapshot = readSession();
    cacheDirty = false;
  }
  return cachedSnapshot;
}
function getServerSnapshot(): null {
  return null;
}

/** Reads the session from sessionStorage. `ready` is false during SSR. */
export function useSession(): {
  session: SessionData | null;
  ready: boolean;
  setFilter: (next: FilterState) => void;
} {
  const session = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setFilter = useCallback((next: FilterState) => {
    sessionStorage.setItem(KEYS.filter, JSON.stringify(next));
    emit();
  }, []);

  return { session, ready: session !== null, setFilter };
}

export function getPanelOpen(): boolean {
  try {
    return sessionStorage.getItem(KEYS.panelOpen) === "1";
  } catch {
    return false;
  }
}
export function setPanelOpen(open: boolean) {
  try {
    sessionStorage.setItem(KEYS.panelOpen, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}
