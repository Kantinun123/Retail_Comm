import { Suspense } from "react";
import { CommissionProductScreen } from "@/components/commission/commission-product-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function CommissionProductPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <CommissionProductScreen />
    </Suspense>
  );
}
