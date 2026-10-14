import { Suspense } from "react";
import { DashboardScreen } from "@/components/commission/dashboard-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session/dataset-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function DashboardPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <DashboardScreen />
    </Suspense>
  );
}
