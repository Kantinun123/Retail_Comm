"use client";
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { PARTY, addDays, baht, currentStep, dateTh, dueOf, lateWd, type Job, type Lead } from "./crm-mock-data";
import { Avatar, glass } from "./crm-ui";
import type { Ctx } from "./crm-views";

/* ---------- 9 ช่วงของงาน (เรียงตรงกันทั้ง 2 flow) ---------- */
type Flow = "a" | "b";
const PHASES: { n: number; a: string; b: string; icon: string; tone: string }[] = [
  { n: 1, a: "Lead", b: "Lead", icon: "person_search", tone: "#6366f1" },
  { n: 2, a: "สกรีน", b: "สกรีน", icon: "fact_check", tone: "#8b5cf6" },
  { n: 3, a: "เสนอราคาก่อนสำรวจ", b: "ปิดสำรวจ", icon: "request_quote", tone: "#a855f7" },
  { n: 4, a: "มัดจำ / สำรวจ", b: "สำรวจ", icon: "pin_drop", tone: "#0891b2" },
  { n: 5, a: "เสนอราคาหลังสำรวจ", b: "เสนอราคาหลังสำรวจ", icon: "edit_note", tone: "#7c3aed" },
  { n: 6, a: "ปิดขาย", b: "ปิดขาย", icon: "account_balance_wallet", tone: "#ea580c" },
  { n: 7, a: "เตรียมของ / ติดตั้ง", b: "เตรียมของ / ติดตั้ง", icon: "construction", tone: "#0d9488" },
  { n: 8, a: "ส่งมอบ", b: "ส่งมอบ", icon: "task_alt", tone: "#059669" },
  { n: 9, a: "รับประกัน", b: "รับประกัน", icon: "verified", tone: "#475569" },
];
const flowOf = (j: Job): Flow => (j.work === "survey" ? "b" : "a");

export function jobPhase(j: Job): number {
  const c = currentStep(j);
  if (!c) return 9;
  const b = flowOf(j) === "b";
  switch (c.key) {
    case "plan_in": case "ase_mark": case "quote1": return 3;
    case "truss_design": return j.segment === "hbd" ? 3 : 5;
    case "survey_fee": return 3;
    case "deposit": return 4;
    case "survey": return 4;
    case "quote2": return 5;
    case "close": return 6;
    case "install_plan": case "deliver": case "install": return 7;
    default: return 8;
  }
}

interface Card { id: string; kind: "lead" | "job"; name: string; sub: string; value?: number; phase: number; flow: Flow | "any"; wait: string; late: number; ref: string; owner?: string }

function cardsOf(leads: Lead[], jobs: Job[]) {
  const withJob = new Set(jobs.map((j) => j.leadId).filter(Boolean));
  const cards: Card[] = [];
  const product: Lead[] = [];
  const lost: { id: string; name: string; why: string }[] = [];
  for (const l of leads) {
    if (withJob.has(l.id) && l.status === "converted") continue;
    if (l.status === "dealer") { product.push(l); continue; }
    if (l.status === "lost") { lost.push({ id: l.id, name: l.name, why: l.lostReason ?? "ไม่ระบุ" }); continue; }
    cards.push({
      id: l.id, kind: "lead", name: l.name, sub: `${l.province} · ${l.channel}`, phase: l.status === "qualified" || l.status === "converted" ? 2 : 1, flow: "any", ref: l.id,
      wait: l.status === "waiting" ? "รอทีมขายติดต่อ" : l.status === "contacting" ? "ทีมขายกำลังติดตาม" : "รอเปิดงาน (Opp)", late: 0, owner: l.owner,
    });
  }
  for (const j of jobs) {
    if (j.cancelReason) { lost.push({ id: j.id, name: j.customer, why: j.cancelReason }); continue; }
    const c = currentStep(j);
    const late = c ? Math.max(0, lateWd(dueOf(j, c))) : 0;
    cards.push({
      id: j.id, kind: "job", name: j.customer, sub: `${j.province}${j.scope ? ` · ${j.scope}` : ""}`, value: j.value || undefined, phase: jobPhase(j), flow: flowOf(j),
      wait: c ? `${c.owner === "SE" ? "ทีมขาย" : PARTY[c.owner].label}: ${c.label}` : "อยู่ในระยะประกัน", late, ref: j.id, owner: j.owner,
    });
  }
  return { cards, product, lost };
}

function CardView({ c, open }: { c: Card; open: () => void }) {
  return (
    <button onClick={open} className={cn("w-full rounded-xl border bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md", c.late > 1 ? "border-rose-300" : c.late > 0 ? "border-amber-300" : "border-slate-200")}>
      <div className="flex items-center gap-2">
        <Avatar name={c.name} size={24} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold text-slate-800">{c.name}</p>
          <p className="truncate text-[10.5px] text-slate-400">{c.ref} · {c.sub}</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[10.5px]">
        <span className="truncate rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">รอ: {c.wait}</span>
        {c.value ? <span className="shrink-0 font-bold text-slate-700">{baht(c.value)}</span> : null}
      </div>
      {c.late > 0 && <p className={cn("mt-1 text-[10.5px] font-bold", c.late > 1 ? "text-rose-600" : "text-amber-600")}>เลยแผน {c.late} วันทำการ</p>}
    </button>
  );
}

/* ---------------- แถบเส้นทางงาน 9 ช่วง (ใช้บนหน้ารายละเอียดงาน) ---------------- */
export function JourneyStrip({ job }: { job: Job }) {
  const flow = flowOf(job);
  const cur = jobPhase(job);
  const lost = !!job.cancelReason;
  return (
    <div className={cn(glass, "overflow-x-auto p-3")}>
      <div className="flex min-w-max items-start">
        {PHASES.map((p, i) => {
          const state = lost ? (p.n < cur ? "done" : "off") : p.n < cur || (p.n === 9 && cur === 9) ? "done" : p.n === cur ? "cur" : "todo";
          return (
            <div key={p.n} className="flex items-start">
              <div className="flex w-[84px] flex-col items-center text-center">
                <span className={cn("grid h-8 w-8 place-items-center rounded-full text-white", state === "done" ? "bg-emerald-500" : state === "cur" ? "bg-indigo-600 ring-4 ring-indigo-100" : "bg-slate-200 !text-slate-400")}>
                  <Icon name={state === "done" ? "check" : p.icon} className="!text-[17px]" />
                </span>
                <span className={cn("mt-1 text-[10.5px] leading-tight", state === "cur" ? "font-bold text-indigo-700" : state === "done" ? "font-semibold text-slate-600" : "text-slate-400")}>{flow === "a" ? p.a : p.b}</span>
              </div>
              {i < PHASES.length - 1 && <span className={cn("mt-4 h-0.5 w-3", p.n < cur ? "bg-emerald-400" : "bg-slate-200")} />}
            </div>
          );
        })}
      </div>
      {lost && <p className="mt-2 text-[11px] font-semibold text-rose-600">ยกเลิกที่ช่วง {cur}: {job.cancelReason}</p>}
    </div>
  );
}
/* ---------------- ภาพรวมงาน ---------------- */
export function OverviewView({ c }: { c: Ctx }) {
  const [flow, setFlow] = useState<Flow>("a");
  const [lostOpen, setLostOpen] = useState(false);
  const { cards, product, lost } = cardsOf(c.leads, c.jobs);
  const open = (x: Card) => (x.kind === "lead" ? c.openLead(x.id) : c.openJob(x.id));
  const shown = (p: number) => cards.filter((x) => x.phase === p && (x.flow === "any" || x.flow === flow || p >= 5));
  const lateAll = cards.filter((x) => x.late > 0).length;
  const money = cards.filter((x) => x.kind === "job" && x.phase >= 3 && x.phase <= 6).reduce((a, x) => a + (x.value ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">ภาพรวมงาน</h1>
          <p className="text-[12.5px] text-slate-500">ทุกงานตั้งแต่ Lead จนถึงรับประกัน อยู่ช่วงไหน รอใคร เลยแผนหรือยัง</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-[12px] font-bold">
          {([["a", "ขายสินค้า + Solution"], ["b", "Smart Solution + BA"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFlow(k)} className={cn("rounded-lg px-3 py-1.5 transition", flow === k ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-indigo-600")}>{l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["งานที่เปิดอยู่", String(cards.length), "text-slate-900"], ["เลยแผน", String(lateAll), lateAll ? "text-rose-600" : "text-emerald-600"], ["มูลค่าก่อนปิดขาย", baht(money), "text-indigo-700"], ["ส่งให้ร้าน (สินค้า)", String(product.length), "text-slate-900"]].map(([l, v, t]) => (
          <div key={l} className={cn(glass, "p-3.5")}><p className="text-[11px] font-semibold text-slate-500">{l}</p><p className={cn("text-[22px] font-bold", t)}>{v}</p></div>
        ))}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {PHASES.map((p) => {
            const xs = shown(p.n);
            return (
              <div key={p.n} className="w-[230px] shrink-0 rounded-2xl bg-white/50 p-2">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="grid h-6 w-6 place-items-center rounded-lg text-white" style={{ background: p.tone }}><Icon name={p.icon} className="!text-[15px]" /></span>
                  <p className="flex-1 truncate text-[12px] font-bold text-slate-800">{p.n}. {flow === "a" ? p.a : p.b}</p>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-bold text-slate-500">{xs.length}</span>
                </div>
                <div className="space-y-2">
                  {xs.map((x) => <CardView key={x.id} c={x} open={() => open(x)} />)}
                  {!xs.length && <p className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-[11px] text-slate-300">ไม่มีงาน</p>}
                </div>
                {p.n === 6 && <p className="mt-2 px-1 text-[10.5px] text-slate-400">ปิดขายแล้วจะส่งต่อไปช่อง 7 และหน้า &ldquo;งานหลังขาย&rdquo;</p>}
              </div>
            );
          })}
        </div>
      </div>
      <div className={cn(glass, "p-3.5")}>
        <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800"><Icon name="storefront" className="!text-[16px] text-indigo-500" />ขายสินค้าอย่างเดียว (ส่งให้ร้านทำใบเสนอราคา)</p>
        <div className="flex flex-wrap gap-2">
          {product.map((l) => <button key={l.id} onClick={() => c.openLead(l.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left text-[12px] hover:border-indigo-300"><b>{l.name}</b> <span className="text-slate-400">{l.dealerStore ?? "-"}</span></button>)}
          {!product.length && <p className="text-[12px] text-slate-300">ไม่มี</p>}
        </div>
      </div>
      <div className={cn(glass, "p-3.5")}>
        <button onClick={() => setLostOpen(!lostOpen)} className="flex w-full items-center justify-between text-[12.5px] font-bold text-slate-800">
          <span className="flex items-center gap-1.5"><Icon name="cancel" className="!text-[16px] text-rose-500" />ยกเลิก / Lost ({lost.length})</span>
          <Icon name={lostOpen ? "expand_less" : "expand_more"} />
        </button>
        {lostOpen && <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{lost.map((x) => <p key={x.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-[12px] text-slate-600"><b>{x.name}</b> · {x.why}</p>)}</div>}
      </div>
    </div>
  );
}

/* ---------------- งานหลังขาย ---------------- */
type Lane = "plan" | "prep" | "install" | "handover" | "warranty";
const LANES: { key: Lane | "claim"; label: string; hint: string; icon: string; tone: string }[] = [
  { key: "plan", label: "รอแผนติดตั้ง", hint: "KIM วางแผนกับลูกค้า", icon: "event_note", tone: "#6366f1" },
  { key: "prep", label: "เตรียมสินค้า (SCM)", hint: "สั่งของ รอของเข้า", icon: "local_shipping", tone: "#0d9488" },
  { key: "install", label: "กำลังติดตั้ง", hint: "KIM + ช่าง", icon: "construction", tone: "#059669" },
  { key: "handover", label: "ส่งมอบ / ตรวจรับ", hint: "ตรวจรับ ใบรับประกัน CSAT รอบ 2", icon: "task_alt", tone: "#0891b2" },
  { key: "warranty", label: "อยู่ในประกัน", hint: "นับจากวันส่งมอบ", icon: "verified", tone: "#475569" },
  { key: "claim", label: "แจ้งปัญหา / เคลม", hint: "ลูกค้าแจ้งหลังส่งมอบ", icon: "report", tone: "#e11d48" },
];
function laneOf(j: Job): Lane | null {
  const c = currentStep(j);
  if (j.cancelReason || !j.done.close) return null;
  if (!c) return "warranty";
  switch (c.key) {
    case "install_plan": return "plan";
    case "deliver": return "prep";
    case "install": return "install";
    case "handover": return "handover";
    default: return null;
  }
}

export function AftersaleView({ c }: { c: Ctx }) {
  const [claims, setClaims] = useState<Record<string, string>>({});
  const jobs = c.jobs.filter((j) => laneOf(j));
  const inLane = (k: Lane | "claim") => (k === "claim" ? jobs.filter((j) => claims[j.id]) : jobs.filter((j) => laneOf(j) === k && !claims[j.id]));
  const expiry = (j: Job) => addDays(j.done.handover ?? j.lastTouchAt, 365 * 5);
  const lateN = jobs.filter((j) => { const s = currentStep(j); return s && lateWd(dueOf(j, s)) > 0; }).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">งานหลังขาย</h1>
        <p className="text-[12.5px] text-slate-500">งานที่ปิดขายแล้ว ถึงส่งมอบและรับประกัน · KIM และ SCM เป็นผู้อัปเดตสถานะ ทีมขายดูและคุยกับลูกค้า</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["งานหลังขายทั้งหมด", String(jobs.length)], ["เลยแผน", String(lateN)], ["กำลังติดตั้ง", String(inLane("install").length)], ["แจ้งเคลม", String(inLane("claim").length)]].map(([l, v]) => (
          <div key={l} className={cn(glass, "p-3.5")}><p className="text-[11px] font-semibold text-slate-500">{l}</p><p className="text-[22px] font-bold text-slate-900">{v}</p></div>
        ))}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {LANES.map((l) => {
            const xs = inLane(l.key);
            return (
              <div key={l.key} className="w-[250px] shrink-0 rounded-2xl bg-white/50 p-2">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="grid h-6 w-6 place-items-center rounded-lg text-white" style={{ background: l.tone }}><Icon name={l.icon} className="!text-[15px]" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-bold text-slate-800">{l.label}</p><p className="truncate text-[10px] text-slate-400">{l.hint}</p></div>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-bold text-slate-500">{xs.length}</span>
                </div>
                <div className="space-y-2">
                  {xs.map((j) => {
                    const s = currentStep(j);
                    const late = s ? Math.max(0, lateWd(dueOf(j, s))) : 0;
                    return (
                      <div key={j.id} className={cn("rounded-xl border bg-white p-2.5", late ? "border-amber-300" : "border-slate-200")}>
                        <button onClick={() => c.openJob(j.id)} className="flex w-full items-center gap-2 text-left">
                          <Avatar name={j.customer} size={24} />
                          <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-bold text-slate-800">{j.customer}</p><p className="truncate text-[10.5px] text-slate-400">{j.id} · {j.province} · {baht(j.value)}</p></div>
                        </button>
                        <p className="mt-1.5 text-[10.5px] text-slate-500">
                          {s ? <>ขั้นปัจจุบัน: <b>{s.label}</b> · {PARTY[s.owner].label}</> : <>ประกันถึง <b>{dateTh(expiry(j))}</b></>}
                        </p>
                        {late > 0 && <p className="mt-0.5 text-[10.5px] font-bold text-amber-600">เลยแผน {late} วันทำการ</p>}
                        {claims[j.id] && <p className="mt-1 rounded-md bg-rose-50 px-1.5 py-1 text-[10.5px] text-rose-700">เคลม: {claims[j.id]}</p>}
                        {!s && (
                          <button onClick={() => { setClaims((m) => { const n = { ...m }; if (n[j.id]) delete n[j.id]; else n[j.id] = "น้ำรั่วบริเวณรอยต่อ (ตัวอย่าง)"; return n; }); c.toast(claims[j.id] ? "ปิดเคลมแล้ว" : "เปิดเคลมและแจ้ง KIM แล้ว"); }}
                            className="mt-1.5 w-full rounded-lg border border-slate-200 py-1 text-[11px] font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600">{claims[j.id] ? "ปิดเคลม" : "แจ้งปัญหา/เคลม"}</button>
                        )}
                      </div>
                    );
                  })}
                  {!xs.length && <p className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-[11px] text-slate-300">ไม่มีงาน</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
