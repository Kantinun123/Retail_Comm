import { Suspense } from "react";
import { MemberScreen } from "@/components/commission/member-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function MemberPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <MemberScreen />
    </Suspense>
  );
}
