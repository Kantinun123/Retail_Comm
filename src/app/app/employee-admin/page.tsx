import { redirect } from "next/navigation";

// รวมเข้าเป็น "ร้านค้าและทีมงาน" แล้ว — ลิงก์เก่าพาไปหน้าใหม่
export default function EmployeeAdminRedirect() {
  redirect("/app/stores");
}
