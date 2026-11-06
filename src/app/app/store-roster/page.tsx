import { redirect } from "next/navigation";

// รวมเข้าเป็น "ร้านค้าและทีมงาน" แล้ว — ลิงก์เก่าพาไปหน้าใหม่
// (ร้านค้า/พนักงานจะถูกพาต่อไปหน้ารายละเอียดร้านตัวเองโดยหน้าใหม่)
export default function StoreRosterRedirect() {
  redirect("/app/stores");
}
