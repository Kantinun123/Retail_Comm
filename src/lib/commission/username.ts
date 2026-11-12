/* ชื่อผู้ใช้ <-> อีเมล Supabase Auth (ใช้ได้ทั้ง client และ server) */

/** โดเมนอีเมลภายในของบัญชีที่ไม่มีอีเมลจริง (ร้านค้า: ชื่อผู้ใช้ = รหัสร้าน + ชื่อย่อ 4 ตัว เช่น 5100895smrt) */
export const LOCAL_ACCOUNT_DOMAIN = "retail-comm.local";

/** ชื่อผู้ใช้ -> อีเมลที่ใช้กับ Supabase Auth
 *  - มี @ = อีเมลจริง (Area/Coach/admin)
 *  - ไม่มี @ = ชื่อผู้ใช้ร้าน -> <username>@retail-comm.local (ต้องพิมพ์เต็ม แบบเข้ม ; ตัวพิมพ์เล็ก/ใหญ่ไม่มีผล) */
export function usernameToEmail(input: string): string {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  return s.includes("@") ? s : `${s}@${LOCAL_ACCOUNT_DOMAIN}`;
}

/** อีเมล -> ชื่อผู้ใช้ที่แสดง/แจกให้ผู้ใช้ (ตัด @retail-comm.local ออก ; อีเมลจริงคงเดิม) */
export function emailToUsername(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  const suffix = `@${LOCAL_ACCOUNT_DOMAIN}`;
  return e.toLowerCase().endsWith(suffix) ? e.slice(0, -suffix.length) : e;
}

/** ชื่อผู้ใช้ร้านแบบเข้ม: <รหัสร้าน><a-z 4 ตัว> */
export function isValidStoreUsername(username: string, dealerCode: string): boolean {
  return new RegExp(`^${dealerCode.replace(/[^0-9A-Za-z]/g, "")}[a-z]{4}$`).test(username);
}
