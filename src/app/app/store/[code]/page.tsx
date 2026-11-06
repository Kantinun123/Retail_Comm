import { Suspense } from "react";
import { StoreDetailScreen } from "@/components/commission/store-detail-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session/dataset-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      {/* key = code -> เปลี่ยนร้านแล้ว state โหลดใหม่ทั้งหมด */}
      <StoreDetailScreen key={code} code={code} />
    </Suspense>
  );
}
