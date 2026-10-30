import { Suspense } from "react";
import { BaIncentiveScreen } from "@/components/commission/ba-incentive-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function BaIncentivePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BaIncentiveScreen />
    </Suspense>
  );
}
