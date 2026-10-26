import { Suspense } from "react";
import { AvatarPreviewScreen } from "@/components/commission/avatar-preview-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Client-only preview. Opt out of instant-navigation validation.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AvatarPreviewScreen />
    </Suspense>
  );
}
