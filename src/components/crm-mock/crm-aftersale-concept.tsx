"use client";
/* ภาพร่างแนวคิด: Opp จบที่ "ปิดขาย" แล้วส่งต่อไปหน้า "งานหลังขาย" (เตรียมของ/ติดตั้ง → ส่งมอบ → รับประกัน) ข้อมูลสมมติ
   เลือกมุมมองด้วย ?v=opp | handoff | board | detail | warranty | menu */
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { Shell } from "./crm-lead-concept";
import { Avatar, btnGhost, btnPrimary, glass } from "./crm-ui";

const money = (n: number) => `฿${n.toLocaleString("en-US")}`;
type Ball = "เรา" | "ลูกค้า" | "KIM" | "SCM";
const BALL: Record<Ball, string> = { เรา: "bg-indigo-100 text-indigo-800", ลูกค้า: "bg-amber-100 text-amber-800", KIM: "bg-cyan-100 text-cyan-800", SCM: "bg-orange-100 text-orange-800" };
const Ball = ({ b }: { b: Ball }) => <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", BALL[b])}>รอ{b}</span>;
const Tag = ({ cls, children }: { cls: string; children: React.ReactNode }) => <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", cls)}>{children}</span>;

function Head({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[22px] font-bold tracking-tight text-slate-900">{title}</h1><p className="text-[12.5px] text-slate-500">{sub}</p></div>
      {right}
    </div>
  );
}
function RoleBanner() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-2.5 text-[12px] text-sky-900">
      <Icon name="visibility" style={{ fontSize: 18 }} />มุมมองทีมขาย: <b>ดูอย่างเดียว</b> และคุยกับลูกค้าได้ · KIM และ SCM เป็นผู้อัปเดตสถานะในหน้านี้
      <span className="ml-auto flex gap-1">{["ทีมขาย", "KIM", "SCM", "โค้ช/Area"].map((r, i) => <span key={r} className={cn("rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold", i === 0 ? "bg-sky-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200")}>{r}</span>)}</span>
    </div>
  );
}

/* ---------------- 1) หน้า Opp จบที่ปิดขาย ---------------- */
interface OC { id: string; name: string; note: string; v?: number; ball: Ball; late?: boolean; b?: boolean }
const OPP_COLS: { t: string; sub: string; icon: string; cards: OC[]; last?: boolean }[] = [
  { t: "ก่อนสำรวจ", sub: "รับแบบ · เสนอราคาก่อนสำรวจ / ปิดสำรวจ (Smart/BA)", icon: "request_quote", cards: [
    { id: "OP-2611-0113", name: "คุณสมศักดิ์ ใจเย็น", note: "รอห้องแบบขีดแนวอะเส", v: 486000, ball: "KIM" },
    { id: "OP-2611-0130", name: "คุณนิภา ทองดี", note: "ปิดสำรวจ: รอชำระค่าสำรวจ ฿1,500", ball: "ลูกค้า", b: true } ] },
  { t: "มัดจำ / สำรวจ", sub: "มัดจำ-ล็อกคิวสำรวจ / สำรวจ (Smart/BA)", icon: "pin_drop", cards: [
    { id: "OP-2611-0103", name: "คุณชนิดา วงศ์ใหญ่", note: "นัดสำรวจ 2 ธ.ค.", v: 355000, ball: "KIM" },
    { id: "OP-2611-0102", name: "คุณรัตนา พรหมมา", note: "รอมัดจำ ฿30,000", v: 245000, ball: "ลูกค้า", late: true } ] },
  { t: "เสนอราคาหลังสำรวจ", sub: "ขั้นใหม่ของ Opp", icon: "price_check", last: true, cards: [
    { id: "OP-2611-0122", name: "คุณพิมพ์ใจ รักไทย", note: "ส่งใบเสนอราคาแล้ว รอตัดสินใจ 3 วัน", v: 345000, ball: "ลูกค้า" },
    { id: "OP-2611-0120", name: "คุณปรีชา แก้วใส", note: "ทีมสำรวจส่งรายงานแล้ว ทีมขายนำเสนอ", v: 86000, ball: "เรา", b: true } ] },
  { t: "ปิดขาย", sub: "ขั้นสุดท้ายของ Opp · ชำระครบ = Won", icon: "verified", last: true, cards: [
    { id: "OP-2611-0104", name: "คุณเอกชัย ธรรมดี", note: "รอชำระครบ 100%", v: 186500, ball: "ลูกค้า" } ] },
];
function OppCard({ c }: { c: OC }) {
  return (
    <div className={cn(glass, "p-3", c.late && "ring-2 ring-amber-300")}>
      <div className="flex flex-wrap items-center gap-1"><Tag cls="bg-violet-50 text-violet-700">{c.id}</Tag>{c.b && <Tag cls="bg-teal-50 text-teal-700">Smart/BA</Tag>}</div>
      <div className="mt-1 text-[12.5px] font-bold text-slate-900">{c.name}</div>
      <div className="text-[11px] text-slate-500">{c.note}</div>
      <div className="mt-2 flex items-center gap-1.5"><Ball b={c.ball} />{c.late && <Tag cls="bg-rose-100 text-rose-700">เลยแผน 3 วัน</Tag>}<span className="ml-auto text-[10.5px] text-slate-400">{c.v ? money(c.v) : ""}</span></div>
    </div>
  );
}
function OppBody() {
  return (
    <>
      <Head title="งาน (Opp)" sub="งานของทีมขายตั้งแต่เปิด Opp จนถึงปิดขาย · หลังปิดขายส่งต่อไปหน้า งานหลังขาย อัตโนมัติ" />
      <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_230px]">
        {OPP_COLS.map((c) => (
          <div key={c.t} className={cn("rounded-2xl p-2", c.last ? "bg-indigo-50/60 ring-1 ring-indigo-200" : "bg-white/50")}>
            <div className="mb-2 px-1">
              <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-900"><Icon name={c.icon} style={{ fontSize: 17 }} />{c.t}<span className="text-slate-400">{c.cards.length}</span>{c.last && <Tag cls="bg-indigo-600 text-white">เพิ่มใหม่</Tag>}</div>
              <div className="text-[10.5px] text-slate-400">{c.sub}</div>
            </div>
            <div className="space-y-2">{c.cards.map((k) => <OppCard key={k.id} c={k} />)}</div>
          </div>
        ))}
        <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-3">
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-800"><Icon name="trending_flat" style={{ fontSize: 20 }} />ปิดขายแล้ว → งานหลังขาย</div>
          <div className="mt-2 text-[22px] font-bold text-emerald-700">6 งาน</div>
          <div className="text-[11.5px] text-emerald-800">เดือนนี้ รวม {money(1_920_500)}</div>
          <p className="mt-2 text-[11px] leading-snug text-slate-600">เมื่อกดปิดขาย ระบบ Opp = Won แล้วย้ายงานไปหน้า งานหลังขาย ทีมขายยังเห็นสถานะได้ที่ภาพรวมงานและแชท</p>
          <span className={cn(btnGhost, "mt-2 w-full !py-1.5 !text-[11.5px]")}>เปิดหน้า งานหลังขาย</span>
        </div>
      </div>
    </>
  );
}

/* ---------------- 2) ยืนยันส่งต่อหลังปิดขาย ---------------- */
function HandoffBody() {
  const rows: [string, string, boolean][] = [
    ["ชำระครบ 100%", "฿345,000 (มัดจำ ฿106,500 + ส่วนที่เหลือ ฿238,500)", true],
    ["ใบเสนอราคาฉบับแก้ไข", "ส่งให้ SCM เพื่อ Map สินค้าและสั่งโรงงาน", true],
    ["ที่อยู่และ Location หน้างาน", "ต.คอหงส์ อ.หาดใหญ่ สงขลา · แนบ Google Maps แล้ว", true],
    ["ผู้ติดต่อหน้างาน", "ยังไม่ระบุ", false],
  ];
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40"><OppBody /></div>
      <div className="absolute inset-0 grid place-items-start justify-items-center bg-slate-900/10 pt-4">
        <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Icon name="verified" /></span>ยืนยันปิดขาย และส่งต่อให้งานหลังขาย<span className="ml-1 text-[11px] font-normal text-slate-400">OP-2611-0103 · คุณชนิดา</span></div>
          <p className="mt-2 text-[12px] text-slate-500">ตรวจข้อมูลที่ KIM และ SCM ต้องใช้ ถ้าขาดจะโทรถามลูกค้าซ้ำ</p>
          <div className="mt-3 space-y-1.5">
            {rows.map(([t, d, ok]) => (
              <div key={t} className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2", ok ? "border-slate-200 bg-slate-50/70" : "border-amber-300 bg-amber-50")}>
                <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded", ok ? "bg-emerald-500 text-white" : "bg-amber-500 text-white")}><Icon name={ok ? "check" : "priority_high"} style={{ fontSize: 12 }} /></span>
                <div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-slate-800">{t}</div><div className="text-[11.5px] text-slate-500">{d}</div></div>
                {!ok && <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-300">กรอกเลย</span>}
              </div>
            ))}
            <div className="rounded-xl border border-slate-200 p-3"><div className="text-[11px] font-semibold text-slate-500">วันที่ลูกค้าอยากให้เริ่มงาน</div><div className="text-[12.5px] text-slate-800">ภายใน 15 ธ.ค. 2569 (เลื่อนได้ถ้าสินค้าไม่พร้อม)</div></div>
            <div className="rounded-xl border border-slate-200 p-3"><div className="text-[11px] font-semibold text-slate-500">ข้อควรระวังหน้างาน</div><div className="text-[12.5px] text-slate-800">ทางเข้าแคบ รถบรรทุกใหญ่เข้าไม่ได้ ต้องใช้รถเล็กขนของ</div></div>
          </div>
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-[11.5px] text-emerald-900"><b>เมื่อกดยืนยัน ระบบจะ:</b><ul className="mt-1 list-disc pl-4"><li>เปลี่ยน Opp เป็น Won และนับยอดขาย</li><li>ส่งข้อมูลให้ KIM และ SCM แล้วสร้างงานในหน้า งานหลังขาย</li><li>ส่งแบบประเมิน CSAT รอบ 1 ให้ลูกค้าทาง LINE OA</li></ul></div>
          <div className="mt-4 flex justify-end gap-2"><span className={btnGhost}>ยกเลิก</span><span className={cn(btnPrimary, "opacity-60")}>ยืนยันปิดขาย (ขาดข้อมูล 1 ข้อ)</span></div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 3) กระดานงานหลังขาย ---------------- */
interface AC { id: string; name: string; note: string; v: number; ball?: Ball; late?: string; prog?: number; warn?: string; b?: boolean }
const LANES: { t: string; sub: string; icon: string; cards: AC[] }[] = [
  { t: "รอแผนติดตั้ง", sub: "KIM วางแผน แล้วแจ้งลูกค้า", icon: "event_note", cards: [
    { id: "OP-2611-0122", name: "คุณพิมพ์ใจ รักไทย", note: "ปิดขาย 21 พ.ย. ยังไม่แจ้งแผน", v: 345000, ball: "KIM" } ] },
  { t: "เตรียมสินค้า", sub: "SCM สั่งโรงงาน และขนส่ง", icon: "inventory_2", cards: [
    { id: "OP-2611-0118", name: "คุณอรทัย สมบูรณ์", note: "รอสินค้าครบ คาด 28 พ.ย.", v: 640000, ball: "SCM", late: "เลยแผน 2 วัน" },
    { id: "OP-2611-0105", name: "คุณวรรณา เพชรดี", note: "สั่งโรงงานแล้ว คาดส่ง 1 ธ.ค.", v: 122000, ball: "SCM" } ] },
  { t: "กำลังติดตั้ง", sub: "KIM และทีมช่าง", icon: "construction", cards: [
    { id: "OP-2611-0115", name: "คุณสมพร บุญรอด", note: "ติดตั้งวันที่ 3 จาก 7 วัน", v: 398000, ball: "KIM", prog: 43 },
    { id: "OP-2611-0133", name: "คุณธนา ใจดี", note: "ติดตั้งแอร์ 2 จาก 3 ห้อง", v: 74000, ball: "KIM", prog: 66, b: true } ] },
  { t: "ส่งมอบ / ตรวจรับ", sub: "ตรวจรับ ใบรับประกัน CSAT รอบ 2", icon: "task_alt", cards: [
    { id: "OP-2611-0110", name: "คุณไพโรจน์ ดวงดี", note: "นัดส่งมอบ 26 พ.ย.", v: 175000, ball: "KIM" } ] },
  { t: "อยู่ในประกัน", sub: "นับถอยหลังวันหมดประกัน", icon: "verified_user", cards: [
    { id: "OP-2611-0111", name: "คุณศิริพร จันทร์เพ็ญ", note: "ประกัน 5 ปี", v: 129000, warn: "เหลือ 4 ปี 11 เดือน" },
    { id: "OP-2611-0107", name: "คุณสมหมาย แก้วมณี", note: "ประกัน 1 ปี (งานติดตั้งแอร์)", v: 98000, warn: "ใกล้หมด 3 เดือน", b: true } ] },
  { t: "แจ้งปัญหา / เคลม", sub: "เรื่องจากลูกค้าในช่วงประกัน", icon: "build", cards: [
    { id: "OP-2611-0101", name: "คุณจันทร์เพ็ญ สายสุด", note: "แจ้งรั่วซึมมุมระเบียง รอนัดตรวจ", v: 168000, ball: "KIM", late: "รับเรื่อง 2 วัน" } ] },
];
function AfterCard({ c }: { c: AC }) {
  return (
    <div className={cn(glass, "p-3", c.late && "ring-2 ring-amber-300")}>
      <div className="flex flex-wrap items-center gap-1"><Tag cls="bg-violet-50 text-violet-700">{c.id}</Tag>{c.b && <Tag cls="bg-teal-50 text-teal-700">Smart/BA</Tag>}</div>
      <div className="mt-1 text-[12.5px] font-bold text-slate-900">{c.name}</div>
      <div className="text-[11px] text-slate-500">{c.note}</div>
      {c.prog !== undefined && <div className="mt-1.5 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${c.prog}%` }} /></div>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {c.ball && <Ball b={c.ball} />}
        {c.late && <Tag cls="bg-rose-100 text-rose-700">{c.late}</Tag>}
        {c.warn && <Tag cls={c.warn.startsWith("ใกล้") ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>{c.warn}</Tag>}
        <span className="ml-auto flex items-center gap-1 text-[10.5px] text-slate-400"><Avatar name="ฝน" size={18} />{money(c.v)}</span>
      </div>
    </div>
  );
}
function BoardBody() {
  const cs: [string, number, string][] = [["งานหลังขาย", 9, "text-slate-900"], ["รอ KIM", 4, "text-cyan-700"], ["รอ SCM", 2, "text-orange-700"], ["เลยแผน", 2, "text-rose-600"], ["แจ้งปัญหา", 1, "text-amber-700"], ["ประกันใกล้หมด", 1, "text-amber-700"]];
  return (
    <>
      <Head title="งานหลังขาย" sub="ตั้งแต่ปิดขายจนถึงรับประกัน · เตรียมของ/ติดตั้ง → ส่งมอบ → รับประกัน และเรื่องแจ้งปัญหา" />
      <RoleBanner />
      <div className={cn(glass, "mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 p-3")}>{cs.map(([l, n, c]) => <span key={l} className="text-[12px] text-slate-500"><b className={cn("mr-1 text-[18px]", c)}>{n}</b>{l}</span>)}</div>
      <div className="grid auto-cols-[210px] grid-flow-col gap-3 overflow-x-auto pb-3">
        {LANES.map((l) => (
          <div key={l.t} className="rounded-2xl bg-white/50 p-2">
            <div className="mb-2 px-1"><div className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-900"><Icon name={l.icon} style={{ fontSize: 17 }} />{l.t}<span className="text-slate-400">{l.cards.length}</span></div><div className="text-[10.5px] text-slate-400">{l.sub}</div></div>
            <div className="space-y-2">{l.cards.map((c) => <AfterCard key={c.id} c={c} />)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- 4) รายละเอียดงานหลังขาย ---------------- */
function DetailBody() {
  const sub = (t: string, d: string, st: "done" | "cur" | "todo", who?: string) => (
    <div key={t} className="flex items-start gap-3 py-2">
      <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full", st === "done" ? "bg-emerald-500 text-white" : st === "cur" ? "bg-indigo-600 text-white ring-4 ring-indigo-200" : "bg-slate-200 text-slate-500")}><Icon name={st === "done" ? "check" : st === "cur" ? "schedule" : "lock"} style={{ fontSize: 14 }} /></span>
      <div className="min-w-0 flex-1"><div className={cn("text-[12.5px] font-semibold", st === "todo" ? "text-slate-400" : "text-slate-900")}>{t}</div><div className="text-[11.5px] text-slate-500">{d}</div></div>
      {who && <Tag cls="bg-white text-slate-600 ring-1 ring-slate-200">{who}</Tag>}
    </div>
  );
  return (
    <>
      <Head title="คุณอรทัย สมบูรณ์" sub="OP-2611-0118 · นครสวรรค์ · อะเส + ทรัส + มุง · ฿640,000" right={<span className={btnGhost}><Icon name="chat" style={{ fontSize: 17 }} />เปิดแชท</span>} />
      <RoleBanner />
      <div className="space-y-4">
        <div className={cn(glass, "flex flex-wrap items-center gap-3 p-4")}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white"><Icon name="check" /></span>
          <div><div className="text-[13px] font-bold text-slate-900">ขายสำเร็จ · 6 ช่วงแรกเสร็จแล้ว</div><div className="text-[11.5px] text-slate-500">Lead 8 พ.ย. → ปิดขาย 14 พ.ย. ฿640,000 · เจ้าของงาน แนน</div></div>
          <span className="ml-auto text-[12px] font-bold text-indigo-700">ดูประวัติช่วงขาย →</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className={cn(glass, "p-4")}>
              <div className="mb-1 flex items-center gap-2"><h3 className="text-[13.5px] font-bold text-slate-900">เตรียมของ / ติดตั้ง</h3><Tag cls="bg-indigo-600 text-white">ช่วงปัจจุบัน</Tag><Ball b="SCM" /><Tag cls="bg-rose-100 text-rose-700">เลยแผน 2 วัน</Tag></div>
              <div className="divide-y divide-slate-100">
                {sub("แจ้งแผนติดตั้งลูกค้า", "เสร็จ 19 พ.ย. · เริ่มติดตั้งประมาณ 8 ธ.ค.", "done", "KIM ประเสริฐ")}
                {sub("สั่งโรงงานและ Map สินค้า", "เสร็จ 20 พ.ย. ตามใบเสนอราคาฉบับแก้ไข", "done", "SCM วิไล")}
                {sub("สินค้าครบพร้อมส่ง", "คาด 28 พ.ย. (เลยแผน 2 วัน) ทรัสขึ้นรูปเสร็จแล้ว รอกระเบื้อง", "cur", "SCM วิไล")}
                {sub("ส่งอะเส + ทรัส + กระเบื้องเข้าหน้างาน", "แผน 3 ธ.ค.", "todo", "SCM")}
                {sub("ติดตั้งอะเส ทรัส และกระเบื้อง", "แผน 8 ถึง 15 ธ.ค.", "todo", "KIM")}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 rounded-xl bg-slate-50 p-2.5"><span className="text-[11.5px] text-slate-500">อัปเดตสถานะ (เฉพาะ KIM/SCM):</span><span className="rounded-lg bg-white px-2.5 py-1 text-[11.5px] font-bold text-slate-400 ring-1 ring-slate-200">สินค้าครบแล้ว</span><span className="rounded-lg bg-white px-2.5 py-1 text-[11.5px] font-bold text-slate-400 ring-1 ring-slate-200">เลื่อนกำหนด</span></div>
            </div>
            <div className={cn(glass, "p-4")}>
              <div className="mb-1 flex items-center gap-2"><h3 className="text-[13.5px] font-bold text-slate-400">ส่งมอบ / ตรวจรับ</h3><Tag cls="bg-slate-100 text-slate-500">ยังไม่ถึง</Tag></div>
              {["ตรวจรับงานร่วมกับลูกค้า (มีรูปก่อน-หลัง)", "ใบส่งมอบงานและใบรับประกัน", "ส่งแบบประเมิน CSAT รอบ 2 ทาง LINE OA", "มอบสิทธิพิเศษหลังประเมิน"].map((t) => <div key={t} className="flex items-center gap-2 py-1 text-[12px] text-slate-400"><span className="h-4 w-4 rounded border border-slate-300" />{t}</div>)}
            </div>
            <div className={cn(glass, "p-4")}>
              <div className="mb-1 flex items-center gap-2"><h3 className="text-[13.5px] font-bold text-slate-400">รับประกัน</h3><Tag cls="bg-slate-100 text-slate-500">เริ่มนับวันส่งมอบ</Tag></div>
              <p className="text-[12px] text-slate-400">ประกัน 5 ปี (Complete Roof) ระบบเริ่มนับถอยหลังเมื่อกดส่งมอบ และเตือนทีมขายก่อนหมดประกัน 90 วัน</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className={cn(glass, "p-4")}>
              <h3 className="mb-2 text-[13px] font-bold text-slate-900">คนที่เกี่ยวข้อง</h3>
              {[["แนน", "ทีมขาย (เจ้าของงาน)", "bg-indigo-100 text-indigo-700"], ["ประเสริฐ", "ทีมติดตั้ง KIM", "bg-cyan-100 text-cyan-800"], ["วิไล", "SCM เตรียมสินค้า", "bg-orange-100 text-orange-800"]].map(([n, r, c]) => <div key={n} className="flex items-center gap-2 py-1"><Avatar name={n} size={28} /><div className="flex-1"><div className="text-[12px] font-semibold text-slate-800">{n}</div><span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", c)}>{r}</span></div></div>)}
            </div>
            <div className={cn(glass, "p-4")}>
              <h3 className="mb-2 text-[13px] font-bold text-slate-900">แจ้งลูกค้าความคืบหน้า</h3>
              <p className="text-[11.5px] text-slate-500">ส่งการ์ดสถานะงานทางแชทให้ลูกค้า หรือใช้ข้อความตัวอย่างของขั้นนี้</p>
              <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-[11.5px] text-slate-600">คุณอรทัย ค่ะ สินค้าจะส่งเข้าหน้างานประมาณ 3 ธ.ค. รบกวนเตรียมที่วางวัสดุและให้มีคนรับของด้วยนะคะ</div>
              <span className={cn(btnPrimary, "mt-2 w-full !py-1.5 !text-[12px]")}><Icon name="send" style={{ fontSize: 16 }} />ส่งทางแชท</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- 5) รับประกันและเรื่องแจ้งปัญหา ---------------- */
function WarrantyBody() {
  const steps = ["รับเรื่อง", "นัดตรวจ", "ซ่อม/แก้ไข", "ปิดเรื่อง"];
  return (
    <>
      <Head title="รับประกันและเรื่องแจ้งปัญหา" sub="ลูกค้าแจ้งปัญหาทางแชทหรือหน้า Account แล้วเปิดเป็นเรื่องในหน้านี้ ทีมงานตามจนปิดเรื่อง" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(glass, "p-4 lg:col-span-2")}>
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="build" style={{ fontSize: 18 }} />เรื่องที่เปิดอยู่ 1</h3>
          <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
            <div className="flex flex-wrap items-center gap-2"><Tag cls="bg-violet-50 text-violet-700">OP-2611-0101</Tag><span className="text-[13px] font-bold text-slate-900">คุณจันทร์เพ็ญ สายสุด · รั่วซึมมุมระเบียง</span><Ball b="KIM" /><Tag cls="bg-rose-100 text-rose-700">รับเรื่อง 2 วันแล้ว</Tag></div>
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-white p-2.5 text-[12px] text-slate-600"><Icon name="chat" style={{ fontSize: 17 }} className="text-[#06a047]" />ลูกค้าแจ้งทางแชทเมื่อ 22 พ.ย. 14:10 &ldquo;ฝนตกเมื่อคืนมีน้ำหยดตรงมุมระเบียง&rdquo; แนบรูป 2 รูป</div>
            <div className="mt-3 flex items-center">
              {steps.map((s, i) => (
                <div key={s} className="relative flex flex-1 flex-col items-center text-center">
                  {i > 0 && <span className={cn("absolute right-1/2 top-3 h-0.5 w-full", i <= 1 ? "bg-emerald-400" : "bg-slate-200")} />}
                  <span className={cn("relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold", i === 0 ? "bg-emerald-500 text-white" : i === 1 ? "bg-indigo-600 text-white ring-4 ring-indigo-200" : "bg-slate-200 text-slate-500")}>{i === 0 ? <Icon name="check" style={{ fontSize: 14 }} /> : i + 1}</span>
                  <span className="mt-1 text-[11px] font-semibold text-slate-700">{s}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2"><span className={btnPrimary}>นัดวันตรวจกับลูกค้า</span><span className={btnGhost}><Icon name="chat" style={{ fontSize: 17 }} />เปิดแชท</span></div>
          </div>
          <div className="mt-4 text-[12px] font-bold text-slate-700">เรื่องที่ปิดแล้ว (ปีนี้ 3)</div>
          {[["คุณสมหมาย แก้วมณี", "แอร์ไม่เย็น เปลี่ยนคอมเพรสเซอร์", "ปิด 12 พ.ย. · 4 วัน"], ["คุณวรรณา เพชรดี", "กระเบื้องแตก 2 แผ่น", "ปิด 2 พ.ย. · 2 วัน"]].map(([n, d, t]) => <div key={n} className="mt-1.5 flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 text-[12px]"><span className="font-semibold text-slate-800">{n}</span><span className="flex-1 text-slate-500">{d}</span><Tag cls="bg-emerald-50 text-emerald-700">{t}</Tag></div>)}
        </div>
        <div className="space-y-4">
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="event_busy" style={{ fontSize: 18 }} />ประกันใกล้หมด (โอกาสขายซ้ำ)</h3>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <div className="flex items-center gap-2"><span className="text-[12.5px] font-bold text-slate-900">คุณสมหมาย แก้วมณี</span><Tag cls="bg-amber-100 text-amber-800">เหลือ 3 เดือน</Tag></div>
              <div className="text-[11.5px] text-slate-500">ติดตั้งแอร์ ประกัน 1 ปี · ส่งมอบ 24 ก.พ. 69</div>
              <div className="mt-2 rounded-lg bg-white p-2 text-[11.5px] text-slate-600"><b className="text-violet-700">น้องเลขาแนะนำ:</b> เสนอแพ็กเกจล้างแอร์และขยายประกัน ลูกค้ามีสิทธิ์ล้างแอร์ 15% ที่ยังไม่ได้ใช้</div>
              <span className={cn(btnGhost, "mt-2 w-full !py-1.5 !text-[11.5px]")}>ร่างข้อความเสนอบริการต่อ</span>
            </div>
          </div>
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 text-[13px] font-bold text-slate-900">สรุปรับประกัน</h3>
            {[["งานที่อยู่ในประกัน", "14"], ["เรื่องแจ้งปัญหาเฉลี่ย", "3.2 วัน/เรื่อง"], ["ประกันหมดใน 90 วัน", "2"]].map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-100 py-1.5 text-[12px] last:border-0"><span className="text-slate-500">{k}</span><span className="font-bold text-slate-800">{v}</span></div>)}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- 6) เมนูใหม่ ---------------- */
const MENU = [["space_dashboard", "หน้าหลัก"], ["timeline", "ภาพรวมงาน"], ["person_search", "Leads"], ["view_kanban", "งาน (Opp)"], ["construction", "งานหลังขาย"], ["chat", "แชท"], ["groups", "ลูกค้า 360"]];
function MenuBody() {
  const phone = [["space_dashboard", "หน้าหลัก"], ["timeline", "ภาพรวม"], ["person_search", "Leads"], ["chat", "แชท"], ["more_horiz", "เพิ่มเติม"]];
  return (
    <>
      <Head title="โครงเมนูใหม่" sub="จอใหญ่เห็น 7 เมนู · มือถือเหลือ 5 ตัวที่ใช้บ่อย ส่วนที่เหลืออยู่ใน เพิ่มเติม" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(glass, "p-4")}>
          <div className="mb-3 text-[13px] font-bold text-slate-900">จอคอมพิวเตอร์ (เมนูซ้าย)</div>
          {MENU.map(([ic, l], i) => <div key={l} className={cn("mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold", i === 4 ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "text-slate-600")}><Icon name={ic} fill={i === 4} />{l}{i === 5 && <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">3</span>}</div>)}
        </div>
        <div className={cn(glass, "p-4")}>
          <div className="mb-3 text-[13px] font-bold text-slate-900">มือถือ (เมนูล่าง)</div>
          <div className="mx-auto w-[300px] rounded-[28px] border-4 border-slate-800 bg-slate-100 p-2">
            <div className="h-48 rounded-2xl bg-white/80 p-3 text-[11px] text-slate-400">เนื้อหาหน้าจอ</div>
            <div className="mt-2 flex justify-around rounded-2xl bg-white py-2">{phone.map(([ic, l], i) => <div key={l} className={cn("flex flex-col items-center text-[9.5px] font-semibold", i === 1 ? "text-indigo-600" : "text-slate-400")}><Icon name={ic} fill={i === 1} style={{ fontSize: 22 }} />{l}</div>)}</div>
          </div>
          <p className="mt-3 text-[11.5px] text-slate-500">เพิ่มเติม = Opp, งานหลังขาย, ลูกค้า 360, พื้นที่รับงาน และเชื่อมข้อมูล</p>
        </div>
      </div>
    </>
  );
}

export function AfterSaleConceptScreen() {
  const v = useSearchParams().get("v") ?? "board";
  const active = v === "opp" || v === "handoff" ? "งาน (Opp)" : "งานหลังขาย";
  return (
    <Shell active={active}>
      {v === "opp" ? <OppBody /> : v === "handoff" ? <HandoffBody /> : v === "detail" ? <DetailBody /> : v === "warranty" ? <WarrantyBody /> : v === "menu" ? <MenuBody /> : <BoardBody />}
    </Shell>
  );
}
