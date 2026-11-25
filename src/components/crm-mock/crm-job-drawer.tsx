"use client";
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  CAT_LABEL, MODEL_LABEL, NOW, PARTY, catsOf, depositLabel, lockedOf, reviseOf, SEGMENT_LABEL, WORK_LABEL, addWd, agoText, baht, currentStep, dateTh, depositOf, dtTh, dueLabel, dueOf, hasDeposit, isFinished, isToday, lateWd, packetsOf, planTotals, stepsOf, type Cat, type Job, type StepDef, type StepKey, type Task, valueText,
} from "./crm-mock-data";
import { IntakeCard } from "./crm-intake-card";
import { Drawer, KV, PartyBadge, btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";

export type ScmEvent = "ordered" | "eta";

export function JobDrawer({ job, tasks, onClose, onComplete, onRevise, onScm, onCancel, onEditIntake, toast }: {
  onEditIntake: (id: string) => void;
  job: Job | null; tasks: Task[]; onClose: () => void; onComplete: (id: string, key: StepKey, extra?: { surveyAt?: string }) => void;
  onRevise: (id: string, cats: Cat[]) => void;
  onScm: (id: string, ev: ScmEvent) => void; onCancel: (id: string, reason: string) => void; toast: (m: string) => void;
}) {
  return (
    <Drawer open={!!job} onClose={onClose} wide title={job?.customer ?? ""} subtitle={job ? `${job.id} · ${job.opsId} · ${job.province}` : ""}>
      {job && <JobBody key={job.id} job={job} task={tasks.find((t) => t.ref.id === job.id)} onComplete={onComplete} onRevise={onRevise} onScm={onScm} onCancel={onCancel} onEditIntake={onEditIntake} toast={toast} />}
    </Drawer>
  );
}

function JobBody({ job, task, onComplete, onRevise, onScm, onCancel, onEditIntake, toast }: {
  onEditIntake: (id: string) => void;
  job: Job; task?: Task; onComplete: (id: string, key: StepKey, extra?: { surveyAt?: string }) => void; onScm: (id: string, ev: ScmEvent) => void;
  onRevise: (id: string, cats: Cat[]) => void;
  onCancel: (id: string, reason: string) => void; toast: (m: string) => void;
}) {
  const steps = stepsOf(job);
  const cur = currentStep(job);
  const totals = planTotals(steps);
  const [surveyAt, setSurveyAt] = useState(() => `${addWd(NOW.toISOString(), 3).slice(0, 10)}T10:00`);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const packets = packetsOf(job);
  const dep = depositOf(job);
  const finished = isFinished(job);
  const closed = !!job.done.close;

  return (
    <>
      <div className={cn(glass, "p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-[11.5px] font-bold", job.segment === "hbd" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600")}>{SEGMENT_LABEL[job.segment]}</span>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11.5px] font-bold text-indigo-700">{WORK_LABEL[job.work]}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[11.5px] font-bold text-amber-800">{MODEL_LABEL[job.model]}</span>
          <span className="ml-auto text-[20px] font-bold tracking-tight text-indigo-700">{valueText(job)}</span>
        </div>
        <p className="mt-2 text-[12px] text-slate-500">
          แผน PT: รับแบบ → ส่งมอบรวม <b className="text-slate-700">{totals.total} วันทำการ</b> · ปิดขาย → ส่งมอบ <b className="text-slate-700">{totals.afterClose} วันทำการ</b>
          {job.cancelReason && <span className="ml-2 font-semibold text-rose-600">ยกเลิก: {job.cancelReason}</span>}
          {finished && <span className="ml-2 font-semibold text-emerald-600">จบงานแล้ว</span>}
        </p>
      </div>

      {task && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-violet-700"><Icon name="auto_awesome" style={{ fontSize: 16 }} />น้องเลขาแนะนำ</div>
          <p className="text-[13px] font-semibold text-slate-800">{task.title}</p>
          <p className="text-[12px] text-slate-600">{task.reason}</p>
          {task.draft && (
            <div className="mt-2 rounded-xl bg-white/80 p-3">
              <p className="text-[12px] leading-relaxed text-slate-600">{task.draft}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => { void navigator.clipboard?.writeText(task.draft ?? ""); toast("คัดลอกข้อความแล้ว"); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">คัดลอก</button>
                <button onClick={() => toast(task.party ? `ส่งข้อความถึงทีม ${PARTY[task.party].label} แล้ว (ตัวอย่าง)` : `ส่งข้อความถึง ${job.customer} แล้ว (ตัวอย่าง)`)} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white">{task.party ? "ส่งให้หน่วยงาน" : "ส่งทาง LINE"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={cn(glass, "p-4")}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-bold text-slate-900">ขั้นตอนตาม Project Timeline</h3>
          <span className="text-[11px] text-slate-400">{steps.filter((s) => job.done[s.key]).length}/{steps.length} ขั้น</span>
        </div>
        <ol className="space-y-0">
          {steps.map((s, i) => (
            <StepRow key={s.key} s={s} job={job} last={i === steps.length - 1} isCur={cur?.key === s.key}
              surveyAt={surveyAt} setSurveyAt={setSurveyAt} onComplete={onComplete} onScm={onScm} toast={toast} />
          ))}
        </ol>
      </div>

      {job.work !== "survey" && <IntakeCard job={job} onEdit={() => onEditIntake(job.id)} />}

      {job.work !== "survey" && <TakeoffCard job={job} onRevise={onRevise} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(glass, "p-4")}>
          <h3 className="mb-1 text-[13px] font-bold text-slate-900">ใบเสนอราคาและการเงิน</h3>
          {job.work !== "survey" && <KV k="ใบเสนอราคาจากแบบ" v={job.done.quote1 ? `ส่งแล้ว ${dateTh(job.done.quote1)} · ${baht(job.quote1Value ?? job.value)}` : "ยังไม่ส่ง"} />}
          {hasDeposit(job) && <KV k="ใบเสนอราคาหลังสำรวจ" v={job.done.quote2 ? `ส่งแล้ว ${dateTh(job.done.quote2)} · ${baht(job.value)}` : !job.done.survey ? (job.work === "survey" ? "รอรายงานสำรวจจากทีมสำรวจ" : "รอรายงานสำรวจจาก KIM") : job.work !== "roof" && job.work !== "survey" && !job.done.truss_design ? "รอแบบทรัส + Cutting List จากห้องแบบ" : "พร้อมทำใบเสนอราคา"} />}
          {hasDeposit(job) && <KV k={job.work === "survey" ? "หักค่าสำรวจออกจากค่าติดตั้ง" : "หักส่วนลดค่าเตรียมการ (มัดจำที่ชำระแล้ว)"} v={<span className={job.done.deposit ? "text-rose-600" : "text-slate-400"}>{job.done.deposit ? `−${baht(dep)}` : `จะหักเมื่อรับมัดจำ ${baht(dep)}`} {job.value > 0 ? ` · ยอดส่วนที่เหลือ ${baht(job.value - dep)}` : " · รอใบเสนอราคา"}</span>} />}
          {hasDeposit(job) && <KV k={depositLabel(job)} v={<span className={job.done.deposit ? "text-emerald-700" : "text-amber-700"}>{baht(dep)} · {job.done.deposit ? `รับแล้ว ${dateTh(job.done.deposit)}` : "ยังไม่ได้รับ"}</span>} />}
          <KV k="เก็บครบ 100%" v={<span className={closed ? "text-emerald-700" : "text-slate-800"}>{baht(job.value)} · {closed ? `ครบ ${dateTh(job.done.close)}` : (job.value > 0 ? `คงเหลือ ${baht(job.value - dep)}` : "รอใบเสนอราคา")}</span>} />
          {job.surveyAt && <KV k="วันนัดสำรวจ" v={<span className={isToday(job.surveyAt) ? "text-cyan-700" : ""}>{dtTh(job.surveyAt)}{isToday(job.surveyAt) ? " (วันนี้)" : ""}</span>} />}
          {job.scope && <KV k="งาน" v={job.scope} />}
          <KV k="ผู้ดูแล" v={job.owner} />
          <KV k="เบอร์ลูกค้า" v={job.phone} />
        </div>
        <div className={cn(glass, "p-4")}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-slate-900">สถานะสินค้า (จาก SCM)</h3>
            <PartyBadge party="SCM" />
          </div>
          {!job.done.deposit && !closed ? <p className="py-3 text-[12px] text-slate-400">SCM จะได้รับรายการจองสินค้าเมื่อรับมัดจำ{job.segment === "hbd" ? " (งาน HBD ส่งใบเสนอราคาให้ SCM ตอนปิดขาย)" : ""}</p> : (
            <>
              <KV k="รายการจองสินค้า" v={job.done.deposit ? `ส่งแล้ว ${dateTh(job.done.deposit)}` : "ไม่มี (ปิดขายจากแบบ)"} />
              <KV k="ใบเสนอราคาฉบับแก้ไข" v={closed ? `ส่งแล้ว ${dateTh(job.done.close)}` : "รอปิดขาย"} />
              <KV k="สั่งซื้อโรงงาน" v={job.scm.ordered ? `สั่งแล้ว ${dateTh(job.scm.ordered)}` : closed ? <span className="text-amber-700">รอ SCM Map และสั่งซื้อ</span> : "-"} />
              <KV k="สินค้าครบ (คาด)" v={job.scm.readyEta ? dateTh(job.scm.readyEta) : "-"} />
              {closed && !finished && !job.cancelReason && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!job.scm.ordered && <button onClick={() => { onScm(job.id, "ordered"); toast("SCM แจ้งสั่งซื้อโรงงานแล้ว (จำลอง)"); }} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">จำลอง: SCM สั่งซื้อแล้ว</button>}
                  {job.scm.ordered && !job.scm.readyEta && <button onClick={() => { onScm(job.id, "eta"); toast("SCM แจ้งวันที่สินค้าครบแล้ว (จำลอง)"); }} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">จำลอง: SCM แจ้งวันสินค้าครบ</button>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className={cn(glass, "p-4")}>
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">ข้อมูลที่แลกกับหน่วยงาน</h3>
        <ul className="space-y-1.5">
          {packets.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px]">
              <PartyBadge party={p.party} />
              <span className="shrink-0 text-slate-400">{p.dir === "out" ? "CRM →" : "→ CRM"}</span>
              <span className="min-w-0 flex-1 truncate text-slate-700">{p.title}</span>
              {p.state === "waiting" ? <span className={cn("shrink-0 text-[10.5px] font-bold", lateWd(p.due!) > 0 ? "text-rose-600" : "text-amber-600")}>รอ · {dueLabel(p.due!)}</span>
                : <span className="shrink-0 text-[10.5px] text-slate-400">{p.state === "sent" ? "ส่งแล้ว" : "รับแล้ว"} {dateTh(p.at)}</span>}
            </li>
          ))}
          {packets.length === 0 && <li className="text-[12px] text-slate-400">ยังไม่มีการส่งข้อมูลให้หน่วยงานอื่น</li>}
        </ul>
      </div>

      <div className={cn(glass, "p-4")}>
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">ประวัติ</h3>
        <ul className="space-y-2">
          {[...job.log].sort((a, b) => +new Date(b.at) - +new Date(a.at)).map((l, i) => (
            <li key={i} className="flex gap-2 text-[12px]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" /><span className="text-slate-700">{l.text}<span className="ml-2 text-slate-400">{dtTh(l.at)}</span></span></li>
          ))}
          {job.log.length === 0 && <li className="text-[12px] text-slate-400">ยังไม่มีประวัติ</li>}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">เคลื่อนไหวล่าสุด {agoText(job.lastTouchAt)}</p>
      </div>

      {!job.cancelReason && !finished && (
        <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
          {!cancelling ? <button onClick={() => setCancelling(true)} className="rounded-xl px-3 py-2 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50">ยกเลิกงาน</button> : (
            <>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลที่ยกเลิก" className={cn(inputCls, "w-52")} />
              <button disabled={!reason.trim()} onClick={() => onCancel(job.id, reason.trim())} className="rounded-xl bg-rose-600 px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-40">ยืนยัน</button>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** ถอดแบบรายหมวดโดยทีมขาย: เบื้องต้น (ก่อนเสนอราคา) และหลังสำรวจ (Confirm = ใช้ผลเดิม / Revise = ถอดใหม่ตามรายงานสำรวจ)
    หมวดอะเส/ทรัสต้องใช้ผลจากห้องแบบ (ขีดแนวอะเส, แบบทรัส + Cutting List) */
function TakeoffCard({ job, onRevise }: { job: Job; onRevise: (id: string, cats: Cat[]) => void }) {
  const cats = catsOf(job.work);
  const hbd = job.segment === "hbd";
  const rev = reviseOf(job);
  const locked = lockedOf(job);
  const canToggle = !hbd && !job.done.quote2 && !job.cancelReason;
  const roomCat = (c: Cat) => c === "ase" || c === "truss";
  const roomPreDone = hbd ? !!job.done.truss_design : !!job.done.ase_mark;
  const prelim = (c: Cat) => {
    if (roomCat(c) && job.work !== "roof" && !roomPreDone) return <span className="font-semibold text-fuchsia-700">รอห้องแบบ</span>;
    return job.done.quote1 ? <span className="font-semibold text-emerald-700">ถอดแล้ว</span> : <span className="font-semibold text-amber-700">ทีมขายกำลังถอด</span>;
  };
  const post = (c: Cat) => {
    if (!rev.includes(c)) return <span className="text-slate-500">ใช้ผลเดิม</span>;
    if (roomCat(c) && locked.includes(c)) return job.done.truss_design ? <span className="font-semibold text-emerald-700">ได้แบบใหม่จากห้องแบบแล้ว</span> : job.done.survey ? <span className="font-semibold text-fuchsia-700">รอห้องแบบ</span> : <span className="text-slate-400">รอผลสำรวจ</span>;
    return job.done.quote2 ? <span className="font-semibold text-emerald-700">ถอดใหม่แล้ว</span> : job.done.survey ? <span className="font-semibold text-amber-700">ทีมขายกำลังถอดใหม่</span> : <span className="text-slate-400">รอผลสำรวจ</span>;
  };
  const toggle = (c: Cat) => onRevise(job.id, rev.includes(c) ? (job.revise ?? []).filter((x) => x !== c) : [...(job.revise ?? []), c]);
  return (
    <div className={cn(glass, "p-4")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-slate-900">ถอดแบบรายหมวด</h3>
        <PartyBadge party="SE" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-[12px]">
          <thead className="text-[10.5px] uppercase tracking-wide text-slate-400">
            <tr><th className="py-1 pr-2 font-semibold">หมวดงาน</th><th className="px-2 py-1 font-semibold">ถอดแบบเบื้องต้น</th>{!hbd && <th className="px-2 py-1 font-semibold">หลังสำรวจ</th>}{!hbd && <th className="py-1 pl-2 text-right font-semibold">Confirm / Revise</th>}</tr>
          </thead>
          <tbody>
            {cats.map((c) => {
              const isRev = rev.includes(c);
              return (
                <tr key={c} className="border-t border-slate-100">
                  <td className="py-2 pr-2 font-medium text-slate-800">{CAT_LABEL[c]}{roomCat(c) && job.work !== "roof" && <div className="text-[10.5px] font-normal text-fuchsia-700">ใช้ผลจากห้องแบบ</div>}</td>
                  <td className="px-2 py-2">{prelim(c)}</td>
                  {!hbd && <td className="px-2 py-2">{post(c)}</td>}
                  {!hbd && (
                    <td className="py-2 pl-2 text-right">
                      <span className="inline-flex rounded-lg bg-slate-100 p-0.5">
                        {(["Confirm", "Revise"] as const).map((m) => {
                          const on = (m === "Revise") === isRev;
                          const disabled = !canToggle || locked.includes(c);
                          return (
                            <button key={m} disabled={disabled || on} onClick={() => toggle(c)}
                              className={cn("rounded-md px-2 py-0.5 text-[10.5px] font-semibold transition", on ? (m === "Revise" ? "bg-fuchsia-600 text-white" : "bg-white text-slate-700 shadow-sm") : "text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:hover:text-slate-400")}>
                              {m}
                            </button>
                          );
                        })}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        {hbd ? "ลูกค้า HBD ปิดขายจากแบบ ทีมขายถอดแบบจากแบบที่ลูกค้าส่งมา (หมวดอะเส/ทรัสใช้ผลจากห้องแบบ) ไม่มีขั้นสำรวจ" : "ทีมขายถอดแบบเอง · Confirm = ใช้ผลเบื้องต้นเดิม · Revise = ถอดใหม่ตามรายงานสำรวจ (โครงทรัส/อะเสเป็น Revise เสมอ เพราะใช้แบบทรัส + Cutting List ใหม่จากห้องแบบ)"}
      </p>
    </div>
  );
}

function StepRow({ s, job, last, isCur, surveyAt, setSurveyAt, onComplete, onScm, toast }: {
  s: StepDef; job: Job; last: boolean; isCur: boolean; surveyAt: string; setSurveyAt: (v: string) => void;
  onComplete: (id: string, key: StepKey, extra?: { surveyAt?: string }) => void; onScm: (id: string, ev: ScmEvent) => void; toast: (m: string) => void;
}) {
  const done = job.done[s.key];
  const due = dueOf(job, s);
  const late = isCur ? lateWd(due) : 0;
  const owner = PARTY[s.owner];
  const outs = s.sends.filter((x) => x.at === "done");
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span className={cn("absolute left-[15px] top-8 h-[calc(100%-18px)] w-0.5", done ? "bg-emerald-400" : "bg-slate-200")} />}
      <span className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full", done ? "bg-emerald-500 text-white" : late > 0 ? "bg-rose-500 text-white" : isCur ? "bg-indigo-600 text-white ring-4 ring-indigo-100" : "bg-slate-100 text-slate-400")}>
        <Icon name={done ? "check" : owner.icon} style={{ fontSize: 18 }} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-[13px] font-semibold", done || isCur ? "text-slate-900" : "text-slate-400")}>{s.label}</span>
          <PartyBadge party={s.owner} className={!done && !isCur ? "opacity-60" : ""} />
        </div>
        <div className={cn("text-[11.5px]", late > 0 ? "font-semibold text-rose-600" : "text-slate-500")}>
          {done ? `เสร็จ ${dtTh(done)}` : isCur ? `${dueLabel(due)} · กำหนด ${dateTh(due)}` : `แผน ${dateTh(due)}`}
          {done && new Date(done).getTime() > new Date(due).getTime() + 86400e3 ? <span className="ml-1 text-amber-600">(ช้ากว่าแผน)</span> : null}
        </div>
        {isCur && <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{s.hint}</p>}

        {isCur && s.owner === "SE" && (
          <div className="mt-2 space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
            {s.key === "deposit" && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">วันที่ล็อกคิวเข้าสำรวจ</span>
                <input type="datetime-local" value={surveyAt} onChange={(e) => setSurveyAt(e.target.value)} className={inputCls} />
              </label>
            )}
            {outs.length > 0 && (
              <div className="text-[11.5px] text-slate-600">
                เมื่อทำเสร็จ CRM จะส่งอัตโนมัติ:
                <ul className="mt-1 space-y-0.5">
                  {outs.map((o, i) => <li key={i} className="flex items-center gap-1.5"><PartyBadge party={o.party} /><span>{o.title}</span></li>)}
                </ul>
              </div>
            )}
            <button
              onClick={() => { onComplete(job.id, s.key, s.key === "deposit" ? { surveyAt: new Date(`${surveyAt}:00+07:00`).toISOString() } : undefined); toast(outs.length ? `บันทึกแล้ว และส่งข้อมูลให้ ${outs.map((o) => PARTY[o.party].label).join(" + ")}` : `บันทึก "${s.label}" แล้ว`); }}
              className={btnPrimary}>
              <Icon name="task_alt" style={{ fontSize: 18 }} />{s.key === "deposit" ? (job.work === "survey" ? "รับค่าสำรวจ + ส่งงานให้ทีมสำรวจ" : "รับมัดจำ + ล็อกคิวสำรวจ") : s.key === "close" ? "บันทึกรับเงินครบ 100%" : `ทำเสร็จ: ${s.label}`}
            </button>
          </div>
        )}

        {isCur && s.owner !== "SE" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <span className="text-[11.5px] text-slate-600">รอ <b>{owner.label}</b> ส่ง &quot;{s.result}&quot; กลับมา</span>
            <button onClick={() => { onComplete(job.id, s.key); toast(`${owner.label} ส่ง "${s.result}" กลับมาแล้ว (จำลอง)`); }} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}>จำลอง: {owner.label}ส่งข้อมูลกลับ</button>
            {s.key === "deliver" && job.done.close && !job.scm.ordered && <button onClick={() => { onScm(job.id, "ordered"); toast("SCM แจ้งสั่งซื้อโรงงานแล้ว (จำลอง)"); }} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}>จำลอง: SCM สั่งซื้อแล้ว</button>}
          </div>
        )}
      </div>
    </li>
  );
}
