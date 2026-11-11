"use client";

/* แถบความคืบหน้าเทียบเป้า (TG) + เทียบปีก่อน (LY) — ใช้ร่วมกันในหน้าหลัก / ยอดขายงานบริการ / แบบรับเข้า */
import { cn } from "@/lib/utils";
import { pctLabel, tgTone, type TgTotals } from "@/lib/commission/targets-store";

export function TargetBar({ pct, className, dark }: { pct: number | null; className?: string; dark?: boolean }) {
  const tone = tgTone(pct);
  const w = pct == null ? 0 : Math.min(100, Math.max(pct > 0 ? 2 : 0, pct * 100));
  return (
    <div
      className={cn("h-1.5 rounded-full overflow-hidden", dark ? "bg-white/25" : "bg-slate-100", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct == null ? undefined : Math.round(pct * 100)}
      aria-label={`ถึงเป้า ${pctLabel(pct)}`}
    >
      <div className={cn("h-full rounded-full transition-all duration-700", dark ? "bg-amber-200" : tone.bar)} style={{ width: `${w}%` }} />
    </div>
  );
}

/** ข้อความเทียบปีก่อน: ▲ 12% vs LY (840K) */
export function LyText({ t, fmt, dark, className }: { t: TgTotals; fmt: (n: number) => string; dark?: boolean; className?: string }) {
  if (t.growth == null) return <span className={cn(dark ? "text-red-100/70" : "text-slate-400", className)}>LY {t.ly ? fmt(t.ly) : "-"}</span>;
  const up = t.growth >= 0;
  return (
    <span className={cn("font-bold", dark ? (up ? "text-emerald-200" : "text-amber-200") : up ? "text-emerald-600" : "text-rose-600", className)}>
      {up ? "▲" : "▼"} {Math.abs(t.growth).toFixed(0)}% vs LY ({fmt(t.ly)})
    </span>
  );
}

/** บล็อกเต็ม: ทำได้ / เป้า · % · แถบ · ขาดอีก/เกินเป้า · LY */
export function TargetProgress({
  t,
  fmt,
  dark,
  label,
  partial,
}: {
  t: TgTotals;
  fmt: (n: number) => string;
  dark?: boolean;
  /** เช่น "สะสมถึง ต.ค." */
  label?: string;
  /** เดือนปัจจุบัน (ยังไม่ครบเดือน) */
  partial?: boolean;
}) {
  const tone = tgTone(t.pct);
  const gap = t.target - t.actual;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[11px]", dark ? "text-red-50" : "text-slate-600")}>
          ทำได้ <b className={cn("tnum", dark ? "text-white" : "text-slate-900")}>{fmt(t.actual)}</b> / เป้า <b className="tnum">{fmt(t.target)}</b>
          {label && <span className={dark ? "text-red-100/70" : "text-slate-400"}> · {label}</span>}
        </p>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tnum", dark ? "bg-white/90 text-[#a11119]" : cn(tone.soft, tone.text))}>
          {pctLabel(t.pct)} ของเป้า
        </span>
      </div>
      <TargetBar pct={t.pct} dark={dark} className="mt-1.5" />
      <div className="flex items-center justify-between gap-2 mt-1 text-[10.5px]">
        <span className={dark ? "text-red-100/80" : "text-slate-500"}>
          {partial ? "เดือนนี้ยังไม่ครบ · " : ""}
          {gap > 0 ? <>ขาดอีก <b className="tnum">{fmt(gap)}</b></> : <>เกินเป้า <b className="tnum">{fmt(-gap)}</b></>}
        </span>
        <LyText t={t} fmt={fmt} dark={dark} />
      </div>
    </div>
  );
}
