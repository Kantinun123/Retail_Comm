import { Suspense } from "react";
import { HomeStaffHubScreen } from "@/components/commission/home-staff-hub-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

export const instant = false;

export default function HomeStaffPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <HomeStaffHubScreen />
    </Suspense>
  );
}
