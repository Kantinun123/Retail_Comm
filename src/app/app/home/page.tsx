import { Suspense } from "react";
import { HomeRouter } from "@/components/commission/home-router";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function HomePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <HomeRouter />
    </Suspense>
  );
}
