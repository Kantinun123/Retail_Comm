import { Suspense } from "react";
import { ExamProgressScreen } from "@/components/commission/exam/exam-progress-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function ExamProgressPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ExamProgressScreen />
    </Suspense>
  );
}
