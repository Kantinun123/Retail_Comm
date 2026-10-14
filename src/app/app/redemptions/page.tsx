import { Suspense } from "react";
import { RedemptionsScreen } from "@/components/commission/redemptions-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function RedemptionsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <RedemptionsScreen />
    </Suspense>
  );
}
