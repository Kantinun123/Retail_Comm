"use client";

/* เลือกหน้าแรกตาม role/โหมด:
   - admin (ไม่ได้อยู่ในมุมมอง) -> AdminHomeScreen (การ์ด launcher)
   - admin ที่กำลังดูมุมมองร้านค้า -> HomeHubScreen (เห็นเหมือนร้านค้า)
   - dealer -> HomeHubScreen
   (sales จะถูก HomeHubScreen redirect ไป /app/home-staff เอง) */
import { useSession } from "@/lib/commission/session";
import { HomeHubScreen } from "./home-hub-screen";
import { AdminHomeScreen } from "./admin-home-screen";

export function HomeRouter() {
  const { session, ready } = useSession();
  if (!ready || !session) return null;

  const adminLauncher = session.isAdmin && session.adminViewMode !== "store";
  return adminLauncher ? <AdminHomeScreen /> : <HomeHubScreen />;
}
