"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/commission/session";

/** Redirects to the login page when there is no active session. */
export function AppGuard({ children }: { children: React.ReactNode }) {
  // NB (Phase ง): ยังไม่เปิด Supabase hydration — RLS เป็น authenticated-only
  // แต่แอป login ด้วย sessionStorage (ไม่ใช่ Supabase Auth) ฝั่ง client จึงเป็น anon
  // และ RLS จะบล็อก. เปิดใช้ hydrateFromSupabase()/useDatasetReady() เมื่อเชื่อม
  // Supabase Auth จริงในเฟสถัดไป. ตอนนี้แอปอ่าน mock จาก raw-data ตามเดิม.
  const { session, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && (!session || !session.loggedIn)) {
      router.replace("/");
    }
  }, [ready, session, router]);

  if (!ready || !session || !session.loggedIn) {
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
