"use client";
/* รายการคำขอคืนเงินตามบทบาท
   - พนักงานขาย: คำขอของตัวเอง + ปุ่มแจ้งขอคืนเงิน
   - ผู้อนุมัติ (Area / Metal / Smart): รออนุมัติ + ที่อนุมัติแล้ว (Area เห็นงานของร้านที่ดูแลแบบอ่านอย่างเดียว)
   - Finance / บัญชี / admin: ทุกคำขอ (ปุ่มของ Finance / บัญชีเปิดในเฟส 3) */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icon";
import { PushToggle } from "../push-toggle";
import { cn } from "@/lib/utils";
import { doLogout, useSession } from "@/lib/commission/session";
import { isRefundTeamRole } from "@/lib/commission/types";
import { baht2, dateTh, fetchRefundList, groupLabel, typeLabel, type RefundListItem, type RefundRole, type RefundStatus } from "@/lib/commission/refund-store";
import { btn, card } from "../boq/boq-shared";
import { RefundPill } from "./refund-detail-screen";

type Tab = { key: string; label: string; match: (j: RefundListItem) => boolean };
const st = (...s: RefundStatus[]) => (j: RefundListItem) => s.includes(j.status);
const ACTIVE: RefundStatus[] = ["pending_approval", "returned", "finance_returned", "pending_finance", "finance_working", "pending_transfer", "transferred"];
const NOTE: Partial<Record<RefundRole, string>> = {
  sales: "เปิดไว้เพื่อรู้ทันทีเมื่อคำขอได้รับอนุมัติ / ถูกตีกลับ / โอนเงินแล้ว",
  approver: "เปิดไว้เพื่อรู้ทันทีเมื่อมีคำขอคืนเงินรออนุมัติ",
  finance: "เปิดไว้เพื่อรู้ทันทีเมื่อมีคำขอที่อนุมัติแล้วรอ Finance รับงาน",
  accounting: "เปิดไว้เพื่อรู้ทันทีเมื่อมีเอกสารตัวจริงส่งมา และงานที่ Finance ตรวจผ่านแล้ว",
};

function Card({ j, role }: { j: RefundListItem; role: RefundRole }) {
  return (
    <Link href={`/app/refund/${j.id}`} className={cn(card, "block p-3.5 hover:-translate-y-0.5 transition-all")}>
      <div className="flex items-center gap-2 flex-wrap">
        <RefundPill status={j.status} />
        {j.round > 1 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">รอบที่ {j.round}</span>}
        <span className="ml-auto text-[10.5px] text-slate-400">{j.reqNo}</span>
      </div>
      <p className="text-[14px] font-bold text-slate-800 mt-2">{j.custName}</p>
      <p className="text-[11px] text-slate-500">{typeLabel(j.type)} · {groupLabel(j.group)} · {j.soNo || j.projectNo}</p>
      <div className="flex items-end justify-between mt-2 gap-2">
        <p className="text-[11px] text-slate-500 truncate">{role === "sales" ? `ผู้อนุมัติ: ${j.approverName ?? "-"}` : `${j.requesterName}${j.dealerName ? ` · ${j.dealerName}` : ""}`}</p>
        <span className="text-[15px] font-bold text-[#d32029] shrink-0">{baht2(j.amount)}</span>
      </div>
      <div className="flex gap-1.5 mt-2 text-[10px] font-semibold">
        <span className={cn("rounded px-1.5 py-0.5", j.hasParcel ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{j.hasParcel ? "ส่งเอกสารแล้ว" : "ยังไม่ส่งเอกสาร"}</span>
        <span className={cn("rounded px-1.5 py-0.5", j.docsReceived ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{j.docsReceived ? "บัญชีได้รับ" : "บัญชียังไม่ได้รับ"}</span>
      </div>
    </Link>
  );
}
function Table({ list, role }: { list: RefundListItem[]; role: RefundRole }) {
  const router = useRouter();
  const heads = ["เลขที่", "ลูกค้า", role === "sales" ? "ผู้อนุมัติ" : "ผู้ขอ / ร้าน", "ประเภท", "ยอดขอคืน", "เอกสารตัวจริง", "สถานะ"];
  return (
    <div className={cn(card, "overflow-hidden")}>
      <table className="w-full text-[13px]">
        <thead className="bg-slate-50 text-[11.5px] text-slate-500"><tr>{heads.map((h) => <th key={h} className="text-left font-semibold px-4 py-3 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {list.map((j) => (
            <tr key={j.id} onClick={() => router.push(`/app/refund/${j.id}`)} className="border-t border-slate-100 hover:bg-red-50/40 cursor-pointer">
              <td className="px-4 py-3 whitespace-nowrap"><Link href={`/app/refund/${j.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-slate-500 hover:text-[#d32029]">{j.reqNo}</Link><p className="text-[11px] text-slate-400">{dateTh(j.createdAt, true)}</p></td>
              <td className="px-4 py-3"><p className="font-bold text-slate-800">{j.custName}</p><p className="text-[11px] text-slate-500">{j.soNo || j.projectNo}</p></td>
              <td className="px-4 py-3">{role === "sales" ? j.approverName ?? "-" : <><p className="text-slate-700">{j.requesterName}</p><p className="text-[11px] text-slate-500">{j.dealerName ?? "-"}</p></>}</td>
              <td className="px-4 py-3 whitespace-nowrap"><p>{typeLabel(j.type)}</p><p className="text-[11px] text-slate-500">{groupLabel(j.group)}</p></td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold">{baht2(j.amount)}</td>
              <td className="px-4 py-3 text-[11.5px] whitespace-nowrap">{j.docsReceived ? "บัญชีได้รับแล้ว" : j.hasParcel ? "กำลังส่ง" : <span className="text-slate-400">ยังไม่ส่ง</span>}</td>
              <td className="px-4 py-3"><RefundPill status={j.status} />{j.round > 1 && <p className="text-[10.5px] text-rose-700 mt-1">รอบที่ {j.round}</p>}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={heads.length} className="text-center text-slate-400 py-10">ไม่มีคำขอในหมวดนี้</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function RefundListScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const [data, setData] = useState<{ role: RefundRole; me: string; enabled: boolean; items: RefundListItem[] } | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchRefundList().then((d) => !cancelled && setData(d)).catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => { cancelled = true; };
  }, [ready]);
  const role = data?.role ?? "viewer";
  const me = data?.me ?? "";
  const items = useMemo(() => data?.items ?? [], [data]);
  const tabs: Tab[] = useMemo(() => {
    if (role === "sales") return [
      { key: "todo", label: "ต้องแก้ไข", match: st("returned", "finance_returned") },
      { key: "parcel", label: "รอใส่เลขพัสดุ", match: (j) => !j.hasParcel && ACTIVE.includes(j.status) },
      { key: "active", label: "กำลังดำเนินการ", match: st(...ACTIVE) },
      { key: "done", label: "ปิดแล้ว", match: st("closed", "rejected", "cancelled") },
    ];
    if (role === "approver") return [
      { key: "wait", label: "รออนุมัติ", match: (j) => j.status === "pending_approval" && j.approverId === me },
      { key: "mine", label: "ที่ฉันอนุมัติ", match: (j) => j.approverId === me && j.status !== "pending_approval" },
      { key: "all", label: "ทั้งหมด", match: () => true },
    ];
    if (role === "finance") return [
      { key: "queue", label: "รอรับงาน", match: st("pending_finance") },
      { key: "mine", label: "งานของฉัน", match: (j) => j.financeId === me && ["finance_working", "finance_returned"].includes(j.status) },
      { key: "all", label: "Finance ทั้งหมด", match: st("pending_finance", "finance_working", "finance_returned") },
      { key: "done", label: "ตรวจผ่านแล้ว", match: (j) => j.financeId === me && ["pending_transfer", "transferred", "closed"].includes(j.status) },
      { key: "every", label: "ทั้งหมด", match: () => true },
    ];
    if (role === "accounting") return [
      { key: "ready", label: "รอโอนเงิน", match: st("pending_transfer") },
      { key: "parcel", label: "เอกสารกำลังมา", match: (j) => j.hasParcel && !j.docsReceived && ACTIVE.includes(j.status) },
      { key: "finance", label: "รอ Finance", match: st("pending_finance", "finance_working", "finance_returned") },
      { key: "done", label: "โอนแล้ว", match: st("transferred", "closed") },
      { key: "every", label: "ทั้งหมด", match: () => true },
    ];
    return [
      { key: "active", label: "กำลังดำเนินการ", match: st(...ACTIVE) },
      { key: "approval", label: "รออนุมัติ", match: st("pending_approval", "returned", "finance_returned") },
      { key: "finance", label: "ที่ Finance", match: st("pending_finance", "finance_working") },
      { key: "transfer", label: "รอโอนเงิน", match: st("pending_transfer") },
      { key: "all", label: "ทั้งหมด", match: () => true },
    ];
  }, [role, me]);
  if (!ready || !session) return null;
  const firstWithItems = tabs.find((t) => items.some(t.match))?.key ?? tabs[0].key;
  const cur = tabs.find((t) => t.key === tab) ?? tabs.find((t) => t.key === firstWithItems)!;
  const kw = q.trim().toLowerCase();
  const list = items.filter(cur.match).filter((j) => !kw || `${j.reqNo} ${j.custName} ${j.projectNo} ${j.soNo ?? ""} ${j.requesterName} ${j.dealerName ?? ""}`.toLowerCase().includes(kw));
  const team = isRefundTeamRole(session.role); // รวมพนักงานขายส่วนกลาง (ไม่มีหน้าหลักอื่น)
  return (
    <>
      <header className="flex items-center justify-between gap-2 py-3 lg:py-5">
        <div className="flex items-center gap-2 min-w-0">
          {!team && <Link href={role === "sales" ? "/app/home-staff" : "/app/home"} className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0 lg:hidden" aria-label="กลับ"><Icon name="arrow_back" style={{ fontSize: 18 }} /></Link>}
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 leading-tight">ขอคืนเงินลูกค้า กรณีลูกค้าจ่ายเงินตรง SCG</p>
            <h1 className="font-bold text-[16px] lg:text-[22px] text-[#231313] leading-tight">{role === "sales" ? "คำขอคืนเงินของฉัน" : role === "approver" ? "คำขอคืนเงิน · อนุมัติ" : "คำขอคืนเงิน"}</h1>
          </div>
        </div>
        {team && (
          <button type="button" onClick={() => { doLogout(); router.replace("/"); }} className="inline-flex lg:hidden items-center gap-1 text-[12px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full shrink-0">
            <Icon name="logout" style={{ fontSize: 16 }} />ออกจากระบบ
          </button>
        )}
      </header>
      <div className="space-y-3 pb-6">
        {data && NOTE[role] && <PushToggle hideWhenOn offNote={NOTE[role]} />}
        {data && !data.enabled && role !== "admin" && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-800">ระบบขอคืนเงินยังไม่เปิดใช้งาน — บัญชีของคุณพร้อมแล้ว เมื่อเปิดใช้งาน งานที่ต้องทำจะแสดงที่หน้านี้</p>
        )}
        {role === "sales" && data?.enabled && (
          <Link href="/app/refund/new" className={cn(btn, "w-full lg:w-auto lg:px-6 bg-[#d32029] text-white flex items-center justify-center gap-1.5 py-3")}>
            <Icon name="add_circle" style={{ fontSize: 20 }} /> แจ้งขอคืนเงิน
          </Link>
        )}
        {error && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">โหลดไม่สำเร็จ: {error}</p>}
        {!data && !error && <p className="text-center text-[12px] text-slate-400 py-8">กำลังโหลด...</p>}
        {data && (
          <>
            <div className="space-y-3 lg:space-y-0 lg:flex lg:items-center lg:gap-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 lg:flex-1 min-w-0">
                {tabs.map((t) => (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition", cur.key === t.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200")}>
                    {t.label} <span className="opacity-60">{items.filter(t.match).length}</span>
                  </button>
                ))}
              </div>
              <div className="relative lg:w-80 shrink-0">
                <Icon name="search" className="absolute left-3 top-2.5 text-slate-400" style={{ fontSize: 18 }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา เลขที่ / ลูกค้า / Project / ร้าน" className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-[13px] outline-none" />
              </div>
              <div className="hidden lg:flex rounded-xl bg-white border border-slate-200 p-0.5 shrink-0">
                {(["table", "cards"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setView(v)} title={v === "table" ? "มุมมองตาราง" : "มุมมองการ์ด"} className={cn("px-2.5 py-1.5 rounded-lg", view === v ? "bg-slate-900 text-white" : "text-slate-500")}>
                    <Icon name={v === "table" ? "table_rows" : "grid_view"} style={{ fontSize: 18 }} />
                  </button>
                ))}
              </div>
            </div>
            {view === "table" && <div className="hidden lg:block"><Table list={list} role={role} /></div>}
            <div className={cn("grid gap-2.5", view === "table" ? "lg:hidden" : "lg:grid-cols-3 lg:gap-3")}>
              {list.map((j) => <Card key={j.id} j={j} role={role} />)}
              {list.length === 0 && <p className="text-center text-[12px] text-slate-400 py-8 lg:col-span-3">ไม่มีคำขอในหมวดนี้</p>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
