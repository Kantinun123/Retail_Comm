"use client";
/* รายละเอียดคำขอ BOQ DECAAR + ปุ่มตามบทบาท/สถานะ (server ตรวจสิทธิ์ซ้ำทุกครั้ง) */
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import {
  DESIGNER_PHASE, baht, boqAction, dateTh, fetchBoq, fileUrl, needLabel, pointText, slaBadge,
  type BoqCaps, type BoqDetail, type BoqFile, type BoqRole, type LossReason, type UploadedFile,
} from "@/lib/commission/boq-store";
import { BoqHeader, FileUploader, Row, StatusPill, Stepper, btn, card, inputCls, labelCls } from "./boq-shared";

type Loaded = { role: BoqRole; caps: BoqCaps; lossReasons: LossReason[]; item: BoqDetail };

function FileLink({ f }: { f: BoqFile }) {
  const icon = f.mime === "application/pdf" ? "picture_as_pdf" : f.mime?.startsWith("image/") ? "image" : f.kind === "d3" ? "view_in_ar" : "description";
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 hover:border-sky-300 min-w-0">
      <a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0 flex-1">
        <Icon name={icon} className="text-sky-700 shrink-0" style={{ fontSize: 20 }} />
        <span className="text-[12px] text-sky-800 truncate">{f.name}</span>
      </a>
      <a href={fileUrl(f.id, true)} className="text-slate-400 hover:text-slate-700 shrink-0" aria-label="ดาวน์โหลด">
        <Icon name="download" style={{ fontSize: 18 }} />
      </a>
    </div>
  );
}

const money = (v: string) => {
  const n = v.replace(/[^\d]/g, "");
  return n ? Number(n).toLocaleString("th-TH") : "";
};
const toNum = (v: string) => Number(v.replace(/,/g, "")) || 0;

function ActionPanel({ d, onDone }: { d: Loaded; onDone: () => void }) {
  const { item: j, caps, lossReasons, role } = d;
  const [mode, setMode] = useState<"" | "revise" | "ok" | "win" | "loss" | "requote" | "release" | "cancel">("");
  const [text, setText] = useState("");
  const [boqFiles, setBoqFiles] = useState<UploadedFile[]>([]);
  const [d3Files, setD3Files] = useState<UploadedFile[]>([]);
  const [busy, setBusy] = useState(0);
  const [quoteNo, setQuoteNo] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [ver, setVer] = useState(j.versions.at(-1)?.v ?? 1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const need3d = j.need === "boq_3d";
  const onBusy = (b: boolean) => setBusy((n) => Math.max(0, n + (b ? 1 : -1)));

  const run = async (body: Record<string, unknown>) => {
    setSaving(true);
    setErr("");
    try {
      await boqAction(j.id, body);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
      setSaving(false);
    }
  };
  const box = (title: string, children: React.ReactNode, tone = "border-[#d32029]") => (
    <section className={cn("rounded-2xl bg-white border-2 p-4 space-y-3 shadow-sm", tone)}>
      <h3 className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
        <Icon name="bolt" className="text-[#d32029]" style={{ fontSize: 18 }} />
        {title}
      </h3>
      {children}
      {err && <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{err}</p>}
    </section>
  );
  const back = <button type="button" onClick={() => { setMode(""); setErr(""); }} className={cn(btn, "bg-white border border-slate-200 text-slate-600")}>กลับ</button>;

  /* ---------- ห้องแบบ ---------- */
  if (caps.claim) {
    return box("งานใหม่ รอรับ", <>
      <p className="text-[12px] text-slate-600">ห้องแบบทุกคนเห็นงานนี้ คนแรกที่กดรับจะได้งาน</p>
      <button type="button" disabled={saving} onClick={() => run({ action: "claim" })} className={cn(btn, "w-full bg-[#d32029] text-white")}>
        {saving ? "กำลังรับงาน..." : "รับงานนี้"}
      </button>
    </>);
  }
  if (caps.submit) {
    const lastRevise = [...j.events].reverse().find((e) => e.kind === "revise");
    if (mode === "release") {
      return box("ปล่อยงานคืน", <>
        <p className="text-[12px] text-slate-600">งานจะกลับไปเป็น &quot;รอรับงาน&quot; ให้ห้องแบบคนอื่นรับต่อ</p>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="เหตุผล (ถ้ามี) เช่น ลาพักร้อน" className={inputCls} />
        <div className="flex gap-2">{back}<button type="button" disabled={saving} onClick={() => run({ action: "release", text })} className={cn(btn, "flex-1 bg-orange-600 text-white")}>ยืนยันปล่อยงาน</button></div>
      </>, "border-orange-300");
    }
    return box(j.status === "revise" ? `แก้ไข BOQ (รอบที่ ${j.versions.length + 1})` : "อัปโหลด BOQ", <>
      {j.status === "revise" && lastRevise && <div className="rounded-xl bg-orange-50 border border-orange-200 p-2.5 text-[12px] text-orange-800">{lastRevise.text}</div>}
      <div>
        <label className={labelCls}>ไฟล์ BOQ</label>
        <FileUploader kind="boq" requestId={j.id} label="แนบไฟล์ BOQ" hint="Excel / PDF" accept=".xlsx,.xls,.pdf,application/pdf" files={boqFiles} onChange={setBoqFiles} onBusy={onBusy} />
      </div>
      {need3d && (
        <div>
          <label className={labelCls}>ไฟล์แบบ 3D <span className="font-normal text-slate-400">(ลูกค้าขอ BOQ และ แบบ 3D — ต้องแนบ)</span></label>
          <FileUploader kind="d3" requestId={j.id} label="แนบไฟล์แบบ 3D" hint="รูป / PDF / ZIP / SketchUp · หลายไฟล์ได้" accept="image/*,application/pdf,.zip,.skp" files={d3Files} onChange={setD3Files} onBusy={onBusy} />
        </div>
      )}
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="หมายเหตุถึงพนักงานขาย (ถ้ามี)" className={inputCls} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("release")} className={cn(btn, "bg-white border border-slate-200 text-slate-600")}>ปล่อยงาน</button>
        <button
          type="button"
          disabled={saving || busy > 0 || !boqFiles.length || (need3d && !d3Files.length)}
          onClick={() => run({ action: "submit", text, files: [...boqFiles, ...d3Files] })}
          className={cn(btn, "flex-1 bg-[#d32029] text-white")}
        >
          {saving ? "กำลังส่ง..." : need3d ? "ส่ง BOQ + แบบ 3D" : "ส่ง BOQ ให้พนักงานขาย"}
        </button>
      </div>
      {need3d && (!boqFiles.length || !d3Files.length) && <p className="text-[11px] text-slate-400 text-center">ต้องแนบทั้งไฟล์ BOQ และไฟล์แบบ 3D ก่อนส่ง</p>}
    </>);
  }
  if (role === "designer" && DESIGNER_PHASE.includes(j.status) && j.designerId) {
    return box("งานนี้มีคนรับแล้ว", <p className="text-[12px] text-slate-600">🔒 {j.designerName ?? "ห้องแบบคนอื่น"} รับงานนี้แล้ว</p>, "border-slate-200");
  }

  /* ---------- พนักงานขาย ---------- */
  if (caps.review) {
    return box(`ตรวจ BOQ v${j.versions.at(-1)?.v ?? ""}`, <>
      {!mode && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("revise")} className={cn(btn, "bg-orange-50 text-orange-700 border border-orange-200")}>แจ้งแก้ไข</button>
            <button type="button" onClick={() => setMode("ok")} className={cn(btn, "bg-emerald-600 text-white")}>BOQ ผ่าน</button>
          </div>
          <button type="button" onClick={() => setMode("cancel")} className="text-[12px] text-slate-500 underline">ยกเลิกคำขอ</button>
        </>
      )}
      {mode === "revise" && <>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="รายละเอียดที่ต้องแก้ เช่น จุดที่ 2 เปลี่ยนเป็นสีวอร์มเกรย์" className={inputCls} />
        <div className="flex gap-2">{back}<button type="button" disabled={saving || !text.trim()} onClick={() => run({ action: "revise", text })} className={cn(btn, "flex-1 bg-orange-600 text-white")}>ส่งกลับให้ห้องแบบแก้</button></div>
      </>}
      {mode === "ok" && <>
        <label className={labelCls}>ใช้ BOQ เวอร์ชันไหน</label>
        <div className="flex gap-2 flex-wrap">
          {j.versions.map((v) => (
            <button key={v.v} type="button" onClick={() => setVer(v.v)} className={cn("px-3 py-1.5 rounded-xl border text-[12px] font-semibold", ver === v.v ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600")}>v{v.v}</button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">ยืนยันแล้วงานจะปิดฝั่งห้องแบบ และย้ายไป &quot;รอใบเสนอราคา&quot;</p>
        <div className="flex gap-2">{back}<button type="button" disabled={saving} onClick={() => run({ action: "approve", version: ver })} className={cn(btn, "flex-1 bg-emerald-600 text-white")}>ยืนยัน BOQ ผ่าน</button></div>
      </>}
      {mode === "cancel" && <CancelBox text={text} setText={setText} back={back} saving={saving} run={run} />}
    </>);
  }
  if (caps.cancel) {
    return box("รอห้องแบบ", <>
      <p className="text-[12px] text-slate-600">
        {j.status === "waiting" ? "ยังไม่มีห้องแบบรับงาน" : `${j.designerName ?? "ห้องแบบ"} กำลังทำ`} — กำหนดส่ง {dateTh(j.dueAt, true)}
      </p>
      {mode === "cancel" ? <CancelBox text={text} setText={setText} back={back} saving={saving} run={run} /> : (
        <button type="button" onClick={() => setMode("cancel")} className="text-[12px] text-slate-500 underline">ยกเลิกคำขอ</button>
      )}
    </>, "border-slate-200");
  }
  const quoteForm = (label: string) => <>
    <div><label className={labelCls}>เลขที่ใบเสนอราคา</label><input value={quoteNo} onChange={(e) => setQuoteNo(e.target.value)} maxLength={60} placeholder="เช่น QT-0160" className={inputCls} /></div>
    <div><label className={labelCls}>ยอดเสนอราคา (บาท)</label><input inputMode="numeric" value={amount} onChange={(e) => setAmount(money(e.target.value))} className={inputCls} /></div>
    <button type="button" disabled={saving || !quoteNo.trim() || !toNum(amount)} onClick={() => run({ action: "quote", quoteNo, amount: toNum(amount) })} className={cn(btn, "w-full bg-[#d32029] text-white")}>{label}</button>
  </>;
  if (caps.quote && j.status === "boq_ok") return box("บันทึกใบเสนอราคา", quoteForm("บันทึกใบเสนอราคา"));
  if (caps.result) {
    const lastQuote = j.quotes.at(-1);
    return box("ผลการเสนอราคา", <>
      {!mode && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode("win")} className={cn(btn, "bg-emerald-600 text-white")}>Win 🎉</button>
          <button type="button" onClick={() => setMode("loss")} className={cn(btn, "bg-slate-700 text-white")}>Loss</button>
          <button type="button" onClick={() => setMode("requote")} className="col-span-2 text-[12px] text-slate-500 underline">เสนอราคาใหม่ (ใบเดิมเก็บไว้ในประวัติ)</button>
        </div>
      )}
      {mode === "win" && <>
        <div><label className={labelCls}>ยอดปิดจริง (บาท)</label><input inputMode="numeric" value={amount} onChange={(e) => setAmount(money(e.target.value))} placeholder={lastQuote ? lastQuote.amount.toLocaleString("th-TH") : ""} className={inputCls} /></div>
        <p className="text-[11px] text-slate-500">ยอดเสนอราคา {baht(lastQuote?.amount)} — ใส่ยอดที่ตกลงจริงหลังต่อรอง</p>
        <div className="flex gap-2">{back}<button type="button" disabled={saving || !toNum(amount)} onClick={() => run({ action: "win", amount: toNum(amount) })} className={cn(btn, "flex-1 bg-emerald-600 text-white")}>บันทึก Win</button></div>
      </>}
      {mode === "loss" && <>
        <label className={labelCls}>เหตุผลที่ไม่ได้งาน</label>
        <div className="space-y-1.5">
          {lossReasons.map((o) => (
            <button key={o.code} type="button" onClick={() => setReason(o.code)} className={cn("w-full text-left px-3 py-2 rounded-xl border text-[12px] flex items-center gap-2 transition", reason === o.code ? "border-slate-700 bg-slate-100 text-slate-900 font-semibold" : "border-slate-200 bg-white text-slate-600")}>
              <Icon name={reason === o.code ? "radio_button_checked" : "radio_button_unchecked"} style={{ fontSize: 17 }} />
              {o.label}
            </button>
          ))}
        </div>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={reason === "other" ? "ระบุเหตุผล (จำเป็น)" : "รายละเอียดเพิ่มเติม (ถ้ามี)"} className={inputCls} />
        <div className="flex gap-2">{back}<button type="button" disabled={saving || !reason || (reason === "other" && !text.trim())} onClick={() => run({ action: "loss", reason, text })} className={cn(btn, "flex-1 bg-slate-700 text-white")}>บันทึก Loss</button></div>
      </>}
      {mode === "requote" && <>{quoteForm("บันทึกใบเสนอราคาใหม่")}{back}</>}
    </>);
  }
  return null;
}

function CancelBox({ text, setText, back, saving, run }: { text: string; setText: (s: string) => void; back: React.ReactNode; saving: boolean; run: (b: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2">
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="เหตุผลที่ยกเลิก (ถ้ามี)" className={inputCls} />
      <div className="flex gap-2">{back}<button type="button" disabled={saving} onClick={() => run({ action: "cancel", text })} className={cn(btn, "flex-1 bg-slate-700 text-white")}>ยืนยันยกเลิกคำขอ</button></div>
    </div>
  );
}

export function BoqDetailScreen({ id }: { id: number }) {
  const { ready } = useSession();
  const [d, setD] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchBoq(id)
      .then((x) => !cancelled && setD(x))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [ready, id, reload]);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  if (!ready) return null;
  if (error) return (<><BoqHeader title="คำขอ BOQ" back="/app/boq" /><p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">{error === "forbidden" ? "คุณไม่มีสิทธิ์ดูคำขอนี้" : `โหลดไม่สำเร็จ: ${error}`}</p></>);
  if (!d) return (<><BoqHeader title="คำขอ BOQ" back="/app/boq" /><p className="text-center text-[12px] text-slate-400 py-8">กำลังโหลด...</p></>);

  const j = d.item;
  const sla = DESIGNER_PHASE.includes(j.status) ? slaBadge(j.dueAt, now) : null;
  const byKind = (k: BoqFile["kind"]) => j.files.filter((f) => f.kind === k);
  const reason = d.lossReasons.find((r) => r.code === j.lossReason)?.label;

  return (
    <>
      <BoqHeader title={j.reqNo} back="/app/boq" />
      <div className="space-y-3 pb-6">
        <section className={cn(card, "p-4 space-y-3")}>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={j.status} className="text-[11px] px-2.5 py-1" />
            {sla && <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", sla.cls)}>{sla.text}</span>}
          </div>
          <div>
            <p className="text-[18px] font-bold text-slate-900">{j.customerName}</p>
            <p className="text-[12px] text-slate-500">
              {j.customerType}{j.customerTypeOther ? ` (${j.customerTypeOther})` : ""} · {j.jobType} · {j.buildingType}
            </p>
          </div>
          <Stepper status={j.status} />
        </section>

        <ActionPanel key={`${j.status}-${j.versions.length}-${j.quotes.length}`} d={d} onDone={refresh} />

        <section className={cn(card, "p-4")}>
          <h3 className="text-[13px] font-bold text-slate-800 mb-1">ข้อมูลคำขอ</h3>
          <Row k="ความต้องการ" v={needLabel(j.need)} />
          <Row k="งบประมาณ" v={baht(j.budget)} />
          {j.customerPhone && <Row k="เบอร์ลูกค้า" v={<a href={`tel:${j.customerPhone}`} className="text-sky-700">{j.customerPhone}</a>} />}
          {j.province && <Row k="จังหวัดหน้างาน" v={j.province} />}
          {j.wantDate && <Row k="ต้องการรับ BOQ / วันนัด" v={dateTh(j.wantDate)} />}
          <Row k="ผู้บันทึก" v={`${j.repName}${j.recorderEmail ? ` · ${j.recorderEmail}` : ""}`} />
          {j.repPhone && <Row k="เบอร์พนักงาน" v={<a href={`tel:${j.repPhone}`} className="text-sky-700">{j.repPhone}</a>} />}
          <Row k="ร้าน" v={`${j.dealerName} (${j.dealerCode})`} />
          <Row k="ห้องแบบ" v={j.designerName ?? "ยังไม่มีคนรับ"} />
          <Row k="ส่งคำขอ" v={dateTh(j.createdAt, true)} />
          <Row k="กำหนดส่งของห้องแบบ" v={dateTh(j.dueAt, true)} />
          {j.opNo && <Row k="เลข Opportunity" v={j.opNo} />}
          {j.note && <Row k="หมายเหตุ" v={j.note} />}
        </section>

        <section className={cn(card, "p-4 space-y-2")}>
          <h3 className="text-[13px] font-bold text-slate-800">จุดที่ทำ BOQ ({j.points.length} จุด)</h3>
          {j.points.map((p) => (
            <div key={p.no} className="flex gap-3 rounded-xl bg-slate-50 p-2.5">
              <span className="w-7 h-7 shrink-0 rounded-full bg-slate-900 text-white text-[12px] font-bold grid place-items-center">{p.no}</span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-800">{p.product?.name ?? p.code}</p>
                <p className="text-[11px] text-slate-500">รหัส {p.code}{p.detail ? ` · ${p.detail}` : ""}</p>
                <p className="text-[12px] text-emerald-700 font-semibold">{pointText(p)}</p>
              </div>
            </div>
          ))}
          {[
            { k: "photo" as const, t: "รูปจุดที่ใช้สินค้า" },
            { k: "plan" as const, t: "แบบแปลน" },
            { k: "old_design" as const, t: "แบบเดิมจากลูกค้า" },
          ].map(({ k, t }) => byKind(k).length > 0 && (
            <div key={k} className="pt-1">
              <p className="text-[11px] text-slate-500 mb-1">{t}</p>
              <div className="grid grid-cols-1 gap-1.5">{byKind(k).map((f) => <FileLink key={f.id} f={f} />)}</div>
            </div>
          ))}
        </section>

        {j.versions.length > 0 && (
          <section className={cn(card, "p-4 space-y-2")}>
            <h3 className="text-[13px] font-bold text-slate-800">ไฟล์ BOQ ทุกเวอร์ชัน</h3>
            {[...j.versions].reverse().map((v) => {
              const vf = j.files.filter((f) => f.version === v.v);
              return (
                <div key={v.v} className={cn("rounded-xl border p-2.5 space-y-1.5", j.approvedVersion === v.v ? "border-emerald-300 bg-emerald-50" : "border-slate-200")}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-800">v{v.v}</span>
                    {j.approvedVersion === v.v && <span className="text-[10px] font-bold text-emerald-700">✓ ใช้เวอร์ชันนี้</span>}
                    <span className="ml-auto text-[10px] text-slate-400">{dateTh(v.at, true)}{v.by ? ` · ${v.by}` : ""}</span>
                  </div>
                  {vf.filter((f) => f.kind === "boq").length > 0 && <p className="text-[10px] text-slate-500">BOQ</p>}
                  {vf.filter((f) => f.kind === "boq").map((f) => <FileLink key={f.id} f={f} />)}
                  {vf.filter((f) => f.kind === "d3").length > 0 && <p className="text-[10px] text-slate-500">แบบ 3D</p>}
                  {vf.filter((f) => f.kind === "d3").map((f) => <FileLink key={f.id} f={f} />)}
                  {v.note && <p className="text-[11px] text-slate-600">“{v.note}”</p>}
                </div>
              );
            })}
          </section>
        )}

        {(j.quotes.length > 0 || j.status === "win" || j.status === "loss") && (
          <section className={cn(card, "p-4")}>
            <h3 className="text-[13px] font-bold text-slate-800 mb-1">ใบเสนอราคา & ผล</h3>
            {j.quotes.map((q, i) => <Row key={i} k={`ใบเสนอราคา ${q.no}${i < j.quotes.length - 1 ? " (เดิม)" : ""}`} v={baht(q.amount)} />)}
            {j.status === "win" && <Row k="ยอดปิดจริง" v={<span className="text-emerald-700">{baht(j.finalAmount)}</span>} />}
            {j.status === "loss" && <Row k="เหตุผลที่ไม่ได้งาน" v={`${reason ?? j.lossReason}${j.resultNote ? ` — ${j.resultNote}` : ""}`} />}
          </section>
        )}

        <section className={cn(card, "p-4")}>
          <h3 className="text-[13px] font-bold text-slate-800 mb-2">ไทม์ไลน์</h3>
          <ol className="relative border-l-2 border-slate-200 ml-2 space-y-3">
            {[...j.events].reverse().map((e, i) => (
              <li key={i} className="pl-4 relative">
                <span className={cn("absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white", e.tone === "warn" ? "bg-orange-500" : e.tone === "ok" ? "bg-emerald-500" : e.tone === "bad" ? "bg-slate-500" : "bg-[#d32029]")} />
                <p className="text-[12px] text-slate-800">{e.text}</p>
                <p className="text-[10px] text-slate-400">{e.actor_name ?? "-"} · {dateTh(e.at, true)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

