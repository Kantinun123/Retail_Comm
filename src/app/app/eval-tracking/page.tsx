import { Suspense } from "react";
import { EvalTrackingScreen } from "@/components/commission/eval-tracking-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function EvalTrackingPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <EvalTrackingScreen />
    </Suspense>
  );
}
