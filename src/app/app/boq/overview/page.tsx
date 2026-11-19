import { Suspense } from "react";
import { BoqOverviewScreen } from "@/components/commission/boq/boq-overview-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function BoqOverviewPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BoqOverviewScreen />
    </Suspense>
  );
}