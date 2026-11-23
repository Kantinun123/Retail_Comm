import { Suspense } from "react";
import { CrmMockScreen } from "@/components/crm-mock/crm-mock-screen";

export const metadata = {
  title: "ตัวอย่าง: CRM ทีมขาย (Lead → Opp → ติดตาม KIM / SCM / ห้องแบบ)",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense>
      <CrmMockScreen />
    </Suspense>
  );
}
