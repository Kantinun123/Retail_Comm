"use client";
/* ตารางพื้นที่รับงานของร้าน: ใช้จ่าย Lead ออนไลน์เข้าร้านตามตำบล/อำเภอ/จังหวัด (เดโมมีระดับอำเภอ) ผู้ดูแลระบบเป็นคนตั้งค่า */
import { useMemo, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { assignStore, type Coverage } from "./crm-mock-data";
import { glass, inputCls } from "./crm-ui";

export function AreasView({ coverage, setCoverage }: { coverage: Coverage[]; setCoverage: (c: Coverage[]) => void }) {
  const provinces = useMemo(() => [...new Set(coverage.map((c) => c.province))], [coverage]);
  const [prov, setProv] = useState(provinces[0] ?? "");
  const [dist, setDist] = useState("");
  const test = assignStore(coverage, prov, dist);
  const overlap = (c: Coverage) => coverage.some((o) => o !== c && o.province === c.province && o.store !== c.store && (o.district ?? "") === (c.district ?? ""));
  const sorted = [...coverage].map((c, i) => ({ c, i })).sort((a, b) => a.c.province.localeCompare(b.c.province, "th") || (a.c.district ?? "").localeCompare(b.c.district ?? "", "th") || a.c.priority - b.c.priority);
  const setPriority = (i: number, p: number) => setCoverage(coverage.map((c, k) => (k === i ? { ...c, priority: Math.max(1, p) } : c)));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">พื้นที่รับงานของร้าน</h1>
        <p className="text-[12.5px] text-slate-500">ใช้จ่าย Lead ออนไลน์เข้าร้านตามพื้นที่หน้างาน ร้านที่ใกล้กันอาจรับพื้นที่ซ้ำ กำหนดลำดับร้านได้ (เลขน้อย = ได้ก่อน) ผู้ดูแลระบบเป็นคนตั้งค่า</p>
      </div>
      <div className={cn(glass, "p-4")}>
        <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="science" style={{ fontSize: 18 }} />ทดลองจ่าย Lead</div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={prov} onChange={(e) => setProv(e.target.value)} className={cn(inputCls, "w-auto")}>{provinces.map((p) => <option key={p}>{p}</option>)}</select>
          <input value={dist} onChange={(e) => setDist(e.target.value)} placeholder="อำเภอ (ถ้ามี) เช่น หาดใหญ่" className={cn(inputCls, "w-56")} />
          <span className={cn("rounded-xl px-3 py-2 text-[12.5px]", test.store ? "bg-indigo-50 text-indigo-800" : "bg-amber-50 text-amber-800")}>
            {test.store ? <>จ่ายให้ <b>{test.store}</b>{test.candidates.length > 1 && <span className="text-slate-500"> · ถัดไป: {test.candidates.slice(1).join(", ")}</span>}</> : "ไม่มีร้านรับพื้นที่นี้"}
          </span>
        </div>
      </div>
      <div className={cn(glass, "overflow-x-auto")}>
        <table className="w-full min-w-[640px] text-left text-[12.5px]">
          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500"><tr>{["จังหวัด", "อำเภอ", "ร้าน", "ลำดับจ่ายงาน", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {sorted.map(({ c, i }) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-semibold text-slate-800">{c.province}</td>
                <td className="px-4 py-2.5 text-slate-500">{c.district ?? "ทั้งจังหวัด"}</td>
                <td className="px-4 py-2.5">{c.store}</td>
                <td className="px-4 py-2.5"><input type="number" min={1} value={c.priority} onChange={(e) => setPriority(i, Number(e.target.value) || 1)} className={cn(inputCls, "w-20 !py-1.5")} /></td>
                <td className="px-4 py-2.5">{overlap(c) && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">พื้นที่ซ้ำกับร้านอื่น</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
