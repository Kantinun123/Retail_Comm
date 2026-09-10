import { Suspense } from "react";
import { AnalysisScreen } from "@/components/commission/analysis-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export default function AnalysisPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AnalysisScreen />
    </Suspense>
  );
}
