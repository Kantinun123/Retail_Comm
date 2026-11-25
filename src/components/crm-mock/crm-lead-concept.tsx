"use client";
/* ภาพร่างแนวคิด (concept) ของหน้า Leads ตามชีต "Lead-Requirement CRM" ใช้ดูหน้าตาก่อนลงมือทำจริง
   ข้อมูลทั้งหมดสมมติ ไม่เชื่อมระบบใด ; เลือกมุมมองด้วย ?v=list | insight | walkin | timeline */
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { Avatar, Drawer, KV, Stat, btnGhost, btnPrimary, glass, grad, inputCls, labelCls } from "./crm-ui";

/* ---------------- ข้อมูลสมมติ ---------------- */
type StKey = "new" | "contact" | "quoted" | "nego" | "won" | "lost";
const ST: Record<StKey, { label: string; sub: string; cls: string }> = {
  new: { label: "New Lead", sub: "ใหม่", cls: "bg-amber-100 text-amber-800" },
  contact: { label: "Contact แล้ว", sub: "ติดต่อแล้ว", cls: "bg-sky-100 text-sky-800" },
  quoted: { label: "Quoted", sub: "ออกใบเสนอราคาแล้ว", cls: "bg-violet-100 text-violet-800" },
  nego: { label: "Negotiation", sub: "กำลังพิจารณา", cls: "bg-orange-100 text-orange-800" },
  won: { label: "Won", sub: "ปิดการขาย", cls: "bg-emerald-100 text-emerald-800" },
  lost: { label: "Lost", sub: "ไม่ซื้อ", cls: "bg-rose-100 text-rose-700" },
};
const STATUS_COUNT: Record<StKey, number> = { new: 41, contact: 45, quoted: 7, nego: 6, won: 16, lost: 27 };

const CHANNELS = [
  { name: "Facebook Housing Expert", icon: "thumb_up" },
  { name: "Google Search", icon: "search" },
  { name: "Website", icon: "language" },
  { name: "LINE OA", icon: "chat" },
  { name: "Walk-in", icon: "storefront" },
  { name: "Refer", icon: "group_add" },
  { name: "Site Visit", icon: "pin_drop" },
  { name: "ลูกค้าเดิม", icon: "autorenew" },
];
const chIcon = (n: string) => CHANNELS.find((c) => c.name === n)?.icon ?? "help";
const CAMPAIGNS = ["ถอดแบบฟรี", "ถอดแบบรับ Coupon ส่วนลด", "ถอดแบบรับคะแนน Extra"];
const CAMP_CLS = ["bg-indigo-50 text-indigo-700", "bg-fuchsia-50 text-fuchsia-700", "bg-teal-50 text-teal-700"];

interface Row {
  id: string; name: string; place: string; solution: string; channel: string; campaign: string | null; created: string;
  visit: string | null; sla: { ok: boolean; text: string } | null; st: StKey; lost?: string;
}
const ROWS: Row[] = [
  { id: "L-2611-009", name: "คุณนภา ใจงาม", place: "อุดรธานี", solution: "Roof Install", channel: "Facebook Housing Expert", campaign: "ถอดแบบฟรี", created: "24 พ.ย. 09:18", visit: null, sla: { ok: true, text: "เหลือ 22 ชม." }, st: "new" },
  { id: "L-2611-001", name: "คุณวิภา ศรีสุข", place: "สงขลา", solution: "Roof Install", channel: "Website", campaign: "ถอดแบบฟรี", created: "24 พ.ย. 07:42", visit: null, sla: { ok: true, text: "เหลือ 21 ชม." }, st: "new" },
  { id: "L-2611-002", name: "คุณธนากร ใจดี", place: "ขอนแก่น", solution: "Roof Install", channel: "Google Search", campaign: null, created: "24 พ.ย. 04:30", visit: null, sla: { ok: false, text: "เกิน SLA 2 ชม." }, st: "new" },
  { id: "L-2611-010", name: "คุณกิตติ ประเสริฐ", place: "ระยอง", solution: "Solar Roof", channel: "Walk-in", campaign: "ถอดแบบรับ Coupon ส่วนลด", created: "23 พ.ย. 14:30", visit: "23 พ.ย.", sla: { ok: true, text: "ทัน SLA · 1 ชม." }, st: "contact" },
  { id: "L-2611-005", name: "คุณสุดา มีสุข", place: "ภูเก็ต", solution: "Roof Install", channel: "Refer", campaign: "ถอดแบบรับคะแนน Extra", created: "20 พ.ย. 08:30", visit: "22 พ.ย.", sla: { ok: true, text: "ทัน SLA · 1 ชม." }, st: "quoted" },
  { id: "L-2611-006", name: "คุณอนันต์ ทองดี", place: "กรุงเทพมหานคร", solution: "Roof Install", channel: "LINE OA", campaign: "ถอดแบบฟรี", created: "19 พ.ย. 10:30", visit: "21 พ.ย.", sla: { ok: true, text: "ทัน SLA · 1 ชม." }, st: "nego" },
  { id: "L-2611-007", name: "คุณพิมพ์ใจ รักไทย", place: "สงขลา", solution: "Roof Install", channel: "Site Visit", campaign: "ถอดแบบรับ Coupon ส่วนลด", created: "3 พ.ย. 06:30", visit: "5 พ.ย.", sla: { ok: true, text: "ทัน SLA · 1 ชม. 40 น." }, st: "won" },
  { id: "L-2611-008", name: "คุณวีระ สุขสบาย", place: "ชลบุรี", solution: "Home Automation", channel: "LINE OA", campaign: null, created: "18 พ.ย. 09:00", visit: null, sla: { ok: true, text: "ทัน SLA · 2 ชม." }, st: "lost", lost: "ราคาไม่ได้" },
];

const FUNNEL = [
  { name: "Lead", icon: "person_search", n: 142, color: "from-indigo-500 to-indigo-400" },
  { name: "Visit", icon: "storefront", n: 58, color: "from-indigo-500 to-violet-500" },
  { name: "Estimate", icon: "calculate", n: 44, color: "from-violet-500 to-violet-400" },
  { name: "Quote", icon: "request_quote", n: 31, color: "from-violet-500 to-fuchsia-500" },
  { name: "Sales", icon: "paid", n: 14, color: "from-fuchsia-500 to-pink-500" },
  { name: "Repeat", icon: "autorenew", n: 3, color: "from-pink-500 to-rose-400" },
];
const CHANNEL_STATS = [
  { name: "Facebook Housing Expert", lead: 38, q: 18, cost: 9500 },
  { name: "Google Search", lead: 27, q: 17, cost: 8100 },
  { name: "Website", lead: 31, q: 17, cost: 3100 },
  { name: "LINE OA", lead: 22, q: 14, cost: 1100 },
  { name: "Walk-in", lead: 14, q: 12, cost: 0 },
  { name: "Refer", lead: 6, q: 5, cost: 0 },
  { name: "Site Visit", lead: 4, q: 3, cost: 0 },
];
const CAMP_STATS = [
  { name: CAMPAIGNS[0], lead: 64, visit: 27, win: 7, sales: 6 },
  { name: CAMPAIGNS[1], lead: 48, visit: 21, win: 6, sales: 5 },
  { name: CAMPAIGNS[2], lead: 30, visit: 10, win: 3, sales: 3 },
];
const BRANCH_VISITS = [
  { name: "สาขา หาดใหญ่", n: 16 }, { name: "สาขา กรุงเทพฯ", n: 14 }, { name: "สาขา ขอนแก่น", n: 11 }, { name: "สาขา ภูเก็ต", n: 9 }, { name: "สาขา เชียงใหม่", n: 8 },
];
const LOST_REASONS = [
  { name: "ราคาไม่ได้", n: 9 }, { name: "เลื่อนงานไปสร้างปีหน้า", n: 7 }, { name: "เลือกสินค้า/บริการแข่งขันแล้ว", n: 5 }, { name: "ยังไม่ได้รับเหมา", n: 4 }, { name: "เปลี่ยนแบบ", n: 2 },
];
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");
const money = (n: number) => `฿${n.toLocaleString("en-US")}`;

/* ---------------- ส่วนประกอบร่วม ---------------- */
function StBadge({ k }: { k: StKey }) {
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold", ST[k].cls)}>{ST[k].label}</span>;
}
function CampaignChip({ name }: { name: string }) {
  const i = Math.max(0, CAMPAIGNS.indexOf(name));
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", CAMP_CLS[i])}><Icon name="sell" style={{ fontSize: 13 }} />{name}</span>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const nav = [
    { label: "หน้าหลัก", icon: "space_dashboard", on: false }, { label: "Leads", icon: "person_search", on: true },
    { label: "งาน (Opp)", icon: "view_kanban", on: false }, { label: "เชื่อมข้อมูล", icon: "sync_alt", on: false },
  ];
  return (
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-[26rem] w-[26rem] rounded-full bg-fuchsia-300/20 blur-3xl" />
      </div>
      <div className="relative z-10 border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-center text-[11px] text-sky-800">
        ภาพร่างแนวคิด (concept) · ข้อมูลสมมติทั้งหมด · ยังไม่ใช่หน้าที่ใช้งานจริง
      </div>
      <aside className="fixed bottom-0 left-0 top-[29px] z-20 hidden w-64 flex-col border-r border-white/70 bg-white/70 p-4 backdrop-blur-xl lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className={cn("grid h-10 w-10 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/30", grad)}><Icon name="hub" /></span>
          <div>
            <div className="text-[15px] font-bold leading-tight text-slate-900">CRM</div>
            <div className="text-[11px] text-slate-400">Housing Expert · ทีมขาย</div>
          </div>
        </div>
        <nav className="space-y-1">
          {nav.map((n) => (
            <div key={n.label} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold", n.on ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "text-slate-600")}>
              <Icon name={n.icon} fill={n.on} />{n.label}
            </div>
          ))}
        </nav>
        <div className={cn("mt-auto rounded-2xl p-4 text-white shadow-lg shadow-indigo-500/25", grad)}>
          <Icon name="auto_awesome" />
          <div className="mt-1 text-[13.5px] font-bold">ถามน้องเลขา</div>
          <div className="text-[11.5px] text-white/80">สรุปงาน ร่างข้อความ ตามหน่วยงาน</div>
        </div>
      </aside>
      <main className="relative z-10 px-4 pb-12 pt-5 md:px-8 lg:ml-64">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}

function PageHead({ mode }: { mode: "board" | "list" | "insight" }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">ลูกค้ามุ่งหวัง (Leads)</h1>
        <p className="text-[12.5px] text-slate-500">รับ Lead จากทุกช่องทาง บันทึกลูกค้าที่เข้ามาที่ร้าน และดูผลของแต่ละช่องทางกับแคมเปญ</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
          {([["board", "กระดาน", "view_kanban"], ["list", "รายการ", "table_rows"]] as const).map(([k, label, icon]) => (
            <span key={k} className={cn("flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold", mode === k ? "bg-indigo-600 text-white" : "text-slate-500")}>
              <Icon name={icon} style={{ fontSize: 17 }} />{label}
            </span>
          ))}
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold", mode === "insight" ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-700")}><Icon name="monitoring" style={{ fontSize: 18 }} />Insight</span>
        <span className={btnPrimary}><Icon name="add" style={{ fontSize: 18 }} />เพิ่ม Lead<Icon name="arrow_drop_down" style={{ fontSize: 20 }} /></span>
      </div>
    </div>
  );
}

/* แถบตัวนับบรรทัดเดียว: ตัวนับแต่ละตัวคือตัวกรอง (กดแล้วกรองกระดาน/รายการ) แทนทั้งการ์ด KPI และแถวชิปเดิม */
type Flt = "sla" | "appt" | "visit" | "ready";
const FLT_TONE = {
  rose: { on: "border-rose-600 bg-rose-600 text-white", n: "bg-rose-100 text-rose-700", i: "text-rose-500" },
  indigo: { on: "border-indigo-600 bg-indigo-600 text-white", n: "bg-indigo-100 text-indigo-700", i: "text-indigo-500" },
  emerald: { on: "border-emerald-600 bg-emerald-600 text-white", n: "bg-emerald-100 text-emerald-700", i: "text-emerald-500" },
  amber: { on: "border-amber-500 bg-amber-500 text-white", n: "bg-amber-100 text-amber-700", i: "text-amber-500" },
} as const;
const FLTS: { k: Flt; label: string; n: number; icon: string; tone: keyof typeof FLT_TONE }[] = [
  { k: "sla", label: "เกิน SLA", n: 2, icon: "alarm", tone: "rose" },
  { k: "appt", label: "นัดหมายวันนี้", n: 5, icon: "event", tone: "indigo" },
  { k: "visit", label: "เข้าร้านวันนี้", n: 3, icon: "storefront", tone: "emerald" },
  { k: "ready", label: "รอเปิด Opp เกิน 3 วัน", n: 3, icon: "hourglass_top", tone: "amber" },
];

function ActionStrip({ active }: { active?: Flt }) {
  return (
    <div className={cn(glass, "flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3")}>
      <div className="flex items-center gap-4 border-slate-200 pr-5 xl:border-r">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500"><Icon name="person_search" className="text-indigo-500" style={{ fontSize: 18 }} />Lead</span>
        {[["8", "วันนี้"], ["142", "เดือนนี้"], ["1,236", "สะสม"]].map(([n, l]) => (
          <span key={l} className="flex items-baseline gap-1"><b className="text-[18px] leading-none tracking-tight text-slate-900">{n}</b><span className="text-[11px] text-slate-500">{l}</span></span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {FLTS.map((f) => {
          const on = active === f.k;
          const t = FLT_TONE[f.tone];
          return (
            <span key={f.k} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold", on ? `${t.on} shadow` : "border-slate-200 bg-white text-slate-700")}>
              <Icon name={f.icon} className={on ? "text-white" : t.i} style={{ fontSize: 16 }} />{f.label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold", on ? "bg-white/25 text-white" : t.n)}>{f.n}</span>
            </span>
          );
        })}
        {active && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-slate-500"><Icon name="close" style={{ fontSize: 15 }} />ล้างตัวกรอง</span>}
      </div>
      <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600">Opp ที่ต้องตาม 9 ราย<Icon name="arrow_forward" style={{ fontSize: 16 }} /></span>
    </div>
  );
}

/* ---------------- 1) รายการ ---------------- */
function ListBody() {
  return (
    <div className="space-y-4">
      <PageHead mode="list" />
      <ActionStrip />
      <div className={cn(glass, "space-y-3 p-3 md:p-4")}>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input readOnly placeholder="ค้นหาชื่อ เบอร์ รหัส หรือจังหวัด" className={cn(inputCls, "pl-9")} />
          </div>
          <select className={cn(inputCls, "w-auto")} defaultValue=""><option value="">ทุกที่มา</option>{CHANNELS.map((c) => <option key={c.name}>{c.name}</option>)}</select>
          <select className={cn(inputCls, "w-auto")} defaultValue=""><option value="">ทุกแคมเปญ</option>{CAMPAIGNS.map((c) => <option key={c}>{c}</option>)}</select>
          <select className={cn(inputCls, "w-auto")} defaultValue=""><option value="">ทุกสาขา</option></select>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow">ทั้งหมด <span className="text-white/70">142</span></span>
          {(Object.keys(ST) as StKey[]).map((k) => (
            <span key={k} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600">{ST[k].label} <span className="text-slate-400">{STATUS_COUNT[k]}</span></span>
          ))}
        </div>
      </div>
      <div className={cn(glass, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-[12.5px]">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>{["ลูกค้า", "Solution", "ที่มา", "แคมเปญ", "เข้ามาเมื่อ", "Visit (เข้ารับบริการ)", "SLA ติดต่อครั้งแรก", "สถานะ"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{r.name}</div>
                        <div className="text-[11px] text-slate-400">{r.id} · {r.place}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.solution}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-slate-600"><Icon name={chIcon(r.channel)} className="text-slate-400" style={{ fontSize: 16 }} />{r.channel}</span></td>
                  <td className="px-4 py-3">{r.campaign ? <CampaignChip name={r.campaign} /> : <span className="text-slate-300">-</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{r.created}</td>
                  <td className="px-4 py-3">{r.visit ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Icon name="storefront" style={{ fontSize: 15 }} />{r.visit}</span> : <span className="text-slate-300">ยังไม่มา</span>}</td>
                  <td className="px-4 py-3">
                    {r.sla && <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold", r.sla.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}><Icon name={r.sla.ok ? "timer" : "alarm"} style={{ fontSize: 13 }} />{r.sla.text}</span>}
                  </td>
                  <td className="px-4 py-3"><StBadge k={r.st} />{r.lost && <div className="mt-1 text-[10.5px] text-rose-600">{r.lost}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-slate-400">แสดง 8 จาก 142 รายการ</div>
      </div>
    </div>
  );
}

/* ---------------- 2) Insight ---------------- */
function InsightBody() {
  const maxLead = Math.max(...CHANNEL_STATS.map((c) => c.lead));
  const maxVisit = Math.max(...BRANCH_VISITS.map((b) => b.n));
  const maxLost = Math.max(...LOST_REASONS.map((b) => b.n));
  const tot = CAMP_STATS.reduce((a, c) => ({ lead: a.lead + c.lead, visit: a.visit + c.visit, win: a.win + c.win, sales: a.sales + c.sales }), { lead: 0, visit: 0, win: 0, sales: 0 });
  const bestVisit = Math.max(...CAMP_STATS.map((c) => c.visit / c.lead));
  return (
    <div className="space-y-5">
      <PageHead mode="insight" />
      <div className="flex flex-wrap items-center gap-2">
        {["เดือนนี้", "3 เดือน", "ปีนี้"].map((p, i) => <span key={p} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold", i === 0 ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-600")}>{p}</span>)}
        <select className={cn(inputCls, "w-auto")} defaultValue=""><option value="">ทุกสาขา</option></select>
        <span className="ml-auto text-[11px] text-slate-400">ช่วง 1–24 พ.ย. 2569 · ตัวเลขตัวอย่าง</span>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon="groups" label="Lead Volume" value="142" sub="เดือนนี้" />
        <Stat icon="verified_user" label="Qualified Lead Rate" value="61%" sub="86 จาก 142 ผ่านการสกรีน" tone="emerald" />
        <Stat icon="storefront" label="Lead → Visit Rate" value="41%" sub="58 จาก 142" tone="amber" />
        <Stat icon="payments" label="Cost per Lead" value="฿185" sub="เฉพาะช่องทางที่มีต้นทุน · รวม ฿21,800" tone="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <section className={cn(glass, "p-4 md:p-5")}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">Funnel</h2>
            <span className="text-[11px] text-slate-400">Lead → Visit → Estimate → Quote → Sales → Repeat</span>
          </div>
          <ul className="space-y-2.5">
            {FUNNEL.map((f, i) => (
              <li key={f.name} className="flex items-center gap-3">
                <span className="flex w-24 shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-slate-700"><Icon name={f.icon} className="text-slate-400" style={{ fontSize: 17 }} />{f.name}</span>
                <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-slate-100">
                  <div className={cn("flex h-full items-center rounded-lg bg-gradient-to-r px-3 text-[12px] font-bold text-white", f.color)} style={{ width: `${Math.max(9, (f.n / FUNNEL[0].n) * 100)}%` }}>{f.n}</div>
                </div>
                <span className="w-28 shrink-0 whitespace-nowrap text-right text-[11px] font-semibold text-slate-500">{i === 0 ? "ทั้งหมด" : `${pct(f.n, FUNNEL[i - 1].n)} ผ่านขั้นก่อน`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">Sales นับเฉพาะรายที่ตรวจกับระบบขายแล้วว่าซื้อจริง · Repeat คือลูกค้าเดิมกลับมาซื้อซ้ำ</p>
        </section>

        <section className={cn(glass, "p-4 md:p-5")}>
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">ที่มาของ Lead</h2>
          <table className="w-full text-left text-[12px]">
            <thead className="text-[10.5px] uppercase tracking-wide text-slate-400">
              <tr><th className="pb-1.5 font-semibold">ช่องทาง</th><th className="pb-1.5 font-semibold">Lead</th><th className="pb-1.5 text-right font-semibold">Qualified</th><th className="pb-1.5 text-right font-semibold">ต้นทุน</th><th className="pb-1.5 text-right font-semibold">ต่อ Lead</th></tr>
            </thead>
            <tbody>
              {CHANNEL_STATS.map((c) => (
                <tr key={c.name} className="border-t border-slate-100">
                  <td className="py-2 pr-2"><span className="flex items-center gap-1.5 font-medium text-slate-800"><Icon name={chIcon(c.name)} className="text-slate-400" style={{ fontSize: 15 }} />{c.name}</span></td>
                  <td className="min-w-[130px] py-2 pr-3">
                    <div className="flex items-center gap-2"><span className="w-7 font-semibold text-slate-800">{c.lead}</span><span className="h-1.5 flex-1 rounded-full bg-slate-100"><span className="block h-full rounded-full bg-indigo-400" style={{ width: `${(c.lead / maxLead) * 100}%` }} /></span></div>
                  </td>
                  <td className="py-2 text-right text-slate-600">{c.q} · {pct(c.q, c.lead)}</td>
                  <td className="py-2 text-right text-slate-600">{c.cost ? money(c.cost) : "-"}</td>
                  <td className="py-2 text-right font-semibold text-slate-800">{c.cost ? money(Math.round(c.cost / c.lead)) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className={cn(glass, "p-4 md:p-5")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-slate-900">เปรียบเทียบ Tactic ของแคมเปญ</h2>
          <span className="text-[11px] text-slate-400">Win = ทีมขายปิดการขาย · Sales = ยืนยันกับระบบขายแล้ว</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>{["Campaign", "No. of Lead", "No. of Visit", "No. of Win", "No. of Sales", "Lead → Visit", "Lead → Sales"].map((h, i) => <th key={h} className={cn("px-4 py-2.5 font-semibold", i > 0 && "text-right")}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {CAMP_STATS.map((c) => (
                <tr key={c.name} className="border-t border-slate-100">
                  <td className="px-4 py-3"><CampaignChip name={c.name} /></td>
                  <td className="px-4 py-3 text-right font-semibold">{c.lead}</td>
                  <td className="px-4 py-3 text-right font-semibold">{c.visit}</td>
                  <td className="px-4 py-3 text-right font-semibold">{c.win}</td>
                  <td className="px-4 py-3 text-right font-semibold">{c.sales}</td>
                  <td className={cn("px-4 py-3 text-right font-bold", c.visit / c.lead === bestVisit ? "text-emerald-600" : "text-slate-600")}>{pct(c.visit, c.lead)}{c.visit / c.lead === bestVisit && <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px]">ดีที่สุด</span>}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-600">{pct(c.sales, c.lead)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-bold text-slate-900">
                <td className="px-4 py-3">รวม</td><td className="px-4 py-3 text-right">{tot.lead}</td><td className="px-4 py-3 text-right">{tot.visit}</td><td className="px-4 py-3 text-right">{tot.win}</td><td className="px-4 py-3 text-right">{tot.sales}</td>
                <td className="px-4 py-3 text-right">{pct(tot.visit, tot.lead)}</td><td className="px-4 py-3 text-right">{pct(tot.sales, tot.lead)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800"><Icon name="info" style={{ fontSize: 16 }} />Win 16 ราย แต่ตรงกับระบบขาย 14 ราย อีก 2 รายรอตรวจ (ยังไม่พบยอดขาย) กดดูรายชื่อได้</p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className={cn(glass, "p-4 md:p-5")}>
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">Visit แยกตามสาขา</h2>
          <ul className="space-y-2.5">
            {BRANCH_VISITS.map((b) => (
              <li key={b.name}>
                <div className="flex justify-between text-[12px]"><span className="font-medium text-slate-700">{b.name}</span><span className="font-semibold text-slate-800">{b.n}</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500" style={{ width: `${(b.n / maxVisit) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
        <section className={cn(glass, "p-4 md:p-5")}>
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">เหตุผลที่ Lost</h2>
          <ul className="space-y-2.5">
            {LOST_REASONS.map((b) => (
              <li key={b.name}>
                <div className="flex justify-between text-[12px]"><span className="font-medium text-slate-700">{b.name}</span><span className="font-semibold text-slate-800">{b.n} · {pct(b.n, 27)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-400" style={{ width: `${(b.n / maxLost) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ---------------- 3) ลูกค้าเข้าร้าน ---------------- */
function Chips({ items, on }: { items: string[]; on: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-semibold", on.includes(t) ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600")}>
          {on.includes(t) && <Icon name="check" style={{ fontSize: 14 }} />}{t}
        </span>
      ))}
    </div>
  );
}
function Sec({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <section className={cn(glass, "space-y-3 p-4 md:p-5")}>
      <h3 className="flex items-center gap-2 text-[13.5px] font-bold text-slate-900">
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] text-white">{no}</span>{title}
      </h3>
      {children}
    </section>
  );
}
function Lbl({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className={labelCls}>{label}</span>{children}</label>;
}

function WalkinBody() {
  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500"><Icon name="arrow_back" style={{ fontSize: 16 }} />กลับ</span>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">เพิ่ม Lead</h1>
        <p className="text-[12.5px] text-slate-500">บันทึก Lead จากทุกช่องทางในฟอร์มเดียว ถ้าลูกค้าอยู่ที่ร้านให้เปิดส่วน Visit ระบบสร้าง Lead และ Visit ให้พร้อมกัน</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Sec no="1" title="ค้นหาลูกค้าจาก SCG Family">
            <div className="flex flex-wrap gap-2">
              <input readOnly defaultValue="062-345-6789" className={cn(inputCls, "min-w-[220px] flex-1")} aria-label="ค้นหาลูกค้า" />
              <span className={btnPrimary}>ค้นหา</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
              <Avatar name="คุณกวี มิ่งขวัญเจริญ" size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-slate-900">คุณกวี มิ่งขวัญเจริญ</div>
                <div className="text-[11.5px] text-slate-500">Fam2026000101 · สมาชิก SCG Family · มีคูปองคงเหลือ 1 ใบ (฿3,000)</div>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">ดึงข้อมูลแล้ว</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Lbl label="ชื่อ-สกุล"><input readOnly defaultValue="คุณกวี มิ่งขวัญเจริญ" className={cn(inputCls, "bg-slate-100 text-slate-600")} /></Lbl>
              <Lbl label="เบอร์ติดต่อ"><input readOnly defaultValue="062-345-6789" className={cn(inputCls, "bg-slate-100 text-slate-600")} /></Lbl>
              <Lbl label="อีเมล"><input readOnly defaultValue="kawee.m@example.com" className={cn(inputCls, "bg-slate-100 text-slate-600")} /></Lbl>
            </div>
          </Sec>

          <Sec no="2" title="ที่มาและการเข้ารับบริการ">
            <div><div className={labelCls}>ที่มา</div><Chips items={CHANNELS.map((c) => c.name)} on={["Walk-in"]} /></div>
            <div><div className={labelCls}>Solution ที่สนใจ</div><Chips items={["Roof Install", "Solar Roof", "Roof Repair", "Ceiling & Insulation", "Home Automation"]} on={["Roof Install"]} /></div>
            <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
              <span className="relative h-6 w-11 shrink-0 rounded-full bg-indigo-600"><span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold text-slate-900">ลูกค้าอยู่ที่ร้านตอนนี้ (บันทึก Visit)</div>
                <div className="text-[11.5px] text-slate-500">เลือก Walk-in แล้วเปิดให้อัตโนมัติ ที่มาอื่นเปิดเองได้ เช่น ลูกค้าจาก Facebook ที่มาร้านวันนี้</div>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-3">
              <div className="text-[12px] font-bold text-slate-700">ข้อมูล Visit</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Lbl label="สาขาที่รับ"><select className={inputCls} defaultValue="หาดใหญ่"><option>หาดใหญ่</option></select></Lbl>
                <Lbl label="วันเวลาที่เข้ามา"><input readOnly defaultValue="24 พ.ย. 2569 10:30" className={cn(inputCls, "bg-slate-100 text-slate-600")} /></Lbl>
              </div>
              <div><div className={labelCls}>กิจกรรมที่ลูกค้าเข้ามาใช้บริการ</div><Chips items={["ปรึกษา", "สอบถามข้อมูลสินค้า", "ออกแบบ", "ถอดแบบประมาณการ"]} on={["ปรึกษา", "สอบถามข้อมูลสินค้า", "ถอดแบบประมาณการ"]} /></div>
            </div>
          </Sec>

          <Sec no="3" title="แคมเปญ / โปรโมชั่นที่สอดคล้อง">
            <div className="grid gap-2.5 md:grid-cols-3">
              {[
                { n: CAMPAIGNS[0], d: "ถอดแบบประมาณการให้ฟรี ใช้ได้ถึง 31 ธ.ค.", ok: "ตรงกับ Roof Install", rec: false },
                { n: CAMPAIGNS[1], d: "ถอดแบบแล้วใช้คูปองส่วนลดกับการสั่งงาน", ok: "ลูกค้ามีคูปอง ฿3,000 ใช้ได้", rec: true },
                { n: CAMPAIGNS[2], d: "รับคะแนน Extra เมื่อสั่งสินค้ากลุ่มหลังคา", ok: "ตรงกับ Roof Install", rec: false },
              ].map((c) => (
                <div key={c.n} className={cn("rounded-2xl border p-3", c.rec ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-bold text-slate-900">{c.n}</span>
                    {c.rec && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">แนะนำ</span>}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{c.d}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Icon name="check_circle" style={{ fontSize: 14 }} />{c.ok}</p>
                </div>
              ))}
            </div>
          </Sec>

          <Sec no="4" title="สถานะและนัดหมาย">
            <div className="grid gap-3 sm:grid-cols-3">
              <Lbl label="สถานะ"><select className={inputCls} defaultValue="contact"><option value="contact">Contact แล้ว</option></select></Lbl>
              <Lbl label="นัดหมายครั้งต่อไป"><input readOnly defaultValue="27 พ.ย. 2569 · 10:00" className={inputCls} /></Lbl>
              <div><div className={labelCls}>ประเภทนัด</div><Chips items={["มาร้าน", "สำรวจหน้างาน"]} on={["สำรวจหน้างาน"]} /></div>
            </div>
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">สถานะเริ่มต้นตามที่มา: Walk-in เริ่มที่ Contact แล้วและไม่นับ SLA ที่มาออนไลน์เริ่มที่ New Lead และนับ SLA </p>
            <label className="flex items-start gap-2 text-[12.5px] text-slate-700"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" />ติดต่อลูกค้าแล้วก่อนคีย์ (ใช้กับที่มาออนไลน์ ให้เริ่มที่ Contact แล้วแทน New Lead)</label>
            <Lbl label="บันทึก"><textarea readOnly rows={3} defaultValue="ลูกค้าสร้างบ้านใหม่ ต้องการโครงทรัสพร้อมมุงกระเบื้อง ส่งแบบแปลนมาให้ถอดแบบประมาณการ ขอนัดสำรวจวันพรุ่งนี้" className={inputCls} /></Lbl>
          </Sec>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-violet-700"><Icon name="auto_awesome" style={{ fontSize: 17 }} />น้องเลขาแนะนำ</div>
            <ul className="space-y-2.5 text-[12px] leading-relaxed text-slate-700">
              <li className="rounded-xl bg-white/80 p-3"><b>พบ Lead เดิมของลูกค้ารายนี้</b><br />L-2611-021 · Website · New Lead เมื่อ 2 วันก่อน<div className="mt-1.5"><span className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white">รวมเป็นรายการเดียว</span></div></li>
              <li className="rounded-xl bg-white/80 p-3"><b>แคมเปญที่เหมาะ:</b> ถอดแบบรับ Coupon ส่วนลด เพราะลูกค้ามีคูปองค้างอยู่</li>
              <li className="rounded-xl bg-white/80 p-3"><b>ตั้งเตือนติดตาม</b> ใบเสนอราคาให้อัตโนมัติ 3 วันหลังส่ง</li>
            </ul>
          </section>
          <section className={cn(glass, "p-4")}>
            <h3 className="mb-1 text-[13px] font-bold text-slate-900">สรุปที่จะบันทึก</h3>
            <KV k="Lead" v="สร้างใหม่ (รวมกับ L-2611-021)" />
            <KV k="ที่มา" v="Walk-in · สาขา หาดใหญ่" />
            <KV k="Visit" v="24 พ.ย. 10:30 · 3 กิจกรรม" />
            <KV k="แคมเปญ" v="ถอดแบบรับ Coupon ส่วนลด" />
            <KV k="สถานะ" v={<StBadge k="contact" />} />
            <KV k="นัดต่อไป" v="27 พ.ย. สำรวจหน้างาน" />
          </section>
          <div className="flex flex-wrap justify-end gap-2">
            <span className={btnGhost}>ยกเลิก</span>
            <span className={btnGhost}>บันทึก Lead</span>
            <span className={btnPrimary}><Icon name="rocket_launch" style={{ fontSize: 18 }} />บันทึกและเปิด Opp</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- 5) กระดาน ---------------- */
type Dot = "g" | "y" | "0";
interface BCard {
  id: string; name: string; place: string; solution: string; channel: string; campaign: string | null;
  sla?: { ok: boolean; text: string }; dots?: Dot[]; visit?: string; note?: string; warn?: string;
  age?: { warn: boolean; text: string }; opp?: { id: string; st: StKey; opened: string };
}
interface BCol { key: string; label: string; sub: string; icon: string; tone: string; count: number; cards: BCard[] }
const DRAG_ID = "L-2611-014";
const BOARD: BCol[] = [
  {
    key: "new", label: "รอติดต่อ", sub: "New Lead", icon: "phone_in_talk", tone: "#f59e0b", count: 41, cards: [
      { id: "L-2611-003", name: "คุณมนัสนันท์ วงศ์ดี", place: "เชียงใหม่", solution: "Roof Repair", channel: "LINE OA", campaign: null, sla: { ok: false, text: "เกิน SLA 23 ชม." } },
      { id: "L-2611-002", name: "คุณธนากร ใจดี", place: "ขอนแก่น", solution: "Roof Install", channel: "Google Search", campaign: null, sla: { ok: false, text: "เกิน SLA 2 ชม." } },
      { id: "L-2611-001", name: "คุณวิภา ศรีสุข", place: "สงขลา", solution: "Roof Install", channel: "Website", campaign: CAMPAIGNS[0], sla: { ok: true, text: "เหลือ 21 ชม." } },
      { id: "L-2611-009", name: "คุณนภา ใจงาม", place: "อุดรธานี", solution: "Roof Install", channel: "Facebook Housing Expert", campaign: CAMPAIGNS[0], sla: { ok: true, text: "เหลือ 22 ชม." } },
    ],
  },
  {
    key: "screen", label: "กำลังสกรีน", sub: "Contact แล้ว · รอตัดสินใจ", icon: "forum", tone: "#0ea5e9", count: 33, cards: [
      { id: "L-2611-010", name: "คุณกิตติ ประเสริฐ", place: "ระยอง", solution: "Solar Roof", channel: "Walk-in", campaign: CAMPAIGNS[1], sla: { ok: true, text: "ทัน SLA · 1 ชม." }, dots: ["g", "0", "0"], visit: "Visit 23 พ.ย." },
      { id: "L-2611-004", name: "คุณปรีชา แก้วใส", place: "นครราชสีมา", solution: "Ceiling & Insulation", channel: "Walk-in", campaign: null, sla: { ok: true, text: "ทัน SLA · 2 ชม." }, dots: ["g", "y", "0"], visit: "Visit 22 พ.ย.", note: "ส่งรูปหน้างานแล้ว รอตอบเรื่องงบ" },
      { id: DRAG_ID, name: "คุณจินตนา สุขเกษม", place: "ระยอง", solution: "Solar Roof", channel: "Google Search", campaign: CAMPAIGNS[0], sla: { ok: true, text: "ทัน SLA · 3 ชม." }, dots: ["y", "y", "0"], warn: "ติดต่อไม่ได้ 2/3 · เหลืออีก 1 ครั้งก่อน Lost" },
    ],
  },
  {
    key: "ready", label: "รอเปิด Opp", sub: "Contact แล้ว · พร้อมเปิด Opp", icon: "rocket_launch", tone: "#8b5cf6", count: 12, cards: [
      { id: "L-2611-012", name: "คุณประสิทธิ์ งามดี", place: "กรุงเทพมหานคร", solution: "Roof Install", channel: "Website", campaign: null, age: { warn: true, text: "รอเปิด Opp มา 4 วัน" } },
      { id: "L-2611-016", name: "คุณอรุณี ทองมา", place: "ภูเก็ต", solution: "Roof Install", channel: "Facebook Housing Expert", campaign: CAMPAIGNS[1], visit: "Visit 22 พ.ย.", age: { warn: false, text: "รอเปิด Opp 1 วัน" } },
      { id: "L-2611-017", name: "คุณวรรณา รักสงบ", place: "สงขลา", solution: "Roof Install", channel: "Walk-in", campaign: CAMPAIGNS[0], visit: "Visit 24 พ.ย.", age: { warn: false, text: "รอเปิด Opp 2 ชม." } },
    ],
  },
  {
    key: "opp", label: "เปิด Opp แล้ว", sub: "7 วันล่าสุด · ต่อที่หน้า Opp", icon: "task_alt", tone: "#10b981", count: 9, cards: [
      { id: "L-2611-018", name: "คุณมานะ ใจกล้า", place: "ชลบุรี", solution: "Roof Install", channel: "Site Visit", campaign: CAMPAIGNS[1], opp: { id: "OP-2611-0123", st: "contact", opened: "เปิด Opp 23 พ.ย." } },
      { id: "L-2611-005", name: "คุณสุดา มีสุข", place: "ภูเก็ต", solution: "Roof Install", channel: "Refer", campaign: CAMPAIGNS[2], opp: { id: "OP-2611-0122", st: "quoted", opened: "เปิด Opp 22 พ.ย." } },
      { id: "L-2611-006", name: "คุณอนันต์ ทองดี", place: "กรุงเทพมหานคร", solution: "Roof Install", channel: "LINE OA", campaign: CAMPAIGNS[0], opp: { id: "OP-2611-0121", st: "nego", opened: "เปิด Opp 21 พ.ย." } },
    ],
  },
];
const DRAG_CARD = BOARD[1].cards.find((c) => c.id === DRAG_ID) ?? BOARD[1].cards[0];

function Dots({ d }: { d: Dot[] }) {
  return (
    <span className="inline-flex items-center gap-1" title="จำนวนครั้งที่ติดต่อ เขียว = ติดต่อได้ เหลือง = ติดต่อไม่ได้">
      {d.map((x, i) => <span key={i} className={cn("h-2.5 w-2.5 rounded-full", x === "g" ? "bg-emerald-500" : x === "y" ? "bg-amber-400" : "border border-slate-300 bg-white")} />)}
    </span>
  );
}

function BCardView({ c, ghost, dim }: { c: BCard; ghost?: boolean; dim?: boolean }) {
  return (
    <article className={cn("rounded-xl border bg-white p-3 shadow-sm transition", ghost ? "border-2 border-dashed border-indigo-300 opacity-50" : "border-slate-100", dim && "opacity-30")}>
      <div className="flex items-center gap-2">
        <Avatar name={c.name} size={26} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-bold text-slate-900">{c.name}</div>
          <div className="truncate text-[10.5px] text-slate-400">{c.id} · {c.place}</div>
        </div>
        {!c.opp && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="call" style={{ fontSize: 15 }} /></span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1"><Icon name={chIcon(c.channel)} className="text-slate-400" style={{ fontSize: 14 }} />{c.channel}</span>
        <span className="text-slate-300">·</span>
        <span>{c.solution}</span>
      </div>
      {c.campaign && <div className="mt-1.5"><CampaignChip name={c.campaign} /></div>}
      {c.note && <p className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-500">{c.note}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
        {c.sla && <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold", c.sla.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}><Icon name={c.sla.ok ? "timer" : "alarm"} style={{ fontSize: 13 }} />{c.sla.text}</span>}
        {c.age && <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold", c.age.warn ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500")}><Icon name="hourglass_top" style={{ fontSize: 13 }} />{c.age.text}</span>}
        {c.opp && <span className="flex flex-wrap items-center gap-1.5"><StBadge k={c.opp.st} /><span className="text-[10.5px] font-semibold text-indigo-600">{c.opp.id}</span></span>}
        {c.dots && <Dots d={c.dots} />}
      </div>
      {c.visit && <div className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700"><Icon name="storefront" style={{ fontSize: 14 }} />{c.visit}</div>}
      {c.opp && <div className="mt-1.5 text-[10.5px] text-slate-400">{c.opp.opened}</div>}
      {c.warn && <p className="mt-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-rose-600"><Icon name="warning" style={{ fontSize: 14 }} />{c.warn}</p>}
    </article>
  );
}

function DragDialog() {
  const checks = [["งบประมาณตรงกับที่รับงาน", true], ["หน้างานอยู่ในพื้นที่บริการ", true], ["ลูกค้าพร้อมให้ทีมเข้าสำรวจ/ออกแบบ", false]] as const;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Icon name="rocket_launch" /></span>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">ย้ายไป &quot;รอเปิด Opp&quot;</h3>
            <p className="text-[12px] text-slate-500">{DRAG_CARD.name} · {DRAG_ID} · ย้ายจาก กำลังสกรีน</p>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 rounded-2xl bg-slate-50 p-3">
          <div className="text-[12px] font-bold text-slate-700">เช็กลิสต์สกรีน</div>
          {checks.map(([t, on]) => (
            <label key={t} className="flex items-center gap-2.5 text-[12.5px] text-slate-700"><input type="checkbox" defaultChecked={on} className="h-4 w-4 accent-indigo-600" />{t}</label>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-amber-700"><Icon name="info" style={{ fontSize: 15 }} />ต้องผ่านครบทั้ง 3 ข้อจึงย้ายได้ ถ้ายังไม่ครบการ์ดจะอยู่ที่เดิม</p>
        <div className="mt-4 flex justify-end gap-2">
          <span className={btnGhost}>ยกเลิก</span>
          <span className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-xl bg-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-400">ยืนยันย้าย</span>
        </div>
      </div>
    </div>
  );
}

function BoardBody({ drag, filter }: { drag?: boolean; filter?: Flt }) {
  /* ตัวกรอง "เกิน SLA": การ์ดที่ไม่เกิน SLA จางลง */
  const dim = (c: BCard) => filter === "sla" && !(c.sla && !c.sla.ok);
  return (
    <div className="space-y-4">
      <PageHead mode="board" />
      <ActionStrip active={filter} />
      <div className={cn(glass, "flex flex-wrap gap-2 p-3 md:p-4")}>
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
          <input readOnly placeholder="ค้นหาชื่อ เบอร์ รหัส หรือจังหวัด" className={cn(inputCls, "pl-9")} />
        </div>
        <select className={cn(inputCls, "w-auto")} defaultValue=""><option value="">ทุกที่มา</option>{CHANNELS.map((c) => <option key={c.name}>{c.name}</option>)}</select>
        <select className={cn(inputCls, "w-auto")} defaultValue=""><option value="">ทุกแคมเปญ</option>{CAMPAIGNS.map((c) => <option key={c}>{c}</option>)}</select>
        <select className={cn(inputCls, "w-auto")} defaultValue=""><option value="">ทุกสาขา</option></select>
        <select className={cn(inputCls, "w-auto")} defaultValue=""><option value="">ผู้ดูแลทุกคน</option></select>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1070px] grid-cols-[repeat(4,minmax(240px,1fr))_56px] gap-3">
          {BOARD.map((col) => {
            const target = drag && col.key === "ready";
            return (
              <div key={col.key} className={cn("rounded-2xl border p-2.5", target ? "border-indigo-400 bg-indigo-50/70" : "border-white/70 bg-white/50")}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white" style={{ background: col.tone }}><Icon name={col.icon} style={{ fontSize: 16 }} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-bold text-slate-800">{col.label}</div>
                    <div className="truncate text-[10.5px] text-slate-400">{col.sub}</div>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-sm">{col.count}</span>
                </div>
                <div className="space-y-2">
                  {target && (
                    <div className="rounded-xl border-2 border-dashed border-indigo-300 bg-white/60 p-2">
                      <div className="rotate-2 shadow-xl"><BCardView c={DRAG_CARD} /></div>
                      <p className="mt-2 text-center text-[11px] font-semibold text-indigo-600">วางที่นี่เพื่อย้ายไป รอเปิด Opp</p>
                    </div>
                  )}
                  {col.cards.map((c) => (drag && c.id === DRAG_ID ? <BCardView key={c.id} c={c} ghost /> : <BCardView key={c.id} c={c} dim={dim(c)} />))}
                </div>
                <div className="mt-2 rounded-lg py-1.5 text-center text-[11px] font-semibold text-indigo-600">ดูทั้งหมด {col.count} รายการ</div>
              </div>
            );
          })}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/70 bg-white/50 py-3">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500 text-white"><Icon name="block" style={{ fontSize: 16 }} /></span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-sm">27</span>
            <span className="text-[12px] font-bold text-slate-500 [writing-mode:vertical-rl]">Lost</span>
            <Icon name="chevron_left" className="text-slate-400" style={{ fontSize: 18 }} />
          </div>
        </div>
      </div>

      <section className={cn(glass, "p-4")}>
        <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-slate-900">ลากการ์ดแล้วเกิดอะไร <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">คำอธิบายในภาพร่าง ไม่แสดงในหน้าจริง</span></h3>
        <ul className="grid gap-2 text-[12px] md:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: "forum", t: "ไป กำลังสกรีน", d: "บันทึกการติดต่อให้อัตโนมัติ" },
            { icon: "fact_check", t: "ไป รอเปิด Opp", d: "ขึ้นเช็กลิสต์สกรีน 3 ข้อ ต้องผ่านครบจึงย้ายได้" },
            { icon: "rocket_launch", t: "ไป เปิด Opp แล้ว", d: "เปิดฟอร์มเปิด Opp หน้าเต็มพร้อมข้อมูลจาก Lead ถ้ายกเลิกการ์ดไม่ย้าย" },
            { icon: "block", t: "ไป Lost", d: "เลือกเหตุผลจากรายการของชีต" },
          ].map((r) => (
            <li key={r.t} className="flex gap-2.5 rounded-xl bg-slate-50 p-3">
              <Icon name={r.icon} className="text-indigo-500" style={{ fontSize: 20 }} />
              <span><b className="text-slate-800">{r.t}</b><span className="block text-slate-500">{r.d}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] text-slate-400">ลากย้อนกลับไม่ได้ ถ้าต้องย้อนให้ทำจากหน้ารายละเอียด · การ์ดในแต่ละคอลัมน์เรียงตามความเร่งด่วนของ SLA ที่เกินมาก่อน</p>
      </section>
      {drag && <DragDialog />}
    </div>
  );
}

/* ---------------- 4) เส้นเวลาของ Lead ---------------- */
const TL = [
  { icon: "campaign", tone: "bg-slate-100 text-slate-500", t: "3 พ.ย. 06:30", title: "Lead เข้ามาทาง Site Visit", sub: "บันทึกโดยสาขา หาดใหญ่ · แคมเปญ ถอดแบบรับ Coupon ส่วนลด" },
  { icon: "call", tone: "bg-sky-100 text-sky-700", t: "3 พ.ย. 08:10", title: "ติดต่อครั้งแรก", sub: "ทัน SLA ใช้เวลา 1 ชม. 40 น. · ผ่านการสกรีน งบ 3–4 แสน" },
  { icon: "storefront", tone: "bg-emerald-100 text-emerald-700", t: "5 พ.ย. 10:00", title: "Visit · เข้ามาที่สาขา หาดใหญ่", sub: "ปรึกษา · สอบถามข้อมูลสินค้า · ถอดแบบประมาณการ" },
  { icon: "rocket_launch", tone: "bg-indigo-100 text-indigo-700", t: "5 พ.ย. 14:30", title: "เปิด Opp OP-2611-0120", sub: "ประมาณการเบื้องต้น ฿355,000" },
  { icon: "request_quote", tone: "bg-violet-100 text-violet-700", t: "7 พ.ย. 09:00", title: "Quoted · ส่งใบเสนอราคา", sub: "฿355,000 · ใช้คูปองส่วนลด ฿10,000" },
  { icon: "forum", tone: "bg-orange-100 text-orange-700", t: "12 พ.ย. 11:00", title: "Negotiation · ลูกค้าขอเวลาพิจารณา", sub: "น้องเลขาตามผลให้ทุก 3 วัน" },
  { icon: "verified", tone: "bg-emerald-500 text-white", t: "21 พ.ย. 16:20", title: "Won · ปิดขาย ฿345,000", sub: "ลูกค้าชำระครบ 100% · ส่งข้อมูลให้ KIM และ SCM แล้ว" },
];
const STEPS = [
  { k: "new", label: "New Lead", d: "3 พ.ย." }, { k: "contact", label: "Contact แล้ว", d: "3 พ.ย." }, { k: "quoted", label: "Quoted", d: "7 พ.ย." }, { k: "nego", label: "Negotiation", d: "12 พ.ย." }, { k: "won", label: "Won", d: "21 พ.ย." },
] as const;

function TimelineBody() {
  return (
    <>
      <ListBody />
      <Drawer open onClose={() => undefined} wide title="คุณพิมพ์ใจ รักไทย" subtitle="L-2611-007 · สงขลา · 082-555-2231" footer={<div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11.5px] text-slate-400">ลูกค้ามาที่ร้านอีกครั้ง บันทึก Visit เพิ่มได้ทุกเมื่อ</span><span className="flex gap-2"><span className={btnGhost}><Icon name="storefront" style={{ fontSize: 18 }} />บันทึก Visit</span><span className={btnGhost}>บันทึกการติดต่อ</span></span></div>}>
        <div className={cn(glass, "p-4")}>
          <div className="flex flex-wrap items-center gap-2">
            <StBadge k="won" />
            <CampaignChip name={CAMPAIGNS[1]} />
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"><Icon name="pin_drop" style={{ fontSize: 13 }} />Site Visit</span>
            <span className="ml-auto text-[18px] font-bold tracking-tight text-indigo-700">฿345,000</span>
          </div>
          <div className="mt-4 flex items-start">
            {STEPS.map((s, i) => (
              <div key={s.k} className="relative flex flex-1 flex-col items-center text-center">
                {i > 0 && <span className="absolute right-1/2 top-3 h-0.5 w-full bg-emerald-400" />}
                <span className="relative z-10 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white"><Icon name="check" style={{ fontSize: 14 }} /></span>
                <span className="mt-1 text-[10.5px] font-semibold text-slate-700">{s.label}</span>
                <span className="text-[10px] text-slate-400">{s.d}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[["Lead → Visit", "2 วัน"], ["เปิด Opp → ปิดขาย", "16 วัน"], ["ติดต่อครั้งแรก", "1 ชม. 40 น."]].map(([k, v]) => (
            <div key={k} className={cn(glass, "p-3")}><div className="text-[18px] font-bold leading-none text-slate-900">{v}</div><div className="mt-1 text-[11px] text-slate-500">{k}</div></div>
          ))}
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-700"><Icon name="fact_check" style={{ fontSize: 17 }} />ตรวจกับระบบขายแล้ว ตรงกัน</div>
          <p className="text-[12px] leading-relaxed text-slate-600">พบยอดขายงานบริการกลุ่ม ROOF SERVICE ฿345,000 ตรงกับ Opp OP-2611-0120 · เปิด Opp 5 พ.ย. ปิดจบการขาย 21 พ.ย.</p>
        </div>

        <div className={cn(glass, "p-4")}>
          <h3 className="mb-3 text-[13px] font-bold text-slate-900">เส้นเวลา</h3>
          <ol>
            {TL.map((e, i) => (
              <li key={e.t + e.title} className="relative flex gap-3 pb-4 last:pb-0">
                {i < TL.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-18px)] w-0.5 bg-slate-200" />}
                <span className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full", e.tone)}><Icon name={e.icon} style={{ fontSize: 18 }} /></span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline gap-2"><span className="text-[13px] font-semibold text-slate-900">{e.title}</span><span className="text-[11px] text-slate-400">{e.t}</span></div>
                  <div className="text-[11.5px] text-slate-500">{e.sub}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Drawer>
    </>
  );
}

export function LeadConceptScreen() {
  const v = useSearchParams().get("v") ?? "board";
  return (
    <Shell>
      {v === "insight" ? <InsightBody /> : v === "walkin" ? <WalkinBody /> : v === "timeline" ? <TimelineBody /> : v === "list" ? <ListBody /> : <BoardBody drag={v === "boarddrag"} filter={v === "boardfilter" ? "sla" : undefined} />}
    </Shell>
  );
}
