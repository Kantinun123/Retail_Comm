import { Suspense } from "react";
import { HomeHubScreen } from "@/components/commission/home-hub-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function HomePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <HomeHubScreen />
    </Suspense>
  );
}
