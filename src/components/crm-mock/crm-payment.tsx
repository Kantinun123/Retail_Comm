"use client";
/* จำลองการเก็บเงิน: ขอรับชำระ -> ส่งทาง LINE OA -> มุมมองลูกค้าเลือกวิธีจ่าย -> ยืนยัน -> ใบเสร็จ
   ไม่มีการเก็บเงินหรือส่งข้อความจริง ข้อมูลผู้รับเงินและบัญชีเป็นตัวอย่าง */
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  MODEL_LABEL, NOW, PAY_METHOD, SURVEY_FEE, addWd, baht, dateTh, dayKey, depositOf, hasDeposit,
  type ChatMsg, type Job, type PayMethod, type PaymentReq, type StepDef, type StepKey,
} from "./crm-mock-data";
import { btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";

export type SendLine = (job: Job, m: Omit<ChatMsg, "id" | "at" | "phone" | "job">) => void;
type PayKey = PaymentReq["step"];

export const isPayStep = (job: Job, key: StepKey): boolean => key === "survey_fee" || (key === "deposit" && job.work !== "survey") || key === "close";
const STEP_LABEL: Record<PayKey, string> = { survey_fee: "ค่าสำรวจ", deposit: "มัดจำ", close: "ส่วนที่เหลือก่อนปิดขาย (ชำระครบ 100%)" };
export const payeeOf = (job: Job) => job.store ?? (job.model === "scg" ? "SCG Home Experience (ตัวอย่าง)" : `ร้านตัวแทน ${MODEL_LABEL[job.model]} (ตัวอย่าง)`);
const ALL_METHODS: PayMethod[] = ["qr", "card", "transfer", "store"];

/** ยอดที่ต้องเก็บของขั้นนี้ พร้อมรายการหักยอดที่ชำระแล้ว */
export function amountFor(job: Job, key: PayKey) {
  if (key === "survey_fee") return { amount: SURVEY_FEE, lines: [["ค่าสำรวจ", SURVEY_FEE], ["หมายเหตุ", "หักออกจากค่าติดตั้งตอนปิดขาย"]] as [string, number | string][] };
  if (key === "deposit") return { amount: depositOf(job), lines: [["มัดจำ", depositOf(job)], ["หมายเหตุ", "หักออกจากยอดรวมตอนปิดขาย"]] as [string, number | string][] };
  const prior = (job.done.survey_fee || job.done.deposit) && hasDeposit(job) ? depositOf(job) : 0;
  return { amount: Math.max(0, job.value - prior), lines: [["ยอดรวมตามใบเสนอราคา", job.value], [job.work === "survey" ? "หัก ค่าสำรวจที่ชำระแล้ว" : "หัก มัดจำที่ชำระแล้ว", -prior]] as [string, number | string][] };
}
const fmt = (v: number | string) => (typeof v === "number" ? (v < 0 ? `−${baht(-v)}` : baht(v)) : v);
const firstName = (n: string) => n.replace(/^คุณ/, "").split(" ")[0];

function requestMessage(job: Job, key: PayKey, amount: number, due: string) {
  const n = firstName(job.customer);
  const what = key === "survey_fee" ? "ค่าสำรวจหน้างาน" : key === "deposit" ? "ค่ามัดจำเพื่อล็อกคิวสำรวจ" : "ยอดคงเหลือเพื่อปิดงานขายและเริ่มจัดเตรียมสินค้า";
  return `สวัสดีค่ะ คุณ${n} ขอแจ้ง${what} จำนวน ${baht(amount)} ค่ะ ชำระได้ที่ลิงก์ในการ์ดด้านล่าง ภายในวันที่ ${dateTh(due)} ถ้ามีข้อสงสัยตอบกลับในแชทนี้ได้เลยนะคะ`;
}

/* ---------------- ตัวอย่าง QR (จำลอง) ---------------- */
function FakeQr({ seed }: { seed: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const N = 21;
  const cells: boolean[] = [];
  for (let i = 0; i < N * N; i++) { h = (h * 1103515245 + 12345) >>> 0; cells.push(((h >>> 16) & 3) === 0); }
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  const finderOn = (x: number, y: number) => { const fx = x < 7 ? x : x - (N - 7); const fy = y < 7 ? y : y - (N - 7); return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); };
  return (
    <div className="mx-auto grid w-40 gap-0 rounded-lg bg-white p-2" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
      {cells.map((on, i) => { const x = i % N, y = Math.floor(i / N); const f = finder(x, y); return <span key={i} className={cn("aspect-square", f ? (finderOn(x, y) ? "bg-slate-900" : "bg-white") : on ? "bg-slate-900" : "bg-white")} />; })}
    </div>
  );
}

/* ---------------- หน้าต่างสร้างคำขอชำระ (ทีมขาย) ---------------- */
function RequestModal({ job, k, surveyAt, onClose, onSend }: { job: Job; k: PayKey; surveyAt?: string; onClose: () => void; onSend: (r: PaymentReq, msg: string) => void }) {
  const base = amountFor(job, k);
  const [amount, setAmount] = useState(String(base.amount));
  const [methods, setMethods] = useState<PayMethod[]>(["qr", "card", "transfer"]);
  const [due, setDue] = useState(dayKey(addWd(NOW.toISOString(), 3)));
  const amt = Number(amount.replace(/,/g, "")) || 0;
  const dueIso = `${due}T17:00:00+07:00`;
  const [msg, setMsg] = useState(() => requestMessage(job, k, base.amount, `${dayKey(addWd(NOW.toISOString(), 3))}T17:00:00+07:00`));
  const ok = amt > 0 && methods.length > 0;
  const tog = (m: PayMethod) => setMethods((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));
  const send = () => onSend({ id: `PAY-${job.id.slice(-4)}-${(job.payments?.length ?? 0) + 1}`, step: k, label: STEP_LABEL[k], amount: amt, methods, dueAt: dueIso, status: "requested", requestedAt: NOW.toISOString(), surveyAt }, msg);
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="grid max-h-[92vh] w-full max-w-4xl gap-0 overflow-y-auto rounded-3xl bg-white shadow-2xl md:grid-cols-[1.2fr_1fr]" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3 p-5">
          <div><p className="text-[15px] font-bold text-slate-900">ขอรับชำระ: {STEP_LABEL[k]}</p><p className="text-[11px] text-slate-400">{job.id} · {job.customer} · ผู้รับเงิน {payeeOf(job)}</p></div>
          <div className="rounded-xl bg-slate-50 p-3 text-[12px]">
            {base.lines.map(([l, v], i) => <div key={i} className="flex justify-between py-0.5"><span className="text-slate-600">{l}</span><b className={typeof v === "number" && v < 0 ? "text-rose-600" : "text-slate-800"}>{fmt(v)}</b></div>)}
            <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-900">ยอดที่ขอชำระ (฿)</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={cn(inputCls, "!w-36 text-right font-bold")} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11.5px] font-bold text-slate-700">วิธีชำระที่เปิดให้ลูกค้า</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_METHODS.map((m) => (
                <button key={m} type="button" onClick={() => tog(m)} className={cn("flex items-start gap-2 rounded-xl border p-2.5 text-left transition", methods.includes(m) ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300")}>
                  <Icon name={PAY_METHOD[m].icon} className={methods.includes(m) ? "text-indigo-600" : "text-slate-400"} />
                  <span><b className="block text-[12px] text-slate-900">{PAY_METHOD[m].label}</b><span className="text-[10.5px] text-slate-500">{PAY_METHOD[m].sub}</span></span>
                </button>
              ))}
            </div>
          </div>
          <label className="block"><span className="mb-1 block text-[11.5px] font-bold text-slate-700">ครบกำหนดชำระ</span><input type="date" value={due} onChange={(e) => { setDue(e.target.value); setMsg(requestMessage(job, k, amt, `${e.target.value}T17:00:00+07:00`)); }} className={inputCls} /></label>
          <label className="block"><span className="mb-1 block text-[11.5px] font-bold text-slate-700">ข้อความถึงลูกค้า (แก้ไขได้)</span><textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} className={cn(inputCls, "resize-none")} /></label>
          <div className="flex justify-end gap-2"><button onClick={onClose} className={btnGhost}>ยกเลิก</button><button onClick={send} disabled={!ok} className={btnPrimary}><Icon name="send" style={{ fontSize: 18 }} />ส่งทาง LINE OA</button></div>
        </div>
        <div className="bg-[#e9f7ee] p-5">
          <p className="mb-2 text-[11.5px] font-bold text-[#06a047]">ตัวอย่างที่ลูกค้าจะเห็นใน LINE</p>
          <div className="space-y-2">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-[12px] leading-relaxed text-slate-700 shadow-sm">{msg}</div>
            <div className="w-64 rounded-2xl bg-white p-3 shadow">
              <p className="text-[12.5px] font-bold text-[#06a047]">ขอชำระ{STEP_LABEL[k]}</p>
              <p className="text-[22px] font-bold text-slate-900">{baht(amt)}</p>
              <p className="text-[11px] text-slate-500">ครบกำหนด {dateTh(dueIso)} · ผู้รับเงิน {payeeOf(job)}</p>
              <p className="mt-1 text-[10.5px] text-slate-500">{methods.map((m) => PAY_METHOD[m].label).join(" · ") || "ยังไม่ได้เลือกวิธีชำระ"}</p>
              <div className="mt-2 rounded-lg bg-[#06c755] py-2 text-center text-[12px] font-bold text-white">ชำระเงิน</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- มุมมองลูกค้า (จำลองในกรอบมือถือ) ---------------- */
type SimScreen = "chat" | "methods" | "pay" | "done";
export function CustomerSim({ job, req, onClose, onPay, onSlip }: { job: Job; req: PaymentReq; onClose: () => void; onPay: (m: PayMethod) => void; onSlip: () => void }) {
  const [screen, setScreen] = useState<SimScreen>(req.status === "paid" ? "done" : "chat");
  const [method, setMethod] = useState<PayMethod>(req.methods[0] ?? "qr");
  const [slipSent, setSlipSent] = useState(req.status === "slip");
  const head = (t: string) => <div className="flex items-center gap-2 bg-[#06c755] px-3 py-2.5 text-white"><button onClick={() => (screen === "chat" || screen === "done" ? onClose() : setScreen(screen === "pay" ? "methods" : "chat"))} aria-label="กลับ"><Icon name="arrow_back" className="!text-[20px]" /></button><b className="text-[13px]">{t}</b></div>;
  return createPortal(
    <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[92vh] flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <p className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-700">มุมมองลูกค้า (จำลอง) · {job.customer}</p>
        <div className="w-[340px] overflow-hidden rounded-[2rem] border-[6px] border-slate-800 bg-white shadow-2xl">
          {screen === "chat" && (
            <>
              {head("SCG Roof · LINE OA")}
              <div className="h-[520px] space-y-2 overflow-y-auto bg-[#eaf3ee] p-3">
                <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[12px] leading-relaxed text-slate-700 shadow-sm">{requestMessage(job, req.step, req.amount, req.dueAt)}</div>
                <div className="w-60 rounded-2xl bg-white p-3 shadow">
                  <p className="text-[12.5px] font-bold text-[#06a047]">ขอชำระ{req.label}</p>
                  <p className="text-[22px] font-bold text-slate-900">{baht(req.amount)}</p>
                  <p className="text-[11px] text-slate-500">ครบกำหนด {dateTh(req.dueAt)}</p>
                  <button onClick={() => setScreen(req.status === "paid" ? "done" : "methods")} className="mt-2 w-full rounded-lg bg-[#06c755] py-2 text-[12px] font-bold text-white">{req.status === "paid" ? "ดูใบเสร็จ" : "ชำระเงิน"}</button>
                </div>
                {slipSent && <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-[#06c755] px-3 py-2 text-[12px] text-white">ส่งสลิปโอนเงินแล้วค่ะ (รอทีมงานตรวจสอบ)</div>}
              </div>
            </>
          )}
          {screen === "methods" && (
            <>
              {head("เลือกวิธีชำระเงิน")}
              <div className="h-[520px] space-y-3 overflow-y-auto p-4">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{req.label} · {job.customer}</p><p className="text-[24px] font-bold text-slate-900">{baht(req.amount)}</p><p className="text-[10.5px] text-slate-400">ผู้รับเงิน {payeeOf(job)}</p></div>
                {req.methods.map((m) => (
                  <button key={m} onClick={() => { setMethod(m); setScreen("pay"); }} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-[#06c755]">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-[#06a047]"><Icon name={PAY_METHOD[m].icon} /></span>
                    <span className="min-w-0 flex-1"><b className="block text-[12.5px] text-slate-900">{PAY_METHOD[m].label}</b><span className="text-[10.5px] text-slate-500">{PAY_METHOD[m].sub}</span></span>
                    <Icon name="chevron_right" className="text-slate-300" />
                  </button>
                ))}
              </div>
            </>
          )}
          {screen === "pay" && (
            <>
              {head(PAY_METHOD[method].label)}
              <div className="h-[520px] space-y-3 overflow-y-auto p-4 text-center">
                <p className="text-[24px] font-bold text-slate-900">{baht(req.amount)}</p>
                {method === "qr" && (
                  <>
                    <FakeQr seed={req.id} />
                    <p className="text-[11px] text-slate-500">สแกนด้วยแอปธนาคารใดก็ได้ · QR หมดอายุภายใน 24 ชั่วโมง</p>
                    <button onClick={() => { onPay("qr"); setScreen("done"); }} className="w-full rounded-xl bg-[#06c755] py-2.5 text-[12.5px] font-bold text-white">จำลอง: ลูกค้าสแกนจ่ายแล้ว</button>
                  </>
                )}
                {method === "card" && (
                  <>
                    <div className="space-y-2 text-left"><input readOnly value="4111 11•• •••• 1111" className={inputCls} /><div className="grid grid-cols-2 gap-2"><input readOnly value="12/29" className={inputCls} /><input readOnly value="•••" className={inputCls} /></div><input readOnly value={job.customer} className={inputCls} /></div>
                    <button onClick={() => { onPay("card"); setScreen("done"); }} className="w-full rounded-xl bg-[#06c755] py-2.5 text-[12.5px] font-bold text-white">ชำระเงิน {baht(req.amount)}</button>
                    <p className="text-[10.5px] text-slate-400">จำลองหน้ากรอกบัตร ไม่มีการเรียกเก็บเงินจริง</p>
                  </>
                )}
                {method === "transfer" && (
                  <>
                    <div className="rounded-xl bg-slate-50 p-3 text-left text-[12px]"><p className="text-slate-500">โอนเข้าบัญชี</p><b className="block text-slate-900">{payeeOf(job)}</b><p className="text-slate-700">ธนาคารตัวอย่าง · 123-4-56789-0</p></div>
                    {slipSent ? <p className="rounded-xl bg-amber-50 p-3 text-[12px] font-semibold text-amber-800">ส่งสลิปแล้ว รอทีมงานตรวจสอบและยืนยัน</p> : (
                      <button onClick={() => { onSlip(); setSlipSent(true); }} className="w-full rounded-xl bg-[#06c755] py-2.5 text-[12.5px] font-bold text-white">แนบสลิป (จำลอง)</button>
                    )}
                    {slipSent && <button onClick={() => setScreen("chat")} className="w-full rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-700">กลับไปที่แชท</button>}
                  </>
                )}
                {method === "store" && (
                  <>
                    <div className="rounded-xl bg-slate-50 p-3 text-left text-[12px]"><p className="text-slate-500">ชำระที่</p><b className="block text-slate-900">{payeeOf(job)}</b><p className="mt-1 text-slate-500">แจ้งรหัสอ้างอิงนี้กับพนักงาน</p><p className="text-[16px] font-bold tracking-wider text-slate-900">{req.id}</p></div>
                    <p className="text-[11px] text-slate-500">ทีมขายจะบันทึกรับเงินเมื่อได้รับชำระ</p>
                    <button onClick={() => setScreen("chat")} className="w-full rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-700">กลับไปที่แชท</button>
                  </>
                )}
              </div>
            </>
          )}
          {screen === "done" && (
            <>
              {head("ชำระเงินสำเร็จ")}
              <div className="h-[520px] space-y-3 p-5 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-[#06a047]"><Icon name="check_circle" className="!text-[40px]" /></span>
                <p className="text-[14px] font-bold text-slate-900">ขอบคุณค่ะ ได้รับชำระแล้ว</p>
                <div className="rounded-xl bg-slate-50 p-3 text-left text-[12px]"><div className="flex justify-between"><span className="text-slate-500">รายการ</span><b>{req.label}</b></div><div className="flex justify-between"><span className="text-slate-500">ยอด</span><b>{baht(req.amount)}</b></div><div className="flex justify-between"><span className="text-slate-500">วิธีชำระ</span><b>{req.method ? PAY_METHOD[req.method].label : PAY_METHOD[method].label}</b></div><div className="flex justify-between"><span className="text-slate-500">เลขที่ใบเสร็จ</span><b>{req.receiptNo ?? "ออกให้ทาง LINE"}</b></div></div>
                <p className="text-[11px] text-slate-500">ใบเสร็จส่งให้ในแชท LINE OA แล้ว</p>
              </div>
            </>
          )}
        </div>
        <button onClick={onClose} className="rounded-full bg-white/90 px-4 py-1.5 text-[12px] font-bold text-slate-700">ปิดมุมมองลูกค้า</button>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- แผงในขั้นตอน: แทนปุ่ม "บันทึกรับเงิน" ---------------- */
export function PayStepPanel({ job, s, surveyAt, onComplete, onPatchJob, onSendLine, onConfirmClose, toast }: {
  job: Job; s: StepDef; surveyAt: string; onComplete: (id: string, key: StepKey, extra?: { surveyAt?: string }) => void;
  onPatchJob: (id: string, fn: (j: Job) => Job) => void; onSendLine: SendLine; onConfirmClose: () => void; toast: (m: string) => void;
}) {
  const key = s.key as PayKey;
  const req = job.payments?.find((p) => p.step === key);
  const [modal, setModal] = useState(false);
  const [sim, setSim] = useState(false);
  const stamp = () => NOW.toISOString();
  const patchReq = (fn: (r: PaymentReq) => PaymentReq, logText: string) => onPatchJob(job.id, (j) => ({ ...j, lastTouchAt: stamp(), payments: (j.payments ?? []).map((r) => (r.id === req?.id ? fn(r) : r)), log: [...j.log, { at: stamp(), text: logText }] }));

  const create = (r: PaymentReq, msg: string) => {
    onPatchJob(job.id, (j) => ({ ...j, lastTouchAt: stamp(), payments: [...(j.payments ?? []), r], log: [...j.log, { at: stamp(), text: `ส่งคำขอชำระ${r.label} ${baht(r.amount)} ทาง LINE OA` }] }));
    onSendLine(job, { kind: "se", who: job.owner, text: msg });
    onSendLine(job, { kind: "se", who: job.owner, card: { title: `ขอชำระ${r.label}`, lines: [`ยอด ${baht(r.amount)}`, `ครบกำหนด ${dateTh(r.dueAt)}`, `ชำระได้: ${r.methods.map((m) => PAY_METHOD[m].label).join(" · ")}`, `ผู้รับเงิน ${payeeOf(job)}`], action: "ชำระเงิน" } });
    setModal(false);
    toast(`ส่งคำขอชำระ ${baht(r.amount)} ให้ลูกค้าทาง LINE OA แล้ว`);
  };
  /* ชำระจากมุมมองลูกค้า: รอให้ปิดหน้าจำลองก่อนค่อยไปขั้นถัดไป ไม่งั้นหน้าจำลองหายกลางคัน */
  const pending = useRef<{ extra?: { surveyAt?: string } } | null>(null);
  const closeSim = () => {
    setSim(false);
    if (pending.current) { const p = pending.current; pending.current = null; onComplete(job.id, key, p.extra); }
  };
  const markPaid = (method: PayMethod, defer = false) => {
    if (!req) return;
    const no = `RC-${job.id.slice(-4)}-${(job.payments?.findIndex((p) => p.id === req.id) ?? 0) + 1}`;
    patchReq((r) => ({ ...r, status: "paid", method, paidAt: stamp(), receiptNo: no }), `รับชำระ${req.label} ${baht(req.amount)} ผ่าน ${PAY_METHOD[method].label} (ใบเสร็จ ${no})`);
    onSendLine(job, { kind: "se", who: "ระบบ", card: { title: "ใบเสร็จรับเงิน", lines: [`เลขที่ ${no}`, `${req.label} ${baht(req.amount)}`, `ชำระผ่าน ${PAY_METHOD[method].label}`, `วันที่ ${dateTh(stamp())}`] } });
    onSendLine(job, { kind: "se", who: "ระบบ", text: key === "close" ? "ขอบคุณค่ะ ได้รับชำระครบแล้ว ทีมกำลังเตรียมสินค้าและแผนติดตั้ง จะแจ้งวันนัดให้ทราบอีกครั้งค่ะ" : key === "deposit" ? "ขอบคุณค่ะ ได้รับมัดจำแล้ว ทีมจะยืนยันวันนัดสำรวจให้ค่ะ" : "ขอบคุณค่ะ ได้รับค่าสำรวจแล้ว ทีมสำรวจจะติดต่อนัดหมายค่ะ" });
    if (key !== "close") {
      const extra = key === "deposit" ? { surveyAt: req.surveyAt ?? new Date(`${surveyAt}:00+07:00`).toISOString() } : undefined;
      if (defer) pending.current = { extra }; else onComplete(job.id, key, extra);
    }
    toast(key === "close" ? "ลูกค้าชำระครบแล้ว กดยืนยันปิดขายต่อได้เลย" : `รับชำระ${req.label}แล้ว ไปขั้นถัดไป`);
  };
  const slip = () => {
    patchReq((r) => ({ ...r, status: "slip" }), "ลูกค้าส่งสลิปโอนเงิน รอตรวจสอบ");
    if (req) onSendLine(job, { kind: "cust", text: `ส่งสลิปโอนเงิน ${baht(req.amount)}`, img: true });
    toast("ลูกค้าส่งสลิปเข้าแชทแล้ว (จำลอง)");
  };
  const remind = () => {
    if (!req) return;
    onSendLine(job, { kind: "se", who: job.owner, text: `สวัสดีค่ะ คุณ${firstName(job.customer)} ขอเตือนยอด${req.label} ${baht(req.amount)} ครบกำหนดวันที่ ${dateTh(req.dueAt)} ค่ะ ชำระได้ที่การ์ดด้านบน หากโอนแล้วรบกวนส่งสลิปได้เลยนะคะ` });
    toast("ส่งข้อความเตือนทาง LINE OA แล้ว");
  };
  const reject = () => { patchReq((r) => ({ ...r, status: "requested" }), "สลิปไม่ถูกต้อง ขอให้ลูกค้าส่งใหม่"); if (req) onSendLine(job, { kind: "se", who: job.owner, text: "ขออภัยค่ะ สลิปที่ส่งมายอดหรือชื่อบัญชีไม่ตรง รบกวนตรวจสอบและส่งสลิปใหม่อีกครั้งนะคะ" }); toast("แจ้งลูกค้าให้ส่งสลิปใหม่แล้ว"); };

  return (
    <div className="space-y-2">
      {!req && <button onClick={() => setModal(true)} className={btnPrimary}><Icon name="request_quote" style={{ fontSize: 18 }} />ขอรับชำระ {baht(amountFor(job, key).amount)} ทาง LINE OA</button>}
      {req && req.status !== "paid" && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px]">
          <p className="font-bold text-amber-900">{req.status === "slip" ? "ลูกค้าส่งสลิปแล้ว รอตรวจสอบ" : "รอลูกค้าชำระ"} · {baht(req.amount)} · ครบกำหนด {dateTh(req.dueAt)}</p>
          {req.status === "slip" && <p className="rounded-lg bg-white px-2.5 py-1.5 text-emerald-700"><Icon name="check_circle" className="!text-[15px] align-middle" /> ตรวจเบื้องต้น: ยอดตรง {baht(req.amount)} · ชื่อบัญชีผู้รับตรง (จำลอง)</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSim(true)} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}><Icon name="smartphone" style={{ fontSize: 16 }} />ดูมุมมองลูกค้า (จำลอง)</button>
            {req.status === "slip" ? (
              <>
                <button onClick={() => markPaid("transfer")} className={cn(btnPrimary, "!px-3 !py-1.5 !text-[11.5px]")}>ยืนยันรับเงิน</button>
                <button onClick={reject} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px] !text-rose-600")}>สลิปไม่ถูกต้อง</button>
              </>
            ) : (
              <>
                <button onClick={remind} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}><Icon name="notifications_active" style={{ fontSize: 16 }} />ส่งเตือนทาง LINE</button>
                <button onClick={() => markPaid("store")} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}>บันทึกรับเงินเอง (ที่ร้าน/เงินสด)</button>
              </>
            )}
          </div>
        </div>
      )}
      {req?.status === "paid" && (
        <div className="space-y-2">
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800"><Icon name="check_circle" className="!text-[16px] align-middle" /> ได้รับชำระแล้ว {baht(req.amount)} · {req.method ? PAY_METHOD[req.method].label : ""} · ใบเสร็จ {req.receiptNo}</p>
          {key === "close" && <button onClick={onConfirmClose} className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />ยืนยันปิดขาย และส่งต่อให้งานหลังขาย</button>}
        </div>
      )}
      {modal && <RequestModal job={job} k={key} surveyAt={key === "deposit" ? new Date(`${surveyAt}:00+07:00`).toISOString() : undefined} onClose={() => setModal(false)} onSend={create} />}
      {sim && req && <CustomerSim job={job} req={req} onClose={closeSim} onPay={(m) => markPaid(m, true)} onSlip={slip} />}
    </div>
  );
}

/* ---------------- แท็บ "การเงิน" ในหน้ารายละเอียดงาน ---------------- */
export function PaymentsTab({ job, onOpenSim }: { job: Job; onOpenSim?: (r: PaymentReq) => void }) {
  const list = job.payments ?? [];
  const paid = list.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const legacy = (job.done.survey_fee || job.done.deposit) && !list.some((p) => p.step !== "close") && hasDeposit(job) ? depositOf(job) : 0;
  const got = paid + legacy;
  return (
    <div className="space-y-3">
      <div className={cn(glass, "grid gap-2 p-4 sm:grid-cols-3")}>
        {[["มูลค่างาน", job.value ? baht(job.value) : "ยังไม่ประเมิน"], ["ชำระแล้ว", baht(got)], ["คงเหลือ", job.value ? baht(Math.max(0, job.value - got)) : "-"]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-50 p-3"><p className="text-[10.5px] font-semibold text-slate-500">{l}</p><p className="text-[16px] font-bold text-slate-900">{v}</p></div>
        ))}
      </div>
      <div className={cn(glass, "p-4")}>
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">รายการเก็บเงิน</h3>
        <ul className="space-y-1.5">
          {legacy > 0 && <li className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px]"><span className="flex-1 font-semibold text-slate-700">{job.work === "survey" ? "ค่าสำรวจ" : "มัดจำ"} (บันทึกก่อนมีระบบขอชำระ)</span><b>{baht(legacy)}</b><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">ชำระแล้ว</span></li>}
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px]">
              <span className="min-w-0 flex-1"><b className="block truncate text-slate-800">{p.label}</b><span className="text-[10.5px] text-slate-500">{p.id} · ขอเมื่อ {dateTh(p.requestedAt)}{p.paidAt ? ` · ชำระ ${dateTh(p.paidAt)} · ${p.method ? PAY_METHOD[p.method].label : ""} · ${p.receiptNo}` : ` · ครบกำหนด ${dateTh(p.dueAt)}`}</span></span>
              <b>{baht(p.amount)}</b>
              <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", p.status === "paid" ? "bg-emerald-100 text-emerald-700" : p.status === "slip" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700")}>{p.status === "paid" ? "ชำระแล้ว" : p.status === "slip" ? "รอตรวจสลิป" : "รอชำระ"}</span>
              {onOpenSim && p.status !== "paid" && <button onClick={() => onOpenSim(p)} className="text-[11px] font-semibold text-indigo-600 hover:underline">ดูมุมมองลูกค้า</button>}
            </li>
          ))}
          {!list.length && !legacy && <li className="py-4 text-center text-[12px] text-slate-400">ยังไม่มีรายการเก็บเงิน กดขอรับชำระได้ที่ขั้นตอนในแท็บ &ldquo;ข้อมูลงาน&rdquo;</li>}
        </ul>
        <p className="mt-2 text-[10.5px] text-slate-400">ตัวอย่างการเก็บเงิน ไม่มีการรับเงินหรือส่งข้อความจริง · การแบ่งงวดชำระในใบเสนอราคาอยู่ในรอบถัดไป</p>
      </div>
    </div>
  );
}
