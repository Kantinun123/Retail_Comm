"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { DEALER_STEP, LEAD_STATUS, NOW, PRODUCTS, agoText, dayKey, dtTh, hoursSince, leadSla, type Job, type Lead, type LeadStatus, type Task } from "./crm-mock-data";
import { Avatar, SlaBadge, btnPrimary, glass, inputCls } from "./crm-ui";

export type View = "home" | "leads" | "board" | "exchange" | "report";
export interface Ctx {
  leads: Lead[]; jobs: Job[]; tasks: Task[];
  openLead: (id: string) => void; openJob: (id: string) => void; openTask: (t: Task) => void;
  readOnly: boolean; addLead: () => void; newJob: () => void; newSurvey: (lead?: Lead) => void; ask: () => void; toast: (m: string) => void; go: (v: View) => void;
}

/* ---------------- Leads ---------------- */
export function LeadsView({ c }: { c: Ctx }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState<LeadStatus | "all">("all");
  const [prod, setProd] = useState("");
  const [mode, setMode] = useState<"board" | "list">("board");
  const [flt, setFlt] = useState<"" | "sla" | "visit" | "stale">("");
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: c.leads.length };
    for (const l of c.leads) m[l.status] = (m[l.status] ?? 0) + 1;
    return m;
  }, [c.leads]);
  const today = dayKey(NOW.toISOString());
  const visitDay = (l: Lead) => { const v = l.visitAt ?? (l.channel === "Walk-in" ? l.createdAt : undefined); return v ? dayKey(v) : ""; };
  const isSla = (l: Lead) => l.status === "waiting" && leadSla(l).state === "breach";
  const isVisit = (l: Lead) => visitDay(l) === today;
  const isStale = (l: Lead) => l.status === "qualified" && hoursSince(l.createdAt) > 72;
  const rows = c.leads
    .filter((l) => (!flt || (flt === "sla" ? isSla(l) : flt === "visit" ? isVisit(l) : isStale(l))) && (st === "all" || l.status === st) && (!prod || l.product === prod) && (!q || `${l.name}${l.phone}${l.id}${l.province}`.includes(q)))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const breach = c.leads.filter(isSla).length;
  const nToday = c.leads.filter((l) => dayKey(l.createdAt) === today).length;
  const nMonth = c.leads.filter((l) => dayKey(l.createdAt).slice(0, 7) === today.slice(0, 7)).length;
  const strip = [
    { k: "sla" as const, label: "เกิน SLA", n: breach, icon: "alarm", tone: "text-rose-700 bg-rose-50 border-rose-200" },
    { k: "visit" as const, label: "เข้าร้านวันนี้", n: c.leads.filter(isVisit).length, icon: "storefront", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { k: "stale" as const, label: "รอเปิด Opp เกิน 3 วัน", n: c.leads.filter(isStale).length, icon: "hourglass_top", tone: "text-violet-700 bg-violet-50 border-violet-200" },
  ];
  const chips: { k: LeadStatus | "all"; label: string }[] = [{ k: "all", label: "ทั้งหมด" }, { k: "waiting", label: "รอติดต่อ" }, { k: "contacting", label: "กำลังสกรีน" }, { k: "qualified", label: "รอเปิด Opp" }, { k: "converted", label: "เปิด Opp แล้ว" }, { k: "lost", label: "Loss" }];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">ลูกค้ามุ่งหวัง (Leads)</h1>
          <p className="text-[12.5px] text-slate-500">Lead จากเว็บฟอร์มเข้ามาที่นี่อัตโนมัติ · SLA ติดต่อครั้งแรกตามช่องทาง (Walk-in 2 ชม. · Contact Center / LINE OA 4 ชม. · Home Online / Dealer Referral 24 ชม.)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
            {([["board", "กระดาน", "view_kanban"], ["list", "รายการ", "list"]] as const).map(([k, label, ic]) => (
              <button key={k} onClick={() => setMode(k)} className={cn("inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold", mode === k ? "bg-indigo-600 text-white" : "text-slate-600")}><Icon name={ic} style={{ fontSize: 16 }} />{label}</button>
            ))}
          </div>
          {!c.readOnly && <button onClick={c.addLead} className={btnPrimary}><Icon name="add" style={{ fontSize: 18 }} />เพิ่ม Lead</button>}
        </div>
      </div>
      <div className={cn(glass, "flex flex-wrap items-center gap-x-5 gap-y-2 p-3")}>
        <div className="flex items-center gap-4 text-[12px] text-slate-500">
          <span><b className="text-[16px] text-slate-900">{nToday}</b> Lead วันนี้</span>
          <span><b className="text-[16px] text-slate-900">{nMonth}</b> เดือนนี้</span>
          <span><b className="text-[16px] text-slate-900">{c.leads.length}</b> สะสม</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {strip.map((s) => (
            <button key={s.k} onClick={() => setFlt(flt === s.k ? "" : s.k)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition", s.tone, flt === s.k && "ring-2 ring-indigo-400")}><Icon name={s.icon} style={{ fontSize: 16 }} />{s.label} {s.n}</button>
          ))}
          {flt && <button onClick={() => setFlt("")} className="px-2 text-[12px] font-semibold text-slate-500 underline">ล้างตัวกรอง</button>}
        </div>
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
        {mode === "list" && <div className="flex flex-wrap gap-2">
          {chips.map((ch) => (
            <button key={ch.k} onClick={() => setSt(ch.k)} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold transition", st === ch.k ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300")}>
              {ch.label} <span className={st === ch.k ? "text-white/70" : "text-slate-400"}>{counts[ch.k] ?? 0}</span>
            </button>
          ))}
        </div>}
      </div>
      {mode === "board" && <LeadBoard c={c} rows={rows} />}
      {mode === "list" && (
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
      )}
    </div>
  );
}

/* ---------------- กระดาน Lead ---------------- */
const BOARD_COLS: { key: string; title: string; sub: string; tone: string; pick: (l: Lead) => boolean }[] = [
  { key: "waiting", title: "รอติดต่อ", sub: "SLA นับเวลา", tone: "border-amber-300", pick: (l) => l.status === "waiting" },
  { key: "contacting", title: "กำลังสกรีน", sub: "ถามความสนใจ", tone: "border-sky-300", pick: (l) => l.status === "contacting" },
  { key: "solution", title: "สาย Solution", sub: "รอเปิด Opp / เปิด Opp แล้ว", tone: "border-indigo-300", pick: (l) => l.status === "qualified" || l.status === "converted" },
  { key: "dealer", title: "สายสินค้า · ส่งให้ร้านแล้ว", sub: "ร้านทำใบเสนอราคาในระบบร้าน", tone: "border-fuchsia-300", pick: (l) => l.status === "dealer" },
  { key: "lost", title: "Loss", sub: "ไม่ซื้อ / ร้านแจ้งแพ้", tone: "border-rose-300", pick: (l) => l.status === "lost" },
];
function LeadBoard({ c, rows }: { c: Ctx; rows: Lead[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {BOARD_COLS.map((col) => {
        const items = rows.filter(col.pick);
        return (
          <div key={col.key} className={cn("rounded-2xl border-t-4 bg-white/60 p-2.5", col.tone)}>
            <div className="mb-2 px-1">
              <div className="text-[13px] font-bold text-slate-900">{col.title} <span className="text-slate-400">{items.length}</span></div>
              <div className="text-[10.5px] text-slate-400">{col.sub}</div>
            </div>
            <div className="space-y-2">
              {items.map((l) => (
                <button key={l.id} onClick={() => c.openLead(l.id)} className={cn(glass, "block w-full p-3 text-left transition hover:-translate-y-0.5")}>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="whitespace-nowrap text-[10.5px] text-slate-400">{l.id}</span>
                    {l.status === "dealer" && l.dealerStep
                      ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", DEALER_STEP[l.dealerStep].cls)}>{DEALER_STEP[l.dealerStep].label}{l.dealerStep === "quoted" || l.dealerStep === "won" ? ` ฿${(l.dealerAmount ?? 0).toLocaleString("en-US")}` : ""}</span>
                      : l.status === "waiting" || l.status === "contacting" ? <SlaBadge lead={l} />
                      : <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", LEAD_STATUS[l.status].cls)}>{LEAD_STATUS[l.status].label}</span>}
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-slate-900">{l.name}</div>
                  <div className="text-[11px] text-slate-500">{l.province} · {l.channel}</div>
                  <div className="mt-1 text-[11.5px] text-slate-600">{l.product}</div>
                  {l.dealerStore && <div className="mt-2 flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10.5px] text-slate-600"><Icon name="storefront" style={{ fontSize: 14 }} />{l.dealerStore}</div>}
                  {l.status === "lost" && l.lostReason && <div className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-[10.5px] text-rose-700">{l.lostReason}</div>}
                </button>
              ))}
              {items.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11.5px] text-slate-400">ไม่มีรายการ</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
