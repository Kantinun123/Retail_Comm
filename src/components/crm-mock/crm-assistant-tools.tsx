"use client";
/* เครื่องมือของน้องเลขา: คำนวณ PT, เช็ควันส่งกระเบื้องตาม Class, ค้นประวัติลูกค้า, โปรโมชั่น, Flow และแบบฟอร์ม
   ข้อมูล Class / โปรโมชั่น / แบบฟอร์ม เป็นตัวอย่างเพื่อทดลองใช้งาน รอข้อมูลจริงจากเจ้าของข้อมูล */
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  MODEL_LABEL, NOW, PARTY, SEGMENT_LABEL, WORK_LABEL, addWd, baht, currentStep, dateTh, dayKey, template, valueText,
  type Job, type Lead, type Segment, type Work,
} from "./crm-mock-data";
import { inputCls } from "./crm-ui";

const selCls = cn(inputCls, "min-w-0");
const toIso = (d: string) => `${d}T09:00:00+07:00`;
const todayStr = () => dayKey(NOW.toISOString());
const Note = ({ children }: { children: React.ReactNode }) => <p className="mt-2 text-[10.5px] text-slate-400">{children}</p>;
function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[10.5px] font-semibold text-slate-500">{t}</span>{children}</label>;
}
function CopyBtn({ text, toast }: { text: string; toast: (m: string) => void }) {
  return <button onClick={() => { void navigator.clipboard?.writeText(text); toast("คัดลอกข้อความแล้ว"); }} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white">คัดลอกข้อความถึงลูกค้า</button>;
}

/* ---------------- 1) คำนวณ Project Timeline ---------------- */
export function PtCalc({ toast }: { toast: (m: string) => void }) {
  const [start, setStart] = useState(todayStr());
  const [seg, setSeg] = useState<Segment>("general");
  const [work, setWork] = useState<Work>("roof");
  const [want, setWant] = useState("");
  const steps = template(seg, work);
  const rows = steps.map((s) => ({ s, at: addWd(toIso(start), s.day - 1) }));
  const last = rows[rows.length - 1];
  const close = rows.find((r) => r.s.key === "close");
  const afterClose = last.s.day - (close?.s.day ?? 0);
  /* คำนวณย้อน: ปิดขายช้าสุดวันไหน จึงส่งมอบทันวันที่ลูกค้าต้องการ */
  let latestClose = "";
  if (want) {
    for (let k = 0; k < 200; k++) {
      const d = new Date(new Date(toIso(want)).getTime() - k * 86400e3).toISOString();
      if (new Date(addWd(d, afterClose)).getTime() <= new Date(toIso(want)).getTime()) { latestClose = d; break; }
    }
  }
  const msg = `แผนงานโดยประมาณ (นับจากวันที่ ${dateTh(toIso(start))}): ${rows.filter((r) => ["quote1", "survey", "quote2", "close", "install", "handover"].includes(r.s.key)).map((r) => `${r.s.label} ${dateTh(r.at)}`).join(" · ")} (ขึ้นกับการตัดสินใจและความพร้อมหน้างาน)`;
  return (
    <div className="space-y-3 text-[12px]">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Lbl t="วันที่ลูกค้าเข้ามา / รับแบบ"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={selCls} /></Lbl>
        <Lbl t="ประเภทลูกค้า"><select value={seg} onChange={(e) => setSeg(e.target.value as Segment)} className={selCls}>{(Object.keys(SEGMENT_LABEL) as Segment[]).map((k) => <option key={k} value={k}>{SEGMENT_LABEL[k]}</option>)}</select></Lbl>
        <Lbl t="ประเภทงาน"><select value={work} onChange={(e) => setWork(e.target.value as Work)} className={selCls}>{(Object.keys(WORK_LABEL) as Work[]).map((k) => <option key={k} value={k}>{WORK_LABEL[k]}</option>)}</select></Lbl>
      </div>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.map(({ s, at }) => (
          <li key={s.key} className={cn("flex items-center gap-2 px-3 py-2", s.key === "close" && "bg-orange-50", s.key === "handover" && "bg-emerald-50")}>
            <span className="w-14 shrink-0 text-[10.5px] font-bold text-slate-400">วันที่ {s.day}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{s.label}</span>
            <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 sm:inline">{s.owner === "SE" ? "ทีมขาย" : PARTY[s.owner].label}</span>
            <b className="shrink-0 text-slate-900">{dateTh(at)}</b>
          </li>
        ))}
      </ul>
      <div className="rounded-xl bg-indigo-50 p-3">
        <p className="font-semibold text-indigo-900">ปิดขาย → ส่งมอบ ใช้ {afterClose} วันทำการ · รับแบบ → ส่งมอบรวม {last.s.day} วันทำการ</p>
        <div className="mt-2 grid items-end gap-2 sm:grid-cols-[1fr_auto]">
          <Lbl t="ลูกค้าอยากให้ส่งมอบก่อนวันที่ (คำนวณย้อน)"><input type="date" value={want} onChange={(e) => setWant(e.target.value)} className={selCls} /></Lbl>
          {latestClose && <p className="pb-2 text-indigo-900">ต้องปิดขายไม่เกิน <b>{dateTh(latestClose)}</b></p>}
        </div>
        {latestClose && new Date(latestClose).getTime() < NOW.getTime() && <p className="mt-1 font-semibold text-rose-600">เลยวันนี้ไปแล้ว ไม่ทันตามกำหนดปกติ ควรแจ้งลูกค้าวันที่ใหม่</p>}
      </div>
      <CopyBtn text={msg} toast={toast} />
      <Note>อ้างอิง: Project Timeline (PT) Roof Installation ฉบับ 1 ส.ค. 2026 · นับเฉพาะวันทำการ จันทร์-ศุกร์ (ยังไม่หักวันหยุดนักขัตฤกษ์)</Note>
    </div>
  );
}

/* ---------------- 2) เช็ควันส่งกระเบื้องตาม Class ---------------- */
interface TileClass { model: string; classA: string[]; mto: string[] }
const TILE_CLASSES: TileClass[] = [
  {
    model: "หลังคา เอสซีจี รุ่น เอ็กซ์เซลล่า (Excella)",
    classA: ["เรดการ์เนต", "เรดแซฟไฟร์", "คริสตัลบลู", "ไวท์เพิร์ล", "กรีนเพริดอท", "เบอร์กันดี้", "เนวีบลู", "โคโค่บราวน์", "ซิลเวอร์เกรย์", "ออบซิเดียนเกรย์", "แพลตตินัม"],
    mto: ["เยลโล่แซฟไฟร์", "ทิมเบอร์บราวน์", "บลูคอร์เดียร์", "ไดมอนด์เกรย์", "เขียวแก้วมณี", "เอเวอร์กรีน", "ไอออนิค", "ซันไรส์", "คอปเปอร์บราวน์", "ซาบานาแบล็ค", "ซาบานาไวท์", "เคลย์", "เกรย์แมท"],
  },
];
const READY_WD = 12; // Class A สินค้าพร้อมส่งถึงหน้างาน หลังปิดขาย (ลูกค้าทั่วไป)
const READY_HBD_WD = 9; // กลุ่ม Home Builder Focus
const MTO_WD = 53; // สั่งผลิต ขั้นต่ำ 10,000 แผ่น
const MTO_MIN = 10_000;

export function ClassCheck({ toast }: { toast: (m: string) => void }) {
  const t = TILE_CLASSES[0];
  const [color, setColor] = useState(t.classA[0]);
  const [seg, setSeg] = useState<Segment>("general");
  const [close, setClose] = useState(todayStr());
  const [qty, setQty] = useState("");
  const isMto = t.mto.includes(color);
  const days = isMto ? MTO_WD : seg === "hbd" ? READY_HBD_WD : READY_WD;
  const date = addWd(toIso(close), days);
  const n = Number(qty.replace(/,/g, "")) || 0;
  const short = isMto && n > 0 && n < MTO_MIN;
  const msg = `สินค้า ${t.model.split("(")[0].trim()} สี${color} ${isMto ? "(สั่งผลิต)" : ""} คาดว่าส่งถึงหน้างานประมาณ ${dateTh(date)} (นับจากวันปิดขาย ${dateTh(toIso(close))}) ค่ะ`;
  return (
    <div className="space-y-3 text-[12px]">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Lbl t="รุ่น"><select className={selCls} defaultValue={t.model}>{TILE_CLASSES.map((x) => <option key={x.model}>{x.model}</option>)}</select></Lbl>
        <Lbl t="สี">
          <select value={color} onChange={(e) => setColor(e.target.value)} className={selCls}>
            <optgroup label="Class A · สินค้าพร้อมขาย">{t.classA.map((c) => <option key={c}>{c}</option>)}</optgroup>
            <optgroup label="MTO · สั่งผลิต">{t.mto.map((c) => <option key={c}>{c}</option>)}</optgroup>
          </select>
        </Lbl>
        <Lbl t="ประเภทลูกค้า"><select value={seg} onChange={(e) => setSeg(e.target.value as Segment)} className={selCls}>{(Object.keys(SEGMENT_LABEL) as Segment[]).map((k) => <option key={k} value={k}>{SEGMENT_LABEL[k]}</option>)}</select></Lbl>
        <Lbl t="วันที่ปิดขาย"><input type="date" value={close} onChange={(e) => setClose(e.target.value)} className={selCls} /></Lbl>
      </div>
      {isMto && <Lbl t="ออเดอร์รวมทั้งหมด (แผ่น)"><input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="เช่น 12,000" className={selCls} /></Lbl>}
      <div className={cn("rounded-xl p-3", short ? "bg-rose-50" : isMto ? "bg-amber-50" : "bg-emerald-50")}>
        <p className="flex items-center gap-1.5 font-bold text-slate-900">
          <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] text-white", isMto ? "bg-amber-500" : "bg-emerald-500")}>{isMto ? "MTO สั่งผลิต" : "Class A พร้อมขาย"}</span>
          สีนี้ใช้ {days} วันทำการ{!isMto && seg === "hbd" ? " (กลุ่ม HBD)" : ""}
        </p>
        <p className="mt-1 text-[15px] font-bold text-slate-900">ถึงหน้างานประมาณ {dateTh(date)}</p>
        {isMto && <p className={cn("mt-1", short ? "font-semibold text-rose-600" : "text-slate-600")}>{short ? `ออเดอร์รวมยังไม่ถึง ${MTO_MIN.toLocaleString("en-US")} แผ่น ผลิตไม่ได้ ต้องรวมออเดอร์ให้ครบก่อน` : `สั่งผลิตได้เมื่อออเดอร์รวมตั้งแต่ ${MTO_MIN.toLocaleString("en-US")} แผ่นขึ้นไป`}</p>}
      </div>
      <CopyBtn text={msg} toast={toast} />
      <Note>อ้างอิง: Product Class 2026 อัปเดต 19 ส.ค. 2026 · รายชื่อสีของแต่ละ Class เป็นตัวอย่างที่ถอดจากรูป รอตรวจกับเจ้าของข้อมูล ตอนนี้มีเฉพาะรุ่นเอ็กซ์เซลล่า</Note>
    </div>
  );
}

/* ---------------- 3) โปรโมชั่น ---------------- */
interface Promo { id: string; name: string; period: string; detail: string; works: Work[]; model?: "he" | "scg" }
export const PROMOS: Promo[] = [
  { id: "P1", name: "ฟรีค่าตรวจสภาพหลังคา", period: "1-30 พ.ย. 2569", detail: "ลูกค้างานเปลี่ยนหลังคา (Re-roof) และซ่อมหลังคา ไม่เสียค่าตรวจสภาพ", works: ["roof"] },
  { id: "P2", name: "ฉนวนกันความร้อนลด 10%", period: "15 พ.ย. - 15 ธ.ค. 2569", detail: "เมื่อสั่งหลังคาพร้อมฉนวน Ultra Cool InnoGreen", works: ["roof", "truss", "ase"] },
  { id: "P3", name: "ฟรีค่าสำรวจ Smart Solution", period: "ตลอดเดือน พ.ย. 2569", detail: "ปิดงานติดตั้งภายใน 30 วันหลังสำรวจ คืนค่าสำรวจเป็นส่วนลด", works: ["survey"], model: "he" },
];
export function PromoList({ works }: { works?: Work[] }) {
  const list = works?.length ? PROMOS.filter((p) => p.works.some((w) => works.includes(w))) : PROMOS;
  return (
    <div className="space-y-2 text-[12px]">
      {list.map((p) => (
        <div key={p.id} className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 p-3">
          <div className="flex items-center justify-between gap-2"><b className="text-slate-900">{p.name}</b><span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-fuchsia-700">{p.period}</span></div>
          <p className="mt-1 text-slate-600">{p.detail}</p>
        </div>
      ))}
      {!list.length && <p className="text-slate-400">ไม่มีโปรโมชั่นที่ตรงกับงานของลูกค้ารายนี้</p>}
      <Note>ข้อมูลโปรโมชั่นเป็นตัวอย่าง รอรายการจริงจากทีมการตลาด</Note>
    </div>
  );
}

/* ---------------- 4) ค้นประวัติลูกค้า ---------------- */
const digits = (s: string) => s.replace(/\D/g, "");
export function CustomerLookup({ jobs, leads, onJob, onLead, initial = "" }: { jobs: Job[]; leads: Lead[]; onJob: (id: string) => void; onLead: (id: string) => void; initial?: string }) {
  const [q, setQ] = useState(initial);
  const key = q.trim();
  const dq = digits(key);
  const hitJob = (j: Job) => (dq.length >= 4 ? digits(j.phone).includes(dq) : j.customer.includes(key) || j.id.includes(key));
  const hitLead = (l: Lead) => (dq.length >= 4 ? digits(l.phone).includes(dq) : l.name.includes(key) || l.id.includes(key));
  const js = key.length >= 2 ? jobs.filter(hitJob) : [];
  const ls = key.length >= 2 ? leads.filter(hitLead) : [];
  const live = js.filter((j) => !j.cancelReason);
  const won = js.filter((j) => j.done.close && !j.cancelReason);
  const total = won.reduce((s, j) => s + j.value, 0);
  const pipeline = live.filter((j) => !j.done.close && j.value > 0).reduce((s, j) => s + j.value, 0);
  const works = [...new Set(live.map((j) => j.work))];
  const first = [...js.map((j) => j.startedAt), ...ls.map((l) => l.createdAt)].sort()[0];
  const next = live.map((j) => ({ j, s: currentStep(j) })).find((x) => x.s?.owner === "SE");
  return (
    <div className="space-y-3 text-[12px]">
      <Lbl t="ชื่อลูกค้า หรือ เบอร์โทร"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เช่น สมศักดิ์ หรือ 081-555-0113" className={selCls} autoFocus /></Lbl>
      {key.length >= 2 && !js.length && !ls.length && <p className="rounded-xl bg-slate-50 p-3 text-slate-500">ไม่พบลูกค้าที่ตรงกับ &ldquo;{key}&rdquo; ถ้าเป็นลูกค้าใหม่ คีย์ Lead ได้เลย</p>}
      {(js.length > 0 || ls.length > 0) && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["จำนวน Job", String(js.length)], ["ปิดขายแล้ว", baht(total)], ["กำลังเสนอ", baht(pipeline)], ["ติดต่อครั้งแรก", first ? dateTh(first) : "-"]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10.5px] font-semibold text-slate-500">{l}</p><p className="text-[14px] font-bold text-slate-900">{v}</p></div>
            ))}
          </div>
          <ul className="space-y-1.5">
            {js.map((j) => {
              const s = currentStep(j);
              return (
                <li key={j.id}>
                  <button onClick={() => onJob(j.id)} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-indigo-300">
                    <span className="min-w-0 flex-1"><b className="block truncate text-slate-800">{j.customer} · {WORK_LABEL[j.work]}</b><span className="text-[10.5px] text-slate-500">{j.id} · {MODEL_LABEL[j.model]} · {j.cancelReason ? `ยกเลิก: ${j.cancelReason}` : s ? `ขั้น: ${s.label}` : "จบงาน อยู่ในประกัน"}</span></span>
                    <b className="shrink-0 text-slate-700">{valueText(j)}</b>
                  </button>
                </li>
              );
            })}
            {ls.filter((l) => !js.some((j) => j.leadId === l.id)).map((l) => (
              <li key={l.id}>
                <button onClick={() => onLead(l.id)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-left hover:border-indigo-300">
                  <span className="min-w-0 flex-1"><b className="block truncate text-slate-800">{l.name} · Lead</b><span className="text-[10.5px] text-slate-500">{l.id} · {l.channel} · {l.product}</span></span>
                  <span className="shrink-0 text-[10.5px] font-semibold text-slate-500">{l.status}</span>
                </button>
              </li>
            ))}
          </ul>
          {next?.s && <p className="rounded-xl bg-indigo-50 p-3 text-indigo-900"><b>ขั้นต่อไปที่ควรทำ:</b> {next.s.label} ของ {next.j.customer}</p>}
          <div>
            <p className="mb-1 text-[11.5px] font-bold text-slate-700">โปรโมชั่นที่เสนอลูกค้ารายนี้ได้</p>
            <PromoList works={works} />
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- 5) Flow และแบบฟอร์ม ---------------- */
interface FlowDef { key: string; title: string; when: string; steps: string[]; forms: { name: string; note: string }[] }
const FLOWS: FlowDef[] = [
  { key: "product", title: "ลูกค้าซื้อสินค้าอย่างเดียว", when: "ไม่ต้องการแบบหรือติดตั้ง", steps: ["คีย์ Lead เลือกสินค้า และเลือก “ซื้อสินค้าอย่างเดียว”", "ระบบแนะนำร้านที่รับพื้นที่", "กด “ส่งให้ร้าน” ให้ร้านทำใบเสนอราคาในระบบร้าน", "ติดตามผล Win/Loss จากร้าน"], forms: [{ name: "ฟอร์มส่ง Lead ให้ร้าน", note: "ในหน้า Lead ปุ่ม “ส่งให้ร้าน”" }] },
  { key: "design", title: "ลูกค้าต้องการออกแบบ (Solution)", when: "ออกแบบพร้อมขายสินค้า / มีงานบริการ", steps: ["คีย์ Lead แล้วสกรีน 3 ข้อ (งบ พื้นที่ ความพร้อม)", "เปิด Opp กรอกใบเปิดงาน (อะเส ทรัส กระเบื้อง)", "ส่งห้องแบบขีดแนวอะเส / ทำแบบทรัส (ถ้ามี)", "เสนอราคาจากแบบ → รับมัดจำ + ล็อกคิวสำรวจ → สำรวจ → เสนอราคาหลังสำรวจ → ปิดขาย"], forms: [{ name: "ใบเปิดงาน (Opp 3 ขั้น)", note: "เมนู งาน (Opp) → เปิด Opp ใหม่" }, { name: "ขอ BOQ สินค้า DECAAR", note: "แอปหลัก เมนู BOQ (ห้องแบบรับงาน)" }] },
  { key: "smart", title: "Smart Solution / BA", when: "งานสำรวจก่อนเสนอราคา", steps: ["คีย์ Lead แล้วสกรีน", "เปิด Opp สำรวจ ปิดสำรวจ (เก็บค่าสำรวจ)", "ล็อกคิว + ส่งงานให้ทีมสำรวจ", "รับรายงานสำรวจ → เสนอราคา → ปิดขาย (หักค่าสำรวจ)"], forms: [{ name: "Opp สำรวจ", note: "เมนู งาน (Opp) → เปิด Opp สำรวจ" }] },
  { key: "refund", title: "ลูกค้าขอคืนเงิน", when: "คืนภาษีหัก ณ ที่จ่าย (WHT) / คืนเต็มจำนวน / คืนบางส่วน", steps: ["พนักงานขายกรอกแบบฟอร์ม แนบเอกสาร", "ผู้อนุมัติ (Area) อนุมัติ", "Finance ดำเนินการในระบบ", "บัญชีรับเอกสารตัวจริงและโอนเงิน → แจ้งลูกค้า"], forms: [{ name: "แบบฟอร์มแจ้งขอคืนเงิน", note: "แอปหลัก เมนูแบบฟอร์ม · WHT ต้องส่งเอกสารตัวจริงก่อนวันที่ 25 ของเดือน" }] },
  { key: "after", title: "ลูกค้าแจ้งปัญหาหลังติดตั้ง", when: "น้ำรั่ว งานไม่เรียบร้อย อยู่ในประกัน", steps: ["ตรวจใบรับประกันและวันหมดประกัน", "เปิดเคลมในหน้า งานหลังขาย", "KIM นัดตรวจ ติดตามผล และแจ้งลูกค้าทางแชท"], forms: [{ name: "แจ้งปัญหา/เคลม", note: "เมนู งานหลังขาย → ปุ่มแจ้งปัญหา/เคลม" }] },
];
export function FlowGuide({ pick }: { pick?: string }) {
  const [k, setK] = useState(pick ?? FLOWS[1].key);
  const f = FLOWS.find((x) => x.key === k) ?? FLOWS[1];
  return (
    <div className="space-y-3 text-[12px]">
      <div className="flex flex-wrap gap-1.5">
        {FLOWS.map((x) => <button key={x.key} onClick={() => setK(x.key)} className={cn("rounded-full border px-3 py-1.5 font-semibold transition", k === x.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300")}>{x.title}</button>)}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] text-slate-500">ใช้เมื่อ: {f.when}</p>
        <ol className="mt-2 space-y-1.5">
          {f.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10.5px] font-bold text-indigo-700">{i + 1}</span><span className="text-slate-700">{s}</span></li>)}
        </ol>
      </div>
      <div className="space-y-1.5">
        <p className="text-[11.5px] font-bold text-slate-700">แบบฟอร์มที่ใช้</p>
        {f.forms.map((x) => <div key={x.name} className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2"><Icon name="description" className="!text-[18px] text-amber-600" /><span><b className="text-slate-900">{x.name}</b><span className="block text-[11px] text-slate-600">{x.note}</span></span></div>)}
      </div>
      <Note>ขั้นตอนอ้างอิงจาก Project Timeline และ Flow ที่ทีมกำหนด · ชื่อแบบฟอร์มเป็นตัวอย่าง รอยืนยันกับเจ้าของแต่ละแบบฟอร์ม</Note>
    </div>
  );
}

/* ---------------- 6) โอกาสขาย ---------------- */
export function OpportunityList({ jobs, leads, onJob, onLead }: { jobs: Job[]; leads: Lead[]; onJob: (id: string) => void; onLead: (id: string) => void }) {
  const hot = jobs.filter((j) => !j.cancelReason && !j.done.close && j.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  const warm = leads.filter((l) => l.status === "qualified" && !jobs.some((j) => j.leadId === l.id)).slice(0, 4);
  return (
    <div className="space-y-2 text-[12px]">
      <p className="text-[11.5px] font-bold text-slate-700">งานที่ยังไม่ปิดขาย เรียงตามมูลค่า</p>
      {hot.map((j) => <button key={j.id} onClick={() => onJob(j.id)} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-indigo-300"><span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{j.customer}<span className="ml-1 font-normal text-slate-400">{currentStep(j)?.label}</span></span><b className="shrink-0 text-slate-700">{baht(j.value)}</b></button>)}
      {warm.length > 0 && <p className="pt-1 text-[11.5px] font-bold text-slate-700">Lead ที่ผ่านสกรีนแล้วแต่ยังไม่เปิด Opp</p>}
      {warm.map((l) => <button key={l.id} onClick={() => onLead(l.id)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-left hover:border-indigo-300"><span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{l.name}<span className="ml-1 font-normal text-slate-400">{l.province}</span></span><span className="shrink-0 text-[10.5px] text-slate-500">รอเปิด Opp</span></button>)}
    </div>
  );
}
