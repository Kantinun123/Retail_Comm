"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { PARTY, atRisk, baht, currentStep, dateTh, dueLabel, dueMoney, dueOf, lateWd, packetsOf, type Job, type Lead, type Task } from "./crm-mock-data";
import { Drawer, btnPrimary, grad, inputCls } from "./crm-ui";

interface Answer { text: string; items?: { label: string; sub?: string; run?: () => void }[]; draft?: string }
interface Msg { from: "me" | "bot"; text: string; ans?: Answer }
const PROMPTS = ["วันนี้ต้องทำอะไรก่อน", "ตอนนี้รอหน่วยงานไหนอยู่", "งานไหนเสี่ยงหลุด", "ยอดที่ต้องเก็บเงิน", "ร่างข้อความตามหน่วยงานที่ช้า"];

export function ChatDrawer({ open, onClose, leads, jobs, tasks, onTask, onJob, toast }: {
  open: boolean; onClose: () => void; leads: Lead[]; jobs: Job[]; tasks: Task[]; onTask: (t: Task) => void; onJob: (id: string) => void; toast: (m: string) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: "สวัสดีค่ะ ถามเรื่องงานของวันนี้ได้เลย หรือกดหัวข้อด้านล่างค่ะ (ตัวอย่างนี้ตอบจากข้อมูลในหน้าด้วยกฎที่กำหนดไว้)" }]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const answer = (q: string): Answer => {
    const has = (...k: string[]) => k.some((x) => q.includes(x));
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
      return { text: `ต้องเก็บอีก ${baht(sum)} จาก ${list.length} งานค่ะ`, items: list.map((j) => ({ label: j.customer, sub: `${currentStep(j)?.key === "deposit" ? "มัดจำ" : "ส่วนที่เหลือก่อนปิดขาย"} ${baht(dueMoney(j))} · กำหนด ${dateTh(dueOf(j, currentStep(j)!))}`, run: () => onJob(j.id) })) };
    }
    if (has("วันนี้", "ก่อน", "ทำอะไร", "งาน")) {
      return { text: "เริ่มจาก 3 เรื่องนี้ค่ะ", items: tasks.slice(0, 3).map((t) => ({ label: t.title, sub: t.reason, run: () => onTask(t) })) };
    }
    return { text: "ตัวอย่างนี้ตอบได้ 5 หัวข้อด้านล่างค่ะ ลองกดดูได้เลย" };
  };
  const send = (q: string) => {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setText("");
    setTimeout(() => {
      const a = answer(q);
      setMsgs((m) => [...m, { from: "bot", text: a.text, ans: a }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    }, 450);
  };

  return (
    <Drawer side open={open} onClose={onClose} title={<span className="flex items-center gap-2"><span className={cn("grid h-8 w-8 place-items-center rounded-xl text-white", grad)}><Icon name="auto_awesome" style={{ fontSize: 18 }} /></span>น้องเลขา</span>} subtitle="ผู้ช่วยประจำวันของทีมขาย"
      footer={
        <div className="space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">{PROMPTS.map((p) => <button key={p} onClick={() => send(p)} className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11.5px] font-semibold text-indigo-700 hover:bg-indigo-100">{p}</button>)}</div>
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์คำถาม…" className={inputCls} />
            <button className={btnPrimary} aria-label="ส่ง"><Icon name="send" style={{ fontSize: 18 }} /></button>
          </form>
        </div>
      }>
      {msgs.map((m, i) => (
        <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
          <div className={cn("max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed", m.from === "me" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-sm")}>
            {m.text}
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
    </Drawer>
  );
}
