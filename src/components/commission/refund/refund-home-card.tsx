"use client";
/* การ์ดคำขอคืนเงินบนหน้าหลัก: พนักงานขาย (งานที่ต้องทำ) / Area (รออนุมัติ) / Admin (ภาพรวม) — แสดงเมื่อระบบเปิดใช้ */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { baht2, fetchRefundList, type RefundListItem } from "@/lib/commission/refund-store";

type Variant = "sales" | "approver" | "admin";
const ACTIVE = ["pending_approval", "returned", "finance_returned", "pending_finance", "finance_working", "pending_transfer"];
const SLA_STATUS = ["pending_finance", "finance_working", "pending_transfer"];

function Chip({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={cn("rounded-xl px-1.5 py-2 text-center", tone)}>
      <p className="text-[17px] font-bold leading-none">{n}</p>
      <p className="text-[9.5px] mt-1 leading-tight">{label}</p>
    </div>
  );
}

export function RefundHomeCard({ variant }: { variant: Variant }) {
  const [data, setData] = useState<{ me: string; items: RefundListItem[] } | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let cancelled = false;
    fetchRefundList()
      .then((d) => {
        if (!cancelled && d.enabled) setData({ me: d.me, items: d.items });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!data) return null;
  const { me } = data;
  const items = variant === "admin" ? data.items.filter((i) => !i.isTest) : data.items;
  const n = (f: (i: RefundListItem) => boolean) => items.filter(f).length;
  const overdue = (i: RefundListItem) => SLA_STATUS.includes(i.status) && !!i.dueAt && new Date(i.dueAt).getTime() < now;

  if (variant === "sales") {
    const fix = items.filter((i) => i.status === "returned" || i.status === "finance_returned");
    const parcel = items.filter((i) => !i.hasParcel && ACTIVE.includes(i.status));
    const inform = items.filter((i) => i.status === "transferred");
    const todo = fix.length + parcel.length + inform.length;
    const alerts = [
      ...fix.map((i) => ({ i, icon: "edit_note", cls: "bg-rose-50 text-rose-800", text: `${i.custName} — ถูกตีกลับ ต้องแก้ไข` })),
      ...inform.map((i) => ({ i, icon: "campaign", cls: "bg-emerald-50 text-emerald-800", text: `${i.custName} — โอนเงินแล้ว แจ้งลูกค้า` })),
      ...parcel.map((i) => ({ i, icon: "local_shipping", cls: "bg-amber-50 text-amber-800", text: `${i.custName} — ยังไม่ใส่เลขพัสดุเอกสารตัวจริง` })),
    ].slice(0, 3);
    return (
      <div className="rounded-2xl bg-white border border-rose-200 shadow-sm overflow-hidden">
        <Link href="/app/refund" className="p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#d32029] flex items-center justify-center shrink-0">
            <Icon name="currency_exchange" style={{ fontSize: 21 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900 leading-snug">ขอคืนเงินลูกค้า กรณีลูกค้าจ่ายเงินตรง SCG</p>
            <p className="text-[10px] text-slate-400">{todo ? `มี ${todo} รายการรอคุณดำเนินการ` : items.length ? "ไม่มีรายการรอคุณ" : "ยังไม่มีคำขอ"}</p>
          </div>
          <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
        </Link>
        {items.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5 px-3.5">
            <Chip n={fix.length} label="ต้องแก้ไข" tone="bg-rose-50 text-rose-800" />
            <Chip n={n((i) => i.status === "pending_approval")} label="รออนุมัติ" tone="bg-amber-50 text-amber-800" />
            <Chip n={n((i) => SLA_STATUS.includes(i.status))} label="Finance / บัญชี" tone="bg-sky-50 text-sky-800" />
            <Chip n={inform.length} label="รอแจ้งลูกค้า" tone="bg-emerald-50 text-emerald-800" />
          </div>
        )}
        {alerts.length > 0 && (
          <div className="px-3.5 pt-2.5 space-y-1.5">
            {alerts.map((a) => (
              <Link key={`${a.i.id}-${a.icon}`} href={`/app/refund/${a.i.id}`} className={cn("rounded-xl px-3 py-2 text-[11.5px] flex items-center gap-2", a.cls)}>
                <Icon name={a.icon} style={{ fontSize: 16 }} />
                <span className="flex-1 truncate">{a.text}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="p-3.5">
          <Link href="/app/refund/new" className="w-full py-2.5 rounded-xl border border-[#d32029] text-[#d32029] text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.99] transition">
            <Icon name="add_circle" style={{ fontSize: 18 }} /> ขอคืนเงินใหม่
          </Link>
        </div>
      </div>
    );
  }

  if (variant === "approver") {
    const pending = items.filter((i) => i.status === "pending_approval" && i.approverId === me);
    if (!items.length) return null;
    return (
      <div className={cn("rounded-2xl bg-white shadow-sm overflow-hidden border", pending.length ? "border-amber-300" : "border-slate-100")}>
        <Link href="/app/refund" className="p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Icon name="currency_exchange" style={{ fontSize: 21 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-bold text-slate-900">คำขอคืนเงิน รออนุมัติ</p>
            <p className="text-[10.5px] text-slate-500">{pending.length ? `${pending.length} รายการรอคุณอนุมัติ` : "ไม่มีรายการรอคุณอนุมัติ"}</p>
          </div>
          {pending.length > 0 && <span className="min-w-6 h-6 px-1.5 rounded-full bg-[#d32029] text-white text-[12px] font-bold flex items-center justify-center">{pending.length}</span>}
          <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
        </Link>
        {pending.length > 0 && (
          <div className="px-3.5 pb-3.5 space-y-1.5">
            {pending.slice(0, 3).map((i) => (
              <Link key={i.id} href={`/app/refund/${i.id}`} className="rounded-xl px-3 py-2 bg-amber-50/70 text-[11.5px] text-slate-700 flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate">
                  <b className="text-slate-900">{i.custName}</b> · {i.requesterName}
                </span>
                <span className="font-bold text-[#d32029] shrink-0">{baht2(i.amount)}</span>
              </Link>
            ))}
            {pending.length > 3 && <p className="text-[10.5px] text-slate-400 text-center pt-0.5">และอีก {pending.length - 3} รายการ</p>}
          </div>
        )}
      </div>
    );
  }

  // admin — การ์ดในกลุ่ม "จัดการระบบ"
  const late = n(overdue);
  return (
    <Link href="/app/refund" className="rounded-2xl border border-violet-100 bg-white shadow-sm p-3.5 block active:scale-[0.99] hover:border-violet-300 hover:-translate-y-0.5 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#7c3aed] flex items-center justify-center shrink-0">
          <Icon name="currency_exchange" className="text-2xl" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-bold text-slate-900">คำขอคืนเงินลูกค้า</p>
          <p className="text-[11px] text-slate-500">
            กำลังดำเนินการ {n((i) => ACTIVE.includes(i.status))} รายการ{late ? ` · เกินกำหนด ${late}` : ""}
          </p>
        </div>
        <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-3">
        <Chip n={n((i) => i.status === "pending_approval" || i.status === "returned" || i.status === "finance_returned")} label="อนุมัติ / แก้ไข" tone="bg-amber-50 text-amber-800" />
        <Chip n={n((i) => i.status === "pending_finance" || i.status === "finance_working")} label="Finance" tone="bg-sky-50 text-sky-800" />
        <Chip n={n((i) => i.status === "pending_transfer")} label="รอบัญชีโอน" tone="bg-violet-50 text-violet-800" />
        <Chip n={late} label="เกิน SLA" tone={late ? "bg-rose-50 text-rose-800" : "bg-slate-50 text-slate-500"} />
      </div>
    </Link>
  );
}
