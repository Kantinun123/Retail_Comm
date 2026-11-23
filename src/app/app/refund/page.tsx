import { Suspense } from "react";
import { RefundListScreen } from "@/components/commission/refund/refund-list-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";
export const instant = false;
export default function RefundPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <RefundListScreen />
    </Suspense>
  );
}