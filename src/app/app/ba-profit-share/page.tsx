import { Suspense } from "react";
import { BaProfitShareScreen } from "@/components/commission/ba-profit-share-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function BaProfitSharePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BaProfitShareScreen />
    </Suspense>
  );
}
