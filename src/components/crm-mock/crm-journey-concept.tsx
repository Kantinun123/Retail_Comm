"use client";
/* ภาพร่างแนวคิด "เส้นทางงาน" ตั้งแต่ Lead จนถึงรับประกัน (งานที่เริ่มจาก Lead หรือ Opp อยู่ในกระดานเดียวกัน) ข้อมูลสมมติ
   2 Flow: A = หลังคา/ทั่วไป · B = Smart Solution และ BA (ต่างกันที่ช่วง 3 และ 4)
   เลือกมุมมองด้วย ?v=board | table | strip | account | insight และ ?flow=a|b (เฉพาะ board) */
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { Shell } from "./crm-lead-concept";
import { Avatar, btnGhost, btnPrimary, glass } from "./crm-ui";

/* ---------------- ข้อมูลสมมติ ---------------- */
type Flow = "A" | "B";
interface Ph { k: string; a: string; b: string; icon: string; pa: number; pb: number }
const PHASES: Ph[] = [
  { k: "lead", a: "Lead", b: "Lead", icon: "person_search", pa: 1, pb: 1 },
  { k: "screen", a: "สกรีน", b: "สกรีน", icon: "fact_check", pa: 1, pb: 1 },
  { k: "pre", a: "เสนอราคาก่อนสำรวจ", b: "ปิดสำรวจ", icon: "request_quote", pa: 3, pb: 2 },
  { k: "survey", a: "มัดจำ/สำรวจ", b: "สำรวจ", icon: "pin_drop", pa: 4, pb: 5 },
  { k: "quote2", a: "เสนอราคาหลังสำรวจ", b: "เสนอราคาหลังสำรวจ", icon: "price_check", pa: 3, pb: 3 },
  { k: "close", a: "ปิดขาย", b: "ปิดขาย", icon: "verified", pa: 3, pb: 3 },
  { k: "install", a: "เตรียมของ/ติดตั้ง", b: "เตรียมของ/ติดตั้ง", icon: "construction", pa: 20, pb: 14 },
  { k: "handover", a: "ส่งมอบ", b: "ส่งมอบ", icon: "task_alt", pa: 1, pb: 1 },
  { k: "warranty", a: "รับประกัน", b: "รับประกัน", icon: "verified_user", pa: 0, pb: 0 },
];
const lab = (p: Ph, f: Flow) => (f === "A" ? p.a : p.b);
const planOf = (p: Ph, f: Flow) => (f === "A" ? p.pa : p.pb);
type Ball = "เรา" | "ลูกค้า" | "KIM" | "SCM" | "ห้องแบบ" | "ทีมสำรวจ";
const BALL_CLS: Record<Ball, string> = { เรา: "bg-indigo-100 text-indigo-800", ลูกค้า: "bg-amber-100 text-amber-800", KIM: "bg-cyan-100 text-cyan-800", SCM: "bg-orange-100 text-orange-800", ห้องแบบ: "bg-fuchsia-100 text-fuchsia-800", ทีมสำรวจ: "bg-teal-100 text-teal-800" };
interface J { name: string; id: string; lead?: string; flow: Flow; phase: number; ball: Ball; note: string; value?: number; owner: string; late?: number; fromOpp?: boolean; tag?: string }
const JOBS: J[] = [
  { name: "คุณวิภา ศรีสุข", id: "L-2611-001", flow: "A", phase: 0, ball: "เรา", note: "เหลือ 21 ชม. ติดต่อครั้งแรก", owner: "ฝน", tag: "ติดตั้งหลังคาใหม่ +1" },
  { name: "คุณปิยะ แสงทอง", id: "L-2611-034", flow: "A", phase: 1, ball: "ลูกค้า", note: "รอลูกค้าตอบเรื่องงบ", owner: "นุ้ย", tag: "หลังคา + ทรัส" },
  { name: "คุณสมศักดิ์ ใจเย็น", id: "OP-2611-0113", flow: "A", phase: 2, ball: "ห้องแบบ", note: "รอผลขีดแนวอะเส อีก 1 วัน", value: 486000, owner: "ฝน", fromOpp: true },
  { name: "คุณนิภา ทองดี", id: "L-2611-036", lead: "OP-2611-0130", flow: "B", phase: 2, ball: "ลูกค้า", note: "รอชำระค่าสำรวจ ฿1,500", owner: "แนน", tag: "BA · ติดตั้งแอร์" },
  { name: "คุณชนิดา วงศ์ใหญ่", id: "OP-2611-0103", flow: "A", phase: 3, ball: "KIM", note: "นัดสำรวจ 2 ธ.ค. 10:00", value: 355000, owner: "ฝน" },
  { name: "คุณกิตติ ประเสริฐ", id: "OP-2611-0121", flow: "B", phase: 3, ball: "ทีมสำรวจ", note: "ทีมสำรวจนัด 25 พ.ย. 14:00", owner: "ฝน", tag: "Smart · แอร์ 3 ห้อง" },
  { name: "คุณรัตนา พรหมมา", id: "OP-2611-0102", flow: "A", phase: 3, ball: "ลูกค้า", note: "รอมัดจำ ฿30,000", value: 245000, owner: "บอส", late: 3, fromOpp: true },
  { name: "คุณพิมพ์ใจ รักไทย", id: "L-2611-007", lead: "OP-2611-0122", flow: "A", phase: 4, ball: "ลูกค้า", note: "ส่งใบเสนอราคาหลังสำรวจแล้ว รอตัดสินใจ 3 วัน", value: 345000, owner: "ฝน" },
  { name: "คุณปรีชา แก้วใส", id: "OP-2611-0120", flow: "B", phase: 4, ball: "ลูกค้า", note: "ทีมสำรวจส่งใบเสนอราคากลับมา ทีมขายนำเสนอลูกค้า", value: 86000, owner: "โอ", tag: "Smart · ฝ้า + ฉนวน" },
  { name: "คุณเอกชัย ธรรมดี", id: "OP-2611-0104", flow: "A", phase: 5, ball: "ลูกค้า", note: "รอชำระครบ 100%", value: 186500, owner: "โอ" },
  { name: "คุณอรทัย สมบูรณ์", id: "OP-2611-0118", flow: "A", phase: 6, ball: "SCM", note: "รอสินค้าครบ คาด 28 พ.ย.", value: 640000, owner: "แนน", late: 2 },
  { name: "คุณไพโรจน์ ดวงดี", id: "OP-2611-0110", flow: "A", phase: 7, ball: "KIM", note: "นัดส่งมอบ 26 พ.ย.", value: 175000, owner: "โอ" },
  { name: "คุณศิริพร จันทร์เพ็ญ", id: "OP-2611-0111", flow: "A", phase: 8, ball: "เรา", note: "ประกันเหลือ 4 ปี 11 เดือน", value: 129000, owner: "ฝน" },
];
const PRODUCT_LANE = [["คุณมาลี สุขใจ", "L-2611-016", "ส่งให้ ร้านภูเก็ตวัสดุ · รอร้านรับ", 0], ["คุณมานะ พงษ์ไทย", "L-2611-012", "ร้านชลบุรีโฮม เสนอราคา ฿48,200", 1], ["คุณวิไล รักดี", "L-2611-011", "ร้านเชียงใหม่ซีเมนต์ ปิดขาย ฿36,500", 2]] as const;
const LOST = [["คุณวีระ สุขสบาย", "L-2611-008", "งบประมาณไม่ถึง"], ["คุณทวีศักดิ์ ศรีสวัสดิ์", "OP-2611-0112", "ลูกค้าเลื่อนโครงการไปปีหน้า"]];
const money = (n: number) => `฿${n.toLocaleString("en-US")}`;
const open = JOBS.filter((j) => j.phase < 8);

/* ---------------- ส่วนประกอบ ---------------- */
function Head({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[22px] font-bold tracking-tight text-slate-900">{title}</h1><p className="text-[12.5px] text-slate-500">{sub}</p></div>
      {right}
    </div>
  );
}
function BallChip({ b }: { b: Ball }) { return <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", BALL_CLS[b])}>รอ{b}</span>; }
function FlowChip({ f }: { f: Flow }) {
  return f === "B" ? <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[9.5px] font-bold text-teal-700">Smart/BA</span> : null;
}
function Toggle({ on }: { on: "board" | "table" }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-[12px] font-semibold">
      <span className={cn("inline-flex items-center gap-1 rounded-lg px-3 py-1.5", on === "board" ? "bg-indigo-600 text-white" : "text-slate-600")}><Icon name="view_kanban" style={{ fontSize: 16 }} />กระดาน</span>
      <span className={cn("inline-flex items-center gap-1 rounded-lg px-3 py-1.5", on === "table" ? "bg-indigo-600 text-white" : "text-slate-600")}><Icon name="list" style={{ fontSize: 16 }} />ตาราง</span>
    </div>
  );
}
function Strip({ flow }: { flow: "all" | "a" | "b" }) {
  const n = (f: (j: J) => boolean) => open.filter(f).length;
  const cs: [string, number, string][] = [["งานที่เปิดอยู่", open.length, "text-slate-900"], ["รอลูกค้า", n((j) => j.ball === "ลูกค้า"), "text-amber-700"], ["รอเรา", n((j) => j.ball === "เรา"), "text-indigo-700"], ["รอหน่วยงานอื่น", n((j) => j.ball !== "เรา" && j.ball !== "ลูกค้า"), "text-cyan-700"], ["เลยแผน", n((j) => !!j.late), "text-rose-600"]];
  const flows: [string, string][] = [["all", "ทุกชนิดงาน"], ["a", "หลังคา/ทั่วไป"], ["b", "Smart Solution & BA"], ["p", "สายสินค้า (ส่งร้าน)"]];
  return (
    <div className={cn(glass, "mb-4 space-y-2 p-3")}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {cs.map(([l, c, k]) => <span key={l} className="text-[12px] text-slate-500"><b className={cn("mr-1 text-[18px]", k)}>{c}</b>{l}</span>)}
        <div className="ml-auto flex flex-wrap gap-1.5">{["ทั้งหมด", "ของฉัน", "รอลูกค้า", "เลยแผน"].map((c, i) => <span key={c} className={cn("rounded-full border px-3 py-1 text-[11.5px] font-semibold", i === 0 ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600")}>{c}</span>)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
        <span className="text-[11px] text-slate-400">ชนิดงาน</span>
        {flows.map(([k, l]) => <span key={k} className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold", k === flow ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600")}>{l}</span>)}
      </div>
    </div>
  );
}

/* ---------------- 1) กระดานภาพรวมงาน (9 ช่วง) ---------------- */
function JobCard({ j }: { j: J }) {
  return (
    <div className={cn(glass, "p-3", j.late && "ring-2 ring-amber-300")}>
      <div className="flex flex-wrap items-center gap-1">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", j.id.startsWith("L-") ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700")}>{j.id}</span>
        {j.lead && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">→ {j.lead}</span>}
        {j.fromOpp && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-500">เริ่มจาก Opp</span>}
        <FlowChip f={j.flow} />
      </div>
      <div className="mt-1 text-[12.5px] font-bold text-slate-900">{j.name}</div>
      <div className="text-[11px] leading-snug text-slate-500">{j.note}</div>
      {j.tag && <div className="mt-1 text-[10.5px] text-indigo-600">{j.tag}</div>}
      <div className="mt-2 flex items-center gap-1.5">
        <BallChip b={j.ball} />
        {j.late && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">เลยแผน {j.late} วัน</span>}
        <span className="ml-auto flex items-center gap-1 text-[10.5px] text-slate-400"><Avatar name={j.owner} size={18} />{j.value ? money(j.value) : ""}</span>
      </div>
    </div>
  );
}
function BoardBody({ flow }: { flow: "all" | "a" | "b" }) {
  const f: Flow | null = flow === "a" ? "A" : flow === "b" ? "B" : null;
  const list = JOBS.filter((j) => !f || j.flow === f);
  return (
    <>
      <Head title="ภาพรวมงาน" sub="ทุกงานของลูกค้าเรียงตามช่วง 9 ช่วง ตั้งแต่ Lead จนถึงรับประกัน (เริ่มจาก Lead หรือ Opp ก็อยู่กระดานเดียวกัน)" right={<Toggle on="board" />} />
      <Strip flow={flow} />
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-2.5 text-[12px] text-teal-900"><Icon name="alt_route" style={{ fontSize: 18 }} />ช่วงที่ 3 และ 4 ต่างกันตามชนิดงาน: <b>หลังคา/ทั่วไป</b> = เสนอราคาก่อนสำรวจ → มัดจำ/สำรวจ · <b>Smart Solution และ BA</b> = ปิดสำรวจ → สำรวจ ช่วงอื่นเหมือนกัน</div>
      <div className="grid auto-cols-[205px] grid-flow-col gap-3 overflow-x-auto pb-3">
        {PHASES.map((p, i) => {
          const js = list.filter((j) => j.phase === i);
          const sum = js.reduce((a, j) => a + (j.value ?? 0), 0);
          const diff = p.a !== p.b;
          return (
            <div key={p.k} className="rounded-2xl bg-white/50 p-2">
              <div className="mb-2 px-1">
                <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-900"><Icon name={p.icon} style={{ fontSize: 17 }} />{f ? lab(p, f) : p.a}<span className="text-slate-400">{js.length}</span></div>
                {diff && !f && <div className="text-[10.5px] font-semibold text-teal-700">Smart/BA: {p.b}</div>}
                <div className="text-[10.5px] text-slate-400">{sum ? money(sum) : "แผน " + (planOf(p, f ?? "A") ? planOf(p, f ?? "A") + " วัน" : "ตลอดอายุประกัน")}</div>
              </div>
              <div className="space-y-2">{js.map((j) => <JobCard key={j.id} j={j} />)}{js.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11px] text-slate-400">ไม่มีงาน</div>}</div>
            </div>
          );
        })}
      </div>
      {!f && (
        <div className={cn(glass, "mt-2 p-3")}>
          <div className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-slate-800"><Icon name="storefront" style={{ fontSize: 18 }} />สายสินค้า (ขายสินค้าอย่างเดียว ส่งให้ร้านทำใบเสนอราคา) <span className="text-slate-400">{PRODUCT_LANE.length}</span></div>
          <div className="grid gap-2 md:grid-cols-3">
            {PRODUCT_LANE.map(([n, id, note, s]) => (
              <div key={id} className="rounded-xl bg-white/80 p-2.5 ring-1 ring-slate-200">
                <div className="flex items-center gap-1.5"><span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{id}</span><span className="text-[12px] font-bold text-slate-900">{n}</span></div>
                <div className="mt-0.5 text-[11px] text-slate-500">{note}</div>
                <div className="mt-1.5 flex gap-0.5">{["Lead", "สกรีน", "ส่งร้าน", "ร้านเสนอราคา", "Win/Loss"].map((x, k) => <span key={x} title={x} className={cn("h-1.5 flex-1 rounded-full", k < 2 + s ? "bg-emerald-500" : k === 2 + s ? "bg-indigo-500" : "bg-slate-200")} />)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className={cn(glass, "mt-3 p-3")}>
        <div className="flex items-center gap-2 text-[12.5px] font-bold text-slate-700"><Icon name="chevron_right" style={{ fontSize: 18 }} />Lost / ยกเลิก <span className="text-slate-400">{LOST.length}</span><span className="ml-auto text-[11px] font-normal text-slate-400">พับเก็บไว้ กดเพื่อดูและเปิดงานใหม่</span></div>
      </div>
    </>
  );
}

/* ---------------- 2) ตาราง ---------------- */
function TableBody() {
  return (
    <>
      <Head title="ภาพรวมงาน" sub="มุมมองตาราง แถบความคืบหน้า 9 ช่วงต่อ 1 งาน" right={<Toggle on="table" />} />
      <Strip flow="all" />
      <div className={cn(glass, "overflow-x-auto")}>
        <table className="w-full min-w-[920px] text-left text-[12px]">
          <thead className="bg-slate-50/80 text-[11px] text-slate-500"><tr>{["ลูกค้า", "งาน", "ความคืบหน้า", "ตอนนี้", "รอใคร", "มูลค่า", "เจ้าของ"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {JOBS.map((j) => (
              <tr key={j.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-semibold text-slate-900">{j.name} <FlowChip f={j.flow} /></td>
                <td className="px-4 py-2.5 text-slate-500">{j.id}{j.fromOpp && <span className="ml-1 text-[10px] text-slate-400">(เริ่มจาก Opp)</span>}</td>
                <td className="px-4 py-2.5"><div className="flex gap-0.5">{PHASES.map((p, i) => <span key={p.k} title={lab(p, j.flow)} className={cn("h-2 w-4 rounded-full", i < j.phase ? "bg-emerald-500" : i === j.phase ? "bg-indigo-500" : "bg-slate-200")} />)}</div></td>
                <td className="px-4 py-2.5 text-slate-700">{lab(PHASES[j.phase], j.flow)}<div className="text-[10.5px] text-slate-400">{j.note}</div></td>
                <td className="px-4 py-2.5"><BallChip b={j.ball} />{j.late && <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">เลย {j.late} วัน</span>}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-800">{j.value ? money(j.value) : "-"}</td>
                <td className="px-4 py-2.5 text-slate-500">{j.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- 3) เส้นทางของงานเดียว ---------------- */
type St = "done" | "current" | "todo" | "skip";
interface PC { st: St; date: string; line: string; who?: string }
function PhaseCard({ p, c, f }: { p: Ph; c: PC; f: Flow }) {
  const st = c.st;
  return (
    <div className={cn("relative w-[160px] shrink-0 rounded-2xl border p-3", st === "done" && "border-emerald-200 bg-emerald-50/70", st === "current" && "border-indigo-400 bg-white shadow-[0_0_0_4px_rgba(99,102,241,.18)]", st === "todo" && "border-slate-200 bg-white/60", st === "skip" && "border-dashed border-slate-300 bg-slate-50/60")}>
      <div className="flex items-center gap-1.5">
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", st === "done" ? "bg-emerald-500 text-white" : st === "current" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500")}><Icon name={st === "done" ? "check" : p.icon} style={{ fontSize: 16 }} /></span>
        <span className={cn("text-[11.5px] font-bold leading-tight", st === "todo" || st === "skip" ? "text-slate-500" : "text-slate-900")}>{lab(p, f)}</span>
      </div>
      <div className={cn("mt-1.5 text-[10.5px] font-semibold", st === "done" ? "text-emerald-700" : st === "current" ? "text-indigo-700" : "text-slate-400")}>{st === "todo" && !c.date.startsWith("แผน") ? "แผน " : ""}{c.date}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-slate-600">{c.line}</div>
      {c.who && <div className="mt-1.5"><span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">{c.who}</span></div>}
    </div>
  );
}
function Journey({ title, sub, cards, f }: { title: string; sub: React.ReactNode; cards: PC[]; f: Flow }) {
  return (
    <div className={cn(glass, "p-4")}>
      <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="text-[14px] font-bold text-slate-900">{title}</h3>{sub}</div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
        {PHASES.map((p, i) => (
          <div key={p.k} className="flex items-center gap-1"><PhaseCard p={p} c={cards[i]} f={f} />{i < PHASES.length - 1 && <Icon name="chevron_right" style={{ fontSize: 18 }} className="shrink-0 text-slate-300" />}</div>
        ))}
      </div>
    </div>
  );
}
const Tag = ({ cls, children }: { cls: string; children: React.ReactNode }) => <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", cls)}>{children}</span>;
function Branches() {
  const b: [string, string, string, string][] = [
    ["storefront", "ขายสินค้าอย่างเดียว", "ส่งให้ร้านทำใบเสนอราคา แล้วร้านแจ้ง Win/Loss กลับ (สายสินค้า)", "border-fuchsia-300 bg-fuchsia-50/70"],
    ["architecture", "ออกแบบพร้อมขาย Solution (หลังคา/ทั่วไป)", "Flow A: เสนอราคาก่อนสำรวจ → มัดจำ/สำรวจ → เสนอราคาหลังสำรวจ", "border-indigo-300 bg-indigo-50/70"],
    ["pin_drop", "Smart Solution และ BA", "Flow B: ปิดสำรวจ (เก็บค่าสำรวจ) → สำรวจ → เสนอราคาหลังสำรวจ", "border-teal-300 bg-teal-50/70"],
  ];
  return (
    <div className={cn(glass, "p-4")}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="alt_route" style={{ fontSize: 18 }} />ทางแยกที่ขั้น &ldquo;สกรีน&rdquo; ตัดสินว่างานไปทางไหน</h3>
      <div className="grid gap-2 md:grid-cols-3">{b.map(([ic, t, d, c]) => <div key={t} className={cn("rounded-xl border p-3", c)}><div className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-900"><Icon name={ic} style={{ fontSize: 17 }} />{t}</div><div className="mt-1 text-[11.5px] text-slate-600">{d}</div></div>)}</div>
    </div>
  );
}
function StripBody() {
  const A: PC[] = [
    { st: "done", date: "18 พ.ย.", line: "เข้ามาทาง LINE OA สนใจเปลี่ยนหลังคา", who: "ฝน" },
    { st: "done", date: "18 พ.ย.", line: "สกรีนผ่าน → ออกแบบพร้อมขาย Solution", who: "ฝน" },
    { st: "done", date: "19 พ.ย.", line: "ส่งใบเสนอราคาก่อนสำรวจ ฿355,000", who: "ฝน" },
    { st: "current", date: "รับมัดจำ 22 พ.ย.", line: "รอสำรวจหน้างาน 2 ธ.ค. 10:00", who: "รอ KIM" },
    { st: "todo", date: "4 ธ.ค.", line: "ปรับใบเสนอราคาตามรายงานสำรวจ", who: "ทีมขาย" },
    { st: "todo", date: "12 ธ.ค.", line: "เก็บเงินครบ 100%", who: "ทีมขาย" },
    { st: "todo", date: "15 ธ.ค. ถึง 8 ม.ค.", line: "สั่งโรงงาน ส่งของ ติดตั้ง", who: "SCM / KIM" },
    { st: "todo", date: "9 ม.ค.", line: "ตรวจรับงาน", who: "KIM" },
    { st: "todo", date: "5 ปี", line: "ประกัน Complete Roof" },
  ];
  const B: PC[] = [
    { st: "done", date: "20 พ.ย.", line: "ลูกค้าเข้าร้าน (Walk-in) สนใจติดตั้งแอร์", who: "ฝน" },
    { st: "done", date: "20 พ.ย.", line: "สกรีนผ่าน → Smart Solution", who: "ฝน" },
    { st: "done", date: "21 พ.ย.", line: "เก็บค่าสำรวจ ฿1,500 แล้ว ส่งงานให้ทีมสำรวจ", who: "ฝน" },
    { st: "current", date: "นัด 25 พ.ย. 14:00", line: "ทีมสำรวจเข้าหน้างาน", who: "รอทีมสำรวจ" },
    { st: "todo", date: "27 พ.ย.", line: "ทีมสำรวจส่งรายงานและใบเสนอราคา ทีมขายนำเสนอ", who: "ทีมสำรวจ / ฝน" },
    { st: "todo", date: "30 พ.ย.", line: "เก็บค่าติดตั้ง (หักค่าสำรวจ)", who: "ทีมขาย" },
    { st: "todo", date: "แผน 4 ถึง 18 ธ.ค.", line: "เตรียมอุปกรณ์ ติดตั้ง", who: "SCM / KIM" },
    { st: "todo", date: "19 ธ.ค.", line: "ส่งมอบ", who: "KIM" },
    { st: "todo", date: "1 ปี", line: "ประกันงานติดตั้ง" },
  ];
  const C: PC[] = [
    { st: "skip", date: "ข้าม", line: "เริ่มจาก Opp (ระบบสร้าง Lead L-2611-040 ให้อัตโนมัติ)" },
    { st: "skip", date: "ข้าม", line: "ไม่ผ่านขั้นสกรีน" },
    { st: "current", date: "เริ่ม 20 พ.ย.", line: "รอห้องแบบขีดแนวอะเส อีก 1 วัน", who: "รอห้องแบบ" },
    ...PHASES.slice(3).map((_, i): PC => ({ st: "todo", date: ["แผน 27 พ.ย.", "แผน 4 ธ.ค.", "แผน 8 ธ.ค.", "แผน 29 ธ.ค.", "แผน 9 ม.ค.", "แผน 10 ม.ค."][i] ?? "5 ปี", line: ["มัดจำ 30% ล็อกคิวสำรวจ", "ปรับใบเสนอราคาตามผลสำรวจ", "เก็บเงินครบ 100%", "ติดตั้งทรัสและกระเบื้อง", "ตรวจรับงาน", "ประกัน Complete Roof"][i] })),
  ];
  return (
    <>
      <Head title="เส้นทางของงาน" sub="เปิดจากการ์ดงานหรือหน้า Account แสดงทุกช่วงเรียงต่อกัน ชื่อช่วงที่ 3 และ 4 เปลี่ยนตามชนิดงาน" />
      <div className="space-y-4">
        <Branches />
        <Journey f="A" title="คุณชนิดา วงศ์ใหญ่ · OP-2611-0103" sub={<><Tag cls="bg-sky-50 text-sky-700">เริ่มจาก Lead</Tag><Tag cls="bg-indigo-50 text-indigo-700">Flow หลังคา/ทั่วไป</Tag></>} cards={A} />
        <Journey f="B" title="คุณกิตติ ประเสริฐ · OP-2611-0121" sub={<><Tag cls="bg-sky-50 text-sky-700">เริ่มจาก Lead</Tag><Tag cls="bg-teal-50 text-teal-700">Flow Smart Solution / BA</Tag></>} cards={B} />
        <div className={cn(glass, "p-4")}>
          <div className="mb-2 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-white"><Icon name="payments" style={{ fontSize: 18 }} /></span><h3 className="text-[13.5px] font-bold text-slate-900">ช่วงที่เลือก (ตัวอย่างคุณชนิดา): มัดจำ/สำรวจ</h3><BallChip b="KIM" /><span className={cn(btnGhost, "ml-auto !py-1.5 !text-[12px]")}><Icon name="chat" style={{ fontSize: 17 }} />เปิดแชท</span></div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 text-[12px]"><div className="mb-1 font-bold text-slate-800">เช็คลิสต์ของช่วงนี้</div>{[["รับมัดจำ ฿106,500", true], ["ล็อกคิวสำรวจ 2 ธ.ค.", true], ["ส่งข้อมูลให้ KIM และ SCM", true], ["ลูกค้าเตรียมหน้างานตามที่แจ้ง", false]].map(([t, d]) => <div key={t as string} className="flex items-center gap-2 py-0.5"><span className={cn("grid h-4 w-4 place-items-center rounded border", d ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white")}>{d && <Icon name="check" style={{ fontSize: 12 }} />}</span>{t}</div>)}</div>
            <div className="rounded-xl bg-slate-50 p-3 text-[12px]"><div className="mb-1 font-bold text-slate-800">ข้อความล่าสุดในช่วงนี้</div><div className="rounded-lg bg-white p-2 text-slate-600">ช่วยเพิ่มโรงจอดรถด้วยนะคะ บ่ายวันที่ 2 ธ.ค. ว่างค่ะ</div><div className="mt-1 text-[10.5px] text-slate-400">ลูกค้า · 08:06</div></div>
            <div className="rounded-xl bg-slate-50 p-3 text-[12px]"><div className="mb-1 font-bold text-slate-800">ขั้นต่อไป</div><div className="text-slate-600">ทีมสำรวจเข้าหน้างาน แล้วส่งรายงานสำรวจกลับมา กำหนด 4 ธ.ค.</div><span className={cn(btnPrimary, "mt-2 !py-1.5 !text-[12px]")}>เปิดหน้า Opp</span></div>
          </div>
        </div>
        <Journey f="A" title="คุณสมศักดิ์ ใจเย็น · OP-2611-0113" sub={<><Tag cls="bg-violet-50 text-violet-700">เริ่มจาก Opp</Tag><Tag cls="bg-indigo-50 text-indigo-700">Flow หลังคา/ทั่วไป</Tag></>} cards={C} />
      </div>
    </>
  );
}

/* ---------------- 4) Account หลายงาน ---------------- */
function AccountBody() {
  const done: PC[] = PHASES.map((_, i) => ({ st: "done", date: ["3 พ.ย.", "3 พ.ย.", "7 พ.ย.", "9 พ.ย.", "13 พ.ย.", "21 พ.ย.", "29 พ.ย. ถึง 9 ธ.ค.", "10 ธ.ค.", "ถึง 10 ธ.ค. 74"][i], line: ["Site Visit สาขาหาดใหญ่", "ผ่านสกรีน → Solution", "ใบเสนอราคา ฿355,000", "มัดจำ ฿106,500 สำรวจแล้ว", "ปรับเป็น ฿345,000", "ชำระครบ", "ติดตั้งเรียบร้อย", "ส่งมอบ CSAT 4.9", "เหลือ 4 ปี 11 เดือน"][i] }));
  const next: PC[] = [
    { st: "skip", date: "ข้าม", line: "ใช้สิทธิ์จากงานเดิม OP-2611-0111" }, { st: "skip", date: "ข้าม", line: "ลูกค้าเดิม ไม่ต้องสกรีน" },
    { st: "current", date: "เก็บค่าสำรวจ ฿500", line: "ปิดสำรวจ: รอลูกค้าชำระ (ราคาพิเศษจากสิทธิ์)", who: "รอลูกค้า" },
    ...PHASES.slice(3).map((): PC => ({ st: "todo", date: "แผน", line: "ตามแผนงานสำรวจ" })),
  ];
  return (
    <>
      <Head title="Account · คุณศิริพร จันทร์เพ็ญ" sub="SF-5550111 · ระยอง · เชื่อม LINE OA แล้ว · ซื้อแล้ว 1 ครั้ง กำลังใช้สิทธิ์ต่อยอด 1 งาน" />
      <div className="space-y-4">
        <Journey f="A" title="งานที่ 1 · OP-2611-0111 มุงหลังคา ฿129,000" sub={<><Tag cls="bg-emerald-50 text-emerald-700">จบแล้ว อยู่ในประกัน</Tag><Tag cls="bg-indigo-50 text-indigo-700">Flow หลังคา/ทั่วไป</Tag></>} cards={done} />
        <div className="flex items-center gap-2 pl-6 text-[12px] font-semibold text-fuchsia-700"><Icon name="subdirectory_arrow_right" style={{ fontSize: 22 }} /><Icon name="redeem" style={{ fontSize: 18 }} />ลูกค้าใช้สิทธิพิเศษ &ldquo;สำรวจต่อเติมโรงจอดรถ&rdquo; จากงานที่ 1 เปิดงานใหม่ต่อเนื่อง</div>
        <Journey f="B" title="งานที่ 2 · OP-2612-0003 สำรวจต่อเติมโรงจอดรถ" sub={<><Tag cls="bg-fuchsia-50 text-fuchsia-700">ต่อยอดจากงานที่ 1 · เริ่มจาก Opp</Tag><Tag cls="bg-teal-50 text-teal-700">Flow สำรวจก่อน</Tag></>} cards={next} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className={cn(glass, "p-4")}><h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="verified_user" style={{ fontSize: 18 }} />รับประกัน</h3><div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-[12px] text-slate-700">Complete Roof 5 ปี · ส่งมอบ 10 ธ.ค. 2569 · หมดอายุ 10 ธ.ค. 2574 <span className="ml-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10.5px] font-bold text-white">เหลือ 4 ปี 11 เดือน</span></div></div>
          <div className={cn(glass, "p-4")}><h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="redeem" style={{ fontSize: 18 }} />สิทธิพิเศษ</h3>{[["ล้างแอร์ 15%", "ใช้แล้ว", "bg-sky-50 text-sky-700"], ["สำรวจโรงจอดรถ", "ใช้ใน OP-2612-0003", "bg-fuchsia-50 text-fuchsia-700"], ["สำรวจรางน้ำฝน", "ใช้ได้ 46 วัน", "bg-emerald-50 text-emerald-700"]].map(([n, s, c]) => <div key={n} className="mb-1 flex items-center gap-2 text-[12px] text-slate-700"><span className="flex-1">{n}</span><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", c)}>{s}</span></div>)}</div>
        </div>
      </div>
    </>
  );
}

/* ---------------- 5) คอขวด ---------------- */
const AVG_A = [0.6, 0.9, 3.4, 6.2, 2.8, 3.1, 22, 1.2];
const AVG_B = [0.5, 0.8, 1.4, 5.8, 3.9, 2.6, 13, 1.0];
function Bars({ title, f, avg, note }: { title: string; f: Flow; avg: number[]; note: string }) {
  const maxv = 24;
  return (
    <div className={cn(glass, "p-4")}>
      <h3 className="mb-3 text-[13px] font-bold text-slate-900">{title}</h3>
      <div className="space-y-2">
        {PHASES.slice(0, 8).map((p, i) => {
          const plan = planOf(p, f);
          const over = avg[i] > plan * 1.2;
          return (
            <div key={p.k} className="flex items-center gap-3 text-[12px]">
              <span className="w-36 shrink-0 font-semibold text-slate-700">{lab(p, f)}</span>
              <div className="relative h-4 flex-1 rounded-full bg-slate-100">
                <span className={cn("absolute left-0 top-0 h-4 rounded-full", over ? "bg-rose-400" : "bg-emerald-400")} style={{ width: `${(avg[i] / maxv) * 100}%` }} />
                <span className="absolute top-[-3px] h-5 w-0.5 bg-slate-700" style={{ left: `${(plan / maxv) * 100}%` }} title="แผน" />
              </div>
              <span className={cn("w-28 shrink-0 text-right", over ? "font-bold text-rose-600" : "text-slate-500")}>{avg[i]} วัน <span className="text-slate-400">/ แผน {plan}</span></span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-800"><Icon name="warning" style={{ fontSize: 17 }} />{note}</p>
    </div>
  );
}
function InsightBody() {
  return (
    <>
      <Head title="คอขวดของงาน" sub="เทียบวันที่ใช้จริงเฉลี่ยกับแผนใน Project Timeline แยกตามชนิดงาน (ข้อมูลสมมติ พ.ย. 2569)" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Bars f="A" title="หลังคา/ทั่วไป" avg={AVG_A} note="ช่วง มัดจำ/สำรวจ ช้ากว่าแผนมากที่สุด (6.2 วัน จากแผน 4) ส่วนใหญ่รอลูกค้าโอนมัดจำและนัดวันสำรวจ" />
          <Bars f="B" title="Smart Solution และ BA" avg={AVG_B} note="ช่วง สำรวจ (5.8 จากแผน 5) และ เสนอราคาหลังสำรวจ (3.9 จากแผน 3) เริ่มช้า รอทีมสำรวจส่งรายงานและใบเสนอราคากลับมา" />
        </div>
        <div className="space-y-4">
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 text-[13px] font-bold text-slate-900">รออยู่กับใคร (งานที่เปิด)</h3>
            {(["ลูกค้า", "เรา", "KIM", "SCM", "ห้องแบบ", "ทีมสำรวจ"] as Ball[]).map((b) => { const c = open.filter((j) => j.ball === b).length; return <div key={b} className="mb-1.5 flex items-center gap-2"><BallChip b={b} /><div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-400" style={{ width: `${c * 20}%` }} /></div><span className="w-4 text-right text-[12px] font-bold text-slate-700">{c}</span></div>; })}
          </div>
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 text-[13px] font-bold text-slate-900">งานที่เลยแผน</h3>
            {JOBS.filter((j) => j.late).map((j) => <div key={j.id} className="mb-1.5 flex items-center gap-2 rounded-xl bg-rose-50/70 px-3 py-2 text-[12px]"><div className="min-w-0 flex-1"><div className="font-semibold text-slate-800">{j.name}</div><div className="text-[10.5px] text-slate-500">{lab(PHASES[j.phase], j.flow)} · {j.owner}</div></div><BallChip b={j.ball} /><span className="font-bold text-rose-600">+{j.late} วัน</span></div>)}
          </div>
        </div>
      </div>
    </>
  );
}

export function JourneyConceptScreen() {
  const q = useSearchParams();
  const v = q.get("v") ?? "board";
  const fl = q.get("flow");
  const flow = fl === "a" || fl === "b" ? fl : "all";
  return (
    <Shell>
      {v === "table" ? <TableBody /> : v === "strip" ? <StripBody /> : v === "account" ? <AccountBody /> : v === "insight" ? <InsightBody /> : <BoardBody flow={flow} />}
    </Shell>
  );
}
