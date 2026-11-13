/* ค่ากลางของคำขอเพิ่มพนักงาน — ใช้ทั้ง client และ server (ไม่มี "use client") */

export const EDUCATION_OPTIONS = [
  "ต่ำกว่า ม.6",
  "ม.6",
  "ปวช.",
  "ปวส.",
  "ปริญญาตรี",
  "ปริญญาโทขึ้นไป",
  "อื่นๆ",
] as const;

/** ตำแหน่งที่ขอเพิ่มได้ ("other" = ไม่ระบุตำแหน่ง -> sale_reps.position null) */
export const REQUEST_POSITIONS = [
  { key: "se", label: "SE" },
  { key: "sale_floor", label: "Sale floor" },
  { key: "store_exec", label: "ผู้บริหารร้าน" },
  { key: "other", label: "อื่น" },
] as const;
export type RequestPosition = (typeof REQUEST_POSITIONS)[number]["key"];

export interface EmployeeRequestPayload {
  position: RequestPosition;
  name: string;
  nickname: string | null;
  phone: string;
  email: string;
  startDate: string; // YYYY-MM-DD
  lineId: string | null;
  birthDate: string | null;
  level: "B" | "S" | "A" | null;
  education: string | null;
  major: string | null;
  notes: string | null;
}

const PHONE_RE = /^[0-9+\-\s()]{9,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

/** ตรวจ + ทำความสะอาดข้อมูลแบบฟอร์ม ; คืน error ภาษาไทยเมื่อไม่ผ่าน */
export function validatePayload(raw: unknown): { ok: true; payload: EmployeeRequestPayload } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const position = String(b.position ?? "") as RequestPosition;
  if (!REQUEST_POSITIONS.some((p) => p.key === position)) return { ok: false, error: "กรุณาเลือกตำแหน่ง" };
  const name = str(b.name, 100);
  if (!name) return { ok: false, error: "กรุณากรอกชื่อ-นามสกุล" };
  const phone = str(b.phone, 20);
  if (!phone || !PHONE_RE.test(phone)) return { ok: false, error: "กรุณากรอกเบอร์โทรให้ถูกต้อง (ตัวเลขอย่างน้อย 9 หลัก)" };
  const email = str(b.email, 120)?.toLowerCase() ?? null;
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: "กรุณากรอกอีเมลให้ถูกต้อง" };
  const startDate = str(b.startDate, 10);
  if (!startDate || !DATE_RE.test(startDate)) return { ok: false, error: "กรุณาเลือกวันเข้างาน" };
  const birthDate = str(b.birthDate, 10);
  if (birthDate && !DATE_RE.test(birthDate)) return { ok: false, error: "วันเกิดไม่ถูกต้อง" };
  const lv = str(b.level, 1);
  const level = lv === "B" || lv === "S" || lv === "A" ? lv : null;
  const edu = str(b.education, 40);
  const education = edu && (EDUCATION_OPTIONS as readonly string[]).includes(edu) ? edu : null;
  return {
    ok: true,
    payload: {
      position,
      name,
      nickname: str(b.nickname, 40),
      phone,
      email,
      startDate,
      lineId: str(b.lineId, 50),
      birthDate,
      level: position === "se" ? level : null,
      education,
      major: str(b.major, 100),
      notes: str(b.notes, 500),
    },
  };
}

/** ชื่อสำหรับเทียบซ้ำ: ตัดคำนำหน้า + ช่องว่าง + ตัวพิมพ์ */
export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/^(นางสาว|น\.ส\.|นาย|นาง|คุณ|mr\.?|mrs\.?|ms\.?|miss)\s*/i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** เบอร์สำหรับเทียบซ้ำ: เลข 9 ตัวท้าย */
export function normalizePhone(phone: string | null | undefined): string {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
}
