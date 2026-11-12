import { HomeRedirect } from "@/components/commission/home-redirect";

// หน้า "ภาพรวม" เดิมเลิกใช้แล้ว (แทนด้วยหน้าหลัก Hub) -> พาไปหน้าหลักตาม role
// (ไฟล์ dashboard-screen.tsx ยังเก็บไว้ ไม่ได้ลบ)
export const instant = false;

export default function DashboardPage() {
  return <HomeRedirect />;
}
