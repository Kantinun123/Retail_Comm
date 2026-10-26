import { Suspense } from "react";
import { CheckinScreen } from "@/components/commission/checkin-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function CheckinPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <CheckinScreen />
    </Suspense>
  );
}
