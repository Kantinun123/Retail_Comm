import { Suspense } from "react";
import { RefundFormScreen } from "@/components/commission/refund/refund-form-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";
export const instant = false;
export default function RefundNewPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <RefundFormScreen />
    </Suspense>
  );
}