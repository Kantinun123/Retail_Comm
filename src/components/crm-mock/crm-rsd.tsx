"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { dateTh, type Job } from "./crm-mock-data";
import { btnGhost, btnPrimary, inputCls } from "./crm-ui";

/* หน้าประมาณการแบบ Roof Smart Design (RSD) — ตัวเลขตั้งต้นจากไฟล์ตัวอย่าง (พื้นที่ 239.91 ตร.ม. ลาด 29°) */
const BASE_AREA = 239.92;
const ITEMS: { ean: string; name: string; qty: number; unit: string; perArea: boolean }[] = [
  { ean: "8852422143344", name: "ก/บ คอนกรีต SCG C สมูทพลัส+ สีชาโดว์ เกรย์", qty: 2571, unit: "แผ่น", perArea: true },
  { ean: "8852422143351", name: "ครอบสันโค้ง สมูทพลัส+ สีชาโดว์ เกรย์", qty: 184, unit: "แผ่น", perArea: false },
  { ean: "8852422143399", name: "ครอบโค้งหางมน สมูทพลัส+ สีชาโดว์ เกรย์", qty: 6, unit: "แผ่น", perArea: false },
  { ean: "8852422143412", name: "ครอบโค้ง 3 ทาง สมูทพลัส+ สีชาโดว์ เกรย์", qty: 4, unit: "แผ่น", perArea: false },
  { ean: "8852422040346", name: "แผ่นสะท้อนความร้อน ซี-โค่ 60 ม.", qty: 4, unit: "ม้วน", perArea: true },
  { ean: "8852422124848", name: "แผ่นปิดตะเข้ ซี-โค่", qty: 3, unit: "ม้วน", perArea: false },
  { ean: "8852422040339", name: "แป ซี-โค่ 4 ม.", qty: 206, unit: "ท่อน", perArea: true },
  { ean: "8852422107889", name: "ตะปูเกลียวยึดแป ซี-โค่", qty: 7, unit: "กล่อง", perArea: true },
  { ean: "8852422098026", name: "วัสดุปรับระดับแป เอสซีจี", qty: 7, unit: "กล่อง", perArea: true },
  { ean: "8852422107155", name: "ตะปูเกลียวปลายสว่าน ซีโค่ 2.5 นิ้ว", qty: 11, unit: "กล่อง", perArea: true },
  { ean: "8852422093823", name: "ขอยึดเชิงชายกัลวาไนซ์ SCG", qty: 5, unit: "กล่อง", perArea: false },
  { ean: "8852422108466", name: "แหนบยึดกระเบื้องเศษ ซีโค่", qty: 5, unit: "กล่อง", perArea: false },
  { ean: "8852422004959", name: "แผ่นปิดเชิงชาย เอสซีจี ลอนเซ็นจูเรียน (สกรู)", qty: 12, unit: "กล่อง", perArea: false },
  { ean: "8852422077298", name: "แผ่นปิดรอยต่อซี-โค่ ขนาด 28 ซม. x 40 ซม.", qty: 2, unit: "แผ่น", perArea: false },
  { ean: "8852422081141", name: "ดรายเทคซิสเท็ม ซี-โค่", qty: 4, unit: "กล่อง", perArea: false },
  { ean: "8852422108923", name: "ดรายเทคซิสเท็ม ซี-โค่ สำหรับตะเข้สัน", qty: 14, unit: "กล่อง", perArea: false },
  { ean: "8852422126033", name: "กัลวาไนซ์รองใต้ครอบ ซีไลน์ 3m SCG EMBOSS", qty: 3, unit: "ท่อน", perArea: false },
  { ean: "8852422008810", name: "รางน้ำตะเข้อลูซิงค์ SCG 12x3ซม ปีก 12ซม", qty: 6, unit: "ท่อน", perArea: false },
  { ean: "8852422112425", name: "สีทาปูนใต้ครอบ SCG ชาโดว์ เกรย์", qty: 1, unit: "กระป๋อง", perArea: false },
  { ean: "8852404093612", name: "ไม้เชิงชายวันพีช SCG 23x300x2.1 ซีเมนต์ใหม่", qty: 25, unit: "แผ่น", perArea: false },
  { ean: "8852404069532", name: "ตะปูเกลียวปลายสว่านมีปีก เอสซีจี 60 มม.", qty: 2, unit: "กล่อง", perArea: false },
];
const LABOR: [string, number, string, boolean][] = [
  ["ค่ารับจ้างมุงกระเบื้อง", 239.92, "ตร.ม.", true], ["ครอบสัน", 8.5, "ม.", false], ["ครอบตะเข้สัน", 47, "ม.", false], ["รางน้ำตะเข้", 9.09, "ม.", false],
  ["ติดตั้งแป", 239.92, "ตร.ม.", true], ["ติดตั้งแผ่นสะท้อนความร้อน", 239.92, "ตร.ม.", true], ["ติดตั้งแผ่นปิดเชิงชาย", 66.94, "ม.", false], ["ติดตั้งไม้เชิงชาย", 66.93, "ม.", false],
];
const SUMMARY: [string, string][] = [["ความยาวตะเข้สัน", "47 ม."], ["ความยาวสันหลังคา", "8.50 ม."], ["ความยาวตะเข้ราง", "9.09 ม."], ["ความยาวเชิงชาย", "66.93 ม."], ["ความสูงหลังคา", "6.78 ม."]];
const COLORS = ["สมูทพลัส ชาโดว์ เกรย์", "สมูทพลัส ริช บราวน์", "สมูทพลัส อาร์คติก ไวท์"];

/* แปลนหลังคาทรงปั้นหยา (วาดย่อจากแปลนตัวอย่าง 12.98 x 16.48 ม.) */
function PlanSvg() {
  const L = "stroke-slate-800";
  return (
    <svg viewBox="0 0 320 380" className="mx-auto h-[340px] w-auto">
      <g fill="none" strokeWidth={1.4} className={L}>
        <polyline points="30,20 290,20 290,330 30,330 30,20" />
        <line x1="30" y1="20" x2="160" y2="140" /><line x1="290" y1="20" x2="160" y2="140" />
        <line x1="160" y1="140" x2="100" y2="200" /><line x1="160" y1="140" x2="220" y2="200" />
        <polyline points="100,200 100,280 30,330" /><polyline points="220,200 220,280 290,330" />
        <line x1="100" y1="280" x2="140" y2="330" /><line x1="220" y1="280" x2="180" y2="330" />
        <polyline points="140,330 140,250 180,250 180,330" />
        <line x1="100" y1="200" x2="140" y2="250" /><line x1="220" y1="200" x2="180" y2="250" />
      </g>
      <g strokeDasharray="4 4" strokeWidth={0.6} className="stroke-slate-400">
        {[60, 125, 195, 260].map((x) => <line key={x} x1={x} y1="5" x2={x} y2="360" />)}
        {[40, 110, 175, 240, 310].map((y) => <line key={y} x1="10" y1={y} x2="310" y2={y} />)}
      </g>
      <g className="fill-slate-700" fontSize="9">
        <text x="150" y="14">12.98</text><text x="2" y="180">16.48</text><text x="292" y="180">16.48</text>
        <text x="80" y="80">9.48</text><text x="220" y="80">9.48</text><text x="112" y="175">4.94</text><text x="190" y="175">4.94</text>
        <text x="65" y="345">5.98</text><text x="225" y="345">5.98</text><text x="148" y="245">1.02</text>
      </g>
      <g fontSize="8" className="fill-indigo-600">{["A", "B", "C", "4"].map((t, i) => <text key={t} x={[60, 125, 195, 260][i] - 3} y="375">{t}</text>)}</g>
    </svg>
  );
}

export function RsdEstimate({ job, onClose, onDeliver, readOnly }: { job: Job; onClose: () => void; onDeliver?: () => void; readOnly?: boolean }) {
  const [tab, setTab] = useState<"plan" | "boq" | "labor">("plan");
  const [area, setArea] = useState(String(BASE_AREA));
  const [slope, setSlope] = useState("29");
  const [color, setColor] = useState(COLORS[0]);
  const a = Number(area) || BASE_AREA;
  const k = a / BASE_AREA;
  const items = ITEMS.map((it) => ({ ...it, name: it.name.replace(COLORS[0].replace("สมูทพลัส ", "สี"), color.replace("สมูทพลัส ", "สี")), qty: it.perArea ? Math.ceil(it.qty * k) : it.qty }));
  const changed = Math.abs(k - 1) > 0.001;
  const csv = () => {
    const rows = [["ลำดับ", "EAN CODE", "Product Name", "จำนวน", "Unit"], ...items.map((x, i) => [String(i + 1), x.ean, x.name, String(x.qty), x.unit])];
    const blob = new Blob(["\uFEFF" + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const u = URL.createObjectURL(blob); const el = document.createElement("a"); el.href = u; el.download = `BOQ_${job.opsId}.csv`; el.click(); URL.revokeObjectURL(u);
  };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate-900/60 p-2 backdrop-blur-sm md:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* แถบบนแบบ RSD */}
        <div className="flex flex-wrap items-center gap-2 bg-[#1f2a44] px-4 py-2.5 text-white">
          <Icon name="roofing" className="!text-[22px] text-sky-300" />
          <b className="text-[14px]">Roof Smart Design</b><span className="text-[11px] text-slate-300">· จำลองหน้าประมาณการ (ข้อมูลส่งมาจาก CRM)</span>
          <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-[11px]">Job No. {job.opsId} · BOQ Revision 1</span>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="ปิด"><Icon name="close" className="!text-[20px]" /></button>
        </div>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[260px_1fr]">
          {/* แผงข้อมูลงาน */}
          <aside className="space-y-3 border-b border-slate-200 bg-slate-50 p-4 text-[12px] md:border-b-0 md:border-r">
            <p className="font-bold text-slate-700">ข้อมูลจาก CRM</p>
            <dl className="space-y-1">
              {([["Client", job.customer], ["Location", job.province], ["Solution", "Total Roof"], ["ช่องทาง", job.store ?? "-"], ["Designed Date", dateTh(new Date().toISOString())]] as [string, string][]).map(([kk, v]) => <div key={kk} className="flex justify-between gap-2"><dt className="text-slate-500">{kk}</dt><dd className="truncate text-right font-semibold text-slate-800">{v}</dd></div>)}
            </dl>
            <p className="pt-1 font-bold text-slate-700">Roof Component</p>
            <label className="block"><span className="text-slate-500">พื้นที่หลังคา (ตร.ม.)</span><input disabled={readOnly} inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value.replace(/[^\d.]/g, ""))} className={cn(inputCls, "mt-0.5 text-right tabular-nums")} /></label>
            <label className="block"><span className="text-slate-500">ความลาด (องศา)</span><input disabled={readOnly} inputMode="numeric" value={slope} onChange={(e) => setSlope(e.target.value.replace(/[^\d]/g, ""))} className={cn(inputCls, "mt-0.5 text-right tabular-nums")} /></label>
            <label className="block"><span className="text-slate-500">Assign Tile: CPAC Smooth Plus</span><select disabled={readOnly} value={color} onChange={(e) => setColor(e.target.value)} className={cn(inputCls, "mt-0.5")}>{COLORS.map((c) => <option key={c}>{c}</option>)}</select></label>
            {changed && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800">คำนวณจำนวนสินค้าและค่าแรงตามพื้นที่ใหม่แล้ว</p>}
            {Number(slope) < 17 && <p className="rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700">ความลาดต่ำกว่า 17° ไม่แนะนำสำหรับกระเบื้องคอนกรีต</p>}
          </aside>
          <section className="min-w-0 p-4">
            <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1 text-[12px] font-bold">
              {([["plan", "Generate Drawing"], ["boq", `BOQ สินค้า (${items.length})`], ["labor", "รายการแรงงาน"]] as const).map(([kk, l]) => <button key={kk} onClick={() => setTab(kk)} className={cn("flex-1 rounded-lg px-3 py-1.5", tab === kk ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500")}>{l}</button>)}
            </div>
            {tab === "plan" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 p-3"><PlanSvg /></div>
                <p className="text-[12px] font-semibold text-slate-700">กระเบื้องหลังคา ซีแพค smooth plus {color}</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] md:grid-cols-3">
                  <div className="flex justify-between"><span className="text-slate-500">พ.ท.หลังคา</span><b className="tabular-nums">{a.toFixed(2)} ตร.ม.</b></div>
                  <div className="flex justify-between"><span className="text-slate-500">ความชัน</span><b className="tabular-nums">{slope} องศา</b></div>
                  {SUMMARY.map(([kk, v]) => <div key={kk} className="flex justify-between"><span className="text-slate-500">{kk}</span><b className="tabular-nums">{v}</b></div>)}
                </div>
                <p className="text-[10.5px] text-slate-400">เงื่อนไข: รายการประมาณการเป็นการคิดปริมาณจากแบบ ระยะในแบบอาจคลาดเคลื่อนจากการย่อ-ขยาย ควรตรวจสอบหน้างานอีกครั้ง</p>
              </div>
            )}
            {tab === "boq" && (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead><tr className="bg-slate-100 text-left text-slate-600"><th className="px-2 py-1.5">ลำดับ</th><th className="px-2 py-1.5">EAN CODE</th><th className="px-2 py-1.5">Product Name</th><th className="px-2 py-1.5 text-right">จำนวน</th><th className="px-2 py-1.5">Unit</th></tr></thead>
                  <tbody>{items.map((x, i) => <tr key={x.ean} className="border-b border-slate-100"><td className="px-2 py-1 text-slate-400">{i + 1}</td><td className="px-2 py-1 tabular-nums text-slate-600">{x.ean}</td><td className="px-2 py-1 text-slate-800">{x.name}</td><td className={cn("px-2 py-1 text-right font-semibold tabular-nums", x.perArea && changed && "text-amber-700")}>{x.qty.toLocaleString("en-US")}</td><td className="px-2 py-1">{x.unit}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {tab === "labor" && (
              <table className="w-full text-[12px]">
                <thead><tr className="bg-slate-100 text-left text-slate-600"><th className="px-2 py-1.5">รายการแรงงาน</th><th className="px-2 py-1.5 text-right">ปริมาณ</th><th className="px-2 py-1.5">หน่วย</th></tr></thead>
                <tbody>{LABOR.map(([n, q, u, per]) => <tr key={n} className="border-b border-slate-100"><td className="px-2 py-1">{n}</td><td className="px-2 py-1 text-right font-semibold tabular-nums">{(per ? a : q).toFixed(2)}</td><td className="px-2 py-1">{u}</td></tr>)}</tbody>
              </table>
            )}
          </section>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <button onClick={csv} className={btnGhost}><Icon name="download" style={{ fontSize: 17 }} />ส่งออก BOQ (CSV)</button>
          <span className="text-[11px] text-slate-400">ผลประมาณการ (แปลน + BOQ + แรงงาน) ส่งกลับ CRM เพื่อออกใบเสนอราคา / ส่งรายการสินค้าให้ร้าน</span>
          {onDeliver && !readOnly && <button onClick={onDeliver} className={cn(btnPrimary, "ml-auto")}><Icon name="upload_file" style={{ fontSize: 17 }} />ส่งผลประมาณการกลับ CRM</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ปุ่มเปิดหน้าประมาณการ ใช้ใน drawer งาน */
export function RsdButton({ job, label = "ดูประมาณการ (RSD)" }: { job: Job; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}><Icon name="roofing" style={{ fontSize: 16 }} />{label}</button>
      {open && <RsdEstimate job={job} onClose={() => setOpen(false)} readOnly />}
    </>
  );
}
