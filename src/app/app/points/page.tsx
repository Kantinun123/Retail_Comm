import { Suspense } from "react";
import { PointsScreen } from "@/components/commission/points-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export default function PointsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PointsScreen />
    </Suspense>
  );
}
