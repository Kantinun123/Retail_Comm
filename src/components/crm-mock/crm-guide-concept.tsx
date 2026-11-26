"use client";
/* ภาพร่างแนวคิด "ตัวช่วยแนะนำขั้นต่อไป" สำหรับพนักงานขายใหม่ (เปิด/ปิดได้) ข้อมูลสมมติ ยังไม่ใช่หน้าที่ใช้งานจริง
   เลือกมุมมองด้วย ?v=lead | leadoff | opp | form | warn | script */
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { Shell } from "./crm-lead-concept";
import { btnGhost, btnPrimary, glass, inputCls, labelCls } from "./crm-ui";

/* ---------------- ส่วนประกอบร่วม ---------------- */
function GuideToggle({ on }: { on: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
      <Icon name="school" style={{ fontSize: 17 }} className={on ? "text-indigo-600" : "text-slate-400"} />
      ตัวช่วยแนะนำ
      <span className={cn("relative h-5 w-9 rounded-full transition", on ? "bg-indigo-600" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
      <span className={on ? "text-indigo-700" : "text-slate-400"}>{on ? "เปิด" : "ปิด"}</span>
    </div>
  );
}

function Head({ title, sub, on }: { title: string; sub: string; on: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-[12.5px] text-slate-500">{sub}</p>
      </div>
      <GuideToggle on={on} />
    </div>
  );
}

const STEPS = ["บันทึกข้อมูล", "ติดต่อครั้งแรก", "ทวนความต้องการ", "สกรีน", "เลือกเส้นทาง"];
function Stepper({ at }: { at: number }) {
  return (
    <div className={cn(glass, "mb-4 flex items-start p-4")}>
      {STEPS.map((s, i) => (
        <div key={s} className="relative flex flex-1 flex-col items-center text-center">
          {i > 0 && <span className={cn("absolute right-1/2 top-3.5 h-0.5 w-full", i <= at ? "bg-emerald-400" : "bg-slate-200")} />}
          <span className={cn("relative z-10 grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold", i < at ? "bg-emerald-500 text-white" : i === at ? "bg-indigo-600 text-white ring-4 ring-indigo-200" : "bg-slate-200 text-slate-500")}>
            {i < at ? <Icon name="check" style={{ fontSize: 16 }} /> : i + 1}
          </span>
          <span className={cn("mt-1.5 text-[11px] font-semibold", i === at ? "text-indigo-700" : i < at ? "text-slate-600" : "text-slate-400")}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function NextBanner({ stepNo, total, title, why, tips, cta, extra }: { stepNo: number; total: number; title: string; why: string; tips: string[]; cta: string; extra?: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-4 shadow-[0_8px_24px_-12px_rgba(79,70,229,.35)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white"><Icon name="flag" style={{ fontSize: 14 }} />ขั้นต่อไป · {stepNo} จาก {total}</span>
        {extra && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">{extra}</span>}
        <button className="ml-auto text-[11.5px] font-semibold text-slate-400 underline">ข้ามขั้นนี้</button>
      </div>
      <h2 className="mt-2 text-[17px] font-bold text-slate-900">{title}</h2>
      <p className="text-[12.5px] text-slate-500">{why}</p>
      <ul className="mt-3 grid gap-1.5 md:grid-cols-3">
        {tips.map((t, i) => (
          <li key={t} className="flex gap-2 rounded-xl bg-white/80 px-3 py-2 text-[12px] text-slate-700"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{i + 1}</span>{t}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={btnPrimary}><Icon name="arrow_forward" style={{ fontSize: 18 }} />{cta}</span>
        <span className={btnGhost}><Icon name="format_quote" style={{ fontSize: 18 }} />ดูคำพูดตัวอย่าง</span>
      </div>
    </div>
  );
}

function Chip({ kind, children }: { kind: "service" | "product"; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", kind === "service" ? "bg-indigo-50 text-indigo-700" : "bg-fuchsia-50 text-fuchsia-700")}><Icon name={kind === "service" ? "handyman" : "inventory_2"} style={{ fontSize: 13 }} />{children}</span>;
}
const Tip = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-indigo-600"><Icon name="lightbulb" style={{ fontSize: 14 }} />{children}</p>
);
const Bubble = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("absolute z-10 w-60 rounded-xl bg-slate-900 px-3 py-2 text-[11.5px] leading-snug text-white shadow-xl", className)}>
    {children}<span className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 bg-slate-900" />
  </div>
);

/* ---------------- 1) หน้า Lead (ตัวช่วยเปิด / ปิด) ---------------- */
function LeadView({ on }: { on: boolean }) {
  return (
    <>
      <Head title="คุณวิภา ศรีสุข" sub="L-2611-001 · สงขลา · Home Online · ติดต่อครั้งแรกแล้ว 1 ครั้ง" on={on} />
      {on && <Stepper at={2} />}
      {on && <NextBanner stepNo={3} total={5} title="ทวนความต้องการกับลูกค้า" why="ลูกค้าเลือกรายการเองจากหน้าเว็บ ต้องทวนให้ตรงกับที่ลูกค้าต้องการจริงก่อนไปขั้นต่อไป" tips={["ถามว่าสนใจรายการด้านล่างถูกต้องไหม", "เพิ่มหรือเปลี่ยนรายการได้ตามที่คุย", "กดยืนยัน ระบบจะแนะนำว่าไปทางไหนต่อ"]} cta="ไปที่ความสนใจของลูกค้า" />}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className={cn(glass, "relative p-4", on && "ring-2 ring-indigo-400 ring-offset-2")}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-bold text-slate-900">ความสนใจของลูกค้า</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-semibold text-sky-700"><Icon name="language" style={{ fontSize: 12 }} />ลูกค้าเลือกเอง (เว็บ)</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">ยังไม่ได้ทวนความต้องการ</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5"><Chip kind="service">ติดตั้งหลังคาใหม่ (Roof Install)</Chip><Chip kind="service">โครงทรัส</Chip></div>
            <div className="mt-3 flex gap-2"><span className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />ยืนยันตามที่ลูกค้าเลือก</span><span className={btnGhost}><Icon name="edit" style={{ fontSize: 18 }} />แก้ไขรายการ</span></div>
            {on && <Bubble className="left-4 top-[calc(100%+10px)]">ทำตรงนี้ก่อน: ถามลูกค้าทีละรายการ แล้วกดยืนยัน หรือแก้ไขถ้าไม่ตรง</Bubble>}
          </div>
          <div className={cn(glass, "mt-14 p-4")}>
            <h3 className="mb-2 text-[13px] font-bold text-slate-900">สกรีน Lead</h3>
            {["งบประมาณตรงกับที่รับงาน", "หน้างานอยู่ในพื้นที่บริการ", "ลูกค้าพร้อมให้ทีมเข้าสำรวจ/ออกแบบ"].map((t) => <label key={t} className="flex items-center gap-2.5 py-1 text-[12.5px] text-slate-700"><span className="h-4 w-4 rounded border border-slate-300 bg-white" />{t}</label>)}
            {on && <Tip>ติ๊กได้หลังทวนความต้องการเสร็จ ผ่านครบ 3 ข้อแล้วระบบจะแนะนำให้เปิด Opp</Tip>}
          </div>
        </div>
        <div className={cn(glass, "p-4")}>
          <h3 className="mb-2 text-[13px] font-bold text-slate-900">บันทึกการติดต่อ <span className="text-[11px] font-normal text-slate-400">1 ครั้ง</span></h3>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white/80 p-3">
            <div className="grid grid-cols-2 gap-2"><div><span className={labelCls}>ช่องทางที่ติดต่อ</span><div className={cn(inputCls, "text-slate-600")}>โทร</div></div><div><span className={labelCls}>ผลการติดต่อ</span><div className={cn(inputCls, "text-slate-600")}>คุยได้</div></div></div>
            <div><span className={labelCls}>สรุปสิ่งที่คุย</span><div className={cn(inputCls, "h-16 text-slate-400")}>เช่น ลูกค้าอยากเปลี่ยนกระเบื้องเป็นสีเทา</div></div>
            {on && <Tip>เขียนให้เพื่อนร่วมทีมอ่านแล้วรู้เรื่อง: ลูกค้าต้องการอะไร ติดอะไรอยู่ และจะทำอะไรต่อ</Tip>}
            <div><span className={labelCls}>นัดติดตามครั้งต่อไป (ถ้ามี)</span><div className={cn(inputCls, "text-slate-400")}>dd/mm/yyyy --:--</div></div>
            {on && <Tip>ลูกค้าบอกว่า &ldquo;ขอคิดก่อน&rdquo; ให้ตั้งวันนัดติดตามเสมอ น้องเลขาจะเตือนให้</Tip>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- 2) หน้า Opp ---------------- */
function OppView() {
  const steps = [["รับแบบ", "เสร็จ 18 พ.ย.", 2], ["เสนอราคาจากแบบ", "เสร็จ 21 พ.ย.", 2], ["ปิดมัดจำ + ล็อกคิวสำรวจ", "ครบกำหนดวันนี้", 1], ["สำรวจหน้างาน", "แผน 2 ธ.ค.", 0], ["เสนอราคาหลังสำรวจ", "แผน 4 ธ.ค.", 0]] as const;
  return (
    <>
      <Head title="คุณสมศักดิ์ ใจเย็น" sub="OP-2611-0103 · สงขลา · มุงหลังคา + ทรัส · Housing Expert" on />
      <NextBanner stepNo={3} total={10} title="ปิดมัดจำ + ล็อกคิวสำรวจ" why="ครบกำหนดวันนี้ ยังไม่ได้รับมัดจำจากลูกค้า" extra="ครบกำหนดวันนี้" tips={["แจ้งลูกค้าโอนมัดจำ 30% = ฿106,500", "ล็อกวันนัดสำรวจกับลูกค้า (ทีม KIM ว่างวันที่ 2 ธ.ค.)", "กดบันทึก ระบบส่งข้อมูลให้ KIM และ SCM เอง"]} cta="รับมัดจำ + ล็อกคิวสำรวจ" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(glass, "p-4 lg:col-span-2")}>
          <h3 className="mb-3 text-[13px] font-bold text-slate-900">ขั้นตอนตาม Project Timeline</h3>
          <ol>
            {steps.map(([t, d, st], i) => (
              <li key={t} className="relative flex gap-3 pb-4 last:pb-0">
                {i < steps.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-18px)] w-0.5 bg-slate-200" />}
                <span className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full", st === 2 ? "bg-emerald-500 text-white" : st === 1 ? "bg-indigo-600 text-white ring-4 ring-indigo-200" : "bg-slate-100 text-slate-400")}><Icon name={st === 2 ? "check" : st === 1 ? "payments" : "lock"} style={{ fontSize: 17 }} /></span>
                <div className="pt-0.5"><div className={cn("text-[13px] font-semibold", st === 0 ? "text-slate-400" : "text-slate-900")}>{t}</div><div className="text-[11.5px] text-slate-500">{d}</div>{st === 1 && <Tip>ขั้นนี้คุณเป็นคนทำ ทำเสร็จแล้วขั้นถัดไปจะเป็นของทีม KIM</Tip>}</div>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="checklist" style={{ fontSize: 18 }} />เช็คก่อนกดบันทึก</h3>
            {["ลูกค้าโอนมัดจำแล้ว (มีสลิป)", "ยืนยันวันนัดสำรวจกับลูกค้าแล้ว", "ตรวจใบเปิดงานครบ ไม่มีช่องว่าง"].map((t, i) => <label key={t} className="flex items-center gap-2.5 py-1 text-[12.5px] text-slate-700"><span className={cn("grid h-4 w-4 place-items-center rounded border", i < 2 ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white")}>{i < 2 && <Icon name="check" style={{ fontSize: 12 }} />}</span>{t}</label>)}
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-[12px] leading-relaxed text-amber-900"><b>ใบเปิดงานยังขาด 2 ช่อง</b> (ระยะ max truss, ไฟล์แบบแปลน) เติมก่อนส่งให้ KIM เพื่อไม่ให้ทีมสำรวจต้องโทรถามซ้ำ</div>
        </div>
      </div>
    </>
  );
}

/* ---------------- 3) ฟอร์มเพิ่ม Lead มีคำแนะนำ ---------------- */
function F({ label, ph, hint, req }: { label: string; ph: string; hint?: string; req?: boolean }) {
  return (
    <div><span className={labelCls}>{label}{req && <span className="text-rose-500"> *</span>}</span><div className={cn(inputCls, "text-slate-400")}>{ph}</div>{hint && <Tip>{hint}</Tip>}</div>
  );
}
function FormView() {
  return (
    <>
      <Head title="เพิ่ม Lead" sub="ลูกค้าเข้าร้านก็ใช้ฟอร์มนี้ เลือกแหล่งที่มา Walk-in" on />
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <F req label="ชื่อลูกค้า" ph="เช่น คุณสมหมาย ใจดี" />
          <F req label="เบอร์โทร" ph="08x-xxx-xxxx" hint="ใช้เบอร์ที่ติดต่อได้จริง ระบบใช้เบอร์เช็คว่าเป็นลูกค้าเดิมหรือเปล่า" />
          <F req label="จังหวัดหน้างาน" ph="สงขลา" hint="ใช้จ่ายงานให้ร้านที่รับพื้นที่นี้ ไม่ใช่จังหวัดที่ลูกค้าอยู่ตอนนี้" />
          <F label="อำเภอหน้างาน (ถ้ามี)" ph="หาดใหญ่" hint="ถ้าใส่ ระบบจะเลือกร้านในอำเภอนั้นก่อน" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <h3 className="mb-2 text-[14px] font-bold text-slate-900">บริการ</h3>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2"><div className={cn(inputCls, "text-slate-400")}>กลุ่มงานบริการ...</div><div className={cn(inputCls, "text-slate-400")}>บริการ...</div><span className="grid h-9 w-9 place-items-center text-rose-400"><Icon name="delete" style={{ fontSize: 19 }} /></span></div>
          <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-emerald-700"><Icon name="add" style={{ fontSize: 17 }} />เพิ่มรายการ</span>
          <Tip>ถามลูกค้าว่า &ldquo;อยากให้ทางเราช่วยเรื่องอะไรบ้าง&rdquo; เลือกได้หลายอย่าง ถ้ามีงานบริการ ระบบจะแนะนำให้เปิด Opp</Tip>
        </div>
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-[12.5px] text-amber-900"><Icon name="warning" style={{ fontSize: 20 }} /><div><b>ยังไม่ได้เลือกความสนใจ</b><div className="text-[12px]">ทีมขายคนถัดไปจะไม่รู้ว่าลูกค้าต้องการอะไร ถ้าลูกค้ายังไม่แน่ใจ ให้ใส่หมายเหตุแทน (บันทึกต่อได้ ไม่บังคับ)</div></div></div>
        <div className="flex justify-end"><span className={btnPrimary}><Icon name="add" style={{ fontSize: 18 }} />เพิ่ม Lead</span></div>
      </div>
    </>
  );
}

/* ---------------- 4) เตือนก่อนข้ามขั้น ---------------- */
function WarnView() {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40"><LeadView on /></div>
      <div className="absolute inset-0 grid place-items-start pt-40">
        <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-700"><Icon name="warning" /></span>ยังไม่ได้ทวนความต้องการ</div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">เปิด Opp ตอนนี้ ใบเปิดงานจะใช้รายการที่ลูกค้าเลือกเองจากเว็บ ถ้าไม่ตรงกับที่ลูกค้าต้องการ ทีมห้องแบบและทีมสำรวจอาจเตรียมงานผิด</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><span className={btnGhost}>เปิด Opp เลย</span><span className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />ไปทวนความต้องการก่อน</span></div>
          <p className="mt-3 text-center text-[11px] text-slate-400">เตือนแบบนี้เฉพาะตอนเปิดตัวช่วยแนะนำ ข้ามได้เสมอ</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 5) คำพูดตัวอย่าง ---------------- */
const SCRIPTS = [
  { icon: "call", when: "โทรครั้งแรก", text: "สวัสดีค่ะ คุณวิภา ติดต่อจากทีม Housing Expert นะคะ ได้รับข้อมูลที่คุณสนใจติดตั้งหลังคาใหม่และโครงทรัสไว้แล้วค่ะ ขออนุญาตสอบถามรายละเอียดเพิ่มเติมสัก 2 นาทีได้ไหมคะ" },
  { icon: "fact_check", when: "ทวนความต้องการ", text: "ขอทวนสิ่งที่คุณสนใจนะคะ ตอนนี้มีติดตั้งหลังคาใหม่ กับโครงทรัส ถูกต้องไหมคะ มีอะไรอยากเพิ่มหรือเปลี่ยนไหม และหน้างานอยู่ที่สงขลาใช่ไหมคะ" },
  { icon: "request_quote", when: "ตามใบเสนอราคา", text: "ติดตามใบเสนอราคาที่ส่งไปเมื่อวันที่ 21 พ.ย. นะคะ ตอนนี้มีข้อสงสัยตรงไหนอยากให้ช่วยอธิบายเพิ่มไหมคะ หรืออยากให้ทีมเข้าไปดูหน้างานอีกครั้งไหมคะ" },
];
function ScriptView() {
  return (
    <>
      <Head title="คำพูดตัวอย่าง" sub="เปิดจากปุ่ม ดูคำพูดตัวอย่าง ในแถบขั้นต่อไป ระบบเติมชื่อลูกค้าและรายการที่สนใจให้เอง" on />
      <div className="mx-auto grid max-w-3xl gap-3">
        {SCRIPTS.map((s, i) => (
          <div key={s.when} className={cn(glass, "p-4", i === 1 && "ring-2 ring-indigo-300")}>
            <div className="mb-2 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-indigo-700"><Icon name={s.icon} style={{ fontSize: 18 }} /></span><span className="text-[13.5px] font-bold text-slate-900">{s.when}</span>{i === 1 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10.5px] font-bold text-white">ตรงกับขั้นนี้</span>}<span className={cn(btnGhost, "ml-auto !px-3 !py-1.5 !text-[12px]")}><Icon name="content_copy" style={{ fontSize: 16 }} />คัดลอก</span></div>
            <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-slate-700">{s.text}</p>
          </div>
        ))}
        <p className="text-center text-[11.5px] text-slate-400">ถ้อยคำเป็นร่างเริ่มต้น หัวหน้าทีมแก้ให้ตรงกับน้ำเสียงของร้านได้</p>
      </div>
    </>
  );
}

export function GuideConceptScreen() {
  const v = useSearchParams().get("v") ?? "lead";
  return (
    <Shell>
      {v === "leadoff" ? <LeadView on={false} /> : v === "opp" ? <OppView /> : v === "form" ? <FormView /> : v === "warn" ? <WarnView /> : v === "script" ? <ScriptView /> : <LeadView on />}
    </Shell>
  );
}
