import { Icon } from "./icon";

/** Static, instantly-renderable placeholder shown while a client screen
    reads the session on the client. Satisfies Next.js instant-navigation. */
export function ScreenSkeleton() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-slate-300">
      <Icon name="progress_activity" className="animate-spin text-4xl" />
    </div>
  );
}
