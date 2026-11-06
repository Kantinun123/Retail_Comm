import { Suspense } from "react";
import { ChangePasswordScreen } from "@/components/commission/change-password-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ChangePasswordScreen />
    </Suspense>
  );
}
