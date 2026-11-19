"use client";
/* รายการคำขอ BOQ DECAAR ตามบทบาท
   - พนักงานขาย: คำขอของตัวเอง แยกตามสิ่งที่ต้องทำ + ปุ่มขอใหม่
   - ห้องแบบ: รอรับงาน / งานของฉัน / ทั้งหมด + งานค้างของห้องแบบแต่ละคน
   - Marketing / admin / ร้าน / Area: ดูอย่างเดียว กรองสถานะ + ค้นหา */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icon";
import { BottomNav } from "../bottom-nav";
import { PushToggle } from "../push-toggle";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import { DESIGNER_PHASE, baht, dateTh, fetchBoqList, needLabel, slaBadge, type BoqListItem, type BoqRole, type BoqStatus } from "@/lib/commission/boq-store";
import { BoqHeader, StatusPill, btn, card } from "./boq-shared";

type Tab = { key: string; label: string; match: (j: BoqListItem) => boolean };

function JobCard({ j, role, me, now }: { j: BoqListItem; role: BoqRole; me: string; now: Date }) {
  const sla = DESIGNER_PHASE.includes(j.status) ? slaBadge(j.dueAt, now) : null;
  const lockedByOther = role === "designer" && j.designerId && j.designerId !== me && DESIGNER_PHASE.includes(j.status);
  const okDays = j.status === "boq_ok" && j.boqOkAt ? Math.floor((now.getTime() - new Date(j.boqOkAt).getTime()) / 86400000) : 0;
  return (
    <Link href={`/app/boq/${j.id}`} className={cn(card, "block p-3.5 hover:-translate-y-0.5 transition-all", lockedByOther && "opacity-60")}>
      <div className="flex items-center gap-2 flex-wrap">
        <StatusPill status={j.status} />
        {sla && <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", sla.cls)}>{sla.text}</span>}
        <span className="ml-auto text-[10px] text-slate-400">{j.reqNo}</span>
      </div>
      <p className="text-[14px] font-bold text-slate-800 mt-2">{j.customerName}</p>
      <p className="text-[11px] text-slate-500">
        {needLabel(j.need)} · {j.points} จุด · งบ {baht(j.budget)}
        {j.province ? ` · ${j.province}` : ""}
      </p>
      <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-500">
        <Icon name={role === "sales" ? "design_services" : "storefront"} style={{ fontSize: 14 }} />
        <span className="truncate">
          {role === "sales" ? (j.designerName ? `ห้องแบบ: ${j.designerName}` : "ยังไม่มีห้องแบบรับ") : `${j.dealerName} · ${j.repName}`}
        </span>
        <span className="ml-auto shrink-0">{dateTh(j.createdAt, true)}</span>
      </div>
      {lockedByOther && <p className="text-[11px] text-slate-600 mt-1.5 font-semibold">🔒 {j.designerName ?? "ห้องแบบคนอื่น"} รับงานนี้แล้ว</p>}
      {role !== "sales" && role !== "designer" && j.designerName && <p className="text-[11px] text-slate-500 mt-1">ห้องแบบ: {j.designerName}</p>}
      {j.status === "boq_ok" && okDays >= 7 && <p className="text-[11px] text-amber-700 mt-1.5 font-semibold">⏰ BOQ ผ่านมา {okDays} วัน ยังไม่บันทึกใบเสนอราคา</p>}
      {j.status === "quoted" && j.quoteAmount != null && <p className="text-[11px] text-indigo-700 mt-1">เสนอราคา {baht(j.quoteAmount)}</p>}
      {j.status === "win" && <p className="text-[11px] text-emerald-700 mt-1 font-semibold">ยอดปิดจริง {baht(j.finalAmount)}</p>}
    </Link>
  );
}

function Tabs({ tabs, items, value, onChange }: { tabs: Tab[]; items: BoqListItem[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition",
            value === t.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
          )}
        >
          {t.label} <span className="opacity-60">{items.filter(t.match).length}</span>
        </button>
      ))}
    </div>
  );
}

const st = (...s: BoqStatus[]) => (j: BoqListItem) => s.includes(j.status);
const SALES_TABS: Tab[] = [
  { key: "review", label: "รอฉันตรวจ", match: st("submitted") },
  { key: "quote", label: "รอใบเสนอราคา", match: st("boq_ok") },
  { key: "result", label: "รอผล", match: st("quoted") },
  { key: "design", label: "ห้องแบบกำลังทำ", match: st("waiting", "working", "revise") },
  { key: "closed", label: "ปิดแล้ว", match: st("win", "loss", "cancelled") },
];
const VIEW_TABS: Tab[] = [
  { key: "active", label: "กำลังดำเนินการ", match: st("waiting", "working", "revise", "submitted", "boq_ok", "quoted") },
  { key: "design", label: "ห้องแบบ", match: st("waiting", "working", "revise") },
  { key: "sales", label: "รอพนักงาน", match: st("submitted", "boq_ok", "quoted") },
  { key: "win", label: "Win", match: st("win") },
  { key: "loss", label: "Loss", match: st("loss") },
  { key: "all", label: "ทั้งหมด", match: () => true },
];

export function BoqListScreen() {
  const { session, ready } = useSession();
  const [data, setData] = useState<{ role: BoqRole; me: string; enabled: boolean; items: BoqListItem[] } | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchBoqList()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const role = data?.role ?? "viewer";
  const me = data?.me ?? "";
  const items = useMemo(() => data?.items ?? [], [data]);
  const designerTabs: Tab[] = useMemo(
    () => [
      { key: "queue", label: "รอรับงาน", match: st("waiting") },
      { key: "mine", label: "งานของฉัน", match: (j) => j.designerId === me && ["working", "revise", "submitted"].includes(j.status) },
      { key: "all", label: "ห้องแบบทั้งหมด", match: st("waiting", "working", "revise", "submitted") },
      { key: "done", label: "ส่งแล้ว", match: (j) => j.designerId === me && ["boq_ok", "quoted", "win", "loss"].includes(j.status) },
    ],
    [me]
  );
  const tabs = role === "sales" ? SALES_TABS : role === "designer" ? designerTabs : VIEW_TABS;
  const firstWithItems = tabs.find((t) => items.some(t.match))?.key ?? tabs[0].key;
  const curTab = tabs.find((t) => t.key === tab) ?? tabs.find((t) => t.key === firstWithItems)!;
  const kw = q.trim().toLowerCase();
  const list = items.filter(curTab.match).filter((j) => !kw || `${j.reqNo} ${j.customerName} ${j.dealerName} ${j.repName} ${j.province ?? ""}`.toLowerCase().includes(kw));

  if (!ready || !session) return null;

  const title = role === "sales" ? "คำขอของฉัน" : role === "designer" ? "งานห้องแบบ" : "ติดตามงาน BOQ";
  const designerLoad = role === "designer" || role === "marketing" || role === "admin"
    ? Object.entries(
        items
          .filter((j) => j.designerId && ["working", "revise"].includes(j.status))
          .reduce<Record<string, number>>((a, j) => ((a[j.designerName ?? "-"] = (a[j.designerName ?? "-"] ?? 0) + 1), a), {})
      )
    : [];
  const closed = items.filter((j) => j.status === "win" || j.status === "loss");
  const wins = items.filter((j) => j.status === "win");

  return (
    <>
      <BoqHeader title={title} back={role === "sales" ? "/app/home-staff" : role === "designer" || role === "marketing" ? undefined : "/app/home"} />
      <div className="space-y-3 pb-4">
        {(role === "designer" || role === "marketing" || role === "sales") && (
          <PushToggle hideWhenOn offNote={role === "designer" ? "เปิดไว้เพื่อรู้ทันทีเมื่อมีคำขอ BOQ ใหม่ / ถูกขอแก้ไข" : role === "sales" ? "เปิดไว้เพื่อรู้ทันทีเมื่อห้องแบบรับงาน / ส่ง BOQ แล้ว" : "เปิดไว้รับสรุปรายสัปดาห์ และงานที่เกินกำหนด"} />
        )}
        {data && role !== "sales" && role !== "designer" && (
          <div className="flex gap-2">
            <Link href="/app/boq/overview" className="flex-1 text-center py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-[12px] font-bold">ภาพรวม</Link>
            <span className="flex-1 text-center py-2 rounded-xl bg-slate-900 text-white text-[12px] font-bold">รายการงาน</span>
          </div>
        )}
        {data && !data.enabled && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-800">ระบบขอ BOQ DECAAR ยังไม่เปิดใช้งาน</p>
        )}
        {role === "sales" && data?.enabled && (
          <Link href="/app/boq/new" className={cn(btn, "w-full bg-[#d32029] text-white flex items-center justify-center gap-1.5 py-3")}>
            <Icon name="add_circle" style={{ fontSize: 20 }} /> ขอ BOQ DECAAR ใหม่
          </Link>
        )}
        {role === "admin" && (
          <Link href="/app/boq/holidays" className={cn(card, "flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold text-slate-700")}>
            <Icon name="event_busy" className="text-[#d32029]" style={{ fontSize: 18 }} />
            <span className="flex-1">วันหยุด (ไม่นับใน SLA ห้องแบบ)</span>
            <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
          </Link>
        )}
        {error && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">โหลดไม่สำเร็จ: {error}</p>}
        {!data && !error && <p className="text-center text-[12px] text-slate-400 py-8">กำลังโหลด...</p>}

        {data && role !== "designer" && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: "คำขอทั้งหมด", v: String(items.length) },
              { k: "อัตรา Win", v: closed.length ? `${Math.round((wins.length / closed.length) * 100)}%` : "-" },
              { k: "ยอดปิดจริง", v: baht(wins.reduce((s, j) => s + (j.finalAmount ?? 0), 0)) },
            ].map((s) => (
              <div key={s.k} className={cn(card, "p-2.5 text-center")}>
                <p className="text-[10px] text-slate-500">{s.k}</p>
                <p className="text-[15px] font-bold text-slate-800">{s.v}</p>
              </div>
            ))}
          </div>
        )}

        {data && designerLoad.length > 0 && (
          <div className={cn(card, "p-3")}>
            <p className="text-[11px] font-semibold text-slate-600 mb-2">งานที่ห้องแบบกำลังทำ</p>
            <div className="flex flex-wrap gap-2">
              {designerLoad.map(([n, c]) => (
                <span key={n} className="rounded-xl bg-slate-50 px-3 py-1.5 text-[12px] text-slate-700">
                  {n} <b className="text-slate-900">{c}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        {data && (
          <>
            <Tabs tabs={tabs} items={items} value={curTab.key} onChange={setTab} />
            {role !== "sales" && (
              <div className="relative">
                <Icon name="search" className="absolute left-3 top-2.5 text-slate-400" style={{ fontSize: 18 }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา เลขที่ / ลูกค้า / ร้าน / พนักงาน" className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-[13px] outline-none" />
              </div>
            )}
            <div className="space-y-2.5">
              {list.map((j) => <JobCard key={j.id} j={j} role={role} me={me} now={now} />)}
              {list.length === 0 && <p className="text-center text-[12px] text-slate-400 py-8">ไม่มีงานในหมวดนี้</p>}
            </div>
          </>
        )}
      </div>
      {role === "sales" && <BottomNav active="home" />}
    </>
  );
}
