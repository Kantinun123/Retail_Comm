import { Suspense } from "react";
import { StoresScreen } from "@/components/commission/stores-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session/dataset-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function StoresPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <StoresScreen />
    </Suspense>
  );
}
