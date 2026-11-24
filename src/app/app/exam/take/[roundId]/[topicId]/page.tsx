import { Suspense } from "react";
import { ExamTakeScreen } from "@/components/commission/exam/exam-take-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default async function ExamTakePage({ params, searchParams }: { params: Promise<{ roundId: string; topicId: string }>; searchParams: Promise<{ v?: string }> }) {
  const { roundId, topicId } = await params;
  const { v } = await searchParams;
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ExamTakeScreen key={`${roundId}-${topicId}-${v ?? ""}`} roundId={Number(roundId)} topicId={Number(topicId)} />
    </Suspense>
  );
}
