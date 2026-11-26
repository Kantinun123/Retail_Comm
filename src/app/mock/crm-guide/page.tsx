import { Suspense } from "react";
import { GuideConceptScreen } from "@/components/crm-mock/crm-guide-concept";

export const metadata = { title: "Concept: CRM guide", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <GuideConceptScreen />
    </Suspense>
  );
}
