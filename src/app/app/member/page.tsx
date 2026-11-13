import { Suspense } from "react";
import { MemberRouter } from "@/components/commission/member-router";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function MemberPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <MemberRouter />
    </Suspense>
  );
}
