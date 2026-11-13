"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/commission/session";
import { useDatasetReady } from "@/lib/commission/dataset";

/** หน้าที่ Area ใช้ได้โดยยังไม่ต้องเลือกร้าน (ที่เหลือเป็นหน้าข้อมูลรายร้าน) */
const AREA_NO_STORE_OK = ["/app/stores", "/app/store", "/app/change-password", "/app/chat", "/app/member", "/app/employee-requests", "/app/eval-tracking"];

/** Redirects to the login page when there is no active session. */
export function AppGuard({ children }: { children: React.ReactNode }) {
  // โหลดข้อมูลจาก Supabase ก่อน (hook เริ่ม hydrate อัตโนมัติ + anonymous sign-in
  // เป็นสะพานให้ผ่าน RLS). "ready" = โหลดเสร็จ, "error" = โหลดไม่ได้แต่ fallback
  // mock ยังใช้ต่อได้ (แอปไม่พัง)
  const datasetState = useDatasetReady();
  const dataReady = datasetState === "ready" || datasetState === "error";

  const { session, ready } = useSession();
  const router = useRouter();

  const pathname = usePathname();

  useEffect(() => {
    if (dataReady && ready && (!session || !session.loggedIn)) {
      // ส่งหน้าปัจจุบันไปด้วย: ถ้า Supabase ยังจำการ login (เช่นเปิดแอปจากไอคอนใหม่)
      // หน้า login จะกู้ session แล้วพากลับมาหน้านี้
      router.replace(pathname && pathname !== "/app/change-password" ? `/?next=${encodeURIComponent(pathname)}` : "/");
      return;
    }
    // Area/Coach/หัวหน้า Area: หน้าข้อมูลต้องเลือกร้านก่อน (เลือกจากหน้าร้านที่ดูแล)
    if (session?.loggedIn && session.isArea && !session.areaViewDealer && pathname && !AREA_NO_STORE_OK.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      router.replace("/app/stores");
      return;
    }
    // บัญชีที่ admin แจกให้: ต้องเปลี่ยนรหัสผ่านก่อนใช้หน้าอื่น
    if (
      session?.loggedIn &&
      sessionStorage.getItem("mustChangePw") === "1" &&
      pathname !== "/app/change-password"
    ) {
      router.replace("/app/change-password");
    }
  }, [dataReady, ready, session, router, pathname]);

  if (!dataReady || !ready || !session || !session.loggedIn) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-300">
        <span className="material-symbols-outlined animate-pulse text-4xl">
          progress_activity
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
