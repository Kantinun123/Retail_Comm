"use client";

/* จำนวนงานที่รอ admin ดำเนินการ (คำขอสมัคร + คำขอรีเซ็ตรหัสผ่าน + คำขอเพิ่มพนักงาน)
   - ดึงจาก /api/admin/pending-counts (ต้องเป็น admin session จริง ไม่งั้นได้ 401 -> ไม่แสดงตัวเลข)
   - external store เดียวทั้งแอป: การ์ดหน้าหลักและกระดิ่งใช้ค่าเดียวกัน
   - โพลทุก 60 วินาทีและเมื่อกลับมาที่แท็บ ; refreshAdminPending() ให้หน้าที่แก้ไขสถานะเรียกซ้ำได้ */
import { useEffect, useSyncExternalStore } from "react";

export interface AdminPending {
  signups: number;
  resets: number;
  /** คำขอเพิ่มพนักงานใหม่ที่รออนุมัติ */
  employees: number;
  /** signups + resets (งานบัญชีผู้ใช้) */
  accounts: number;
  total: number;
}

const ZERO: AdminPending = { signups: 0, resets: 0, employees: 0, accounts: 0, total: 0 };
let state: AdminPending = ZERO;
const listeners = new Set<() => void>();

function setState(next: AdminPending) {
  if (next.signups === state.signups && next.resets === state.resets && next.employees === state.employees) return;
  state = next;
  listeners.forEach((l) => l());
}

export async function refreshAdminPending(): Promise<void> {
  try {
    const res = await fetch("/api/admin/pending-counts", { cache: "no-store" });
    if (!res.ok) {
      setState(ZERO); // ไม่ใช่ admin จริง/ยังไม่ login -> ไม่แสดงตัวเลข
      return;
    }
    const j = await res.json();
    if (j.ok) {
      const signups = Number(j.signups) || 0;
      const resets = Number(j.resets) || 0;
      const employees = Number(j.employees) || 0;
      setState({ signups, resets, employees, accounts: signups + resets, total: signups + resets + employees });
    }
  } catch {
    /* เงียบ ๆ ลองใหม่รอบถัดไป */
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** enabled = เฉพาะ admin ; คืนจำนวนงานที่รอ (0 ถ้าไม่ใช่ admin จริง) */
export function useAdminPending(enabled: boolean): AdminPending {
  const value = useSyncExternalStore(
    subscribe,
    () => state,
    () => ZERO
  );

  useEffect(() => {
    if (!enabled) return;
    refreshAdminPending();
    const timer = setInterval(refreshAdminPending, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshAdminPending();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  return enabled ? value : ZERO;
}
