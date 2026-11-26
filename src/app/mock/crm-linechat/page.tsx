import { Suspense } from "react";
import { LineChatConceptScreen } from "@/components/crm-mock/crm-linechat-concept";

export const metadata = { title: "Concept: CRM LINE chat", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <LineChatConceptScreen />
    </Suspense>
  );
}
