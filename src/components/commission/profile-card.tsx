"use client";

/* =============================================================
   การ์ดโปรไฟล์สมาชิก (ใช้ร่วมหน้า back margin / commission product)
   แสดง logo/รูปโปรไฟล์ + ชื่อ + role — สไตล์เดียวกับหน้าผลประโยชน์ (dashboard)
   กดแล้วไปหน้าสมาชิก
   ============================================================= */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { useSession } from "@/lib/commission/session";
import { getProfileOverride } from "@/lib/commission/profile";
import { fetchSaleRep, type SaleRep } from "@/lib/commission/sale-reps-store";

export function ProfileCard() {
  const { session, ready } = useSession();
  // เติมข้อมูล rep ถ้า session ขาด (เช่น login ค้างจาก session เก่าก่อนมีฟิลด์นี้)
  const [repFallback, setRepFallback] = useState<SaleRep | null>(null);
  const repCode = session?.repCode ?? null;
  const needFallback =
    !!session?.isSales && !!repCode && (!session.repCr || !session.repDealerName || !session.repModel);
  useEffect(() => {
    if (!needFallback || !repCode) return;
    let cancelled = false;
    fetchSaleRep(repCode)
      .then((r) => {
        if (!cancelled) setRepFallback(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [needFallback, repCode]);

  if (!ready || !session) return null;

  const profileKey = session.isSales
    ? session.empId
      ? `emp:${session.empId}`
      : null
    : session.isAdmin
      ? null
      : `dealer:${session.dealer.code}`;
  const photo = profileKey ? getProfileOverride(profileKey).photoUrl ?? "" : "";

  // sales: ใช้ session ก่อน ถ้าขาดใช้ repFallback
  const repCr = session.repCr ?? repFallback?.crCode ?? null;
  const repDealerName = session.repDealerName ?? repFallback?.dealerName ?? null;
  const repModel = session.repModel ?? repFallback?.dealerModel ?? null;

  const name = session.isSales
    ? session.repName ?? repFallback?.name ?? session.me?.name ?? "พนักงานขาย"
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
        {session.isSales ? (
          <>
            <span className="text-[11px] font-semibold text-[#b21e1e] flex items-center gap-1 mt-0.5 flex-wrap">
              <Icon name="badge" style={{ fontSize: 13 }} /> พนักงานขาย
              {repCr && <span className="text-slate-400">· {repCr}</span>}
              {repDealerName && (
                <>
                  <span className="text-slate-300">·</span>
                  <Icon name="storefront" style={{ fontSize: 12 }} className="text-slate-400" />
                  <span className="text-slate-500 font-medium truncate max-w-[150px]">{repDealerName}</span>
                </>
              )}
            </span>
            {repModel && (
              <span className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-slate-400">Model ร้านค้า:</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#a66b00] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <Icon name="workspace_premium" style={{ fontSize: 12 }} />
                  {repModel}
                </span>
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] font-semibold text-[#b21e1e] flex items-center gap-1 mt-0.5">
            {session.isAdmin ? (
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
        )}
      </div>
      <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
    </Link>
  );
}
