"use client";
/* มุมมองตามตำแหน่ง (เดโม): แถบสลับบทบาท + รายงานทีมขายสำหรับโค้ช / Area / ร้านค้า
   ตัวเลขรายร้านเป็นข้อมูลสมมติ ส่วนแถบสรุปด้านบนคำนวณจาก Lead/Opp ในหน้านี้ */
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { dayKey, isFinished, leadSla, NOW } from "./crm-mock-data";
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

interface Row { store: string; se: string; lead: number; sla: number; visit: number; quote: number; win: number; csat: number }
const ROWS: Record<Exclude<Role, "se">, Row[]> = {
  area: [
    { store: "ร้านหาดใหญ่โฮม", se: "4 คน", lead: 18, sla: 94, visit: 9, quote: 6, win: 3, csat: 4.6 },
    { store: "ร้านสงขลาวัสดุ", se: "3 คน", lead: 14, sla: 71, visit: 5, quote: 3, win: 1, csat: 4.1 },
    { store: "ร้านภูเก็ตวัสดุ", se: "3 คน", lead: 11, sla: 55, visit: 3, quote: 2, win: 0, csat: 3.4 },
    { store: "ร้านตรังซีเมนต์", se: "2 คน", lead: 9, sla: 100, visit: 6, quote: 5, win: 3, csat: 4.8 },
  ],
  coach: [
    { store: "ร้านหาดใหญ่โฮม", se: "4 คน", lead: 18, sla: 94, visit: 9, quote: 6, win: 3, csat: 4.6 },
    { store: "ร้านสงขลาวัสดุ", se: "3 คน", lead: 14, sla: 71, visit: 5, quote: 3, win: 1, csat: 4.1 },
    { store: "ร้านภูเก็ตวัสดุ", se: "3 คน", lead: 11, sla: 55, visit: 3, quote: 2, win: 0, csat: 3.4 },
  ],
  dealer: [
    { store: "สมชาย", se: "SE", lead: 7, sla: 100, visit: 4, quote: 3, win: 2, csat: 4.8 },
    { store: "มาลี", se: "SE", lead: 6, sla: 83, visit: 3, quote: 2, win: 1, csat: 4.4 },
    { store: "ประเสริฐ", se: "SE", lead: 5, sla: 60, visit: 2, quote: 1, win: 0, csat: 3.6 },
  ],
};
const SCOPE: Record<Exclude<Role, "se">, string> = { area: "Area แดง · 9 ร้าน", coach: "โค้ชเนม · 3 ร้านที่ดูแล", dealer: "ร้านหาดใหญ่โฮม (ร้านเดียว)" };
const ATTN: Record<Exclude<Role, "se">, string[]> = {
  area: ["ร้านภูเก็ตวัสดุ: ติดต่อทัน SLA เพียง 55% และ CSAT 3.4", "ร้านสงขลาวัสดุ: Lead → Visit ต่ำกว่าค่าเฉลี่ยของพื้นที่", "Opp ใกล้ปิด 3 งาน ยังไม่มีการติดต่อ 5 วัน"],
  coach: ["ร้านภูเก็ตวัสดุ: ประเสริฐ ติดต่อ Lead เกิน SLA 4 ราย", "ร้านสงขลาวัสดุ: ลูกค้ารอใบเสนอราคา 2 ราย เกิน 3 วัน"],
  dealer: ["ประเสริฐ: ติดต่อทัน SLA 60% ควรช่วยตามงานค้าง", "Lead สายสินค้าที่ส่งมาให้ร้าน 2 ราย รอร้านเสนอราคา"],
};

export function ReportView({ role, c }: { role: Exclude<Role, "se">; c: Ctx }) {
  const rows = ROWS[role];
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
        <p className="text-[12.5px] text-slate-500">ขอบเขต: {SCOPE[role]} · พ.ย. 2569 · อ่านอย่างเดียว ใช้ติดตามพนักงานขาย</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map(([k, v, cls]) => (
          <div key={k} className={cn(glass, "p-3")}><div className={cn("text-[22px] font-bold leading-none", cls)}>{v}</div><div className="mt-1 text-[11.5px] text-slate-500">{k}</div></div>
        ))}
      </div>
      <div className={cn(glass, "overflow-x-auto p-4")}>
        <div className="mb-2 text-[13px] font-bold text-slate-900">{role === "dealer" ? "รายบุคคล (พนักงานขายของร้าน)" : "รายร้าน"}</div>
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead className="text-[11px] text-slate-400"><tr>{[role === "dealer" ? "พนักงานขาย" : "ร้าน", "ทีมขาย", "Lead", "ติดต่อทัน SLA", "Visit", "Quote", "Win", "CSAT"].map((h) => <th key={h} className="pb-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.store} className="border-t border-slate-100">
                <td className="py-2 font-semibold text-slate-800">{r.store}</td><td className="text-slate-500">{r.se}</td><td>{r.lead}</td>
                <td><Pill cls={r.sla >= 90 ? "bg-emerald-50 text-emerald-700" : r.sla >= 70 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}>{r.sla}%</Pill></td>
                <td>{r.visit}</td><td>{r.quote}</td><td>{r.win}</td>
                <td><Pill cls={r.csat >= 4 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>{r.csat.toFixed(1)}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-400">ตารางนี้เป็นข้อมูลสมมติ ส่วนแถบสรุปด้านบนคำนวณจาก Lead/Opp ในหน้านี้</p>
      </div>
      <div className={cn(glass, "p-4")}>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="flag" style={{ fontSize: 18 }} />ควรตามด้วยตัวเอง</div>
        {ATTN[role].map((t) => <div key={t} className="mb-1.5 rounded-xl bg-rose-50/70 px-3 py-2 text-[12px] text-slate-700">{t}</div>)}
      </div>
    </div>
  );
}
