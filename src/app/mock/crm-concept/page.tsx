import { Suspense } from "react";
import { LeadConceptScreen } from "@/components/crm-mock/crm-lead-concept";

export const metadata = { title: "ภาพร่างแนวคิด: CRM Leads", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <LeadConceptScreen />
    </Suspense>
  );
}
