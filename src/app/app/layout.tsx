import { AppGuard } from "@/components/commission/app-guard";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppGuard>
      <main className="flex-1 flex flex-col relative w-full max-w-md mx-auto px-4 pb-28">
        {children}
      </main>
    </AppGuard>
  );
}
