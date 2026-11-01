import { redirect } from "next/navigation";

// ร้านค้าตัวแทน landing ที่หน้าหลัก (Hub); admin/sales จะถูก Hub ส่งต่อไป /app/dashboard เอง
export default function AppIndex() {
  redirect("/app/home");
}
