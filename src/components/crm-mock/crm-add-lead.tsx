"use client";
/* ฟอร์มเพิ่ม Lead แบบรวม: ลูกค้าเข้าร้าน (Walk-in) คือแหล่งที่มาหนึ่งของ Lead ไม่แยกฟอร์ม */
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { CHANNELS, NOW, PRODUCTS, assignStore, cleanInterests, interestSummary, needsBuyMode, slaHoursOf, suggestRoute, type BuyMode, type Coverage, type Interest, type Lead } from "./crm-mock-data";
import { InterestEditor } from "./crm-interests";
import { Tip, useGuideOn } from "./crm-guide";
import { TH_PROVINCES, districtsOf } from "./th-geo";
import { Drawer, Field, btnPrimary, inputCls } from "./crm-ui";

export function AddLeadDrawer({ open, onClose, nextId, onAdd, coverage }: { open: boolean; onClose: () => void; nextId: string; onAdd: (l: Lead) => void; coverage: Coverage[] }) {
  return (
    <Drawer open={open} onClose={onClose} title="เพิ่ม Lead" subtitle="ลูกค้าเข้าร้านก็ใช้ฟอร์มนี้ เลือกแหล่งที่มา Walk-in">
      {open && <Body key={nextId} nextId={nextId} onClose={onClose} onAdd={onAdd} coverage={coverage} />}
    </Drawer>
  );
}

function Body({ nextId, onClose, onAdd, coverage }: { nextId: string; onClose: () => void; onAdd: (l: Lead) => void; coverage: Coverage[] }) {
  const [f, setF] = useState({ name: "", phone: "", province: "", district: "", channel: CHANNELS[0], interest: "", visit: false, contacted: false });
  const [interests, setInterests] = useState<Interest[]>([]);
  const guide = useGuideOn();
  const picked = cleanInterests(interests);
  const [buy, setBuy] = useState<BuyMode | undefined>();
  const needBuy = needsBuyMode(picked) && !buy;
  const route = suggestRoute(picked, buy);
  const walkin = f.channel === "Walk-in";
  const visit = walkin || f.visit;
  const contacted = walkin || f.contacted;
  const ok = f.name.trim() && f.phone.trim() && f.province.trim() && !needBuy;
  const save = () => {
    const now = NOW.toISOString();
    onAdd({
      id: nextId, name: f.name.trim(), phone: f.phone.trim(), product: interestSummary(picked) || PRODUCTS[0], interests: picked, buyMode: needsBuyMode(picked) ? buy : undefined, source: f.channel === "Home Online" ? "customer" : "staff", channel: f.channel, province: f.province.trim(), district: f.district.trim() || undefined, createdAt: now,
      contacts: contacted ? [{ id: `${nextId}-C1`, at: now, by: "ทีมขาย", channel: walkin ? "เข้าร้าน" : "โทร", outcome: "คุยได้", note: walkin ? "ลูกค้าเข้ามาที่ร้าน" : "ติดต่อลูกค้าแล้วก่อนคีย์ข้อมูล" }] : undefined,
      firstContactAt: contacted ? now : undefined, visitAt: visit ? now : undefined, status: contacted ? "contacting" : "waiting", interest: f.interest.trim() || undefined,
    });
    onClose();
  };
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อลูกค้า *"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="เช่น คุณสมหมาย ใจดี" /></Field>
        <Field label="เบอร์โทร *"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={inputCls} placeholder="08x-xxx-xxxx" /><Tip>ใช้เบอร์ที่ติดต่อได้จริง ระบบใช้เบอร์รวมประวัติลูกค้าคนเดียวกัน</Tip></Field>
        <Field label="จังหวัดหน้างาน *"><select value={f.province} onChange={(e) => setF({ ...f, province: e.target.value, district: "" })} className={inputCls}><option value="">เลือกจังหวัด...</option>{TH_PROVINCES.map((p) => <option key={p}>{p}</option>)}</select><Tip>ใช้จ่ายงานให้ร้านที่รับพื้นที่นี้ ใส่จังหวัดของหน้างาน ไม่ใช่ที่อยู่ปัจจุบันของลูกค้า</Tip></Field>
        <Field label={f.province === "กรุงเทพมหานคร" ? "เขตหน้างาน (ถ้ามี)" : "อำเภอหน้างาน (ถ้ามี)"}><select value={f.district} disabled={!f.province} onChange={(e) => setF({ ...f, district: e.target.value })} className={cn(inputCls, "disabled:opacity-50")}><option value="">{f.province ? "ไม่ระบุ" : "เลือกจังหวัดก่อน"}</option>{districtsOf(f.province).map((d) => <option key={d}>{d}</option>)}</select><Tip>ถ้าใส่ ระบบเลือกร้านในอำเภอนั้นก่อน</Tip></Field>
        <Field label="แหล่งที่มา">
          <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} className={inputCls}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      <div className="space-y-3">
        <div className="text-[13px] font-bold text-slate-900">ลูกค้าสนใจอะไร <span className="font-normal text-slate-400">· เลือกได้หลายรายการ ทั้งบริการและสินค้า</span></div>
        <Tip>ถามลูกค้าว่า &ldquo;อยากให้ทางเราช่วยเรื่องอะไรบ้าง&rdquo; เลือกได้หลายอย่าง ถ้ามีงานบริการ ระบบจะแนะนำให้เปิด Opp</Tip>
        <InterestEditor kind="service" value={interests} onChange={setInterests} />
        <InterestEditor kind="product" value={interests} onChange={setInterests} buy={buy} onBuy={setBuy} />
        <Field label="หมายเหตุความต้องการ (ถ้ามี)"><input value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })} className={inputCls} placeholder="เช่น บ้านชั้นเดียว ประมาณ 180 ตร.ม." /></Field>
        {guide && picked.length === 0 && <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900"><Icon name="warning" style={{ fontSize: 18 }} /><span><b>ยังไม่ได้เลือกความสนใจ</b> ทีมขายคนถัดไปจะไม่รู้ว่าลูกค้าต้องการอะไร ถ้าลูกค้ายังไม่แน่ใจ ใส่หมายเหตุแทนได้ บันทึกต่อได้ ไม่บังคับ</span></p>}
        {f.channel === "Home Online" && <p className="flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-[12px] text-sky-800"><Icon name="language" style={{ fontSize: 16 }} />ช่องทาง Home Online: ในระบบจริงลูกค้าเลือกรายการเองจากหน้าเว็บ ฟอร์มนี้จำลองข้อมูลที่ติดมา ทีมขายต้องทวนความต้องการอีกครั้ง</p>}
        {route !== "none" && <p className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px]", route === "solution" ? "bg-indigo-50 text-indigo-800" : "bg-fuchsia-50 text-fuchsia-800")}><Icon name="alt_route" style={{ fontSize: 16 }} />{route === "solution" ? `ระบบแนะนำ: เปิด Opp (${picked.some((i) => i.kind === "service") ? "มีงานบริการ" : "ออกแบบพร้อมซื้อสินค้า"})` : "ระบบแนะนำ: ส่งให้ร้านทำใบเสนอราคา (สินค้าอย่างเดียว) ถ้าลูกค้าต้องการแบบ ให้เปิด Opp"}</p>}
      </div>
      {f.province.trim() && (() => {
        const a = assignStore(coverage, f.province, f.district);
        return (
          <p className={cn("flex flex-wrap items-center gap-1.5 rounded-xl px-3 py-2 text-[12px]", a.store ? "bg-indigo-50 text-indigo-800" : "bg-amber-50 text-amber-800")}>
            <Icon name="share_location" style={{ fontSize: 16 }} />
            {a.store ? <>จ่ายให้ <b>{a.store}</b>{a.candidates.length > 1 && <span className="text-slate-500"> · ร้านถัดไปถ้าไม่รับตาม SLA: {a.candidates.slice(1).join(", ")}</span>}</> : "ยังไม่มีร้านรับพื้นที่นี้ ต้องจ่ายงานเอง"}
          </p>
        );
      })()}
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/70 p-3.5 text-[12.5px] text-slate-700">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={visit} disabled={walkin} onChange={(e) => setF({ ...f, visit: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
          ลูกค้าอยู่ที่ร้านตอนนี้ (บันทึก Visit) {walkin && <span className="text-[11px] text-slate-400">· Walk-in เปิดให้อัตโนมัติ</span>}
        </label>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={contacted} disabled={walkin} onChange={(e) => setF({ ...f, contacted: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
          ติดต่อลูกค้าแล้วก่อนคีย์
        </label>
        <p className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px]", contacted ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800")}>
          <Icon name={contacted ? "call" : "timer"} style={{ fontSize: 15 }} />
          {contacted ? "เริ่มที่สถานะ กำลังสกรีน ไม่นับ SLA ติดต่อครั้งแรก" : `เริ่มที่สถานะ รอติดต่อ · ต้องติดต่อครั้งแรกภายใน ${slaHoursOf(f.channel)} ชม.`}
        </p>
      </div>
      <div className="flex justify-end pb-2"><button disabled={!ok} onClick={save} className={cn(btnPrimary, !ok && "opacity-50")}><Icon name="add" style={{ fontSize: 18 }} />เพิ่ม Lead</button></div>
    </>
  );
}
