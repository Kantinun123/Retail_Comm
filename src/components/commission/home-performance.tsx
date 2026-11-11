"use client";

/* =============================================================
   หน้าหลักร้านค้า — ส่วนบน (ตามช่วงเวลาที่เลือกด้านบน: เดือน / สะสมปี)
   - MonthOverview : ภาพรวม (ผลประโยชน์ร้าน · ยอดขายสินค้า+บริการ · ผลงานร้าน)
   - PerformanceCards : ผลงานร้าน 3 การ์ด (ตรวจประเมิน · ความพึงพอใจ · แบบรับเข้า)
       เดือน: ค่าของเดือนนั้น (ถ้าเดือนนั้นยังไม่มี -> ค่าล่าสุดก่อนหน้า + ป้ายบอกเดือน)
       สะสมปี: ค่าเฉลี่ย/ยอดรวมทั้งปี
   - AttentionList : เรื่องที่ควรดู (อิงข้อมูลล่าสุดเสมอ ไม่ขึ้นกับช่วงเวลา)
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
import { currentPeriod, periodShort, prevPeriod, type HubView } from "@/lib/commission/freshness-store";
import { cn } from "@/lib/utils";
import { pctLabel, scoreTarget, tgTone, type TgTotals } from "@/lib/commission/targets-store";
import { ScoreTargetChip, TargetBar } from "./target-progress";
import { withPeriod } from "@/lib/commission/linked-period";

const short = (v: number) => (Math.abs(v) >= 1e6 ? `฿${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `฿${(v / 1e3).toFixed(1)}K` : `฿${Math.round(v).toLocaleString("th-TH")}`);
const pctChange = (cur: number, base: number | null | undefined) => (base ? ((cur - base) / Math.abs(base)) * 100 : null);
const fmtDate = (iso: string | null) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "-");
const monOnly = (p: string) => periodShort(p).split(" ")[0];

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

/** เดือนของแบบรับเข้าที่ใช้ในเรื่องที่ควรดู: เดือนที่ครบล่าสุด (ถ้ามี) ไม่งั้นเดือนล่าสุด */
function diLatestFull(di: DiSummary | null, now: Date) {
  if (!di || !di.months.length) return null;
  const byP = new Map(di.months.map((m) => [m.period, m]));
  const m = byP.get(prevPeriod(currentPeriod(now))) ?? di.months[0];
  const pm = byP.get(prevPeriod(m.period));
  return { period: m.period, total: m.material + m.solution, prev: pm ? prevPeriod(m.period) : null, prevTotal: pm ? pm.material + pm.solution : 0 };
}

/** รวมเรื่องที่ควรดู เรียงตามความสำคัญ (อิงข้อมูลล่าสุด) */
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
    const evT = scoreTarget(latest.period);
    if (evT != null && latest.pct < evT && (!latest.result || latest.result === "ผ่าน")) {
      out.push({ key: "eval-target", severity: 2, icon: "flag", title: `ผลตรวจล่าสุด ${Math.round(latest.pct * 100)}% ต่ำกว่าเป้า ${Math.round(evT * 100)}%`, sub: `ตรวจเมื่อ ${fmtDate(latest.evalDate)} · กดดูหมวดที่เสียคะแนน`, href: "/app/store-eval" });
    }
    const prev = evals[1];
    if (prev && prev.pct - latest.pct >= 0.05) {
      out.push({ key: "eval-drop", severity: 2, icon: "trending_down", title: `คะแนนตรวจลดลง ${Math.round((prev.pct - latest.pct) * 100)} จุด`, sub: `${Math.round(prev.pct * 100)}% → ${Math.round(latest.pct * 100)}%`, href: "/app/store-eval" });
    }
    if (opts.evalFails && opts.evalFails.length) {
      const [first, ...rest] = opts.evalFails;
      out.push({ key: "eval-items", severity: 2, icon: "cancel", title: `ตกข้อ "${first.length > 40 ? first.slice(0, 40) + "…" : first}"${rest.length ? ` +${rest.length} ข้อ` : ""}`, sub: `ในการตรวจล่าสุด ${fmtDate(latest.evalDate)}`, href: "/app/store-eval" });
    }
    const lastMonth = prevPeriod(currentPeriod(now));
    if (now.getDate() > 15 && !ev.months.some((m) => m.period >= lastMonth)) {
      out.push({ key: "eval-missing", severity: 2, icon: "event_busy", title: `ยังไม่มีผลตรวจประเมินเดือน ${periodShort(lastMonth)}`, sub: `ตรวจล่าสุด ${fmtDate(latest.evalDate)} · ร้านตรวจทุกเดือน`, href: "/app/store-eval" });
    }
  }
  const cs = opts.csSum;
  if (cs && cs.count > 0 && cs.months.length) {
    const [m0, m1] = cs.months; // ใหม่ -> เก่า
    const csT = scoreTarget(m0.period);
    if (csT != null && m0.pct < csT) {
      out.push({ key: "cs-target", severity: 2, icon: "flag", title: `ความพึงพอใจ ${periodShort(m0.period)} ${(m0.pct * 100).toFixed(1)}% ต่ำกว่าเป้า ${Math.round(csT * 100)}%`, sub: `${m0.reviewCount} รีวิว · กดดูด้านที่คะแนนต่ำ`, href: "/app/cust-sat" });
    }
    if (m0.lowCount > 0) {
      out.push({ key: "cs-low", severity: 2, icon: "sentiment_dissatisfied", title: `รีวิวคะแนนต่ำกว่า 7 · ${m0.lowCount} รายการ (${periodShort(m0.period)})`, sub: "กดเพื่ออ่านความเห็นที่ลูกค้าอยากให้ปรับปรุง", href: "/app/cust-sat" });
    }
    if (m1 && (m1.pct - m0.pct) * 100 >= 5) {
      out.push({ key: "cs-drop", severity: 1, icon: "trending_down", title: `ความพึงพอใจลดลง ${((m1.pct - m0.pct) * 100).toFixed(1)} จุด`, sub: `${periodShort(m1.period)} ${(m1.pct * 100).toFixed(1)}% → ${periodShort(m0.period)} ${(m0.pct * 100).toFixed(1)}%`, href: "/app/cust-sat" });
    }
  }
  const dm = diLatestFull(opts.di, now);
  if (dm && dm.prev && dm.prevTotal > 0 && (dm.prevTotal - dm.total) / dm.prevTotal > 0.2) {
    out.push({ key: "di-drop", severity: 1, icon: "architecture", title: `แบบรับเข้าลดลง ${Math.round(((dm.prevTotal - dm.total) / dm.prevTotal) * 100)}%`, sub: `${periodShort(dm.prev)} ${dm.prevTotal} → ${periodShort(dm.period)} ${dm.total} แบบ`, href: "/app/design-intake" });
  }
  return out.sort((a, b) => b.severity - a.severity);
}

export type PerfStatus = { label: string; tone: "good" | "ok" | "warn"; sub: string };
export function perfStatus(items: AttentionItem[], hasAny: boolean): PerfStatus {
  if (!hasAny) return { label: "-", tone: "ok", sub: "ยังไม่มีข้อมูล" };
  if (!items.length) return { label: "ดีมาก", tone: "good", sub: "ไม่มีเรื่องที่ต้องดู" };
  if (items.length >= 2 || items.some((i) => i.severity === 3)) return { label: "ต้องดู", tone: "warn", sub: `${items.length} เรื่องที่ควรดู` };
  return { label: "ปกติ", tone: "ok", sub: "1 เรื่องที่ควรดู" };
}

/* ---------------- ภาพรวม ---------------- */
export function MonthOverview({
  loading,
  title,
  benefit,
  sales,
  status,
  attention,
  scopeAll,
}: {
  loading: boolean;
  /** "ต.ค. 2569" หรือ "สะสมปี 2569" */
  title: string;
  benefit: { amount: number | null; waiting: number; deltaPct: number | null };
  sales: { product: number; service: number; deltaPct: number | null; fresh: { text: string; stale: boolean } | null };
  status: PerfStatus | null;
  attention: AttentionItem[];
  scopeAll: boolean;
}) {
  const total = sales.product + sales.service;
  const prodShare = total > 0 ? (sales.product / total) * 100 : 0;
  const delta = (v: number | null) =>
    v == null ? null : <span className="text-red-50">{v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(0)}%</span>;

  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-4 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
          <Icon name="insights" style={{ fontSize: 16 }} />
          ภาพรวม {title}{scopeAll ? " · ทุกร้าน" : ""}
        </p>
        <div className="grid grid-cols-3 gap-2 mt-2.5">
          <a href="#store-benefits" className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2 min-w-0 hover:bg-white/15 transition">
            <p className="text-[10px] text-red-100/80 leading-tight">ผลประโยชน์ร้าน</p>
            <p className="tnum text-[16px] font-bold leading-tight mt-1">{loading ? "…" : benefit.amount == null ? "รอข้อมูล" : short(benefit.amount)}</p>
            <p className="text-[9.5px] mt-0.5 truncate">
              {benefit.waiting > 0 ? <span className="text-amber-200">⏳ รอข้อมูล {benefit.waiting} แหล่ง</span> : delta(benefit.deltaPct)}
            </p>
          </a>
          <a href="#sales" className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2 min-w-0 hover:bg-white/15 transition">
            <p className="text-[10px] text-red-100/80 leading-tight">ยอดขายรวม</p>
            <p className="tnum text-[16px] font-bold leading-tight mt-1">{loading ? "…" : short(total)}</p>
            <p className="text-[9.5px] mt-0.5 truncate">{delta(sales.deltaPct)}</p>
          </a>
          <a href="#store-performance" className="rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2 min-w-0 hover:bg-white/15 transition">
            <p className="text-[10px] text-red-100/80 leading-tight">ผลงานร้าน</p>
            <p className="text-[16px] font-bold leading-tight mt-1">{loading || !status ? "…" : status.label}</p>
            <p className="text-[9.5px] text-red-100/80 mt-0.5 truncate">{status?.sub ?? ""}</p>
          </a>
        </div>
        {!loading && total > 0 && (
          <div className="mt-2.5 rounded-xl bg-black/10 px-3 py-2">
            <div className="flex justify-between text-[10.5px] text-red-50">
              <span>สินค้า <b className="tnum">{short(sales.product)}</b></span>
              <span>บริการ <b className="tnum">{short(sales.service)}</b></span>
            </div>
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mt-1 flex" aria-hidden="true">
              <div className="h-full bg-white" style={{ width: `${prodShare}%` }} />
              <div className="h-full bg-amber-300" style={{ width: `${100 - prodShare}%` }} />
            </div>
            {sales.fresh && (
              <p className={cn("text-[9.5px] mt-1 flex items-center gap-1", sales.fresh.stale ? "text-amber-200 font-semibold" : "text-red-100/80")}>
                <Icon name={sales.fresh.stale ? "warning" : "schedule"} style={{ fontSize: 12 }} />
                {sales.fresh.text}
              </p>
            )}
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
function Spark({ values, target }: { values: number[]; target?: number | null }) {
  if (values.length < 2) return null;
  const all = target != null ? [...values, target] : values;
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const y = (v: number) => (max === min ? 50 : 90 - ((v - min) / span) * 80);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${y(v)}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-5" aria-hidden="true">
      {target != null && (
        <line x1={0} x2={100} y1={y(target)} y2={y(target)} stroke="#334155" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      )}
      <polyline points={pts} fill="none" stroke="#d32029" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
const Tag = ({ children }: { children: ReactNode }) => (
  <span className="self-start mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">{children}</span>
);
const DeltaLine = ({ v, unit, label }: { v: number | null; unit: string; label: string }) =>
  v == null ? null : (
    <span className={cn("text-[9.5px] font-bold mt-0.5", v >= 0 ? "text-emerald-600" : "text-rose-600")}>
      {v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(1)}{unit} {label}
    </span>
  );

export function PerformanceCards({
  loading,
  view,
  evalSum,
  csSum,
  di,
  scopeAll,
  diTarget,
}: {
  loading: boolean;
  view: HubView;
  evalSum: EvalSummary | null;
  csSum: CsSummary | null;
  di: DiSummary | null;
  scopeAll: boolean;
  /** เป้าแบบรับเข้า (TG แบบบ้าน) ของช่วงที่เลือก — null = ไม่มีเป้า */
  diTarget?: TgTotals | null;
}) {
  const cards: ReactNode[] = [];
  const cur = currentPeriod();
  const inView = (p: string) => (view.mode === "month" ? p === view.period : p.startsWith(view.year + "-"));
  const upTo = view.mode === "month" ? view.period : `${view.year}-12`;
  const card = "rounded-2xl bg-white border border-slate-100 shadow-sm p-3 flex flex-col hover:border-red-200 hover:-translate-y-0.5 active:scale-[0.98] transition-all animate-fade-up min-w-0";

  /* ตรวจประเมิน */
  if (evalSum && evalSum.count > 0) {
    const all = [...evalSum.months].sort((a, b) => String(a.evalDate ?? a.period).localeCompare(String(b.evalDate ?? b.period)));
    const hits = all.filter((e) => inView(e.period));
    const before = all.filter((e) => e.period <= upTo);
    let value: string, sub: ReactNode = null, tag: string | null = null, result: string | null = null;
    if (view.mode === "year" || scopeAll) {
      const src = hits.length ? hits : [];
      value = src.length ? `${Math.round((src.reduce((a, e) => a + e.pct, 0) / src.length) * 100)}%` : "-";
      sub = <span className="text-[9.5px] text-slate-500 mt-0.5">{src.length ? `เฉลี่ย · ผ่าน ${src.filter((e) => e.result === "ผ่าน").length}/${src.length} ครั้ง` : "ไม่มีการตรวจในช่วงนี้"}</span>;
    } else {
      const e = hits[hits.length - 1] ?? before[before.length - 1] ?? null;
      value = e ? `${Math.round(e.pct * 100)}%` : "-";
      result = e?.result ?? null;
      if (e && !hits.length) tag = `ล่าสุด ${fmtDate(e.evalDate)}`;
    }
    const spark = before.slice(-6).map((e) => e.pct);
    const evalTarget = scoreTarget(view.mode === "month" ? view.period : view.year);
    const evalPct = (() => {
      if (view.mode === "year" || scopeAll) return hits.length ? hits.reduce((a, e) => a + e.pct, 0) / hits.length : null;
      const e = hits[hits.length - 1] ?? before[before.length - 1] ?? null;
      return e ? e.pct : null;
    })();
    cards.push(
      <Link key="eval" href={withPeriod("/app/store-eval", view)} className={cn(card, "stagger-1")}>
        <span className="w-8 h-8 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center"><Icon name="fact_check" style={{ fontSize: 17 }} /></span>
        <span className="text-[11.5px] font-bold text-slate-900 mt-2 leading-tight">ตรวจประเมินร้าน</span>
        {tag && <Tag>{tag}</Tag>}
        <span className="tnum text-[21px] font-bold text-[#a11119] leading-tight mt-1">{loading ? "…" : value}</span>
        {result && (
          <span className={cn("self-start mt-0.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold", result === "ผ่าน" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-[#d32029]")}>{result}</span>
        )}
        {sub}
        {!loading && <ScoreTargetChip pct={evalPct} target={evalTarget} compact className="self-start mt-1" />}
        <span className="mt-auto pt-2"><Spark values={spark} target={evalTarget} /></span>
        <span className="text-[9px] text-slate-400">{spark.length} ครั้งล่าสุด{view.mode === "month" && !hits.length ? ` · ${monOnly(view.period)} ยังไม่มีผลตรวจ` : ""}</span>
      </Link>
    );
  }

  /* ความพึงพอใจ */
  if (csSum && csSum.count > 0 && csSum.months.length) {
    const byP = new Map(csSum.months.map((m) => [m.period, m]));
    let value = "-", tag: string | null = null, d: number | null = null, foot = "";
    if (view.mode === "year") {
      const ms = csSum.months.filter((m) => inView(m.period));
      const n = ms.reduce((a, m) => a + m.reviewCount, 0);
      if (n) value = `${((ms.reduce((a, m) => a + m.pct * m.reviewCount, 0) / n) * 100).toFixed(1)}%`;
      foot = `เฉลี่ยทั้งปี · ${n} รีวิว`;
    } else {
      const m = byP.get(view.period) ?? csSum.months.find((x) => x.period < view.period) ?? null;
      if (m) {
        value = `${(m.pct * 100).toFixed(1)}%`;
        if (m.period !== view.period) tag = `ล่าสุด ${periodShort(m.period)}`;
        const pm = byP.get(prevPeriod(m.period));
        d = pm ? (m.pct - pm.pct) * 100 : null;
        foot = `${periodShort(m.period)} · ${m.reviewCount} รีวิว`;
      }
    }
    const last3 = csSum.months.filter((m) => m.period <= upTo).slice(0, 3).reverse();
    const csTarget = scoreTarget(view.mode === "month" ? view.period : view.year);
    const maxP = Math.max(...last3.map((m) => m.pct), csTarget ?? 0, 0.01);
    const csPct = value === "-" ? null : Number(value.replace("%", "")) / 100;
    cards.push(
      <Link key="cs" href={withPeriod("/app/cust-sat", view)} className={cn(card, "stagger-2")}>
        <span className="w-8 h-8 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center"><Icon name="sentiment_satisfied" style={{ fontSize: 17 }} /></span>
        <span className="text-[11.5px] font-bold text-slate-900 mt-2 leading-tight">ความพึงพอใจ</span>
        {tag && <Tag>{tag}</Tag>}
        <span className="tnum text-[21px] font-bold text-[#a11119] leading-tight mt-1">{loading ? "…" : value}</span>
        <DeltaLine v={d} unit=" จุด" label="จากเดือนก่อน" />
        {!loading && <ScoreTargetChip pct={csPct} target={csTarget} compact className="self-start mt-1" />}
        <span className="relative mt-auto pt-2 flex items-end gap-1 h-7" aria-hidden="true">
          {last3.map((m, i) => (
            <span key={m.period} className={cn("flex-1 rounded-sm", i === last3.length - 1 ? "bg-[#d32029]" : "bg-red-200")} style={{ height: `${Math.max(20, (m.pct / maxP) * 100)}%` }} />
          ))}
          {csTarget != null && (
            <span className="absolute left-0 right-0 border-t border-dashed border-slate-600" style={{ bottom: `calc(${(csTarget / maxP) * 100}% * 0.7143)` }} />
          )}
        </span>
        <span className="text-[9px] text-slate-400 mt-0.5">{foot}</span>
      </Link>
    );
  }

  /* แบบรับเข้า */
  if (di && di.months.length) {
    const byP = new Map(di.months.map((m) => [m.period, m]));
    let material = 0, solution = 0, d: number | null = null, foot = "";
    if (view.mode === "year") {
      di.months.filter((m) => inView(m.period)).forEach((m) => { material += m.material; solution += m.solution; });
      foot = `ทั้งปี ${Number(view.year) + 543}`;
    } else {
      const m = byP.get(view.period);
      material = m?.material ?? 0;
      solution = m?.solution ?? 0;
      const pm = byP.get(prevPeriod(view.period));
      d = pm ? pctChange(material + solution, pm.material + pm.solution) : null;
      foot = view.period === cur ? "เดือนปัจจุบัน · ถึงวันนี้" : periodShort(view.period);
    }
    const total = material + solution;
    const mPct = total ? (material / total) * 100 : 0;
    cards.push(
      <Link key="di" href={withPeriod("/app/design-intake", view)} className={cn(card, "stagger-3")}>
        <span className="w-8 h-8 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center"><Icon name="architecture" style={{ fontSize: 17 }} /></span>
        <span className="text-[11.5px] font-bold text-slate-900 mt-2 leading-tight">แบบรับเข้า</span>
        <span className="tnum text-[21px] font-bold text-[#a11119] leading-tight mt-1">
          {loading ? "…" : total.toLocaleString("th-TH")}
          <span className="text-[11px] font-semibold text-slate-500 ml-0.5">
            {diTarget && diTarget.target > 0 && !scopeAll ? `/ ${diTarget.target.toLocaleString("th-TH")} แบบ` : "แบบ"}
          </span>
        </span>
        {diTarget && diTarget.target > 0 ? (
          <>
            <span className={cn("text-[9.5px] font-bold mt-0.5", tgTone(diTarget.pct).text)}>
              {pctLabel(diTarget.pct)} ของเป้า{scopeAll ? ` (${diTarget.target.toLocaleString("th-TH")})` : ""}
            </span>
            <TargetBar pct={diTarget.pct} className="mt-1" />
            {diTarget.growth != null && (
              <span className={cn("text-[9.5px] font-bold mt-1", diTarget.growth >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {diTarget.growth >= 0 ? "▲" : "▼"} {Math.abs(diTarget.growth).toFixed(0)}% จากปีก่อน
              </span>
            )}
            <span className="text-[9px] text-slate-400">LY {diTarget.ly.toLocaleString("th-TH")} แบบ</span>
          </>
        ) : (
          <DeltaLine v={view.mode === "month" && view.period === cur ? null : d} unit="%" label="จากเดือนก่อน" />
        )}
        <span className="mt-auto pt-2">
          <span className="block h-2 rounded-full bg-slate-100 overflow-hidden flex" aria-hidden="true">
            <span className="h-full bg-[#1e5a7a]" style={{ width: `${mPct}%` }} />
            <span className="h-full bg-[#4fb0b3]" style={{ width: `${100 - mPct}%` }} />
          </span>
          <span className="block text-[9px] text-slate-500 mt-1">M {material.toLocaleString("th-TH")} · S {solution.toLocaleString("th-TH")}</span>
        </span>
        <span className="text-[9px] text-slate-400">{foot}</span>
      </Link>
    );
  }
  if (!cards.length) return null;
  return (
    <section id="store-performance" className="scroll-mt-28">
      <div className="flex items-end justify-between mb-2 px-0.5">
        <h3 className="text-[13px] font-bold text-[#8f1114] flex items-center gap-1.5">
          <Icon name="monitoring" style={{ fontSize: 16 }} />
          ผลงานร้าน · {view.mode === "month" ? periodShort(view.period) : `สะสมปี ${Number(view.year) + 543}`}
          {scopeAll ? " · ทุกร้าน" : ""}
        </h3>
        <span className="text-[10px] text-slate-400">กดเพื่อดูรายละเอียด</span>
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
    <section id="attention" className={cn("rounded-2xl bg-white border shadow-sm p-3.5 scroll-mt-28", items.length ? "border-amber-200" : "border-slate-100")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn("text-[13px] font-bold flex items-center gap-1.5", items.length ? "text-amber-800" : "text-emerald-700")}>
          <Icon name={items.length ? "notifications_active" : "task_alt"} style={{ fontSize: 17 }} />
          {loading ? "กำลังตรวจสอบ…" : items.length ? "เรื่องที่ควรดู" : "ทุกอย่างเรียบร้อย"}
        </h3>
        <span className="text-[9.5px] text-slate-400">อิงข้อมูลล่าสุดเสมอ</span>
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
