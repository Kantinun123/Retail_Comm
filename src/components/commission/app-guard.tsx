"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    if (dataReady && ready && (!session || !session.loggedIn)) {
      router.replace("/");
    }
  }, [dataReady, ready, session, router]);

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
