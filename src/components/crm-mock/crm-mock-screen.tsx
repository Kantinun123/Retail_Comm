"use client";
/* Mock: CRM ลูกค้า — Lead -> Ops/Job -> ปิดขาย -> ติดตามหลังปิดขาย + น้องเลขา
   ข้อมูลสมมติในหน่วยความจำเท่านั้น — รีเฟรชแล้วกลับค่าเริ่มต้น */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  AFTER_STEPS, NOW, STAGE_ORDER, buildTasks, seedJobs, seedLeads, stageMeta,
  type AfterKey, type Job, type Lead, type Stage, type Task,
} from "./crm-mock-data";
import { ChatDrawer, JobDrawer, LeadDrawer, NEXT, NewJobDrawer, type NewJobInput } from "./crm-drawers";
import { BoardView, HomeView, LeadsView, type Ctx } from "./crm-views";
import { grad } from "./crm-ui";

type View = "home" | "leads" | "board";
const NAV: { key: View; label: string; icon: string }[] = [
  { key: "home", label: "หน้าหลัก", icon: "space_dashboard" },
  { key: "leads", label: "Leads", icon: "person_search" },
  { key: "board", label: "งานทั้งหมด", icon: "view_kanban" },
];

function withStage(j: Job, to: Stage, text: string): Job {
  const now = NOW.toISOString();
  const at = (s: Stage) => STAGE_ORDER.indexOf(s);
  const after = { ...j.after };
  if (to === "done") for (const s of AFTER_STEPS) after[s.key] = after[s.key] ?? now;
  return {
    ...j, stage: to, after, lastTouchAt: now, log: [...j.log, { at: now, text }],
    depositPaidAt: at(to) > at("deposit") ? j.depositPaidAt ?? now : j.depositPaidAt,
    paidAt: at(to) >= at("aftersale") ? j.paidAt ?? now : j.paidAt,
  };
}

export function CrmMockScreen() {
  const sp = useSearchParams();
  const [view, setView] = useState<View>((sp.get("v") as View) ?? "home");
  const [leads, setLeads] = useState<Lead[]>(() => seedLeads());
  const [jobs, setJobs] = useState<Job[]>(() => seedJobs());
  const [leadId, setLeadId] = useState<string | null>(sp.get("lead"));
  const [jobId, setJobId] = useState<string | null>(sp.get("job"));
  const [chat, setChat] = useState(sp.get("chat") === "1");
  const [newJob, setNewJob] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const tasks = useMemo(() => buildTasks(leads, jobs), [leads, jobs]);
  const urgent = tasks.filter((t) => t.priority === 1).length;
  const lead = leads.find((l) => l.id === leadId) ?? null;
  const job = jobs.find((j) => j.id === jobId) ?? null;
  const patchJob = (id: string, fn: (j: Job) => Job) => setJobs((all) => all.map((j) => (j.id === id ? fn(j) : j)));
  const logTo = (j: Job, text: string): Job => ({ ...j, lastTouchAt: NOW.toISOString(), log: [...j.log, { at: NOW.toISOString(), text }] });

  const openTask = (t: Task) => { setChat(false); if (t.ref.type === "lead") setLeadId(t.ref.id); else setJobId(t.ref.id); };

  const ctx: Ctx = {
    leads, jobs, tasks, toast: setToastMsg,
    openLead: setLeadId, openJob: setJobId, openTask, ask: () => setChat(true),
    newJob: () => setNewJob({ open: true, lead: null }),
    moveJob: (id, to) => patchJob(id, (j) => (j.stage === to ? j : withStage(j, to, `ย้ายไปขั้น "${stageMeta(to).label}"`))),
  };

  const create = (i: NewJobInput) => {
    const id = `J-2611-${String(101 + jobs.length).padStart(4, "0")}`;
    const now = NOW.toISOString();
    const created: Job = {
      id, opsId: id.replace("J-", "OP-"), leadId: i.leadId, customer: i.customer, phone: i.phone, province: i.province, product: i.product, pkg: i.pkg,
      value: i.value, stage: "design", owner: i.owner, createdAt: now, lastTouchAt: now, after: {}, afterEta: {},
      log: [{ at: now, text: i.leadId ? `เปิด Ops จาก Lead ${i.leadId}` : "สร้างงานใหม่" }],
    };
    setJobs((all) => [created, ...all]);
    if (i.leadId) setLeads((all) => all.map((l) => (l.id === i.leadId ? { ...l, status: "converted" } : l)));
    setNewJob({ open: false, lead: null });
    setLeadId(null);
    setView("board");
    setJobId(id);
    setToastMsg(`สร้างงาน ${id} แล้ว`);
  };

  return (
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-[26rem] w-[26rem] rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[22rem] w-[22rem] rounded-full bg-cyan-300/20 blur-3xl" />
      </div>

      <div className="relative z-10 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[11px] text-amber-800">
        หน้าตัวอย่าง (mock) — ข้อมูลสมมติ ไม่บันทึกลงระบบจริง · รีเฟรชแล้วกลับค่าเริ่มต้น · เวลาในหน้านี้ถูกตรึงที่ 24 พ.ย. 2569 10:30
      </div>

      <aside className="fixed bottom-0 left-0 top-[29px] z-20 hidden w-64 flex-col border-r border-white/70 bg-white/70 p-4 backdrop-blur-xl lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className={cn("grid h-10 w-10 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/30", grad)}><Icon name="hub" /></span>
          <div>
            <div className="text-[15px] font-bold leading-tight text-slate-900">Ops Desk</div>
            <div className="text-[11px] text-slate-400">Housing Expert · ทีมขาย</div>
          </div>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setView(n.key)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition", view === n.key ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "text-slate-600 hover:bg-indigo-50")}>
              <Icon name={n.icon} fill={view === n.key} />{n.label}
              {n.key === "home" && urgent > 0 && <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold", view === n.key ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700")}>{urgent}</span>}
            </button>
          ))}
          <button onClick={() => setNewJob({ open: true, lead: null })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-slate-600 transition hover:bg-indigo-50"><Icon name="add_circle" />สร้างงานใหม่</button>
        </nav>
        <button onClick={() => setChat(true)} className={cn("mt-auto rounded-2xl p-4 text-left text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5", grad)}>
          <Icon name="auto_awesome" />
          <div className="mt-1 text-[13.5px] font-bold">ถามน้องเลขา</div>
          <div className="text-[11.5px] text-white/80">สรุปงาน ร่างข้อความ เตือนงานค้าง</div>
        </button>
      </aside>

      <main className="relative z-10 px-4 pb-28 pt-5 md:px-8 lg:ml-64 lg:pb-10">
        <div className="mx-auto max-w-[1400px]">
          {view === "home" && <HomeView c={ctx} />}
          {view === "leads" && <LeadsView c={ctx} />}
          {view === "board" && <BoardView c={ctx} />}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/70 bg-white/90 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-xl lg:hidden">
        {NAV.map((n) => (
          <button key={n.key} onClick={() => setView(n.key)} className={cn("flex flex-col items-center gap-0.5 px-4 py-1 text-[10.5px] font-semibold", view === n.key ? "text-indigo-600" : "text-slate-400")}>
            <Icon name={n.icon} fill={view === n.key} />{n.label}
          </button>
        ))}
        <button onClick={() => setChat(true)} className="flex flex-col items-center gap-0.5 px-4 py-1 text-[10.5px] font-semibold text-violet-600"><Icon name="auto_awesome" />น้องเลขา</button>
      </nav>

      <LeadDrawer lead={lead} tasks={tasks} onClose={() => setLeadId(null)} toast={setToastMsg}
        onPatch={(id, p) => setLeads((all) => all.map((l) => (l.id === id ? { ...l, ...p } : l)))}
        onConvert={(l) => setNewJob({ open: true, lead: l })} />
      <JobDrawer job={job} tasks={tasks} onClose={() => setJobId(null)} toast={setToastMsg}
        onAdvance={(id) => {
          const cur = jobs.find((j) => j.id === id);
          const nx = cur && NEXT[cur.stage];
          if (cur && nx) patchJob(id, (j) => withStage(j, nx.to, nx.label));
        }}
        onSurvey={(id, iso) => patchJob(id, (j) => logTo({ ...j, surveyAt: iso }, `นัดสำรวจหน้างาน ${new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}`))}
        onAfter={(id, key: AfterKey) => patchJob(id, (j) => {
          const step = AFTER_STEPS.find((s) => s.key === key)!;
          const upd = logTo({ ...j, after: { ...j.after, [key]: NOW.toISOString() } }, `${step.team}แจ้ง: ${step.label}เสร็จแล้ว`);
          return AFTER_STEPS.every((s) => upd.after[s.key]) ? { ...upd, stage: "done" } : upd;
        })}
        onCancel={(id, reason) => { patchJob(id, (j) => withStage({ ...j, cancelReason: reason }, "cancelled", `ยกเลิกงาน: ${reason}`)); setToastMsg("ยกเลิกงานแล้ว"); }} />
      <NewJobDrawer open={newJob.open} lead={newJob.lead} onClose={() => setNewJob({ open: false, lead: null })} onCreate={create} />
      <ChatDrawer open={chat} onClose={() => setChat(false)} leads={leads} jobs={jobs} tasks={tasks} onTask={openTask} toast={setToastMsg} />

      <div className={cn("pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-[12.5px] font-medium text-white shadow-xl transition-all duration-300 lg:bottom-8", toastMsg ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
        {toastMsg}
      </div>
    </div>
  );
}
