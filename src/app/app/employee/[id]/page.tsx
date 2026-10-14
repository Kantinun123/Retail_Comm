import { Suspense } from "react";
import { EmployeeProfileScreen } from "@/components/commission/employee-profile-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <EmployeeProfileScreen empId={decodeURIComponent(id)} />
    </Suspense>
  );
}
