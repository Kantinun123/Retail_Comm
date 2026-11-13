import { Suspense } from "react";
import { AreaHomeScreen } from "@/components/commission/area-home-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function AreaHomePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AreaHomeScreen />
    </Suspense>
  );
}
