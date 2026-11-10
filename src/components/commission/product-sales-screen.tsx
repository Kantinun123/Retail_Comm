"use client";

/* =============================================================
   ยอดขายสินค้า — DI (Housing Expert) / Odoo (SCG Home)
   - ร้านค้า : ยอดของร้าน + แยกกลุ่มสินค้า + แยกพนักงานขาย (ทุกชื่อในไฟล์)
   - พนักงาน : เฉพาะยอดที่ตัวเองขาย (จับคู่ชื่อในไฟล์กับพนักงานในระบบ)
   - admin   : ทุกร้าน (แท็บ ทั้งหมด / HE / SCG Home) + อันดับร้าน + ไม่ระบุร้าน (แยกจากยอดร้าน)
   ระดับข้อมูล: เดือน × ร้าน × กลุ่มสินค้า × พนักงาน ; sync ทุกเช้า
   ============================================================= */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { ProfileCard } from "./profile-card";
import { YearChips, yearsOf } from "./year-filter";
import { doLogout, useHomeHref, useSession } from "@/lib/commission/session";
import {
  fetchProductSales,
  personLabel,
  UNMAPPED_LABEL,
  type PsGroupRow,
  type PsSource,
  type PsSummary,
} from "@/lib/commission/product-sales-store";
import { cn } from "@/lib/utils";
import { fetchFreshness, freshText, type Freshness } from "@/lib/commission/freshness-store";

const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthFull = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_MONTH[m - 1]} ${y + 543}`; };
const monthShort = (p: string) => { const [, m] = p.split("-").map(Number); return TH_SHORT[m - 1]; };
const prevPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const lyPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return `${y - 1}-${String(m).padStart(2, "0")}`; };
const baht = (v: number) => `฿${Math.round(v).toLocaleString("th-TH")}`;
const mil = (v: number) => (Math.abs(v) >= 1e6 ? `฿${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `฿${(v / 1e3).toFixed(0)}K` : baht(v));
const curPeriod = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const SOURCE_LABEL: Record<PsSource, string> = { di: "DI", odoo: "Odoo" };
const TOP_N = 7;

function Delta({ cur, base, label }: { cur: number; base: number | null | undefined; label: string }) {
  if (base == null || base === 0) return <span className="text-[11px] text-red-100/70">{label}: -</span>;
  const pct = ((cur - base) / Math.abs(base)) * 100;
  const up = pct >= 0;
  return (
    <span className="text-[11px] text-red-50 inline-flex items-center gap-0.5">
      {label}
      <Icon name={up ? "arrow_upward" : "arrow_downward"} style={{ fontSize: 13 }} />
      <span className="tnum font-bold">{Math.abs(pct).toFixed(1)}%</span>
    </span>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const w = max > 0 ? Math.max(0, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
      <div className={cn("h-full rounded-full transition-all duration-500", className ?? "bg-[#d32029]")} style={{ width: `${Math.max(w, value > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

/** รวมกลุ่มสินค้าของเดือนเดียว เรียงตามยอด */
function groupsOf(rows: PsGroupRow[], period: string) {
  const m = new Map<string, number>();
  rows.filter((g) => g.period === period).forEach((g) => m.set(g.group, (m.get(g.group) ?? 0) + g.amount));
  return [...m.entries()].map(([group, amount]) => ({ group, amount })).sort((a, b) => b.amount - a.amount);
}

/** รายการกลุ่มสินค้า (top N + อื่น ๆ / ดูทั้งหมด) */
function GroupList({ rows, total }: { rows: { group: string; amount: number }[]; total: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, TOP_N);
  const rest = rows.slice(TOP_N);
  const restAmt = rest.reduce((a, r) => a + r.amount, 0);
  const max = Math.max(1, ...rows.map((r) => r.amount));
  if (rows.length === 0) return <p className="text-[12px] text-slate-400 py-3 text-center">ไม่มีข้อมูล</p>;
  return (
    <>
      <ul className="space-y-2.5">
        {shown.map((g) => (
          <li key={g.group}>
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate text-slate-800 font-semibold">{g.group}</span>
              <span className="shrink-0 tnum text-slate-900 font-bold">
                {mil(g.amount)}
                <span className="text-slate-400 font-normal ml-1">· {total ? ((g.amount / total) * 100).toFixed(0) : 0}%</span>
              </span>
            </div>
            <div className="mt-1"><Bar value={g.amount} max={max} /></div>
          </li>
        ))}
        {!all && rest.length > 0 && (
          <li>
            <div className="flex items-center justify-between gap-2 text-[12px] text-slate-500">
              <span>อื่น ๆ ({rest.length} กลุ่ม)</span>
              <span className="tnum">{mil(restAmt)} · {total ? ((restAmt / total) * 100).toFixed(0) : 0}%</span>
            </div>
            <div className="mt-1"><Bar value={restAmt} max={max} className="bg-slate-300" /></div>
          </li>
        )}
      </ul>
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 w-full text-[12px] font-bold text-[#c3161c] bg-[#fee2e2]/60 rounded-xl py-2 active:scale-[0.99] transition"
        >
          {all ? "ย่อ" : `ดูทุกกลุ่ม (${rows.length})`}
        </button>
      )}
    </>
  );
}

/** หน้าต่างเจาะดู: กลุ่มสินค้าของพนักงาน/ร้านในเดือนที่เลือก */
function DrillModal({
  title,
  period,
  query,
  onClose,
}: {
  title: string;
  period: string;
  query: { dealerCode?: string | null; repCode?: string | null; salesperson?: string | null; source?: PsSource | null };
  onClose: () => void;
}) {
  const [data, setData] = useState<PsSummary | null | undefined>(undefined);
  const { dealerCode, repCode, salesperson, source } = query;
  useEffect(() => {
    let cancelled = false;
    fetchProductSales({ dealerCode, repCode, salesperson, source })
      .then((s) => !cancelled && setData(s))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [dealerCode, repCode, salesperson, source]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const month = data?.months.find((m) => m.period === period);
  const groups = data ? groupsOf(data.groups, period) : [];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl animate-fade-up"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500">{monthFull(period)}</p>
            <h3 className="text-[16px] font-bold text-slate-900 truncate">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="w-8 h-8 shrink-0 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:text-[#a11119]">
            <Icon name="close" className="text-lg" />
          </button>
        </div>
        {data === undefined ? (
          <div className="py-10 text-center text-slate-300"><Icon name="progress_activity" className="animate-spin text-3xl" /></div>
        ) : !data ? (
          <p className="py-8 text-center text-[13px] text-slate-500">โหลดข้อมูลไม่สำเร็จ</p>
        ) : (
          <>
            <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 mb-4 flex items-end justify-between">
              <div>
                <p className="text-[11px] text-slate-500">ยอดขายเดือนนี้</p>
                <p className="tnum text-[22px] font-bold text-slate-900 leading-tight">{baht(month?.amount ?? 0)}</p>
              </div>
              <p className="text-[11px] text-slate-500">{(month?.lines ?? 0).toLocaleString("th-TH")} รายการ</p>
            </div>
            <h4 className="text-[13px] font-bold text-slate-900 mb-2">กลุ่มสินค้า</h4>
            <GroupList rows={groups} total={month?.amount ?? 0} />
          </>
        )}
      </div>
    </div>
  );
}

type Drill = { title: string; period: string; query: { dealerCode?: string | null; repCode?: string | null; salesperson?: string | null; source?: PsSource | null } };

export function ProductSalesScreen() {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const router = useRouter();
  const [data, setData] = useState<{ key: string; s: PsSummary | null } | null>(null);
  const [year, setYear] = useState<string | null | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<PsSource | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [allStores, setAllStores] = useState(false);
  const [fresh, setFresh] = useState<Freshness | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchFreshness().then((f) => !cancelled && setFresh(f));
    return () => {
      cancelled = true;
    };
  }, []);

  const isAdmin = !!session?.isAdmin;
  // admin ที่ดู "มุมมองร้านค้า" / "มุมมองพนักงาน" ให้เห็นเหมือนร้าน/พนักงานคนนั้น
  const adminStoreView = isAdmin && session?.adminViewMode === "store" && !!session.adminViewDealer;
  const adminStaffView = isAdmin && session?.adminViewMode === "staff" && !!session.adminViewRep;
  const isSales = !!session?.isSales || adminStaffView;
  const dealerCode = session
    ? isAdmin
      ? adminStaffView ? null : adminStoreView ? session.adminViewDealer : session.storeFilter
      : isSales ? null : session.dealer.code || null
    : null;
  const repCode = adminStaffView ? session?.adminViewRep ?? null : isSales ? session?.repCode ?? session?.empId ?? null : null;
  const adminAll = isAdmin && !dealerCode && !repCode;
  const source = adminAll ? tab : null;
  const key = `${dealerCode ?? ""}|${repCode ?? ""}|${source ?? ""}`;

  useEffect(() => {
    if (!ready || !session) return;
    if (!isAdmin && !dealerCode && !repCode) return;
    let cancelled = false;
    fetchProductSales({ dealerCode, repCode, source })
      .then((s) => !cancelled && setData({ key, s }))
      .catch(() => !cancelled && setData({ key, s: null }));
    return () => {
      cancelled = true;
    };
  }, [ready, session, isAdmin, dealerCode, repCode, source, key]);

  const s = data && data.key === key ? data.s : null;
  const loading = !data || data.key !== key;
  const months = useMemo(() => s?.months ?? [], [s]);
  const byPeriod = useMemo(() => new Map(months.map((m) => [m.period, m])), [months]);
  const years = yearsOf(months.map((m) => m.period));
  const curYear = String(new Date().getFullYear());
  const activeYear = year === undefined ? (years.includes(curYear) ? curYear : years[0] ?? null) : year;
  const shown = months.filter((m) => !activeYear || m.period.startsWith(activeYear)); // ใหม่ -> เก่า
  const chart = [...shown].reverse();
  const maxAmt = Math.max(1, ...chart.map((m) => m.amount));

  const nowP = curPeriod();
  const latest = months[0];
  const focus = (selected && byPeriod.get(selected)) || latest;
  const focusPeriod = focus?.period ?? null;

  if (!ready || !session) return null;

  // สรุปปี: เทียบเดือนเดียวกันปีก่อน (ไม่นับเดือนปัจจุบันที่ยังไม่ครบ)
  const ytd = shown.reduce((a, m) => a + m.amount, 0);
  const fullMonths = shown.filter((m) => m.period !== nowP);
  const ytdFull = fullMonths.reduce((a, m) => a + m.amount, 0);
  const lyBase = fullMonths.reduce((a, m) => a + (byPeriod.get(lyPeriod(m.period))?.amount ?? 0), 0);
  const hasLy = fullMonths.length > 0 && fullMonths.every((m) => byPeriod.has(lyPeriod(m.period)));
  const avg = fullMonths.length ? ytdFull / fullMonths.length : 0;
  const lastFull = months.find((m) => m.period !== nowP);
  const yearGroups = (() => {
    const m = new Map<string, number>();
    (s?.groups ?? []).filter((g) => !activeYear || g.period.startsWith(activeYear)).forEach((g) => m.set(g.group, (m.get(g.group) ?? 0) + g.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();
  const topGroup = yearGroups[0];

  const focusGroups = s && focusPeriod ? groupsOf(s.groups, focusPeriod) : [];
  const people = s && focusPeriod
    ? s.people.filter((p) => p.period === focusPeriod).sort((a, b) => {
        const ua = !a.repCode && (!a.salesperson || a.salesperson === "ไม่ระบุ");
        const ub = !b.repCode && (!b.salesperson || b.salesperson === "ไม่ระบุ");
        return ua === ub ? b.amount - a.amount : ua ? 1 : -1;
      })
    : [];
  const stores = s && focusPeriod ? s.stores.filter((x) => x.period === focusPeriod).sort((a, b) => b.amount - a.amount) : [];
  const maxStore = Math.max(1, ...stores.map((x) => x.amount));
  const modelTotal = (model: string) => stores.filter((x) => x.model === model).reduce((a, x) => a + x.amount, 0);
  const modelCount = (model: string) => stores.filter((x) => x.model === model).length;
  const prevStores = s && focusPeriod ? s.stores.filter((x) => x.period === prevPeriod(focusPeriod)) : [];
  const prevModel = (model: string) => prevStores.filter((x) => x.model === model).reduce((a, x) => a + x.amount, 0);
  const unmapped = s && focusPeriod
    ? (() => {
        const m = new Map<string, number>();
        s.unmapped.filter((u) => u.period === focusPeriod).forEach((u) => m.set(u.sourceDealer ?? "", (m.get(u.sourceDealer ?? "") ?? 0) + u.amount));
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
      })()
    : [];
  const unmappedTotal = unmapped.reduce((a, [, v]) => a + v, 0);
  const unmappedAll = (s?.unmapped ?? []).reduce((a, u) => a + u.amount, 0);

  const sourceText = (s?.sources ?? []).map((x) => SOURCE_LABEL[x]).join(" + ");
  const scopeLabel = isSales ? "ยอดที่คุณขาย" : dealerCode ? "ยอดขายของร้าน" : "ยอดขายสินค้า · ทุกร้าน";
  const latestDate = s?.latestDate ? new Date(s.latestDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : null;
  const ytdLabel = activeYear ? `ยอดขายสะสมปี ${Number(activeYear) + 543}` : "ยอดขายสะสมทุกปี";

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link href={homeHref} aria-label="กลับ" className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">ยอดขายสินค้า</span>
        </div>
        <button
          onClick={() => {
            doLogout();
            router.replace("/");
          }}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[#a11119] bg-white border border-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition"
        >
          <Icon name="logout" style={{ fontSize: 16 }} />
          ออกจากระบบ
        </button>
      </header>

      <div className="space-y-4 pb-4">
        <ProfileCard />

        {/* แท็บแหล่งข้อมูล (admin ทุกร้าน) */}
        {adminAll && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="แหล่งข้อมูล">
            {([null, "di", "odoo"] as (PsSource | null)[]).map((t) => (
              <button
                key={t ?? "all"}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setAllStores(false);
                }}
                className={cn(
                  "rounded-lg py-1.5 text-[12px] font-bold transition",
                  tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t === null ? "ทั้งหมด" : t === "di" ? "Housing Expert" : "SCG Home"}
              </button>
            ))}
          </div>
        )}

        {/* Hero */}
        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
              <Icon name="shopping_cart" style={{ fontSize: 16 }} />
              {scopeLabel} · {ytdLabel}
            </p>
            <p className="tnum text-[32px] font-bold leading-none mt-1">{loading ? "…" : baht(ytd)}</p>
            {!loading && activeYear && (
              <div className="mt-1.5">
                <Delta cur={ytdFull} base={hasLy ? lyBase : null} label="เทียบช่วงเดียวกันปีก่อน" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2">
                <p className="text-[10.5px] text-red-100/80">เดือนล่าสุดที่ครบ</p>
                <p className="tnum text-[14px] font-bold leading-tight mt-0.5">{lastFull ? mil(lastFull.amount) : "-"}</p>
                <p className="text-[10px] text-red-100/70">{lastFull ? monthFull(lastFull.period) : ""}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2">
                <p className="text-[10.5px] text-red-100/80">เฉลี่ย/เดือน</p>
                <p className="tnum text-[14px] font-bold leading-tight mt-0.5">{avg ? mil(avg) : "-"}</p>
                <p className="text-[10px] text-red-100/70">{fullMonths.length} เดือน</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2 min-w-0">
                <p className="text-[10.5px] text-red-100/80">กลุ่มอันดับ 1</p>
                <p className="text-[12.5px] font-bold leading-tight mt-0.5 truncate" title={topGroup?.[0]}>{topGroup?.[0] ?? "-"}</p>
                <p className="text-[10px] text-red-100/70">{topGroup && ytd ? `${((topGroup[1] / ytd) * 100).toFixed(0)}% ของยอด` : ""}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
          แหล่งข้อมูล <b className="text-slate-700">{sourceText || "-"}</b>
          {(() => {
            const ft = freshText(fresh, (s?.sources ?? []).map((x) => (x === "di" ? "product-di" : "product-odoo")));
            return ft ? <> · <span className={ft.stale ? "text-amber-600 font-semibold" : ""}>{ft.text}</span></> : latestDate ? <> · ข้อมูลถึง {latestDate}</> : null;
          })()}
          {isSales && <> · นับเฉพาะรายการที่ชื่อผู้ขายในระบบร้านตรงกับชื่อของคุณ</>}
        </div>

        <YearChips years={years} activeYear={activeYear} onSelect={(y) => { setYear(y); setSelected(null); }} />

        {/* กราฟรายเดือน */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 mb-3">
            <Icon name="bar_chart" className="text-lg text-[#d32029]" />
            ยอดขายรายเดือน
          </h3>
          {loading ? (
            <div className="py-8 text-center text-slate-300"><Icon name="progress_activity" className="animate-spin text-3xl" /></div>
          ) : chart.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-500">ยังไม่มีข้อมูลยอดขาย</p>
          ) : (
            <>
              <div className="flex items-end gap-1 h-36 overflow-x-auto no-scrollbar">
                {chart.map((m) => {
                  const active = m.period === focusPeriod;
                  const partial = m.period === nowP;
                  const h = Math.max(3, (m.amount / maxAmt) * 100);
                  return (
                    <button
                      key={m.period}
                      type="button"
                      onClick={() => setSelected(m.period)}
                      aria-pressed={active}
                      aria-label={`${monthFull(m.period)} ${baht(m.amount)}`}
                      className="flex-1 min-w-[26px] h-full flex flex-col justify-end items-center group"
                    >
                      <span className={cn("tnum text-[9px] mb-0.5", active ? "text-[#a11119] font-bold" : "text-slate-400")}>
                        {(m.amount / 1e6).toFixed(m.amount >= 1e7 ? 0 : 1)}
                      </span>
                      <span
                        className={cn(
                          "w-full rounded-t-md transition-all duration-500",
                          active ? "bg-[#d32029]" : partial ? "bg-red-200 border border-dashed border-red-300" : "bg-red-300/80 group-hover:bg-red-400"
                        )}
                        style={{ height: `${h}%` }}
                      />
                      <span className={cn("text-[10px] mt-1", active ? "text-[#a11119] font-bold" : "text-slate-500")}>{monthShort(m.period)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10.5px] text-slate-400 mt-2">หน่วย: ล้านบาท · กดที่แท่งเพื่อดูรายละเอียดเดือนนั้น{chart.some((m) => m.period === nowP) ? " · แท่งเส้นประ = เดือนปัจจุบัน (ยังไม่ครบเดือน)" : ""}</p>
            </>
          )}
        </section>

        {focus && !loading && (
          <>
            <div className="flex items-end justify-between px-0.5">
              <h3 className="text-[15px] font-bold text-slate-900">{monthFull(focus.period)}</h3>
              <div className="text-right">
                <p className="tnum text-[15px] font-bold text-slate-900">{baht(focus.amount)}</p>
                <p className="text-[10.5px] text-slate-500">
                  {focus.lines.toLocaleString("th-TH")} รายการ
                  {byPeriod.get(prevPeriod(focus.period)) && focus.period !== nowP && (() => {
                    const p = byPeriod.get(prevPeriod(focus.period))!.amount;
                    const pct = p ? ((focus.amount - p) / Math.abs(p)) * 100 : 0;
                    return <span className={cn("ml-1 font-semibold", pct >= 0 ? "text-emerald-600" : "text-rose-600")}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% จากเดือนก่อน</span>;
                  })()}
                </p>
              </div>
            </div>

            {/* admin: สรุปตามโมเดล + อันดับร้าน + ไม่ระบุร้าน */}
            {adminAll && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(["Housing Expert", "SCG Home"] as const)
                    .filter((md) => !tab || (tab === "di" ? md === "Housing Expert" : md === "SCG Home"))
                    .map((md) => {
                      const v = modelTotal(md), pv = prevModel(md);
                      const pct = pv ? ((v - pv) / Math.abs(pv)) * 100 : null;
                      return (
                        <div key={md} className={cn("rounded-2xl border p-3", md === "SCG Home" ? "bg-blue-50/60 border-blue-100" : "bg-red-50/60 border-red-100", tab && "col-span-2")}>
                          <p className="text-[11px] text-slate-600">{md} · {modelCount(md)} ร้าน</p>
                          <p className="tnum text-[18px] font-bold text-slate-900 leading-tight mt-0.5">{mil(v)}</p>
                          {pct != null && focus.period !== nowP && (
                            <p className={cn("text-[10.5px] font-semibold", pct >= 0 ? "text-emerald-600" : "text-rose-600")}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% จากเดือนก่อน</p>
                          )}
                        </div>
                      );
                    })}
                </div>

                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 mb-2.5">
                    <Icon name="storefront" className="text-lg text-[#d32029]" />
                    อันดับร้าน
                  </h3>
                  <ul className="space-y-1">
                    {(allStores ? stores : stores.slice(0, 10)).map((x, i) => (
                      <li key={x.dealerCode}>
                        <button
                          type="button"
                          onClick={() => setDrill({ title: x.dealerName ?? x.dealerCode, period: focus.period, query: { dealerCode: x.dealerCode } })}
                          aria-label={`ดูกลุ่มสินค้าของ ${x.dealerName ?? x.dealerCode}`}
                          className="w-full text-left rounded-lg -mx-1.5 px-1.5 py-1.5 hover:bg-slate-50 active:bg-slate-100 transition"
                        >
                          <div className="flex items-center justify-between gap-2 text-[12px]">
                            <span className="truncate text-slate-800">
                              <span className="tnum text-slate-400 w-5 inline-block">{i + 1}</span>
                              <span className="font-semibold">{x.dealerName ?? x.dealerCode}</span>
                            </span>
                            <span className="shrink-0 tnum font-bold text-slate-900 inline-flex items-center">
                              {mil(x.amount)}
                              <Icon name="chevron_right" className="text-slate-300 text-lg ml-0.5" />
                            </span>
                          </div>
                          <div className="mt-1 pl-5"><Bar value={x.amount} max={maxStore} className={x.model === "SCG Home" ? "bg-blue-500" : "bg-[#d32029]"} /></div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {stores.length > 10 && (
                    <button type="button" onClick={() => setAllStores((v) => !v)} className="mt-2 w-full text-[12px] font-bold text-[#c3161c] bg-[#fee2e2]/60 rounded-xl py-2">
                      {allStores ? "ย่อ" : `ดูทั้งหมด ${stores.length} ร้าน`}
                    </button>
                  )}
                </section>

                {unmapped.length > 0 && (
                  <section className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13px] font-bold text-amber-900">ไม่ระบุร้าน · แยกจากยอดร้าน</h3>
                      <span className="tnum text-[13px] font-bold text-amber-900">{mil(unmappedTotal)}</span>
                    </div>
                    <p className="text-[11px] text-amber-700 mt-0.5">ยอดที่ไม่ได้ขายภายใต้ร้านในแอป (สำนักงานกลาง, Ecommerce, ร้านนอกแอป) · ร้านค้าไม่เห็นส่วนนี้</p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {unmapped.map(([code, v]) => (
                        <span key={code || "-"} className="text-[11px] rounded-full bg-amber-100 text-amber-900 px-2.5 py-1">
                          {code || "Promptplus"}{UNMAPPED_LABEL[code] ? ` ${UNMAPPED_LABEL[code]}` : ""} · <span className="tnum font-semibold">{mil(v)}</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-[10.5px] text-amber-700 mt-2">รวมทุกเดือน {mil(unmappedAll)}</p>
                  </section>
                )}
              </>
            )}

            {/* กลุ่มสินค้า */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 mb-3">
                <Icon name="category" className="text-lg text-[#d32029]" />
                กลุ่มสินค้า
                <span className="text-[11px] font-normal text-slate-400">({(s?.sources ?? []).includes("odoo") && !(s?.sources ?? []).includes("di") ? "MCH2" : (s?.sources ?? []).includes("di") && !(s?.sources ?? []).includes("odoo") ? "MISL5" : "DI MISL5 / Odoo MCH2"})</span>
              </h3>
              <GroupList key={`${key}|${focus.period}`} rows={focusGroups} total={focus.amount} />
            </section>

            {/* พนักงานขาย (มุมมองร้าน) */}
            {dealerCode && people.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 mb-2.5">
                  <Icon name="groups" className="text-lg text-[#d32029]" />
                  พนักงานขาย
                </h3>
                <ul className="divide-y divide-slate-50">
                  {people.map((p, i) => {
                    const label = personLabel(p);
                    const unknown = !p.repCode && (!p.salesperson || p.salesperson === "ไม่ระบุ");
                    return (
                      <li key={`${p.repCode ?? ""}|${p.salesperson ?? ""}`}>
                        <button
                          type="button"
                          onClick={() =>
                            setDrill({
                              title: label,
                              period: focus.period,
                              query: p.repCode ? { dealerCode, repCode: p.repCode } : { dealerCode, salesperson: p.salesperson ?? "ไม่ระบุ" },
                            })
                          }
                          aria-label={`ดูกลุ่มสินค้าของ ${label}`}
                          className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-slate-50 rounded-lg -mx-1.5 px-1.5 transition"
                        >
                          <span
                            className={cn(
                              "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold",
                              unknown ? "border border-dashed border-slate-300 text-slate-400" : i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {unknown ? "?" : i + 1}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className={cn("block truncate text-[12.5px]", unknown ? "text-slate-400" : "text-slate-800 font-semibold")}>
                              {label}
                              {p.repCode && <Icon name="verified" className="text-[#d32029] align-[-2px] ml-1" style={{ fontSize: 13 }} />}
                            </span>
                            <span className="block text-[10.5px] text-slate-400">{p.lines.toLocaleString("th-TH")} รายการ</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block tnum text-[13px] font-bold text-slate-900">{mil(p.amount)}</span>
                            <span className="block text-[10.5px] text-slate-400">{focus.amount ? ((p.amount / focus.amount) * 100).toFixed(0) : 0}%</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                  <Icon name="verified" className="text-[#d32029]" style={{ fontSize: 12 }} />
                  = พนักงานในระบบ · ชื่ออื่นเป็นชื่อผู้ขายตามระบบร้าน · กดชื่อเพื่อดูกลุ่มสินค้า
                </p>
              </section>
            )}
          </>
        )}
      </div>

      {drill && <DrillModal title={drill.title} period={drill.period} query={drill.query} onClose={() => setDrill(null)} />}

      <BottomNav active="home" />
    </>
  );
}
