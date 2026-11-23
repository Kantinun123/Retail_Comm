"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { LEAD_STATUS, PRODUCTS, agoText, dtTh, leadSla, type Job, type Lead, type LeadStatus, type Task } from "./crm-mock-data";
import { Avatar, SlaBadge, glass, inputCls } from "./crm-ui";

export type View = "home" | "leads" | "board" | "exchange";
export interface Ctx {
  leads: Lead[]; jobs: Job[]; tasks: Task[];
  openLead: (id: string) => void; openJob: (id: string) => void; openTask: (t: Task) => void;
  newJob: () => void; ask: () => void; toast: (m: string) => void; go: (v: View) => void;
}

/* ---------------- Leads ---------------- */
export function LeadsView({ c }: { c: Ctx }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState<LeadStatus | "all">("all");
  const [prod, setProd] = useState("");
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: c.leads.length };
    for (const l of c.leads) m[l.status] = (m[l.status] ?? 0) + 1;
    return m;
  }, [c.leads]);
  const rows = c.leads
    .filter((l) => (st === "all" || l.status === st) && (!prod || l.product === prod) && (!q || `${l.name}${l.phone}${l.id}${l.province}`.includes(q)))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const breach = c.leads.filter((l) => l.status === "waiting" && leadSla(l).state === "breach").length;
  const chips: { k: LeadStatus | "all"; label: string }[] = [{ k: "all", label: "ทั้งหมด" }, { k: "waiting", label: "รอติดต่อ" }, { k: "contacting", label: "กำลังสกรีน" }, { k: "qualified", label: "รอเปิด Ops" }, { k: "converted", label: "เปิด Ops แล้ว" }, { k: "lost", label: "Loss" }];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">ลูกค้ามุ่งหวัง (Leads)</h1>
          <p className="text-[12.5px] text-slate-500">Lead จากเว็บฟอร์มเข้ามาที่นี่อัตโนมัติ · SLA ติดต่อครั้งแรกตามช่องทาง (Walk-in 2 ชม. · Contact Center / LINE OA 4 ชม. · Home Online / Dealer Referral 24 ชม.)</p>
        </div>
        {breach > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-bold text-rose-700"><Icon name="alarm" style={{ fontSize: 16 }} />เกิน SLA {breach} ราย</span>}
      </div>
      <div className={cn(glass, "space-y-3 p-3 md:p-4")}>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ เบอร์ รหัส หรือจังหวัด" className={cn(inputCls, "pl-9")} />
          </div>
          <select value={prod} onChange={(e) => setProd(e.target.value)} className={cn(inputCls, "w-auto")}>
            <option value="">ทุก Solution</option>
            {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((ch) => (
            <button key={ch.k} onClick={() => setSt(ch.k)} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold transition", st === ch.k ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300")}>
              {ch.label} <span className={st === ch.k ? "text-white/70" : "text-slate-400"}>{counts[ch.k] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={cn(glass, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[12.5px]">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>{["ลูกค้า", "Solution", "ช่องทาง", "เข้ามาเมื่อ", "SLA ติดต่อครั้งแรก", "สถานะ", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} onClick={() => c.openLead(l.id)} className="cursor-pointer border-t border-slate-100 transition hover:bg-indigo-50/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={l.name} />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{l.name}</div>
                        <div className="text-[11px] text-slate-400">{l.id} · {l.province}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{l.product}</td>
                  <td className="px-4 py-3 text-slate-500">{l.channel}</td>
                  <td className="px-4 py-3 text-slate-500">{dtTh(l.createdAt)}<div className="text-[11px] text-slate-400">{agoText(l.createdAt)}</div></td>
                  <td className="px-4 py-3"><SlaBadge lead={l} /></td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", LEAD_STATUS[l.status].cls)}>{LEAD_STATUS[l.status].label}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); c.toast(`กำลังโทร ${l.phone} (ตัวอย่าง)`); }} className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100" aria-label="โทร"><Icon name="call" style={{ fontSize: 17 }} /></button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-slate-400">ไม่พบรายการ</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

