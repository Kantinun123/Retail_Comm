import { Suspense } from "react";
import { BenefitRollupScreen } from "@/components/commission/benefit-rollup-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function BenefitStorePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BenefitRollupScreen kind="store" />
    </Suspense>
  );
}
