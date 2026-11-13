import { Suspense } from "react";
import { EmployeeRequestsScreen } from "@/components/commission/employee-requests-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function EmployeeRequestsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <EmployeeRequestsScreen />
    </Suspense>
  );
}
