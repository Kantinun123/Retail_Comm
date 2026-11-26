"use client";
/* ภาพร่างแนวคิด "แชทลูกค้าแบบ LINE OA" ในแอป CRM ข้อมูลสมมติ ยังไม่ใช่หน้าที่ใช้งานจริง
   เลือกมุมมองด้วย ?v=chat | internal | summary | invite | account | jobchat */
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { Shell } from "./crm-lead-concept";
import { Avatar, btnGhost, btnPrimary, glass } from "./crm-ui";

const LINE = "bg-[#06c755] text-white";

/* ---------------- ข้อมูลสมมติ ---------------- */
const ROOMS = [
  { name: "คุณชนิดา วงศ์ใหญ่", last: "ช่วยเพิ่มโรงจอดรถด้วยนะคะ", t: "10:12", unread: 2, jobs: ["OP-2611-0103"], tag: "รอสำรวจ 2 ธ.ค." },
  { name: "คุณวิภา ศรีสุข", last: "สนใจโครงทรัสด้วยค่ะ", t: "09:40", unread: 1, jobs: ["L-2611-001"], warn: "รอตอบ 3 ชม." },
  { name: "คุณกิตติ ประเสริฐ", last: "ส่งรูปหน้างานแล้วนะครับ", t: "เมื่อวาน", unread: 0, jobs: ["OP-2611-0121"], tag: "งานสำรวจ" },
  { name: "คุณสุดา มีสุข", last: "ร้านเสนอราคาแล้วใช่ไหมคะ", t: "22 พ.ย.", unread: 0, jobs: ["L-2611-016"], tag: "ส่งให้ร้านแล้ว" },
  { name: "คุณศิริพร จันทร์เพ็ญ", last: "ขอบคุณมากค่ะ งานเรียบร้อยดี", t: "20 พ.ย.", unread: 0, jobs: ["OP-2611-0111"], tag: "รับประกัน" },
];
type Role = "cust" | "se" | "team";
interface Msg { role: Role; text?: string; who?: string; t: string; img?: boolean; job?: string }
const MSGS: (Msg | { sys: string; t: string; job?: string; day?: string })[] = [
  { sys: "Lead เข้ามาทาง LINE OA", t: "18 พ.ย. 09:12", job: "L-2611-004" },
  { role: "cust", text: "สวัสดีค่ะ สนใจเปลี่ยนหลังคาบ้านค่ะ มีโรงจอดรถด้วย", t: "09:12", job: "L-2611-004" },
  { role: "se", who: "ฝน", text: "สวัสดีค่ะ คุณชนิดา ทีม Housing Expert ยินดีให้บริการค่ะ ขอทราบพื้นที่หน้างานและงบประมาณคร่าวๆ ได้ไหมคะ", t: "09:20", job: "L-2611-004" },
  { role: "cust", text: "สงขลาค่ะ งบประมาณ 3-4 แสน อยากได้กระเบื้องสีเทา กลัวหลังคารั่วซ้ำอีก", t: "09:31", job: "L-2611-004" },
  { sys: "เปิด Opp OP-2611-0103 · ส่งใบเสนอราคา ฿355,000", t: "19 พ.ย. 14:05", job: "OP-2611-0103" },
  { sys: "รับมัดจำ ฿106,500 แล้ว · ล็อกคิวสำรวจ 2 ธ.ค. 10:00", t: "22 พ.ย. 16:40", job: "OP-2611-0103" },
  { role: "cust", img: true, text: "รูปหน้างาน (3 รูป)", t: "10:05", job: "OP-2611-0103" },
  { role: "cust", text: "ช่วยเพิ่มโรงจอดรถด้วยนะคะ แล้วบ่ายวันที่ 2 ธ.ค. ก็ว่างค่ะ", t: "10:12", job: "OP-2611-0103" },
];
const QUICK = ["ขอบคุณที่ติดต่อค่ะ", "ขออนุญาตทวนความต้องการนะคะ", "ส่งใบเสนอราคาให้แล้วนะคะ", "นัดสำรวจวันที่ ... สะดวกไหมคะ"];

/* ---------------- ส่วนประกอบ ---------------- */
function JobChip({ id, on }: { id: string; on?: boolean }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", on ? "bg-indigo-600 text-white" : id.startsWith("L-") ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700")}>{id}</span>;
}
function Bubble({ m }: { m: Msg }) {
  const mine = m.role === "se";
  return (
    <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && <Avatar name={m.role === "team" ? (m.who ?? "ทีม") : "ช"} size={30} />}
      <div className={cn("max-w-[72%]", mine && "text-right")}>
        {mine && m.who && <div className="mb-0.5 text-[10.5px] text-slate-400">{m.who}</div>}
        <div className={cn("rounded-2xl px-3.5 py-2 text-left text-[12.5px] leading-relaxed", mine ? cn(LINE, "rounded-tr-sm") : "rounded-tl-sm bg-white text-slate-800 shadow-sm")}>
          {m.img && <div className="mb-2 grid h-16 w-40 place-items-center rounded-xl bg-slate-200 text-slate-400"><Icon name="image" style={{ fontSize: 28 }} /></div>}
          {m.text}
        </div>
        {m.img && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-indigo-700 shadow-sm"><Icon name="add_photo_alternate" style={{ fontSize: 14 }} />ใช้เป็นรูปหน้างานใน Opp</span>}
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400" style={{ justifyContent: mine ? "flex-end" : "flex-start" }}>{m.t}{m.job && <JobChip id={m.job} />}</div>
      </div>
    </div>
  );
}
function Sys({ text, t, job }: { text: string; t: string; job?: string }) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex max-w-[85%] items-center gap-1.5 rounded-full bg-slate-200/70 px-3 py-1 text-[11px] text-slate-600">
        <Icon name="bolt" style={{ fontSize: 14 }} />{text}<span className="text-slate-400">· {t}</span>{job && <JobChip id={job} />}
      </div>
    </div>
  );
}
function RoomItem({ r, on }: { r: (typeof ROOMS)[number]; on?: boolean }) {
  return (
    <div className={cn("flex gap-2.5 border-b border-slate-100 px-3 py-2.5", on ? "bg-indigo-50/80" : "hover:bg-slate-50")}>
      <Avatar name={r.name.replace("คุณ", "")} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1"><span className="truncate text-[12.5px] font-bold text-slate-900">{r.name}</span><span className="ml-auto shrink-0 text-[10px] text-slate-400">{r.t}</span></div>
        <div className="truncate text-[11.5px] text-slate-500">{r.last}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {r.jobs.map((j) => <JobChip key={j} id={j} />)}
          {"tag" in r && r.tag && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{r.tag}</span>}
          {"warn" in r && r.warn && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">{r.warn}</span>}
          {r.unread > 0 && <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{r.unread}</span>}
        </div>
      </div>
    </div>
  );
}
function ContextPanel() {
  return (
    <div className="space-y-3 overflow-y-auto p-3">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-3">
        <div className="flex items-center gap-1.5"><JobChip id="OP-2611-0103" on /><span className="text-[11px] text-slate-500">สงขลา · มุงหลังคา + ทรัส</span></div>
        <div className="mt-2 text-[12px] font-bold text-slate-900">ขั้นต่อไป: สำรวจหน้างาน</div>
        <div className="text-[11px] text-slate-500">ทีมสำรวจ KIM · นัด 2 ธ.ค. 10:00 (อีก 8 วัน)</div>
        <div className="mt-2 flex gap-0.5">{[1, 1, 1, 0, 0, 0, 0, 0, 0, 0].map((d, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", d ? "bg-emerald-500" : i === 3 ? "bg-indigo-500" : "bg-slate-200")} />)}</div>
        <div className="mt-1 text-[10.5px] text-slate-400">ขั้นที่ 4 จาก 10</div>
      </div>
      <div className={cn(glass, "p-3")}>
        <div className="mb-1.5 text-[11.5px] font-bold text-slate-800">ความสนใจ</div>
        <div className="flex flex-wrap gap-1"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">เปลี่ยนหลังคา</span><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">โครงทรัส</span><span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10.5px] font-semibold text-fuchsia-700">กระเบื้อง Excella</span></div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-slate-50 p-2"><div className="text-[13px] font-bold text-slate-900">฿355,000</div><div className="text-[10px] text-slate-500">ใบเสนอราคา</div></div><div className="rounded-xl bg-slate-50 p-2"><div className="text-[13px] font-bold text-emerald-700">฿106,500</div><div className="text-[10px] text-slate-500">มัดจำแล้ว</div></div></div>
      </div>
      <div className={cn(glass, "p-3")}>
        <div className="mb-1.5 text-[11.5px] font-bold text-slate-800">คนในห้องนี้</div>
        {[["ฝน", "ทีมขาย (เจ้าของงาน)", "bg-indigo-100 text-indigo-700", "ห้องลูกค้า"], ["สมชาย", "ทีมสำรวจ KIM", "bg-cyan-100 text-cyan-800", "ภายใน"]].map(([n, r, c, w]) => (
          <div key={n} className="flex items-center gap-2 py-1"><Avatar name={n} size={26} /><div className="min-w-0 flex-1"><div className="text-[11.5px] font-semibold text-slate-800">{n}</div><div className={cn("inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold", c)}>{r}</div></div><span className="text-[10px] text-slate-400">{w}</span></div>
        ))}
        <span className={cn(btnGhost, "mt-2 w-full !py-1.5 !text-[11.5px]")}><Icon name="person_add" style={{ fontSize: 16 }} />เชิญทีมเข้าห้อง</span>
      </div>
      <div className="flex gap-2"><span className={cn(btnGhost, "flex-1 !px-2 !py-1.5 !text-[11.5px]")}>เปิดหน้า Opp</span><span className={cn(btnGhost, "flex-1 !px-2 !py-1.5 !text-[11.5px]")}>ดู Account</span></div>
    </div>
  );
}

/* ---------------- 1) หน้าแชท 3 ช่อง ---------------- */
function ChatBody({ internal }: { internal?: boolean }) {
  return (
    <div className={cn(glass, "grid h-[900px] overflow-hidden lg:grid-cols-[270px_1fr_290px]")}>
      <div className="flex min-h-0 flex-col border-r border-slate-100 bg-white/70">
        <div className="border-b border-slate-100 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-slate-900"><span className={cn("grid h-6 w-6 place-items-center rounded-md", LINE)}><Icon name="chat" style={{ fontSize: 15 }} /></span>แชทลูกค้า (LINE OA)</div>
          <div className="flex gap-1.5">{["ทั้งหมด 5", "ยังไม่อ่าน 3", "รอตอบ 1"].map((c, i) => <span key={c} className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-semibold", i === 0 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}>{c}</span>)}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{ROOMS.map((r, i) => <RoomItem key={r.name} r={r} on={i === 0} />)}</div>
      </div>

      <div className={cn("flex min-h-0 flex-col", internal ? "bg-amber-50/60" : "bg-[#e9edf5]")}>
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2.5">
          <Avatar name="ชนิดา" size={34} />
          <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold text-slate-900">คุณชนิดา วงศ์ใหญ่</div><div className="text-[11px] text-slate-500"><span className="font-semibold text-[#06c755]">LINE</span> · 087-555-0103 · SF-5550103</div></div>
          <span className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 px-3 py-1.5 text-[11.5px] font-bold text-white"><Icon name="auto_awesome" style={{ fontSize: 15 }} />น้องเลขาสรุปแชท</span>
        </div>
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white/70 px-4 py-2">
          <span className="text-[11px] text-slate-400">ดูของงาน</span>
          <JobChip id="ทั้งหมด" /><JobChip id="L-2611-004" /><JobChip id="OP-2611-0103" on />
          <div className="ml-auto flex rounded-xl bg-slate-100 p-0.5 text-[11.5px] font-semibold">
            <span className={cn("rounded-lg px-3 py-1", !internal ? "bg-white text-emerald-700 shadow" : "text-slate-500")}>คุยกับลูกค้า</span>
            <span className={cn("rounded-lg px-3 py-1", internal ? "bg-amber-400 text-amber-950 shadow" : "text-slate-500")}>โน้ตภายใน 2</span>
          </div>
        </div>
        {internal && <div className="flex items-center gap-1.5 bg-amber-100 px-4 py-1.5 text-[11.5px] font-semibold text-amber-900"><Icon name="visibility_off" style={{ fontSize: 15 }} />ลูกค้าไม่เห็นข้อความในแท็บนี้ · เฉพาะทีมที่ถูกเชิญ</div>}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {internal ? (
            <>
              <Sys text="ทีมสำรวจ (สมชาย) เข้าร่วมโน้ตภายใน" t="24 พ.ย. 10:20" job="OP-2611-0103" />
              <div className="flex justify-start gap-2"><Avatar name="ฝน" size={30} /><div className="max-w-[72%]"><div className="mb-0.5 text-[10.5px] text-slate-400">ฝน · ทีมขาย</div><div className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-[12.5px] shadow-sm"><b className="text-cyan-700">@สมชาย</b> ลูกค้าขอเพิ่มโรงจอดรถ ช่วยวัดพื้นที่เพิ่มตอนสำรวจด้วยนะคะ ลูกค้าเป็นห่วงเรื่องหลังคารั่วซ้ำ</div></div></div>
              <div className="flex justify-end gap-2"><div className="max-w-[72%] text-right"><div className="mb-0.5 text-[10.5px] text-slate-400">สมชาย · ทีมสำรวจ KIM</div><div className="rounded-2xl rounded-tr-sm bg-cyan-600 px-3.5 py-2 text-left text-[12.5px] text-white">รับทราบครับ ขอรูปแปลนที่ลูกค้าส่งมาด้วย จะเตรียมอุปกรณ์วัดรอยรั่วไปด้วย</div></div></div>
            </>
          ) : (
            MSGS.map((m, i) => ("sys" in m ? <Sys key={i} text={m.sys} t={m.t} job={m.job} /> : <Bubble key={i} m={m} />))
          )}
        </div>
        <div className="border-t border-slate-200 bg-white/90 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">{QUICK.map((q) => <span key={q} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">{q}</span>)}</div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><Icon name="attach_file" style={{ fontSize: 19 }} /></span>
            <div className={cn("flex-1 rounded-full border px-4 py-2 text-[12.5px] text-slate-400", internal ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white")}>{internal ? "พิมพ์โน้ตภายใน ใช้ @ เพื่อเรียกคนในทีม" : "พิมพ์ข้อความถึงลูกค้า"}</div>
            <span className={cn("hidden items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-semibold text-slate-600 md:inline-flex")}><Icon name="view_timeline" style={{ fontSize: 16 }} />ส่งการ์ดสถานะงาน</span>
            <span className={cn("grid h-9 w-9 place-items-center rounded-full text-white", internal ? "bg-amber-500" : "bg-[#06c755]")}><Icon name="send" style={{ fontSize: 18 }} /></span>
          </div>
        </div>
      </div>
      <div className="hidden min-h-0 border-l border-slate-100 bg-white/70 lg:block"><ContextPanel /></div>
    </div>
  );
}

/* ---------------- 2) น้องเลขาสรุปแชท ---------------- */
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40"><ChatBody /></div>
      <div className="absolute inset-0 grid place-items-start justify-items-center bg-slate-900/10 pt-6">{children}</div>
    </div>
  );
}
function SummaryDialog() {
  const rows = [
    { icon: "sell", head: "ความต้องการที่พูดถึง", items: [["กระเบื้องสีเทา (Excella)", "เพิ่มในความสนใจ"], ["เพิ่มโรงจอดรถ", "เพิ่มในความสนใจ"]] },
    { icon: "event", head: "วันนัด", items: [["สะดวกบ่ายวันที่ 2 ธ.ค. (ตรงกับนัดสำรวจ 10:00)", "ตั้งหมายเหตุในใบนัดสำรวจ"]] },
    { icon: "payments", head: "งบประมาณ", items: [["3-4 แสน", "บันทึกในประวัติการติดต่อ"]] },
    { icon: "psychology_alt", head: "ข้อกังวลของลูกค้า", items: [["กลัวหลังคารั่วซ้ำ", "บันทึกในประวัติ + แจ้งทีมสำรวจ"]] },
    { icon: "handshake", head: "สิ่งที่ทีมขายรับปากไว้", items: [["จะแจ้งทีมสำรวจเรื่องโรงจอดรถ", "สร้างงานติดตาม"]] },
  ];
  return (
    <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white"><Icon name="auto_awesome" /></span>น้องเลขาสรุปแชท<span className="ml-1 text-[11px] font-normal text-slate-400">OP-2611-0103 · 18 พ.ย. ถึงวันนี้ · 9 ข้อความ</span></div>
      <p className="mt-2 text-[12px] text-slate-500">ติ๊กรายการที่ถูกต้อง แล้วกดเติมเข้างาน ระบบไม่เติมเองจนกว่าทีมขายยืนยัน</p>
      <div className="mt-3 max-h-[440px] space-y-3 overflow-y-auto pr-1">
        {rows.map((r) => (
          <div key={r.head}>
            <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700"><Icon name={r.icon} style={{ fontSize: 16 }} />{r.head}</div>
            {r.items.map(([t, dest]) => (
              <label key={t} className="mb-1 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-[12.5px] text-slate-800">
                <span className="grid h-4 w-4 place-items-center rounded border border-indigo-500 bg-indigo-600 text-white"><Icon name="check" style={{ fontSize: 12 }} /></span>
                <span className="flex-1">{t}</span><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">→ {dest}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2"><span className="mr-auto text-[11px] text-slate-400">เลือก 6 จาก 6 รายการ</span><span className={btnGhost}>ยกเลิก</span><span className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />เติมเข้า Opp ที่เลือก</span></div>
    </div>
  );
}

/* ---------------- 3) เชิญทีมเข้าห้อง ---------------- */
function InviteDialog() {
  const people = [
    { n: "สมชาย", r: "ทีมสำรวจ KIM", c: "bg-cyan-100 text-cyan-800", hint: "แนะนำ: ถึงขั้นสำรวจแล้ว", on: true },
    { n: "ประเสริฐ", r: "ทีมติดตั้ง KIM", c: "bg-cyan-100 text-cyan-800" },
    { n: "วิไล", r: "SCM เตรียมสินค้า", c: "bg-amber-100 text-amber-800" },
    { n: "อิ้งค์", r: "ห้องแบบ", c: "bg-fuchsia-100 text-fuchsia-800" },
    { n: "โค้ชเนม", r: "โค้ชของร้าน", c: "bg-emerald-100 text-emerald-800" },
  ];
  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-indigo-700"><Icon name="person_add" /></span>เชิญทีมเข้าห้อง</div>
      <div className="mt-3 space-y-1.5">
        {people.map((p) => (
          <div key={p.n} className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2", p.on ? "border-indigo-300 bg-indigo-50/70" : "border-slate-200")}>
            <Avatar name={p.n} size={30} /><div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-slate-800">{p.n}</div><span className={cn("inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold", p.c)}>{p.r}</span>{p.hint && <span className="ml-1.5 text-[10.5px] font-semibold text-indigo-600">{p.hint}</span>}</div>
            <span className={cn("grid h-5 w-5 place-items-center rounded border", p.on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300")}>{p.on && <Icon name="check" style={{ fontSize: 14 }} />}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11.5px] font-bold text-slate-700">เข้าห้องแบบไหน</div>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3"><div className="flex items-center gap-1 text-[12px] font-bold text-amber-900"><Icon name="visibility_off" style={{ fontSize: 16 }} />โน้ตภายใน</div><div className="mt-0.5 text-[11px] text-amber-800">ลูกค้าไม่เห็น คุยกับทีมขายเท่านั้น (ค่าเริ่มต้น)</div></div>
        <div className="rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-1 text-[12px] font-bold text-slate-700"><Icon name="forum" style={{ fontSize: 16 }} />ห้องลูกค้า</div><div className="mt-0.5 text-[11px] text-slate-500">ลูกค้าเห็นชื่อและข้อความ ต้องทีมขายอนุญาต</div></div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-[11.5px] text-sky-800"><Icon name="info" style={{ fontSize: 16 }} />เมื่อขั้นตอนนั้นเสร็จ ระบบถามว่าจะให้ทีมออกจากห้องไหม ประวัติข้อความยังอยู่ครบ</p>
      <div className="mt-4 flex justify-end gap-2"><span className={btnGhost}>ยกเลิก</span><span className={btnPrimary}>เชิญเข้าโน้ตภายใน</span></div>
    </div>
  );
}

/* ---------------- 4) Account ลูกค้า ---------------- */
function AccountBody() {
  const tabs = ["ภาพรวม", "งาน (2)", "แชท", "รับประกันและสิทธิ์"];
  return (
    <div className="space-y-4">
      <div className={cn(glass, "flex flex-wrap items-center gap-4 p-4")}>
        <Avatar name="ศิริพร" size={56} />
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-bold text-slate-900">คุณศิริพร จันทร์เพ็ญ</div>
          <div className="text-[12px] text-slate-500">086-555-0111 · ระยอง · รหัส SCG Family SF-5550111</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><span className="inline-flex items-center gap-1 rounded-full bg-[#06c755]/10 px-2 py-0.5 text-[10.5px] font-bold text-[#06a047]"><Icon name="chat" style={{ fontSize: 13 }} />เชื่อม LINE OA แล้ว</span><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">ลูกค้าเดิม · ซื้อ 1 ครั้ง</span><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700">สิทธิ์ใกล้หมด 1</span></div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">{[["฿129,000", "ยอดปิดขายสะสม"], ["4.7", "CSAT เฉลี่ย"], ["2", "Opp"]].map(([a, b]) => <div key={b} className="rounded-xl bg-white/70 px-3 py-2"><div className="text-[15px] font-bold text-slate-900">{a}</div><div className="text-[10.5px] text-slate-500">{b}</div></div>)}</div>
      </div>
      <div className="flex gap-1.5">{tabs.map((t, i) => <span key={t} className={cn("rounded-xl px-4 py-2 text-[12.5px] font-semibold", i === 3 ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "bg-white/70 text-slate-600")}>{t}</span>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(glass, "p-4")}>
          <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="verified_user" style={{ fontSize: 18 }} />การรับประกัน</h3>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
            <div className="flex items-center gap-2"><span className="text-[13px] font-bold text-slate-900">มุงหลังคาอย่างเดียว · Complete Roof</span><span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10.5px] font-bold text-white">อยู่ในประกัน</span></div>
            <dl className="mt-2 grid grid-cols-2 gap-y-1.5 text-[12px]"><dt className="text-slate-500">ส่งมอบงาน</dt><dd className="text-right font-semibold">10 พ.ย. 2569</dd><dt className="text-slate-500">ระยะประกัน</dt><dd className="text-right font-semibold">5 ปี</dd><dt className="text-slate-500">หมดอายุ</dt><dd className="text-right font-semibold">10 พ.ย. 2574</dd><dt className="text-slate-500">ใบรับประกัน</dt><dd className="text-right font-semibold text-indigo-700">ดูไฟล์</dd></dl>
          </div>
          <div className="mt-3 flex gap-2"><span className={btnGhost}><Icon name="build" style={{ fontSize: 17 }} />แจ้งปัญหารับประกัน</span><span className={btnGhost}><Icon name="chat" style={{ fontSize: 17 }} />เปิดแชท</span></div>
        </div>
        <div className="space-y-4">
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="redeem" style={{ fontSize: 18 }} />สิทธิพิเศษ</h3>
            {[["ส่วนลดล้างแอร์ 15%", "หมดอายุ 7 ก.พ. 70", "ใช้แล้ว", "bg-sky-50 text-sky-700"], ["สำรวจต่อเติมโรงจอดรถ ราคาพิเศษ", "หมดอายุ 9 ม.ค. 70", "ใกล้หมด 46 วัน", "bg-amber-50 text-amber-700"], ["สำรวจรางน้ำฝน ราคาพิเศษ", "หมดอายุ 9 ม.ค. 70", "ใช้ได้", "bg-emerald-50 text-emerald-700"]].map(([n, e, s, c]) => <div key={n} className="mb-1.5 flex items-center gap-2 rounded-xl border border-white/70 bg-white/70 p-2.5 last:mb-0"><div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-slate-800">{n}</div><div className="text-[10.5px] text-slate-400">{e}</div></div><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", c)}>{s}</span></div>)}
          </div>
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="forum" style={{ fontSize: 18 }} />แชทล่าสุด</h3>
            <div className="space-y-1.5 text-[12px]"><div className="rounded-xl bg-white px-3 py-2 text-slate-700 shadow-sm">ขอบคุณมากค่ะ งานเรียบร้อยดี <span className="text-[10px] text-slate-400">20 พ.ย.</span></div><div className={cn("ml-auto w-fit rounded-xl px-3 py-2", LINE)}>ยินดีค่ะ มีอะไรให้ช่วยแจ้งได้เลยนะคะ <span className="text-[10px] text-white/70">20 พ.ย.</span></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 5) แชทของงาน ในหน้า Opp ---------------- */
function JobChatBody() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div><h1 className="text-[22px] font-bold tracking-tight text-slate-900">คุณชนิดา วงศ์ใหญ่</h1><p className="text-[12.5px] text-slate-500">OP-2611-0103 · สงขลา · มุงหลังคา + ทรัส · Housing Expert</p></div>
        <span className={cn(btnPrimary, "ml-auto")}><Icon name="chat" style={{ fontSize: 18 }} />เปิดแชท<span className="ml-1 rounded-full bg-white/25 px-1.5 text-[11px]">2</span></span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(glass, "p-4 lg:col-span-2")}>
          <h3 className="mb-3 text-[13px] font-bold text-slate-900">ขั้นตอนตาม Project Timeline</h3>
          {[["รับแบบ", "เสร็จ 18 พ.ย.", 2], ["เสนอราคาจากแบบ", "เสร็จ 19 พ.ย.", 2], ["ปิดมัดจำ + ล็อกคิวสำรวจ", "เสร็จ 22 พ.ย.", 2], ["สำรวจหน้างาน + รายงานสำรวจ", "แผน 2 ธ.ค. · KIM", 1]].map(([t, d, s]) => (
            <div key={t as string} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0"><span className={cn("grid h-7 w-7 place-items-center rounded-full", s === 2 ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white ring-4 ring-indigo-200")}><Icon name={s === 2 ? "check" : "pin_drop"} style={{ fontSize: 16 }} /></span><div><div className="text-[12.5px] font-semibold text-slate-900">{t}</div><div className="text-[11px] text-slate-500">{d}</div></div></div>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#e9edf5] shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 text-[12.5px] font-bold text-slate-900"><span className={cn("grid h-6 w-6 place-items-center rounded-md", LINE)}><Icon name="chat" style={{ fontSize: 14 }} /></span>แชทของงานนี้<JobChip id="OP-2611-0103" on /></div>
          <div className="space-y-2.5 p-3">
            <Sys text="รับมัดจำ ฿106,500 แล้ว" t="22 พ.ย." />
            <Bubble m={{ role: "cust", text: "ช่วยเพิ่มโรงจอดรถด้วยนะคะ แล้วบ่ายวันที่ 2 ธ.ค. ก็ว่างค่ะ", t: "10:12" }} />
            <Bubble m={{ role: "se", who: "ฝน", text: "รับทราบค่ะ จะแจ้งทีมสำรวจให้นะคะ", t: "10:15" }} />
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2 text-[11.5px]"><span className="text-slate-400">แสดงเฉพาะข้อความของงานนี้</span><span className="font-bold text-indigo-700">เปิดแชทเต็ม →</span></div>
        </div>
      </div>
    </div>
  );
}

export function LineChatConceptScreen() {
  const v = useSearchParams().get("v") ?? "chat";
  return (
    <Shell>
      {v === "internal" ? <ChatBody internal /> : v === "summary" ? <Overlay><SummaryDialog /></Overlay> : v === "invite" ? <Overlay><InviteDialog /></Overlay> : v === "account" ? <AccountBody /> : v === "jobchat" ? <JobChatBody /> : <ChatBody />}
    </Shell>
  );
}
