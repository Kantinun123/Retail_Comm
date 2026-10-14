import { Suspense } from "react";
import { StaffIncentiveScreen } from "@/components/commission/staff-incentive-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session/dataset-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function StaffIncentivePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <StaffIncentiveScreen />
    </Suspense>
  );
}
