import { Suspense } from "react";
import { ServiceSalesScreen } from "@/components/commission/service-sales-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function ServiceSalesPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ServiceSalesScreen />
    </Suspense>
  );
}
