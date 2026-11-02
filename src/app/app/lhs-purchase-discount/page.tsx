import { Suspense } from "react";
import { LhsPurchaseDiscountScreen } from "@/components/commission/lhs-purchase-discount-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function LhsPurchaseDiscountPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <LhsPurchaseDiscountScreen />
    </Suspense>
  );
}
