/* =============================================================
   โปรไฟล์เสริม (ข้อมูลส่วนตัวที่ผู้ใช้แก้ไขเองได้)

   แนวทาง A: เก็บแยกจากข้อมูลดิบ (salesTeam/dealers) เพื่อไม่ให้
   กระทบการคำนวณ และไม่ถูกทับเมื่อแอดมินอัปโหลดไฟล์ใหม่
   เก็บใน localStorage ของเครื่องนี้ (ยังไม่ sync ข้ามอุปกรณ์)

   คีย์แยกตามตัวตน: "emp:<empId>" หรือ "dealer:<dealerCode>"
   แก้ได้เฉพาะ: เบอร์โทร, อีเมล, ไลน์, รูปโปรไฟล์
   (ชื่อ/รหัส/ร้าน/ยอด = อ่านอย่างเดียว ไม่อยู่ในนี้)
   ============================================================= */

export interface ProfileOverride {
  phone?: string;
  email?: string;
  line?: string;
  /** URL รูป หรือ data URL (base64) ของรูปที่อัปโหลด */
  photoUrl?: string;
}

const STORAGE_KEY = "cmProfileOverrides";

type Store = Record<string, ProfileOverride>;

/** สร้างคีย์ตัวตนจาก role */
export function profileKey(opts: {
  isSales: boolean;
  empId?: string | null;
  dealerCode?: string | null;
}): string | null {
  if (opts.isSales && opts.empId) return `emp:${opts.empId}`;
  if (!opts.isSales && opts.dealerCode) return `dealer:${opts.dealerCode}`;
  return null;
}

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
}

/* ---------------- pub/sub ---------------- */
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeProfile(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/* ---------------- public API ---------------- */
/** อ่าน override ของคีย์หนึ่ง (คืน {} ถ้าไม่มี) */
export function getProfileOverride(key: string | null): ProfileOverride {
  if (!key) return {};
  return readStore()[key] ?? {};
}

/** บันทึก override (merge กับของเดิม) — ค่า "" หรือ undefined = ลบ field นั้น */
export function setProfileOverride(key: string, patch: ProfileOverride) {
  const store = readStore();
  const next: ProfileOverride = { ...store[key] };
  (Object.keys(patch) as (keyof ProfileOverride)[]).forEach((k) => {
    const v = patch[k];
    if (v === undefined || v === "") delete next[k];
    else next[k] = v;
  });
  if (Object.keys(next).length === 0) {
    delete store[key];
  } else {
    store[key] = next;
  }
  writeStore(store);
  emit();
}

/**
 * รวมข้อมูลดิบกับ override -> ค่าที่ใช้แสดงผล
 * override ชนะข้อมูลดิบเสมอ (ถ้ามี)
 */
export function resolveProfile(
  key: string | null,
  base: { phone?: string; photoUrl?: string }
): Required<Pick<ProfileOverride, never>> & {
  phone: string;
  email: string;
  line: string;
  photoUrl: string;
} {
  const o = getProfileOverride(key);
  return {
    phone: o.phone ?? base.phone ?? "",
    email: o.email ?? "",
    line: o.line ?? "",
    photoUrl: o.photoUrl ?? base.photoUrl ?? "",
  };
}
