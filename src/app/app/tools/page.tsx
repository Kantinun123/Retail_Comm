import { Suspense } from "react";
import { SalesToolsScreen } from "@/components/commission/sales-tools-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";
export const instant = false;
export default function SalesToolsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <SalesToolsScreen />
    </Suspense>
  );
}
