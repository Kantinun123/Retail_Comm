"use client";

/* =============================================================
   หน้าหลักร้านค้า — ส่วนบน
   - MonthOverview : ภาพรวมเดือนล่าสุด (ผลประโยชน์ร้าน · ยอดขายสินค้า+บริการ · ผลงานร้าน)
   - PerformanceCards : ผลงานร้าน 3 การ์ด (ตรวจประเมิน · ความพึงพอใจ · แบบรับเข้า)
   - AttentionList : เรื่องที่ควรดู (สูงสุด 3 เรื่อง) — เฉพาะเมื่อดูร้านเดียว
   กติกาเรื่องที่ควรดู (ตกลงกับผู้ใช้):
     ผลตรวจล่าสุดไม่ผ่าน / คะแนนตรวจลด ≥ 5 จุด / ข้อที่ตกในการตรวจล่าสุด /
     ยังไม่มีผลตรวจเดือนที่แล้ว (หลังวันที่ 15, ร้านตรวจทุกเดือน) /
     รีวิว < 7 ในเดือนล่าสุด / ความพึงพอใจลด ≥ 5 จุด / แบบรับเข้าลด > 20%
   ============================================================= */
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icon";
import { fetchEvalItems, fetchEvalMonthLines, type EvalSummary } from "@/lib/commission/store-eval-store";
import type { CsSummary } from "@/lib/commission/cust-sat-store";
import type { DiSummary } from "@/lib/commission/design-intake-store";
import { cn } from "@/lib/utils";

const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const pad = (n: number) => String(n).padStart(2, "0");
const monthShort = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_SHORT[m - 1]} ${String(y + 543).slice(-2)}`; };
const prevPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
const curPeriod = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const short = (v: number) => (Math.abs(v) >= 1e6 ? `฿${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `฿${(v / 1e3).toFixed(1)}K` : `฿${Math.round(v).toLocaleString("th-TH")}`);
const pctChange = (cur: number, base: number | null | undefined) => (base ? ((cur - base) / Math.abs(base)) * 100 : null);
const fmtDate = (iso: string | null) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "-");

export interface PeriodAmount { period: string; amount: number }

export interface AttentionItem {
  key: string;
  severity: 1 | 2 | 3;
  icon: string;
  title: string;
  sub: string;
  href: string;
}

/** ข้อที่ตกในการตรวจครั้งล่าสุดของร้าน (ต้องดึง 2 ต่อ: การตรวจของเดือน -> ข้อย่อย) */
export function useLatestEvalFails(dealerCode: string | null, evalSum: EvalSummary | null): string[] | null {
  const latest = evalSum?.latest ?? null;
  const key = dealerCode && latest ? `${dealerCode}|${latest.period}|${latest.evalDate ?? ""}` : null;
  const [state, setState] = useState<{ key: string; fails: string[] } | null>(null);
  useEffect(() => {
    if (!key || !dealerCode || !latest) return;
    let cancelled = false;
    (async () => {
      const lines = await fetchEvalMonthLines(dealerCode, latest.period);
      const line = lines
        .filter((l) => l.dealerCode === dealerCode && l.submissionId)
        .sort((a, b) => String(b.evalDate).localeCompare(String(a.evalDate)))[0];
      if (!line?.submissionId) return [];
      const items = await fetchEvalItems(line.submissionId);
      return [...new Set(items.filter((i) => !i.passed).map((i) => i.itemLabel))];
    })()
      .then((fails) => !cancelled && setState({ key, fails }))
      .catch(() => !cancelled && setState({ key, fails: [] }));
    return () => {
      cancelled = true;
    };
  }, [key, dealerCode, latest]);
  return state && state.key === key ? state.fails : null;
}

/** รวมเรื่องที่ควรดู เรียงตามความสำคัญ */
export function buildAttention(opts: {
  evalSum: EvalSummary | null;
  evalFails: string[] | null;
  csSum: CsSummary | null;
  di: DiSummary | null;
  now?: Date;
}): AttentionItem[] {
  const now = opts.now ?? new Date();
  const out: AttentionItem[] = [];
  const ev = opts.evalSum;
  if (ev && ev.count > 0 && ev.latest) {
    const evals = [...ev.months].sort((a, b) => String(b.evalDate ?? b.period).localeCompare(String(a.evalDate ?? a.period)));
    const latest = ev.latest;
    if (latest.result && latest.result !== "ผ่าน") {
      out.push({ key: "eval-fail", severity: 3, icon: "gpp_bad", title: `ผลตรวจล่าสุด "${latest.result}" (${Math.round(latest.pct * 100)}%)`, sub: `ตรวจเมื่อ ${fmtDate(latest.evalDate)} · กดดูหมวดที่เสียคะแนน`, href: "/app/store-eval" });
    }
    const prev = evals[1];
    if (prev && prev.pct - latest.pct >= 0.05) {
      out.push({ key: "eval-drop", severity: 2, icon: "trending_down", title: `คะแนนตรวจลดลง ${Math.round((prev.pct - latest.pct) * 100)} จุด`, sub: `${Math.round(prev.pct * 100)}% → ${Math.round(latest.pct * 100)}%`, href: "/app/store-eval" });
    }
    if (opts.evalFails && opts.evalFails.length) {
      const [first, ...rest] = opts.evalFails;
      out.push({ key: "eval-items", severity: 2, icon: "cancel", title: `ตกข้อ "${first.length > 40 ? first.slice(0, 40) + "…" : first}"${rest.length ? ` +${rest.length} ข้อ` : ""}`, sub: `ในการตรวจล่าสุด ${fmtDate(latest.evalDate)}`, href: "/app/store-eval" });
    }
    const lastMonth = prevPeriod(curPeriod(now));
    const hasLastMonth = ev.months.some((m) => m.period >= lastMonth);
    if (now.getDate() > 15 && !hasLastMonth) {
      out.push({ key: "eval-missing", severity: 2, icon: "event_busy", title: `ยังไม่มีผลตรวจประเมินเดือน ${monthShort(lastMonth)}`, sub: `ตรวจล่าสุด ${fmtDate(latest.evalDate)} · ร้านตรวจทุกเดือน`, href: "/app/store-eval" });
    }
  }
  const cs = opts.csSum;
  if (cs && cs.count > 0 && cs.months.length) {
    const [m0, m1] = cs.months; // ใหม่ -> เก่า
    if (m0.lowCount > 0) {
      out.push({ key: "cs-low", severity: 2, icon: "sentiment_dissatisfied", title: `รีวิวคะแนนต่ำกว่า 7 · ${m0.lowCount} รายการ (${monthShort(m0.period)})`, sub: "กดเพื่ออ่านความเห็นที่ลูกค้าอยากให้ปรับปรุง", href: "/app/cust-sat" });
    }
    if (m1 && (m1.pct - m0.pct) * 100 >= 5) {
      out.push({ key: "cs-drop", severity: 1, icon: "trending_down", title: `ความพึงพอใจลดลง ${((m1.pct - m0.pct) * 100).toFixed(1)} จุด`, sub: `${monthShort(m1.period)} ${(m1.pct * 100).toFixed(1)}% → ${monthShort(m0.period)} ${(m0.pct * 100).toFixed(1)}%`, href: "/app/cust-sat" });
    }
  }
  const dm = diFocus(opts.di, now);
  if (dm && dm.prev && dm.prevTotal > 0 && (dm.prevTotal - dm.total) / dm.prevTotal > 0.2) {
    out.push({ key: "di-drop", severity: 1, icon: "architecture", title: `แบบรับเข้าลดลง ${Math.round(((dm.prevTotal - dm.total) / dm.prevTotal) * 100)}%`, sub: `${monthShort(dm.prev)} ${dm.prevTotal} → ${monthShort(dm.period)} ${dm.total} แบบ`, href: "/app/design-intake" });
  }
  return out.sort((a, b) => b.severity - a.severity);
}

/** เดือนของแบบรับเข้าที่ใช้แสดง: เดือนที่ครบล่าสุด (ถ้ามี) ไม่งั้นเดือนล่าสุด */
function diFocus(di: DiSummary | null, now: Date) {
  if (!di || !di.months.length) return null;
  const byP = new Map(di.months.map((m) => [m.period, m]));
  const cur = curPeriod(now);
  const lastFull = prevPeriod(cur);
  const m = byP.get(lastFull) ?? di.months[0];
  const prevP = prevPeriod(m.period);
  const pm = byP.get(prevP);
  const curM = m.period !== cur ? byP.get(cur) : undefined;
  return {
    period: m.period,
    material: m.material,
    solution: m.solution,
    total: m.material + m.solution,
    prev: pm ? prevP : null,
    prevTotal: pm ? pm.material + pm.solution : 0,
    toDate: curM ? curM.material + curM.solution : null,
  };
}

export type PerfStatus = { label: string; tone: "good" | "ok" | "warn"; sub: string };
export function perfStatus(items: AttentionItem[], hasAny: boolean): PerfStatus {
  if (!hasAny) return { label: "-", tone: "ok", sub: "ยังไม่มีข้อมูล" };
  if (!items.length) return { label: "ดีมาก", tone: "good", sub: "ไม่มีเรื่องที่ต้องดู" };
  if (items.length >= 2 || items.some((i) => i.severity === 3)) return { label: "ต้องดู", tone: "warn", sub: `${items.length} เรื่องที่ควรดู` };
  return { label: "ปกติ", tone: "ok", sub: "1 เรื่องที่ควรดู" };
}

/* ---------------- ภาพรวมเดือนล่าสุด ---------------- */
export function MonthOverview({
  loading,
  benefitMonths,
  productMonths,
  serviceMonths,
  status,
  attention,
  scopeAll,
}: {
  loading: boolean;
  benefitMonths: PeriodAmount[];
  productMonths: PeriodAmount[];
  serviceMonths: PeriodAmount[];
  status: PerfStatus | null;
  attention: AttentionItem[];
  scopeAll: boolean;
}) {
  // ผลประโยชน์: เดือนล่าสุดที่มียอด (ไฟล์รายเดือนมาช้ากว่า)
  const ben = [...benefitMonths].filter((m) => m.amount !== 0).sort((a, b) => b.period.localeCompare(a.period));
  const benLatest = ben[0];
  const benPrev = benLatest ? benefitMonths.find((m) => m.period === prevPeriod(benLatest.period)) : undefined;
  const benDelta = benLatest ? pctChange(benLatest.amount, benPrev?.amount) : null;
  // ยอดขาย: เดือนที่ครบล่าสุด (ยอดขายเป็นรายวัน เดือนปัจจุบันยังไม่ครบ)
  const sumAt = (arr: PeriodAmount[], p: string) => arr.filter((m) => m.period === p).reduce((a, m) => a + m.amount, 0);
  const periods = [...new Set([...productMonths, ...serviceMonths].map((m) => m.period))].sort((a, b) => b.localeCompare(a));
  const lastFull = prevPeriod(curPeriod());
  const salesP = periods.includes(lastFull) ? lastFull : periods.find((p) => p < curPeriod()) ?? periods[0];
  const prod = salesP ? sumAt(productMonths, salesP) : 0;
  const svc = salesP ? sumAt(serviceMonths, salesP) : 0;
  const salesTotal = prod + svc;
  const salesPrev = salesP ? sumAt(productMonths, prevPeriod(salesP)) + sumAt(serviceMonths, prevPeriod(salesP)) : 0;
  const salesDelta = pctChange(salesTotal, salesPrev);
  const prodShare = salesTotal > 0 ? (prod / salesTotal) * 100 : 0;
  const delta = (v: number | null) =>
    v == null ? null : <span className="text-red-50">{v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(0)}%</span>;

  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-4 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
          <Icon name="insights" style={{ fontSize: 16 }} />
          ภาพรวมเดือนล่าสุด{scopeAll ? " · ทุกร้าน" : ""}
        </p>
        <div className="grid grid-cols-3 gap-2 mt-2.5">
          <div className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2 min-w-0">
            <p className="text-[10px] text-red-100/80 leading-tight">ผลประโยชน์ร้าน</p>
            <p className="tnum text-[16px] font-bold leading-tight mt-1">{loading ? "…" : benLatest ? short(benLatest.amount) : "-"}</p>
            <p className="text-[9.5px] text-red-100/80 mt-0.5 truncate">{benLatest ? <>{monthShort(benLatest.period)} {delta(benDelta)}</> : ""}</p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2 min-w-0">
            <p className="text-[10px] text-red-100/80 leading-tight">ยอดขายรวม</p>
            <p className="tnum text-[16px] font-bold leading-tight mt-1">{loading ? "…" : salesP ? short(salesTotal) : "-"}</p>
            <p className="text-[9.5px] text-red-100/80 mt-0.5 truncate">{salesP ? <>{monthShort(salesP)} {delta(salesDelta)}</> : ""}</p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2 min-w-0">
            <p className="text-[10px] text-red-100/80 leading-tight">ผลงานร้าน</p>
            <p className="text-[16px] font-bold leading-tight mt-1">{loading || !status ? "…" : status.label}</p>
            <p className="text-[9.5px] text-red-100/80 mt-0.5 truncate">{status?.sub ?? ""}</p>
          </div>
        </div>
        {/* แยกยอดขาย สินค้า / บริการ */}
        {!loading && salesP && salesTotal > 0 && (
          <div className="mt-2.5 rounded-xl bg-black/10 px-3 py-2">
            <div className="flex justify-between text-[10.5px] text-red-50">
              <span>สินค้า <b className="tnum">{short(prod)}</b></span>
              <span>บริการ <b className="tnum">{short(svc)}</b></span>
            </div>
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mt-1 flex" aria-hidden="true">
              <div className="h-full bg-white" style={{ width: `${prodShare}%` }} />
              <div className="h-full bg-amber-300" style={{ width: `${100 - prodShare}%` }} />
            </div>
            <p className="text-[9px] text-red-100/70 mt-1">ยอดขาย {monthShort(salesP)} · สินค้า DI/Odoo + งานบริการ LHS/Rudy (รวม VAT) + BA (gmv)</p>
          </div>
        )}
        {!scopeAll && !loading && attention.length > 0 && (
          <a href="#attention" className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-white/95 px-3 py-2 text-slate-900 hover:bg-white transition">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 text-[13px] font-bold" aria-hidden="true">!</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] font-bold">มี {attention.length > 3 ? "3+" : attention.length} เรื่องที่ควรดู</span>
              <span className="block text-[10px] text-slate-500 truncate">{attention.slice(0, 2).map((a) => a.title).join(" · ")}</span>
            </span>
            <Icon name="chevron_right" className="text-slate-400" style={{ fontSize: 18 }} />
          </a>
        )}
      </div>
    </section>
  );
}

/* ---------------- ผลงานร้าน 3 การ์ด ---------------- */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${max === min ? 50 : 90 - ((v - min) / span) * 80}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-5" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="#d32029" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PerformanceCards({
  loading,
  evalSum,
  csSum,
  di,
  scopeAll,
}: {
  loading: boolean;
  evalSum: EvalSummary | null;
  csSum: CsSummary | null;
  di: DiSummary | null;
  scopeAll: boolean;
}) {
  const cards: ReactNode[] = [];
  const now = new Date();
  if (evalSum && evalSum.count > 0) {
    const evals = [...evalSum.months].sort((a, b) => String(a.evalDate ?? a.period).localeCompare(String(b.evalDate ?? b.period))).slice(-6);
    const latest = evalSum.latest;
    const pass = latest?.result === "ผ่าน";
    cards.push(
      <Link key="eval" href="/app/store-eval" className="rounded-2xl bg-white border border-slate-100 shadow-sm p-3 flex flex-col hover:border-red-200 hover:-translate-y-0.5 active:scale-[0.98] transition-all animate-fade-up stagger-1 min-w-0">
        <span className="w-8 h-8 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center"><Icon name="fact_check" style={{ fontSize: 17 }} /></span>
        <span className="text-[11.5px] font-bold text-slate-900 mt-2 leading-tight">ตรวจประเมินร้าน</span>
        <span className="tnum text-[21px] font-bold text-[#a11119] leading-tight mt-1">
          {loading ? "…" : scopeAll ? `${Math.round(evalSum.avgPct * 100)}%` : latest ? `${Math.round(latest.pct * 100)}%` : "-"}
        </span>
        {scopeAll ? (
          <span className="text-[9.5px] text-slate-500 mt-0.5">เฉลี่ย · ผ่าน {evalSum.passCount}/{evalSum.count} ครั้ง</span>
        ) : latest?.result ? (
          <span className={cn("self-start mt-0.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold", pass ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[#d32029]")}>{latest.result}</span>
        ) : null}
        <span className="mt-auto pt-2"><Spark values={evals.map((e) => e.pct)} /></span>
        <span className="text-[9px] text-slate-400">{scopeAll ? `${evalSum.count} ครั้ง` : `${evals.length} ครั้งล่าสุด · ${fmtDate(latest?.evalDate ?? null)}`}</span>
      </Link>
    );
  }
  if (csSum && csSum.count > 0 && csSum.months.length) {
    const [m0, m1] = csSum.months;
    const d = m1 ? (m0.pct - m1.pct) * 100 : null;
    const last3 = [...csSum.months.slice(0, 3)].reverse();
    const maxP = Math.max(...last3.map((m) => m.pct), 0.01);
    cards.push(
      <Link key="cs" href="/app/cust-sat" className="rounded-2xl bg-white border border-slate-100 shadow-sm p-3 flex flex-col hover:border-red-200 hover:-translate-y-0.5 active:scale-[0.98] transition-all animate-fade-up stagger-2 min-w-0">
        <span className="w-8 h-8 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center"><Icon name="sentiment_satisfied" style={{ fontSize: 17 }} /></span>
        <span className="text-[11.5px] font-bold text-slate-900 mt-2 leading-tight">ความพึงพอใจ</span>
        <span className="tnum text-[21px] font-bold text-[#a11119] leading-tight mt-1">{loading ? "…" : `${(m0.pct * 100).toFixed(1)}%`}</span>
        {d != null && (
          <span className={cn("text-[9.5px] font-bold mt-0.5", d >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)} จุด จาก {monthShort(m1.period).split(" ")[0]}
          </span>
        )}
        <span className="mt-auto pt-2 flex items-end gap-1 h-7" aria-hidden="true">
          {last3.map((m, i) => (
            <span key={m.period} className={cn("flex-1 rounded-sm", i === last3.length - 1 ? "bg-[#d32029]" : "bg-red-200")} style={{ height: `${Math.max(20, (m.pct / maxP) * 100)}%` }} />
          ))}
        </span>
        <span className="text-[9px] text-slate-400 mt-0.5">{monthShort(m0.period)} · {m0.reviewCount} รีวิว</span>
      </Link>
    );
  }
  const dm = diFocus(di, now);
  if (dm) {
    const delta = dm.prev ? pctChange(dm.total, dm.prevTotal) : null;
    const mPct = dm.total ? (dm.material / dm.total) * 100 : 0;
    cards.push(
      <Link key="di" href="/app/design-intake" className="rounded-2xl bg-white border border-slate-100 shadow-sm p-3 flex flex-col hover:border-red-200 hover:-translate-y-0.5 active:scale-[0.98] transition-all animate-fade-up stagger-3 min-w-0">
        <span className="w-8 h-8 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center"><Icon name="architecture" style={{ fontSize: 17 }} /></span>
        <span className="text-[11.5px] font-bold text-slate-900 mt-2 leading-tight">แบบรับเข้า</span>
        <span className="tnum text-[21px] font-bold text-[#a11119] leading-tight mt-1">
          {loading ? "…" : dm.total.toLocaleString("th-TH")}
          <span className="text-[11px] font-semibold text-slate-500 ml-0.5">แบบ</span>
        </span>
        {delta != null && (
          <span className={cn("text-[9.5px] font-bold mt-0.5", delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% จาก {monthShort(dm.prev!).split(" ")[0]}
          </span>
        )}
        <span className="mt-auto pt-2">
          <span className="block h-2 rounded-full bg-slate-100 overflow-hidden flex" aria-hidden="true">
            <span className="h-full bg-[#1e5a7a]" style={{ width: `${mPct}%` }} />
            <span className="h-full bg-[#4fb0b3]" style={{ width: `${100 - mPct}%` }} />
          </span>
          <span className="block text-[9px] text-slate-500 mt-1">M {dm.material} · S {dm.solution} ({monthShort(dm.period).split(" ")[0]})</span>
        </span>
        <span className="text-[9px] text-slate-400">{dm.toDate != null ? `เดือนนี้ถึงวันนี้ ${dm.toDate}` : "\u00a0"}</span>
      </Link>
    );
  }
  if (!cards.length) return null;
  return (
    <section>
      <div className="flex items-end justify-between mb-2 px-0.5">
        <h3 className="text-[13px] font-bold text-[#8f1114] flex items-center gap-1.5">
          <Icon name="monitoring" style={{ fontSize: 16 }} />
          ผลงานร้าน{scopeAll ? " · ทุกร้าน" : ""}
        </h3>
        <span className="text-[10px] text-slate-400">ล่าสุด · กดเพื่อดูรายละเอียด</span>
      </div>
      <div className={cn("grid gap-2", cards.length === 3 ? "grid-cols-3" : cards.length === 2 ? "grid-cols-2" : "grid-cols-1")}>{cards}</div>
    </section>
  );
}

/* ---------------- เรื่องที่ควรดู ---------------- */
const SEV = {
  3: { box: "bg-rose-50", dot: "bg-rose-100 text-rose-700" },
  2: { box: "bg-amber-50", dot: "bg-amber-100 text-amber-700" },
  1: { box: "bg-slate-50", dot: "bg-slate-200 text-slate-600" },
} as const;

export function AttentionList({ loading, items }: { loading: boolean; items: AttentionItem[] }) {
  return (
    <section id="attention" className={cn("rounded-2xl bg-white border shadow-sm p-3.5 scroll-mt-20", items.length ? "border-amber-200" : "border-slate-100")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn("text-[13px] font-bold flex items-center gap-1.5", items.length ? "text-amber-800" : "text-emerald-700")}>
          <Icon name={items.length ? "notifications_active" : "task_alt"} style={{ fontSize: 17 }} />
          {loading ? "กำลังตรวจสอบ…" : items.length ? "เรื่องที่ควรดู" : "ทุกอย่างเรียบร้อย"}
        </h3>
        <span className="text-[9.5px] text-slate-400">อัปเดตอัตโนมัติจากข้อมูลล่าสุด</span>
      </div>
      {!loading && items.length === 0 && <p className="text-[11px] text-slate-500 mt-1">ไม่มีข้อที่ตก รีวิวคะแนนต่ำ หรือตัวเลขที่ลดลงผิดปกติ</p>}
      {items.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 3).map((a) => (
            <li key={a.key}>
              <Link href={a.href} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 hover:-translate-y-0.5 transition-all", SEV[a.severity].box)}>
                <span className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", SEV[a.severity].dot)}>
                  <Icon name={a.icon} style={{ fontSize: 15 }} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-bold text-slate-900 leading-snug">{a.title}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{a.sub}</span>
                </span>
                <Icon name="chevron_right" className="text-slate-300 shrink-0" style={{ fontSize: 18 }} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > 3 && <p className="text-[10px] text-slate-400 mt-1.5">และอีก {items.length - 3} เรื่อง</p>}
    </section>
  );
}
