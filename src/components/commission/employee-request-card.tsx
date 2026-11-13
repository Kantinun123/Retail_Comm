"use client";

/* การ์ดงาน "แจ้งเพิ่มพนักงานใหม่" — หน้าแรกของ Coach / Area / หัวหน้า Area
   - ปุ่มหลักเปิดแบบฟอร์ม (dealerCode = เลือกร้านไว้ให้ เมื่อมาจากหน้าข้อมูลร้าน)
   - ป้ายสถานะ: รออนุมัติ (ทุกคำขอในร้านที่ดูแล) / ต้องแก้ไข (คำขอของฉันที่ไม่อนุมัติ) */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { fetchEmployeeRequests } from "@/lib/commission/employee-request-store";

export function EmployeeRequestCard({ dealerCode }: { dealerCode?: string | null }) {
  const [counts, setCounts] = useState<{ pending: number; fix: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEmployeeRequests().then((r) => {
      if (cancelled || !r.ok) return;
      const list = dealerCode ? r.requests.filter((x) => x.dealerCode === dealerCode) : r.requests;
      // "ต้องแก้ไข" = คำขอของฉันที่ไม่อนุมัติ และยังไม่ได้ส่งคนเดิมใหม่
      const resent = new Set(list.filter((x) => x.mine && x.status !== "rejected").map((x) => x.payload.name.trim()));
      setCounts({
        pending: list.filter((x) => x.status === "pending").length,
        fix: list.filter((x) => x.mine && x.status === "rejected" && !resent.has(x.payload.name.trim())).length,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  const newHref = `/app/employee-requests?new=1${dealerCode ? `&store=${encodeURIComponent(dealerCode)}` : ""}`;
  return (
    <section className="rounded-2xl bg-white border-2 border-emerald-200 shadow-sm p-3.5" aria-labelledby="emp-req-title">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <Icon name="person_add" className="text-2xl" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="emp-req-title" className="text-[14px] font-bold text-slate-900">แจ้งเพิ่มพนักงานใหม่</h2>
          <p className="text-[11px] text-slate-500">ส่งข้อมูลพนักงานเข้าใหม่ให้ Admin อนุมัติ</p>
        </div>
      </div>
      <Link
        href={newHref}
        className="mt-3 w-full h-11 rounded-xl bg-emerald-600 text-white font-bold text-[13.5px] flex items-center justify-center gap-1 hover:-translate-y-0.5 transition-all"
      >
        <Icon name="add" style={{ fontSize: 18 }} />
        แจ้งพนักงานใหม่
      </Link>
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        {counts && counts.pending > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold px-2.5 py-1">
            <Icon name="hourglass_top" style={{ fontSize: 13 }} />
            รออนุมัติ {counts.pending}
          </span>
        )}
        {counts && counts.fix > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-[#a11119] text-[11px] font-bold px-2.5 py-1">
            <Icon name="replay" style={{ fontSize: 13 }} />
            ต้องแก้ไข {counts.fix}
          </span>
        )}
        <Link href="/app/employee-requests" className="ml-auto text-[11.5px] font-bold text-emerald-700 inline-flex items-center">
          คำขอของฉัน
          <Icon name="chevron_right" style={{ fontSize: 16 }} />
        </Link>
      </div>
    </section>
  );
}
