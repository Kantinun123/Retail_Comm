"use client";
/* ไทม์ไลน์ลูกค้า: รวม Lead, การติดต่อ, ใบเสนอราคา, การเงิน, แชท LINE OA, CSAT และ SCG Family เป็นเส้นเวลาเดียว
   พร้อม "สิ่งที่ควรทำต่อ" และสรุปเคสตามกติกา (ไม่ใช่ AI) */
import { useMemo, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  NOW, agoText, baht, currentStep, dateTh, dayKey, dueMoney, dueOf, dtTh, interestSummary, isFinished, lateWd, timeTh,
  type ChatState, type Job, type Lead,
} from "./crm-mock-data";
import { glass } from "./crm-ui";

export interface FamilyInfo { sentAt: string; registeredAt?: string }
export type FamilyState = Record<string, FamilyInfo>;
export const FAMILY_URL = "https://www.scgfamily.com/campaign/%E0%B8%AA%E0%B8%A1%E0%B8%B1%E0%B8%84%E0%B8%A3%E0%B8%AA%E0%B8%A1%E0%B8%B2%E0%B8%8A%E0%B8%B4%E0%B8%81";
export const familyMessage = (name: string) => `สวัสดีค่ะ คุณ${name.replace(/^คุณ/, "").split(" ")[0]} สมัครสมาชิก SCG Family เพื่อรับสิทธิพิเศษและสะสมแต้มได้ที่ลิงก์นี้ค่ะ ${FAMILY_URL}`;

type Kind = "lead" | "contact" | "quote" | "pay" | "chat" | "csat" | "job" | "family";
const KIND: Record<Kind, { label: string; icon: string; tone: string; bg: string }> = {
  lead: { label: "Lead", icon: "person_add", tone: "#6366f1", bg: "bg-indigo-50 text-indigo-700" },
  contact: { label: "ติดต่อ", icon: "call", tone: "#0891b2", bg: "bg-cyan-50 text-cyan-700" },
  quote: { label: "เสนอราคา", icon: "request_quote", tone: "#7c3aed", bg: "bg-violet-50 text-violet-700" },
  pay: { label: "การเงิน", icon: "payments", tone: "#059669", bg: "bg-emerald-50 text-emerald-700" },
  chat: { label: "แชท", icon: "chat", tone: "#06a047", bg: "bg-green-50 text-green-700" },
  csat: { label: "CSAT", icon: "reviews", tone: "#d97706", bg: "bg-amber-50 text-amber-700" },
  job: { label: "งาน", icon: "construction", tone: "#475569", bg: "bg-slate-100 text-slate-700" },
  family: { label: "SCG Family", icon: "badge", tone: "#e11d48", bg: "bg-rose-50 text-rose-700" },
};
interface Ev { at: string; kind: Kind; text: string; by?: string; tag?: string }

const classify = (t: string): Kind => (/ชำระ|มัดจำ|ใบเสร็จ|เก็บเงิน|รับเงิน|สลิป/.test(t) ? "pay" : /เสนอราคา|ใบเสนอ/.test(t) ? "quote" : "job");

export function buildTimeline(phone: string, jobs: Job[], leads: Lead[], chat: ChatState, fam?: FamilyInfo): Ev[] {
  const ev: Ev[] = [];
  for (const l of leads.filter((x) => x.phone === phone)) {
    ev.push({ at: l.createdAt, kind: "lead", text: `รับ Lead จาก ${l.channel} · สนใจ ${interestSummary(l.interests) || l.product}`, tag: l.id });
    if (l.firstContactAt && !l.contacts?.length) ev.push({ at: l.firstContactAt, kind: "contact", text: "ติดต่อลูกค้าครั้งแรก", by: l.owner, tag: l.id });
    for (const c of l.contacts ?? []) ev.push({ at: c.at, kind: "contact", text: `${c.channel}: ${c.outcome}${c.note ? ` · ${c.note}` : ""}${c.nextAt ? ` · นัดต่อ ${dateTh(c.nextAt)}` : ""}`, by: c.by, tag: l.id });
    if (l.visitAt) ev.push({ at: l.visitAt, kind: "contact", text: "ลูกค้าเข้ามาที่ร้าน", tag: l.id });
    if (l.sentAt && l.dealerStore) ev.push({ at: l.sentAt, kind: "lead", text: `ส่งให้ร้าน ${l.dealerStore} ทำใบเสนอราคา`, tag: l.id });
    if (l.status === "lost" && l.lostReason) ev.push({ at: l.firstContactAt ?? l.createdAt, kind: "lead", text: `ปิด Lead (Loss): ${l.lostReason}`, tag: l.id });
  }
  for (const j of jobs.filter((x) => x.phone === phone)) {
    for (const e of j.log) {
      if (/^ลูกค้าตอบแบบประเมิน|^ส่งแบบประเมินความพึงพอใจ/.test(e.text)) continue;
      ev.push({ at: e.at, kind: classify(e.text), text: e.text, tag: j.opsId });
    }
    for (const k of ["r1", "r2"] as const) {
      const c = j.csat?.[k];
      if (c?.sentAt) ev.push({ at: c.sentAt, kind: "csat", text: `ส่งแบบประเมิน ${k === "r1" ? "รอบ 1" : "รอบ 2"} ทาง LINE OA`, tag: j.opsId });
      if (c?.done) ev.push({ at: c.done.at, kind: "csat", text: `ลูกค้าตอบแบบประเมิน ${k === "r1" ? "รอบ 1" : "รอบ 2"} ได้ ${c.done.avg.toFixed(1)}/5${c.done.comment ? ` · “${c.done.comment}”` : ""}`, tag: j.opsId });
    }
  }
  for (const m of chat.msgs.filter((x) => x.phone === phone && !x.internal && x.kind !== "sys" && x.kind !== "team" && !(fam && x.text?.includes("scgfamily.com")))) {
    ev.push({ at: m.at, kind: "chat", text: m.text ?? (m.card ? `การ์ด: ${m.card.title}` : m.img ? "ส่งรูป" : ""), by: m.kind === "cust" ? "ลูกค้า" : m.who, tag: m.job });
  }
  if (fam) {
    ev.push({ at: fam.sentAt, kind: "family", text: "ส่งลิงก์สมัครสมาชิก SCG Family ทาง LINE OA" });
    if (fam.registeredAt) ev.push({ at: fam.registeredAt, kind: "family", text: "ลูกค้าสมัครสมาชิก SCG Family แล้ว" });
  }
  return ev.filter((e) => e.text).sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

interface Next { icon: string; text: string; sub?: string; run?: () => void }
function nextActions(phone: string, jobs: Job[], leads: Lead[], fam: FamilyInfo | undefined, openJob: (id: string) => void, openLead: (id: string) => void): Next[] {
  const out: Next[] = [];
  for (const l of leads.filter((x) => x.phone === phone && (x.status === "waiting" || x.status === "contacting" || x.status === "qualified"))) {
    out.push({ icon: "call", text: l.status === "qualified" ? `Lead ${l.id} ผ่านสกรีนแล้ว เปิด Opp ได้เลย` : `ติดต่อ Lead ${l.id} (${l.status === "waiting" ? "ยังไม่ได้ติดต่อ" : "กำลังสกรีน"})`, sub: l.nextFollowAt ? `นัดติดตาม ${dtTh(l.nextFollowAt)}` : undefined, run: () => openLead(l.id) });
  }
  for (const j of jobs.filter((x) => x.phone === phone && !x.cancelReason && !isFinished(x))) {
    const p = j.payments?.find((x) => x.status !== "paid");
    if (p) { out.push({ icon: "payments", text: `รอลูกค้าชำระ${p.label} ${baht(p.amount)}`, sub: `${j.opsId} · ครบกำหนด ${dateTh(p.dueAt)}`, run: () => openJob(j.id) }); continue; }
    const s = currentStep(j);
    if (s) {
      const late = lateWd(dueOf(j, s));
      out.push({ icon: s.owner === "SE" ? "task_alt" : "hourglass_top", text: `${s.owner === "SE" ? "ทีมขายต้องทำ" : "รอหน่วยงาน"}: ${s.label}`, sub: `${j.opsId}${late > 0 ? ` · เลยแผน ${late} วันทำการ` : ""}${dueMoney(j) > 0 ? ` · ต้องเก็บ ${baht(dueMoney(j))}` : ""}`, run: () => openJob(j.id) });
    }
  }
  for (const j of jobs.filter((x) => x.phone === phone && x.done.handover && !x.csat?.r2?.sentAt)) out.push({ icon: "reviews", text: "ส่งแบบประเมินความพึงพอใจรอบ 2", sub: j.opsId, run: () => openJob(j.id) });
  if (!fam) out.push({ icon: "badge", text: "ยังไม่ได้ชวนสมัคร SCG Family", sub: "ส่งลิงก์ได้จากการ์ดด้านบน" });
  return out.slice(0, 4);
}

function caseSummary(name: string, phone: string, jobs: Job[], leads: Lead[], events: Ev[]): string[] {
  const mj = jobs.filter((j) => j.phone === phone);
  const ml = leads.filter((l) => l.phone === phone);
  const first = events[events.length - 1];
  const won = mj.filter((j) => j.done.close && !j.cancelReason);
  const open = mj.filter((j) => !j.cancelReason && !isFinished(j) && !j.done.handover);
  const last = events[0];
  const cs = mj.flatMap((j) => [j.csat?.r1?.done?.avg, j.csat?.r2?.done?.avg]).filter((x): x is number => typeof x === "number");
  const l1 = `${name} ติดต่อครั้งแรก ${first ? dateTh(first.at) : "-"}${ml[0] ? ` ผ่าน ${ml[0].channel}` : ""} · ${mj.length} งาน (ปิดขาย ${won.length} งาน${won.length ? ` ${baht(won.reduce((a, j) => a + j.value, 0))}` : ""})`;
  const cur = open[0] ? currentStep(open[0]) : null;
  const l2 = open[0] ? `ตอนนี้: ${open[0].opsId} ${cur ? `อยู่ขั้น ${cur.label}` : "อยู่ระหว่างดำเนินการ"}${open.length > 1 ? ` (และอีก ${open.length - 1} งาน)` : ""}` : mj.length ? "ไม่มีงานที่กำลังดำเนินการ" : "ยังไม่ได้เปิด Opp";
  const l3 = `ติดต่อล่าสุด ${last ? agoText(last.at) : "-"}${cs.length ? ` · ความพึงพอใจเฉลี่ย ${(cs.reduce((a, b) => a + b, 0) / cs.length).toFixed(1)}/5` : ""}`;
  return [l1, l2, l3];
}

export function TimelineCard({ phone, name, jobs, leads, chat, fam, openJob, openLead, onCopy }: {
  phone: string; name: string; jobs: Job[]; leads: Lead[]; chat: ChatState; fam?: FamilyInfo; openJob: (id: string) => void; openLead: (id: string) => void; onCopy: (text: string) => void;
}) {
  const [f, setF] = useState<Kind | "all">("all");
  const [more, setMore] = useState(false);
  const all = useMemo(() => buildTimeline(phone, jobs, leads, chat, fam), [phone, jobs, leads, chat, fam]);
  const next = useMemo(() => nextActions(phone, jobs, leads, fam, openJob, openLead), [phone, jobs, leads, fam, openJob, openLead]);
  const sum = useMemo(() => caseSummary(name, phone, jobs, leads, all), [name, phone, jobs, leads, all]);
  const counts = (k: Kind) => all.filter((e) => e.kind === k).length;
  const shown = all.filter((e) => f === "all" || e.kind === f);
  const list = more ? shown : shown.slice(0, 14);
  const days: { day: string; items: Ev[] }[] = [];
  for (const e of list) { const d = dayKey(e.at); const g = days[days.length - 1]; if (g && g.day === d) g.items.push(e); else days.push({ day: d, items: [e] }); }
  return (
    <div className="space-y-3">
      <div className={cn(glass, "p-4")}>
        <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="summarize" className="!text-[18px] text-indigo-600" />สรุปเคส</h3><button onClick={() => onCopy(sum.join("\n"))} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">คัดลอกสรุป</button></div>
        <ul className="space-y-1 text-[12.5px] text-slate-700">{sum.map((s, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />{s}</li>)}</ul>
      </div>
      <div className={cn(glass, "p-4")}>
        <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="bolt" className="!text-[18px] text-amber-500" />สิ่งที่ควรทำต่อ</h3>
        {next.length === 0 ? <p className="rounded-xl bg-emerald-50 p-3 text-[12px] font-semibold text-emerald-700">ไม่มีเรื่องค้าง เสนอโปรโมชั่นหรือสอบถามความต้องการเพิ่มได้ค่ะ</p> : (
          <ul className="space-y-1.5">
            {next.map((n, i) => (
              <li key={i}><button disabled={!n.run} onClick={n.run} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left enabled:hover:border-indigo-300"><Icon name={n.icon} className="!text-[18px] text-indigo-500" /><span className="min-w-0 flex-1"><b className="block truncate text-[12px] text-slate-800">{n.text}</b>{n.sub && <span className="text-[10.5px] text-slate-500">{n.sub}</span>}</span>{n.run && <Icon name="chevron_right" className="text-slate-300" />}</button></li>
            ))}
          </ul>
        )}
      </div>
      <div className={cn(glass, "p-4")}>
        <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="timeline" className="!text-[18px] text-indigo-600" />ไทม์ไลน์ลูกค้า <span className="text-[11px] font-normal text-slate-400">{all.length} เหตุการณ์ ล่าสุดอยู่บน</span></h3>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button onClick={() => setF("all")} className={cn("rounded-full border px-3 py-1 text-[11.5px] font-semibold", f === "all" ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600")}>ทั้งหมด {all.length}</button>
          {(Object.keys(KIND) as Kind[]).filter((k) => counts(k) > 0).map((k) => (
            <button key={k} onClick={() => setF(k)} className={cn("flex items-center gap-1 rounded-full border px-3 py-1 text-[11.5px] font-semibold", f === k ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600")}><Icon name={KIND[k].icon} className="!text-[14px]" />{KIND[k].label} {counts(k)}</button>
          ))}
        </div>
        {days.length === 0 && <p className="py-4 text-center text-[12px] text-slate-400">ยังไม่มีเหตุการณ์</p>}
        {days.map((g) => (
          <div key={g.day} className="mb-3 last:mb-0">
            <p className="mb-1.5 text-[11px] font-bold text-slate-400">{dateTh(g.items[0].at)}{g.day === dayKey(NOW.toISOString()) ? " · วันนี้" : ""}</p>
            <ul className="relative space-y-2 border-l-2 border-slate-100 pl-4">
              {g.items.map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-0.5 grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: KIND[e.kind].tone }}><Icon name={KIND[e.kind].icon} className="!text-[12px]" /></span>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]"><span className={cn("rounded-full px-2 py-0.5 font-bold", KIND[e.kind].bg)}>{KIND[e.kind].label}</span><span className="text-slate-400">{timeTh(e.at)}</span>{e.by && <span className="text-slate-500">· {e.by}</span>}{e.tag && <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500">{e.tag}</span>}</div>
                  <p className="break-words text-[12.5px] text-slate-700 [overflow-wrap:anywhere]">{e.text}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {shown.length > 14 && <button onClick={() => setMore(!more)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">{more ? "ย่อรายการ" : `ดูทั้งหมด ${shown.length} เหตุการณ์`}</button>}
      </div>
    </div>
  );
}
