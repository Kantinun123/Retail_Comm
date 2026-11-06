import { Suspense } from "react";
import { AdminUsersScreen } from "@/components/commission/admin-users-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AdminUsersScreen />
    </Suspense>
  );
}
