import { Suspense } from "react";
import { BoqDetailScreen } from "@/components/commission/boq/boq-detail-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default async function BoqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BoqDetailScreen key={id} id={Number(id)} />
    </Suspense>
  );
}