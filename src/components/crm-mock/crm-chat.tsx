"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { PARTY, atRisk, baht, currentStep, dateTh, dueLabel, dueMoney, dueOf, lateWd, packetsOf, type Job, type Lead, type Task } from "./crm-mock-data";
import { ClassCheck, CustomerLookup, FlowGuide, OpportunityList, PromoList, PtCalc } from "./crm-assistant-tools";
import { Drawer, btnPrimary, grad, inputCls } from "./crm-ui";

/* จอกว้าง (>= 1024px) : ใช้ useSyncExternalStore เพื่อไม่ให้ผลต่างระหว่าง server กับ client ทำให้ hydration เตือน */
const subscribeResize = (cb: () => void) => { window.addEventListener("resize", cb); return () => window.removeEventListener("resize", cb); };
const useWideScreen = () => useSyncExternalStore(subscribeResize, () => window.innerWidth >= 1024, () => false);

interface Answer { text: string; items?: { label: string; sub?: string; run?: () => void }[]; draft?: string; node?: React.ReactNode }
interface Msg { from: "me" | "bot"; text: string; ans?: Answer }

const TODAY_Q = ["งานค้างวันนี้ มีอะไรบ้าง", "วันนี้ต้องทำอะไรก่อน", "ตอนนี้รอหน่วยงานไหนอยู่", "งานไหนเสี่ยงหลุด", "ยอดที่ต้องเก็บเงิน", "ร่างข้อความตามหน่วยงานที่ช้า"];
const CATS: { key: string; label: string; icon: string; tone: string; qs: string[] }[] = [
  { key: "today", label: "งานค้างวันนี้", icon: "today", tone: "bg-amber-50 text-amber-700", qs: TODAY_Q },
  { key: "flow", label: "Flow และแบบฟอร์ม", icon: "alt_route", tone: "bg-indigo-50 text-indigo-700", qs: ["ลูกค้าต้องการออกแบบ ต้องทำอย่างไร", "ลูกค้าซื้อสินค้าอย่างเดียว ทำอย่างไร", "Smart Solution / BA ทำอย่างไร", "ลูกค้าขอคืนเงิน ใช้แบบฟอร์มไหน"] },
  { key: "pt", label: "คำนวณ Project Timeline", icon: "event_note", tone: "bg-violet-50 text-violet-700", qs: ["คำนวณ PT จากวันที่ลูกค้าเข้ามา", "ลูกค้าอยากได้ก่อนวันที่ ต้องปิดขายเมื่อไร"] },
  { key: "class", label: "เช็ควันกระเบื้อง", icon: "local_shipping", tone: "bg-teal-50 text-teal-700", qs: ["เช็ควันส่งกระเบื้องตาม Class", "สีนี้เป็น Class อะไร"] },
  { key: "cust", label: "ลูกค้าและโอกาสขาย", icon: "person_search", tone: "bg-sky-50 text-sky-700", qs: ["ค้นประวัติลูกค้าจากชื่อหรือเบอร์", "โอกาสขายที่ควรตามตอนนี้"] },
  { key: "promo", label: "โปรโมชั่น", icon: "sell", tone: "bg-fuchsia-50 text-fuchsia-700", qs: ["โปรโมชั่นช่วงนี้มีอะไรบ้าง"] },
];

export function ChatDrawer({ open, onClose, leads, jobs, tasks, onTask, onJob, onLead, toast }: {
  open: boolean; onClose: () => void; leads: Lead[]; jobs: Job[]; tasks: Task[]; onTask: (t: Task) => void; onJob: (id: string) => void; onLead: (id: string) => void; toast: (m: string) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: "สวัสดีค่ะ ถามเรื่องงานของวันนี้ Flow และแบบฟอร์ม คำนวณวันที่ เช็คกระเบื้อง ค้นลูกค้า หรือโปรโมชั่นได้เลย เลือกหัวข้อทางด้านข้าง หรือพิมพ์ถามได้ค่ะ (ตัวอย่างนี้ตอบด้วยกฎที่กำหนดไว้ ข้อมูลบางส่วนเป็นตัวอย่าง)" }]);
  const [text, setText] = useState("");
  /* เปิดครั้งแรกบนจอใหญ่ = เต็มจอ ผู้ใช้ย่อ/ขยายเองได้ แล้วจำค่าที่เลือกไว้ */
  const [pref, setPref] = useState<boolean | null>(null);
  const wideScreen = useWideScreen();
  const full = pref ?? (open && wideScreen);
  const setFull = (v: boolean) => setPref(v);
  const [cat, setCat] = useState<string | null>("today");
  const endRef = useRef<HTMLDivElement>(null);

  const answer = (q: string): Answer => {
    const has = (...k: string[]) => k.some((x) => q.includes(x));
    const lower = q.toLowerCase();
    if (has("ค้าง")) {
      const urgent = tasks.filter((t) => t.priority === 1);
      const list = (urgent.length ? urgent : tasks).slice(0, 8);
      return { text: urgent.length ? `งานค้างวันนี้ ${tasks.length} เรื่อง เร่งด่วน ${urgent.length} เรื่อง เริ่มจากรายการด้านล่างค่ะ` : `งานวันนี้ ${tasks.length} เรื่อง ไม่มีเรื่องเร่งด่วนค่ะ`, items: list.map((t) => ({ label: t.title, sub: t.reason, run: () => onTask(t) })) };
    }
    /* เครื่องมือ */
    if (has("คืนเงิน", "WHT", "ภาษีหัก")) return { text: "ขอคืนเงินใช้แบบฟอร์มนี้ค่ะ", node: <FlowGuide pick="refund" /> };
    if (has("ออกแบบ")) return { text: "ลูกค้าต้องการออกแบบ ทำตามขั้นนี้ค่ะ", node: <FlowGuide pick="design" /> };
    if (has("สินค้าอย่างเดียว")) return { text: "ลูกค้าซื้อสินค้าอย่างเดียว ทำตามขั้นนี้ค่ะ", node: <FlowGuide pick="product" /> };
    if (has("Smart", "BA")) return { text: "งาน Smart Solution / BA ทำตามขั้นนี้ค่ะ", node: <FlowGuide pick="smart" /> };
    if (has("flow", "Flow", "แบบฟอร์ม", "ขั้นตอน", "เคลม", "ปัญหา")) return { text: "เลือกสถานการณ์ของลูกค้า แล้วดูขั้นตอนและแบบฟอร์มได้เลยค่ะ", node: <FlowGuide /> };
    if (has("PT", "Timeline", "timeline", "ไทม์ไลน์", "ก่อนวันที่", "กำหนดส่ง")) return { text: "ใส่วันที่ลูกค้าเข้ามา ระบบคำนวณวันที่ของทุกขั้นให้ค่ะ ถ้าลูกค้าอยากได้ก่อนวันที่ไหน กรอกช่องด้านล่างเพื่อคำนวณย้อนได้", node: <PtCalc toast={toast} /> };
    if (has("กระเบื้อง", "Class", "class", "คลาส", "สีนี้", "ของถึง", "ส่งสินค้า")) return { text: "เลือกรุ่น สี และวันที่ปิดขาย ระบบบอกวันที่ของถึงหน้างานค่ะ", node: <ClassCheck toast={toast} /> };
    if (has("โปร")) return { text: "โปรโมชั่นช่วงนี้ค่ะ", node: <PromoList /> };
    if (has("โอกาส")) return { text: "โอกาสขายที่ควรตามตอนนี้ค่ะ", node: <OpportunityList jobs={jobs} leads={leads} onJob={onJob} onLead={onLead} /> };
    if (has("ลูกค้า", "ประวัติ", "เบอร์") || /\d{4,}/.test(q) || lower.startsWith("คุณ")) {
      const initial = /\d{4,}/.test(q) ? q.replace(/[^\d-]/g, "") : q.replace(/ค้น|ประวัติ|ลูกค้า|จาก|ชื่อ|หรือ|เบอร์/g, "").trim();
      return { text: "ค้นประวัติลูกค้าด้วยชื่อหรือเบอร์โทรได้เลยค่ะ", node: <CustomerLookup jobs={jobs} leads={leads} onJob={onJob} onLead={onLead} initial={initial.length >= 2 ? initial : ""} /> };
    }
    /* งานของวันนี้ (เดิม) */
    if (has("ร่าง", "ข้อความ")) {
      const t = tasks.find((x) => x.party && x.draft) ?? tasks.find((x) => ["deposit_chase", "close_chase"].includes(x.kind) && x.draft);
      return t ? { text: `ร่างข้อความ "${t.title}" ให้แล้วค่ะ`, draft: t.draft } : { text: "ตอนนี้ไม่มีหน่วยงานที่ช้ากว่าแผนค่ะ" };
    }
    if (has("หน่วยงาน", "KIM", "SCM", "ห้องแบบ", "รอ")) {
      const waits = jobs.flatMap((j) => packetsOf(j).filter((p) => p.state === "waiting"));
      const late = waits.filter((w) => lateWd(w.due!) > 0).length;
      const items = [...waits].sort((a, b) => +new Date(a.due!) - +new Date(b.due!)).slice(0, 6).map((w) => ({
        label: `${PARTY[w.party].label} · ${w.customer}`, sub: `${w.title} · ${dueLabel(w.due!)}`, run: () => onJob(w.jobId),
      }));
      return { text: `รอข้อมูลกลับจากหน่วยงาน ${waits.length} รายการ ช้ากว่าแผน PT ${late} รายการค่ะ`, items };
    }
    if (has("เสี่ยง", "หลุด")) {
      const r = atRisk(leads, jobs);
      const items = [
        ...r.leads.map((l) => ({ label: `${l.name} · Lead เกิน SLA`, sub: `${l.product} · ${l.channel}` })),
        ...r.jobs.map((j) => { const s = currentStep(j)!; return { label: `${j.customer} · ${baht(j.value)}`, sub: `${s.label} · ${dueLabel(dueOf(j, s))}`, run: () => onJob(j.id) }; }),
      ];
      return { text: items.length ? `มี ${items.length} รายการที่เสี่ยง งานรวม ${baht(r.value)} ค่ะ` : "ตอนนี้ไม่มีงานที่เสี่ยงค่ะ", items };
    }
    if (has("เก็บเงิน", "ยอด", "มัดจำ", "ชำระ")) {
      const list = jobs.filter((j) => dueMoney(j) > 0);
      const sum = list.reduce((s, j) => s + dueMoney(j), 0);
      return { text: `ต้องเก็บอีก ${baht(sum)} จาก ${list.length} งานค่ะ`, items: list.map((j) => ({ label: j.customer, sub: `${(currentStep(j)?.key === "deposit" || currentStep(j)?.key === "survey_fee") ? "มัดจำ/ค่าสำรวจ" : "ส่วนที่เหลือก่อนปิดขาย"} ${baht(dueMoney(j))} · กำหนด ${dateTh(dueOf(j, currentStep(j)!))}`, run: () => onJob(j.id) })) };
    }
    if (has("วันนี้", "ก่อน", "ทำอะไร", "งาน")) {
      return { text: "เริ่มจาก 3 เรื่องนี้ค่ะ", items: tasks.slice(0, 3).map((t) => ({ label: t.title, sub: t.reason, run: () => onTask(t) })) };
    }
    return { text: "ลองเลือกหัวข้อด้านข้าง หรือพิมพ์เช่น “คำนวณ PT”, “เช็ควันกระเบื้อง”, “ค้นลูกค้า 081-555-0113”, “โปรโมชั่น”, “ขอคืนเงิน” ค่ะ" };
  };
  const send = (q: string) => {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setText("");
    setTimeout(() => {
      const a = answer(q);
      setMsgs((m) => [...m, { from: "bot", text: a.text, ans: a }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    }, 350);
  };

  /* รายการหมวดคำถาม : เต็มจอ = แผงด้านขวาเปิดครบทุกหมวด ; แผงข้าง = เลือกหมวดแล้วดูรายการคำถามด้านล่าง */
  const catPanel = (
    <div className="space-y-3">
      {CATS.map((c) => (
        <div key={c.key} className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800"><span className={cn("grid h-6 w-6 place-items-center rounded-lg", c.tone)}><Icon name={c.icon} className="!text-[15px]" /></span>{c.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {c.qs.map((q) => <button key={q} onClick={() => send(q)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-[11.5px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50">{q}</button>)}
          </div>
        </div>
      ))}
    </div>
  );

  const bubbles = (
    <>
      {msgs.map((m, i) => (
        <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
          <div className={cn("rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed", m.ans?.node ? "w-full" : "max-w-[88%]", m.from === "me" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-sm")}>
            {m.text}
            {m.ans?.node && <div className="mt-3">{m.ans.node}</div>}
            {m.ans?.items && (
              <ul className="mt-2 space-y-1.5">
                {m.ans.items.map((it, k) => (
                  <li key={k}>
                    <button disabled={!it.run} onClick={it.run} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-left transition enabled:hover:bg-indigo-50">
                      <div className="text-[12px] font-semibold text-slate-800">{it.label}</div>
                      {it.sub && <div className="text-[11px] text-slate-500">{it.sub}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {m.ans?.draft && (
              <div className="mt-2 rounded-xl bg-violet-50 p-3 text-[12px] text-slate-700">
                {m.ans.draft}
                <button onClick={() => { void navigator.clipboard?.writeText(m.ans?.draft ?? ""); toast("คัดลอกข้อความแล้ว"); }} className="mt-2 block rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700 shadow-sm">คัดลอก</button>
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </>
  );

  const form = (
    <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์คำถาม หรือชื่อ/เบอร์ลูกค้า…" className={inputCls} />
      <button className={btnPrimary} aria-label="ส่ง"><Icon name="send" style={{ fontSize: 18 }} /></button>
    </form>
  );
  const activeCat = CATS.find((c) => c.key === cat);

  const title = <span className="flex items-center gap-2"><span className={cn("grid h-8 w-8 place-items-center rounded-xl text-white", grad)}><Icon name="auto_awesome" style={{ fontSize: 18 }} /></span>น้องเลขา</span>;

  if (full) {
    return (
      <Drawer open={open} onClose={onClose} xwide title={title} subtitle="ผู้ช่วยประจำวันของทีมขาย · เต็มจอ"
        footer={<div className="mx-auto w-full max-w-5xl">{form}</div>}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-3">{bubbles}</div>
          <aside className="space-y-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-190px)] lg:self-start lg:overflow-y-auto">
            <button onClick={() => setFull(false)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"><Icon name="close_fullscreen" className="!text-[16px]" />ย่อเป็นแผงด้านข้าง</button>
            {catPanel}
          </aside>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer side open={open} onClose={onClose} title={title} subtitle={<span className="flex items-center gap-2">ผู้ช่วยประจำวันของทีมขาย<button onClick={() => setFull(true)} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"><Icon name="open_in_full" className="!text-[13px]" />ขยายเต็มจอ</button></span>}
      footer={
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
              {CATS.map((c) => (
                <button key={c.key} onClick={() => setCat(cat === c.key ? null : c.key)} className={cn("flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition", cat === c.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100")}><Icon name={c.icon} className="!text-[14px]" />{c.label}</button>
              ))}
            </div>
            <button onClick={() => setFull(true)} title="ขยายเต็มจอ" className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><Icon name="open_in_full" className="!text-[16px]" /></button>
          </div>
          {activeCat && (
            <ul className="max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
              {activeCat.qs.map((q) => <li key={q}><button onClick={() => send(q)} className="w-full rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-slate-700 hover:bg-indigo-50">{q}</button></li>)}
            </ul>
          )}
          {form}
        </div>
      }>
      {bubbles}
    </Drawer>
  );
}
