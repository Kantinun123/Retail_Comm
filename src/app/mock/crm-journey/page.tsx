import { Suspense } from "react";
import { JourneyConceptScreen } from "@/components/crm-mock/crm-journey-concept";

export const metadata = { title: "Concept: CRM job journey", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <JourneyConceptScreen />
    </Suspense>
  );
}
