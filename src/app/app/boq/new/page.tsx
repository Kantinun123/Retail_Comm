import { Suspense } from "react";
import { BoqFormScreen } from "@/components/commission/boq/boq-form-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function BoqNewPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BoqFormScreen />
    </Suspense>
  );
}