"use client";

import Link from "next/link";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { DashboardScreen } from "./dashboard-screen";
import { useSession } from "@/lib/commission/session";

/**
 * หน้า "ผลประโยชน์ของพนักงานในร้าน" — ใช้ layout เดียวกับหน้าภาพรวม
 * แต่บังคับมุมมองพนักงาน (Incentive). เข้าถึงได้เฉพาะร้านค้าตัวแทน (admin).
 */
export function StaffIncentiveScreen() {
  const { session, ready } = useSession();

  if (!ready || !session) return null;

  // พนักงานขายไม่มีสิทธิ์ดูหน้านี้ (เป็นมุมมองรวมของทั้งร้าน)
  if (session.isSales) {
    return (
      <>
        <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
          <div className="flex items-center space-x-2.5">
            <Link
              href="/app/dashboard"
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
            >
              <Icon name="arrow_back" className="text-xl" />
            </Link>
            <div className="flex flex-col">
              <span className="font-bold text-[15px] text-[#231313] leading-tight">
                ผลประโยชน์ของพนักงานในร้าน
              </span>
              <span className="text-[11px] font-semibold text-[#b21e1e]">
                เฉพาะร้านค้าตัวแทน (Admin)
              </span>
            </div>
          </div>
        </header>
        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
            <Icon name="lock" className="text-3xl" />
          </div>
          <p className="mt-3 text-[15px] font-bold text-slate-900">
            เฉพาะร้านค้าตัวแทน (Admin)
          </p>
          <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
            หน้านี้แสดงผลประโยชน์ของพนักงานทุกคนในร้าน
            ใช้ได้เฉพาะบัญชีร้านค้าตัวแทนเท่านั้น
          </p>
          <Link
            href="/app/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#d32029]"
          >
            <Icon name="arrow_back" className="text-lg" />
            กลับหน้าภาพรวม
          </Link>
        </div>
        <BottomNav active="staffIncentive" />
      </>
    );
  }

  return <DashboardScreen variant="staffIncentive" />;
}
