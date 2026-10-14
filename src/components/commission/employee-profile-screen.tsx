"use client";

/* =============================================================
   หน้าประวัติพนักงานรายคน (/app/employee/[id])
   สรุปโปรไฟล์ + ผลงานตลอดทุกช่วงเวลาของพนักงานคนนั้น
   - รองรับรูปจริง (photoUrl) ถ้ามี, ไม่มีใช้ตัวย่อ avatar
   - คุมสิทธิ์ตาม role: sales เห็นเฉพาะตัวเอง, dealer เห็นพนักงานในร้าน,
     admin เห็นได้ทุกคน
   ============================================================= */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import {
  GROUPS,
  commissionOf,
  dealerByCode,
  employeeById,
  formatBaht,
  formatBahtShort,
  getSales,
  lifetimeTotals,
  setBenefitView,
  solutionById,
} from "@/lib/commission/logic";
import { useSession } from "@/lib/commission/session";
import { getProfileOverride } from "@/lib/commission/profile";
import type { GroupKey } from "@/lib/commission/types";
import { cn } from "@/lib/utils";

export function EmployeeProfileScreen({ empId }: { empId: string }) {
  const { session, ready } = useSession();
  const router = useRouter();

  // หน้าประวัติพนักงานใช้มุมมองพนักงาน (อินเซนทีฟ) เสมอ
  setBenefitView("emp");
  useEffect(() => {
    setBenefitView("emp");
    return () => setBenefitView(null);
  }, []);

  if (!ready || !session) return null;

  const emp = employeeById(empId);

  // สิทธิ์การเข้าถึงตาม role
  const canView =
    !!emp &&
    (session.isAdmin ||
      (session.isSales && session.empId === emp.id) ||
      (!session.isSales &&
        !session.isAdmin &&
        emp.dealerCode === session.dealer.code));

  if (!emp || !canView) {
    return (
      <>
        <header className="flex items-center space-x-2.5 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </button>
          <span className="font-bold text-[16px] text-[#231313]">ประวัติพนักงาน</span>
        </header>
        <div className="py-16 text-center">
          <Icon name="person_off" className="text-5xl text-slate-200" />
          <p className="text-[13px] text-slate-500 mt-2">
            {!emp ? "ไม่พบข้อมูลพนักงาน" : "คุณไม่มีสิทธิ์ดูประวัติพนักงานคนนี้"}
          </p>
          <Link
            href="/app/dashboard"
            className="inline-block mt-4 text-[12px] font-semibold text-[#a11119] hover:underline"
          >
            กลับหน้าภาพรวม
          </Link>
        </div>
        <BottomNav active="dashboard" />
      </>
    );
  }

  const dealer = emp.dealerCode ? dealerByCode(emp.dealerCode) : null;
  const t = lifetimeTotals(emp.id, null);

  // ข้อมูลติดต่อที่พนักงานแก้ไขเอง (override) ชนะข้อมูลดิบ
  const ov = getProfileOverride(`emp:${emp.id}`);
  const shownPhoto = ov.photoUrl ?? emp.photoUrl ?? "";
  const shownPhone = ov.phone ?? emp.phone ?? "";

  // สรุปตามประเภทงาน (บริการ/สินค้า) ตลอดทุกช่วงเวลา
  const empSales = getSales().filter((s) => s.empId === emp.id);
  const groupAgg = (Object.keys(GROUPS) as GroupKey[]).map((g) => {
    const rows = empSales.filter((s) => {
      const sol = solutionById(s.solId);
      return sol ? sol.group === g : false;
    });
    return {
      ...GROUPS[g],
      commission: rows.reduce((a, s) => a + commissionOf(s), 0),
      deals: rows.length,
    };
  });
  const groupTotal = groupAgg.reduce((a, g) => a + g.commission, 0);

  const avatar = emp.avatar || emp.name.slice(0, 2);

  return (
    <>
      <header className="flex items-center space-x-2.5 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition shrink-0"
        >
          <Icon name="arrow_back" className="text-xl" />
        </button>
        <span className="font-bold text-[16px] text-[#231313]">ประวัติพนักงาน</span>
      </header>

      <div className="space-y-4 pb-4">
        {/* การ์ดโปรไฟล์ */}
        <section className="rounded-2xl bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white p-4 shadow-lg shadow-[#d32029]/20">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-[20px] font-bold shrink-0 overflow-hidden">
              {shownPhoto ? (
                <Image
                  src={shownPhoto}
                  alt={emp.name}
                  width={64}
                  height={64}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                avatar
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[17px] font-bold leading-tight truncate">
                {emp.name}
              </p>
              <p className="text-[12px] text-red-100/90 flex items-center gap-1 mt-0.5">
                <Icon name="badge" style={{ fontSize: 14 }} />
                {emp.role} · {emp.id}
              </p>
              {dealer && (
                <p className="text-[12px] text-red-100/80 flex items-center gap-1 mt-0.5">
                  <Icon name="storefront" style={{ fontSize: 14 }} />
                  <span className="truncate">{dealer.name}</span>
                </p>
              )}
              {shownPhone && (
                <p className="text-[12px] text-red-100/80 flex items-center gap-1 mt-0.5">
                  <Icon name="call" style={{ fontSize: 14 }} />
                  {shownPhone}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* การ์ดสรุปผลงาน (ตลอดทุกรอบ) */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
            <Icon name="payments" className="text-lg text-[#d32029]" />
            <span>ผลประโยชน์พนักงาน (อินเซนทีฟ)</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-2">รวมทุกรอบ</p>
          <p className="tnum text-[28px] font-bold text-[#a11119] leading-none mt-0.5">
            {formatBaht(t.totalCommission)}
          </p>
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
              <p className="flex items-center text-[11px] font-semibold text-emerald-700">
                <span className="w-2 h-2 rounded-sm mr-1.5 bg-[#16a34a]" />
                จ่ายแล้ว
              </p>
              <p className="tnum text-[15px] font-bold text-emerald-700 mt-0.5">
                {formatBaht(t.paidCommission)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5">
              <p className="flex items-center text-[11px] font-semibold text-amber-700">
                <span className="w-2 h-2 rounded-sm mr-1.5 bg-[#f59e0b]" />
                รอจ่าย
              </p>
              <p className="tnum text-[15px] font-bold text-amber-700 mt-0.5">
                {formatBaht(t.pendingCommission)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[12px]">
            <span className="text-slate-500 flex items-center gap-1">
              <Icon name="receipt_long" style={{ fontSize: 15 }} className="text-slate-400" />
              จำนวนงาน
            </span>
            <span className="tnum font-bold text-slate-700">
              {t.count.toLocaleString("th-TH")} งาน
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[12px]">
            <span className="text-slate-500 flex items-center gap-1">
              <Icon name="trending_up" style={{ fontSize: 15 }} className="text-slate-400" />
              ยอดขายรวม
            </span>
            <span className="tnum font-bold text-slate-700">
              {formatBahtShort(t.totalSales)}
            </span>
          </div>
        </section>

        {/* สัดส่วนตามประเภทงาน */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5 mb-3">
            <Icon name="donut_small" className="text-lg text-[#d32029]" />
            <span>แยกตามประเภทงาน</span>
          </h3>
          <div className="space-y-3">
            {groupAgg.map((g) => {
              const pct = groupTotal > 0 ? (g.commission / groupTotal) * 100 : 0;
              const color = g.key === "solution" ? "#0ea5e9" : "#16a34a";
              return (
                <div key={g.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center text-[12px] font-semibold text-slate-700">
                      <Icon
                        name={g.icon}
                        style={{ fontSize: 15 }}
                        className="mr-1.5"
                      />
                      {g.label}
                    </span>
                    <span className="tnum text-[12px] font-bold text-slate-900">
                      {formatBaht(g.commission)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(2, pct)}%`, background: color }}
                    />
                  </div>
                  <p className="tnum text-[10px] text-slate-400 mt-0.5">
                    {g.deals} งาน · {pct.toFixed(1)}%
                  </p>
                </div>
              );
            })}
            {groupTotal === 0 && (
              <p className="text-[12px] text-slate-400 text-center py-2">
                ยังไม่มีข้อมูลงาน
              </p>
            )}
          </div>
        </section>
      </div>

      <BottomNav active="dashboard" />
    </>
  );
}
