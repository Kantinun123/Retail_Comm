"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/commission/session";

/** Redirects to the login page when there is no active session. */
export function AppGuard({ children }: { children: React.ReactNode }) {
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
