"use client";

/* =============================================================
   หน้า "ฉัน" ของ Admin / หัวหน้า Area / Area / Coach
   - fetchMyProfile(): ข้อมูลของฉัน + ผังทีม (จาก /api/me/profile)
   - buildOrg(): จัดผังตามบทบาท (หัวหน้า -> Area -> Coach -> ร้าน -> พนักงาน)
   - saveMyProfile() / uploadMyPhoto(): แก้ข้อมูลของตัวเองเท่านั้น
   ============================================================= */
import { fileToResizedBlob } from "./image";
import type { LevelKey, PositionKey } from "./employee-store";

export type MeKind = "admin" | "area_head" | "area" | "coach" | "re";

export interface Contact {
  id?: string;
  repCode?: string | null;
  name: string;
  nickname: string | null;
  title?: string | null;
  photoUrl: string | null;
  phone: string | null;
  phone2?: string | null;
  email: string | null;
  lineId: string | null;
}

export interface Me extends Contact {
  kind: MeKind;
  editable: "rep" | "profile";
}

export interface Person extends Contact {
  repCode: string;
  position: PositionKey | null;
  level: LevelKey | null;
  startDate: string | null;
  dealerCode: string | null;
}

export interface OrgStore {
  code: string;
  name: string;
  model: string | null;
  region: string | null;
  areaReps: string[];
  coachReps: string[];
  staff: Person[];
  seCount: number;
}

export interface MyProfileData {
  me: Me;
  admins: Contact[];
  heads: Contact[];
  stores: OrgStore[];
  people: Map<string, Person>;
}

const SUPERVISOR = new Set(["area_mng", "coach"]);

export async function fetchMyProfile(): Promise<{ ok: true; data: MyProfileData } | { ok: false; status: number; error: string }> {
  const res = await fetch("/api/me/profile", { cache: "no-store" });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) return { ok: false, status: res.status, error: j?.error ?? "โหลดข้อมูลไม่สำเร็จ" };

  const people = new Map<string, Person>();
  (j.people ?? []).forEach((p: Person) => people.set(p.repCode, p));
  const asg = (j.assignments ?? []) as { repCode: string; dealerCode: string; role: string }[];
  const stores: OrgStore[] = (j.stores ?? []).map((d: { code: string; name: string; model: string | null; region: string | null }) => {
    const staff = [...people.values()]
      .filter((p) => p.dealerCode === d.code && !SUPERVISOR.has(p.position ?? ""))
      .sort((a, b) => staffRank(a) - staffRank(b) || a.name.localeCompare(b.name, "th"));
    return {
      ...d,
      areaReps: asg.filter((a) => a.dealerCode === d.code && a.role === "manager").map((a) => a.repCode),
      coachReps: asg.filter((a) => a.dealerCode === d.code && a.role === "coach").map((a) => a.repCode),
      staff,
      seCount: staff.filter((p) => p.position === "se").length,
    };
  });
  return {
    ok: true,
    data: { me: j.me as Me, admins: j.admins ?? [], heads: j.heads ?? [], stores, people },
  };
}

/** ลำดับในร้าน: ผู้บริหาร -> SE (A > S > B) -> อื่น ๆ */
function staffRank(p: Person): number {
  if (p.position === "store_exec") return 0;
  if (p.position === "se") return p.level === "A" ? 1 : p.level === "S" ? 2 : p.level === "B" ? 3 : 4;
  return 5;
}

/** ร้านที่ควรดูก่อน (ไม่มี SE) ขึ้นก่อน แล้วเรียงตามชื่อ */
export function sortStores(list: OrgStore[]): OrgStore[] {
  return [...list].sort((a, b) => Number(a.seCount > 0) - Number(b.seCount > 0) || a.name.localeCompare(b.name, "th"));
}

/** กลุ่มร้านตามหัวหน้าระดับถัดไป (Area หรือ Coach) — ร้านที่ไม่มีหัวหน้าในกลุ่มนั้นอยู่กลุ่ม "ยังไม่ระบุ" */
export function groupBy(stores: OrgStore[], key: "areaReps" | "coachReps"): { repCode: string | null; stores: OrgStore[] }[] {
  const map = new Map<string | null, OrgStore[]>();
  stores.forEach((s) => {
    const reps = s[key].length ? s[key] : [null];
    reps.forEach((r) => map.set(r, [...(map.get(r) ?? []), s]));
  });
  return [...map.entries()]
    .map(([repCode, list]) => ({ repCode, stores: sortStores(list) }))
    .sort((a, b) => (a.repCode === null ? 1 : b.repCode === null ? -1 : b.stores.length - a.stores.length));
}

export function countStaff(stores: OrgStore[]) {
  return stores.reduce((acc, s) => ({ staff: acc.staff + s.staff.length, se: acc.se + s.seCount }), { staff: 0, se: 0 });
}

export async function saveMyProfile(input: { nickname: string; phone: string; phone2?: string; lineId: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await res.json().catch(() => ({ ok: false, error: "บันทึกไม่สำเร็จ" }))) as { ok: boolean; error?: string };
}

export async function uploadMyPhoto(file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  let blob: Blob;
  try {
    blob = await fileToResizedBlob(file, 800);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ประมวลผลรูปไม่สำเร็จ" };
  }
  const fd = new FormData();
  fd.append("file", new File([blob], "me.jpg", { type: "image/jpeg" }));
  const res = await fetch("/api/me/photo", { method: "POST", body: fd });
  return (await res.json().catch(() => ({ ok: false, error: "อัปโหลดไม่สำเร็จ" }))) as { ok: boolean; url?: string; error?: string };
}

/** ลิงก์เปิด Line จาก Line ID (ID ที่ขึ้นต้นด้วย @ = บัญชีทางการ) */
export function lineHref(id: string): string {
  const v = id.trim();
  return v.startsWith("@") ? `https://line.me/R/ti/p/${encodeURIComponent(v)}` : `https://line.me/ti/p/~${encodeURIComponent(v)}`;
}
