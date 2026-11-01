import { Suspense } from "react";
import { LhsCommissionScreen } from "@/components/commission/lhs-commission-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function LhsCommissionPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <LhsCommissionScreen />
    </Suspense>
  );
}
