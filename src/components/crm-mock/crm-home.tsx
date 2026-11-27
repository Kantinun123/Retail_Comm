"use client";
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  COLS, NOW, PARTY, TASK_ICON, atRisk, baht, colOf, currentStep, dueLabel, dueMoney, dueOf, isFinished, lateWd, leadSla, packetsOf,
  type Job, type Party, type Task,
} from "./crm-mock-data";
import { PartyBadge, Stat, glass, grad } from "./crm-ui";
import { PaceMini } from "./crm-pace";
import type { Ctx } from "./crm-views";

const FOLLOW_KINDS = ["follow_party", "scm_status"];
type Tab = "all" | "mine" | "follow";

export function HomeView({ c }: { c: Ctx }) {
  const [tab, setTab] = useState<Tab>("all");
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const risk = atRisk(c.leads, c.jobs);
  const urgent = c.tasks.filter((t) => t.priority === 1).length;
  const waiting = c.leads.filter((l) => l.status === "waiting");
  const breach = waiting.filter((l) => leadSla(l).state === "breach").length;
  const live = c.jobs.filter((j) => !j.cancelReason && !isFinished(j));
  const mine = live.filter((j) => currentStep(j)?.owner === "SE");
  const others = live.filter((j) => currentStep(j)?.owner !== "SE");
  const lateOthers = others.filter((j) => { const s = currentStep(j); return !!s && lateWd(dueOf(j, s)) > 0; });
  const collect = live.reduce((s, j) => s + dueMoney(j), 0);
  const first = c.tasks[0];
  const shown = c.tasks.filter((t) => (tab === "all" ? true : tab === "follow" ? FOLLOW_KINDS.includes(t.kind) : !FOLLOW_KINDS.includes(t.kind)));
  const tabs: { k: Tab; label: string; n: number }[] = [
    { k: "all", label: "ทั้งหมด", n: c.tasks.length },
    { k: "mine", label: "ต้องทำเอง", n: c.tasks.filter((t) => !FOLLOW_KINDS.includes(t.kind)).length },
    { k: "follow", label: "ต้องตามหน่วยงาน", n: c.tasks.filter((t) => FOLLOW_KINDS.includes(t.kind)).length },
  ];

  return (
    <div className="space-y-5">
      <section className={cn("relative overflow-hidden rounded-3xl p-6 text-white md:p-8", grad)}>
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-[12px] font-medium text-white/80">
              <Icon name="auto_awesome" style={{ fontSize: 16 }} /> น้องเลขา · {NOW.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })}
            </div>
            <h1 className="mt-2 text-[24px] font-bold leading-snug md:text-[28px]">
              สวัสดีค่ะ วันนี้มี {c.tasks.length} เรื่องที่ควรทำ
              {urgent > 0 && <span className="text-amber-200"> เร่งด่วน {urgent} เรื่อง</span>}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">
              {breach > 0 ? `Lead เกิน SLA ${breach} ราย · ` : ""}
              {lateOthers.length > 0 ? `${lateOthers.length} งานที่หน่วยงานอื่นส่งช้ากว่าแผน PT · ` : ""}
              {risk.jobs.length > 0 ? `งานมูลค่ารวม ${baht(risk.value)} เริ่มเสี่ยงหลุด ` : ""}
              เรียงลำดับให้แล้ว เริ่มจากข้อบนสุดได้เลยค่ะ
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {first && (
              <button onClick={() => c.openTask(first)} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-indigo-700 shadow-lg transition hover:-translate-y-0.5">
                <Icon name="play_arrow" fill /> เริ่มจากงานแรก
              </button>
            )}
            <button onClick={c.ask} className="inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-[13px] font-semibold backdrop-blur transition hover:bg-white/20">
              <Icon name="chat_bubble" /> ถามน้องเลขา
            </button>
          </div>
        </div>
      </section>

      <PaceMini c={c} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon="person_search" label="Lead รอติดต่อ" value={waiting.length} sub={breach ? `เกิน SLA ${breach} ราย` : "ทันเวลาทั้งหมด"} tone={breach ? "rose" : "emerald"} onClick={() => (waiting.length === 1 ? c.openLead(waiting[0].id) : c.goPreset("leads", { key: "lead_waiting", label: "Lead รอติดต่อ" }))} />
        <Stat icon="badge" label="งานที่รอทีมขายทำ" value={mine.length} sub={`มูลค่า ${baht(mine.reduce((s, j) => s + j.value, 0))}`} onClick={() => (mine.length === 1 ? c.openJob(mine[0].id) : c.goPreset("board", { key: "opp_mine", label: "งานที่รอทีมขายทำ" }))} />
        <Stat icon="hourglass_top" label="งานที่รอหน่วยงานอื่น" value={others.length} sub={lateOthers.length ? `ช้ากว่าแผน ${lateOthers.length} งาน` : "ตามแผนทั้งหมด"} tone={lateOthers.length ? "rose" : "emerald"} onClick={() => (others.length === 1 ? c.openJob(others[0].id) : c.goPreset("board", { key: "opp_others", label: "งานที่รอหน่วยงานอื่น" }))} />
        <Stat icon="account_balance_wallet" label="รอเก็บเงิน (มัดจำ + 100%)" value={baht(collect)} sub={`${live.filter((j) => dueMoney(j) > 0).length} งาน`} tone="amber" onClick={() => { const m = live.filter((j) => dueMoney(j) > 0); if (m.length === 1) c.openJob(m[0].id); else c.goPreset("board", { key: "opp_money", label: "งานที่รอเก็บเงิน" }); }} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className={cn(glass, "p-4 md:p-5")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-slate-900">งานที่ต้องทำวันนี้</h2>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5">
              {tabs.map((t) => (
                <button key={t.k} onClick={() => setTab(t.k)} className={cn("rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition", tab === t.k ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500")}>
                  {t.label} <span className="text-slate-400">{t.n}</span>
                </button>
              ))}
            </div>
          </div>
          <ul className="space-y-2">
            {shown.slice(0, 9).map((t) => <TaskRow key={t.id} t={t} c={c} open={openDraft === t.id} onDraft={() => setOpenDraft(openDraft === t.id ? null : t.id)} onSent={() => setOpenDraft(null)} />)}
            {shown.length === 0 && <li className="py-10 text-center text-[13px] text-slate-400">ไม่มีงานในหมวดนี้ค่ะ</li>}
          </ul>
        </section>

        <div className="space-y-5">
          <WaitingCard jobs={c.jobs} c={c} />
          <PipelineCard jobs={c.jobs} />
        </div>
      </div>
    </div>
  );
}

function TaskRow({ t, c, open, onDraft, onSent }: { t: Task; c: Ctx; open: boolean; onDraft: () => void; onSent: () => void }) {
  return (
    <li className="rounded-2xl border border-slate-100 bg-white p-3 transition hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", t.priority === 1 ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600")}>
          <Icon name={TASK_ICON[t.kind]} style={{ fontSize: 20 }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-bold text-slate-900">{t.title}</span>
            {t.priority === 1 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">เร่งด่วน</span>}
            {t.party && <PartyBadge party={t.party} />}
            {t.value ? <span className="text-[11px] font-semibold text-slate-400">{baht(t.value)}</span> : null}
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{t.reason}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => c.openTask(t)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-indigo-700">{t.action}</button>
            {t.phone && !t.party && <button onClick={() => c.toast(`กำลังโทร ${t.phone} (ตัวอย่าง)`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"><Icon name="call" style={{ fontSize: 15 }} />โทร</button>}
            {t.draft && (
              <button onClick={onDraft} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-violet-700">
                <Icon name="auto_awesome" style={{ fontSize: 15 }} />ร่างข้อความ
              </button>
            )}
          </div>
          {open && t.draft && (
            <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
              <p className="text-[12.5px] leading-relaxed text-slate-700">{t.draft}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => { void navigator.clipboard?.writeText(t.draft ?? ""); c.toast("คัดลอกข้อความแล้ว"); }} className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">คัดลอก</button>
                <button onClick={() => { c.toast(t.party ? `ส่งข้อความถึงทีม ${PARTY[t.party].label} แล้ว (ตัวอย่าง)` : `ส่งข้อความถึง ${t.who} แล้ว (ตัวอย่าง)`); onSent(); }} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white">{t.party ? "ส่งให้หน่วยงาน" : "ส่งทาง LINE"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** กล่อง "รอข้อมูลกลับจากหน่วยงาน" — สรุปสิ่งที่ CRM ส่งไปแล้วยังรอคำตอบ */
function WaitingCard({ jobs, c }: { jobs: Job[]; c: Ctx }) {
  const waits = jobs.flatMap((j) => packetsOf(j).filter((p) => p.state === "waiting"));
  const parties: Party[] = ["KIM", "SCM", "ROOM", "SURV"];
  return (
    <section className={cn(glass, "p-4 md:p-5")}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900">รอข้อมูลกลับจากหน่วยงาน</h2>
        <button onClick={() => c.go("exchange")} className="text-[11.5px] font-semibold text-indigo-600 hover:underline">ดูทั้งหมด</button>
      </div>
      <div className="space-y-4">
        {parties.map((p) => {
          const list = waits.filter((w) => w.party === p).sort((a, b) => +new Date(a.due!) - +new Date(b.due!));
          return (
            <div key={p}>
              <div className="mb-1.5 flex items-center gap-2">
                <PartyBadge party={p} />
                <span className="text-[11px] text-slate-400">{list.length ? `${list.length} รายการ` : "ไม่มีที่ค้าง"}</span>
              </div>
              <ul className="space-y-1.5">
                {list.slice(0, 3).map((w) => {
                  const late = lateWd(w.due!);
                  return (
                    <li key={w.id}>
                      <button onClick={() => c.openJob(w.jobId)} className="flex w-full items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left transition hover:bg-indigo-50">
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-slate-800">{w.customer}</span>
                          <span className="block truncate text-[11px] text-slate-500">{w.title}</span>
                        </span>
                        <span className={cn("shrink-0 text-[10.5px] font-bold", late > 0 ? "text-rose-600" : "text-slate-500")}>{dueLabel(w.due!)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PipelineCard({ jobs }: { jobs: Job[] }) {
  const rows = COLS.filter((s) => s.key !== "done").map((s) => ({ s, list: jobs.filter((j) => colOf(j) === s.key) }));
  const max = Math.max(1, ...rows.map((r) => r.list.reduce((a, j) => a + j.value, 0)));
  return (
    <section className={cn(glass, "p-4 md:p-5")}>
      <h2 className="mb-3 text-[15px] font-bold text-slate-900">มูลค่างานตามขั้นตอน</h2>
      <ul className="space-y-2.5">
        {rows.map(({ s, list }) => {
          const sum = list.reduce((a, j) => a + j.value, 0);
          return (
            <li key={s.key}>
              <div className="flex justify-between text-[11.5px]">
                <span className="font-medium text-slate-600">{s.label} <span className="text-slate-400">· {list.length}</span></span>
                <span className="font-semibold text-slate-800">{baht(sum)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full transition-all" style={{ width: `${(sum / max) * 100}%`, background: s.tone }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[10.5px] text-slate-400">กำหนดเสร็จของแต่ละขั้นคำนวณจากวันใน Project Timeline (วันทำการ ไม่รวมเสาร์-อาทิตย์)</p>
    </section>
  );
}

