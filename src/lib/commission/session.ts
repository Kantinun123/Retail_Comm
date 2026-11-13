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
import { subscribeDataset } from "./dataset";
import { createClient } from "@/lib/supabase/client";
import type { Dealer, FilterState, Role, TeamMember } from "./types";

/** ร้าน placeholder กัน session.dealer เป็น undefined ตอน dataset ยังไม่โหลด */
const EMPTY_DEALER: Dealer = {
  code: "",
  name: "",
  branch: "",
  taxId: "",
  tier: "",
  model: "",
  pointCompanyCode: "",
  region: "",
  province: "",
};

const KEYS = {
  loggedIn: "loggedIn",
  dealerCode: "dealerCode",
  role: "role",
  empId: "empId",
  filter: "cmFilter",
  panelOpen: "filterPanelOpen",
  storeFilter: "adminStoreFilter",
  repCode: "repCode",
  repName: "repName",
  repCr: "repCr",
  repDealerName: "repDealerName",
  repModel: "repModel",
  // admin "ดูในมุมมอง": ดูหน้าเหมือนร้านค้า/พนักงานโดยไม่ต้องสลับบัญชี
  adminViewMode: "adminViewMode",     // 'admin' (ปกติ) | 'store' | 'staff'
  adminViewDealer: "adminViewDealer", // รหัสร้านที่กำลังดูในมุมมอง store/staff
  adminViewRep: "adminViewRep",       // rep_code ที่กำลังดูในมุมมอง staff
  adminViewRepName: "adminViewRepName",
  // Area/Coach: ร้านที่ดูแล (JSON array ของรหัสร้าน) + ชื่อที่แสดง
  areaStores: "areaStores",
  areaName: "areaName",
  // Area/Coach/หัวหน้า Area: ร้านที่เลือกดูข้อมูล (ต้องอยู่ใน areaStores)
  areaViewDealer: "areaViewDealer",
  // บทบาทจริงของกลุ่ม area: area | coach | re | area_head
  areaKind: "areaKind",
} as const;

export type AdminViewMode = "admin" | "store" | "staff";

export interface SessionData {
  loggedIn: boolean;
  role: Role;
  dealerCode: string | null;
  empId: string | null;
  /** ร้านที่ active (ถ้า admin ยังไม่เจาะร้าน = ร้านแรกเป็น fallback เพื่อแสดงผล) */
  dealer: Dealer;
  me: TeamMember | null;
  isSales: boolean;
  /** รหัสพนักงานขาย (SR####) ใช้ scope ข้อมูล commission รายคน — เฉพาะ sales */
  repCode: string | null;
  /** ชื่อพนักงานขาย (จาก sale_reps) — เฉพาะ sales */
  repName: string | null;
  /** CR# ของพนักงาน — เฉพาะ sales */
  repCr: string | null;
  /** ชื่อร้านที่สังกัด — เฉพาะ sales */
  repDealerName: string | null;
  /** model/ประเภทร้าน (Housing Expert / SCG Home) — เฉพาะ sales */
  repModel: string | null;
  /** ผู้ดูแลระบบ: เห็นทุกร้านทุกข้อมูล */
  isAdmin: boolean;
  /** Area Manager / Coach (login จริงด้วย Microsoft): เห็นเฉพาะร้านที่ดูแล */
  isArea: boolean;
  /** รหัสร้านที่ Area/Coach ดูแล (ว่างถ้าไม่ใช่ area) */
  areaStores: string[];
  /** ชื่อ Area/Coach ที่แสดง */
  areaName: string | null;
  /** ร้านที่ Area/Coach/หัวหน้า Area เลือกดูข้อมูล (null = ยังไม่เลือก -> ต้องเลือกจากหน้าร้านที่ดูแล) */
  areaViewDealer: string | null;
  /** บทบาทจริงของกลุ่ม area (area | coach | re | area_head) ; null = ไม่ใช่กลุ่ม area */
  areaKind: string | null;
  /**
   * ขอบเขตร้านที่ admin กำลังดู (รหัสร้าน) หรือ null = ดูทุกร้านรวมกัน
   * - อยู่ใน "มุมมองร้านค้า/พนักงาน" = ร้านของมุมมองนั้น (ทุกหน้าจอที่อ่าน storeFilter จึงกรองตามร้านที่เลือกเสมอ)
   * สำหรับ dealer/sales/area ค่านี้ไม่ใช้ (ใช้ session.dealer)
   */
  storeFilter: string | null;
  /** โหมด "ดูในมุมมอง" ของ admin: ดูหน้าเหมือนร้านค้า/พนักงาน (เฉพาะ admin) */
  adminViewMode: AdminViewMode;
  /** รหัสร้านที่ admin กำลังดูในมุมมอง store/staff */
  adminViewDealer: string | null;
  /** rep_code ที่ admin กำลังดูในมุมมอง staff */
  adminViewRep: string | null;
  /** ชื่อพนักงานที่กำลังดู (แสดงบนแถบ) */
  adminViewRepName: string | null;
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
  const isArea = role === "area";
  let areaStores: string[] = [];
  if (isArea) {
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEYS.areaStores) || "[]");
      if (Array.isArray(raw)) areaStores = raw.map(String);
    } catch {
      /* ignore */
    }
  }
  const areaName = isArea ? sessionStorage.getItem(KEYS.areaName) || null : null;
  const areaPick = isArea ? sessionStorage.getItem(KEYS.areaViewDealer) || null : null;
  const areaViewDealer = areaPick && areaStores.includes(areaPick) ? areaPick : null;
  const areaKind = isArea ? sessionStorage.getItem(KEYS.areaKind) || "area" : null;
  // admin "ดูในมุมมอง" (store/staff) — role อื่นไม่ใช้
  const adminViewMode = (isAdmin
    ? (sessionStorage.getItem(KEYS.adminViewMode) as AdminViewMode) || "admin"
    : "admin") as AdminViewMode;
  const adminViewDealer = isAdmin ? sessionStorage.getItem(KEYS.adminViewDealer) || null : null;
  // admin อาจเจาะดูร้านหนึ่ง (storeFilter) หรือดูทุกร้าน (null)
  // อยู่ในมุมมองร้าน/พนักงาน -> ใช้ร้านของมุมมอง (ทุกหน้าที่อ่าน storeFilter จะกรองตามร้านนั้น)
  const storeFilter = isAdmin
    ? (adminViewMode !== "admin" && adminViewDealer) || sessionStorage.getItem(KEYS.storeFilter) || null
    : null;
  const adminViewRep = isAdmin ? sessionStorage.getItem(KEYS.adminViewRep) || null : null;
  const adminViewRepName = isAdmin ? sessionStorage.getItem(KEYS.adminViewRepName) || null : null;
  // dealer ที่ใช้แสดงผล: dealer/sales ใช้ dealerCode, admin ใช้ร้านที่เจาะ (ถ้ามี) ไม่งั้น fallback ร้านแรก
  // NB: ก่อน dataset hydrate จาก Supabase เสร็จ getDealers() อาจว่าง -> ใช้ placeholder กัน undefined
  // ร้านที่ใช้แสดงผล: ถ้า admin กำลัง "ดูในมุมมอง" ใช้ร้านที่เลือกในมุมมองก่อน
  const effectiveDealerCode = isAdmin
    ? (adminViewMode !== "admin" ? adminViewDealer : storeFilter)
    : isArea
      ? areaViewDealer
      : dealerCode;
  // Area ที่ยังไม่เลือกร้าน -> ร้านว่าง (ไม่ fallback ไปร้านแรก กันเห็นข้อมูลร้านที่ไม่ได้ดูแล)
  const dealer =
    dealerByCode(effectiveDealerCode || "") ||
    (isArea ? EMPTY_DEALER : getDealers()[0]) ||
    EMPTY_DEALER;
  const repCode = sessionStorage.getItem(KEYS.repCode) || null;
  const repName = sessionStorage.getItem(KEYS.repName) || null;
  const repCr = sessionStorage.getItem(KEYS.repCr) || null;
  const repDealerName = sessionStorage.getItem(KEYS.repDealerName) || null;
  const repModel = sessionStorage.getItem(KEYS.repModel) || null;
  return {
    loggedIn: sessionStorage.getItem(KEYS.loggedIn) === "true",
    role,
    dealerCode,
    empId,
    dealer,
    me,
    isSales: role === "sales" && !!empId,
    repCode,
    repName,
    repCr,
    repDealerName,
    repModel,
    isAdmin,
    isArea,
    areaStores,
    areaName,
    areaViewDealer,
    areaKind,
    storeFilter,
    adminViewMode,
    adminViewDealer,
    adminViewRep,
    adminViewRepName,
    filter: readFilter(),
  };
}

export interface LoginInput {
  /** dealer/sales ต้องระบุร้าน; admin ไม่ต้อง (เห็นทุกร้าน) */
  dealerCode?: string;
  role: Role;
  empId?: string;
  /** sales: รหัส/ชื่อพนักงานขายจาก sale_reps (ใช้ scope commission รายคน) */
  repCode?: string;
  repName?: string;
  repCr?: string;
  repDealerName?: string;
  repModel?: string;
  /** area: ร้านที่ดูแล + ชื่อ */
  areaStores?: string[];
  areaName?: string;
  /** area: บทบาทจริงใน profiles (area | coach | re | area_head) — session ใช้ role "area" ร่วมกัน */
  areaKind?: string;
}

export function doLogin({ dealerCode, role, empId, repCode, repName, repCr, repDealerName, repModel, areaStores, areaName, areaKind }: LoginInput) {
  sessionStorage.setItem(KEYS.loggedIn, "true");
  sessionStorage.removeItem("loggedOut");
  if (role === "area") {
    sessionStorage.setItem(KEYS.areaStores, JSON.stringify(areaStores ?? []));
    if (areaName) sessionStorage.setItem(KEYS.areaName, areaName);
    else sessionStorage.removeItem(KEYS.areaName);
    sessionStorage.setItem(KEYS.areaKind, areaKind || "area");
  } else {
    sessionStorage.removeItem(KEYS.areaStores);
    sessionStorage.removeItem(KEYS.areaName);
    sessionStorage.removeItem(KEYS.areaKind);
  }
  // login ใหม่ -> ยังไม่เลือกร้าน (Area เลือกจากหน้าร้านที่ดูแล)
  sessionStorage.removeItem(KEYS.areaViewDealer);
  if (dealerCode) sessionStorage.setItem(KEYS.dealerCode, dealerCode);
  else sessionStorage.removeItem(KEYS.dealerCode);
  sessionStorage.setItem(KEYS.role, role);
  if (role === "sales" && empId) sessionStorage.setItem(KEYS.empId, empId);
  else sessionStorage.removeItem(KEYS.empId);
  if (role === "sales" && repCode) sessionStorage.setItem(KEYS.repCode, repCode);
  else sessionStorage.removeItem(KEYS.repCode);
  if (role === "sales" && repName) sessionStorage.setItem(KEYS.repName, repName);
  else sessionStorage.removeItem(KEYS.repName);
  if (role === "sales" && repCr) sessionStorage.setItem(KEYS.repCr, repCr);
  else sessionStorage.removeItem(KEYS.repCr);
  if (role === "sales" && repDealerName) sessionStorage.setItem(KEYS.repDealerName, repDealerName);
  else sessionStorage.removeItem(KEYS.repDealerName);
  if (role === "sales" && repModel) sessionStorage.setItem(KEYS.repModel, repModel);
  else sessionStorage.removeItem(KEYS.repModel);
  // admin เริ่มต้นที่ "ทุกร้าน" + ไม่อยู่ในมุมมองใด
  sessionStorage.removeItem(KEYS.storeFilter);
  sessionStorage.removeItem(KEYS.adminViewMode);
  sessionStorage.removeItem(KEYS.adminViewDealer);
  sessionStorage.removeItem(KEYS.adminViewRep);
  sessionStorage.removeItem(KEYS.adminViewRepName);
  sessionStorage.setItem(KEYS.filter, JSON.stringify(defaultFilterState()));
  sessionStorage.setItem(KEYS.panelOpen, "0");
  // ล้าง cache แล้วแจ้ง subscriber เพื่อให้ทุกหน้าอ่าน session ใหม่ (role/empId ที่เพิ่งเปลี่ยน)
  emit();
}

/** admin: ตั้งร้านที่เจาะดู (null = ทุกร้าน) — ถ้าอยู่ในมุมมองร้าน ให้เปลี่ยนร้านของมุมมองด้วย (ช่องเลือกร้านที่เดียว) */
export function setStoreFilter(code: string | null) {
  if (code) sessionStorage.setItem(KEYS.storeFilter, code);
  else sessionStorage.removeItem(KEYS.storeFilter);
  if (code && sessionStorage.getItem(KEYS.adminViewMode) === "store") {
    sessionStorage.setItem(KEYS.adminViewDealer, code);
  }
  emit();
}

/** Area/Coach/หัวหน้า Area: เลือกร้านที่จะดูข้อมูล (ต้องเป็นร้านที่ดูแล) ; null = ล้าง */
export function setAreaStore(code: string | null) {
  if (code) sessionStorage.setItem(KEYS.areaViewDealer, code);
  else sessionStorage.removeItem(KEYS.areaViewDealer);
  emit();
}

/** admin: เข้า "มุมมองร้านค้า" ของร้านที่ระบุ (ดูหน้าเหมือน dealer) */
export function enterStoreView(dealerCode: string) {
  sessionStorage.setItem(KEYS.adminViewMode, "store");
  sessionStorage.setItem(KEYS.adminViewDealer, dealerCode);
  sessionStorage.removeItem(KEYS.adminViewRep);
  sessionStorage.removeItem(KEYS.adminViewRepName);
  emit();
}

/** admin: เข้า "มุมมองพนักงาน" (ดูหน้าเหมือน sales รายคน) ของร้าน+rep ที่ระบุ */
export function enterStaffView(dealerCode: string, repCode: string, repName?: string | null) {
  sessionStorage.setItem(KEYS.adminViewMode, "staff");
  sessionStorage.setItem(KEYS.adminViewDealer, dealerCode);
  sessionStorage.setItem(KEYS.adminViewRep, repCode);
  if (repName) sessionStorage.setItem(KEYS.adminViewRepName, repName);
  else sessionStorage.removeItem(KEYS.adminViewRepName);
  emit();
}

/** admin: ออกจากมุมมอง กลับสู่โหมดผู้ดูแลปกติ */
export function exitAdminView() {
  sessionStorage.removeItem(KEYS.adminViewMode);
  sessionStorage.removeItem(KEYS.adminViewDealer);
  sessionStorage.removeItem(KEYS.adminViewRep);
  sessionStorage.removeItem(KEYS.adminViewRepName);
  emit();
}

/** ธง "เพิ่งกดออกจากระบบ" — กันหน้า login กู้ session คืนก่อน signOut ของ Supabase จะเสร็จ */
export const LOGGED_OUT_KEY = "loggedOut";

export function doLogout() {
  sessionStorage.removeItem("mustChangePw");
  sessionStorage.setItem(LOGGED_OUT_KEY, "1");
  // ออกจาก Supabase session จริงด้วย (ไม่แตะ anonymous ของเดโม) กัน API ฝั่ง server ยัง scope ตามผู้ใช้เดิม
  const sb = createClient();
  sb.auth
    .getSession()
    .then(({ data }) => {
      if (data.session && !data.session.user.is_anonymous) return sb.auth.signOut();
    })
    .catch(() => {});
  sessionStorage.removeItem(KEYS.loggedIn);
  sessionStorage.removeItem(KEYS.dealerCode);
  sessionStorage.removeItem(KEYS.role);
  sessionStorage.removeItem(KEYS.empId);
  sessionStorage.removeItem(KEYS.storeFilter);
  sessionStorage.removeItem(KEYS.repCode);
  sessionStorage.removeItem(KEYS.repName);
  sessionStorage.removeItem(KEYS.repCr);
  sessionStorage.removeItem(KEYS.repDealerName);
  sessionStorage.removeItem(KEYS.repModel);
  sessionStorage.removeItem(KEYS.areaStores);
  sessionStorage.removeItem(KEYS.areaName);
  sessionStorage.removeItem(KEYS.areaViewDealer);
  sessionStorage.removeItem(KEYS.areaKind);
  sessionStorage.removeItem(KEYS.adminViewMode);
  sessionStorage.removeItem(KEYS.adminViewDealer);
  sessionStorage.removeItem(KEYS.adminViewRep);
  sessionStorage.removeItem(KEYS.adminViewRepName);
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

/** ปลายทางปุ่ม "กลับ"/หน้าหลักตาม role: ร้านค้า -> Hub ร้าน, พนักงาน -> Hub พนักงาน, admin -> dashboard */
export function useHomeHref(): string {
  const { session } = useSession();
  if (session && session.isSales) return "/app/home-staff";
  // Area: เลือกร้านแล้ว -> หน้าหลักของร้านนั้น ; ยังไม่เลือก -> รายชื่อร้านที่ดูแล
  if (session && session.isArea) return session.areaViewDealer ? "/app/home" : "/app/stores";
  // admin ใช้ Hub ร่วมกับร้านค้า (เวอร์ชันทุกร้าน)
  return "/app/home";
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

/* เมื่อ dataset ถูก hydrate จาก Supabase เสร็จ ให้ล้าง cache ของ session
   แล้วแจ้ง subscriber — เพราะ readSession() ใช้ getDealers()/employeeById()
   ซึ่งค่าจะเปลี่ยนหลังข้อมูลโหลดเข้ามา (me/dealer ต้อง resolve ใหม่) */
if (typeof window !== "undefined") {
  subscribeDataset(() => emit());
}
