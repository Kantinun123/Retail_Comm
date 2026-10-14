import { Suspense } from "react";
import { AnalysisScreen } from "@/components/commission/analysis-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session/dataset-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function AnalysisPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AnalysisScreen />
    </Suspense>
  );
}
