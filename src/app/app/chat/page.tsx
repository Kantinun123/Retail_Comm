import { Suspense } from "react";
import { ChatScreen } from "@/components/commission/chat-screen";
import { ScreenSkeleton } from "@/components/commission/screen-skeleton";

// Session-driven, client-only. Opt out of instant-navigation validation.
export const instant = false;

export default function ChatPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ChatScreen />
    </Suspense>
  );
}
