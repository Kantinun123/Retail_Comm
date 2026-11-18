import { Suspense } from "react";
import { BoqListScreen } from "@/components/commission/boq/boq-list-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function BoqPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BoqListScreen />
    </Suspense>
  );
}