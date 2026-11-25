"use client";
/* เปิด Opp ชนิดสำรวจ (Smart Solution / BA): ไม่มีขั้นรับแบบ/ถอดแบบ มีค่าสำรวจและทีมสำรวจแทน */
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { MODEL_LABEL, OWNERS, SURVEY_FEE, type Lead, type Model } from "./crm-mock-data";
import { Drawer, Field, btnPrimary, inputCls } from "./crm-ui";

export interface SurveyInput { customer: string; phone: string; province: string; model: Model; owner: string; scope: string; leadId?: string }

export function NewSurveyDrawer({ open, lead, onClose, onCreate }: { open: boolean; lead: Lead | null; onClose: () => void; onCreate: (i: SurveyInput) => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="เปิด Opp ชนิดสำรวจ" subtitle={lead ? `จาก Lead ${lead.id} · ${lead.name}` : "Smart Solution / BA · เก็บค่าสำรวจก่อนส่งทีมสำรวจ"}>
      {open && <Body key={lead?.id ?? "new"} lead={lead} onCreate={onCreate} />}
    </Drawer>
  );
}

function Body({ lead, onCreate }: { lead: Lead | null; onCreate: (i: SurveyInput) => void }) {
  const [f, setF] = useState({ customer: lead?.name ?? "", phone: lead?.phone ?? "", province: lead?.province ?? "", model: "he" as Model, owner: OWNERS[0], scope: lead?.interest ?? "" });
  const ok = f.customer.trim() && f.phone.trim() && f.province.trim() && f.scope.trim();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อลูกค้า *"><input value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} className={inputCls} /></Field>
        <Field label="เบอร์โทร *"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={inputCls} /></Field>
        <Field label="จังหวัดหน้างาน *"><input value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} className={inputCls} /></Field>
        <Field label="โมเดลร้าน">
          <select value={f.model} onChange={(e) => setF({ ...f, model: e.target.value as Model })} className={inputCls}>{(Object.keys(MODEL_LABEL) as Model[]).map((m) => <option key={m} value={m}>{MODEL_LABEL[m]}</option>)}</select>
        </Field>
        <Field label="ผู้ดูแล">
          <select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} className={inputCls}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field label="งานที่ต้องการ *"><input value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} className={inputCls} placeholder="เช่น ติดตั้งแอร์ 3 ห้อง" /></Field>
      </div>
      <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3.5 text-[12px] leading-relaxed text-slate-600">
        <b className="text-sky-800">ขั้นตอนของ Opp ชนิดสำรวจ:</b> เก็บค่าสำรวจ ฿{SURVEY_FEE.toLocaleString("en-US")} (ค่าสมมติ) → ส่งงานให้ทีมสำรวจ → ทีมสำรวจส่งรายงานและใบเสนอราคากลับมา → ทีมขายเสนอราคา → ปิดขายและเก็บค่าติดตั้ง (หักค่าสำรวจ) → เตรียมของ ติดตั้ง ส่งมอบ
      </div>
      <div className="flex justify-end pb-2">
        <button disabled={!ok} onClick={() => onCreate({ customer: f.customer.trim(), phone: f.phone.trim(), province: f.province.trim(), model: f.model, owner: f.owner, scope: f.scope.trim(), leadId: lead?.id })} className={cn(btnPrimary, !ok && "opacity-50")}>
          <Icon name="rocket_launch" style={{ fontSize: 18 }} />เปิด Opp สำรวจ
        </button>
      </div>
    </>
  );
}
