import { Suspense } from "react";
import { BackMarginScreen } from "@/components/commission/back-margin-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function BackMarginPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BackMarginScreen />
    </Suspense>
  );
}
