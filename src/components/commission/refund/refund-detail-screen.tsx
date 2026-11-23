"use client";
/* รายละเอียดคำขอคืนเงิน + ปุ่มตามบทบาท (server ตรวจสิทธิ์ซ้ำทุกครั้ง)
   จอกว้าง: ซ้าย = ข้อมูล / ขวา = สิ่งที่ต้องทำ + ประวัติ ; มือถือเรียงตาม order-* */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import {
  CARRIERS, DOC_ADDRESS, DOC_META, FINANCE_CHECKS, STATUS_META, STEPS, baht2, dateTh, fetchRefund, fmtTaxId, groupLabel, refundAction, refundFileUrl, stepIndex, typeLabel, uploadRefundDoc,
  type UploadedDoc,
  type DocKind, type RefundCaps, type RefundDetail, type RefundRole, type RefundStatus,
} from "@/lib/commission/refund-store";
import { btn, card, inputCls } from "../boq/boq-shared";

const FINANCE_CHECK_LABEL: Record<string, string> = {
  amount: "ยอดเงินที่ขอคืนไม่ถูกต้อง / ไม่ตรงกับเอกสาร", bank: "บัญชีรับเงินคืน (ชื่อ / เลขบัญชี) ไม่ตรงกับ Book bank",
  customer: "ข้อมูลลูกค้า / เลขผู้เสียภาษีไม่ถูกต้อง", project: "เลข Project / SO / ใบเสร็จไม่ถูกต้อง", reason: "สาเหตุการคืนเงินไม่ชัดเจน",
};
export function RefundPill({ status }: { status: RefundStatus }) {
  const m = STATUS_META[status];
  return <span className={cn("text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", m.cls)}>{m.label}</span>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
      <span className="text-slate-500 shrink-0">{k}</span>
      <span className="text-slate-800 font-medium text-right min-w-0 break-words [overflow-wrap:anywhere]">{v || "-"}</span>
    </div>
  );
}
function Stepper({ status }: { status: RefundStatus }) {
  const at = stepIndex(status);
  const badEnd = status === "rejected" || status === "cancelled";
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => (
        <div key={s} className="flex-1 flex flex-col items-center relative">
          {i > 0 && <span className={cn("absolute top-3 right-1/2 w-full h-0.5", i <= at && !badEnd ? "bg-[#d32029]" : "bg-slate-200")} />}
          <span className={cn("relative z-10 w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold",
            badEnd && i === at ? "bg-red-600 text-white" : i < at ? "bg-[#d32029] text-white" : i === at ? "bg-white border-2 border-[#d32029] text-[#d32029]" : "bg-slate-200 text-slate-500")}>
            {i < at ? <Icon name="check" style={{ fontSize: 14 }} /> : i + 1}
          </span>
          <span className="text-[9.5px] text-slate-500 mt-1 text-center leading-tight">{s}</span>
        </div>
      ))}
    </div>
  );
}

function CheckRow({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("w-full text-left px-3 py-2 rounded-xl border text-[12px] flex items-center gap-2", on ? "border-rose-400 bg-rose-50 text-rose-900 font-semibold" : "border-slate-200 bg-white text-slate-600")}>
      <Icon name={on ? "check_box" : "check_box_outline_blank"} style={{ fontSize: 17 }} />{label}
    </button>
  );
}

function ActionPanel({ d, caps, role, onDone }: { d: RefundDetail; caps: RefundCaps; role: RefundRole; onDone: () => void }) {
  const [text, setText] = useState("");
  const [carrier, setCarrier] = useState(d.parcel_carrier ?? CARRIERS[0]);
  const [tracking, setTracking] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [finMode, setFinMode] = useState<"" | "return">("");
  const [finItems, setFinItems] = useState<string[]>([]);
  const [tDate, setTDate] = useState(() => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10));
  const [revised, setRevised] = useState<UploadedDoc[]>([]);
  const [upBusy, setUpBusy] = useState(false);
  const toggle = (k: string) => setFinItems((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const docKinds = [...new Set(d.files.filter((f) => f.kind in DOC_META).map((f) => f.kind as DocKind))];
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const run = async (body: Record<string, unknown>) => {
    setSaving(true);
    setErr("");
    try {
      await refundAction(d.id, body);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
      setSaving(false);
    }
  };
  const blocks: React.ReactNode[] = [];
  if (caps.approve) {
    blocks.push(
      <div key="ap" className="space-y-2">
        {d.round > 1 && d.finance_issue && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-[12px] text-rose-900">
            <p className="font-bold">รอบที่ {d.round}: ทีมขายแก้ตามที่ Finance แจ้งแล้ว</p>
            <p>Finance แจ้งว่า: {d.finance_issue.text}</p>
          </div>
        )}
        <p className="text-[11.5px] text-slate-600">ตรวจข้อมูลและเอกสารแนบ แล้วเลือกผลการพิจารณา</p>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="หมายเหตุ (บังคับเมื่อตีกลับ / ไม่อนุมัติ)" className={inputCls} />
        <button type="button" disabled={saving} onClick={() => run({ action: "approve", text })} className={cn(btn, "w-full bg-emerald-600 text-white")}>{d.round > 1 && d.finance ? "อนุมัติใหม่ (ส่งกลับให้ Finance ตรวจ)" : "อนุมัติ"}</button>
        <div className="flex gap-2">
          <button type="button" disabled={saving || !text.trim()} onClick={() => run({ action: "return", text })} className={cn(btn, "flex-1 bg-orange-50 text-orange-700 border border-orange-200")}>ตีกลับให้แก้</button>
          <button type="button" disabled={saving || !text.trim()} onClick={() => run({ action: "reject", text })} className={cn(btn, "flex-1 bg-red-50 text-red-700 border border-red-200")}>ไม่อนุมัติ</button>
        </div>
      </div>
    );
  }
  /* ---------- Finance ---------- */
  if (caps.claim) {
    blocks.push(
      <div key="claim" className="space-y-2">
        <p className="text-[12px] text-slate-600">อนุมัติแล้ว · Finance ทุกคนเห็นงานนี้ คนแรกที่กดรับจะได้งาน</p>
        <button type="button" disabled={saving} onClick={() => run({ action: "claim" })} className={cn(btn, "w-full bg-[#d32029] text-white")}>{saving ? "กำลังรับงาน..." : "รับงานนี้"}</button>
      </div>
    );
  }
  if (caps.financeAct && finMode === "return") {
    blocks.push(
      <div key="fret" className="space-y-2 rounded-xl border-2 border-rose-300 p-3">
        <p className="text-[12.5px] font-bold text-rose-900">แจ้งกลับให้ทีมขายแก้ไข</p>
        <p className="text-[11px] text-slate-500">เลือกรายการที่ผิด / ขาด — ทีมขายแก้แล้วต้องให้ผู้อนุมัติอนุมัติใหม่ แล้วงานจะกลับมาที่คุณ (ระหว่างรอไม่นับ SLA)</p>
        <p className="text-[10.5px] font-semibold text-slate-500 pt-1">เอกสารแนบ</p>
        {docKinds.map((k) => <CheckRow key={k} on={finItems.includes(k)} label={DOC_META[k].label} onClick={() => toggle(k)} />)}
        <p className="text-[10.5px] font-semibold text-slate-500 pt-1">ข้อมูลในฟอร์ม</p>
        {FINANCE_CHECKS.map((c) => <CheckRow key={c.key} on={finItems.includes(c.key)} label={c.label} onClick={() => toggle(c.key)} />)}
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="อธิบายสิ่งที่ต้องแก้ (บังคับ) เช่น สำเนา Book bank ยังไม่ได้เซ็นรับรอง" className={inputCls} />
        <div className="flex gap-2">
          <button type="button" onClick={() => setFinMode("")} className={cn(btn, "bg-white border border-slate-200 text-slate-600")}>กลับ</button>
          <button type="button" disabled={saving || !text.trim()} onClick={() => run({ action: "finance_return", items: finItems, text })} className={cn(btn, "flex-1 bg-rose-600 text-white")}>ส่งกลับให้ทีมขายแก้</button>
        </div>
      </div>
    );
  } else if (caps.financeAct) {
    blocks.push(
      <div key="fin" className="space-y-2">
        {d.round > 1 && d.finance_issue && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-[11.5px] text-emerald-900">รอบที่ {d.round}: ทีมขายแก้แล้ว และผู้อนุมัติอนุมัติใหม่แล้ว · ครั้งก่อนคุณแจ้งว่า “{d.finance_issue.text}”</p>}
        <p className="text-[11.5px] text-slate-600">ตรวจข้อมูลและเอกสารแนบ{d.docs_received_at ? " (บัญชีได้รับเอกสารตัวจริงแล้ว)" : ""}{d.due_at ? ` · กำหนด ${dateTh(d.due_at)}` : ""}</p>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="ความคิดเห็นถึงบัญชี (ไม่บังคับ)" className={inputCls} />
        <button type="button" disabled={saving} onClick={() => run({ action: "finance_pass", text })} className={cn(btn, "w-full bg-emerald-600 text-white")}>เอกสารครบ ผ่าน (ส่งต่อบัญชี)</button>
        <button type="button" onClick={() => { setFinMode("return"); setText(""); setFinItems([]); }} className={cn(btn, "w-full bg-rose-50 border border-rose-200 text-rose-700")}>ข้อมูล / เอกสารไม่ครบ · แจ้งกลับให้แก้</button>
        <button type="button" disabled={saving} onClick={() => run({ action: "release" })} className={cn(btn, "w-full bg-white border border-slate-200 text-slate-600")}>คืนงาน (ให้ Finance คนอื่นรับ)</button>
      </div>
    );
  }
  /* ---------- บัญชี ---------- */
  if (caps.receiveDocs) {
    blocks.push(
      <div key="rcv" className="space-y-2 rounded-xl border border-slate-200 p-3">
        <p className="text-[12px] font-bold text-slate-800">เอกสารตัวจริง · {d.parcel_carrier} {d.parcel_tracking}</p>
        <p className="text-[11px] text-slate-500">ส่งเมื่อ {dateTh(d.parcel_sent_at, true)}{d.customer_sends_direct ? " · ลูกค้าส่งตรง" : ""}</p>
        <button type="button" disabled={saving} onClick={() => run({ action: "docs_received" })} className={cn(btn, "w-full bg-slate-900 text-white")}>ได้รับเอกสารตัวจริงแล้ว</button>
      </div>
    );
  }
  if (role === "accounting" && d.status === "pending_transfer") {
    const ready = !!d.docs_received_at;
    blocks.push(
      <div key="tf" className="space-y-2 rounded-xl border border-slate-200 p-3">
        <p className="text-[12px] font-bold text-slate-800">โอนเงินคืนลูกค้า · {baht2(d.refund_amount)}</p>
        <p className="text-[11px] text-slate-600">{d.bank_name} {d.bank_account_no} · {d.bank_account_name}</p>
        {d.finance_note && <p className="text-[11px] text-indigo-800 bg-indigo-50 rounded-lg p-2">Finance: {d.finance_note}</p>}
        {!ready && <p className="text-[11px] text-amber-700">ยังไม่ได้รับเอกสารตัวจริง — โอนได้หลังกด &ldquo;ได้รับเอกสารตัวจริงแล้ว&rdquo;</p>}
        <label className="block text-[11px] font-semibold text-slate-600">วันที่โอนเงินคืน *</label>
        <input type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} className={inputCls} />
        {d.refund_type === "wht" && (
          <div className={cn("rounded-xl border p-3 space-y-1.5", revised.length ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200")}>
            <div className="flex items-center gap-2">
              <Icon name={revised.length ? "task" : "upload_file"} className={revised.length ? "text-emerald-600" : "text-slate-400"} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800">ใบเสร็จรับเงิน / ใบกำกับภาษีฉบับแก้ไข (ถ้ามี)</p>
                <p className="text-[10.5px] text-slate-500">ไม่บังคับ · พนักงานขายเปิดไฟล์ส่งให้ลูกค้าได้</p>
              </div>
              <label className={cn(btn, "px-3 py-1.5 text-[11px] bg-slate-900 text-white cursor-pointer", upBusy && "opacity-50")}>
                {upBusy ? "กำลังอัปโหลด..." : "แนบ"}
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={upBusy} onChange={async (e) => {
                  const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
                  setUpBusy(true); setErr("");
                  try { const up = await uploadRefundDoc(file, "revised_receipt", d.id); setRevised((a) => [...a, up]); } catch (x) { setErr(x instanceof Error ? x.message : "อัปโหลดไม่สำเร็จ"); }
                  setUpBusy(false);
                }} />
              </label>
            </div>
            {revised.map((f, i) => (
              <div key={f.path} className="flex items-center gap-2 text-[11.5px] text-emerald-800 pl-8">
                <Icon name="check_circle" style={{ fontSize: 16 }} /><span className="truncate flex-1">{f.name}</span>
                <button type="button" onClick={() => setRevised((a) => a.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600" aria-label="ลบ"><Icon name="close" style={{ fontSize: 16 }} /></button>
              </div>
            ))}
          </div>
        )}
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
        <button type="button" disabled={saving || upBusy || !ready || !tDate} onClick={() => run({ action: "transfer", transferDate: tDate, files: revised, text })} className={cn(btn, "w-full bg-emerald-600 text-white")}>บันทึกวันที่โอน (แจ้งพนักงานขาย · ผู้อนุมัติ · Finance)</button>
      </div>
    );
  }
  /* ---------- พนักงานขาย: แจ้งลูกค้า ---------- */
  if (caps.inform) {
    blocks.push(
      <div key="inf" className="space-y-2 rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-3">
        <p className="text-[12.5px] font-bold text-emerald-900">บัญชีโอนเงินคืนแล้ว วันที่ {dateTh(d.transfer_date)}</p>
        <p className="text-[11.5px] text-emerald-900">{baht2(d.refund_amount)} เข้าบัญชี {d.bank_name} {d.bank_account_no} · {d.bank_account_name}</p>
        {d.files.some((f) => f.kind === "revised_receipt") && <p className="text-[11px] text-emerald-900">มีใบเสร็จ / ใบกำกับภาษีฉบับแก้ไขจากบัญชี (ดูในเอกสารแนบ) ส่งให้ลูกค้าได้</p>}
        <button type="button" disabled={saving} onClick={() => run({ action: "inform" })} className={cn(btn, "w-full bg-[#d32029] text-white")}>แจ้งวันโอนให้ลูกค้าแล้ว (ปิดงาน)</button>
      </div>
    );
  }
  if (caps.edit) {
    const lastReturn = d.status === "returned" ? [...d.events].reverse().find((e) => e.kind === "return") : null;
    blocks.push(
      <div key="ed" className={cn("space-y-2 rounded-xl border-2 p-3", d.status === "finance_returned" ? "border-rose-300 bg-rose-50/60" : "border-orange-300 bg-orange-50/60")}>
        {d.status === "finance_returned" && d.finance_issue ? (
          <>
            <p className="text-[12.5px] font-bold text-rose-900">Finance แจ้งให้แก้ไข{d.finance ? ` · ${d.finance.name}` : ""}</p>
            {d.finance_issue.items.length > 0 && (
              <ul className="list-disc pl-5 text-[12px] text-rose-900">
                {d.finance_issue.items.map((k) => <li key={k}>{DOC_META[k as DocKind]?.label ?? FINANCE_CHECK_LABEL[k] ?? k}</li>)}
              </ul>
            )}
            <p className="text-[12px] text-rose-900 bg-white rounded-lg p-2">“{d.finance_issue.text}”</p>
            <p className="text-[11px] text-slate-600">แก้แล้วส่ง คำขอจะกลับไปให้ <b>{d.approver?.name ?? "ผู้อนุมัติ"}</b> อนุมัติใหม่ ก่อนกลับไปที่ Finance คนเดิม · ถ้าเอกสารตัวจริงผิด ให้ส่งฉบับใหม่ทางพัสดุและใส่เลขพัสดุใหม่</p>
          </>
        ) : (
          <>
            <p className="text-[12.5px] font-bold text-orange-900">ผู้อนุมัติตีกลับให้แก้</p>
            {lastReturn?.text && <p className="text-[12px] text-orange-900 bg-white rounded-lg p-2">{lastReturn.text}</p>}
          </>
        )}
        <Link href={`/app/refund/${d.id}/edit`} className={cn(btn, "w-full bg-[#d32029] text-white flex items-center justify-center gap-1.5")}><Icon name="edit" style={{ fontSize: 17 }} />แก้ไขคำขอ แล้วส่งอีกครั้ง</Link>
      </div>
    );
  }
  if (caps.parcel) {
    blocks.push(
      <div key="pc" className="space-y-2 rounded-xl border border-slate-200 p-3">
        <p className="text-[12px] font-bold text-slate-800">
          {d.parcel_tracking ? "ส่งเอกสารตัวจริงใหม่ / แก้เลขพัสดุ" : d.customer_sends_direct ? "ลูกค้าส่งเอกสารตรงให้บัญชี · ใส่เลขพัสดุของลูกค้า" : "ส่งเอกสารตัวจริงแล้ว ใส่เลขพัสดุ"}
        </p>
        {d.parcel_tracking && <p className="text-[11px] text-slate-500">เดิม: {d.parcel_carrier} {d.parcel_tracking}</p>}
        <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={cn(inputCls, "bg-white")}>{CARRIERS.map((c) => <option key={c}>{c}</option>)}</select>
        <input value={tracking} onChange={(e) => setTracking(e.target.value.toUpperCase())} placeholder="เลขพัสดุ" className={inputCls} />
        <button type="button" disabled={saving || tracking.trim().length < 4} onClick={() => run({ action: "parcel", carrier, tracking })} className={cn(btn, "w-full bg-slate-900 text-white")}>บันทึกเลขพัสดุ (แจ้งบัญชี)</button>
        <details className="text-[11px] text-slate-500"><summary className="cursor-pointer">ที่อยู่ส่งเอกสาร</summary>{DOC_ADDRESS.map((l) => <p key={l}>{l}</p>)}</details>
      </div>
    );
  }
  if (caps.cancel) {
    blocks.push(cancelOpen ? (
      <div key="cx" className="space-y-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="เหตุผลที่ยกเลิก (ถ้ามี)" className={inputCls} />
        <div className="flex gap-2">
          <button type="button" onClick={() => setCancelOpen(false)} className={cn(btn, "bg-white border border-slate-200 text-slate-600")}>กลับ</button>
          <button type="button" disabled={saving} onClick={() => run({ action: "cancel", text })} className={cn(btn, "flex-1 bg-slate-700 text-white")}>ยืนยันยกเลิกคำขอ</button>
        </div>
      </div>
    ) : <button key="cx" type="button" onClick={() => setCancelOpen(true)} className="text-[12px] text-slate-500 underline">ยกเลิกคำขอ</button>);
  }
  // สถานะที่รอคนอื่น
  if (!blocks.length) {
    const wait: Record<string, string> = {
      pending_approval: `รอ ${d.approver?.name ?? "ผู้อนุมัติ"} อนุมัติ`,
      returned: "รอทีมขายแก้ไข",
      finance_returned: `รอทีมขายแก้ไขตามที่ Finance แจ้ง แล้วผู้อนุมัติอนุมัติใหม่`,
      pending_finance: "อนุมัติแล้ว · รอ Finance รับงาน",
      finance_working: `${d.finance?.name ?? "Finance"} กำลังตรวจเอกสาร`,
      pending_transfer: "Finance ผ่านแล้ว · รอบัญชีโอนเงิน",
      transferred: "โอนเงินแล้ว · รอพนักงานขายแจ้งลูกค้า",
      closed: "ปิดงานแล้ว", rejected: "ไม่ได้รับอนุมัติ (ปิดคำขอ)", cancelled: "ยกเลิกแล้ว",
    };
    blocks.push(<p key="w" className="text-[12px] text-slate-600 bg-slate-50 rounded-xl p-3">{wait[d.status] ?? "-"}</p>);

  }
  return (
    <section className={cn(card, "p-4 space-y-2.5 border-[#d32029]/30")}>
      <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5"><Icon name="bolt" className="text-[#d32029]" style={{ fontSize: 18 }} />สิ่งที่ต้องทำ</p>
      {blocks}
      {err && <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{err}</p>}
    </section>
  );
}

export function RefundDetailScreen({ id }: { id: number }) {
  const { ready } = useSession();
  const [d, setD] = useState<{ role: RefundRole; caps: RefundCaps; item: RefundDetail } | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchRefund(id).then((x) => !cancelled && setD(x)).catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => { cancelled = true; };
  }, [ready, id, reload]);
  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const header = (title: string) => (
    <header className="flex items-center gap-2 py-3 lg:py-5">
      <Link href="/app/refund" className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="กลับ"><Icon name="arrow_back" style={{ fontSize: 18 }} /></Link>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-500 leading-tight">ขอคืนเงินลูกค้า กรณีลูกค้าจ่ายเงินตรง SCG</p>
        <h1 className="font-bold text-[16px] lg:text-[22px] text-[#231313] leading-tight truncate">{title}</h1>
      </div>
      {d && <Link href={`/app/refund/${id}/memo`} className="shrink-0 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-700"><Icon name="print" style={{ fontSize: 16 }} />บันทึกขออนุมัติ</Link>}
    </header>
  );
  if (!ready) return null;
  if (error) return <>{header("คำขอคืนเงิน")}<p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">{error === "forbidden" ? "คุณไม่มีสิทธิ์ดูคำขอนี้" : `โหลดไม่สำเร็จ: ${error}`}</p></>;
  if (!d) return <>{header("คำขอคืนเงิน")}<p className="text-center text-[12px] text-slate-400 py-8">กำลังโหลด...</p></>;
  const r = d.item;
  const rounds = [...new Set(r.files.map((f) => f.round))].sort((a, b) => b - a);
  return (
    <>
      {header(r.req_no)}
      <div className="flex flex-col gap-3 pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-4 lg:col-start-1 lg:min-w-0">
          <section className={cn(card, "p-4 space-y-3 order-1 lg:order-none")}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{groupLabel(r.job_group)}</span>
              <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-red-50 text-[#b0141c] font-semibold">{typeLabel(r.refund_type)}</span>
              {r.round > 1 && <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold">รอบที่ {r.round}</span>}
              {r.is_test && <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">ทดสอบ</span>}
              <span className="ml-auto"><RefundPill status={r.status} /></span>
            </div>
            <div>
              <p className="text-[17px] font-bold text-slate-900">{r.cust_name}</p>
              <p className="text-[11.5px] text-slate-500">ส่งโดย {r.requester.name} · {dateTh(r.created_at, true)}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 flex items-center justify-between">
              <span className="text-[12px] text-slate-600">ยอดขอคืน</span>
              <span className="text-[20px] font-bold text-[#d32029]">{baht2(r.refund_amount)}</span>
            </div>
            <Stepper status={r.status} />
            <div className="grid grid-cols-2 gap-2 text-[10.5px] font-semibold">
              <span className={cn("rounded px-2 py-1 flex items-center gap-1", r.parcel_tracking ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                <Icon name="local_shipping" style={{ fontSize: 14 }} />{r.parcel_tracking ? `${r.parcel_carrier} ${r.parcel_tracking}` : "ยังไม่ส่งเอกสารตัวจริง"}
              </span>
              <span className={cn("rounded px-2 py-1 flex items-center gap-1", r.docs_received_at ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                <Icon name="inventory" style={{ fontSize: 14 }} />{r.docs_received_at ? `บัญชีได้รับ ${dateTh(r.docs_received_at)}` : "บัญชียังไม่ได้รับ"}
              </span>
            </div>
          </section>

          <section className={cn(card, "p-4 order-3 lg:order-none")}>
            <p className="text-[13px] font-bold text-slate-800 mb-1">งาน</p>
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-10">
              <Row k="เลข Project" v={r.project_no} />
              {r.job_group === "roof" && <Row k="เลข SO" v={r.so_no} />}
              <Row k="ใบเสร็จ (CSD)" v={r.receipt_no} />
              <Row k="โครงการ / หน้างาน" v={r.project_name} />
              <Row k="ร้าน / สังกัด" v={r.dealer_name ?? r.requester_unit} />
              <Row k="ผู้ขอ" v={[r.requester.name, r.requester.phone].filter(Boolean).join(" · ")} />
            </div>
          </section>
          <section className={cn(card, "p-4 order-4 lg:order-none")}>
            <p className="text-[13px] font-bold text-slate-800 mb-1">ลูกค้าและยอดเงิน</p>
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-10">
              <Row k="ประเภทลูกค้า" v={r.cust_type === "company" ? "นิติบุคคล" : "บุคคลธรรมดา"} />
              <Row k={r.cust_type === "company" ? "เลขผู้เสียภาษี" : "เลขบัตรประชาชน"} v={`${fmtTaxId(r.cust_tax_id)}${r.cust_branch ? ` · ${r.cust_branch}` : ""}`} />
              <Row k="เบอร์ลูกค้า" v={r.cust_phone} />
              <Row k="ยอดที่ลูกค้าชำระ" v={baht2(r.paid_amount)} />
              {r.refund_type === "wht" && <Row k="ยอดก่อน VAT × อัตราภาษี" v={`${baht2(r.wht_base)} × ${r.wht_rate}%`} />}
              {r.refund_type === "partial" && <Row k="ส่วนที่ยกเลิก" v={r.cancel_detail} />}
              <Row k="สาเหตุ" v={r.reason} />
              <Row k="บัญชีรับเงินคืน" v={<>{r.bank_name} {r.bank_account_no}<br />{r.bank_account_name}</>} />
            </div>
          </section>
          <section className={cn(card, "p-4 space-y-2 order-5 lg:order-none")}>
            <p className="text-[13px] font-bold text-slate-800">เอกสารแนบ</p>
            {rounds.map((rd) => (
              <div key={rd} className="space-y-1.5">
                {rounds.length > 1 && <p className="text-[10.5px] font-semibold text-slate-500">รอบที่ {rd}{rd === r.round ? " (ล่าสุด)" : ""}</p>}
                <div className="grid gap-1.5 lg:grid-cols-2">
                  {r.files.filter((f) => f.round === rd).map((f) => (
                    <div key={f.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 min-w-0">
                      <a href={refundFileUrl(f.id)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0 flex-1">
                        <Icon name={f.mime === "application/pdf" ? "picture_as_pdf" : "image"} className="text-sky-700 shrink-0" style={{ fontSize: 20 }} />
                        <span className="min-w-0"><span className="block text-[11.5px] font-semibold text-slate-700 truncate">{f.kind in DOC_META ? DOC_META[f.kind as DocKind].label : f.kind === "revised_receipt" ? "ใบเสร็จ / ใบกำกับภาษีฉบับแก้ไข" : "เอกสาร"}</span><span className="block text-[10.5px] text-sky-800 truncate">{f.name}</span></span>
                      </a>
                      <a href={refundFileUrl(f.id, true)} className="text-slate-400 hover:text-slate-700 shrink-0" aria-label="ดาวน์โหลด"><Icon name="download" style={{ fontSize: 18 }} /></a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>

        <aside className="contents lg:flex lg:flex-col lg:gap-4 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-2">
          <div className="order-2 lg:order-none"><ActionPanel key={`${r.status}-${r.round}-${r.parcel_tracking}`} d={r} caps={d.caps} role={d.role} onDone={refresh} /></div>
          <section className={cn(card, "p-4 order-6 lg:order-none")}>
            <p className="text-[13px] font-bold text-slate-800 mb-1">ผู้รับผิดชอบ</p>
            <Row k="ผู้อนุมัติ" v={r.approver ? `${r.approver.name}${r.approved_at ? ` · ${dateTh(r.approved_at, true)}` : ""}` : "-"} />
            <Row k="Finance" v={r.finance?.name ?? "ยังไม่มีคนรับ"} />
            <Row k="วันที่โอนคืน" v={r.transfer_date ? dateTh(r.transfer_date) : "-"} />
          </section>
          <section className={cn(card, "p-4 order-7 lg:order-none")}>
            <p className="text-[13px] font-bold text-slate-800 mb-2">ประวัติ</p>
            <ol className="relative border-l-2 border-slate-200 ml-2 space-y-3">
              {[...r.events].reverse().map((e, i) => (
                <li key={i} className="pl-4 relative">
                  <span className={cn("absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white", e.tone === "warn" ? "bg-orange-500" : e.tone === "ok" ? "bg-emerald-500" : e.tone === "bad" ? "bg-slate-500" : "bg-[#d32029]")} />
                  <p className="text-[12px] text-slate-800 whitespace-pre-line">{e.text}</p>
                  <p className="text-[10px] text-slate-400">{e.actor_name ?? "-"} · {dateTh(e.at, true)}</p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}

