"use client";
/* ภาพร่างแนวคิดรอบ 2: มุมมองตามตำแหน่ง, Lead สายสินค้า (ส่งร้าน), Opp ชนิดสำรวจ, Customer 360, CSAT + สิทธิพิเศษ, รายงาน
   ข้อมูลสมมติทั้งหมด ; เลือกมุมมองด้วย ?v=track | survey | c360 | csat | report | roles */
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { Shell } from "./crm-lead-concept";
import { glass, grad } from "./crm-ui";

const ROLES = [
  { k: "se", label: "พนักงานขาย (SE)", icon: "badge", scope: "เห็นเฉพาะ Lead/Opp ของตัวเอง" },
  { k: "coach", label: "โค้ช", icon: "sports", scope: "เห็นทีมขายในร้านที่ดูแล (อ่านอย่างเดียว)" },
  { k: "area", label: "Area", icon: "map", scope: "เห็นทุกร้านในพื้นที่ (อ่านอย่างเดียว)" },
  { k: "dealer", label: "ร้านค้า", icon: "storefront", scope: "เห็นเฉพาะร้านตัวเอง + ตอบ Lead สายสินค้า" },
];

function RoleBar({ role }: { role: string }) {
  const cur = ROLES.find((r) => r.k === role) ?? ROLES[0];
  return (
    <div className={cn(glass, "mb-4 flex flex-wrap items-center gap-2 p-2.5")}>
      <span className="px-2 text-[11.5px] font-semibold text-slate-500">ดูในมุมมองของ</span>
      {ROLES.map((r) => (
        <span key={r.k} className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold", r.k === role ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "bg-white/70 text-slate-600")}>
          <Icon name={r.icon} style={{ fontSize: 17 }} />{r.label}
        </span>
      ))}
      <span className="ml-auto text-[11px] text-slate-400">{cur.scope} · เดโมสลับได้ของจริงตามบัญชีที่ login</span>
    </div>
  );
}

function Head({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[22px] font-bold tracking-tight text-slate-900">{title}</h1><p className="text-[12.5px] text-slate-500">{sub}</p></div>
      {children}
    </div>
  );
}
const Assume = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-400 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700"><Icon name="edit_note" style={{ fontSize: 13 }} />สมมติ · {children}</span>
);
const Pill = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>{children}</span>
);

/* ---------------- 1) Lead board: สายสินค้า ส่งร้าน ---------------- */
type Card = { id: string; name: string; place: string; note: string; tag?: React.ReactNode; store?: string };
const COLS: { title: string; sub: string; tone: string; cards: Card[] }[] = [
  { title: "รอติดต่อ", sub: "SLA นับเวลา", tone: "border-amber-300", cards: [
    { id: "L-2611-021", name: "คุณนภา ใจงาม", place: "ต.หมากแข้ง อ.เมือง อุดรธานี", note: "Facebook · ถอดแบบฟรี", tag: <Pill cls="bg-emerald-50 text-emerald-700">เหลือ 22 ชม.</Pill>, store: "จ่ายให้ ร้านอุดรวัสดุ (ตามพื้นที่)" },
    { id: "L-2611-022", name: "คุณธนากร ใจดี", place: "ต.ในเมือง อ.เมือง ขอนแก่น", note: "Google Search", tag: <Pill cls="bg-rose-50 text-rose-700">เกิน SLA 2 ชม.</Pill>, store: "จ่ายให้ ร้านขอนแก่นโฮม (ลำดับ 1)" },
  ] },
  { title: "กำลังสกรีน", sub: "ถามความสนใจ", tone: "border-sky-300", cards: [
    { id: "L-2611-018", name: "คุณวิภา ศรีสุข", place: "สงขลา", note: "ถามอยู่: สนใจ Solution หรือ สินค้า?", tag: <Pill cls="bg-sky-50 text-sky-700">สกรีน 1/3</Pill> },
  ] },
  { title: "สาย Solution", sub: "รอเปิด Opp → เปิดแล้ว", tone: "border-indigo-300", cards: [
    { id: "L-2611-014", name: "คุณอนันต์ ทองดี", place: "กรุงเทพฯ", note: "งานหลังคา · ต้องการแบบ", tag: <Pill cls="bg-indigo-50 text-indigo-700">รอเปิด Opp</Pill> },
    { id: "L-2611-010", name: "คุณกิตติ ประเสริฐ", place: "ระยอง", note: "Smart Solution · แอร์", tag: <Pill cls="bg-indigo-100 text-indigo-800">เปิด Opp แล้ว · ชนิดสำรวจ</Pill> },
  ] },
  { title: "สายสินค้า · ส่งให้ร้านแล้ว", sub: "ร้านทำใบเสนอราคาในระบบร้าน", tone: "border-fuchsia-300", cards: [
    { id: "L-2611-016", name: "คุณสุดา มีสุข", place: "ภูเก็ต", note: "กระเบื้องหลังคา 120 ตร.ม. · ไม่ต้องการแบบ", tag: <Pill cls="bg-fuchsia-50 text-fuchsia-700">รอร้านรับ</Pill>, store: "ส่งให้ ร้านภูเก็ตวัสดุ เมื่อ 09:40" },
    { id: "L-2611-012", name: "คุณมานะ พงษ์ไทย", place: "ชลบุรี", note: "รางน้ำฝน", tag: <Pill cls="bg-violet-50 text-violet-700">ร้านเสนอราคาแล้ว ฿48,200</Pill>, store: "ร้านชลบุรีโฮม · สถานะ: รอลูกค้าตัดสินใจ" },
    { id: "L-2611-011", name: "คุณวิไล รักดี", place: "เชียงใหม่", note: "ฝ้าเพดาน", tag: <Pill cls="bg-emerald-100 text-emerald-800">ร้านปิดขาย ฿36,500</Pill>, store: "ร้านเชียงใหม่ซีเมนต์ → Lead = Won" },
  ] },
  { title: "Lost", sub: "ไม่ซื้อ / ร้านแจ้งแพ้", tone: "border-rose-300", cards: [
    { id: "L-2611-008", name: "คุณวีระ สุขสบาย", place: "ชลบุรี", note: "ร้านแจ้ง Loss: ราคาสูง ซื้อยี่ห้ออื่น", tag: <Pill cls="bg-rose-50 text-rose-700">Lost</Pill> },
  ] },
];

function TrackBody() {
  return (
    <>
      <Head title="ลูกค้ามุ่งหวัง (Leads)" sub="แยกสายหลังสกรีน: สาย Solution เปิด Opp ในทีมขาย / สายสินค้า ส่งให้ร้านทำใบเสนอราคา แล้วรับสถานะกลับมา" />
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className={cn(glass, "p-4 lg:col-span-2")}>
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="call_split" style={{ fontSize: 18 }} />หลังสกรีน ระบบถามให้ทางเดียวกันทุกคน</div>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <Pill cls="bg-slate-100 text-slate-700">ลูกค้าสนใจอะไร?</Pill><Icon name="arrow_forward" style={{ fontSize: 16 }} />
            <Pill cls="bg-indigo-100 text-indigo-800">Solution → เปิด Opp (ต้องการแบบ/สำรวจ)</Pill>
            <span className="text-slate-400">หรือ</span>
            <Pill cls="bg-fuchsia-100 text-fuchsia-800">สินค้า → ต้องการแบบไหม?</Pill><Icon name="arrow_forward" style={{ fontSize: 16 }} />
            <Pill cls="bg-indigo-100 text-indigo-800">ต้องการแบบ → เปิด Opp (ฟลว์แบบ DECAAR)</Pill>
            <Pill cls="bg-fuchsia-100 text-fuchsia-800">ไม่ต้องการแบบ → ส่งให้ร้าน</Pill>
          </div>
        </div>
        <div className={cn(glass, "p-4")}>
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="share_location" style={{ fontSize: 18 }} />การจ่าย Lead ออนไลน์ให้ร้าน</div>
          <p className="text-[12px] leading-relaxed text-slate-600">ตารางพื้นที่รับงานต่อร้าน (ตำบล / อำเภอ / จังหวัด) ถ้าพื้นที่ซ้ำกันกำหนด<b>ลำดับร้าน</b>ได้ ร้านลำดับแรกไม่รับภายใน SLA จะเลื่อนไปร้านถัดไป</p>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-5 md:grid-cols-3">
        {COLS.map((c) => (
          <div key={c.title} className={cn("rounded-2xl border-t-4 bg-white/60 p-2.5", c.tone)}>
            <div className="mb-2 px-1"><div className="text-[13px] font-bold text-slate-900">{c.title} <span className="text-slate-400">{c.cards.length}</span></div><div className="text-[10.5px] text-slate-400">{c.sub}</div></div>
            <div className="space-y-2">
              {c.cards.map((k) => (
                <div key={k.id} className={cn(glass, "p-3")}>
                  <div className="flex flex-wrap items-center justify-between gap-1"><span className="whitespace-nowrap text-[10.5px] text-slate-400">{k.id}</span>{k.tag}</div>
                  <div className="mt-1 text-[13px] font-semibold text-slate-900">{k.name}</div>
                  <div className="text-[11px] text-slate-500">{k.place}</div>
                  <div className="mt-1 text-[11.5px] text-slate-600">{k.note}</div>
                  {k.store && <div className="mt-2 flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10.5px] text-slate-600"><Icon name="storefront" style={{ fontSize: 14 }} />{k.store}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={cn(glass, "mt-4 flex flex-wrap items-center gap-3 p-4")}>
        <Icon name="sync_alt" />
        <div className="text-[12.5px] text-slate-600"><b className="text-slate-900">ระบบร้านค้า (เดโม)</b> ส่งกลับมาที่ CRM: ร้านรับแล้ว → รายการสินค้า/ราคา → สถานะใบเสนอราคา → Win / Loss + เหตุผล แล้ว CRM อัปเดตสถานะ Lead ให้เอง</div>
        <Pill cls="bg-fuchsia-50 text-fuchsia-700">เดโม: ปุ่ม &quot;จำลองร้านตอบกลับ&quot;</Pill>
      </div>
    </>
  );
}

/* ---------------- 2) Opp ชนิดสำรวจ (Smart Solution / BA) ---------------- */
const SV = [
  { icon: "payments", who: "SE", t: "เก็บค่าสำรวจ", d: "วันที่ 0", sub: "ออกใบแจ้งค่าสำรวจ รับชำระก่อนส่งทีมสำรวจ", tone: "bg-indigo-100 text-indigo-700" },
  { icon: "send", who: "SE → ทีมสำรวจ", t: "ส่งงานสำรวจ", d: "วันที่ 0–1", sub: "ส่งข้อมูลลูกค้า/หน้างานเข้าแอปทีมสำรวจ", tone: "bg-sky-100 text-sky-700" },
  { icon: "engineering", who: "ทีมสำรวจ", t: "ลงสำรวจหน้างาน", d: "วันที่ 2–5", sub: "นัดหมายและเข้าสำรวจ", tone: "bg-amber-100 text-amber-700" },
  { icon: "assignment_return", who: "ทีมสำรวจ → SE", t: "ส่งรายงานสำรวจ + ใบเสนอราคา", d: "วันที่ 6–7", sub: "ไฟล์กลับมาที่ CRM ให้ SE", tone: "bg-violet-100 text-violet-700" },
  { icon: "slideshow", who: "SE", t: "นำเสนอราคาให้ลูกค้า", d: "วันที่ 8–12", sub: "ตามผล / ต่อรอง", tone: "bg-orange-100 text-orange-700" },
  { icon: "verified", who: "SE", t: "ปิดขาย + เก็บค่าติดตั้ง", d: "ปิด = D0", sub: "ส่ง QR ประเมินรอบ 1 ทาง LINE OA", tone: "bg-emerald-500 text-white" },
  { icon: "inventory_2", who: "SCM / KIM", t: "เตรียมของ → ติดตั้ง → ส่งมอบ", d: "D+3 ถึง D+21", sub: "เหมือนงานหลังคา ใช้ตาม PT", tone: "bg-teal-100 text-teal-700" },
];
function SurveyBody() {
  return (
    <>
      <Head title="Opp ชนิด “สำรวจ” (Smart Solution / BA)" sub="ตัวอย่าง OP-2611-0145 · คุณกิตติ ประเสริฐ · ระยอง · ติดตั้งแอร์ 3 ห้อง"><Assume>วันและค่าสำรวจเป็นค่าสมมติ รอยืนยัน</Assume></Head>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(glass, "p-4 lg:col-span-2")}>
          <ol>
            {SV.map((s, i) => (
              <li key={s.t} className="relative flex gap-3 pb-4 last:pb-0">
                {i < SV.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-20px)] w-0.5 bg-slate-200" />}
                <span className={cn("relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full", s.tone)}><Icon name={s.icon} style={{ fontSize: 19 }} /></span>
                <div className="flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-semibold text-slate-900">{s.t}</span><Pill cls="bg-slate-100 text-slate-600">{s.who}</Pill><span className="text-[11px] text-slate-400">{s.d}</span></div>
                  <div className="text-[12px] text-slate-500">{s.sub}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <div className={cn(glass, "p-4")}>
            <div className="mb-2 text-[13px] font-bold text-slate-900">การเงินของ Opp นี้</div>
            <dl className="space-y-1.5 text-[12.5px]">
              <div className="flex justify-between"><dt className="text-slate-500">ค่าสำรวจ <Assume>฿1,500</Assume></dt><dd className="font-semibold">฿1,500 · ชำระแล้ว</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">ใบเสนอราคาจากทีมสำรวจ</dt><dd className="font-semibold">฿86,000</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">หักค่าสำรวจจากค่าติดตั้ง <Assume>หัก</Assume></dt><dd className="font-semibold text-emerald-700">−฿1,500</dd></div>
              <div className="flex justify-between border-t pt-1.5"><dt className="font-semibold">ค่าติดตั้งที่เก็บตอนปิด</dt><dd className="font-bold text-indigo-700">฿84,500</dd></div>
            </dl>
          </div>
          <div className={cn(glass, "p-4")}>
            <div className="mb-2 text-[13px] font-bold text-slate-900">ไฟล์ที่ทีมสำรวจส่งกลับ</div>
            {["รายงานสำรวจ_กิตติ.pdf", "ใบเสนอราคา_SS-0145.pdf", "รูปหน้างาน (12)"].map((f) => (
              <div key={f} className="flex items-center gap-2 py-1 text-[12px] text-slate-600"><Icon name="attach_file" style={{ fontSize: 16 }} />{f}</div>
            ))}
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-[12px] leading-relaxed text-slate-600">
            <b className="text-sky-800">ต่างจาก Opp แบบมีแบบ:</b> ไม่มีขั้นถอดแบบ/ห้องแบบ แต่มี “ค่าสำรวจ” และ “ทีมสำรวจ” แทน ส่วนหลังปิดขายใช้ตัวเดียวกับงานหลังคา (เตรียมของ ติดตั้ง ส่งมอบ)
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- 3) Customer 360 ---------------- */
function C360Body() {
  const opps = [
    { id: "OP-2611-0120", t: "หลังคา Roof Install", v: "฿345,000", st: "Won · ส่งมอบแล้ว", cls: "bg-emerald-100 text-emerald-800" },
    { id: "OP-2612-0003", t: "สำรวจต่อเติมโรงจอดรถ", v: "ค่าสำรวจพิเศษ ฿500", st: "กำลังสำรวจ", cls: "bg-amber-100 text-amber-800" },
  ];
  return (
    <>
      <Head title="ลูกค้า 360° · คุณพิมพ์ใจ รักไทย" sub="รวมทุก Lead / Opp / สิทธิพิเศษ / คะแนนความพึงพอใจ ของลูกค้า 1 คน ผูกด้วยรหัส SCG Family" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className={cn(glass, "p-4")}>
            <div className="flex items-center gap-3"><span className={cn("grid h-12 w-12 place-items-center rounded-2xl text-white", grad)}><Icon name="person" /></span>
              <div><div className="text-[15px] font-bold text-slate-900">คุณพิมพ์ใจ รักไทย</div><div className="text-[11.5px] text-slate-500">082-555-2231 · สงขลา</div></div></div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-[12px]"><Icon name="badge" style={{ fontSize: 17 }} />รหัส SCG Family <b className="ml-auto text-indigo-700">SF-0098123</b></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["2", "Opp"], ["฿345K", "ยอดซื้อสะสม"], ["4.7", "CSAT เฉลี่ย"]].map(([a, b]) => <div key={b} className="rounded-xl bg-white/70 p-2"><div className="text-[15px] font-bold text-slate-900">{a}</div><div className="text-[10.5px] text-slate-500">{b}</div></div>)}
            </div>
          </div>
          <div className={cn(glass, "p-4")}>
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="redeem" style={{ fontSize: 18 }} />สิทธิพิเศษของลูกค้า</div>
            {[
              { n: "ส่วนลดล้างแอร์ 15%", e: "หมดอายุ 21 ก.พ. 70", c: "bg-emerald-50 text-emerald-700", s: "ใช้ได้" },
              { n: "สำรวจต่อเติมโรงจอดรถ ราคาพิเศษ", e: "หมดอายุ 21 ม.ค. 70", c: "bg-sky-50 text-sky-700", s: "ใช้แล้ว → Opp ใหม่" },
              { n: "สำรวจรางน้ำฝน ราคาพิเศษ", e: "หมดอายุ 21 ม.ค. 70", c: "bg-amber-50 text-amber-700", s: "ใกล้หมด 9 วัน" },
            ].map((r) => (
              <div key={r.n} className="mb-2 rounded-xl border border-white/70 bg-white/70 p-2.5 last:mb-0"><div className="flex items-center justify-between gap-2"><span className="text-[12.5px] font-semibold text-slate-800">{r.n}</span><Pill cls={r.c}>{r.s}</Pill></div><div className="text-[10.5px] text-slate-400">{r.e}</div></div>
            ))}
          </div>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className={cn(glass, "p-4")}>
            <div className="mb-2 text-[13px] font-bold text-slate-900">Opp ทั้งหมดของลูกค้า</div>
            {opps.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2.5 last:border-0"><span className="text-[11px] text-slate-400">{o.id}</span><span className="text-[13px] font-semibold text-slate-800">{o.t}</span><span className="text-[12px] text-slate-500">{o.v}</span><Pill cls={cn(o.cls, "ml-auto")}>{o.st}</Pill></div>
            ))}
          </div>
          <div className={cn(glass, "p-4")}>
            <div className="mb-3 text-[13px] font-bold text-slate-900">เส้นเวลารวม</div>
            <ol>
              {[
                ["campaign", "3 พ.ย.", "Lead จาก Site Visit", "bg-slate-100 text-slate-500"],
                ["verified", "21 พ.ย.", "ปิดขาย OP-2611-0120 ฿345,000", "bg-emerald-500 text-white"],
                ["reviews", "21 พ.ย.", "CSAT รอบ 1 · 4.5/5 ผ่าน LINE OA", "bg-yellow-100 text-yellow-700"],
                ["redeem", "21 พ.ย.", "มอบสิทธิพิเศษ 3 รายการ (อายุ 60–90 วัน)", "bg-fuchsia-100 text-fuchsia-700"],
                ["task_alt", "10 ธ.ค.", "ส่งมอบงาน · CSAT รอบ 2 · 4.9/5", "bg-teal-100 text-teal-700"],
                ["rocket_launch", "12 ธ.ค.", "ลูกค้าสนใจสำรวจโรงจอดรถ → เปิด Opp ใหม่ใช้สิทธิ", "bg-indigo-100 text-indigo-700"],
              ].map(([ic, d, t, tone], i, a) => (
                <li key={t} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < a.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-18px)] w-0.5 bg-slate-200" />}
                  <span className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full", tone)}><Icon name={ic} style={{ fontSize: 18 }} /></span>
                  <div className="pt-1 text-[12.5px]"><span className="font-semibold text-slate-800">{t}</span> <span className="text-[11px] text-slate-400">{d}</span></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

function Round({ n, title, trig, qs }: { n: number; title: string; trig: string; qs: string[] }) {
  return (
  <div className={cn(glass, "p-4")}>
    <div className="mb-1 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-[12px] font-bold text-white">{n}</span><span className="text-[14px] font-bold text-slate-900">{title}</span></div>
    <div className="mb-3 text-[11.5px] text-slate-500">ส่งอัตโนมัติเมื่อ: {trig}</div>
    {qs.map((q) => (<div key={q} className="mb-2"><div className="text-[12px] text-slate-700">{q}</div><div className="text-[18px] tracking-wider text-yellow-400">★★★★★</div></div>))}
    <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">NPS: จะแนะนำเราให้คนรู้จักไหม (0–10) · ข้อความเพิ่มเติม (ไม่บังคับ)</div>
  </div>
);
}

/* ---------------- 4) CSAT 2 รอบ + สิทธิพิเศษ ---------------- */
function CsatBody() {
  const Q1 = ["ความรวดเร็วในการติดต่อและนัดหมาย", "ความชัดเจนของใบเสนอราคาและคำแนะนำ", "ความเหมาะสมของราคาและเงื่อนไข"];
  const Q2 = ["คุณภาพงานติดตั้ง", "ความตรงต่อเวลาตามแผนงาน", "ความสะอาดเรียบร้อยหลังติดตั้งและการส่งมอบ"];
  return (
    <>
      <Head title="ความพึงพอใจ (CSAT) และสิทธิพิเศษ" sub="เก็บ 2 รอบ ตอนปิดขายและตอนส่งมอบ ใช้ชุดคำถามตามต้นแบบ JV ส่งผ่าน LINE OA ด้วย QR / ลิงก์"><Assume>รอบ 2 ผูกสิทธิพิเศษ</Assume></Head>
      <div className="grid gap-4 lg:grid-cols-2">
        <Round n={1} title="รอบที่ 1 · หลังปิดขาย" trig="Opp เป็น Won (รับชำระแล้ว)" qs={Q1} />
        <Round n={2} title="รอบที่ 2 · หลังส่งมอบงาน" trig="ขั้น “ส่งมอบงาน” เสร็จ" qs={Q2} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className={cn(glass, "p-4")}>
          <div className="mb-2 text-[13px] font-bold text-slate-900">ข้อความ LINE OA ที่ลูกค้าได้รับ</div>
          <div className="rounded-2xl bg-[#e8f5e9] p-3 text-[12px] leading-relaxed text-slate-700">สวัสดีค่ะคุณพิมพ์ใจ ขอบคุณที่ใช้บริการ Housing Expert 🙏 รบกวนประเมินความพึงพอใจ (1 นาที) แล้วรับ<b>สิทธิพิเศษสำหรับคุณ</b> สแกน QR หรือกดลิงก์ได้เลย
            <div className="mt-2 grid h-20 w-20 place-items-center rounded-lg bg-white text-slate-400"><Icon name="qr_code_2" style={{ fontSize: 56 }} /></div></div>
        </div>
        <div className={cn(glass, "p-4")}>
          <div className="mb-2 text-[13px] font-bold text-slate-900">สิทธิพิเศษที่มอบหลังประเมิน</div>
          {["ส่วนลดล้างแอร์ 15% · 90 วัน", "สำรวจต่อเติมโรงจอดรถ ราคาพิเศษ · 60 วัน", "สำรวจรางน้ำฝน ราคาพิเศษ · 60 วัน"].map((r) => (<div key={r} className="mb-1.5 flex items-center gap-2 rounded-xl bg-fuchsia-50 px-3 py-2 text-[12px] font-semibold text-fuchsia-800"><Icon name="redeem" style={{ fontSize: 16 }} />{r}</div>))}
          <p className="mt-2 text-[11px] text-slate-400">ตั้งค่าชุดสิทธิ์ได้โดย Admin · เก็บใน CRM ก่อน</p>
        </div>
        <div className={cn(glass, "p-4")}>
          <div className="mb-2 text-[13px] font-bold text-slate-900">เมื่อลูกค้าสนใจใช้สิทธิ</div>
          <ol className="space-y-2 text-[12px] text-slate-600">
            <li className="flex gap-2"><Icon name="notifications_active" style={{ fontSize: 17 }} />น้องเลขาเตือน SE ก่อนสิทธิ์หมด 14 วัน</li>
            <li className="flex gap-2"><Icon name="rocket_launch" style={{ fontSize: 17 }} />กด “ใช้สิทธิ → เปิด Opp ใหม่” ข้อมูลลูกค้าเติมให้</li>
            <li className="flex gap-2"><Icon name="history" style={{ fontSize: 17 }} />ประวัติเดิมอยู่ครบใน Customer 360</li>
            <li className="flex gap-2 text-rose-600"><Icon name="warning" style={{ fontSize: 17 }} />คะแนน &lt; 3 แจ้ง Area / โค้ชให้ติดตามทันที</li>
          </ol>
        </div>
      </div>
    </>
  );
}

/* ---------------- 5) รายงานสำหรับโค้ช / Area / ร้านค้า ---------------- */
function ReportBody({ role }: { role: string }) {
  const sel = role === "dealer" ? "ร้านค้า (ร้านเดียว)" : role === "area" ? "Area แดง · 9 ร้าน" : "โค้ชเนม · 9 ร้าน";
  const rows = [
    { n: "ร้านหาดใหญ่โฮม", se: "สมชาย", lead: 18, sla: 94, visit: 9, quote: 6, win: 3, csat: 4.6 },
    { n: "ร้านสงขลาวัสดุ", se: "มาลี", lead: 14, sla: 71, visit: 5, quote: 3, win: 1, csat: 4.1 },
    { n: "ร้านภูเก็ตวัสดุ", se: "ประเสริฐ", lead: 11, sla: 55, visit: 3, quote: 2, win: 0, csat: 3.4 },
    { n: "ร้านตรังซีเมนต์", se: "อรุณ", lead: 9, sla: 100, visit: 6, quote: 5, win: 3, csat: 4.8 },
  ];
  return (
    <>
      <Head title="รายงานทีมขาย" sub={`ขอบเขต: ${sel} · พ.ย. 2569 · อ่านอย่างเดียว ใช้ติดตามพนักงานขาย`} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Lead", "52", "text-slate-900"], ["ติดต่อทัน SLA", "78%", "text-emerald-600"], ["Lead → Visit", "44%", "text-indigo-700"], ["ปิดขาย", "7", "text-emerald-600"], ["CSAT เฉลี่ย", "4.2", "text-amber-600"]].map(([k, v, c]) => (
          <div key={k} className={cn(glass, "p-3")}><div className={cn("text-[22px] font-bold leading-none", c)}>{v}</div><div className="mt-1 text-[11.5px] text-slate-500">{k}</div></div>
        ))}
      </div>
      <div className={cn(glass, "overflow-x-auto p-4")}>
        <div className="mb-2 text-[13px] font-bold text-slate-900">{role === "dealer" ? "รายบุคคล (พนักงานขายของร้าน)" : "รายร้าน"}</div>
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead className="text-[11px] text-slate-400"><tr>{["ร้าน", "SE", "Lead", "ติดต่อทัน SLA", "Visit", "Quote", "Win", "CSAT"].map((h) => <th key={h} className="pb-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.n} className="border-t border-slate-100">
                <td className="py-2 font-semibold text-slate-800">{r.n}</td><td>{r.se}</td><td>{r.lead}</td>
                <td><Pill cls={r.sla >= 90 ? "bg-emerald-50 text-emerald-700" : r.sla >= 70 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}>{r.sla}%</Pill></td>
                <td>{r.visit}</td><td>{r.quote}</td><td>{r.win}</td>
                <td><Pill cls={r.csat >= 4 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>{r.csat.toFixed(1)}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={cn(glass, "p-4")}>
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="flag" style={{ fontSize: 18 }} />ควรตามด้วยตัวเอง</div>
          {["ร้านภูเก็ตวัสดุ: ติดต่อทัน SLA เพียง 55% และ CSAT 3.4", "Lead L-2611-022 เกิน SLA 2 ชม. (ร้านขอนแก่นโฮม)", "Opp ใกล้ปิด 3 งาน ยังไม่มีการติดต่อ 5 วัน"].map((t) => <div key={t} className="mb-1.5 rounded-xl bg-rose-50/70 px-3 py-2 text-[12px] text-slate-700">{t}</div>)}
        </div>
        <div className={cn(glass, "p-4")}>
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="rule" style={{ fontSize: 18 }} />สิ่งที่แต่ละบทบาทเห็น</div>
          <ul className="space-y-1 text-[12px] text-slate-600">
            <li><b>SE</b> เฉพาะงานของตัวเอง + น้องเลขาเตือนงานค้าง</li>
            <li><b>โค้ช</b> ทีมขายรายคนในร้านที่ดูแล</li>
            <li><b>Area</b> เทียบร้านต่อร้านในพื้นที่</li>
            <li><b>ร้านค้า</b> ทีมของร้านตัวเอง + Lead สายสินค้าที่ได้รับ</li>
          </ul>
        </div>
      </div>
    </>
  );
}

/* ---------------- ตัวเลือกมุมมอง ---------------- */
export function FlowConceptScreen() {
  const q = useSearchParams();
  const v = q.get("v") ?? "track";
  const role = q.get("role") ?? (v === "report" ? "area" : "se");
  return (
    <Shell>
      <RoleBar role={role} />
      {v === "survey" ? <SurveyBody /> : v === "c360" ? <C360Body /> : v === "csat" ? <CsatBody /> : v === "report" ? <ReportBody role={role} /> : <TrackBody />}
    </Shell>
  );
}
