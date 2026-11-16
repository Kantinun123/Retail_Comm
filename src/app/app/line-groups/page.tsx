import { Suspense } from "react";
import { LineGroupsScreen } from "@/components/commission/line-groups-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function LineGroupsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <LineGroupsScreen />
    </Suspense>
  );
}
