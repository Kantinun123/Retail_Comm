"use client";

import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { CHANNEL_DISCOUNT, GT_ESTIMATE_FEE, MODEL_LABEL, NOW, SCG_COMMISSION_PCT, baht, channelNet, dateTh, poNoOf, type EstimatePo, type Job } from "./crm-mock-data";
import { btnGhost, btnPrimary, inputCls } from "./crm-ui";

const APPROVERS: { name: string; role: EstimatePo["role"] }[] = [
  { name: "คุณสุดา (เจ้าของร้าน)", role: "owner" },
  { name: "น้องบี (พนักงานขาย ได้รับสิทธิ์อนุมัติ)", role: "delegate" },
];

/* GT : ร้านอนุมัติ PO ค่าประมาณการ ฿2,500 -> CRM รันเลข PO เอง -> งานเข้าคิวห้องแบบกลาง */
export function GtEstimatePanel({ job, onPatchJob, toast }: { job: Job; onPatchJob: (id: string, fn: (j: Job) => Job) => void; toast: (m: string) => void }) {
  const [who, setWho] = useState(0);
  const [kind, setKind] = useState<"notice" | "priced">("priced");
  const po = job.estimatePo;
  if (po) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-[12px]">
        <p className="flex items-center gap-1.5 font-bold text-emerald-800"><Icon name="verified" className="!text-[18px]" />ร้านอนุมัติ PO ค่าประมาณการแล้ว · {po.no}</p>
        <p className="mt-1 text-slate-600">ค่าบริการ {baht(po.fee)} · อนุมัติโดย {po.approver} ({po.role === "owner" ? "เจ้าของร้าน" : "ผู้ได้รับสิทธิ์"}) · {dateTh(po.at)}</p>
        <p className="mt-1 text-slate-500">งานอยู่ในคิวห้องแบบกลาง (ณุ) · ข้อมูลส่งต่อ RSD อัตโนมัติ ผลประมาณการจะกลับมาที่ร้านเพื่อเปิดใบเสนอราคา</p>
        <RsdPayload job={job} />
      </div>
    );
  }
  const approve = () => {
    const a = APPROVERS[who];
    const no = poNoOf(job, "E");
    const at = NOW.toISOString();
    onPatchJob(job.id, (j) => ({ ...j, lastTouchAt: at, estimatePo: { no, fee: GT_ESTIMATE_FEE, approver: a.name, role: a.role, at }, log: [...j.log, { at, text: `ร้านอนุมัติ PO ค่าประมาณการ ${baht(GT_ESTIMATE_FEE)} (${a.name}) · ระบบออกเลข ${no} · ส่งเข้าคิวห้องแบบกลาง` }] }));
    toast(`ออกเลข PO ${no} แล้ว ส่งงานเข้าคิวห้องแบบกลาง`);
  };
  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-[12px]">
      <p className="flex items-center gap-1.5 font-bold text-amber-900"><Icon name="request_quote" className="!text-[18px]" />GT : รอร้านอนุมัติ PO ค่าประมาณการ</p>
      <p className="text-slate-600">ร้านจ่ายค่าบริการให้ SCG ผ่าน PO ที่ร้านเซ็นอนุมัติ งานจะเข้าห้องแบบกลางหลังอนุมัติเท่านั้น</p>
      <div className="grid grid-cols-2 gap-2">
        {([["priced", "ประมาณการสินค้า + ค่าบริการ"], ["notice", "แจ้งทำประมาณการ"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={cn("rounded-xl border p-2.5 text-left transition", kind === k ? "border-indigo-500 bg-white" : "border-slate-200 bg-white/60 hover:border-indigo-300")}><b className="block text-slate-900">{l}</b><span className="text-[10.5px] text-slate-500">{baht(GT_ESTIMATE_FEE)} (ราคาเท่ากัน)</span></button>
        ))}
      </div>
      <label className="block"><span className="text-[11px] font-semibold text-slate-600">ผู้อนุมัติของร้าน</span>
        <select value={who} onChange={(e) => setWho(Number(e.target.value))} className={cn(inputCls, "mt-1")}>{APPROVERS.map((a, i) => <option key={a.name} value={i}>{a.name}</option>)}</select>
      </label>
      <p className="text-[11px] text-slate-500">เลข PO: ระบบรันให้เองหลังกดอนุมัติ (ตัวอย่าง {poNoOf(job, "E")})</p>
      <button onClick={approve} className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />จำลอง: ร้านกดอนุมัติ PO {baht(GT_ESTIMATE_FEE)}</button>
    </div>
  );
}

/* ข้อมูลที่ CRM ส่งให้ RSD (ห้องแบบกลางนำไปทำประมาณการ) */
function RsdPayload({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const i = job.intake;
  const rows: [string, string][] = [
    ["Job No.", job.opsId], ["ลูกค้า", job.customer], ["Site", job.province], ["ช่องทาง", job.store ?? "-"],
    ["กระเบื้อง", i ? `${i.tile} ${i.tileModel}` : "-"], ["สี", i?.color ?? "-"], ["ความลาด", i?.deg ? `${i.deg}°` : "-"], ["แนบไฟล์แปลน", `${i?.files?.length ?? 0} ไฟล์`],
  ];
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}><Icon name="send_to_mobile" style={{ fontSize: 16 }} />{open ? "ซ่อน" : "ดู"}ข้อมูลที่ส่งเข้า RSD</button>
      {open && <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-white p-3">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-slate-500">{k}</dt><dd className="truncate font-semibold text-slate-800">{v}</dd></div>)}</dl>}
    </div>
  );
}

/* HE / GT : ร้านเก็บเงินลูกค้าเอง ใช้ใบตัวแทนเป็น PO ถึง SCG (ไม่ใช้ระบบชำระเงินใน CRM) */
export function PoTrackPanel({ job, label, amount, onConfirm }: { job: Job; label: string; amount: number; onConfirm: (poNo: string) => void }) {
  const pct = CHANNEL_DISCOUNT[job.model];
  const net = channelNet(amount, job.model);
  const po = poNoOf(job, label.slice(0, 2));
  return (
    <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-[12px]">
      <p className="flex items-center gap-1.5 font-bold text-sky-900"><Icon name="storefront" className="!text-[17px]" />{MODEL_LABEL[job.model]}: ร้านเก็บเงินลูกค้าเอง · ใช้ใบตัวแทนเป็น PO ถึง SCG</p>
      <p className="text-slate-600">{label} {baht(amount)} · ส่วนลดเมื่อเปิด PO {pct}% = <b>{baht(net)}</b> ที่ร้านชำระ SCG</p>
      <p className="text-[11px] text-slate-500">SCG ไม่ตามเก็บเงินจากลูกค้า ติดตามเฉพาะ PO จากร้าน (ตัวอย่างเลข {po})</p>
      <button onClick={() => onConfirm(po)} className={cn(btnPrimary, "!py-1.5 !text-[11.5px]")}><Icon name="description" style={{ fontSize: 17 }} />จำลอง: ร้านส่ง PO ถึง SCG แล้ว</button>
    </div>
  );
}

export const SCG_HOME_NOTE = `SCG Home: ลูกค้าชำระผ่าน CRM · ไม่มีส่วนลดช่องทาง · ร้านได้คอมมิชชั่น ${SCG_COMMISSION_PCT}% ภายหลัง`;
