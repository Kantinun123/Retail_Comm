import { Suspense } from "react";
import { ExamRankingScreen } from "@/components/commission/exam/exam-ranking-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function ExamRankingPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ExamRankingScreen />
    </Suspense>
  );
}
