import { Suspense } from "react";
import { AfterSaleConceptScreen } from "@/components/crm-mock/crm-aftersale-concept";

export const metadata = { title: "Concept: CRM after-sale", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <AfterSaleConceptScreen />
    </Suspense>
  );
}
