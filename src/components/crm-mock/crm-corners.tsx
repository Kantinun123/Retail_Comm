"use client";
/* มุมของหน่วยงาน: ห้องแบบ (รับงานคนแรกได้ + SLA + ส่งไฟล์กลับ) และ KIM / ทีมสำรวจ (นัดสำรวจ + รายงานสำรวจ + งานติดตั้ง)
   จำลองแอปของแต่ละหน่วยงาน ข้อมูลไม่ถูกบันทึกจริง */
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  NOW, PARTY, ROOM_DESIGNERS, RC_OPTS, SHAPE_OPTS, WORK_LABEL, MODEL_LABEL, baht, currentStep, dateTh, dtTh, dueOf, heldBy, instNet, isToday, lateWd, stepsOf, timeTh, wdBetween,
  type Job, type StepDef, type StepKey, type SurveyReport,
} from "./crm-mock-data";
import { Avatar, PartyBadge, btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";
import { RsdEstimate } from "./crm-rsd";

type Patch = (id: string, fn: (j: Job) => Job) => void;
type Complete = (id: string, key: StepKey, extra?: { surveyAt?: string }) => void;
const stamp = () => NOW.toISOString();

function Facts({ j }: { j: Job }) {
  const i = j.intake;
  const bits = [WORK_LABEL[j.work], MODEL_LABEL[j.model], j.province, i ? `${i.tile} ${i.tileModel} ${i.color}` : "", i?.files ? `${i.files.length} ไฟล์แนบ` : "", `ผู้ขอ ${j.owner}`].filter(Boolean);
  return <p className="text-[11px] text-slate-500">{bits.join(" · ")}</p>;
}
function SlaChip({ left }: { left: number }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", left < 0 ? "bg-rose-100 text-rose-700" : left <= 1 ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700")}>{left < 0 ? `เกิน SLA ${-left} วันทำการ` : left === 0 ? "ครบ SLA วันนี้" : `เหลือ ${left} วันทำการ`}</span>;
}

/* =============== ห้องแบบ =============== */
const ROOM_KEYS: StepKey[] = ["ase_mark", "truss_design", "estimate_room"];
const ROOM_SLA: Partial<Record<StepKey, number>> = { ase_mark: 3, truss_design: 5, estimate_room: 3 };
const ROOM_TODO: Partial<Record<StepKey, string[]>> = {
  ase_mark: ["ขีดแนวอะเสบนแบบแปลน", "ระบุระยะและระดับ", "แนบไฟล์ผลขีดแนว (PDF)"],
  truss_design: ["ออกแบบทรัสตามรายงานสำรวจ", "ทำ Cutting List", "แนบแบบทรัส + Cutting List"],
  estimate_room: ["ถอดแบบทุกหมวดงาน", "ทำประมาณการ", "แนบไฟล์ประมาณการ"],
};
const startOf = (j: Job, key: StepKey) => { const st = stepsOf(j); const i = st.findIndex((s) => s.key === key); return i > 0 ? j.done[st[i - 1].key] ?? j.startedAt : j.startedAt; };

export function RoomCorner({ jobs, onPatch, onComplete, toast }: { jobs: Job[]; onPatch: Patch; onComplete: Complete; toast: (m: string) => void }) {
  const [me, setMe] = useState(ROOM_DESIGNERS[0]);
  const [checks, setChecks] = useState<Record<string, boolean[]>>({});
  const [rsd, setRsd] = useState<{ j: Job; s: StepDef } | null>(null);
  const tasks = jobs.flatMap((j) => { if (j.cancelReason) return []; const s = currentStep(j); return s && ROOM_KEYS.includes(s.key) && !(j.model === "gt" && s.key === "estimate_room" && !j.estimatePo) ? [{ j, s, left: (ROOM_SLA[s.key] ?? 3) - wdBetween(startOf(j, s.key), NOW.toISOString()) }] : []; }).sort((a, b) => a.left - b.left);
  const done = jobs.flatMap((j) => ROOM_KEYS.filter((k) => j.done[k] && j.roomClaims?.[k]).map((k) => ({ j, k, at: j.done[k]!, by: j.roomClaims![k]!.by }))).sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 5);
  const waiting = tasks.filter((t) => !t.j.roomClaims?.[t.s.key]);
  const mine = tasks.filter((t) => t.j.roomClaims?.[t.s.key]?.by === me);
  const late = tasks.filter((t) => t.left < 0).length;
  const claim = (j: Job, s: StepDef) => {
    if (j.roomClaims?.[s.key]) { toast(`งานนี้ ${j.roomClaims[s.key]!.by} รับไปแล้ว`); return; }
    onPatch(j.id, (x) => (x.roomClaims?.[s.key] ? x : { ...x, roomClaims: { ...x.roomClaims, [s.key]: { by: me, at: stamp() } }, lastTouchAt: stamp(), log: [...x.log, { at: stamp(), text: `ห้องแบบ (${me}) รับงาน: ${s.label}` }] }));
    toast(`${me} รับงาน ${s.label} ของ ${j.customer} แล้ว`);
  };
  const tick = (id: string, n: number, i: number) => setChecks((c) => { const a = [...(c[id] ?? Array(n).fill(false))]; a[i] = !a[i]; return { ...c, [id]: a }; });
  const deliver = (j: Job, s: StepDef) => { onComplete(j.id, s.key); toast(`ส่ง "${s.result}" ให้ทีมขายแล้ว`); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[22px] font-bold tracking-tight text-slate-900">มุมห้องแบบ</h1><p className="text-[12.5px] text-slate-500">งานที่ทีมขายส่งมา: ขีดแนวอะเส · แบบทรัส + Cutting List · ประมาณการ · คนแรกที่กดรับได้งาน (จำลองแอปห้องแบบ)</p></div>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">ฉันคือ
          <select value={me} onChange={(e) => setMe(e.target.value)} className={cn(inputCls, "!w-28 !py-1.5")}>{ROOM_DESIGNERS.map((d) => <option key={d}>{d}</option>)}</select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["รอรับงาน", waiting.length, "text-amber-600"], ["กำลังทำ (ทั้งห้อง)", tasks.length - waiting.length, "text-indigo-700"], [`งานของ ${me}`, mine.length, "text-slate-900"], ["เกิน SLA", late, late ? "text-rose-600" : "text-emerald-600"]].map(([l, v, c]) => (
          <div key={String(l)} className={cn(glass, "p-3.5")}><p className="text-[11px] font-semibold text-slate-500">{l}</p><p className={cn("text-[24px] font-bold", c as string)}>{v}</p></div>
        ))}
      </div>
      <div className="space-y-3">
        {tasks.map(({ j, s, left }) => {
          const cl = j.roomClaims?.[s.key];
          const isMine = cl?.by === me;
          const items = ROOM_TODO[s.key] ?? [];
          const ck = checks[`${j.id}-${s.key}`] ?? Array(items.length).fill(false);
          const held = !!heldBy(j, s.key);
          return (
            <div key={`${j.id}-${s.key}`} className={cn(glass, "space-y-2 p-4", left < 0 && "ring-2 ring-rose-200")}>
              <div className="flex flex-wrap items-center gap-2">
                <Avatar name={j.customer} size={30} />
                <div className="min-w-0 flex-1"><b className="block truncate text-[13.5px] text-slate-900">{s.label} · {j.customer}</b><span className="text-[11px] text-slate-400">{j.opsId}{j.estimateBy === "room" && s.key !== "estimate_room" ? " · ขอให้ทำประมาณการด้วย" : ""}</span></div>
                <SlaChip left={left} />
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", cl ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700")}>{cl ? `กำลังทำ · ${cl.by}` : "รอรับงาน"}</span>
              </div>
              <Facts j={j} />
              {s.key === "truss_design" && j.surveyReport && <p className="rounded-lg bg-cyan-50 px-2.5 py-1.5 text-[11.5px] text-cyan-800">รายงานสำรวจ: หลังคา {j.surveyReport.area} ตร.ม. · {j.surveyReport.shape} · ลาด {j.surveyReport.slope}° · {j.surveyReport.photos} รูป</p>}
              {!cl && <button onClick={() => claim(j, s)} className={btnPrimary}><Icon name="front_hand" style={{ fontSize: 18 }} />รับงานนี้ (คนแรกได้งาน)</button>}
              {cl && !isMine && <p className="text-[11.5px] text-slate-500">{cl.by} รับงานนี้เมื่อ {dtTh(cl.at)} · เปลี่ยนชื่อที่ &ldquo;ฉันคือ&rdquo; เพื่อดูแบบของแต่ละคน</p>}
              {cl && isMine && (
                <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                  <p className="text-[11.5px] font-bold text-slate-700">ทำตามลำดับ แล้วส่งไฟล์กลับให้ทีมขาย</p>
                  {items.map((t, i) => <label key={t} className="flex cursor-pointer items-center gap-2 text-[12px] text-slate-700"><input type="checkbox" checked={ck[i]} onChange={() => tick(`${j.id}-${s.key}`, items.length, i)} className="h-4 w-4 accent-indigo-600" />{t}</label>)}
                  {s.key === "estimate_room" && <button onClick={() => setRsd({ j, s })} className={btnGhost}><Icon name="roofing" style={{ fontSize: 18 }} />เปิดหน้าประมาณการ (RSD)</button>}
                  <button disabled={!ck.every(Boolean) || held} onClick={() => deliver(j, s)} className={cn(btnPrimary, "disabled:cursor-not-allowed")}><Icon name="upload_file" style={{ fontSize: 18 }} />ส่งไฟล์กลับให้ทีมขาย</button>
                  {held && <p className="text-[11px] font-semibold text-rose-600">ระงับ: รอลูกค้าชำระเงิน</p>}
                </div>
              )}
            </div>
          );
        })}
        {!tasks.length && <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-[13px] text-slate-400">ไม่มีงานค้างของห้องแบบ</p>}
      </div>
      {rsd && <RsdEstimate job={rsd.j} onClose={() => setRsd(null)} onDeliver={() => { const items = ROOM_TODO[rsd.s.key] ?? []; setChecks((c) => ({ ...c, [`${rsd.j.id}-${rsd.s.key}`]: Array(items.length).fill(true) })); deliver(rsd.j, rsd.s); setRsd(null); }} />}
      {done.length > 0 && (
        <div className={cn(glass, "p-4")}>
          <h3 className="mb-2 text-[13px] font-bold text-slate-900">ส่งแล้วล่าสุด</h3>
          <ul className="space-y-1.5">{done.map((d) => <li key={`${d.j.id}-${d.k}`} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px]"><Icon name="check_circle" className="!text-[17px] text-emerald-500" /><span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{d.j.customer}<span className="ml-1 font-normal text-slate-400">{d.k === "ase_mark" ? "ขีดแนวอะเส" : d.k === "truss_design" ? "แบบทรัส + Cutting List" : "ประมาณการ"}</span></span><span className="text-slate-500">{d.by} · {dateTh(d.at)}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}

/* =============== KIM / ทีมสำรวจ =============== */
export function SurveyReportCard({ r }: { r: SurveyReport }) {
  return (
    <div className={cn(glass, "p-4")}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="pin_drop" className="!text-[18px] text-cyan-600" />รายงานสำรวจหน้างาน <span className="text-[11px] font-normal text-slate-400">โดย {r.by} · {dateTh(r.at)}</span></h3>
      <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
        {[["พื้นที่หลังคา", `${r.area} ตร.ม.`], ["รูปทรง", r.shape], ["ความลาดชัน", `${r.slope}°`], ["สภาพเดิม", r.condition], ["รูปถ่าย", `${r.photos} รูป`]].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 p-2"><p className="text-[10.5px] text-slate-500">{k}</p><p className="font-bold text-slate-800">{v}</p></div>)}
      </div>
      {r.access && <p className="mt-2 text-[12px] text-slate-600">การเข้าหน้างาน: {r.access}</p>}
      {r.notes && <p className="text-[12px] text-slate-600">หมายเหตุ: {r.notes}</p>}
    </div>
  );
}

function SurveyForm({ j, onSubmit }: { j: Job; onSubmit: (r: SurveyReport) => void }) {
  const [area, setArea] = useState("");
  const [shape, setShape] = useState(SHAPE_OPTS[0]);
  const [slope, setSlope] = useState("30");
  const [cond, setCond] = useState(RC_OPTS[0]);
  const [access, setAccess] = useState("");
  const [photos, setPhotos] = useState(0);
  const [notes, setNotes] = useState("");
  const a = Number(area);
  const ok = a > 0 && photos >= 1;
  return (
    <div className="space-y-2 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3 text-[12px]">
      <p className="font-bold text-slate-800">รายงานสำรวจหน้างาน · {j.customer}</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <label><span className="mb-1 block text-[10.5px] font-semibold text-slate-500">พื้นที่หลังคา (ตร.ม.) *</span><input inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value.replace(/[^\d.]/g, ""))} placeholder="เช่น 185" className={inputCls} /></label>
        <label><span className="mb-1 block text-[10.5px] font-semibold text-slate-500">รูปทรงหลังคา</span><select value={shape} onChange={(e) => setShape(e.target.value)} className={inputCls}>{SHAPE_OPTS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span className="mb-1 block text-[10.5px] font-semibold text-slate-500">ความลาดชัน (องศา)</span><input inputMode="numeric" value={slope} onChange={(e) => setSlope(e.target.value.replace(/\D/g, ""))} className={inputCls} /></label>
        <label><span className="mb-1 block text-[10.5px] font-semibold text-slate-500">สภาพหลังคาเดิม</span><select value={cond} onChange={(e) => setCond(e.target.value)} className={inputCls}>{RC_OPTS.map((o) => <option key={o}>{o}</option>)}</select></label>
      </div>
      <label className="block"><span className="mb-1 block text-[10.5px] font-semibold text-slate-500">ทางเข้าหน้างาน / ข้อควรระวัง</span><input value={access} onChange={(e) => setAccess(e.target.value)} placeholder="เช่น ทางเข้าแคบ รถบรรทุกใหญ่เข้าไม่ได้" className={inputCls} /></label>
      <label className="block"><span className="mb-1 block text-[10.5px] font-semibold text-slate-500">หมายเหตุสำหรับห้องแบบ / ทีมขาย</span><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPhotos((p) => p + 1)} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}><Icon name="add_a_photo" style={{ fontSize: 16 }} />เพิ่มรูป (จำลอง)</button>
        <span className={cn("text-[11.5px] font-semibold", photos ? "text-emerald-700" : "text-amber-700")}>{photos ? `${photos} รูป` : "ต้องมีอย่างน้อย 1 รูป"}</span>
        <button disabled={!ok} onClick={() => onSubmit({ at: stamp(), by: PARTY.KIM.label, area: a, shape, slope: Number(slope) || 0, condition: cond, access: access.trim(), photos, notes: notes.trim() })} className={cn(btnPrimary, "ml-auto disabled:cursor-not-allowed")}><Icon name="send" style={{ fontSize: 18 }} />ส่งรายงานสำรวจให้ทีมขาย</button>
      </div>
    </div>
  );
}

const KIM_OTHER: StepKey[] = ["install_plan", "install_frame", "install", "handover"];
export function KimCorner({ jobs, onPatch, onComplete, toast }: { jobs: Job[]; onPatch: Patch; onComplete: Complete; toast: (m: string) => void }) {
  const [tab, setTab] = useState<"survey" | "install">("survey");
  const [open, setOpen] = useState<string | null>(null);
  const live = jobs.filter((j) => !j.cancelReason);
  const survey = live.flatMap((j) => { const s = currentStep(j); return s && s.key === "survey" ? [{ j, s }] : []; }).sort((a, b) => +new Date(a.j.surveyAt ?? 0) - +new Date(b.j.surveyAt ?? 0));
  const other = live.flatMap((j) => { const s = currentStep(j); return s && s.owner === "KIM" && KIM_OTHER.includes(s.key) ? [{ j, s }] : []; });
  const submit = (j: Job, r: SurveyReport) => {
    onPatch(j.id, (x) => ({ ...x, surveyReport: r, lastTouchAt: stamp(), log: [...x.log, { at: stamp(), text: `${PARTY[currentStep(x)?.owner ?? "KIM"].label} ส่งรายงานสำรวจ (${r.area} ตร.ม., ${r.photos} รูป)` }] }));
    onComplete(j.id, "survey");
    setOpen(null);
    toast(`ส่งรายงานสำรวจของ ${j.customer} ให้ทีมขายแล้ว`);
  };
  return (
    <div className="space-y-4">
      <div><h1 className="text-[22px] font-bold tracking-tight text-slate-900">มุม KIM / ทีมสำรวจ</h1><p className="text-[12.5px] text-slate-500">นัดสำรวจ ทำรายงานสำรวจส่งให้ทีมขาย และอัปเดตงานติดตั้ง (จำลองแอป KIM)</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["รอสำรวจ", survey.length, "text-cyan-700"], ["สำรวจวันนี้", survey.filter((x) => isToday(x.j.surveyAt)).length, "text-indigo-700"], ["งานติดตั้ง/ส่งมอบ", other.length, "text-slate-900"], ["ถูกระงับ รอลูกค้าชำระ", other.filter((x) => heldBy(x.j, x.s.key)).length, "text-rose-600"]].map(([l, v, c]) => (
          <div key={String(l)} className={cn(glass, "p-3.5")}><p className="text-[11px] font-semibold text-slate-500">{l}</p><p className={cn("text-[24px] font-bold", c as string)}>{v}</p></div>
        ))}
      </div>
      <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-[12px] font-bold sm:w-fit">
        {([["survey", `นัดสำรวจและรายงาน (${survey.length})`], ["install", `แผนติดตั้งและงานติดตั้ง (${other.length})`]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn("flex-1 rounded-lg px-3 py-1.5 transition", tab === k ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-indigo-600")}>{l}</button>)}
      </div>
      {tab === "survey" && (
        <div className="space-y-3">
          {survey.map(({ j, s }) => {
            const late = lateWd(dueOf(j, s));
            return (
              <div key={j.id} className={cn(glass, "space-y-2 p-4")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Avatar name={j.customer} size={30} />
                  <div className="min-w-0 flex-1"><b className="block truncate text-[13.5px] text-slate-900">{j.customer} · {j.province}</b><span className="text-[11px] text-slate-400">{j.opsId} · {j.phone}{j.scope ? ` · ${j.scope}` : ""}</span></div>
                  <PartyBadge party={s.owner} />
                  {j.surveyAt && <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", isToday(j.surveyAt) ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-600")}>นัด {dtTh(j.surveyAt)}{isToday(j.surveyAt) ? " (วันนี้)" : ""}</span>}
                  {late > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">ส่งรายงานช้า {late} วันทำการ</span>}
                </div>
                <Facts j={j} />
                {open === j.id ? <SurveyForm j={j} onSubmit={(r) => submit(j, r)} /> : <button onClick={() => setOpen(j.id)} className={btnPrimary}><Icon name="edit_note" style={{ fontSize: 18 }} />ทำรายงานสำรวจ</button>}
              </div>
            );
          })}
          {!survey.length && <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-[13px] text-slate-400">ไม่มีงานรอสำรวจ</p>}
        </div>
      )}
      {tab === "install" && (
        <div className="space-y-3">
          {other.map(({ j, s }) => {
            const h = heldBy(j, s.key);
            const late = lateWd(dueOf(j, s));
            return (
              <div key={`${j.id}-${s.key}`} className={cn(glass, "space-y-2 p-4", h && "ring-2 ring-rose-200")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Avatar name={j.customer} size={30} />
                  <div className="min-w-0 flex-1"><b className="block truncate text-[13.5px] text-slate-900">{s.label} · {j.customer}</b><span className="text-[11px] text-slate-400">{j.opsId} · {j.province} · กำหนด {dateTh(dueOf(j, s))}</span></div>
                  {late > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-700">เลยแผน {late} วันทำการ</span>}
                </div>
                {h ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700"><Icon name="lock" className="!text-[16px] align-middle" /> ระงับ: รอลูกค้าชำระ{h.label.split(" · ")[0]} {baht(instNet(j, h.no))} ยังไม่ควรเริ่มจนกว่าจะปลดล็อก</p> : (
                  <button onClick={() => { onComplete(j.id, s.key); toast(`ส่งสถานะ "${s.result}" แล้ว`); }} className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />ส่ง: {s.result}</button>
                )}
              </div>
            );
          })}
          {!other.length && <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-[13px] text-slate-400">ไม่มีงานติดตั้งค้าง</p>}
        </div>
      )}
      <p className="text-[10.5px] text-slate-400">ตอนนี้ครอบคลุมนัดสำรวจ รายงานสำรวจ และสถานะงานติดตั้ง · เวลาปัจจุบันของตัวอย่าง {timeTh(NOW.toISOString())} น.</p>
    </div>
  );
}
