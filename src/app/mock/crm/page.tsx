import { Suspense } from "react";
import { CrmMockScreen } from "@/components/crm-mock/crm-mock-screen";

export const metadata = { title: "ตัวอย่าง: CRM ลูกค้า (Lead → งาน → หลังปิดขาย)" };

export default function Page() {
  return (
    <Suspense>
      <CrmMockScreen />
    </Suspense>
  );
}
