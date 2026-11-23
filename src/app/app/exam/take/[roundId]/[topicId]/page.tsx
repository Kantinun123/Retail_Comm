import { Suspense } from "react";
import { ExamTakeScreen } from "@/components/commission/exam/exam-take-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default async function ExamTakePage({ params }: { params: Promise<{ roundId: string; topicId: string }> }) {
  const { roundId, topicId } = await params;
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ExamTakeScreen key={`${roundId}-${topicId}`} roundId={Number(roundId)} topicId={Number(topicId)} />
    </Suspense>
  );
}
