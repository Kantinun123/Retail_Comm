"use client";

/* หน้า "ฉัน" แยกตามบทบาท
   - Admin / หัวหน้า Area / Area / Coach -> MyProfileScreen (ข้อมูลของฉัน + ทีม)
   - ร้านค้า / พนักงานขาย -> MemberScreen เดิม (ข้อมูลร้าน, แต้ม, เช็คอิน ฯลฯ) */
import { useSession } from "@/lib/commission/session";
import { MemberScreen } from "./member-screen";
import { MyProfileScreen } from "./my-profile-screen";

export function MemberRouter() {
  const { session, ready } = useSession();
  if (!ready || !session) return null;
  return session.isAdmin || session.isArea ? <MyProfileScreen /> : <MemberScreen />;
}
