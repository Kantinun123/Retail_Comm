"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/commission/session";
import { useDatasetReady } from "@/lib/commission/dataset";

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
      router.replace("/");
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
