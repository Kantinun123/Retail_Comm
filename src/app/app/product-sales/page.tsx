import { Suspense } from "react";
import { ProductSalesScreen } from "@/components/commission/product-sales-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function ProductSalesPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ProductSalesScreen />
    </Suspense>
  );
}
