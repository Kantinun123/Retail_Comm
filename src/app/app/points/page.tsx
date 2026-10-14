import { Suspense } from "react";
import { PointsScreen } from "@/components/commission/points-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session/dataset-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function PointsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PointsScreen />
    </Suspense>
  );
}
