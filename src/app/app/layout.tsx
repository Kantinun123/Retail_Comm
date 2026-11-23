import { AppGuard } from "@/components/commission/app-guard";
import { AppMain } from "@/components/commission/app-main";
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppGuard>
      <AppMain>{children}</AppMain>
    </AppGuard>
  );
}