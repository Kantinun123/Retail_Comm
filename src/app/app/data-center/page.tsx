import { Suspense } from "react";
import { DataCenterScreen } from "@/components/commission/data-center-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function DataCenterPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <DataCenterScreen />
    </Suspense>
  );
}
