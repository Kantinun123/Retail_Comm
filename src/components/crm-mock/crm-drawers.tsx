"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  AFTER_STEPS, CHANNELS, LEAD_STATUS, LOST_REASONS, NOW, OWNERS, PACKAGES, PRODUCTS, STAGES, TASK_ICON, agoText, atRisk, baht, dateTh, depositOf, dtTh, durText, hoursSince,
  isToday, leadSla, stageMeta, type Job, type Lead, type Stage, type Task,
} from "./crm-mock-data";
import { Avatar, Drawer, Field, KV, SlaBadge, btnGhost, btnPrimary, glass, grad, inputCls } from "./crm-ui";

/* ---------------- Lead ---------------- */
export function LeadDrawer({ lead, tasks, onClose, onPatch, onConvert, toast }: {
  lead: Lead | null; tasks: Task[]; onClose: () => void; onPatch: (id: string, p: Partial<Lead>) => void; onConvert: (l: Lead) => void; toast: (m: string) => void;
}) {
  return (
    <Drawer open={!!lead} onClose={onClose} title={lead?.name ?? ""} subtitle={lead ? `${lead.id} · ${lead.province}` : ""}>
      {lead && <LeadBody key={lead.id} lead={lead} task={tasks.find((t) => t.ref.id === lead.id)} onPatch={onPatch} onConvert={onConvert} toast={toast} />}
    </Drawer>
  );
}
function LeadBody({ lead, task, onPatch, onConvert, toast }: { lead: Lead; task?: Task; onPatch: (id: string, p: Partial<Lead>) => void; onConvert: (l: Lead) => void; toast: (m: string) => void }) {
  const [note, setNote] = useState(lead.note ?? "");
  const [checks, setChecks] = useState({ budget: false, area: false, ready: false });
  const [lost, setLost] = useState(false);
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const allOk = checks.budget && checks.area && checks.ready;
  const open = lead.status === "waiting" || lead.status === "contacting" || lead.status === "qualified";
  const logContact = () => {
    onPatch(lead.id, { firstContactAt: lead.firstContactAt ?? NOW.toISOString(), status: lead.status === "waiting" ? "contacting" : lead.status, note });
    toast("บันทึกการติดต่อแล้ว");
  };
  return (
    <>
      <div className={cn(glass, "flex items-center gap-3 p-4")}>
        <Avatar name={lead.name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-900">{lead.name}</div>
          <div className="text-[12px] text-slate-500">{lead.phone}</div>
        </div>
        <button onClick={() => toast(`กำลังโทร ${lead.phone} (ตัวอย่าง)`)} className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><Icon name="call" /></button>
      </div>

      {task && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-violet-700"><Icon name="auto_awesome" style={{ fontSize: 16 }} />น้องเลขาแนะนำ</div>
          <p className="text-[12.5px] text-slate-700">{task.reason}</p>
          {task.draft && <p className="mt-2 rounded-xl bg-white/80 p-3 text-[12px] leading-relaxed text-slate-600">{task.draft}</p>}
        </div>
      )}

      <div className={cn(glass, "p-4")}>
        <KV k="สถานะ" v={<span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", LEAD_STATUS[lead.status].cls)}>{LEAD_STATUS[lead.status].label}</span>} />
        <KV k="สนใจ" v={lead.product} />
        <KV k="ช่องทาง" v={lead.channel} />
        <KV k="เข้ามาเมื่อ" v={`${dtTh(lead.createdAt)} (${agoText(lead.createdAt)})`} />
        <KV k="ติดต่อครั้งแรก" v={lead.firstContactAt ? dtTh(lead.firstContactAt) : "ยังไม่ติดต่อ"} />
        <KV k="SLA" v={<SlaBadge lead={lead} />} />
        {lead.interest && <KV k="ความต้องการ" v={lead.interest} />}
        {lead.lostReason && <KV k="เหตุผล Loss" v={lead.lostReason} />}
      </div>

      {open && (
        <div className={cn(glass, "space-y-3 p-4")}>
          <h3 className="text-[13px] font-bold text-slate-900">สกรีน Lead</h3>
          {([["budget", "งบประมาณตรงกับที่รับงาน"], ["area", "หน้างานอยู่ในพื้นที่บริการ"], ["ready", "ลูกค้าพร้อมให้ทีมเข้าสำรวจ/ออกแบบ"]] as const).map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-slate-700">
              <input type="checkbox" checked={checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} className="h-4 w-4 accent-indigo-600" />{label}
            </label>
          ))}
          <Field label="บันทึกการคุย"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputCls} placeholder="สรุปสิ่งที่คุยกับลูกค้า" /></Field>
          {allOk && lead.status !== "qualified" && <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700"><Icon name="check_circle" style={{ fontSize: 16 }} />ผ่านครบทุกเงื่อนไข น้องเลขาแนะนำให้เปิด Ops ได้เลย</p>}
          {lost && (
            <Field label="เหตุผลที่ Loss">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
          )}
        </div>
      )}

      {open && (
        <div className="flex flex-wrap gap-2 pb-2">
          <button onClick={logContact} className={btnGhost}><Icon name="edit_note" style={{ fontSize: 18 }} />บันทึกการติดต่อ</button>
          {allOk && lead.status !== "qualified" && <button onClick={() => { onPatch(lead.id, { status: "qualified", note, firstContactAt: lead.firstContactAt ?? NOW.toISOString() }); toast("ผ่านการสกรีน รอเปิด Ops"); }} className={btnGhost}>ผ่านเงื่อนไข</button>}
          <button onClick={() => onConvert({ ...lead, note })} className={btnPrimary}><Icon name="rocket_launch" style={{ fontSize: 18 }} />เปิด Ops</button>
          {!lost ? <button onClick={() => setLost(true)} className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-rose-600 hover:bg-rose-50">Loss</button>
            : <button onClick={() => { onPatch(lead.id, { status: "lost", lostReason: reason, note, firstContactAt: lead.firstContactAt }); toast("บันทึก Loss แล้ว"); }} className="rounded-xl bg-rose-600 px-3.5 py-2.5 text-[13px] font-bold text-white">ยืนยัน Loss</button>}
        </div>
      )}
    </>
  );
}

/* ---------------- Job ---------------- */
export const NEXT: Partial<Record<Stage, { label: string; to: Stage }>> = {
  design: { label: "ส่งใบเสนอราคาเบื้องต้น", to: "quote" },
  quote: { label: "ลูกค้าตกลง · ออกใบแจ้งมัดจำ", to: "deposit" },
  deposit: { label: "บันทึกรับมัดจำแล้ว", to: "survey" },
  survey: { label: "สำรวจเสร็จ · ทำราคา Final", to: "final" },
  final: { label: "ลูกค้ายืนยันราคา Final", to: "collect" },
  collect: { label: "บันทึกรับเงินครบ 100%", to: "aftersale" },
};

export function JobDrawer({ job, tasks, onClose, onAdvance, onSurvey, onAfter, onCancel, toast }: {
  job: Job | null; tasks: Task[]; onClose: () => void; onAdvance: (id: string) => void; onSurvey: (id: string, iso: string) => void;
  onAfter: (id: string, key: (typeof AFTER_STEPS)[number]["key"]) => void; onCancel: (id: string, reason: string) => void; toast: (m: string) => void;
}) {
  return (
    <Drawer open={!!job} onClose={onClose} wide title={job?.customer ?? ""} subtitle={job ? `${job.id} · ${job.opsId} · ${job.province}` : ""}>
      {job && <JobBody key={job.id} job={job} task={tasks.find((t) => t.ref.id === job.id)} onAdvance={onAdvance} onSurvey={onSurvey} onAfter={onAfter} onCancel={onCancel} toast={toast} />}
    </Drawer>
  );
}

function JobBody({ job, task, onAdvance, onSurvey, onAfter, onCancel, toast }: {
  job: Job; task?: Task; onAdvance: (id: string) => void; onSurvey: (id: string, iso: string) => void; onAfter: (id: string, key: (typeof AFTER_STEPS)[number]["key"]) => void; onCancel: (id: string, reason: string) => void; toast: (m: string) => void;
}) {
  const [survey, setSurvey] = useState("2026-11-26T10:00");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const idx = STAGES.findIndex((s) => s.key === job.stage);
  const next = NEXT[job.stage];
  const dep = depositOf(job);
  const m = stageMeta(job.stage);
  const paidDep = !!job.depositPaidAt;
  const paidAll = !!job.paidAt;

  return (
    <>
      <div className={cn(glass, "p-4")}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ background: m.tone }}>{m.label}</span>
          <span className="text-[18px] font-bold tracking-tight text-indigo-700">{baht(job.value)}</span>
        </div>
        <div className="flex items-center">
          {STAGES.map((s, i) => (
            <div key={s.key} className="relative flex flex-1 flex-col items-center">
              {i > 0 && <span className={cn("absolute right-1/2 top-3 h-0.5 w-full", i <= idx ? "bg-indigo-500" : "bg-slate-200")} />}
              <span className={cn("relative z-10 grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold", job.stage === "cancelled" ? "bg-slate-200 text-slate-400" : i < idx ? "bg-indigo-600 text-white" : i === idx ? "border-2 border-indigo-600 bg-white text-indigo-600" : "bg-slate-200 text-slate-400")}>
                {i < idx && job.stage !== "cancelled" ? <Icon name="check" style={{ fontSize: 14 }} /> : i + 1}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11.5px] text-slate-500">{job.stage === "cancelled" ? `ยกเลิกงาน: ${job.cancelReason}` : m.hint}</p>
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
                <button onClick={() => toast(`ส่งข้อความถึง ${job.customer} แล้ว (ตัวอย่าง)`)} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white">ส่งทาง LINE</button>
              </div>
            </div>
          )}
        </div>
      )}

      {job.stage === "survey" && (
        <div className={cn(glass, "space-y-2 p-4")}>
          <h3 className="text-[13px] font-bold text-slate-900">นัดสำรวจหน้างาน</h3>
          <div className="flex gap-2">
            <input type="datetime-local" value={survey} onChange={(e) => setSurvey(e.target.value)} className={inputCls} />
            <button onClick={() => { onSurvey(job.id, new Date(`${survey}:00+07:00`).toISOString()); toast("บันทึกนัดสำรวจแล้ว"); }} className={btnGhost}>นัด</button>
          </div>
          {job.surveyAt && <p className="text-[12px] font-medium text-cyan-700">นัดไว้: {dtTh(job.surveyAt)}{isToday(job.surveyAt) ? " (วันนี้)" : ""}</p>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(glass, "p-4")}>
          <h3 className="mb-1 text-[13px] font-bold text-slate-900">รายละเอียดงาน</h3>
          <KV k="Solution" v={job.product} /><KV k="Package" v={job.pkg} /><KV k="ผู้ดูแล" v={job.owner} /><KV k="เบอร์ลูกค้า" v={job.phone} /><KV k="เปิดงานเมื่อ" v={dateTh(job.createdAt)} />
          <KV k="ความเคลื่อนไหวล่าสุด" v={agoText(job.lastTouchAt)} />
        </div>
        <div className={cn(glass, "p-4")}>
          <h3 className="mb-1 text-[13px] font-bold text-slate-900">การเงิน</h3>
          <KV k={`มัดจำ ${30}%`} v={<span className={paidDep ? "text-emerald-700" : "text-amber-700"}>{baht(dep)} · {paidDep ? `รับแล้ว ${dateTh(job.depositPaidAt)}` : "ยังไม่ได้รับ"}</span>} />
          <KV k="ส่วนที่เหลือ" v={<span className={paidAll ? "text-emerald-700" : "text-slate-800"}>{baht(job.value - dep)} · {paidAll ? `รับแล้ว ${dateTh(job.paidAt)}` : "ยังไม่ได้รับ"}</span>} />
          <KV k="มูลค่ารวม" v={baht(job.value)} />
        </div>
      </div>

      {(job.stage === "aftersale" || job.stage === "done") && (
        <div className={cn(glass, "p-4")}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-slate-900">สถานะหลังปิดขาย</h3>
            <span className="text-[11px] text-slate-400">อัปเดตจากทีมที่เกี่ยวข้อง</span>
          </div>
          <ol className="relative space-y-4 pl-1">
            {AFTER_STEPS.map((s, i) => {
              const done = job.after[s.key];
              const eta = job.afterEta[s.key];
              const current = !done && AFTER_STEPS.slice(0, i).every((p) => job.after[p.key]);
              const late = current && !!eta && new Date(eta).getTime() < NOW.getTime() && !isToday(eta);
              return (
                <li key={s.key} className="relative flex gap-3">
                  {i < AFTER_STEPS.length - 1 && <span className={cn("absolute left-[15px] top-8 h-[calc(100%-4px)] w-0.5", done ? "bg-emerald-400" : "bg-slate-200")} />}
                  <span className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full", done ? "bg-emerald-500 text-white" : late ? "bg-rose-500 text-white" : current ? "bg-indigo-600 text-white ring-4 ring-indigo-100" : "bg-slate-100 text-slate-400")}>
                    <Icon name={done ? "check" : s.icon} style={{ fontSize: 18 }} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-[13px] font-semibold", done || current ? "text-slate-900" : "text-slate-400")}>{s.label}</span>
                      <span className="text-[11px] text-slate-400">{s.team}</span>
                    </div>
                    <div className={cn("text-[11.5px]", late ? "font-semibold text-rose-600" : "text-slate-500")}>
                      {done ? `เสร็จเมื่อ ${dtTh(done)}` : eta ? `${late ? "เลยกำหนด" : "กำหนด"} ${dtTh(eta)}${late ? ` (${durText(hoursSince(eta))})` : ""}` : current ? "รอทีมแจ้งวันที่" : "ยังไม่ถึงขั้นตอนนี้"}
                    </div>
                    {current && (
                      <button onClick={() => { onAfter(job.id, s.key); toast(`${s.team} แจ้ง "${s.label}" เสร็จแล้ว (จำลอง)`); }} className="mt-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">จำลอง: {s.team}อัปเดตว่าเสร็จ</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className={cn(glass, "p-4")}>
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">ประวัติ</h3>
        <ul className="space-y-2">
          {[...job.log].sort((a, b) => +new Date(b.at) - +new Date(a.at)).map((l, i) => (
            <li key={i} className="flex gap-2 text-[12px]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" /><span className="text-slate-700">{l.text}<span className="ml-2 text-slate-400">{dtTh(l.at)}</span></span></li>
          ))}
          {job.log.length === 0 && <li className="text-[12px] text-slate-400">ยังไม่มีประวัติ</li>}
        </ul>
      </div>

      {!["done", "cancelled"].includes(job.stage) && (
        <div className="sticky bottom-0 -mx-5 -mb-4 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
          {next ? <button onClick={() => onAdvance(job.id)} className={btnPrimary}>{next.label}<Icon name="arrow_forward" style={{ fontSize: 18 }} /></button>
            : <span className="text-[12px] text-slate-500">เมื่อทุกขั้นตอนหลังปิดขายครบ งานจะจบอัตโนมัติ</span>}
          {!cancelling ? <button onClick={() => setCancelling(true)} className="ml-auto rounded-xl px-3 py-2 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50">ยกเลิกงาน</button> : (
            <div className="ml-auto flex gap-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผลที่ยกเลิก" className={cn(inputCls, "w-44")} />
              <button disabled={!reason.trim()} onClick={() => onCancel(job.id, reason.trim())} className="rounded-xl bg-rose-600 px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-40">ยืนยัน</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- สร้างงานใหม่ ---------------- */
export interface NewJobInput { customer: string; phone: string; province: string; product: string; pkg: string; value: number; owner: string; leadId?: string; channel: string }
export function NewJobDrawer({ open, lead, onClose, onCreate }: { open: boolean; lead: Lead | null; onClose: () => void; onCreate: (i: NewJobInput) => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="สร้างงานใหม่ (เปิด Ops)" subtitle={lead ? `จาก Lead ${lead.id}` : "กรอกข้อมูลลูกค้าและงาน"}>
      {open && <NewJobBody key={lead?.id ?? "blank"} lead={lead} onCreate={onCreate} onClose={onClose} />}
    </Drawer>
  );
}
function NewJobBody({ lead, onCreate, onClose }: { lead: Lead | null; onCreate: (i: NewJobInput) => void; onClose: () => void }) {
  const [f, setF] = useState({ customer: lead?.name ?? "", phone: lead?.phone ?? "", province: lead?.province ?? "", product: lead?.product ?? PRODUCTS[0], pkg: PACKAGES[0], value: "", owner: OWNERS[0], channel: lead?.channel ?? CHANNELS[0] });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const value = parseFloat(f.value.replace(/,/g, "")) || 0;
  const ok = f.customer.trim() && f.phone.trim() && f.province.trim() && value > 0;
  return (
    <>
      {lead && <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-[12.5px] font-medium text-emerald-800"><Icon name="check_circle" style={{ fontSize: 18 }} />ดึงข้อมูลจาก Lead มาให้แล้ว ตรวจสอบและเติมส่วนที่เหลือ</div>}
      <div className={cn(glass, "space-y-3 p-4")}>
        <h3 className="text-[13px] font-bold text-slate-900">ข้อมูลลูกค้า</h3>
        <Field label="ชื่อ-สกุล *"><input value={f.customer} onChange={(e) => set("customer", e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="เบอร์ติดต่อ *"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></Field>
          <Field label="จังหวัดหน้างาน *"><input value={f.province} onChange={(e) => set("province", e.target.value)} className={inputCls} /></Field>
        </div>
      </div>
      <div className={cn(glass, "space-y-3 p-4")}>
        <h3 className="text-[13px] font-bold text-slate-900">ข้อมูลงาน</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Solution"><select value={f.product} onChange={(e) => set("product", e.target.value)} className={inputCls}>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="ช่องทาง"><select value={f.channel} onChange={(e) => set("channel", e.target.value)} className={inputCls}>{CHANNELS.map((p) => <option key={p}>{p}</option>)}</select></Field>
        </div>
        <Field label="Package"><select value={f.pkg} onChange={(e) => set("pkg", e.target.value)} className={inputCls}>{PACKAGES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="มูลค่าประมาณการ (บาท) *"><input inputMode="numeric" value={f.value} onChange={(e) => set("value", e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ","))} placeholder="เช่น 250,000" className={cn(inputCls, "text-right tabular-nums")} /></Field>
          <Field label="ผู้ดูแล"><select value={f.owner} onChange={(e) => set("owner", e.target.value)} className={inputCls}>{OWNERS.map((p) => <option key={p}>{p}</option>)}</select></Field>
        </div>
        {value > 0 && <p className="text-[12px] text-slate-500">มัดจำ 30% = <b className="text-slate-800">{baht(Math.round(value * 0.3))}</b></p>}
      </div>
      <div className="flex justify-end gap-2 pb-2">
        <button onClick={onClose} className={btnGhost}>ยกเลิก</button>
        <button disabled={!ok} onClick={() => onCreate({ ...f, value, leadId: lead?.id })} className={btnPrimary}><Icon name="rocket_launch" style={{ fontSize: 18 }} />สร้างงาน</button>
      </div>
    </>
  );
}

/* ---------------- แชตน้องเลขา ---------------- */
interface Answer { text: string; items?: { label: string; sub?: string; run?: () => void }[]; draft?: string }
interface Msg { from: "me" | "bot"; text: string; ans?: Answer }
const PROMPTS = ["วันนี้ต้องทำอะไรก่อน", "งานไหนเสี่ยงหลุด", "สรุปงานหลังปิดขาย", "ยอดที่ต้องเก็บเงิน", "ร่างข้อความตามลูกค้าที่เงียบ"];

export function ChatDrawer({ open, onClose, leads, jobs, tasks, onTask, toast }: {
  open: boolean; onClose: () => void; leads: Lead[]; jobs: Job[]; tasks: Task[]; onTask: (t: Task) => void; toast: (m: string) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: "สวัสดีค่ะ ถามเรื่องงานของวันนี้ได้เลย หรือกดหัวข้อด้านล่างค่ะ (ตัวอย่างนี้ตอบจากข้อมูลในหน้าด้วยกฎที่กำหนดไว้)" }]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const answer = (q: string): Answer => {
    const has = (...k: string[]) => k.some((x) => q.includes(x));
    if (has("เสี่ยง", "หลุด")) {
      const r = atRisk(leads, jobs);
      const items = [...r.leads.map((l) => ({ label: `${l.name} · เกิน SLA`, sub: `${l.product} · ${leadSla(l).text}` })), ...r.jobs.map((j) => ({ label: `${j.customer} · ${baht(j.value)}`, sub: `${stageMeta(j.stage).label} · เงียบมา ${durText(hoursSince(j.lastTouchAt))}`, run: () => onTask(tasks.find((t) => t.ref.id === j.id) ?? tasks[0]) }))];
      return { text: items.length ? `มี ${items.length} รายการที่เสี่ยงหลุด มูลค่างานรวม ${baht(r.value)} ค่ะ` : "ตอนนี้ไม่มีงานที่เสี่ยงหลุดค่ะ", items };
    }
    if (has("หลังปิด", "ติดตั้ง", "ส่งมอบ", "ประกัน")) {
      const list = jobs.filter((j) => j.stage === "aftersale");
      return { text: `มี ${list.length} งานที่อยู่หลังปิดขายค่ะ`, items: list.map((j) => { const n = AFTER_STEPS.find((s) => !j.after[s.key]); const eta = n ? j.afterEta[n.key] : undefined; return { label: j.customer, sub: n ? `ถัดไป: ${n.label}${eta ? ` · กำหนด ${dtTh(eta)}` : ""}` : "ครบทุกขั้นตอน" }; }) };
    }
    if (has("เก็บเงิน", "ยอด", "มัดจำ", "ชำระ")) {
      const list = jobs.filter((j) => j.stage === "deposit" || j.stage === "collect");
      const sum = list.reduce((s, j) => s + (j.stage === "deposit" ? depositOf(j) : j.value - depositOf(j)), 0);
      return { text: `ต้องเก็บอีก ${baht(sum)} จาก ${list.length} งานค่ะ`, items: list.map((j) => ({ label: j.customer, sub: j.stage === "deposit" ? `มัดจำ ${baht(depositOf(j))}` : `ส่วนที่เหลือ ${baht(j.value - depositOf(j))} (ก่อนติดตั้ง)` })) };
    }
    if (has("ร่าง", "ข้อความ", "เงียบ", "ตาม")) {
      const t = tasks.find((x) => ["quote_stale", "deposit_chase", "final_chase"].includes(x.kind) && x.draft);
      return t ? { text: `ร่างข้อความตาม ${t.who} ให้แล้วค่ะ (${t.reason})`, draft: t.draft } : { text: "ไม่มีลูกค้าที่เงียบเกินกำหนดค่ะ" };
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
    <Drawer open={open} onClose={onClose} title={<span className="flex items-center gap-2"><span className={cn("grid h-8 w-8 place-items-center rounded-xl text-white", grad)}><Icon name="auto_awesome" style={{ fontSize: 18 }} /></span>น้องเลขา</span>} subtitle="ผู้ช่วยประจำวันของทีมขาย"
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
