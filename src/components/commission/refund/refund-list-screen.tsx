"use client";
/* หน้าแรกขอคืนเงินลูกค้า (กรณีลูกค้าจ่ายเงินตรง SCG) — เฟส 1: หน้ารองรับบัญชีทีม (Finance / บัญชี / ผู้อนุมัติ)
   รายการคำขอ + Flow จริงตามมาในเฟส 2-3 (ดู Mock /mock/refund) */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../icon";
import { PushToggle } from "../push-toggle";
import { cn } from "@/lib/utils";
import { doLogout, useSession } from "@/lib/commission/session";

const ROLE_LABEL: Record<string, string> = { finance: "Finance", accounting: "บัญชี", refund_approver: "ผู้อนุมัติ", sales: "พนักงานขาย", admin: "ผู้ดูแลระบบ", area: "Area" };
const NOTE: Record<string, string> = {
  finance: "เปิดไว้เพื่อรู้ทันทีเมื่อมีคำขอที่อนุมัติแล้วรอ Finance รับงาน",
  accounting: "เปิดไว้เพื่อรู้ทันทีเมื่อมีเอกสารตัวจริงส่งมา และงานที่ Finance ตรวจผ่านแล้ว",
  refund_approver: "เปิดไว้เพื่อรู้ทันทีเมื่อมีคำขอคืนเงินรออนุมัติ",
};

export function RefundListScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const [d, setD] = useState<{ role: string; enabled: boolean } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/api/refund", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) { if (j?.ok) setD(j); else setErr(j?.error ?? "โหลดไม่สำเร็จ"); } })
      .catch(() => !cancelled && setErr("โหลดไม่สำเร็จ"));
    return () => { cancelled = true; };
  }, [ready]);
  if (!ready || !session) return null;
  const team = session.role === "finance" || session.role === "accounting" || session.role === "refund_approver";
  return (
    <>
      <header className="flex items-center justify-between gap-2 py-3 lg:py-5">
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 leading-tight">ขอคืนเงินลูกค้า กรณีลูกค้าจ่ายเงินตรง SCG</p>
          <h1 className="font-bold text-[16px] lg:text-[22px] text-[#231313] leading-tight">คำขอคืนเงิน</h1>
          {d && <p className="text-[11px] text-slate-500">{ROLE_LABEL[d.role] ?? d.role}</p>}
        </div>
        {team && (
          <button type="button" onClick={() => { doLogout(); router.replace("/"); }} className="inline-flex lg:hidden items-center gap-1 text-[12px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full shrink-0">
            <Icon name="logout" style={{ fontSize: 16 }} />ออกจากระบบ
          </button>
        )}
      </header>
      <div className="space-y-3 pb-6 lg:max-w-2xl">
        {d && NOTE[d.role] && <PushToggle offNote={NOTE[d.role]} />}
        {err && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">โหลดไม่สำเร็จ: {err}</p>}
        <section className={cn("rounded-2xl bg-white border border-slate-200 shadow-sm p-5 text-center space-y-2")}>
          <Icon name="currency_exchange" className="text-[#d32029]" style={{ fontSize: 36 }} />
          <p className="text-[14px] font-bold text-slate-800">ระบบขอคืนเงินกำลังเตรียมเปิดใช้งาน</p>
          <p className="text-[12px] text-slate-500">บัญชีของคุณพร้อมแล้ว เมื่อเปิดใช้งาน คำขอที่ต้องดำเนินการจะแสดงที่หน้านี้ และแจ้งเตือนบนมือถือ (ถ้าเปิดไว้)</p>
        </section>
      </div>
    </>
  );
}