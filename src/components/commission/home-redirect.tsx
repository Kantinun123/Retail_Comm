"use client";

/* หน้าเดิมที่เลิกใช้ (เช่น /app/dashboard "ภาพรวม") -> พาไปหน้าหลักตาม role
   ร้านค้า/admin = /app/home ; พนักงาน = /app/home-staff ; Area = ร้านที่ดูแล / ข้อมูลร้านที่เลือก */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHomeHref, useSession } from "@/lib/commission/session";

export function HomeRedirect() {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const router = useRouter();

  useEffect(() => {
    if (ready && session) router.replace(homeHref);
  }, [ready, session, homeHref, router]);

  return null;
}
