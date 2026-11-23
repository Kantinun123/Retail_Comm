import { Suspense } from "react";
import { RefundMemoScreen } from "@/components/commission/refund/refund-memo-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";
export const instant = false;
async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RefundMemoScreen key={id} id={Number(id)} />;
}
export default function RefundMemoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}