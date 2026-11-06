/* =============================================================
   สิทธิ์ของหน้า "ร้านค้าและทีมงาน" — กำหนดไว้จุดเดียว
   ตอนนี้ตัดสินจาก role ใน session (admin / ร้านค้า / พนักงาน)
   เมื่อมี user โค้ช/Area และระบบสิทธิ์จริง แก้ที่ฟังก์ชันนี้ที่เดียว

   หมายเหตุ: นี่คือการซ่อน/แสดงปุ่มที่หน้าจอเท่านั้น
   การบังคับสิทธิ์ฝั่งเซิร์ฟเวอร์ (API) จะมีผลจริงเมื่อเปิดโหมด login จริง
   (NEXT_PUBLIC_REAL_AUTH=1) — ตอนนี้โหมดเดโม API ไม่ได้ตรวจสิทธิ์
   ============================================================= */

import type { SessionData } from "./session";

export interface StoreTeamCaps {
  /** เห็นรายการทุกร้าน (ไม่ใช่เฉพาะร้านตัวเอง) */
  canViewAllStores: boolean;
  /** เพิ่ม/แก้/พักงานพนักงาน + อัปโหลดรูป */
  canEditEmployee: boolean;
  /** เปิด/ปิดใช้งานร้าน */
  canToggleStore: boolean;
  /** เปลี่ยน/เอาออก Area และ Coach ของร้าน */
  canManageSupervisors: boolean;
  /** เพิ่ม/เปลี่ยนรูปร้าน */
  canEditStore: boolean;
}

export function getStoreTeamCaps(session: SessionData | null): StoreTeamCaps {
  const isAdmin = !!session?.isAdmin;
  return {
    // admin = ทุกร้าน ; Area/Coach = รายการร้านที่ดูแล (กรองที่หน้าจอ + บังคับที่ API)
    canViewAllStores: isAdmin || !!session?.isArea,
    canEditEmployee: isAdmin,
    canToggleStore: isAdmin,
    canManageSupervisors: isAdmin,
    canEditStore: isAdmin,
  };
}
