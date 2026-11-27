"use client";
/* Mock: CRM ทีมขาย — Lead -> Opp -> ปิดขาย + ติดตามหน่วยงาน KIM / SCM / ห้องแบบ ตาม Project Timeline งาน Roof Installation
   ข้อมูลสมมติในหน่วยความจำเท่านั้น — รีเฟรชแล้วกลับค่าเริ่มต้น ; การเชื่อมกับแอปหน่วยงานอื่นเป็นการจำลอง */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { chatRooms, seedChat, totalUnread, type ChatMsg, type ChatState, type Nudge, DEFAULT_COVERAGE, ROLE_STORES, assignStore, ownerForProv, ownerOfLead, slaHoursOf, NOW, PARTY, addWd, buildTasks, missingOf, seedJobs, seedLeads, stepsOf, type Job, type Lead, type StepKey, type Task } from "./crm-mock-data";
import { LeadDrawer } from "./crm-drawers";
import { AddLeadDrawer } from "./crm-add-lead";
import { AreasView } from "./crm-areas";
import { NewSurveyDrawer, type SurveyInput } from "./crm-new-survey";
import { ChatDrawer } from "./crm-chat";
import { JobDrawer, type ScmEvent } from "./crm-job-drawer";
import { NewOppPage, type NewJobInput } from "./crm-new-opp";
import { BoardView, ExchangeView } from "./crm-board";
import { HomeView } from "./crm-home";
import { AftersaleView, OverviewView } from "./crm-overview";
import { PerformanceView } from "./crm-performance";
import { PaceView, unreadNudges } from "./crm-pace";
import { LeadsView, type Ctx, type View } from "./crm-views";
import { ReportView, RoleBar, type Role } from "./crm-report";
import { GuideCtx, setGuideOn, useGuidePref } from "./crm-guide";
import { Customer360Drawer, CustomersView } from "./crm-customer";
import { InboxView, type ChatSel } from "./crm-inbox";
import { grad } from "./crm-ui";

const NAV: { key: View; label: string; icon: string }[] = [
  { key: "home", label: "หน้าหลัก", icon: "space_dashboard" },
  { key: "pace", label: "เป้าและจังหวะ", icon: "speed" },
  { key: "perf", label: "ผลงานของฉัน", icon: "emoji_events" },
  { key: "overview", label: "ภาพรวมงาน", icon: "timeline" },
  { key: "leads", label: "Leads", icon: "person_search" },
  { key: "board", label: "งาน (Opp)", icon: "view_kanban" },
  { key: "aftersale", label: "งานหลังขาย", icon: "construction" },
  { key: "inbox", label: "แชท", icon: "chat" },
  { key: "customers", label: "ลูกค้า 360", icon: "groups" },
  { key: "areas", label: "พื้นที่รับงาน", icon: "share_location" },
  { key: "exchange", label: "เชื่อมข้อมูล", icon: "sync_alt" },
];

const MOBILE_MAIN: View[] = ["home", "overview", "leads", "inbox"];
const MOBILE_MORE: View[] = ["pace", "perf", "board", "aftersale", "customers", "areas", "exchange"];

const NAV_RO: { key: View; label: string; icon: string }[] = [
  { key: "pace", label: "เป้าและจังหวะ", icon: "speed" },
  { key: "report", label: "รายงานทีม", icon: "monitoring" },
  { key: "overview", label: "ภาพรวมงาน", icon: "timeline" },
  { key: "leads", label: "Leads", icon: "person_search" },
  { key: "board", label: "งาน (Opp)", icon: "view_kanban" },
  { key: "aftersale", label: "งานหลังขาย", icon: "construction" },
];

type OppState = { lead: Lead | null; editId: string | null; step: 1 | 4 | 5 };

function completeStep(j: Job, key: StepKey, extra?: { surveyAt?: string }): Job {
  const now = NOW.toISOString();
  const s = stepsOf(j).find((x) => x.key === key)!;
  const log = [...j.log, { at: now, text: s.owner === "SE" ? `${s.label} เสร็จ` : `${PARTY[s.owner].label}ส่ง "${s.result}" กลับมา` }];
  const outs = s.sends.filter((x) => x.at === "done");
  if (outs.length) log.push({ at: now, text: `CRM ส่งข้อมูลให้ ${outs.map((o) => `${PARTY[o.party].label} (${o.title})`).join(" และ ")}` });
  return { ...j, done: { ...j.done, [key]: now }, lastTouchAt: now, surveyAt: extra?.surveyAt ?? j.surveyAt, log };
}

export function CrmMockScreen() {
  const sp = useSearchParams();
  const [role, setRole] = useState<Role>(() => (["coach", "area", "dealer"].includes(sp.get("role") ?? "") ? (sp.get("role") as Role) : "se"));
  /* ชื่อเล่น SE ของตัวเอง (เดโมเลือกจาก ?se=; ของจริงมาจาก profile) */
  const [seNick] = useState(() => sp.get("se") ?? "ฝน");
  const readOnly = role !== "se";
  const guidePref = useGuidePref();
  const guideOn = guidePref && !readOnly;
  const seFilter = role === "se" && sp.get("se");
  const [view, setView] = useState<View>((sp.get("v") as View) ?? (readOnly ? "pace" : "home"));
  const [leads, setLeads] = useState<Lead[]>(() => seedLeads());
  const [jobs, setJobs] = useState<Job[]>(() => seedJobs());
  const [leadId, setLeadId] = useState<string | null>(sp.get("lead"));
  const [jobId, setJobId] = useState<string | null>(sp.get("job"));
  const [chat, setChat] = useState(sp.get("chat") === "1");
  const [addingLead, setAddingLead] = useState(false);
  const [custPhone, setCustPhone] = useState<string | null>(null);
  const [coverage, setCoverage] = useState(DEFAULT_COVERAGE);
  const [chatSt, setChatSt] = useState<ChatState>(() => seedChat());
  const [chatSel, setChatSel] = useState<ChatSel>({ phone: null, job: "" });
  const [survey, setSurvey] = useState<{ lead: Lead | null; prefill?: { customer: string; phone: string; province: string; scope: string }; right?: { jobId: string; rightId: string } } | null>(null);
  const [opp, setOpp] = useState<OppState | null>(() => {
    const st = Number(sp.get("step"));
    const step = (st === 4 ? 4 : st === 5 ? 5 : 1) as 1 | 4 | 5;
    if (sp.get("edit")) return { lead: null, editId: sp.get("edit"), step };
    return sp.get("new") === "1" ? { lead: null, editId: null, step } : null;
  });
  const dirtyRef = useRef(false);
  const onDirty = useCallback((d: boolean) => { dirtyRef.current = d; }, []);
  const [toastMsg, setToastMsg] = useState("");
  const [more, setMore] = useState(false);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [preset, setPreset] = useState<{ key: string; label: string } | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  /* ร้านที่รับงาน/พนักงานขายคำนวณจากตารางพื้นที่ (ไม่เก็บในข้อมูล) ; โค้ช/ร้านค้าเห็นเฉพาะร้านในขอบเขต */
  const scope = role === "coach" || role === "dealer" ? ROLE_STORES[role] : null;
  const dLeads = useMemo(() => leads.map((l) => {
    const base = { ...l, store: assignStore(coverage, l.province, l.district).store ?? undefined, owner: l.owner ?? ownerForProv(l.province) };
    if (base.status !== "waiting" || base.firstContactAt) return base;
    const { candidates } = assignStore(coverage, base.province, base.district);
    const hoursGone = (NOW.getTime() - new Date(base.createdAt).getTime()) / 3600e3;
    if (hoursGone <= slaHoursOf(base.channel) || candidates.length < 2) return base;
    return { ...base, store: candidates[1], _escalated: true };
  }), [leads, coverage]);
  const dJobs = useMemo(() => jobs.map((j) => ({ ...j, store: assignStore(coverage, j.province).store ?? undefined })), [jobs, coverage]);
  const dealerStore = scope?.length === 1 ? scope[0] : null;
  const dealerLeads = dealerStore ? dLeads.filter((l) => l.status === "dealer" && l.dealerStore === dealerStore) : [];
  const dealerLeadIds = new Set(dealerLeads.map((l) => l.id));
  const vLeads = readOnly && scope
    ? dLeads.filter((l) => (l.store && scope.includes(l.store)) || dealerLeadIds.has(l.id))
    : seFilter
    ? dLeads.filter((l) => l.owner === seNick)
    : dLeads;
  const vJobs = readOnly && scope
    ? dJobs.filter((j) => j.store && scope.includes(j.store))
    : seFilter
    ? dJobs.filter((j) => j.owner === seNick)
    : dJobs;
  const roleStores = role === "area" ? [...new Set(coverage.map((c) => c.store))] : scope ?? [];
  const tasks = useMemo(() => buildTasks(leads, jobs), [leads, jobs]);
  const urgent = tasks.filter((t) => t.priority === 1).length;
  const lead = leads.find((l) => l.id === leadId) ?? null;
  const job = jobs.find((j) => j.id === jobId) ?? null;
  const patchJob = (id: string, fn: (j: Job) => Job) => setJobs((all) => all.map((j) => (j.id === id ? fn(j) : j)));

  const changeRole = (r: Role) => {
    dirtyRef.current = false;
    setOpp(null); setLeadId(null); setJobId(null); setAddingLead(false); setSurvey(null);
    setRole(r);
    setView(r === "se" ? "home" : "pace");
  };
  const nav = readOnly ? NAV_RO : NAV;
  const roView = (what: string) => setToastMsg(`มุมมองนี้อ่านอย่างเดียว เปิดรายละเอียด${what}ได้เฉพาะพนักงานขาย`);
  const markRead = (ph: string) => setChatSt((s) => ({ ...s, lastRead: { ...s.lastRead, [ph]: NOW.toISOString() } }));
  const goView = (v: View) => {
    if (opp && dirtyRef.current && !window.confirm("ข้อมูลที่กรอกไว้ยังไม่ได้บันทึก ต้องการออกจากหน้านี้ไหม?")) return;
    dirtyRef.current = false;
    setOpp(null);
    setPreset(null);
    /* กดเมนูซ้าย = ปิดหน้ารายละเอียดที่เปิดค้างอยู่ แล้วไปหน้านั้น */
    setLeadId(null);
    setJobId(null);
    setCustPhone(null);
    setSurvey(null);
    setAddingLead(false);
    if (v === "inbox" && !chatSel.phone) {
      const top = chatRooms(chatSt)[0];
      if (top) { setChatSel({ phone: top, job: "" }); markRead(top); }
    }
    setView(v);
  };
  /** ส่งข้อความ/การ์ดเข้าห้องแชท LINE OA ของงาน (จำลอง) */
  const pushChat = (job: Job, m: Omit<ChatMsg, "id" | "at" | "phone" | "job">) => setChatSt((s) => ({ ...s, msgs: [...s.msgs, { ...m, phone: job.phone, job: job.opsId, id: `m${s.msgs.length + 1}-${Math.random().toString(36).slice(2, 6)}`, at: new Date(NOW.getTime() + (s.msgs.length % 3600) * 1000).toISOString() }] }));
  /** เปิดห้องแชทของลูกค้า (สร้างห้องให้ถ้ายังไม่มี) */
  const openChat = (phone: string, jobTag?: string) => {
    setChatSt((s) => ({
      ...s,
      msgs: s.msgs.some((m) => m.phone === phone) ? s.msgs : [...s.msgs, { id: "m" + (s.msgs.length + 1), phone, kind: "sys", at: NOW.toISOString(), job: jobTag, text: "เริ่มห้องแชท LINE OA (เดโม)" }],
      lastRead: { ...s.lastRead, [phone]: NOW.toISOString() },
    }));
    setChatSel({ phone, job: jobTag ?? "" });
    setLeadId(null); setJobId(null); setCustPhone(null); setOpp(null);
    setView("inbox");
  };
  const chatUnread = totalUnread(chatSt);
  const isActive = (k: View) => !opp && view === k;

  const openTask = (t: Task) => {
    setChat(false);
    if (t.kind === "intake_missing") {
      const j = jobs.find((x) => x.id === t.ref.id);
      const m = j?.intake ? missingOf(j.intake) : null;
      setJobId(null);
      setOpp({ lead: null, editId: t.ref.id, step: m && m.s4.length === 0 && m.s5 ? 5 : 4 });
    } else if (t.ref.type === "lead") setLeadId(t.ref.id);
    else setJobId(t.ref.id);
  };

  const ctx: Ctx = {
    leads: vLeads, jobs: vJobs, tasks, toast: setToastMsg, go: goView, me: seNick, nudges, sendNudge: (n) => setNudges((a) => [...a, { ...n, id: `N${a.length + 1}`, at: NOW.toISOString() }]), readNudge: (id) => setNudges((a) => a.map((n) => (n.id === id ? { ...n, readAt: NOW.toISOString() } : n))), preset, setPreset, goPreset: (v, p) => { goView(v); setPreset(p); }, readOnly, seNick: seFilter ? seNick : undefined,
    openLead: (id) => (readOnly ? roView(" Lead") : setLeadId(id)), openJob: (id) => (readOnly ? roView("งาน") : setJobId(id)), openTask, ask: () => setChat(true),
    addLead: () => setAddingLead(true),
    newSurvey: (l) => { setLeadId(null); setSurvey({ lead: l ?? null }); },
    newJob: () => setOpp({ lead: null, editId: null, step: 1 }),
  };

  const createSurvey = (i: SurveyInput) => {
    const now = NOW.toISOString();
    const id = `J-2611-${String(101 + jobs.length).padStart(4, "0")}`;
    const lid = i.leadId ?? nextLeadId();
    const created: Job = {
      id, opsId: id.replace("J-", "OP-"), leadId: lid, customer: i.customer, phone: i.phone, province: i.province, segment: "general", work: "survey", value: 0,
      model: i.model, owner: i.owner, startedAt: now, done: { plan_in: now }, scm: {}, lastTouchAt: now, scope: i.scope,
      log: [{ at: now, text: i.leadId ? `เปิด Opp ชนิดสำรวจจาก Lead ${i.leadId}` : "เปิด Opp ชนิดสำรวจ" }],
    };
    setJobs((all) => [created, ...all]);
    if (i.leadId) setLeads((all) => all.map((l) => (l.id === i.leadId ? { ...l, status: "converted" } : l)));
    else setLeads((all) => [{ id: lid, name: i.customer, phone: i.phone, product: "Smart Solution", channel: "ลูกค้าเดิม", province: i.province, createdAt: now, firstContactAt: now, status: "converted", note: "สร้างอัตโนมัติจากการเปิด Opp โดยตรง" }, ...all]);
    if (survey?.right) {
      const { jobId: rj, rightId } = survey.right;
      patchJob(rj, (j) => ({ ...j, rights: (j.rights ?? []).map((r) => (r.id === rightId ? { ...r, usedAt: now } : r)), log: [...j.log, { at: now, text: `ลูกค้าใช้สิทธิ์พิเศษ เปิด Opp ${id}` }] }));
    }
    setSurvey(null); setView("board"); setJobId(id);
    setToastMsg(`เปิด Opp สำรวจ ${id} แล้ว ขั้นต่อไป: เก็บค่าสำรวจและส่งงานให้ทีมสำรวจ`);
  };
  const nextLeadId = () => `L-2611-${String(30 + leads.length).padStart(3, "0")}`;
  const save = (i: NewJobInput, draft: boolean, editId: string | null) => {
    const now = NOW.toISOString();
    if (editId) {
      patchJob(editId, (j) => ({
        ...j, customer: i.customer, phone: i.phone, province: i.province, segment: i.segment, work: i.work, model: i.model, value: i.value, owner: i.owner,
        intake: i.intake, lastTouchAt: now, log: [...j.log, { at: now, text: "แก้ไขใบเปิดงาน" }],
      }));
      dirtyRef.current = false;
      setOpp(null);
      setJobId(editId);
      setToastMsg("บันทึกการแก้ไขใบเปิดงานแล้ว");
      return;
    }
    const id = `J-2611-${String(101 + jobs.length).padStart(4, "0")}`;
    const created: Job = {
      id, opsId: id.replace("J-", "OP-"), leadId: i.leadId, customer: i.customer, phone: i.phone, province: i.province, segment: i.segment, work: i.work,
      value: i.value, model: i.model, owner: i.owner, startedAt: now, done: { plan_in: now }, scm: {}, intake: i.intake, lastTouchAt: now,
      log: [{ at: now, text: (i.leadId ? `เปิด Opp จาก Lead ${i.leadId} และรับแบบจากลูกค้า` : "เปิด Opp และรับแบบจากลูกค้า") + (draft ? " (บันทึกร่าง)" : "") }],
    };
    setJobs((all) => [created, ...all]);
    if (i.leadId) setLeads((all) => all.map((l) => (l.id === i.leadId ? { ...l, status: "converted" } : l)));
    else {
      /* เปิด Opp ตรงโดยไม่ผ่าน Lead: สร้าง Lead ให้อัตโนมัติ เพื่อให้ทุก Opp มีต้นทาง */
      const lid = nextLeadId();
      created.leadId = lid;
      setLeads((all) => [{ id: lid, name: i.customer, phone: i.phone, product: "Roof Install", channel: "ลูกค้าเดิม", province: i.province, createdAt: now, firstContactAt: now, status: "converted", note: "สร้างอัตโนมัติจากการเปิด Opp โดยตรง" }, ...all]);
    }
    dirtyRef.current = false;
    setOpp(null);
    setLeadId(null);
    setView("board");
    setJobId(id);
    setToastMsg(draft ? `บันทึกร่าง Opp ${id} แล้ว ใบเปิดงานยังไม่ครบ กลับมาแก้ได้ที่หน้ารายละเอียดงาน` : `เปิด Opp ${id} แล้ว${i.work !== "roof" ? " และส่งข้อมูลให้ห้องแบบ" : ""}`);
  };

  return (
    <GuideCtx.Provider value={guideOn}>
    <div className="min-h-screen bg-[#f5f6fb] text-slate-800">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-[26rem] w-[26rem] rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[22rem] w-[22rem] rounded-full bg-cyan-300/20 blur-3xl" />
      </div>

      <div className="sticky top-0 z-[45] border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[11px] text-amber-800">
        หน้าตัวอย่าง (mock) — ข้อมูลสมมติ ไม่บันทึกลงระบบจริง · การเชื่อมกับ KIM / SCM / ห้องแบบ เป็นการจำลอง · เวลาถูกตรึงที่ 24 พ.ย. 2569 10:30
      </div>

      <aside className="fixed bottom-0 left-0 top-[29px] z-20 hidden w-64 flex-col border-r border-white/70 bg-white/70 p-4 backdrop-blur-xl lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className={cn("grid h-10 w-10 place-items-center rounded-2xl text-white shadow-lg shadow-indigo-500/30", grad)}><Icon name="hub" /></span>
          <div>
            <div className="text-[15px] font-bold leading-tight text-slate-900">CRM</div>
            <div className="text-[11px] text-slate-400">Housing Expert · ทีมขาย</div>
          </div>
        </div>
        <nav className="space-y-1">
          {nav.map((n) => (
            <button key={n.key} onClick={() => goView(n.key)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition", isActive(n.key) ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "text-slate-600 hover:bg-indigo-50")}>
              <Icon name={n.icon} fill={isActive(n.key)} />{n.label}
              {n.key === "inbox" && chatUnread > 0 && <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold", isActive(n.key) ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700")}>{chatUnread}</span>}
              {n.key === "pace" && !readOnly && unreadNudges(nudges, seNick) > 0 && <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold", isActive(n.key) ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700")}>{unreadNudges(nudges, seNick)}</span>}
                  {n.key === "home" && urgent > 0 && <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold", isActive(n.key) ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700")}>{urgent}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-6 space-y-1.5 px-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">หน่วยงานที่เชื่อมต่อ</div>
          {(["KIM", "SCM", "ROOM", "SURV"] as const).map((p) => (
            <div key={p} className="flex items-center gap-2 text-[12px] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />{PARTY[p].label}<span className="text-[10.5px] text-slate-400">· {PARTY[p].sub.split(" · ")[0]}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setChat(true)} className={cn("mt-auto rounded-2xl p-4 text-left text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5", grad)}>
          <Icon name="auto_awesome" />
          <div className="mt-1 text-[13.5px] font-bold">ถามน้องเลขา</div>
          <div className="text-[11.5px] text-white/80">สรุปงาน ร่างข้อความ ตามหน่วยงาน</div>
        </button>
      </aside>

      <main className="relative z-10 px-4 pb-28 pt-5 md:px-8 lg:ml-64 lg:pb-10">
        <div className="mx-auto max-w-[1400px]">
          <RoleBar role={role} onChange={changeRole} guide={guidePref} onGuide={setGuideOn} />
          {opp ? (
            <NewOppPage key={`${opp.editId ?? "new"}-${opp.lead?.id ?? ""}`} lead={opp.lead} editJob={opp.editId ? jobs.find((j) => j.id === opp.editId) ?? null : null} jobs={jobs}
              initialStep={opp.step} onDirty={onDirty} toast={setToastMsg} onSave={save}
              onCancel={() => { dirtyRef.current = false; setOpp(null); }} />
          ) : (
            <>
              {view === "home" && <HomeView c={ctx} />}
              {view === "pace" && <PaceView c={ctx} role={role} stores={role === "se" ? [] : roleStores} />}
          {view === "perf" && !readOnly && <PerformanceView c={ctx} />}
          {view === "overview" && <OverviewView c={ctx} />}
          {view === "aftersale" && <AftersaleView c={ctx} />}
          {view === "leads" && <LeadsView c={ctx} />}
              {view === "board" && <BoardView c={ctx} />}
              {view === "exchange" && <ExchangeView c={ctx} />}
              {view === "areas" && !readOnly && <AreasView coverage={coverage} setCoverage={setCoverage} />}
              {view === "inbox" && !readOnly && (
                <InboxView st={chatSt} setSt={setChatSt} sel={chatSel} setSel={setChatSel} leads={vLeads} jobs={vJobs} me={seNick}
                  onPatchLead={(id, p) => setLeads((all) => all.map((l) => (l.id === id ? { ...l, ...p } : l)))} onPatchJob={patchJob}
                  openLead={setLeadId} openJob={setJobId} openAccount={setCustPhone} toast={setToastMsg} />
              )}
              {view === "customers" && !readOnly && <CustomersView jobs={jobs} openCustomer={setCustPhone} />}
              {view === "report" && readOnly && <ReportView role={role as Exclude<Role, "se">} c={ctx} stores={roleStores} />}
            </>
          )}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/70 bg-white/90 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-xl lg:hidden">
        {(readOnly ? NAV_RO.slice(0, 3) : MOBILE_MAIN.map((k) => NAV.find((n) => n.key === k)!)).map((n) => (
          <button key={n.key} onClick={() => goView(n.key)} className={cn("relative flex flex-col items-center gap-0.5 px-1.5 py-1 text-[10px] font-semibold", isActive(n.key) ? "text-indigo-600" : "text-slate-400")}>
            <Icon name={n.icon} fill={isActive(n.key)} />{n.label}
            {n.key === "inbox" && chatUnread > 0 && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-rose-500" />}
          </button>
        ))}
        <button onClick={() => setMore(true)} className={cn("flex flex-col items-center gap-0.5 px-1.5 py-1 text-[10px] font-semibold", (readOnly ? NAV_RO.slice(3) : MOBILE_MORE.map((k) => NAV.find((n) => n.key === k)!)).some((n) => isActive(n.key)) ? "text-indigo-600" : "text-slate-400")}><Icon name="apps" />เพิ่มเติม</button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-[13px] font-bold text-slate-900">เมนูเพิ่มเติม</p>
            <div className="grid grid-cols-3 gap-2">
              {(readOnly ? NAV_RO.slice(3) : MOBILE_MORE.map((k) => NAV.find((n) => n.key === k)!)).map((n) => (
                <button key={n.key} onClick={() => { setMore(false); goView(n.key); }} className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-[11px] font-semibold text-slate-700 active:scale-95"><Icon name={n.icon} className="text-indigo-600" />{n.label}</button>
              ))}
              <button onClick={() => { setMore(false); setChat(true); }} className="flex flex-col items-center gap-1 rounded-2xl border border-violet-200 bg-violet-50 py-3 text-[11px] font-semibold text-violet-700 active:scale-95"><Icon name="auto_awesome" />น้องเลขา</button>
            </div>
          </div>
        </div>
      )}
      <LeadDrawer onOpenChat={openChat} me={seNick} isDealerView={role === "dealer"} lead={lead} tasks={tasks} onClose={() => setLeadId(null)} toast={setToastMsg}
        onPatch={(id, p) => setLeads((all) => all.map((l) => (l.id === id ? { ...l, ...p } : l)))}
        onConvert={(l) => { setLeadId(null); setOpp({ lead: l, editId: null, step: 1 }); }} onConvertSurvey={(l) => ctx.newSurvey(l)} />
      <JobDrawer onOpenChat={openChat} onSendLine={pushChat} job={job} onPatchJob={patchJob} tasks={tasks} onClose={() => setJobId(null)} toast={setToastMsg}
        onEditIntake={(id) => { setJobId(null); setOpp({ lead: null, editId: id, step: 1 }); }}
        onComplete={(id, key, extra) => patchJob(id, (j) => completeStep(j, key, extra))}
        onRevise={(id, cats) => patchJob(id, (j) => ({ ...j, revise: cats, log: [...j.log, { at: NOW.toISOString(), text: "ทีมขายปรับหมวดที่ต้องถอดแบบใหม่หลังสำรวจ (Revise)" }] }))}
        onScm={(id, ev: ScmEvent) => patchJob(id, (j) => {
          const now = NOW.toISOString();
          return ev === "ordered"
            ? { ...j, scm: { ...j.scm, ordered: now }, lastTouchAt: now, log: [...j.log, { at: now, text: "SCM แจ้ง: สั่งซื้อสินค้ากับโรงงานแล้ว" }] }
            : { ...j, scm: { ...j.scm, readyEta: addWd(now, 7) }, lastTouchAt: now, log: [...j.log, { at: now, text: "SCM แจ้ง: คาดว่าสินค้าครบภายใน 7 วันทำการ" }] };
        })}
        onCancel={(id, reason) => { patchJob(id, (j) => ({ ...j, cancelReason: reason, lastTouchAt: NOW.toISOString(), log: [...j.log, { at: NOW.toISOString(), text: `ยกเลิกงาน: ${reason}` }] })); setToastMsg("ยกเลิกงานแล้ว"); }} />
      <AddLeadDrawer coverage={coverage} open={addingLead} onClose={() => setAddingLead(false)} nextId={nextLeadId()}
        onAdd={(l) => { setLeads((all) => [l, ...all]); setView("leads"); setToastMsg(`เพิ่ม Lead ${l.id} แล้ว`); }} />
      <NewSurveyDrawer open={!!survey} lead={survey?.lead ?? null} prefill={survey?.prefill} onClose={() => setSurvey(null)} onCreate={createSurvey} />
      <Customer360Drawer onOpenChat={openChat} phone={custPhone} jobs={jobs} onClose={() => setCustPhone(null)} openJob={(id) => { setCustPhone(null); setJobId(id); }}
        onUseRight={(j, r) => { setCustPhone(null); setSurvey({ lead: null, prefill: { customer: j.customer, phone: j.phone, province: j.province, scope: r.name }, right: { jobId: j.id, rightId: r.id } }); }} />
      <ChatDrawer open={chat} onClose={() => setChat(false)} leads={leads} jobs={jobs} tasks={tasks} onTask={openTask} onJob={(id) => { setChat(false); setJobId(id); }} onLead={(id) => { setChat(false); setLeadId(id); }} toast={setToastMsg} />

      <div className={cn("pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-[12.5px] font-medium text-white shadow-xl transition-all duration-300 lg:bottom-8", toastMsg ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
        {toastMsg}
      </div>
    </div>
    </GuideCtx.Provider>
  );
}
