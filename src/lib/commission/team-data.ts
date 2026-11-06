"use client";

/* ข้อมูลร้าน + roster (พนักงาน/หัวหน้า) ของร้านเดียว สำหรับหน้า "ฉัน"
   - cache ระดับโมดูลต่อรหัสร้าน เพื่อให้หัวการ์ดโปรไฟล์และการ์ดทีมงานใช้ข้อมูลเดียวกัน (ยิง API ครั้งเดียว)
   - ล้าง cache ที่ invalidateTeamData() หรือรีเฟรชหน้า */
import { useEffect, useState } from "react";
import { useSession } from "./session";
import {
  fetchStore,
  fetchStoreRoster,
  type Employee,
  type StoreInfo,
} from "./employee-store";

export interface TeamData {
  code: string;
  roster: Employee[];
  store: StoreInfo | null;
}

const cache = new Map<string, Promise<TeamData>>();

function load(code: string): Promise<TeamData> {
  let p = cache.get(code);
  if (!p) {
    p = Promise.all([fetchStoreRoster(code), fetchStore(code)])
      .then(([roster, store]) => ({ code, roster, store }))
      .catch((e) => {
        cache.delete(code); // ล้มเหลว -> ให้ลองใหม่ครั้งหน้า
        throw e;
      });
    cache.set(code, p);
  }
  return p;
}

export function invalidateTeamData(code?: string) {
  if (code) cache.delete(code);
  else cache.clear();
}

/** โหลดข้อมูลทีมของร้าน (ว่าง = ไม่โหลด) ; คืน null จนกว่าจะโหลดเสร็จ */
/** พนักงานขายที่ล็อกอินอยู่ (จากฐานข้อมูล) — null ถ้าไม่ใช่พนักงานขาย/ยังโหลดไม่เสร็จ/ไม่พบ */
export function useMyRep(): Employee | null {
  const { session } = useSession();
  const code = session && session.isSales ? session.dealer.code : "";
  const data = useTeamData(code);
  const empId = session?.empId ?? null;
  return (empId && data?.roster.find((e) => e.repCode === empId)) || null;
}

export function useTeamData(dealerCode: string): TeamData | null {
  const [data, setData] = useState<TeamData | null>(null);

  useEffect(() => {
    if (!dealerCode) return;
    let cancelled = false;
    load(dealerCode)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  return data && data.code === dealerCode ? data : null;
}
