import { Suspense } from "react";
import { FlowConceptScreen } from "@/components/crm-mock/crm-flow-concept";

export const metadata = { title: "Concept: CRM flow", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <FlowConceptScreen />
    </Suspense>
  );
}
