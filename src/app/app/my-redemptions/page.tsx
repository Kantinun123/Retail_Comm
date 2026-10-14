import { Suspense } from "react";
import { MyRedemptionsScreen } from "@/components/commission/my-redemptions-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function MyRedemptionsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <MyRedemptionsScreen />
    </Suspense>
  );
}
