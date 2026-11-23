import { Suspense } from "react";
import { ExamListScreen } from "@/components/commission/exam/exam-list-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function ExamPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ExamListScreen />
    </Suspense>
  );
}
