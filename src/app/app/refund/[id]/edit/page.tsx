import { Suspense } from "react";
import { RefundFormScreen } from "@/components/commission/refund/refund-form-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";
export const instant = false;
async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RefundFormScreen key={id} editId={Number(id)} />;
}
export default function RefundEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}