import { Suspense } from "react";
import { DesignIntakeScreen } from "@/components/commission/design-intake-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function DesignIntakePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <DesignIntakeScreen />
    </Suspense>
  );
}
