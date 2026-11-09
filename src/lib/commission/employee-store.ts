"use client";

import { fileToResizedBlob } from "./image";

/* =============================================================
   ฐานข้อมูลพนักงาน + ร้านค้า (Store & Employee Master) — client data layer
   อ่าน/เขียนผ่าน /api/employees (+ /api/employees/admin)
   - roster รายร้าน (View B): พนักงานในร้าน + หัวหน้า (area/coach) ที่ดูแลร้านนี้
   - admin CRUD: เพิ่ม/แก้/ปิดใช้งานพนักงาน + อัปโหลดรูป
   ============================================================= */

/* ---------------- ค่าคงที่: ตำแหน่ง + ระดับ ---------------- */

export type PositionKey =
  | "store_exec"
  | "area_mng"
  | "coach"
  | "se"
  | "sale_floor";

export const POSITION_LABEL: Record<PositionKey, string> = {
  store_exec: "ผู้บริหารร้าน",
  area_mng: "Area Manager",
  coach: "Coach / RE",
  se: "Sales Expert (SE)",
  sale_floor: "Sale floor",
};

/** ตัวย่อบนป้าย (ภาพที่ 2) */
export const POSITION_SHORT: Record<PositionKey, string> = {
  store_exec: "EXEC",
  area_mng: "AM",
  coach: "RE",
  se: "SE",
  sale_floor: "SF",
};

/** ระดับพนักงาน: B=Beginner(1) S=Standard(2) A=Advance(3) */
export type LevelKey = "B" | "S" | "A";

export const LEVEL_META: Record<
  LevelKey,
  { label: string; rank: number; className: string }
> = {
  B: { label: "Beginner", rank: 1, className: "bg-slate-100 text-slate-600 border-slate-200" },
  S: { label: "Standard", rank: 2, className: "bg-sky-50 text-sky-700 border-sky-200" },
  A: { label: "Advance", rank: 3, className: "bg-amber-50 text-amber-700 border-amber-200" },
};

/** พนักงานเข้างานไม่เกินกี่วันถึงนับเป็น "ใหม่" */
const NEW_EMPLOYEE_DAYS = 90;

/* ---------------- types ---------------- */

export interface Employee {
  repCode: string;
  crCode: string | null;
  name: string;
  nickname: string | null;
  position: PositionKey | null;
  level: LevelKey | null;
  photoUrl: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  lineId: string | null;
  birthDate: string | null;
  startDate: string | null;
  skills: string[];
  notes: string | null;
  isActive: boolean;
  dealerCode: string | null;
  /** เฉพาะ roster: เป็นหัวหน้า (area/coach) ที่ดูแลร้านนี้ผ่าน assignment ไหม */
  isSupervisor: boolean;
  roleInStore: string | null;
}

export interface StoreInfo {
  code: string;
  name: string;
  model: string | null;
  region: string | null;
  province: string | null;
  branch: string | null;
  tier: string | null;
  logoUrl: string | null;
  /** รูปร้าน (ป้าย/หน้าร้าน) */
  photoUrl: string | null;
  isActive: boolean;
  empCount: number;
  /** จำนวนแยกตามตำแหน่ง (เฉพาะพนักงานในร้าน — ไม่รวม Area/Coach ที่ผูกผ่าน assignment) */
  seCount: number;
  saleFloorCount: number;
  execCount: number;
  otherCount: number;
  /** SE แยกตามระดับ (A=Advance, S=Standard, B=Beginner, ยังไม่ระบุระดับ) */
  seACount: number;
  seSCount: number;
  seBCount: number;
  seNoLevelCount: number;
}

/* ---------------- map helpers (snake -> camel) ---------------- */

type RawEmployee = {
  rep_code: string;
  cr_code: string | null;
  name: string;
  nickname: string | null;
  position: string | null;
  level: string | null;
  photo_url: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  line_id: string | null;
  birth_date: string | null;
  start_date: string | null;
  skills: string[] | null;
  notes: string | null;
  is_active: boolean;
  dealer_code: string | null;
  is_supervisor?: boolean;
  role_in_store?: string | null;
};

export function mapEmployee(r: RawEmployee): Employee {
  return {
    repCode: r.rep_code,
    crCode: r.cr_code,
    name: r.name,
    nickname: r.nickname,
    position: (r.position as PositionKey) ?? null,
    level: (r.level as LevelKey) ?? null,
    photoUrl: r.photo_url,
    phone: r.phone,
    phone2: r.phone2,
    email: r.email,
    lineId: r.line_id,
    birthDate: r.birth_date,
    startDate: r.start_date,
    skills: Array.isArray(r.skills) ? r.skills : [],
    notes: r.notes,
    isActive: r.is_active ?? true,
    dealerCode: r.dealer_code,
    isSupervisor: !!r.is_supervisor,
    roleInStore: r.role_in_store ?? null,
  };
}

type RawStore = {
  code: string;
  name: string;
  model: string | null;
  region: string | null;
  province: string | null;
  branch: string | null;
  tier: string | null;
  logo_url: string | null;
  photo_url?: string | null;
  is_active: boolean;
  emp_count: number | string;
  se_count?: number | string;
  sale_floor_count?: number | string;
  exec_count?: number | string;
  other_count?: number | string;
  se_a_count?: number | string;
  se_s_count?: number | string;
  se_b_count?: number | string;
  se_nolevel_count?: number | string;
};

function mapStore(r: RawStore): StoreInfo {
  return {
    code: r.code,
    name: r.name,
    model: r.model,
    region: r.region,
    province: r.province,
    branch: r.branch,
    tier: r.tier,
    logoUrl: r.logo_url,
    photoUrl: r.photo_url ?? null,
    isActive: r.is_active ?? true,
    empCount: Number(r.emp_count ?? 0),
    seCount: Number(r.se_count ?? 0),
    saleFloorCount: Number(r.sale_floor_count ?? 0),
    execCount: Number(r.exec_count ?? 0),
    otherCount: Number(r.other_count ?? 0),
    seACount: Number(r.se_a_count ?? 0),
    seSCount: Number(r.se_s_count ?? 0),
    seBCount: Number(r.se_b_count ?? 0),
    seNoLevelCount: Number(r.se_nolevel_count ?? 0),
  };
}

/* ---------------- derived helpers ---------------- */

/** อายุงานจากวันเข้างาน -> "X ปี Y เดือน" (null ถ้าไม่มี/วันที่อนาคต) */
export function tenureFromStartDate(startDate: string | null): string | null {
  if (!startDate) return null;
  const s = new Date(startDate);
  if (Number.isNaN(s.getTime())) return null;
  const now = new Date();
  if (s.getTime() > now.getTime()) return null;

  let months =
    (now.getFullYear() - s.getFullYear()) * 12 +
    (now.getMonth() - s.getMonth());
  // ยังไม่ถึงวันที่ของเดือนนี้ -> ลบ 1 เดือน
  if (now.getDate() < s.getDate()) months--;
  if (months < 0) months = 0;

  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0 && rem > 0) return `${years} ปี ${rem} เดือน`;
  if (years > 0) return `${years} ปี`;
  if (rem > 0) return `${rem} เดือน`;
  return "น้อยกว่า 1 เดือน";
}

/** คำนวณอายุ (ปีเต็ม) จากวันเกิด — null ถ้าไม่มี/ไม่ถูกต้อง */
export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
}

/** พนักงานเข้างานภายใน NEW_EMPLOYEE_DAYS วัน = "ใหม่" */
export function isNewEmployee(startDate: string | null): boolean {
  if (!startDate) return false;
  const start = new Date(startDate).getTime();
  if (Number.isNaN(start)) return false;
  const days = (Date.now() - start) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= NEW_EMPLOYEE_DAYS;
}

/* ---------------- API calls (read) ---------------- */

/** รายชื่อร้านทั้งหมด + จำนวนพนักงาน (admin picker / รายการร้าน) */
export async function fetchStores(): Promise<StoreInfo[]> {
  const res = await fetch("/api/employees?mode=stores", {
    method: "GET",
    cache: "no-store",
  });
  const raw = (await res.json()) as { ok?: boolean; stores?: RawStore[] };
  return raw.ok && Array.isArray(raw.stores) ? raw.stores.map(mapStore) : [];
}

/** roster รายร้าน (View B) — พนักงานในร้าน + หัวหน้าที่ดูแล */
export async function fetchStoreRoster(dealerCode: string): Promise<Employee[]> {
  const res = await fetch(
    `/api/employees?mode=roster&dealerCode=${encodeURIComponent(dealerCode)}`,
    { method: "GET", cache: "no-store" }
  );
  const raw = (await res.json()) as { ok?: boolean; roster?: RawEmployee[] };
  return raw.ok && Array.isArray(raw.roster) ? raw.roster.map(mapEmployee) : [];
}

/** ข้อมูลร้านเดียว */
export async function fetchStore(dealerCode: string): Promise<StoreInfo | null> {
  const stores = await fetchStores();
  return stores.find((s) => s.code === dealerCode) ?? null;
}

/* ---------------- API calls (admin write) ---------------- */

export interface EmployeeInput {
  repCode?: string; // เว้นว่าง = สร้างใหม่ (ระบบ gen SR####)
  name: string;
  nickname?: string | null;
  dealerCode: string | null;
  position: PositionKey | null;
  level: LevelKey | null;
  phone?: string | null;
  phone2?: string | null;
  email?: string | null;
  lineId?: string | null;
  birthDate?: string | null;
  startDate?: string | null;
  skills?: string[];
  notes?: string | null;
  photoUrl?: string | null;
  isActive?: boolean;
}

export interface SaveResult {
  ok: boolean;
  repCode?: string;
  error?: string;
}

/** สร้าง/แก้ไขพนักงาน (admin) */
export async function saveEmployee(input: EmployeeInput): Promise<SaveResult> {
  const method = input.repCode ? "PATCH" : "POST";
  const res = await fetch("/api/employees/admin", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const raw = (await res.json()) as SaveResult;
  return raw;
}

/** ปิด/เปิดใช้งานพนักงาน (ไม่ลบจริง) */
export async function setEmployeeActive(
  repCode: string,
  isActive: boolean
): Promise<SaveResult> {
  const res = await fetch("/api/employees/admin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repCode, isActive }),
  });
  return (await res.json()) as SaveResult;
}

/** ปิด/เปิดใช้งานร้านค้า (ไม่ลบจริง) */
export async function setStoreActive(
  code: string,
  isActive: boolean
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/stores/admin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, isActive }),
  });
  return (await res.json()) as { ok: boolean; error?: string };
}

/** อัปโหลดรูปพนักงาน -> คืน public URL (เขียนผ่าน server/service-role) */
export async function uploadEmployeePhoto(
  repCode: string,
  file: File
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const fd = new FormData();
  fd.append("repCode", repCode);
  fd.append("file", file);
  const res = await fetch("/api/employees/admin/photo", {
    method: "POST",
    body: fd,
  });
  return (await res.json()) as { ok: boolean; url?: string; error?: string };
}

/** ลบรูปพนักงาน (ไฟล์ใน storage + photo_url) */
export async function deleteEmployeePhoto(
  repCode: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/employees/admin/photo?repCode=${encodeURIComponent(repCode)}`, {
    method: "DELETE",
  });
  return (await res.json()) as { ok: boolean; error?: string };
}

/* ---------------- Area / Coach ของร้าน ---------------- */

export type SupervisorRole = "manager" | "coach";

export interface SupervisorOption {
  repCode: string;
  name: string;
  nickname: string | null;
  position: "area_mng" | "coach";
}

/** รายชื่อ Area Manager + Coach ทั้งหมด (สำหรับเลือกในหน้ารายละเอียดร้าน) */
export async function fetchSupervisorOptions(): Promise<SupervisorOption[]> {
  const res = await fetch("/api/stores/admin/supervisor", {
    method: "GET",
    cache: "no-store",
  });
  const raw = (await res.json()) as {
    ok?: boolean;
    supervisors?: {
      rep_code: string;
      name: string;
      nickname: string | null;
      position: "area_mng" | "coach";
    }[];
  };
  if (!raw.ok || !Array.isArray(raw.supervisors)) return [];
  return raw.supervisors.map((s) => ({
    repCode: s.rep_code,
    name: s.name,
    nickname: s.nickname,
    position: s.position,
  }));
}

/** ตั้ง Area/Coach ของร้าน (แทนที่คนเดิมใน role นั้น) ; repCode = null = เอาออก */
export async function setStoreSupervisor(
  dealerCode: string,
  role: SupervisorRole,
  repCode: string | null
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/stores/admin/supervisor", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealerCode, role, repCode }),
  });
  return (await res.json()) as { ok: boolean; error?: string };
}

/* ---------------- รูปร้าน ---------------- */

/** อัปโหลดรูปร้าน (ย่อรูปที่เบราว์เซอร์ก่อนส่ง) -> คืน public URL */
export async function uploadStorePhoto(
  dealerCode: string,
  file: File
): Promise<{ ok: boolean; url?: string; error?: string }> {
  let blob: Blob;
  try {
    blob = await fileToResizedBlob(file);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ประมวลผลรูปไม่สำเร็จ" };
  }
  const fd = new FormData();
  fd.append("dealerCode", dealerCode);
  fd.append("file", new File([blob], `${dealerCode}.jpg`, { type: "image/jpeg" }));
  const res = await fetch("/api/stores/admin/photo", { method: "POST", body: fd });
  return (await res.json()) as { ok: boolean; url?: string; error?: string };
}
