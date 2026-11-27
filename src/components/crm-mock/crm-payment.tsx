"use client";
/* จำลองการเก็บเงิน: แผนแบ่งงวดชำระ -> ขอรับชำระ -> ส่งทาง LINE OA -> มุมมองลูกค้าเลือกวิธีจ่าย -> ยืนยัน -> ใบเสร็จ -> ปลดล็อกขั้นตอนถัดไป
   ไม่มีการเก็บเงินหรือส่งข้อความจริง ข้อมูลผู้รับเงิน บัญชี และสัดส่วนงวดเป็นตัวอย่าง */
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  MODEL_LABEL, NOW, PAY_METHOD, PLAN_THRESHOLD, SURVEY_FEE, addWd, baht, creditOf, dateTh, dayKey, depositOf, dueOf, instGross, instNet, instPaid, minFirstPct, needsApproval, planOf, planReady, stepsOf, withPcts,
  type ChatMsg, type Installment, type Job, type PayMethod, type PaymentReq, type StepDef, type StepKey,
} from "./crm-mock-data";
import { btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";

export type SendLine = (job: { phone: string; opsId: string }, m: Omit<ChatMsg, "id" | "at" | "phone" | "job">) => void;
type PayKey = PaymentReq["step"];
type InstKey = "inst2" | "inst3";

export const isPayStep = (job: Job, key: StepKey): boolean => key === "survey_fee" || (key === "deposit" && job.work !== "survey") || key === "close";
const instNo = (k: PayKey): 1 | 2 | 3 => (k === "close" ? 1 : k === "inst2" ? 2 : 3);
export function stepLabel(job: Job, key: PayKey): string {
  if (key === "survey_fee") return "ค่าสำรวจ";
  if (key === "deposit") return "มัดจำ";
  const it = planOf(job).items.find((x) => x.no === instNo(key));
  return `งวดที่ ${instNo(key)} (${it?.pct ?? 0}%)`;
}
const itemOf = (job: Job, key: PayKey): Installment | undefined => planOf(job).items.find((x) => x.no === instNo(key));
export const payeeOf = (job: Job, payee: "store" | "scg" = "store") => (payee === "scg" ? "SCG (รับชำระโดยตรง · ตัวอย่าง)" : job.store ?? (job.model === "scg" ? "SCG Home Experience (ตัวอย่าง)" : `ร้านตัวแทน ${MODEL_LABEL[job.model]} (ตัวอย่าง)`));
const ALL_METHODS: PayMethod[] = ["qr", "card", "transfer", "store", "po"];

/** ยอดที่ต้องเก็บของขั้นนี้ พร้อมรายการหักยอดที่ชำระแล้ว */
export function amountFor(job: Job, key: PayKey) {
  if (key === "survey_fee") return { amount: SURVEY_FEE, lines: [["ค่าสำรวจ", SURVEY_FEE], ["หมายเหตุ", "หักออกจากค่าติดตั้งตอนปิดขาย"]] as [string, number | string][] };
  if (key === "deposit") return { amount: depositOf(job), lines: [["มัดจำ", depositOf(job)], ["หมายเหตุ", "หักออกจากยอดรวมตอนปิดขาย"]] as [string, number | string][] };
  const no = instNo(key);
  const lines: [string, number | string][] = [["ยอดรวมตามใบเสนอราคา", job.value], [stepLabel(job, key), instGross(job, no)]];
  if (no === 1 && creditOf(job) > 0) lines.push([job.work === "survey" ? "หัก ค่าสำรวจที่ชำระแล้ว" : "หัก มัดจำที่ชำระแล้ว", -creditOf(job)]);
  return { amount: instNet(job, no), lines };
}
const fmt = (v: number | string) => (typeof v === "number" ? (v < 0 ? `−${baht(-v)}` : baht(v)) : v);
const firstName = (n: string) => n.replace(/^คุณ/, "").split(" ")[0];

function requestMessage(job: Job, key: PayKey, amount: number, due: string) {
  const n = firstName(job.customer);
  if (key === "survey_fee") return `สวัสดีค่ะ คุณ${n} ขอแจ้งค่าสำรวจหน้างาน จำนวน ${baht(amount)} ค่ะ ชำระได้ที่ลิงก์ในการ์ดด้านล่าง ภายในวันที่ ${dateTh(due)} ค่าสำรวจนี้จะหักออกจากค่าติดตั้งตอนปิดงานนะคะ`;
  if (key === "deposit") return `สวัสดีค่ะ คุณ${n} ขอแจ้งค่ามัดจำเพื่อล็อกคิวสำรวจ จำนวน ${baht(amount)} ค่ะ ชำระได้ที่ลิงก์ในการ์ดด้านล่าง ภายในวันที่ ${dateTh(due)} ถ้ามีข้อสงสัยตอบกลับในแชทนี้ได้เลยนะคะ`;
  const it = itemOf(job, key);
  if (key === "close") return `สวัสดีค่ะ คุณ${n} ขอแจ้ง${stepLabel(job, key)} ${baht(amount)} เพื่อยืนยันการสั่งซื้อและเริ่มสั่งสินค้าค่ะ ชำระได้ที่การ์ดด้านล่าง ภายในวันที่ ${dateTh(due)} เมื่อได้รับชำระทีมจะส่งแผนติดตั้งและกำหนดส่งสินค้าให้ทราบค่ะ`;
  const step = stepsOf(job).find((s) => it?.gate.includes(s.key) && !job.done[s.key]);
  const planned = step ? dateTh(dueOf(job, step)) : "ตามแผน";
  return `สวัสดีค่ะ คุณ${n} ขอแจ้ง${stepLabel(job, key)} ${baht(amount)} ค่ะ กรุณาชำระภายในวันที่ ${dateTh(due)} เพื่อให้ทีมสามารถ${it?.unlocks[0] ?? "ดำเนินการต่อ"}ได้ตามแผนวันที่ ${planned} หากชำระหลังกำหนด วันส่งของและติดตั้งจะเลื่อนตามค่ะ`;
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
  const [payee, setPayee] = useState<"store" | "scg">("store");
  const [methods, setMethods] = useState<PayMethod[]>(["qr", "card", "transfer"]);
  const [poTerm, setPoTerm] = useState(30);
  const [due, setDue] = useState(dayKey(addWd(NOW.toISOString(), 3)));
  const amt = Number(amount.replace(/,/g, "")) || 0;
  const dueIso = `${due}T17:00:00+07:00`;
  const [msg, setMsg] = useState(() => requestMessage(job, k, base.amount, `${dayKey(addWd(NOW.toISOString(), 3))}T17:00:00+07:00`));
  const ok = amt > 0 && methods.length > 0;
  const avail = ALL_METHODS.filter((m) => !(payee === "scg" && m === "store"));
  const tog = (m: PayMethod) => setMethods((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));
  const pickPayee = (p: "store" | "scg") => { setPayee(p); if (p === "scg") setMethods((x) => x.filter((m) => m !== "store")); };
  const send = () => onSend({ id: `PAY-${job.id.slice(-4)}-${(job.payments?.length ?? 0) + 1}`, step: k, label: stepLabel(job, k), amount: amt, methods, dueAt: dueIso, status: "requested", requestedAt: NOW.toISOString(), surveyAt, payee, poTerm: methods.includes("po") ? poTerm : undefined }, msg);
  const title = stepLabel(job, k);
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="grid max-h-[92vh] w-full max-w-4xl gap-0 overflow-y-auto rounded-3xl bg-white shadow-2xl md:grid-cols-[1.2fr_1fr]" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3 p-5">
          <div><p className="text-[15px] font-bold text-slate-900">ขอรับชำระ: {title}</p><p className="text-[11px] text-slate-400">{job.id} · {job.customer}</p></div>
          <div className="rounded-xl bg-slate-50 p-3 text-[12px]">
            {base.lines.map(([l, v], i) => <div key={i} className="flex justify-between py-0.5"><span className="text-slate-600">{l}</span><b className={typeof v === "number" && v < 0 ? "text-rose-600" : "text-slate-800"}>{fmt(v)}</b></div>)}
            <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-900">ยอดที่ขอชำระ (฿)</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={cn(inputCls, "!w-36 text-right font-bold")} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11.5px] font-bold text-slate-700">ผู้รับเงิน</p>
            <div className="grid grid-cols-2 gap-2">
              {([["store", "ร้านตัวแทน / ผู้ขาย", "ทีมขายหรือร้านรับเงินและบันทึกเอง"], ["scg", "SCG โดยตรง", "ลูกค้าจ่ายเข้า SCG ทีมขายเห็นสถานะ ไม่ต้องรับเงินเอง"]] as const).map(([p, l, s]) => (
                <button key={p} type="button" onClick={() => pickPayee(p)} className={cn("rounded-xl border p-2.5 text-left transition", payee === p ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300")}><b className="block text-[12px] text-slate-900">{l}</b><span className="text-[10.5px] text-slate-500">{s}</span></button>
              ))}
            </div>
            <p className="mt-1 text-[10.5px] text-slate-400">ชื่อผู้รับเงินที่แสดงให้ลูกค้า: {payeeOf(job, payee)}</p>
          </div>
          <div>
            <p className="mb-1.5 text-[11.5px] font-bold text-slate-700">วิธีชำระที่เปิดให้ลูกค้า</p>
            <div className="grid grid-cols-2 gap-2">
              {avail.map((m) => (
                <button key={m} type="button" onClick={() => tog(m)} className={cn("flex items-start gap-2 rounded-xl border p-2.5 text-left transition", methods.includes(m) ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300")}>
                  <Icon name={PAY_METHOD[m].icon} className={methods.includes(m) ? "text-indigo-600" : "text-slate-400"} />
                  <span><b className="block text-[12px] text-slate-900">{PAY_METHOD[m].label}</b><span className="text-[10.5px] text-slate-500">{PAY_METHOD[m].sub}</span></span>
                </button>
              ))}
            </div>
            {methods.includes("po") && (
              <label className="mt-2 flex items-center gap-2 text-[11.5px] font-semibold text-slate-700">เครดิตเทอมหลังออกใบแจ้งหนี้
                <select value={poTerm} onChange={(e) => setPoTerm(Number(e.target.value))} className={cn(inputCls, "!w-28")}>{[0, 15, 30, 45, 60].map((d) => <option key={d} value={d}>{d === 0 ? "ชำระทันที" : `${d} วัน`}</option>)}</select>
              </label>
            )}
          </div>
          <label className="block"><span className="mb-1 block text-[11.5px] font-bold text-slate-700">ครบกำหนดชำระ</span><input type="date" value={due} onChange={(e) => { setDue(e.target.value); setMsg(requestMessage(job, k, amt, `${e.target.value}T17:00:00+07:00`)); }} className={inputCls} /></label>
          <label className="block"><span className="mb-1 block text-[11.5px] font-bold text-slate-700">ข้อความถึงลูกค้า (แก้ไขได้)</span><textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} className={cn(inputCls, "resize-none")} /></label>
          <div className="flex justify-end gap-2"><button onClick={onClose} className={btnGhost}>ยกเลิก</button><button onClick={send} disabled={!ok} className={btnPrimary}><Icon name="send" style={{ fontSize: 18 }} />ส่งทาง LINE OA</button></div>
        </div>
        <div className="bg-[#e9f7ee] p-5">
          <p className="mb-2 text-[11.5px] font-bold text-[#06a047]">ตัวอย่างที่ลูกค้าจะเห็นใน LINE</p>
          <div className="space-y-2">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-[12px] leading-relaxed text-slate-700 shadow-sm">{msg}</div>
            <div className="w-64 rounded-2xl bg-white p-3 shadow">
              <p className="text-[12.5px] font-bold text-[#06a047]">ขอชำระ{title}</p>
              <p className="text-[22px] font-bold text-slate-900">{baht(amt)}</p>
              <p className="text-[11px] text-slate-500">ครบกำหนด {dateTh(dueIso)} · ผู้รับเงิน {payeeOf(job, payee)}</p>
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
export function CustomerSim({ job, req, onClose, onPay, onSlip }: { job: Job; req: PaymentReq; onClose: () => void; onPay: (m: PayMethod) => void; onSlip: (m: PayMethod) => void }) {
  const [screen, setScreen] = useState<SimScreen>(req.status === "paid" ? "done" : "chat");
  const [method, setMethod] = useState<PayMethod>(req.methods[0] ?? "qr");
  const [slipSent, setSlipSent] = useState(req.status === "slip");
  const payee = payeeOf(job, req.payee);
  const head = (t: string) => <div className="flex items-center gap-2 bg-[#06c755] px-3 py-2.5 text-white"><button onClick={() => (screen === "chat" || screen === "done" ? onClose() : setScreen(screen === "pay" ? "methods" : "chat"))} aria-label="กลับ"><Icon name="arrow_back" className="!text-[20px]" /></button><b className="text-[13px]">{t}</b></div>;
  const viaPo = (req.pending ?? method) === "po";
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
                {slipSent && <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-[#06c755] px-3 py-2 text-[12px] text-white">{viaPo ? "ส่งเลข PO แล้วค่ะ (รอทีมงานตรวจสอบ)" : "ส่งสลิปโอนเงินแล้วค่ะ (รอทีมงานตรวจสอบ)"}</div>}
              </div>
            </>
          )}
          {screen === "methods" && (
            <>
              {head("เลือกวิธีชำระเงิน")}
              <div className="h-[520px] space-y-3 overflow-y-auto p-4">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{req.label} · {job.customer}</p><p className="text-[24px] font-bold text-slate-900">{baht(req.amount)}</p><p className="text-[10.5px] text-slate-400">ผู้รับเงิน {payee}</p></div>
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
                    <div className="rounded-xl bg-slate-50 p-3 text-left text-[12px]"><p className="text-slate-500">โอนเข้าบัญชี</p><b className="block text-slate-900">{payee}</b><p className="text-slate-700">ธนาคารตัวอย่าง · 123-4-56789-0</p></div>
                    {slipSent ? <p className="rounded-xl bg-amber-50 p-3 text-[12px] font-semibold text-amber-800">ส่งสลิปแล้ว รอทีมงานตรวจสอบและยืนยัน</p> : (
                      <button onClick={() => { onSlip("transfer"); setSlipSent(true); }} className="w-full rounded-xl bg-[#06c755] py-2.5 text-[12.5px] font-bold text-white">แนบสลิป (จำลอง)</button>
                    )}
                    {slipSent && <button onClick={() => setScreen("chat")} className="w-full rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-700">กลับไปที่แชท</button>}
                  </>
                )}
                {method === "po" && (
                  <>
                    <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-left text-[12px]"><p className="text-slate-500">ชำระโดยเปิด PO ถึง</p><b className="block text-slate-900">{payee}</b>
                      <label className="block"><span className="text-[10.5px] text-slate-500">เลข PO ของลูกค้า</span><input readOnly value="PO-2611-0042" className={inputCls} /></label>
                      <p className="text-[11px] text-slate-500">เครดิตเทอม {req.poTerm ? `${req.poTerm} วันหลังออกใบแจ้งหนี้` : "ชำระทันทีหลังออกใบแจ้งหนี้"}</p></div>
                    {slipSent ? <p className="rounded-xl bg-amber-50 p-3 text-[12px] font-semibold text-amber-800">ส่งเลข PO แล้ว รอทีมงานตรวจสอบและออกใบแจ้งหนี้</p> : (
                      <button onClick={() => { onSlip("po"); setSlipSent(true); }} className="w-full rounded-xl bg-[#06c755] py-2.5 text-[12.5px] font-bold text-white">ส่งเลข PO (จำลอง)</button>
                    )}
                    {slipSent && <button onClick={() => setScreen("chat")} className="w-full rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-700">กลับไปที่แชท</button>}
                  </>
                )}
                {method === "store" && (
                  <>
                    <div className="rounded-xl bg-slate-50 p-3 text-left text-[12px]"><p className="text-slate-500">ชำระที่</p><b className="block text-slate-900">{payee}</b><p className="mt-1 text-slate-500">แจ้งรหัสอ้างอิงนี้กับพนักงาน</p><p className="text-[16px] font-bold tracking-wider text-slate-900">{req.id}</p></div>
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

/* ---------------- แผงในขั้นตอน / ด่านการชำระ ---------------- */
export function PayStepPanel({ job, s, payKey, surveyAt, onComplete, onPatchJob, onSendLine, onConfirmClose, toast }: {
  job: Job; s: StepDef; payKey?: PayKey; surveyAt: string; onComplete: (id: string, key: StepKey, extra?: { surveyAt?: string }) => void;
  onPatchJob: (id: string, fn: (j: Job) => Job) => void; onSendLine: SendLine; onConfirmClose: () => void; toast: (m: string) => void;
}) {
  const key: PayKey = payKey ?? (s.key as PayKey);
  const req = job.payments?.find((p) => p.step === key);
  const [modal, setModal] = useState(false);
  const [sim, setSim] = useState(false);
  const stamp = () => NOW.toISOString();
  const completes = key === "survey_fee" || key === "deposit";
  const plan = planOf(job);
  const blocked = key === "close" && !planReady(plan);
  const patchReq = (fn: (r: PaymentReq) => PaymentReq, logText: string) => onPatchJob(job.id, (j) => ({ ...j, lastTouchAt: stamp(), payments: (j.payments ?? []).map((r) => (r.id === req?.id ? fn(r) : r)), log: [...j.log, { at: stamp(), text: logText }] }));

  const create = (r: PaymentReq, msg: string) => {
    onPatchJob(job.id, (j) => ({ ...j, lastTouchAt: stamp(), payments: [...(j.payments ?? []), r], log: [...j.log, { at: stamp(), text: `ส่งคำขอชำระ${r.label} ${baht(r.amount)} ทาง LINE OA` }] }));
    onSendLine(job, { kind: "se", who: job.owner, text: msg });
    onSendLine(job, { kind: "se", who: job.owner, card: { title: `ขอชำระ${r.label}`, lines: [`ยอด ${baht(r.amount)}`, `ครบกำหนด ${dateTh(r.dueAt)}`, `ชำระได้: ${r.methods.map((m) => PAY_METHOD[m].label).join(" · ")}`, `ผู้รับเงิน ${payeeOf(job, r.payee)}`], action: "ชำระเงิน" } });
    setModal(false);
    toast(`ส่งคำขอชำระ ${baht(r.amount)} ให้ลูกค้าทาง LINE OA แล้ว`);
  };
  /* ชำระจากมุมมองลูกค้า: รอให้ปิดหน้าจำลองก่อนค่อยไปขั้นถัดไป ไม่งั้นหน้าจำลองหายกลางคัน */
  const pending = useRef<{ extra?: { surveyAt?: string } } | null>(null);
  const closeSim = () => {
    setSim(false);
    if (pending.current) { const p = pending.current; pending.current = null; onComplete(job.id, s.key, p.extra); }
  };
  const markPaid = (method: PayMethod, defer = false) => {
    if (!req) return;
    const no = `RC-${job.id.slice(-4)}-${(job.payments?.findIndex((p) => p.id === req.id) ?? 0) + 1}`;
    const it = itemOf(job, key);
    patchReq((r) => ({ ...r, status: "paid", method, paidAt: stamp(), receiptNo: no }), `รับชำระ${req.label} ${baht(req.amount)} ผ่าน ${PAY_METHOD[method].label} (ใบเสร็จ ${no})${it && it.no > 1 ? ` · ปลดล็อก: ${it.unlocks.join(", ")}` : ""}`);
    onSendLine(job, { kind: "se", who: "ระบบ", card: { title: "ใบเสร็จรับเงิน", lines: [`เลขที่ ${no}`, `${req.label} ${baht(req.amount)}`, `ชำระผ่าน ${PAY_METHOD[method].label}`, `วันที่ ${dateTh(stamp())}`] } });
    onSendLine(job, { kind: "se", who: "ระบบ", text: key === "close" ? "ขอบคุณค่ะ ได้รับชำระงวดแรกแล้ว ทีมกำลังสั่งสินค้าและเตรียมแผนติดตั้ง จะแจ้งวันนัดและวันส่งสินค้าให้ทราบค่ะ" : key === "deposit" ? "ขอบคุณค่ะ ได้รับมัดจำแล้ว ทีมจะยืนยันวันนัดสำรวจให้ค่ะ" : key === "survey_fee" ? "ขอบคุณค่ะ ได้รับค่าสำรวจแล้ว ทีมสำรวจจะติดต่อนัดหมายค่ะ" : `ขอบคุณค่ะ ได้รับชำระ${req.label}แล้ว ทีมจะ${it?.unlocks.join(" และ ") ?? "ดำเนินการต่อ"}ตามแผนค่ะ` });
    if (completes) {
      const extra = key === "deposit" ? { surveyAt: req.surveyAt ?? new Date(`${surveyAt}:00+07:00`).toISOString() } : undefined;
      if (defer) pending.current = { extra }; else onComplete(job.id, s.key, extra);
    }
    toast(key === "close" ? "ลูกค้าชำระงวดแรกแล้ว กดยืนยันปิดขายต่อได้เลย" : completes ? `รับชำระ${req.label}แล้ว ไปขั้นถัดไป` : `รับชำระ${req.label}แล้ว ปลดล็อกขั้นตอนต่อไป แจ้ง KIM/SCM แล้ว`);
  };
  const slip = (m: PayMethod) => {
    patchReq((r) => ({ ...r, status: "slip", pending: m }), m === "po" ? "ลูกค้าส่งเลข PO รอตรวจสอบและออกใบแจ้งหนี้" : "ลูกค้าส่งสลิปโอนเงิน รอตรวจสอบ");
    if (req) onSendLine(job, { kind: "cust", text: m === "po" ? "ส่งเลข PO: PO-2611-0042" : `ส่งสลิปโอนเงิน ${baht(req.amount)}`, img: m !== "po" });
    toast(m === "po" ? "ลูกค้าส่งเลข PO เข้าแชทแล้ว (จำลอง)" : "ลูกค้าส่งสลิปเข้าแชทแล้ว (จำลอง)");
  };
  const remind = () => {
    if (!req) return;
    onSendLine(job, { kind: "se", who: job.owner, text: `สวัสดีค่ะ คุณ${firstName(job.customer)} ขอเตือน${req.label} ${baht(req.amount)} ครบกำหนดวันที่ ${dateTh(req.dueAt)} ค่ะ ชำระได้ที่การ์ดด้านบน หากโอนแล้วรบกวนส่งสลิปได้เลยนะคะ` });
    toast("ส่งข้อความเตือนทาง LINE OA แล้ว");
  };
  const reject = () => { patchReq((r) => ({ ...r, status: "requested", pending: undefined }), "หลักฐานไม่ถูกต้อง ขอให้ลูกค้าส่งใหม่"); if (req) onSendLine(job, { kind: "se", who: job.owner, text: "ขออภัยค่ะ ข้อมูลที่ส่งมายอดหรือชื่อบัญชีไม่ตรง รบกวนตรวจสอบและส่งใหม่อีกครั้งนะคะ" }); toast("แจ้งลูกค้าให้ส่งใหม่แล้ว"); };
  const viaScg = req?.payee === "scg";
  const viaPo = req?.pending === "po";

  if (blocked) return <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] font-semibold text-amber-800"><Icon name="lock" className="!text-[16px] align-middle" /> ขอรับชำระงวดแรกไม่ได้ แผนชำระต่ำกว่าขั้นต่ำ {minFirstPct()}% ต้องให้ Area อนุมัติแผนชำระก่อน (ดูแผนชำระในแท็บ &ldquo;การเงิน&rdquo;)</p>;
  return (
    <div className="space-y-2">
      {!req && <button onClick={() => setModal(true)} className={btnPrimary}><Icon name="request_quote" style={{ fontSize: 18 }} />ขอรับชำระ {stepLabel(job, key)} {baht(amountFor(job, key).amount)} ทาง LINE OA</button>}
      {req && req.status !== "paid" && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px]">
          <p className="font-bold text-amber-900">{req.status === "slip" ? (viaPo ? "ลูกค้าส่งเลข PO แล้ว รอตรวจสอบ" : "ลูกค้าส่งสลิปแล้ว รอตรวจสอบ") : "รอลูกค้าชำระ"} · {baht(req.amount)} · ครบกำหนด {dateTh(req.dueAt)}</p>
          <p className="text-[11px] text-slate-600">ผู้รับเงิน: <b>{payeeOf(job, req.payee)}</b>{req.poTerm !== undefined && req.methods.includes("po") ? ` · เปิด PO ได้ เครดิตเทอม ${req.poTerm ? `${req.poTerm} วัน` : "ชำระทันที"}` : ""}</p>
          {req.status === "slip" && <p className="rounded-lg bg-white px-2.5 py-1.5 text-emerald-700"><Icon name="check_circle" className="!text-[15px] align-middle" /> {viaPo ? "ตรวจเบื้องต้น: เลข PO รูปแบบถูกต้อง · ยอดไม่เกินวงเงิน (จำลอง)" : `ตรวจเบื้องต้น: ยอดตรง ${baht(req.amount)} · ชื่อบัญชีผู้รับตรง (จำลอง)`}</p>}
          {viaScg && <p className="rounded-lg bg-white px-2.5 py-1.5 text-slate-600"><Icon name="account_balance" className="!text-[15px] align-middle" /> ลูกค้าจ่ายตรงเข้า SCG · สถานะอัปเดตจากบัญชี SCG ทีมขายไม่ต้องรับเงินเอง</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSim(true)} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}><Icon name="smartphone" style={{ fontSize: 16 }} />ดูมุมมองลูกค้า (จำลอง)</button>
            {req.status === "slip" ? (
              <>
                <button onClick={() => markPaid(req.pending ?? "transfer")} className={cn(btnPrimary, "!px-3 !py-1.5 !text-[11.5px]")}>{viaScg ? "จำลอง: บัญชี SCG ยืนยันรับเงิน" : viaPo ? "ยืนยันรับชำระตาม PO" : "ยืนยันรับเงิน"}</button>
                <button onClick={reject} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px] !text-rose-600")}>{viaPo ? "PO ไม่ถูกต้อง" : "สลิปไม่ถูกต้อง"}</button>
              </>
            ) : (
              <>
                <button onClick={remind} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}><Icon name="notifications_active" style={{ fontSize: 16 }} />ส่งเตือนทาง LINE</button>
                {viaScg
                  ? <button onClick={() => markPaid(req.methods.includes("qr") ? "qr" : "transfer")} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}>จำลอง: บัญชี SCG ยืนยันรับเงิน</button>
                  : <button onClick={() => markPaid("store")} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}>บันทึกรับเงินเอง (ที่ร้าน/เงินสด)</button>}
              </>
            )}
          </div>
        </div>
      )}
      {req?.status === "paid" && (
        <div className="space-y-2">
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800"><Icon name="check_circle" className="!text-[16px] align-middle" /> ได้รับชำระแล้ว {baht(req.amount)} · {req.method ? PAY_METHOD[req.method].label : ""} · ใบเสร็จ {req.receiptNo}</p>
          {key === "close" && !job.done.close && <button onClick={onConfirmClose} className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />ยืนยันปิดขาย และส่งต่อให้งานหลังขาย</button>}
        </div>
      )}
      {modal && <RequestModal job={job} k={key} surveyAt={key === "deposit" ? new Date(`${surveyAt}:00+07:00`).toISOString() : undefined} onClose={() => setModal(false)} onSend={create} />}
      {sim && req && <CustomerSim job={job} req={req} onClose={closeSim} onPay={(m) => markPaid(m, true)} onSlip={slip} />}
    </div>
  );
}

/** ด่านการชำระ: ขั้นที่ถูกระงับ (หรือใกล้ถึง) เพราะรอลูกค้าชำระงวด */
export function GatePanel({ job, step, it, held, onComplete, onPatchJob, onSendLine, toast }: {
  job: Job; step: StepDef; it: Installment; held: boolean; onComplete: (id: string, key: StepKey, extra?: { surveyAt?: string }) => void;
  onPatchJob: (id: string, fn: (j: Job) => Job) => void; onSendLine: SendLine; toast: (m: string) => void;
}) {
  const short = `งวดที่ ${it.no}`;
  const net = instNet(job, it.no);
  return (
    <div className={cn("mt-2 space-y-2 rounded-xl border p-3 text-[12px]", held ? "border-rose-300 bg-rose-50" : "border-amber-200 bg-amber-50/60")}>
      <p className={cn("flex items-start gap-1.5 font-bold", held ? "text-rose-800" : "text-amber-900")}>
        <Icon name={held ? "lock" : "schedule"} className="!text-[17px]" />
        <span>{held ? `ระงับ: รอลูกค้าชำระ${short} ${baht(net)} ก่อน “${step.label}”` : `ล่วงหน้า: ต้องชำระ${short} ${baht(net)} ก่อนถึงขั้น “${step.label}” (แผน ${dateTh(dueOf(job, step))})`}</span>
      </p>
      {held && <p className="text-[11.5px] text-rose-700">KIM/SCM ได้รับแจ้งแล้ว ยังสั่ง ส่ง หรือติดตั้งไม่ได้จนกว่าลูกค้าจะชำระ · วันส่งของและติดตั้งเลื่อนตามวันที่ชำระ</p>}
      <p className="text-[11px] text-slate-600">ปลดล็อก: {it.unlocks.join(" · ")}</p>
      <PayStepPanel job={job} s={step} payKey={`inst${it.no}` as InstKey} surveyAt="" onComplete={onComplete} onPatchJob={onPatchJob} onSendLine={onSendLine} onConfirmClose={() => undefined} toast={toast} />
    </div>
  );
}

/* ---------------- แผนแบ่งงวดชำระในใบเสนอราคา ---------------- */
export function PlanEditor({ job, onPatchJob, onSendLine, toast }: { job: Job; onPatchJob: (id: string, fn: (j: Job) => Job) => void; onSendLine: SendLine; toast: (m: string) => void }) {
  const plan = planOf(job);
  const locked = !!job.done.close;
  const min = minFirstPct();
  const need = needsApproval(plan);
  const three = plan.items.length === 3;
  const stamp = () => NOW.toISOString();
  const set = (first: number, second?: number) => onPatchJob(job.id, (j) => ({ ...j, plan: { ...withPcts(planOf(j), first, second), approval: undefined, sentAt: undefined } }));
  const patchPlan = (p: Partial<typeof plan>, text: string) => onPatchJob(job.id, (j) => ({ ...j, plan: { ...planOf(j), ...p }, lastTouchAt: stamp(), log: [...j.log, { at: stamp(), text }] }));
  const credit = creditOf(job);
  const send = () => {
    onSendLine(job, { kind: "se", who: job.owner, text: `สวัสดีค่ะ คุณ${firstName(job.customer)} ส่งแผนการชำระเงินของงานนี้ให้ดูตามการ์ดด้านล่างนะคะ แต่ละงวดผูกกับขั้นตอนงาน เมื่อชำระแล้วทีมจะดำเนินการขั้นถัดไปได้ตามแผนค่ะ` });
    onSendLine(job, { kind: "se", who: job.owner, card: { title: `แผนชำระเงิน ${job.opsId}`, lines: [...plan.items.map((it) => `${it.label}: ${it.pct}% = ${baht(instGross(job, it.no))}`), ...(credit > 0 ? [`หัก${job.work === "survey" ? "ค่าสำรวจ" : "มัดจำ"}ที่ชำระแล้ว ${baht(credit)} จากงวดที่ 1`] : []), `รวม ${baht(job.value)}`] } });
    patchPlan({ sentAt: stamp() }, "ส่งแผนชำระเงินให้ลูกค้าทาง LINE OA");
    toast("ส่งแผนชำระเงินให้ลูกค้าทาง LINE OA แล้ว");
  };
  return (
    <div className={cn(glass, "space-y-3 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="account_tree" className="!text-[18px] text-indigo-600" />แผนแบ่งงวดชำระเงิน</h3>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", plan.tier === "gte1m" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600")}>{plan.tier === "gte1m" ? `ตั้งแต่ ${baht(PLAN_THRESHOLD)} ขึ้นไป · 3 งวด` : `ต่ำกว่า ${baht(PLAN_THRESHOLD)} · 2 งวด`} (รวม VAT)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead className="text-[10.5px] uppercase tracking-wide text-slate-400"><tr><th className="py-1 pr-2 font-semibold">งวด</th><th className="px-2 py-1 font-semibold">ชำระเมื่อ</th><th className="px-2 py-1 font-semibold">%</th><th className="px-2 py-1 font-semibold">ยอด</th><th className="px-2 py-1 font-semibold">ปลดล็อก</th>{locked && <th className="px-2 py-1 font-semibold">สถานะ</th>}</tr></thead>
          <tbody>
            {plan.items.map((it) => {
              const paid = locked && instPaid(job, it.no);
              return (
                <tr key={it.no} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-2 font-semibold text-slate-800">{it.label}</td>
                  <td className="px-2 py-2 text-slate-600">{it.when}</td>
                  <td className="px-2 py-2">
                    {locked || (it.no === 3) || (it.no === 2 && !three) ? <b>{it.pct}%</b> : it.no === 1 ? (
                      <select value={it.pct} onChange={(e) => set(Number(e.target.value))} className={cn(inputCls, "!w-24 !py-1")}>{[30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80].map((p) => <option key={p} value={p}>{p}%{p < min ? " *" : ""}</option>)}</select>
                    ) : (
                      <select value={it.pct} onChange={(e) => set(plan.items[0].pct, Number(e.target.value))} className={cn(inputCls, "!w-24 !py-1")}>{Array.from({ length: Math.max(1, (100 - plan.items[0].pct - 5) / 5) }, (_, i) => (i + 1) * 5).map((p) => <option key={p} value={p}>{p}%</option>)}</select>
                    )}
                  </td>
                  <td className="px-2 py-2 font-semibold text-slate-800">{baht(instGross(job, it.no))}{it.no === 1 && credit > 0 && <span className="block text-[10.5px] font-normal text-rose-600">หักที่ชำระแล้ว {baht(credit)} · เก็บจริง {baht(instNet(job, 1))}</span>}</td>
                  <td className="px-2 py-2"><div className="flex flex-wrap gap-1">{it.unlocks.map((u) => <span key={u} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">{u}</span>)}</div></td>
                  {locked && <td className="px-2 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{paid ? "ชำระแล้ว" : "ยังไม่ชำระ"}</span></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">งวดแรกขั้นต่ำ <b>{min}%</b> (ให้ครอบคลุมต้นทุนสินค้าที่สั่ง) ต่ำกว่านี้ต้องให้ Area อนุมัติ · เก็บงวดถัดไปก่อนส่งของและก่อนติดตั้ง จึงไม่เหลือเงินค้างหลังส่งมอบ</p>
      {!locked && need && (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px]">
          <p className="font-bold text-amber-900"><Icon name="gpp_maybe" className="!text-[17px] align-middle" /> งวดแรก {plan.items[0].pct}% ต่ำกว่าขั้นต่ำ {min}% {plan.approval === "approved" ? "· Area อนุมัติแล้ว" : plan.approval === "pending" ? "· รอ Area อนุมัติ" : "· ต้องขออนุมัติก่อนขอรับชำระ"}</p>
          <div className="flex flex-wrap gap-2">
            {!plan.approval && <button onClick={() => patchPlan({ approval: "pending" }, `ขออนุมัติแผนชำระ งวดแรก ${plan.items[0].pct}% (ต่ำกว่าขั้นต่ำ ${min}%) จาก Area`)} className={cn(btnPrimary, "!px-3 !py-1.5 !text-[11.5px]")}>ขออนุมัติจาก Area</button>}
            {plan.approval === "pending" && <button onClick={() => patchPlan({ approval: "approved" }, "Area อนุมัติแผนชำระ (จำลอง)")} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}>จำลอง: Area อนุมัติ</button>}
          </div>
        </div>
      )}
      {!locked && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={send} disabled={need && plan.approval !== "approved"} className={cn(btnGhost, "!px-3 !py-1.5 !text-[12px]")}><Icon name="send" style={{ fontSize: 16 }} />ส่งแผนชำระพร้อมใบเสนอราคาทาง LINE</button>
          {plan.sentAt && <span className="text-[11px] font-semibold text-emerald-700">ส่งแผนให้ลูกค้าแล้ว {dateTh(plan.sentAt)}</span>}
        </div>
      )}
      <p className="text-[10.5px] text-slate-400">ตัวอย่างสัดส่วนงวดและต้นทุนสินค้า ฝ่ายการเงินต้องยืนยันก่อนใช้จริง</p>
    </div>
  );
}

/* ---------------- แท็บ "การเงิน" ในหน้ารายละเอียดงาน ---------------- */
export function PaymentsTab({ job, onPatchJob, onSendLine, toast }: { job: Job; onPatchJob: (id: string, fn: (j: Job) => Job) => void; onSendLine: SendLine; toast: (m: string) => void }) {
  const list = job.payments ?? [];
  const paid = list.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const legacy = (job.done.survey_fee || job.done.deposit) && !list.some((p) => p.step === "survey_fee" || p.step === "deposit") && job.work !== "survey" ? depositOf(job) : (job.done.survey_fee && !list.some((p) => p.step === "survey_fee") ? depositOf(job) : 0);
  const got = paid + legacy;
  return (
    <div className="space-y-3">
      <div className={cn(glass, "grid gap-2 p-4 sm:grid-cols-3")}>
        {[["มูลค่างาน", job.value ? baht(job.value) : "ยังไม่ประเมิน"], ["ชำระแล้ว", baht(got)], ["คงเหลือ", job.value ? baht(Math.max(0, job.value - got)) : "-"]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-50 p-3"><p className="text-[10.5px] font-semibold text-slate-500">{l}</p><p className="text-[16px] font-bold text-slate-900">{v}</p></div>
        ))}
      </div>
      {job.value > 0 && <PlanEditor job={job} onPatchJob={onPatchJob} onSendLine={onSendLine} toast={toast} />}
      <div className={cn(glass, "p-4")}>
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">รายการเก็บเงิน</h3>
        <ul className="space-y-1.5">
          {legacy > 0 && <li className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px]"><span className="flex-1 font-semibold text-slate-700">{job.work === "survey" ? "ค่าสำรวจ" : "มัดจำ"} (บันทึกก่อนมีระบบขอชำระ)</span><b>{baht(legacy)}</b><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">ชำระแล้ว</span></li>}
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px]">
              <span className="min-w-0 flex-1"><b className="block truncate text-slate-800">{p.label}</b><span className="text-[10.5px] text-slate-500">{p.id} · ผู้รับเงิน {payeeOf(job, p.payee)} · ขอเมื่อ {dateTh(p.requestedAt)}{p.paidAt ? ` · ชำระ ${dateTh(p.paidAt)} · ${p.method ? PAY_METHOD[p.method].label : ""} · ${p.receiptNo}` : ` · ครบกำหนด ${dateTh(p.dueAt)}`}</span></span>
              <b>{baht(p.amount)}</b>
              <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", p.status === "paid" ? "bg-emerald-100 text-emerald-700" : p.status === "slip" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700")}>{p.status === "paid" ? "ชำระแล้ว" : p.status === "slip" ? (p.pending === "po" ? "รอตรวจ PO" : "รอตรวจสลิป") : "รอชำระ"}</span>
            </li>
          ))}
          {!list.length && !legacy && <li className="py-4 text-center text-[12px] text-slate-400">ยังไม่มีรายการเก็บเงิน กดขอรับชำระได้ที่ขั้นตอนในแท็บ &ldquo;ข้อมูลงาน&rdquo;</li>}
        </ul>
        <p className="mt-2 text-[10.5px] text-slate-400">ตัวอย่างการเก็บเงิน ไม่มีการรับเงินหรือส่งข้อความจริง</p>
      </div>
    </div>
  );
}
