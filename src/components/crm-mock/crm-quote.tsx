"use client";

import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { CHANNEL_DISCOUNT, MODEL_LABEL, NOW, SCG_COMMISSION_PCT, baht, channelNet, dateTh, type Job, type QuoteVer } from "./crm-mock-data";
import { btnGhost, btnPrimary, inputCls } from "./crm-ui";

/* ตัวอย่างอิงใบเสนอราคาจริง: ราคาสินค้า+ติดตั้ง 230,890.62 -> ลดโปร 4% -> VAT 7% -> 237,170.84 */
const PACKAGES = [
  { id: "complete", name: "Complete Roof", warranty: "รับประกันงานมุง 5 ปี", mult: 1.12, perks: "ครอบคลุมแผ่นสะท้อนความร้อน + งานรางน้ำ + ตรวจเช็กฟรี 2 ครั้ง" },
  { id: "standard", name: "Standard Roof", warranty: "รับประกันงานมุง 2 ปี", mult: 1, perks: "ตามประมาณการ (กระเบื้อง แป ไม้เชิงชาย แผ่นสะท้อนความร้อน)" },
  { id: "basic", name: "Basic Roof", warranty: "รับประกันงานมุง 1 ปี", mult: 0.93, perks: "งานมุงและอุปกรณ์พื้นฐาน ไม่รวมแผ่นสะท้อนความร้อน" },
];
interface Promo { id: string; name: string; save: (g: number) => number; hint?: (g: number) => string | null }
const PROMOS: Promo[] = [
  { id: "p4", name: "ส่วนลด 4% ปิดงานภายใน 30 วัน", save: (g) => g * 0.04 },
  { id: "p6", name: "ส่วนลด 6% เมื่อซื้อครบ 250,000 บาท", save: (g) => (g >= 250000 ? g * 0.06 : 0), hint: (g) => (g < 250000 ? `เพิ่มอีก ${baht(Math.ceil(250000 - g))} จะได้ลด 6% (ประหยัด ${baht(Math.round(250000 * 0.06))})` : null) },
  { id: "pf", name: "ฟรีแผ่นสะท้อนความร้อน (มูลค่า 8,500)", save: () => 8500 },
  { id: "none", name: "ไม่ใช้โปรโมชั่น", save: () => 0 },
];
const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcQuote(job: Job, pkgId: string, promoId: string, prep: number) {
  const base = r2(((job.quote1Value ?? job.value) / 1.07) / 0.96);
  const pkg = PACKAGES.find((p) => p.id === pkgId) ?? PACKAGES[1];
  const gross = r2(base * pkg.mult);
  const promo = PROMOS.find((p) => p.id === promoId) ?? PROMOS[3];
  const disc = r2(Math.min(promo.save(gross), gross));
  const after = r2(Math.max(gross - disc - prep, 0));
  const vat = r2(after * 0.07);
  const total = r2(after + vat);
  return { gross, disc, after, vat, total, pkg, promo };
}

export function QuoteBuilder({ job, onPatchJob, toast }: { job: Job; onPatchJob: (id: string, fn: (j: Job) => Job) => void; toast: (m: string) => void }) {
  const [pkgId, setPkgId] = useState("standard");
  const [promoId, setPromoId] = useState<string | null>(null);
  const [prep, setPrep] = useState(0);
  const [view, setView] = useState<"cus" | "agent">("cus");
  const [poAmt, setPoAmt] = useState("");

  const ranked = PROMOS.filter((p) => p.id !== "none").map((p) => ({ p, s: p.save(calcQuote(job, pkgId, "none", 0).gross) })).sort((a, b) => b.s - a.s);
  const best = ranked[0]?.p.id ?? "none";
  const pid = promoId ?? best;
  const q = calcQuote(job, pkgId, pid, prep);
  const hasAgent = job.model !== "scg";
  const agentNet = channelNet(q.total, job.model);
  const vers = job.quotes ?? [];
  const last = vers[vers.length - 1];

  const save = (send: boolean) => {
    const at = NOW.toISOString();
    const v: QuoteVer = { v: vers.length + 1, pkg: q.pkg.name, promo: q.promo.name, prep, gross: q.gross, total: q.total, agentNet: hasAgent ? agentNet : undefined, at, sent: send };
    onPatchJob(job.id, (j) => ({ ...j, lastTouchAt: at, quotes: [...(j.quotes ?? []), v], log: [...j.log, { at, text: `${send ? "ส่ง" : "บันทึก"}ใบเสนอราคา V${v.v} (${v.pkg}) ยอด ${baht(v.total)}${hasAgent ? ` · ใบตัวแทน ${baht(agentNet)}` : ""}` }] }));
    toast(`${send ? "ส่ง" : "บันทึก"}ใบเสนอราคา V${v.v} แล้ว`);
  };
  const diff = (v: QuoteVer, p?: QuoteVer) => (p ? v.total - p.total : 0);
  const po = Number(poAmt.replace(/,/g, ""));
  const poOk = po > 0 && Math.abs(po - agentNet) < 1;

  return (
    <div className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-4 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[13.5px] text-slate-900"><Icon name="request_quote" className="!text-[18px] align-middle text-indigo-600" /> สร้างใบเสนอราคา</b>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">{MODEL_LABEL[job.model]}</span>
        <span className="text-[11px] text-slate-400">{hasAgent ? "ประมาณการเดียว ออกได้ 2 ใบ: ลูกค้า + ตัวแทน" : "ใบเสนอราคาลูกค้า (ชำระผ่าน CRM)"}</span>
      </div>

      <div>
        <p className="mb-1 font-semibold text-slate-600">เปรียบเทียบแพ็กเกจ</p>
        <div className="grid gap-2 md:grid-cols-3">
          {PACKAGES.map((p) => {
            const t = calcQuote(job, p.id, pid, prep).total;
            return (
              <button key={p.id} type="button" onClick={() => setPkgId(p.id)} className={cn("rounded-xl border p-2.5 text-left transition", pkgId === p.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-300")}>
                <b className="block text-slate-900">{p.name}</b><span className="text-[10.5px] font-semibold text-indigo-700">{p.warranty}</span>
                <span className="mt-1 block text-[10.5px] text-slate-500">{p.perks}</span>
                <span className="mt-1 block text-[15px] font-bold text-slate-900">{baht(t)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1 font-semibold text-slate-600">โปรโมชั่น (เรียงจากประหยัดสูงสุด)</p>
        <div className="space-y-1.5">
          {ranked.map(({ p, s }, i) => (
            <label key={p.id} className={cn("flex cursor-pointer items-start gap-2 rounded-xl border p-2.5", pid === p.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200")}>
              <input type="radio" checked={pid === p.id} onChange={() => setPromoId(p.id)} className="mt-0.5 accent-emerald-600" />
              <span className="min-w-0 flex-1"><b className="text-slate-900">{p.name}</b>{i === 0 && s > 0 && <span className="ml-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">ประหยัดสูงสุด</span>}
                <span className="block text-[11px] text-slate-500">ประหยัด {s > 0 ? baht(Math.round(s)) : "ยังไม่เข้าเงื่อนไข"}</span>
                {p.hint?.(q.gross) && <span className="block text-[11px] font-semibold text-amber-700">แนะนำ: {p.hint(q.gross)}</span>}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 text-slate-500"><input type="radio" checked={pid === "none"} onChange={() => setPromoId("none")} className="accent-slate-500" />ไม่ใช้โปรโมชั่น</label>
        </div>
      </div>

      <label className="flex items-center gap-2"><span className="font-semibold text-slate-600">ส่วนลดค่าเตรียมการ (บาท)</span>
        <input inputMode="numeric" value={prep ? prep.toLocaleString("en-US") : ""} onChange={(e) => setPrep(Number(e.target.value.replace(/[^\d]/g, "")) || 0)} placeholder="0" className={cn(inputCls, "!w-32 text-right tabular-nums")} />
      </label>

      {hasAgent && (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-[11.5px] font-bold">
          {([["cus", "ใบลูกค้า"], ["agent", "ใบตัวแทน (PO)"]] as const).map(([k, l]) => <button key={k} onClick={() => setView(k)} className={cn("flex-1 rounded-lg px-3 py-1.5", view === k ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500")}>{l}</button>)}
        </div>
      )}
      <dl className="space-y-1 rounded-xl bg-slate-50 p-3">
        {([["ค่าสินค้าและบริการติดตั้ง", q.gross], [`ส่วนลดโปรโมชั่น`, -q.disc], ...(prep ? [["ส่วนลดค่าเตรียมการ", -prep] as [string, number]] : []), ["ยอดหลังหักส่วนลด", q.after], ["VAT 7%", q.vat]] as [string, number][]).map(([k, v]) => (
          <div key={k} className="flex justify-between"><dt className="text-slate-500">{k}</dt><dd className={cn("tabular-nums", v < 0 ? "text-emerald-700" : "text-slate-800")}>{baht(v)}</dd></div>
        ))}
        <div className="flex justify-between border-t border-slate-200 pt-1 text-[13px] font-bold"><dt>ยอดรวมสุทธิ (ลูกค้า)</dt><dd className="tabular-nums text-indigo-700">{baht(q.total)}</dd></div>
        {hasAgent && view === "agent" && (
          <>
            <div className="flex justify-between text-emerald-700"><dt>ส่วนลดช่องทาง {CHANNEL_DISCOUNT[job.model]}%</dt><dd className="tabular-nums">-{baht(r2(q.total - agentNet))}</dd></div>
            <div className="flex justify-between text-[13px] font-bold"><dt>ร้านชำระ SCG ตาม PO</dt><dd className="tabular-nums">{baht(agentNet)}</dd></div>
          </>
        )}
        {!hasAgent && <p className="pt-1 text-[11px] text-slate-500">SCG Home: ไม่มีส่วนลดช่องทาง · ร้านได้คอมมิชชั่น {SCG_COMMISSION_PCT}% ภายหลัง ≈ {baht(Math.round(q.after * SCG_COMMISSION_PCT) / 100)}</p>}
      </dl>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => save(false)} className={btnGhost}><Icon name="save" style={{ fontSize: 17 }} />บันทึกเป็นเวอร์ชันใหม่</button>
        <button onClick={() => save(true)} className={btnPrimary}><Icon name="send" style={{ fontSize: 17 }} />บันทึกและส่งให้ลูกค้า</button>
      </div>

      {vers.length > 0 && (
        <div>
          <p className="mb-1 font-semibold text-slate-600">ประวัติเวอร์ชัน</p>
          <ul className="space-y-1">
            {vers.map((v, i) => { const d = diff(v, vers[i - 1]); return (
              <li key={v.v} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <b className="text-slate-900">V{v.v}</b><span className="text-slate-600">{v.pkg}</span><span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{v.promo}{v.prep ? ` · เตรียมการ -${baht(v.prep)}` : ""}</span>
                <span className="tabular-nums font-semibold">{baht(v.total)}</span>
                {i > 0 && <span className={cn("text-[11px] font-bold", d < 0 ? "text-emerald-600" : d > 0 ? "text-rose-600" : "text-slate-400")}>{d === 0 ? "ไม่เปลี่ยน" : `${d > 0 ? "+" : ""}${baht(r2(d))}`}</span>}
                <span className="text-[10.5px] text-slate-400">{v.sent ? "ส่งแล้ว" : "ฉบับร่าง"} · {dateTh(v.at)}</span>
              </li>
            ); })}
          </ul>
        </div>
      )}

      {hasAgent && last && (
        <div className="space-y-1.5 rounded-xl border border-sky-200 bg-sky-50 p-3">
          <p className="font-bold text-sky-900">ตรวจ PO จากร้านกับใบตัวแทน V{last.v}</p>
          <div className="flex items-center gap-2"><span className="text-slate-600">ยอด PO ที่ร้านส่งมา</span><input inputMode="decimal" value={poAmt} onChange={(e) => setPoAmt(e.target.value)} placeholder={String(last.agentNet ?? "")} className={cn(inputCls, "!w-36 text-right tabular-nums")} /></div>
          {poAmt && (poOk ? <p className="font-semibold text-emerald-700">ยอดตรงกับใบตัวแทน ({baht(last.agentNet ?? 0)})</p> : <p className="font-semibold text-rose-600">ยอดไม่ตรง ต่างกัน {baht(r2(Math.abs(po - (last.agentNet ?? 0))))} · ให้ร้านตรวจเวอร์ชันของใบเสนอราคา</p>)}
        </div>
      )}
    </div>
  );
}
