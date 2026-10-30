"use client";

/* =============================================================
   การ์ดโปรไฟล์สมาชิก (ใช้ร่วมหน้า back margin / commission product)
   แสดง logo/รูปโปรไฟล์ + ชื่อ + role — สไตล์เดียวกับหน้าผลประโยชน์ (dashboard)
   กดแล้วไปหน้าสมาชิก
   ============================================================= */
import Image from "next/image";
import Link from "next/link";
import { Icon } from "./icon";
import { useSession } from "@/lib/commission/session";
import { getProfileOverride } from "@/lib/commission/profile";

export function ProfileCard() {
  const { session, ready } = useSession();
  if (!ready || !session) return null;

  const profileKey = session.isSales
    ? session.empId
      ? `emp:${session.empId}`
      : null
    : session.isAdmin
      ? null
      : `dealer:${session.dealer.code}`;
  const photo = profileKey ? getProfileOverride(profileKey).photoUrl ?? "" : "";

  const name =
    session.isSales && session.me
      ? session.me.name
      : session.isAdmin
        ? "ผู้ดูแลระบบ"
        : session.dealer.name;

  return (
    <Link
      href="/app/member"
      className="flex items-center space-x-2.5 min-w-0 rounded-2xl bg-white border border-slate-100 shadow-sm p-3 hover:border-red-200 active:scale-[0.99] transition"
      aria-label="หน้าสมาชิก"
    >
      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md shadow-[#d32029]/20 overflow-hidden shrink-0 border border-slate-100">
        {photo ? (
          <Image src={photo} alt="โปรไฟล์" width={40} height={40} unoptimized className="w-full h-full object-cover" />
        ) : (
          <Image src="/logo.png" alt="SCG HOME" width={40} height={40} className="w-full h-full object-contain" />
        )}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-bold text-[15px] text-[#231313] leading-tight truncate">{name}</span>
        <span className="text-[11px] font-semibold text-[#b21e1e] flex items-center gap-1 mt-0.5">
          {session.isSales && session.me ? (
            <>
              <Icon name="badge" style={{ fontSize: 13 }} /> พนักงานขาย · {session.me.id}
            </>
          ) : session.isAdmin ? (
            <>
              <Icon name="admin_panel_settings" style={{ fontSize: 13 }} /> Admin ·{" "}
              {session.storeFilter ? session.dealer.name : "ทุกร้าน"}
            </>
          ) : (
            <>
              <Icon name="storefront" style={{ fontSize: 13 }} /> ร้านค้าตัวแทน · {session.dealer.code}
            </>
          )}
        </span>
      </div>
      <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
    </Link>
  );
}
