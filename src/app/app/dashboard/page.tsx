import { Suspense } from "react";
import { DashboardScreen } from "@/components/commission/dashboard-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export default function DashboardPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <DashboardScreen />
    </Suspense>
  );
}
