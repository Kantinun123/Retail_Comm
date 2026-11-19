import { Suspense } from "react";
import { BoqHolidaysScreen } from "@/components/commission/boq/boq-holidays-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function BoqHolidaysPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BoqHolidaysScreen />
    </Suspense>
  );
}