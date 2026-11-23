"use client";
/* ฟอร์มขอคืนเงินลูกค้า (พนักงานขาย) — สร้างใหม่ / แก้ไขหลังถูกตีกลับหรือ Finance แจ้งแก้
   ลำดับ: ผู้ขอ -> ประเภทการคืนเงิน -> งาน -> ลูกค้า -> ยอดเงิน -> บัญชีรับเงินคืน -> เอกสาร -> ผู้อนุมัติ */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { formatThaiPhone } from "@/lib/th-provinces";
import {
  BANKS, CUST_TYPES, DOC_ADDRESS, DOC_META, JOB_GROUPS, REFUND_TYPES, WHT_RATE,
  createRefund, docHint, fetchRefund, fetchRefundOptions, fmt2, fmtTaxId, num, refundAction, refundFileUrl, requiredDocs, uploadRefundDoc, baht2,
  type CustType, type DocKind, type JobGroup, type RefundDetail, type RefundOptions, type RefundType, type UploadedDoc,
} from "@/lib/commission/refund-store";
import { Chips, Section, badCls, btn, inputCls, labelCls } from "../boq/boq-shared";

/** ช่องเงิน: ตัวคั่นหลักพันระหว่างพิมพ์ ทศนิยมไม่เกิน 2 ; ออกจากช่องแล้วจัดเป็น 0.00 */
function MoneyInput({ value, onChange, placeholder = "0.00", invalid }: { value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean }) {
  const typing = (raw: string) => {
    const clean = raw.replace(/[^\d.]/g, "");
    const [int = "", ...rest] = clean.split(".");
    const dec = rest.join("").slice(0, 2);
    const intFmt = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    onChange(clean.includes(".") ? `${intFmt || "0"}.${dec}` : intFmt);
  };
  return (
    <input inputMode="decimal" value={value} placeholder={placeholder} className={cn(inputCls, "text-right tabular-nums", invalid && badCls)}
      onChange={(e) => typing(e.target.value)} onBlur={() => { if (value) onChange(fmt2(num(value))); }} />
  );
}

type Slot = { uploaded: UploadedDoc[]; busy: boolean; err: string };
function DocSlot({ kind, type, slot, existing, invalid, onPick, onRemove }: {
  kind: DocKind; type: RefundType | ""; slot: Slot; existing: { id: number; name: string; round: number }[]; invalid: boolean;
  onPick: (files: FileList) => void; onRemove: (i: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const has = slot.uploaded.length > 0 || existing.length > 0;
  return (
    <div className={cn("rounded-xl border p-3 space-y-2", invalid ? "border-red-400 ring-2 ring-red-100" : has ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200")}>
      <div className="flex items-center gap-3">
        <Icon name={has ? "task" : "upload_file"} className={has ? "text-emerald-600" : "text-slate-400"} />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-slate-800">{DOC_META[kind].label}</p>
          <p className="text-[10.5px] text-slate-500">{docHint(kind, type)}</p>
        </div>
        <button type="button" disabled={slot.busy} onClick={() => ref.current?.click()} className={cn(btn, "px-3 py-1.5 text-[11px] shrink-0", has ? "bg-white border border-slate-200 text-slate-600" : "bg-slate-900 text-white")}>
          {slot.busy ? "กำลังอัปโหลด..." : has ? "แนบเพิ่ม" : "แนบ"}
        </button>
        <input ref={ref} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onPick(e.target.files); e.target.value = ""; }} />
      </div>
      {existing.map((f) => (
        <a key={f.id} href={refundFileUrl(f.id)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[11.5px] text-sky-800 pl-8">
          <Icon name="description" style={{ fontSize: 16 }} /><span className="truncate">{f.name}</span><span className="text-slate-400 shrink-0">(รอบ {f.round})</span>
        </a>
      ))}
      {slot.uploaded.map((f, i) => (
        <div key={f.path} className="flex items-center gap-2 text-[11.5px] text-emerald-800 pl-8">
          <Icon name="check_circle" style={{ fontSize: 16 }} /><span className="truncate flex-1">{f.name}</span>
          <button type="button" onClick={() => onRemove(i)} className="text-slate-400 hover:text-red-600" aria-label="ลบ"><Icon name="close" style={{ fontSize: 16 }} /></button>
        </div>
      ))}
      {slot.err && <p className="text-[11px] text-red-600 pl-8">{slot.err}</p>}
    </div>
  );
}

export function RefundFormScreen({ editId }: { editId?: number }) {
  const router = useRouter();
  const [opt, setOpt] = useState<RefundOptions | null>(null);
  const [orig, setOrig] = useState<RefundDetail | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [type, setType] = useState<RefundType | "">("");
  const [group, setGroup] = useState<JobGroup | "">("");
  const [custType, setCustType] = useState<CustType | "">("");
  const [f, setF] = useState({ projectNo: "", soNo: "", receiptNo: "", projectName: "", custName: "", taxId: "", branch: "สำนักงานใหญ่", custPhone: "", paid: "", whtBase: "", refund: "", cancelDetail: "", reason: "", bank: "", accNo: "", accName: "", note: "" });
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));
  const [slots, setSlots] = useState<Partial<Record<DocKind, Slot>>>({});
  const [direct, setDirect] = useState(false);
  const [approverId, setApproverId] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchRefundOptions().then((o) => !cancelled && setOpt(o)).catch((e) => !cancelled && setLoadErr(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    if (editId) {
      fetchRefund(editId)
        .then(({ item: r }) => {
          if (cancelled) return;
          setOrig(r);
          setType(r.refund_type); setGroup(r.job_group); setCustType(r.cust_type); setDirect(r.customer_sends_direct);
          setF({
            projectNo: r.project_no, soNo: r.so_no ?? "", receiptNo: r.receipt_no ?? "", projectName: r.project_name ?? "", custName: r.cust_name, taxId: r.cust_tax_id,
            branch: r.cust_branch ?? "สำนักงานใหญ่", custPhone: r.cust_phone ?? "", paid: fmt2(Number(r.paid_amount)), whtBase: r.wht_base != null ? fmt2(Number(r.wht_base)) : "",
            refund: fmt2(Number(r.refund_amount)), cancelDetail: r.cancel_detail ?? "", reason: r.reason ?? "", bank: r.bank_name, accNo: r.bank_account_no, accName: r.bank_account_name, note: "",
          });
        })
        .catch((e) => !cancelled && setLoadErr(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    }
    return () => { cancelled = true; };
  }, [editId]);

  const effCust: CustType | "" = type === "wht" ? "company" : custType;
  const needDocs = type && effCust ? requiredDocs(type, effCust) : [];
  const whtBase = f.whtBase ? num(f.whtBase) : num(f.paid) / 1.07;
  const refund = type === "wht" ? Math.round(whtBase * WHT_RATE) / 100 : type === "full" ? num(f.paid) : num(f.refund);
  const existingOf = (k: DocKind) => (orig?.files ?? []).filter((x) => x.kind === k).map((x) => ({ id: x.id, name: x.name, round: x.round }));
  const hasDoc = (k: DocKind) => (slots[k]?.uploaded.length ?? 0) > 0 || existingOf(k).length > 0;
  const busy = Object.values(slots).some((s) => s?.busy);
  const autoApprover = group ? opt?.approvers[group] ?? null : null;
  const approverName = orig && group === orig.job_group ? orig.approver?.name : autoApprover?.name ?? opt?.areas.find((a) => a.id === approverId)?.name;
  const needPick = !orig && group === "roof" && !autoApprover;

  const bad = {
    type: !type, group: !group, custType: !effCust,
    projectNo: !/^(E?RD|BA)[A-Z0-9-]{4,}$/i.test(f.projectNo.trim()), soNo: group === "roof" && !f.soNo.trim(),
    custName: !f.custName.trim(), taxId: f.taxId.replace(/\D/g, "").length !== 13,
    paid: !(num(f.paid) > 0), refund: !(refund > 0) || refund > num(f.paid),
    cancelDetail: type === "partial" && !f.cancelDetail.trim(), reason: type !== "wht" && !f.reason.trim(),
    bank: !f.bank || f.accNo.replace(/\D/g, "").length < 6 || !f.accName.trim(),
    docs: needDocs.some((k) => !hasDoc(k)),
    approver: needPick && !approverId,
  };
  const show = (b: boolean) => tried && b;
  const missing = [
    bad.type && "ประเภทการคืนเงิน", bad.group && "กลุ่มงาน", bad.projectNo && "เลข Project (RD… / BA…)", bad.soNo && "เลข SO",
    bad.custType && "ประเภทลูกค้า", bad.custName && "ชื่อลูกค้า", bad.taxId && "เลข 13 หลัก", bad.paid && "ยอดที่ลูกค้าชำระ",
    bad.refund && (refund > num(f.paid) ? "ยอดขอคืนเกินยอดที่ชำระ" : "ยอดขอคืน"), bad.cancelDetail && "ส่วนที่ยกเลิก", bad.reason && "สาเหตุการคืนเงิน",
    bad.bank && "บัญชีรับเงินคืน", bad.docs && `เอกสาร ${needDocs.filter((k) => !hasDoc(k)).length} รายการ`, bad.approver && "ผู้อนุมัติ",
  ].filter(Boolean) as string[];

  const pick = async (kind: DocKind, list: FileList) => {
    setSlots((s) => ({ ...s, [kind]: { uploaded: s[kind]?.uploaded ?? [], busy: true, err: "" } }));
    const done: UploadedDoc[] = [];
    let err = "";
    for (const file of Array.from(list).slice(0, 5)) {
      try { done.push(await uploadRefundDoc(file, kind, editId)); } catch (e) { err = e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ"; }
    }
    setSlots((s) => ({ ...s, [kind]: { uploaded: [...(s[kind]?.uploaded ?? []), ...done], busy: false, err } }));
  };
  const remove = (kind: DocKind, i: number) => setSlots((s) => ({ ...s, [kind]: { ...(s[kind] as Slot), uploaded: (s[kind]?.uploaded ?? []).filter((_, j) => j !== i) } }));

  const submit = async () => {
    setTried(true);
    setSaveErr("");
    if (missing.length) {
      setTimeout(() => document.querySelector("[data-invalid]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }
    if (busy) return;
    setSaving(true);
    const data = {
      refundType: type, jobGroup: group, projectNo: f.projectNo, soNo: f.soNo, receiptNo: f.receiptNo, projectName: f.projectName,
      custType: effCust, custName: f.custName, custTaxId: f.taxId, custBranch: f.branch, custPhone: f.custPhone,
      paidAmount: num(f.paid), whtBase: type === "wht" && f.whtBase ? num(f.whtBase) : null, refundAmount: refund, cancelDetail: f.cancelDetail, reason: f.reason,
      bankName: f.bank, bankAccountNo: f.accNo, bankAccountName: f.accName, customerSendsDirect: direct, approverId: approverId || undefined,
    };
    const files = needDocs.flatMap((k) => slots[k]?.uploaded ?? []);
    try {
      if (editId) {
        await refundAction(editId, { action: "resubmit", data, files, text: f.note });
        router.replace(`/app/refund/${editId}`);
      } else {
        const r = await createRefund({ ...data, files });
        router.replace(`/app/refund/${r.id}`);
      }
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  };

  const day = new Date().getDate();
  const back = editId ? `/app/refund/${editId}` : "/app/refund";
  return (
    <div className="w-full lg:max-w-3xl lg:mx-auto">
      <header className="flex items-center gap-2 py-3 lg:py-5">
        <Link href={back} className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="กลับ"><Icon name="arrow_back" style={{ fontSize: 18 }} /></Link>
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 leading-tight">ขอคืนเงินลูกค้า กรณีลูกค้าจ่ายเงินตรง SCG</p>
          <h1 className="font-bold text-[16px] lg:text-[22px] text-[#231313] leading-tight truncate">{editId ? `แก้ไขคำขอ ${orig?.req_no ?? ""}` : "สร้างคำขอคืนเงิน"}</h1>
        </div>
      </header>
      <div className="space-y-3 pb-6">
        {loadErr && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">โหลดไม่สำเร็จ: {loadErr}</p>}
        {opt && !opt.enabled && <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-800">ระบบขอคืนเงินยังไม่เปิดใช้งาน</p>}
        {orig?.status === "finance_returned" && orig.finance_issue && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-[12px] text-rose-900">
            <p className="font-bold">Finance แจ้งให้แก้ไข</p><p>{orig.finance_issue.text}</p>
            <p className="text-[11px] text-slate-600 mt-1">แก้แล้วส่ง คำขอจะกลับไปให้ผู้อนุมัติอนุมัติใหม่ ก่อนกลับไปที่ Finance คนเดิม</p>
          </div>
        )}

        <Section no="1" title="ผู้ขอคืนเงิน" hint="ระบบดึงจากบัญชีที่เข้าระบบ">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[12.5px] space-y-0.5">
            <p className="font-semibold text-slate-800">{opt?.requester.name ?? "…"}</p>
            <p className="text-slate-500">{[opt?.requester.email, opt?.requester.phone].filter(Boolean).join(" · ") || "-"}</p>
            <p className="text-slate-500">{opt?.requester.unit ?? "-"}</p>
          </div>
        </Section>

        <Section no="2" title="ประเภทการคืนเงิน *" invalid={show(bad.type)} invalidText="กรุณาเลือกประเภทการคืนเงิน">
          <div className="grid gap-2 lg:grid-cols-3">
            {REFUND_TYPES.map((t) => (
              <button key={t.key} type="button" onClick={() => setType(t.key)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", type === t.key ? "border-[#d32029] bg-red-50" : "border-slate-200 bg-white")}>
                <span className={cn("w-9 h-9 rounded-xl grid place-items-center shrink-0", type === t.key ? "bg-[#d32029] text-white" : "bg-slate-100 text-slate-500")}><Icon name={t.icon} style={{ fontSize: 20 }} /></span>
                <span><span className="block text-[13px] font-bold text-slate-800">{t.label}</span><span className="block text-[11px] text-slate-500">{t.desc}</span></span>
              </button>
            ))}
          </div>
        </Section>

        <Section no="3" title="งานที่ขอคืนเงิน" invalid={show(bad.group || bad.projectNo || bad.soNo)} invalidText={bad.group ? "กรุณาเลือกกลุ่มงาน" : "กรุณากรอกเลข Project / SO ให้ถูกต้อง"}>
          <div><label className={labelCls}>กลุ่มงาน *</label><Chips options={JOB_GROUPS} value={group} onChange={(v) => setGroup(v as JobGroup)} /></div>
          {group && (
            <div className={cn("grid gap-2", group === "roof" ? "grid-cols-2" : "grid-cols-1")}>
              <div><label className={labelCls}>เลข Project *</label><input value={f.projectNo} onChange={(e) => set("projectNo", e.target.value.toUpperCase())} placeholder="RD2569… / BA…" className={cn(inputCls, show(bad.projectNo) && badCls)} /></div>
              {group === "roof" && <div><label className={labelCls}>เลข SO *</label><input value={f.soNo} onChange={(e) => set("soNo", e.target.value.toUpperCase())} placeholder="RD2569…003" className={cn(inputCls, show(bad.soNo) && badCls)} /></div>}
            </div>
          )}
          <div className="grid gap-2 lg:grid-cols-2">
            <div><label className={labelCls}>เลขใบเสร็จรับเงิน (CSD)</label><input value={f.receiptNo} onChange={(e) => set("receiptNo", e.target.value.toUpperCase())} placeholder="CSD-LH-BPM-…" className={inputCls} /></div>
            <div><label className={labelCls}>ชื่อโครงการ / หน้างาน</label><input value={f.projectName} onChange={(e) => set("projectName", e.target.value)} maxLength={200} className={inputCls} /></div>
          </div>
        </Section>

        {type && (
          <Section no="4" title="ข้อมูลลูกค้า" hint={type === "wht" ? "คืนภาษีหัก ณ ที่จ่าย ใช้กับลูกค้านิติบุคคลเท่านั้น" : undefined} invalid={show(bad.custType || bad.custName || bad.taxId)} invalidText="กรุณากรอกข้อมูลลูกค้าให้ครบ">
            {type !== "wht" && <div><label className={labelCls}>ประเภทลูกค้า *</label><Chips options={CUST_TYPES} value={custType} onChange={(v) => setCustType(v as CustType)} /></div>}
            {effCust && (
              <>
                <div><label className={labelCls}>{effCust === "company" ? "ชื่อบริษัท / ห้างหุ้นส่วน *" : "ชื่อ-นามสกุล *"}</label><input value={f.custName} onChange={(e) => set("custName", e.target.value)} maxLength={200} className={cn(inputCls, show(bad.custName) && badCls)} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelCls}>{effCust === "company" ? "เลขผู้เสียภาษี *" : "เลขบัตรประชาชน *"}</label>
                    <input inputMode="numeric" maxLength={17} value={fmtTaxId(f.taxId)} onChange={(e) => set("taxId", e.target.value.replace(/\D/g, "").slice(0, 13))} placeholder="X-XXXX-XXXXX-XX-X" className={cn(inputCls, "tabular-nums tracking-wide", show(bad.taxId) && badCls)} /></div>
                  {effCust === "company"
                    ? <div><label className={labelCls}>สาขา</label><input value={f.branch} onChange={(e) => set("branch", e.target.value)} maxLength={80} className={inputCls} /></div>
                    : <div><label className={labelCls}>เบอร์โทร</label><input inputMode="tel" value={f.custPhone} onChange={(e) => set("custPhone", formatThaiPhone(e.target.value))} placeholder="08X-XXX-XXXX" className={inputCls} /></div>}
                </div>
                {effCust === "company" && <div><label className={labelCls}>เบอร์โทร</label><input inputMode="tel" value={f.custPhone} onChange={(e) => set("custPhone", formatThaiPhone(e.target.value))} placeholder="08X-XXX-XXXX" className={inputCls} /></div>}
              </>
            )}
          </Section>
        )}

        {type && effCust && (
          <Section no="5" title="ยอดเงิน" invalid={show(bad.paid || bad.refund || bad.cancelDetail || bad.reason)} invalidText="กรุณากรอกยอดเงินและสาเหตุให้ครบ">
            <div><label className={labelCls}>ยอดที่ลูกค้าชำระ (รวม VAT) *</label><MoneyInput value={f.paid} onChange={(v) => set("paid", v)} invalid={show(bad.paid)} /></div>
            {type === "wht" && (
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <div><label className={labelCls}>ยอดเงินที่ลูกค้าชำระเงินมาแล้ว (บาทก่อน VAT)</label><MoneyInput value={f.whtBase} onChange={(v) => set("whtBase", v)} placeholder={f.paid ? fmt2(num(f.paid) / 1.07) : "คำนวณจากยอดชำระ ÷ 1.07"} /></div>
                <div><label className={labelCls}>อัตราภาษี</label><span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-bold text-slate-700">{WHT_RATE}%</span></div>
              </div>
            )}
            {type === "partial" && (
              <>
                <div><label className={labelCls}>รายการ / ส่วนที่ยกเลิก *</label><input value={f.cancelDetail} onChange={(e) => set("cancelDetail", e.target.value)} maxLength={500} placeholder="เช่น ยกเลิก 1 จาก 4 จุด" className={cn(inputCls, show(bad.cancelDetail) && badCls)} /></div>
                <div><label className={labelCls}>ยอดขอคืน *</label><MoneyInput value={f.refund} onChange={(v) => set("refund", v)} invalid={show(bad.refund)} /></div>
              </>
            )}
            <div className={cn("rounded-xl border p-3 flex items-center justify-between", show(bad.refund) ? "bg-red-50 border-red-300" : "bg-red-50 border-red-100")}>
              <span className="text-[12px] font-semibold text-slate-700">ยอดขอคืน{type === "wht" ? ` (${WHT_RATE}% ของยอดก่อน VAT)` : type === "full" ? " (เต็มจำนวน)" : ""}</span>
              <span className="text-[18px] font-bold text-[#d32029]">{baht2(refund)}</span>
            </div>
            <div>
              <label className={labelCls}>สาเหตุการคืนเงิน {type !== "wht" && "*"}</label>
              <textarea rows={2} value={f.reason} onChange={(e) => set("reason", e.target.value)} maxLength={1000} placeholder={type === "wht" ? "ลูกค้าชำระเต็มจำนวน แล้วหักภาษี ณ ที่จ่ายภายหลัง" : "เช่น ลูกค้าเปลี่ยนแผน ยังไม่เริ่มงาน"} className={cn(inputCls, show(bad.reason) && badCls)} />
            </div>
          </Section>
        )}

        {type && effCust && (
          <Section no="6" title="บัญชีรับเงินคืน" hint="ชื่อบัญชีต้องตรงกับชื่อลูกค้า / ชื่อในหนังสือรับรองหัก ณ ที่จ่าย" invalid={show(bad.bank)} invalidText="กรุณากรอกบัญชีรับเงินคืนให้ครบ">
            <div><label className={labelCls}>ธนาคาร *</label>
              <select value={f.bank} onChange={(e) => set("bank", e.target.value)} className={cn(inputCls, "bg-white", show(bad.bank) && !f.bank && badCls)}><option value="">— เลือกธนาคาร —</option>{BANKS.map((b) => <option key={b}>{b}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>เลขบัญชี *</label><input inputMode="numeric" value={f.accNo} onChange={(e) => set("accNo", e.target.value.replace(/\D/g, "").slice(0, 20))} className={cn(inputCls, "tabular-nums", show(bad.bank) && f.accNo.length < 6 && badCls)} /></div>
              <div><label className={labelCls}>ชื่อบัญชี *</label><input value={f.accName} onChange={(e) => set("accName", e.target.value)} maxLength={200} className={cn(inputCls, show(bad.bank) && !f.accName.trim() && badCls)} /></div>
            </div>
            {f.accName && f.custName && f.accName.replace(/\s/g, "") !== f.custName.replace(/\s/g, "") && <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2">⚠ ชื่อบัญชีไม่ตรงกับชื่อลูกค้า บัญชีอาจโอนคืนไม่ได้</p>}
            <p className="text-[10.5px] text-slate-400"><Icon name="lock" className="align-[-3px]" style={{ fontSize: 13 }} /> เลขบัญชีเห็นเฉพาะผู้ขอ ผู้อนุมัติ Finance บัญชี และผู้ดูแลระบบ</p>
          </Section>
        )}

        {needDocs.length > 0 && (
          <Section no="7" title="เอกสารแนบ" hint={`${needDocs.filter(hasDoc).length}/${needDocs.length} รายการ · รูปภาพหรือ PDF ไม่เกิน 10MB · ต้องส่งตัวจริงทางพัสดุทุกกรณี`} invalid={show(bad.docs)} invalidText="กรุณาแนบเอกสารให้ครบ">
            {needDocs.map((k) => (
              <DocSlot key={k} kind={k} type={type} slot={slots[k] ?? { uploaded: [], busy: false, err: "" }} existing={existingOf(k)} invalid={show(!hasDoc(k))} onPick={(l) => pick(k, l)} onRemove={(i) => remove(k, i)} />
            ))}
            <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
              <p className="font-semibold text-slate-700 mb-0.5">บันทึกขออนุมัติคืนเงิน</p>
              คำขอนี้ใช้แทนบันทึกขออนุมัติ (ระบุ Project, SO, ยอดคืน และสาเหตุ) — หลังอนุมัติพิมพ์ / บันทึก PDF แนบไปกับพัสดุได้
            </div>
            {type === "wht" && (
              <label className="flex items-start gap-2 text-[12px] text-slate-700">
                <input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} className="mt-0.5 accent-[#d32029]" />
                ลูกค้าส่งเอกสารตัวจริงตรงให้บัญชีเอง (ใส่เลขพัสดุของลูกค้าในหน้ารายละเอียด)
              </label>
            )}
          </Section>
        )}

        {group && (
          <Section no="8" title="ผู้อนุมัติ" invalid={show(bad.approver)} invalidText="กรุณาเลือกผู้อนุมัติ">
            {needPick ? (
              <div>
                <label className={labelCls}>เลือก Area ผู้อนุมัติ *</label>
                <select value={approverId} onChange={(e) => setApproverId(e.target.value)} className={cn(inputCls, "bg-white", show(bad.approver) && badCls)}>
                  <option value="">— เลือก Area —</option>
                  {(opt?.areas ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <p className="text-[10.5px] text-slate-400 mt-1">ระบบหา Area ของร้านไม่พบ กรุณาเลือกผู้อนุมัติเอง</p>
              </div>
            ) : approverName ? (
              <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center text-slate-500"><Icon name="verified_user" /></span>
                <div><p className="text-[13px] font-bold text-slate-800">{approverName}</p><p className="text-[10.5px] text-slate-500">{group === "roof" ? "Area ที่ดูแลร้านของคุณ" : group === "metal" ? "ผู้อนุมัติงาน Metal Roof" : "Head of Smart Solutions Business"}</p></div>
              </div>
            ) : <p className="text-[12px] text-amber-700">ยังไม่ได้ตั้งผู้อนุมัติของกลุ่มงานนี้ ติดต่อผู้ดูแลระบบ</p>}
          </Section>
        )}

        {type && (
          <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 space-y-1.5">
            <p className="text-[12.5px] font-bold text-slate-800"><Icon name="local_shipping" className="align-[-5px] text-[#d32029]" /> ที่อยู่ส่งเอกสารตัวจริง</p>
            {DOC_ADDRESS.map((l) => <p key={l} className="text-[11.5px] text-slate-600">{l}</p>)}
            <p className="text-[11px] text-slate-500">ใส่เลขพัสดุได้หลังส่งคำขอ (หน้ารายละเอียด)</p>
            <p className={cn("text-[11px] rounded-lg p-2", day > 25 ? "text-amber-800 bg-amber-50" : "text-slate-500 bg-slate-50")}>
              {day > 25 ? "⚠ วันนี้เลยวันที่ 25 แล้ว เอกสารที่ถึงบัญชีหลังวันที่ 25 อาจแก้ใบเสร็จในเดือนนี้ไม่ได้" : "เอกสารควรถึงบัญชีก่อนวันที่ 25 ของเดือน หลังจากนั้นจะแก้ใบเสร็จในเดือนนั้นไม่ได้"}
            </p>
          </section>
        )}

        {editId && (
          <div><label className={labelCls}>หมายเหตุถึงผู้อนุมัติ (ถ้ามี)</label><textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={1000} placeholder="เช่น แนบ Book bank ที่เซ็นรับรองแล้ว" className={inputCls} /></div>
        )}
        {tried && missing.length > 0 && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">ยังขาด: {missing.join(", ")}</div>}
        {saveErr && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">{saveErr}</div>}
        <div className="flex gap-2">
          <Link href={back} className={cn(btn, "bg-white border border-slate-200 text-slate-600")}>ยกเลิก</Link>
          <button type="button" onClick={submit} disabled={saving || busy} className={cn(btn, "flex-1 bg-[#d32029] text-white")}>
            {saving ? "กำลังส่ง..." : busy ? "รออัปโหลดไฟล์..." : editId ? "ส่งให้ผู้อนุมัติอีกครั้ง" : "ส่งขออนุมัติ"}
          </button>
        </div>
      </div>
    </div>
  );
}
