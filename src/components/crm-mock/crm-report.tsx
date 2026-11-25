"use client";
/* มุมมองตามตำแหน่ง (เดโม): แถบสลับบทบาท + รายงานทีมขายสำหรับโค้ช / Area / ร้านค้า
   ตัวเลขรายร้านเป็นข้อมูลสมมติ ส่วนแถบสรุปด้านบนคำนวณจาก Lead/Opp ในหน้านี้ */
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { OWNERS, dayKey, isFinished, leadSla, NOW, type Job, type Lead } from "./crm-mock-data";
import type { Ctx } from "./crm-views";
import { glass } from "./crm-ui";

export type Role = "se" | "coach" | "area" | "dealer";
export const ROLES: { k: Role; label: string; icon: string; scope: string }[] = [
  { k: "se", label: "พนักงานขาย (SE)", icon: "badge", scope: "เห็นเฉพาะ Lead/Opp ของตัวเอง ทำงานได้เต็มที่" },
  { k: "coach", label: "โค้ช", icon: "sports", scope: "เห็นทีมขายในร้านที่ดูแล อ่านอย่างเดียว" },
  { k: "area", label: "Area", icon: "map", scope: "เห็นทุกร้านในพื้นที่ อ่านอย่างเดียว" },
  { k: "dealer", label: "ร้านค้า", icon: "storefront", scope: "เห็นเฉพาะร้านตัวเอง อ่านอย่างเดียว" },
];

export function RoleBar({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  const cur = ROLES.find((r) => r.k === role) ?? ROLES[0];
  return (
    <div className={cn(glass, "mb-4 flex flex-wrap items-center gap-2 p-2.5")}>
      <span className="px-2 text-[11.5px] font-semibold text-slate-500">ดูในมุมมองของ</span>
      {ROLES.map((r) => (
        <button key={r.k} onClick={() => onChange(r.k)} className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition", r.k === role ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "bg-white/70 text-slate-600 hover:bg-indigo-50")}>
          <Icon name={r.icon} style={{ fontSize: 17 }} />{r.label}
        </button>
      ))}
      <span className="ml-auto text-[11px] text-slate-400">{cur.scope} · เดโมสลับได้ ของจริงตามบัญชีที่ login</span>
    </div>
  );
}

const Pill = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>{children}</span>
);

interface Row { name: string; sub: string; lead: number; sla: number | null; visit: number; quote: number; win: number; csat: number | null }
const SCOPE: Record<Exclude<Role, "se">, string> = { area: "Area แดง · ทุกร้านในพื้นที่", coach: "โค้ชเนม · 3 ร้านที่ดูแล", dealer: "ร้านหาดใหญ่โฮม (ร้านเดียว)" };

function rowOf(name: string, sub: string, leads: Lead[], jobs: Job[]): Row {
  const met = leads.filter((l) => leadSla(l).state === "met").length;
  const breach = leads.filter((l) => leadSla(l).state === "breach").length;
  const vals = jobs.flatMap((j) => [j.csat?.r1?.done?.avg, j.csat?.r2?.done?.avg]).filter((x): x is number => typeof x === "number");
  return {
    name, sub, lead: leads.length, sla: met + breach ? Math.round((met * 100) / (met + breach)) : null,
    visit: leads.filter((l) => l.visitAt || l.channel === "Walk-in").length, quote: jobs.filter((j) => j.done.quote1 || j.done.quote2).length,
    win: jobs.filter((j) => j.done.close).length, csat: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
  };
}

export function ReportView({ role, c, stores }: { role: Exclude<Role, "se">; c: Ctx; stores: string[] }) {
  const rows: Row[] = role === "dealer"
    ? OWNERS.map((o) => rowOf(o, "พนักงานขาย", c.leads.filter((l) => l.owner === o), c.jobs.filter((j) => j.owner === o)))
    : stores.map((s) => rowOf(s, "", c.leads.filter((l) => l.store === s), c.jobs.filter((j) => j.store === s)));
  const attn: string[] = [
    ...rows.filter((r) => r.sla !== null && r.sla < 70).map((r) => `${r.name}: ติดต่อทัน SLA เพียง ${r.sla}%`),
    ...rows.filter((r) => r.csat !== null && r.csat < 3.5).map((r) => `${r.name}: CSAT เฉลี่ย ${r.csat?.toFixed(1)} ต่ำกว่าเกณฑ์`),
    ...c.leads.filter((l) => l.status === "waiting" && leadSla(l).state === "breach").map((l) => `Lead ${l.id} (${l.store ?? "ไม่มีร้านรับพื้นที่"}) เกิน SLA ติดต่อครั้งแรก`),
  ];
  const today = dayKey(NOW.toISOString());
  const nToday = c.leads.filter((l) => dayKey(l.createdAt) === today).length;
  const met = c.leads.filter((l) => leadSla(l).state === "met").length;
  const breach = c.leads.filter((l) => leadSla(l).state === "breach").length;
  const slaPct = met + breach ? Math.round((met * 100) / (met + breach)) : 0;
  const open = c.jobs.filter((j) => !j.cancelReason && !isFinished(j)).length;
  const closed = c.jobs.filter((j) => j.done.close).length;
  const kpis: [string, string, string][] = [
    ["Lead ทั้งหมด", String(c.leads.length), "text-slate-900"], ["Lead วันนี้", String(nToday), "text-slate-900"], ["ติดต่อทัน SLA", `${slaPct}%`, slaPct >= 80 ? "text-emerald-600" : "text-amber-600"],
    ["Opp ที่กำลังทำ", String(open), "text-indigo-700"], ["ปิดขายแล้ว", String(closed), "text-emerald-600"],
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">รายงานทีมขาย</h1>
        <p className="text-[12.5px] text-slate-500">ขอบเขต: {SCOPE[role]} · พ.ย. 2569 · อ่านอย่างเดียว คำนวณจาก Lead/Opp ตามพื้นที่รับงานของร้าน</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map(([k, v, cls]) => (
          <div key={k} className={cn(glass, "p-3")}><div className={cn("text-[22px] font-bold leading-none", cls)}>{v}</div><div className="mt-1 text-[11.5px] text-slate-500">{k}</div></div>
        ))}
      </div>
      <div className={cn(glass, "overflow-x-auto p-4")}>
        <div className="mb-2 text-[13px] font-bold text-slate-900">{role === "dealer" ? "รายบุคคล (พนักงานขายของร้าน)" : "รายร้าน"}</div>
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead className="text-[11px] text-slate-400"><tr>{[role === "dealer" ? "พนักงานขาย" : "ร้าน", "Lead", "ติดต่อทัน SLA", "Visit", "Quote", "Win", "CSAT"].map((h) => <th key={h} className="pb-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-slate-100">
                <td className="py-2 font-semibold text-slate-800">{r.name}</td><td>{r.lead}</td>
                <td>{r.sla === null ? <span className="text-slate-300">-</span> : <Pill cls={r.sla >= 90 ? "bg-emerald-50 text-emerald-700" : r.sla >= 70 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}>{r.sla}%</Pill>}</td>
                <td>{r.visit}</td><td>{r.quote}</td><td>{r.win}</td>
                <td>{r.csat === null ? <span className="text-slate-300">-</span> : <Pill cls={r.csat >= 4 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>{r.csat.toFixed(1)}</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-400">ตัวเลขคำนวณจาก Lead/Opp ของเดโมตามพื้นที่รับงานของร้าน (Opp นับตามจังหวัดหน้างาน)</p>
      </div>
      <div className={cn(glass, "p-4")}>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="flag" style={{ fontSize: 18 }} />ควรตามด้วยตัวเอง</div>
        {attn.length === 0 ? <p className="text-[12px] text-slate-400">ไม่มีรายการที่ต้องตามเป็นพิเศษ</p> : attn.map((t) => <div key={t} className="mb-1.5 rounded-xl bg-rose-50/70 px-3 py-2 text-[12px] text-slate-700">{t}</div>)}
      </div>
    </div>
  );
}
