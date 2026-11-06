import { randomInt } from "node:crypto";

// ตัดตัวที่สับสนง่าย (0/O, 1/l/I) ออก
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** รหัสผ่านชั่วคราวแบบสุ่ม (crypto) ความยาว 10 — แสดงให้ admin เห็นครั้งเดียว ห้ามเก็บ/ห้าม log */
export function generateTempPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CHARS[randomInt(CHARS.length)];
  return out;
}

export const MIN_PASSWORD_LENGTH = 8;
