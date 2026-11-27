"use client";
/* ตัวช่วยแนะนำขั้นต่อไป สำหรับพนักงานขายใหม่ (เปิด/ปิดได้ จำค่าในเบราว์เซอร์) ; แนะนำอย่างเดียว ไม่บังคับ ข้ามได้เสมอ */
import { createContext, useContext, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  PARTY, baht, cleanInterests, currentStep, dateTh, depositOf, instNet, planOf, dtTh, dueLabel, dueOf, interestSummary, isFinished, leadSla, missingOf, slaHoursOf, stepsOf, suggestRoute,
  type Job, type Lead,
} from "./crm-mock-data";
import { btnGhost, btnPrimary, glass } from "./crm-ui";

/* ---------------- สถานะเปิด/ปิด ---------------- */
const KEY = "crm.guide";
const listeners = new Set<() => void>();
export function setGuideOn(v: boolean) {
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ไม่มี storage ก็ใช้ค่าเริ่มต้น */ }
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
};
const snapshot = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
/** ค่าที่ผู้ใช้ตั้งไว้ (ค่าเริ่มต้น = เปิด) */
export const useGuidePref = () => useSyncExternalStore(subscribe, snapshot, () => true);
/** ค่าที่ใช้จริงในหน้านั้น (ผู้ดู/Area/ร้านค้าไม่มีตัวช่วย) */
export const GuideCtx = createContext(false);
export const useGuideOn = () => useContext(GuideCtx);

export function GuideToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-white">
      <Icon name="school" style={{ fontSize: 17 }} className={on ? "text-indigo-600" : "text-slate-400"} />
      ตัวช่วยแนะนำ
      <span className={cn("relative h-5 w-9 rounded-full transition", on ? "bg-indigo-600" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
      <span className={on ? "text-indigo-700" : "text-slate-400"}>{on ? "เปิด" : "ปิด"}</span>
    </button>
  );
}

/** คำแนะนำสั้น ๆ ใต้ช่อง (แสดงเมื่อเปิดตัวช่วย) */
export function Tip({ children }: { children: React.ReactNode }) {
  const on = useGuideOn();
  if (!on) return null;
  return <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-indigo-600"><Icon name="lightbulb" style={{ fontSize: 14 }} />{children}</p>;
}

/* ---------------- คำพูดตัวอย่าง ---------------- */
export interface Script { key: string; icon: string; when: string; text: string }
export function scriptsFor(p: { name: string; items: string; province: string }): Script[] {
  const n = p.name.split(" ")[0] || "คุณลูกค้า";
  const items = p.items || "รายการที่สนใจ";
  return [
    { key: "first", icon: "call", when: "โทรครั้งแรก", text: `สวัสดีค่ะ ${n} ติดต่อจากทีม Housing Expert นะคะ ได้รับข้อมูลที่คุณสนใจ ${items} ไว้แล้วค่ะ ขออนุญาตสอบถามรายละเอียดเพิ่มเติมสัก 2 นาทีได้ไหมคะ` },
    { key: "review", icon: "fact_check", when: "ทวนความต้องการ", text: `ขอทวนสิ่งที่คุณสนใจนะคะ ตอนนี้มี ${items} ถูกต้องไหมคะ มีอะไรอยากเพิ่มหรือเปลี่ยนไหม และหน้างานอยู่ที่${p.province || "จังหวัดที่แจ้งไว้"}ใช่ไหมคะ` },
    { key: "deposit", icon: "payments", when: "ขอรับมัดจำ", text: `${n} คะ ใบเสนอราคาที่ส่งไปเรียบร้อยแล้ว ถ้าสะดวกดำเนินการต่อ รบกวนโอนมัดจำตามที่แจ้งไว้ แล้วส่งสลิปมาให้ทางนี้ได้เลยนะคะ จากนั้นทีมจะนัดวันเข้าสำรวจหน้างานให้ค่ะ` },
    { key: "follow", icon: "request_quote", when: "ตามใบเสนอราคา", text: `ติดตามใบเสนอราคาที่ส่งไปนะคะ ตอนนี้มีข้อสงสัยตรงไหนอยากให้ช่วยอธิบายเพิ่มไหมคะ หรืออยากให้ทีมเข้าไปดูหน้างานอีกครั้งไหมคะ` },
  ];
}

/* ---------------- ส่วนแสดงผล ---------------- */
export const LEAD_STEPS = ["บันทึกข้อมูล", "ติดต่อครั้งแรก", "ทวนความต้องการ", "สกรีน", "เลือกเส้นทาง"];
export function Stepper({ at }: { at: number }) {
  return (
    <div className={cn(glass, "flex items-start p-4")}>
      {LEAD_STEPS.map((s, i) => (
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

export interface BannerData {
  stepNo: number; total: number; title: string; why: string; tips: string[]; cta: string;
  /** id:<element> = เลื่อนไปที่ส่วนนั้น ; หรือชื่อคำสั่ง (qualify / opp) */
  target: string; extra?: string; note?: string; script?: string;
}
export function NextBanner({ b, scripts, onCta, onSkip, toast }: { b: BannerData; scripts: Script[]; onCta: (target: string) => void; onSkip?: () => void; toast: (m: string) => void }) {
  const [showScripts, setShowScripts] = useState(false);
  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-4 shadow-[0_8px_24px_-12px_rgba(79,70,229,.35)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white"><Icon name="flag" style={{ fontSize: 14 }} />ขั้นต่อไป · {b.stepNo} จาก {b.total}</span>
        {b.extra && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">{b.extra}</span>}
        {onSkip && <button onClick={onSkip} className="ml-auto text-[11.5px] font-semibold text-slate-400 underline hover:text-slate-600">ข้ามขั้นนี้</button>}
      </div>
      <h2 className="mt-2 text-[17px] font-bold text-slate-900">{b.title}</h2>
      <p className="text-[12.5px] text-slate-500">{b.why}</p>
      <ul className="mt-3 grid gap-1.5 md:grid-cols-3">
        {b.tips.map((t, i) => (
          <li key={t} className="flex gap-2 rounded-xl bg-white/80 px-3 py-2 text-[12px] text-slate-700"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{i + 1}</span>{t}</li>
        ))}
      </ul>
      {b.note && <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900"><Icon name="warning" style={{ fontSize: 16 }} />{b.note}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onCta(b.target)} className={btnPrimary}><Icon name="arrow_forward" style={{ fontSize: 18 }} />{b.cta}</button>
        <button onClick={() => setShowScripts(!showScripts)} className={btnGhost}><Icon name="format_quote" style={{ fontSize: 18 }} />{showScripts ? "ซ่อนคำพูดตัวอย่าง" : "ดูคำพูดตัวอย่าง"}</button>
      </div>
      {showScripts && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {scripts.map((s) => (
            <div key={s.key} className={cn("rounded-xl border bg-white/90 p-3", s.key === b.script ? "border-indigo-300 ring-2 ring-indigo-200" : "border-slate-200")}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800">
                <Icon name={s.icon} style={{ fontSize: 17 }} />{s.when}
                {s.key === b.script && <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">ตรงกับขั้นนี้</span>}
                <button onClick={() => { void navigator.clipboard?.writeText(s.text); toast("คัดลอกคำพูดแล้ว"); }} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"><Icon name="content_copy" style={{ fontSize: 14 }} />คัดลอก</button>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-600">{s.text}</p>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 md:col-span-2">ถ้อยคำเป็นร่างเริ่มต้น ระบบเติมชื่อลูกค้าและรายการที่สนใจให้เอง หัวหน้าทีมแก้ให้ตรงกับน้ำเสียงของร้านได้</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- ตรรกะขั้นต่อไป: Lead ---------------- */
export function leadGuide(lead: Lead, o: { allOk: boolean; skipped: number[] }): { at: number; banner: BannerData } | null {
  const saved = cleanInterests(lead.interests);
  const route = suggestRoute(saved, lead.buyMode);
  const done = [true, !!lead.firstContactAt || (lead.contacts?.length ?? 0) > 0, !!lead.reviewed, o.allOk || lead.status === "qualified", false];
  const at = done.findIndex((d, i) => !d && !o.skipped.includes(i));
  if (at < 0) return null;
  const base = { stepNo: at + 1, total: LEAD_STEPS.length };
  if (at === 1) {
    const sla = leadSla(lead);
    return { at, banner: { ...base, title: "ติดต่อลูกค้าครั้งแรก", why: `${sla.text} · เป้า ${slaHoursOf(lead.channel)} ชม. ตามช่องทาง ${lead.channel}`, extra: sla.state === "breach" ? "เกิน SLA" : undefined, script: "first", cta: "บันทึกการติดต่อ", target: "id:lead-contact",
      tips: ["โทรหาลูกค้า ถ้าไม่รับสายกด โทรแล้วไม่รับสาย", "ถ้าคุยได้ บันทึกสรุปที่คุยและวันนัดติดตาม", "ติดต่อครั้งแรกนับ SLA ทันทีที่บันทึก"] } };
  }
  if (at === 2) {
    return { at, banner: { ...base, title: saved.length ? "ทวนความต้องการกับลูกค้า" : "เพิ่มความสนใจของลูกค้า", script: "review", cta: "ไปที่ความสนใจของลูกค้า", target: "id:lead-interest",
      why: lead.source === "customer" ? "ลูกค้าเลือกรายการเองจากหน้าเว็บ ต้องทวนให้ตรงกับที่ลูกค้าต้องการจริงก่อนไปขั้นต่อไป" : saved.length ? "ทวนรายการที่คีย์ไว้กับลูกค้าอีกครั้ง ให้ตรงกับที่ลูกค้าต้องการจริง" : "ยังไม่รู้ว่าลูกค้าต้องการอะไร ถามลูกค้าแล้วเลือกรายการสินค้าหรือบริการ",
      tips: ["ถามว่าสนใจรายการด้านล่างถูกต้องไหม", "เพิ่มหรือเปลี่ยนรายการได้ตามที่คุย", "กดยืนยัน ระบบจะแนะนำว่าไปทางไหนต่อ"] } };
  }
  if (at === 3) {
    return { at, banner: { ...base, title: "สกรีน Lead", why: "เช็ค 3 ข้อว่าลูกค้าอยู่ในเงื่อนไขที่ทีมรับงานได้ก่อนเสียเวลาเปิด Opp", cta: "ไปที่สกรีน Lead", target: "id:lead-screen",
      tips: ["ถามงบประมาณและช่วงเวลาที่อยากเริ่ม", "ยืนยันว่าหน้างานอยู่ในพื้นที่บริการ", "ถามว่าพร้อมให้ทีมเข้าสำรวจหรือออกแบบไหม"] } };
  }
  if (route === "product") {
    return { at: 4, banner: { ...base, stepNo: 5, title: "ส่งให้ร้านทำใบเสนอราคา", why: "ลูกค้าสนใจสินค้าอย่างเดียว ไม่ต้องใช้แบบ ส่งให้ร้านที่รับพื้นที่ทำใบเสนอราคาได้เลย", cta: "ไปที่ส่งให้ร้าน", target: "id:lead-dealer",
      tips: ["เลือกร้านที่รับพื้นที่หน้างาน", "กดส่งให้ร้าน ร้านจะตอบรับและเสนอราคาในระบบร้าน", "ร้านแจ้งผล Win หรือ Loss กลับมา ระบบอัปเดต Lead ให้เอง"] } };
  }
  if (route === "solution") {
    return { at: 4, banner: { ...base, stepNo: 5, title: "เปิด Opp", why: "ลูกค้าสนใจงานบริการ เปิด Opp เพื่อเริ่มงานตามแผน Project Timeline", cta: "เปิด Opp (มีแบบ)", target: "opp",
      tips: ["ถ้าลูกค้ามีแบบแปลน เปิด Opp (มีแบบ)", "ถ้าเป็น Smart Solution หรือยังไม่มีแบบ เปิด Opp สำรวจ", "รายการที่ทวนแล้วถูกเติมในใบเปิดงานให้"] } };
  }
  return { at: 4, banner: { ...base, stepNo: 5, title: "เลือกเส้นทาง", why: "ยังไม่มีความสนใจ ระบบแนะนำเส้นทางให้ไม่ได้", cta: "ไปที่ความสนใจของลูกค้า", target: "id:lead-interest",
    tips: ["เลือกสินค้าหรือบริการที่ลูกค้าสนใจก่อน", "มีบริการ → เปิด Opp", "สินค้าอย่างเดียว → ส่งให้ร้าน"] } };
}
export const leadScripts = (l: Lead) => scriptsFor({ name: l.name, items: interestSummary(l.interests) || l.product, province: l.province });

/* ---------------- ตรรกะขั้นต่อไป: Opp ---------------- */
export function oppGuide(job: Job): BannerData | null {
  if (job.cancelReason || isFinished(job)) return null;
  const cur = currentStep(job);
  if (!cur) return null;
  const steps = stepsOf(job);
  const base = { stepNo: steps.findIndex((s) => s.key === cur.key) + 1, total: steps.length, extra: dueLabel(dueOf(job, cur)), target: "id:job-steps" };
  if (cur.owner !== "SE") {
    const p = PARTY[cur.owner];
    return { ...base, title: `รอ${p.label}: ${cur.label}`, why: cur.hint, cta: "ดูขั้นตอน", tips: ["ขั้นนี้ไม่ใช่งานของคุณ ไม่ต้องทำอะไรเพิ่ม", `ติดตามสถานะที่${p.label}ส่งกลับมา`, "ถ้าเกินกำหนด ให้น้องเลขาช่วยร่างข้อความตามหน่วยงาน"] };
  }
  const m = job.intake ? missingOf(job.intake) : null;
  const miss = m ? m.s4.length + (m.s5 ? 1 : 0) : 0;
  const note = miss > 0 ? `ใบเปิดงานยังขาด ${miss} ช่อง${m && m.s4.length ? ` (${m.s4.slice(0, 2).join(", ")}${m.s4.length > 2 ? " ฯลฯ" : ""})` : ""} เติมก่อนส่งต่อให้หน่วยงานอื่น จะได้ไม่ต้องโทรถามซ้ำ` : undefined;
  const survey = job.work === "survey";
  const key = cur.key;
  if (key === "survey_fee") {
    return { ...base, note, script: "deposit", title: cur.label, why: cur.hint, cta: "รับค่าสำรวจ (ปิดสำรวจ)",
      tips: [`แจ้งลูกค้าชำระค่าสำรวจ ${baht(depositOf(job))} (หักจากค่าติดตั้งตอนปิดขาย)`, "ขอสลิปโอนทางแชท", "เก็บค่าสำรวจแล้วบันทึก ถัดไปคือนัดวันเข้าสำรวจ"] };
  }
  if (key === "deposit") {
    return { ...base, note, script: "deposit", title: cur.label, why: cur.hint, cta: survey ? "รับค่าสำรวจ + ส่งงานให้ทีมสำรวจ" : "รับมัดจำ + ล็อกคิวสำรวจ",
      tips: [`แจ้งลูกค้าชำระ${survey ? "ค่าสำรวจ" : "มัดจำ"} ${baht(depositOf(job))}`, "ล็อกวันนัดสำรวจกับลูกค้า (เลือกวันที่ในช่องด้านล่าง)", survey ? "กดบันทึก ระบบส่งงานให้ทีมสำรวจเอง" : "กดบันทึก ระบบส่งข้อมูลให้ KIM และ SCM เอง"] };
  }
  if (key === "close") {
    return { ...base, note, title: cur.label, why: cur.hint, cta: "ขอรับชำระงวดแรก",
      tips: [`งวดแรก ${planOf(job).items[0].pct}% เก็บจริง ${baht(instNet(job, 1))} (หักที่ชำระแล้ว)`, "ส่งแผนชำระให้ลูกค้าดูพร้อมใบเสนอราคา แล้วขอรับชำระงวดแรกทาง LINE", "ชำระแล้วกดยืนยันปิดขาย ระบบส่งข้อมูลให้ KIM และ SCM เอง"] };
  }
  if (key === "quote1" || key === "quote2") {
    return { ...base, note, script: "follow", title: cur.label, why: cur.hint, cta: `ทำขั้น "${cur.label}"`,
      tips: key === "quote2" && survey
        ? ["อ่านรายงานสำรวจและใบเสนอราคาจากทีมสำรวจ", "นำเสนอราคาให้ลูกค้า", "ตามผลและต่อรอง ใช้คำพูดตัวอย่างช่วยได้"]
        : ["ถอดแบบรายหมวดในการ์ดถอดแบบ", "ทำใบเสนอราคาและส่งให้ลูกค้า", "ตามผลภายใน 3 วัน ใช้คำพูดตัวอย่างหรือให้น้องเลขาร่างข้อความ"] };
  }
  return { ...base, note, title: cur.label, why: cur.hint, cta: `ทำขั้น "${cur.label}"`, tips: [cur.hint, "ทำตามขั้นตอนนี้ให้เรียบร้อย", "กดทำเสร็จ ระบบเลื่อนไปขั้นถัดไปให้"] };
}
export const oppScripts = (j: Job) => scriptsFor({ name: j.customer, items: j.scope ?? "งานหลังคา", province: j.province });
export const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });

/* ---------------- ไกด์คุยกับลูกค้าในหน้าแชท ---------------- */
export interface ChatGuide { stage: string; goal: string; ask: string[]; messages: { label: string; text: string }[] }
export function chatGuide(o: { name: string; lead?: Lead; job?: Job }): ChatGuide | null {
  const n = o.name.split(" ")[0] || "คุณลูกค้า";
  const { lead, job } = o;
  if (job) {
    if (job.cancelReason) return null;
    const cur = currentStep(job);
    const survey = job.work === "survey";
    const amount = job.value > 0 ? ` ยอดรวม ${baht(job.value)}` : "";
    if (!cur) {
      return { stage: "หลังส่งมอบงาน", goal: "ดูแลหลังการขาย ขอบคุณลูกค้า และเก็บคะแนนความพึงพอใจ", ask: ["ลูกค้าพอใจกับงานหรือไม่", "มีจุดไหนที่ต้องแก้ไขไหม", "สนใจบริการอื่น เช่น ล้างแอร์ สำรวจรางน้ำ"],
        messages: [{ label: "ขอบคุณ + สิทธิพิเศษ", text: `${n} ค่ะ ขอบคุณที่ไว้วางใจเรานะคะ ตอนนี้ลูกค้ามีสิทธิพิเศษสำหรับบริการต่อยอดด้วย ถ้าสนใจแจ้งได้เลยค่ะ` }, { label: "ถามความพอใจ", text: `งานที่ติดตั้งไปเป็นอย่างไรบ้างคะ ถ้ามีจุดไหนอยากให้ตรวจเพิ่ม แจ้งทางแชทนี้ได้เลยนะคะ อยู่ในระยะรับประกันค่ะ` }] };
    }
    const due = dateTh(dueOf(job, cur));
    switch (cur.key) {
      case "plan_in":
        return { stage: "รับแบบจากลูกค้า", goal: "ขอแบบแปลนและข้อมูลหน้างานให้ครบ จะได้ถอดแบบได้ถูกต้อง", ask: ["แบบแปลน (ไฟล์ PDF หรือรูปถ่าย)", "ประเภทอาคารและลักษณะหลังคาที่ต้องการ", "สีและรุ่นกระเบื้องที่ชอบ"],
          messages: [{ label: "ขอแบบแปลน", text: `${n} ค่ะ รบกวนส่งแบบแปลนบ้าน (ไฟล์ PDF หรือรูปถ่าย) มาทางแชทนี้ได้เลยนะคะ ทีมจะถอดแบบและทำใบเสนอราคาให้ตามแบบค่ะ` }, { label: "ถามสี/รุ่น", text: `ขออนุญาตถามเพิ่มนะคะ ${n} สนใจกระเบื้องสีและรุ่นไหนเป็นพิเศษไหมคะ เดี๋ยวเตรียมตัวอย่างให้เปรียบเทียบค่ะ` }] };
      case "ase_mark":
      case "truss_design":
        return { stage: "รอห้องแบบทำแบบ", goal: "แจ้งลูกค้าว่าขั้นนี้ทีมห้องแบบกำลังทำ และกำหนดเสร็จ", ask: ["ลูกค้ามีส่วนที่อยากปรับแบบก่อนไหม", "ยืนยันว่าไม่มีการเปลี่ยนโครงสร้างเพิ่ม"],
          messages: [{ label: "แจ้งความคืบหน้า", text: `${n} ค่ะ ตอนนี้ทีมห้องแบบกำลังทำแบบโครงหลังคาให้ คาดว่าเสร็จภายใน ${due} ถ้ามีส่วนที่อยากปรับ แจ้งได้ก่อนวันนี้นะคะ` }] };
      case "quote1":
        return { stage: "เสนอราคาจากแบบ", goal: "ส่งใบเสนอราคาและอธิบายรายการหลักให้ลูกค้าเข้าใจ", ask: ["ลูกค้าเข้าใจรายการและยอดรวมหรือยัง", "มีรายการที่อยากเพิ่มหรือลดไหม", "คาดว่าตัดสินใจได้เมื่อไร"],
          messages: [{ label: "ส่งใบเสนอราคา", text: `${n} ค่ะ ส่งใบเสนอราคาให้แล้วนะคะ${amount} ถ้ามีส่วนไหนอยากให้อธิบายเพิ่ม หรืออยากปรับรายการ บอกได้เลยค่ะ` }, { label: "ถามความเห็น", text: `ใบเสนอราคาที่ส่งไป ${n} ได้ดูแล้วหรือยังคะ ติดตรงไหนอยากให้ช่วยอธิบายไหมคะ` }] };
      case "survey_fee":
      case "deposit":
        return { stage: survey ? "เก็บค่าสำรวจ" : "รับมัดจำ + ล็อกคิวสำรวจ", goal: "ขอรับ" + (survey ? "ค่าสำรวจ" : "มัดจำ") + "และตกลงวันเข้าสำรวจ", ask: ["วันและเวลาที่สะดวกให้ทีมสำรวจเข้า", "ใครอยู่หน้างานตอนสำรวจ", "ขอสลิปโอน"],
          messages: [{ label: "ขอรับ" + (survey ? "ค่าสำรวจ" : "มัดจำ"), text: `${n} ค่ะ ถ้าสะดวกดำเนินการต่อ รบกวนโอน${survey ? "ค่าสำรวจ" : "มัดจำ"} ${baht(depositOf(job))} แล้วส่งสลิปมาทางแชทนี้ได้เลยนะคะ จากนั้นทีมจะนัดเข้าสำรวจหน้างานให้ค่ะ` }, { label: "ถามวันสำรวจ", text: `วันที่สะดวกให้ทีมสำรวจเข้าหน้างานมีวันไหนบ้างคะ ช่วงเช้าหรือบ่ายสะดวกกว่ากัน และมีใครอยู่หน้างานให้ทีมสำรวจไหมคะ` }] };
      case "survey":
        return { stage: "รอทีมสำรวจ", goal: "แจ้งนัดสำรวจและให้ลูกค้าเตรียมหน้างาน", ask: ["ยืนยันวันเวลานัด", "ทีมสำรวจเข้าถึงหลังคาและพื้นที่ติดตั้งได้ไหม", "มีแบบแปลนฉบับล่าสุดไหม"],
          messages: [{ label: "ยืนยันนัดสำรวจ", text: `${n} ค่ะ ทีมสำรวจนัดเข้าหน้างาน ${job.surveyAt ? dtTh(job.surveyAt) : due} นะคะ รบกวนเตรียมให้ทีมเข้าถึงหลังคาและพื้นที่ที่จะติดตั้งได้ และถ้ามีแบบแปลนฉบับล่าสุดเตรียมไว้ด้วยนะคะ` }, { label: "แจ้งหลังสำรวจ", text: `ทีมสำรวจเข้าหน้างานเรียบร้อยแล้วนะคะ ตอนนี้กำลังจัดทำรายงานสำรวจ คาดว่าได้รับภายใน ${due} ค่ะ` }] };
      case "quote2":
        return { stage: "เสนอราคาหลังสำรวจ", goal: "อธิบายผลสำรวจและรายการที่เปลี่ยนจากใบเสนอราคาแรก", ask: ["ลูกค้าเห็นรายงานสำรวจและรูปหน้างานหรือยัง", "รายการไหนเปลี่ยนจากใบแรก เพราะอะไร", "พร้อมชำระส่วนที่เหลือเมื่อไร"],
          messages: [{ label: "ส่งใบเสนอราคาหลังสำรวจ", text: `${n} ค่ะ ทีมสำรวจเสร็จแล้ว ส่งรายงานสำรวจและใบเสนอราคาฉบับปรับตามหน้างานให้แล้วนะคะ${amount} มีรายการไหนอยากให้อธิบายเพิ่มบอกได้เลยค่ะ` }, { label: "ตามผลใบเสนอราคา", text: `ติดตามใบเสนอราคาที่ส่งไปนะคะ ตอนนี้มีข้อสงสัยตรงไหนอยากให้ช่วยอธิบายเพิ่มไหมคะ หรืออยากให้ทีมเข้าไปดูหน้างานอีกครั้งไหมคะ` }] };
      case "close":
        return { stage: "ปิดขาย", goal: "อธิบายแผนชำระ ขอรับชำระงวดแรก และยืนยันแผนงาน", ask: ["เข้าใจแผนแบ่งงวดชำระแล้วหรือยัง", "ช่องทางชำระเงิน (หรือเปิด PO)", "วันที่อยากให้เริ่มงาน"],
          messages: [{ label: "ขอรับชำระงวดแรก", text: `${n} ค่ะ งวดแรก ${planOf(job).items[0].pct}% ยอด ${baht(instNet(job, 1))} (หักที่ชำระแล้ว) ถ้าพร้อมแล้วชำระตามนี้ได้เลยนะคะ ที่เหลือชำระก่อนส่งของและก่อนติดตั้งตามแผนค่ะ ส่งสลิปทางแชทนี้ จากนั้นเราจะส่งแผนติดตั้งให้ค่ะ` }] };
      case "install_plan":
        return { stage: "แจ้งแผนติดตั้ง", goal: "แจ้งวันเริ่มงานให้ลูกค้าเตรียมตัว", ask: ["วันที่ลูกค้าไม่สะดวกให้ช่างเข้า", "จุดวางวัสดุและทางเข้า-ออก"],
          messages: [{ label: "แจ้งแผนติดตั้ง", text: `${n} ค่ะ ทีมวางแผนติดตั้งไว้ว่าจะเริ่มงานประมาณ ${due} จะส่งวันและเวลาแน่นอนให้อีกครั้งนะคะ มีวันไหนที่ไม่สะดวก แจ้งล่วงหน้าได้เลยค่ะ` }] };
      case "deliver_frame":
        return { stage: "ส่งทรัส/อะเสเข้าหน้างาน", goal: "ยืนยันชำระงวดที่ถึงกำหนด และให้ลูกค้าเตรียมที่วางโครง", ask: ["ชำระงวดที่กำหนดแล้วหรือยัง", "มีคนรับของวันที่ส่งไหม", "รถขนส่งเข้าหน้างานได้ไหม"],
          messages: [{ label: "แจ้งวันส่งโครง", text: `${n} ค่ะ ทรัส/อะเสจะส่งเข้าหน้างานประมาณ ${due} รบกวนชำระงวดที่ถึงกำหนดก่อนนะคะ จากนั้นทีมจะจัดส่งและติดตั้งตามแผนค่ะ` }] };
      case "install_frame":
        return { stage: "ติดตั้งทรัส/อะเส", goal: "อัปเดตความคืบหน้า และแจ้งงวดก่อนส่งกระเบื้อง", ask: ["เห็นปัญหาระหว่างติดตั้งไหม", "พร้อมชำระงวดก่อนส่งกระเบื้องไหม"],
          messages: [{ label: "แจ้งความคืบหน้าโครง", text: `${n} ค่ะ ทีมช่างติดตั้งโครงตามแผนแล้วนะคะ ใกล้เสร็จแล้วจะส่งกระเบื้องเข้าหน้างาน รบกวนเตรียมชำระงวดถัดไปล่วงหน้าด้วยค่ะ` }] };
      case "deliver":
        return { stage: "ส่งสินค้าเข้าหน้างาน", goal: "ให้ลูกค้าเตรียมที่วางวัสดุและมีคนรับของ", ask: ["มีคนรับของวันที่ส่งไหม", "รถขนส่งเข้าหน้างานได้ไหม"],
          messages: [{ label: "แจ้งวันส่งของ", text: `${n} ค่ะ สินค้าจะส่งเข้าหน้างานประมาณ ${due} รบกวนเตรียมที่วางวัสดุและให้มีคนรับของด้วยนะคะ` }] };
      case "install":
        return { stage: "ระหว่างติดตั้ง", goal: "อัปเดตความคืบหน้าและตอบข้อสงสัยระหว่างงาน", ask: ["ลูกค้าเห็นปัญหาอะไรระหว่างงานไหม", "ต้องการเปลี่ยนแปลงอะไรเพิ่มไหม"],
          messages: [{ label: "แจ้งเริ่มติดตั้ง", text: `${n} ค่ะ ทีมช่างเข้าติดตั้งตามแผนแล้วนะคะ จะอัปเดตความคืบหน้าทางแชทนี้เป็นระยะ ถ้ามีข้อสงสัยระหว่างติดตั้ง แจ้งได้ทันทีค่ะ` }] };
      case "handover":
        return { stage: "ส่งมอบงาน", goal: "ตรวจรับงานร่วมกับลูกค้า ส่งใบรับประกัน และขอคะแนนความพึงพอใจ", ask: ["ลูกค้าตรวจรับงานแล้วพอใจไหม", "ส่งใบรับประกันแล้วหรือยัง", "ขอให้ประเมินความพึงพอใจ"],
          messages: [{ label: "ส่งมอบ + ขอประเมิน", text: `${n} ค่ะ ขอบคุณที่ไว้วางใจเรานะคะ งานส่งมอบเรียบร้อยแล้ว ส่งใบรับประกันให้ทางแชทนี้ รบกวนช่วยประเมินความพึงพอใจสั้นๆ ผ่านลิงก์ที่ส่งให้ด้วยนะคะ` }] };
      default:
        return { stage: cur.label, goal: cur.hint, ask: [], messages: [{ label: "แจ้งความคืบหน้า", text: `${n} ค่ะ ตอนนี้งานอยู่ขั้น "${cur.label}" กำหนดเสร็จประมาณ ${due} จะแจ้งความคืบหน้าให้ทราบอีกครั้งนะคะ` }] };
    }
  }
  if (lead) {
    if (lead.status === "lost") return null;
    const items = interestSummary(lead.interests) || lead.product;
    if (lead.status === "dealer") {
      return { stage: "ส่งต่อให้ร้านทำใบเสนอราคา", goal: "แจ้งลูกค้าว่าร้านจะติดต่อกลับ และติดตามผลใบเสนอราคา", ask: ["ร้านติดต่อกลับลูกค้าแล้วหรือยัง", "ลูกค้าพอใจราคาหรือไม่"],
        messages: [{ label: "แจ้งส่งต่อร้าน", text: `${n} ค่ะ ส่งรายการที่สนใจให้ ${lead.dealerStore ?? "ร้านตัวแทน"} แล้วนะคะ ร้านจะติดต่อกลับพร้อมใบเสนอราคาภายใน 1 วันทำการค่ะ` }, { label: "ตามผล", text: `ร้านติดต่อกลับ${n}แล้วหรือยังคะ ถ้ายังไม่ได้รับ แจ้งเราได้เลย จะช่วยประสานให้ค่ะ` }] };
    }
    if (!lead.firstContactAt && !(lead.contacts?.length)) {
      return { stage: "ทักครั้งแรก", goal: "แนะนำตัว ถามพื้นที่ งบ และสิ่งที่ลูกค้าต้องการ (ตอบเร็วทันเวลา SLA)", ask: ["พื้นที่หน้างาน (จังหวัดและอำเภอ)", "ประเภทงานหรือสิ่งที่สนใจ", "งบประมาณคร่าวๆ", "ช่วงเวลาที่อยากเริ่ม"],
        messages: [{ label: "แนะนำตัว", text: `สวัสดีค่ะ ${n} ติดต่อจากทีม Housing Expert นะคะ ได้รับข้อมูลที่คุณสนใจ ${items} ไว้แล้วค่ะ ขออนุญาตสอบถามรายละเอียดเพิ่มเติมได้ไหมคะ` }, { label: "ถามรายละเอียด", text: `รบกวนขอทราบพื้นที่หน้างาน งบประมาณคร่าวๆ และช่วงเวลาที่อยากเริ่มงานด้วยนะคะ จะได้แนะนำให้ตรงความต้องการค่ะ` }] };
    }
    if (!lead.reviewed) {
      return { stage: "ทวนความต้องการ", goal: "ยืนยันรายการที่ลูกค้าสนใจให้ตรงกับที่ต้องการจริง", ask: ["ยืนยันรายการที่สนใจ", "ข้อกังวลของลูกค้า", "มีแบบแปลนหรือรูปหน้างานไหม"],
        messages: [{ label: "ทวนความต้องการ", text: `ขอทวนสิ่งที่คุณสนใจนะคะ ตอนนี้มี ${items} ถูกต้องไหมคะ มีอะไรอยากเพิ่มหรือเปลี่ยนไหม และหน้างานอยู่ที่${lead.province}ใช่ไหมคะ` }, { label: "ขอรูปหน้างาน", text: `${n} ถ่ายรูปหน้างานหรือแบบแปลนส่งมาทางแชทนี้ได้ไหมคะ ทีมจะได้ประเมินเบื้องต้นให้ค่ะ` }] };
    }
    if (lead.status !== "qualified") {
      return { stage: "สกรีนความพร้อม", goal: "เช็คงบ พื้นที่ และความพร้อมให้ทีมเข้าสำรวจหรือออกแบบ", ask: ["งบตรงกับที่รับงานไหม", "หน้างานอยู่ในพื้นที่บริการ", "พร้อมให้ทีมเข้าสำรวจหรือออกแบบไหม"],
        messages: [{ label: "ถามความพร้อม", text: `${n} สะดวกให้ทีมเข้าไปดูหน้างานหรือคุยรายละเอียดเพิ่มเติมช่วงไหนคะ ถ้าพร้อมแล้ว เราจะเปิดงานและนัดวันให้ค่ะ` }] };
    }
    return { stage: "นัดคุยต่อ / เปิดงาน", goal: "นัดวันเข้าสำรวจหรือส่งใบเสนอราคา แล้วเปิด Opp", ask: ["วันที่สะดวกเข้าสำรวจ", "ลูกค้ามีแบบแปลนไหม"],
      messages: [{ label: "นัดสำรวจ", text: `${n} ค่ะ ผ่านขั้นตอนเบื้องต้นแล้ว ขออนุญาตนัดทีมเข้าดูหน้างานนะคะ วันไหนสะดวกบ้างคะ` }, { label: "ส่งใบเสนอราคาเบื้องต้น", text: `${n} ค่ะ ส่งใบเสนอราคาเบื้องต้นให้ทางแชทนี้แล้วนะคะ ถ้าสนใจดำเนินการต่อ เราจะเปิดงานและนัดวันให้ค่ะ` }] };
  }
  return null;
}
export function ChatGuideCard({ g, onPick }: { g: ChatGuide; onPick: (text: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 px-3 py-2 text-left">
        <Icon name="school" style={{ fontSize: 16 }} className="text-indigo-600" />
        <span className="text-[11.5px] font-bold text-indigo-800">ไกด์คุยกับลูกค้า</span>
        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10.5px] font-bold text-white">{g.stage}</span>
        <Icon name={open ? "expand_more" : "chevron_right"} style={{ fontSize: 18 }} className="ml-auto text-slate-400" />
      </button>
      {open && (
        <div className="max-h-52 space-y-2 overflow-y-auto px-3 pb-3">
          <p className="text-[11.5px] text-slate-600"><b className="text-slate-800">เป้าหมายขั้นนี้:</b> {g.goal}</p>
          {g.ask.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-500">ควรถาม:</span>
              {g.ask.map((a) => <span key={a} className="rounded-full bg-white px-2 py-0.5 text-[10.5px] text-slate-700 ring-1 ring-slate-200">{a}</span>)}
            </div>
          )}
          <div className="space-y-1.5">
            {g.messages.map((m) => (
              <div key={m.label} className="flex items-start gap-2 rounded-lg bg-white/90 p-2 ring-1 ring-slate-200">
                <div className="min-w-0 flex-1"><div className="text-[11px] font-bold text-slate-800">{m.label}</div><p className="line-clamp-2 text-[11.5px] leading-snug text-slate-600">{m.text}</p></div>
                <button type="button" onClick={() => onPick(m.text)} className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700">ใช้ข้อความนี้</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}