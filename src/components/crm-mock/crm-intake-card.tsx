"use client";
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { CAT_LABEL, ROUND_LABEL, SVC_LABEL, TERRAIN, dateTh, type Job } from "./crm-mock-data";
import { KV, glass } from "./crm-ui";

/** ใบเปิดงาน (Step 1–5) ของ Opp: ย่อเป็นบรรทัดสรุป กดเพื่อดูทั้งหมด */
export function IntakeCard({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const i = job.intake;
  if (!i) return null;
  const group = (t: string) => <div className="mb-0.5 mt-3 text-[11px] font-bold uppercase tracking-wide text-indigo-600 first:mt-0">{t}</div>;
  return (
    <div className={cn(glass, "p-4")}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name="description" style={{ fontSize: 18 }} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-slate-900">ใบเปิดงาน (Job Order)</span>
          <span className="block truncate text-[11.5px] text-slate-500">{i.btype} · {i.district}, {job.province} · {i.pkg} · แนบ {i.files.length} ไฟล์</span>
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-slate-400" />
      </button>
      {open && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {group("ลูกค้า")}
          <KV k="ชื่อ-สกุล / เบอร์" v={`${job.customer} · ${job.phone}`} />
          <KV k="ประเภทลูกค้า" v={i.ctype} />
          <KV k="รหัสลูกค้า Fam / อีเมล" v={`${i.fam ?? "-"} / ${i.email ?? "-"}`} />
          <KV k="รหัส Lead" v={job.leadId ?? "-"} />
          {group("ข้อมูลขอรับบริการ")}
          <KV k="วันที่ขอรับบริการ" v={dateTh(i.requestDate)} />
          <KV k="ชื่อร้าน" v={i.shop ? `${i.shop} (${i.shopType ?? "-"})` : "-"} />
          {group("ข้อมูลงาน")}
          <KV k="ประเภท / ลักษณะอาคาร" v={`${i.btype} / ${i.bchar}`} />
          <KV k="จังหวัด / อำเภอ" v={`${job.province} / ${i.district}`} />
          <KV k="Location หน้างาน" v={i.loc ? <a href={i.loc} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">เปิดใน Google Maps</a> : "-"} />
          <KV k="พื้นที่ใกล้ทะเล" v={i.sea} />
          <KV k="ภูมิประเทศ" v={<span className="block">{i.terr.map((t) => <span key={t} className="block text-[11.5px]">{TERRAIN[t]}</span>)}</span>} />
          <KV k="ชื่อบนใบรับประกัน" v={i.warrSame ? `${job.customer} (ชื่อเดียวกับลูกค้า)` : i.warrName} />
          {group("ข้อมูลส่งถอดแบบ")}
          {i.refJob && <KV k="Ref Job no" v={i.refJob} />}
          <KV k="บริการที่เลือก" v={i.svc.map((s) => SVC_LABEL[s] ?? s).join(" · ")} />
          <KV k="แพคเกจขาย" v={`${i.pkgType === "total" ? "Total Roof (โครง+กระเบื้อง)" : "Standard Roof"} – ${i.pkg}`} />
          <KV k="หมวดที่ส่งถอดแบบ" v={`${i.det.map((c) => CAT_LABEL[c]).join(", ")} · ${ROUND_LABEL[i.round]}`} />
          <KV k="อะเส / ไม้เชิงชาย" v={`${i.ase} / ${i.chc}`} />
          <KV k="โครงหลังคา" v={`หลังคา 2 step: ${i.st2 ? "Yes" : "No"} · max truss ${i.truss ? `${i.truss} ม.` : "-"} · มุก ${i.muk ?? "-"} · ${i.rc ?? "-"} · ชายคาแบบที่ ${i.eave}`} />
          <KV k="กระเบื้อง" v={`${i.tile} · ${i.tileModel} · ${i.color}`} />
          <KV k="ทรงหลังคา / องศา" v={`${i.shape ?? "-"} / ${i.deg ? `${i.deg}°` : "-"}`} />
          <KV k="วัสดุกันความร้อน" v={i.ins} />
          {group("เอกสารแนบ")}
          <ul className="space-y-1">
            {i.files.map((f, k) => (
              <li key={k} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[12px] text-slate-700"><Icon name="draft" style={{ fontSize: 16 }} className="text-slate-400" /><span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-slate-400">{f.size}</span></li>
            ))}
            {i.files.length === 0 && <li className="text-[12px] text-slate-400">ไม่มีไฟล์แนบ</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
