import { Suspense } from "react";
import { CustSatScreen } from "@/components/commission/cust-sat-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function CustSatPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <CustSatScreen />
    </Suspense>
  );
}
