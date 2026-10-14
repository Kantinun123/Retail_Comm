import { Suspense } from "react";
import { DatabaseScreen } from "@/components/commission/database-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session/dataset-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function DatabasePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <DatabaseScreen />
    </Suspense>
  );
}
