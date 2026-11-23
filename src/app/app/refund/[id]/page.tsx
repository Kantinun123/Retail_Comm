import { Suspense } from "react";
import { RefundDetailScreen } from "@/components/commission/refund/refund-detail-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";
export const instant = false;
async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RefundDetailScreen key={id} id={Number(id)} />;
}
export default function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}