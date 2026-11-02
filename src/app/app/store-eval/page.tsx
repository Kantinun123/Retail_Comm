import { Suspense } from "react";
import { StoreEvalScreen } from "@/components/commission/store-eval-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function StoreEvalPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <StoreEvalScreen />
    </Suspense>
  );
}
