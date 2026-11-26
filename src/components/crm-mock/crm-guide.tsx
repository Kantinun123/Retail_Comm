"use client";
/* ตัวช่วยแนะนำขั้นต่อไป สำหรับพนักงานขายใหม่ (เปิด/ปิดได้ จำค่าในเบราว์เซอร์) ; แนะนำอย่างเดียว ไม่บังคับ ข้ามได้เสมอ */
import { createContext, useContext, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  PARTY, baht, cleanInterests, currentStep, depositOf, dueLabel, dueOf, interestSummary, isFinished, leadSla, missingOf, slaHoursOf, stepsOf, suggestRoute,
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
  const route = suggestRoute(saved);
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
  if (key === "deposit") {
    return { ...base, note, script: "deposit", title: cur.label, why: cur.hint, cta: survey ? "รับค่าสำรวจ + ส่งงานให้ทีมสำรวจ" : "รับมัดจำ + ล็อกคิวสำรวจ",
      tips: [`แจ้งลูกค้าชำระ${survey ? "ค่าสำรวจ" : "มัดจำ"} ${baht(depositOf(job))}`, "ล็อกวันนัดสำรวจกับลูกค้า (เลือกวันที่ในช่องด้านล่าง)", survey ? "กดบันทึก ระบบส่งงานให้ทีมสำรวจเอง" : "กดบันทึก ระบบส่งข้อมูลให้ KIM และ SCM เอง"] };
  }
  if (key === "close") {
    return { ...base, note, title: cur.label, why: cur.hint, cta: "บันทึกรับเงินครบ 100%",
      tips: [`ตรวจยอดคงเหลือที่ลูกค้าต้องชำระ ${baht(Math.max(0, job.value - depositOf(job)))}`, "เก็บเงินครบแล้วบันทึกรับเงิน 100%", "ระบบส่งข้อมูลปิดขายให้ KIM และ SCM เอง"] };
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
