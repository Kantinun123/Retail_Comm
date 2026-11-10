"use client";

/* =============================================================
   หน้าหลัก (Hub) พนักงานขาย — เห็นเฉพาะผลประโยชน์/ยอดขายของตัวเอง (scope ด้วย repCode)
   - ช่วงเวลาเดียวคุมทั้งหน้า (เดือนที่ครบล่าสุด เป็นค่าเริ่มต้น / สะสมปี) — แบบเดียวกับหน้าหลักร้าน
   - การ์ด: Product Commission (ผู้รับเงิน) · BA Commission · LHS Commission · แต้มกิจกรรม
     ไฟล์ของช่วงที่เลือกยังไม่มา -> "รอข้อมูล" + ยอดล่าสุด (ไม่ขึ้น ฿0)
   - ยอดขายของฉัน: สินค้า / LHS/Rudy / BA + ข้อมูลถึง · อัปเดต
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { doLogout, useSession } from "@/lib/commission/session";
import { ProfileCard } from "./profile-card";
import { fetchCommissionSummary, type CommissionSummary } from "@/lib/commission/commission-product-store";
import { fetchBaSummary, type BaSummary } from "@/lib/commission/ba-incentive-store";
import { fetchLhsSummary, type LhsSummary } from "@/lib/commission/lhs-commission-store";
import { fetchProductSales, type PsSummary } from "@/lib/commission/product-sales-store";
import { fetchServiceSalesSummary, type SsSummary } from "@/lib/commission/service-sales-store";
import { yearsOf } from "./year-filter";
import { ViewModeBar } from "./view-mode-bar";
import { PeriodBar, defaultPick, toView, type PeriodPick } from "./hub-period";
import {
  currentPeriod,
  fetchFreshness,
  freshText,
  monthlyValue,
  periodShort,
  viewLabel,
  type DailyJob,
  type Freshness,
  type HubView,
  type MonthlySource,
  type SourceValue,
} from "@/lib/commission/freshness-store";

function baht(n: number | null): string {
  if (n === null) return "—";
  return "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

interface CardData {
  key: string;
  href: string;
  icon: string;
  label: string;
  sub: string;
  total: number | null;
  loading: boolean;
  pct?: number | null;
  waiting?: { label: string; latest: { period: string; amount: number } | null } | null;
  zeroNote?: string | null;
  foot?: string | null;
}

function HubCard({ c }: { c: CardData }) {
  if (c.waiting && !c.loading) {
    return (
      <Link
        href={c.href}
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5 flex flex-col justify-between min-h-[118px] active:scale-[0.98] hover:border-slate-400 hover:-translate-y-0.5 transition-all"
      >
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl bg-white text-slate-400 flex items-center justify-center shrink-0">
            <Icon name={c.icon} style={{ fontSize: 19 }} />
          </div>
          <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
        </div>
        <div className="mt-2">
          <p className="text-[12.5px] font-bold leading-tight text-slate-600">{c.label}</p>
          <span className="inline-block mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] font-bold text-amber-800">⏳ {c.waiting.label}</span>
          <p className="text-[10px] text-slate-500 mt-1">
            {c.waiting.latest ? <>ล่าสุด {periodShort(c.waiting.latest.period)} <b className="tnum text-slate-700">{baht(c.waiting.latest.amount)}</b></> : "ยังไม่มียอด"}
          </p>
          {c.foot && <p className="text-[9px] text-slate-400 mt-1.5">{c.foot}</p>}
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={c.href}
      className="rounded-2xl border border-slate-100 bg-white shadow-sm p-3.5 flex flex-col justify-between min-h-[118px] active:scale-[0.98] hover:border-red-200 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
          <Icon name={c.icon} style={{ fontSize: 19 }} />
        </div>
        <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
      </div>
      <div className="mt-2">
        <p className="text-[12.5px] font-bold leading-tight text-slate-900">{c.label}</p>
        <p className="text-[9.5px] leading-tight mt-0.5 text-slate-400">{c.sub}</p>
        {c.total !== null && (
          <>
            <p className={"tnum text-[15px] font-bold mt-1 " + (!c.loading && c.total === 0 ? "text-slate-300" : "text-[#a11119]")}>
              {c.loading ? "…" : baht(c.total)}
            </p>
            {!c.loading && c.total !== 0 && c.pct != null && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-[#f0e3e4] overflow-hidden">
                  <div className="h-full rounded-full bg-[#d32029]" style={{ width: `${Math.max(2, Math.round(c.pct))}%` }} />
                </div>
                <span className="tnum text-[10px] font-bold text-[#d32029] shrink-0">{Math.round(c.pct)}%</span>
              </div>
            )}
            {!c.loading && c.total === 0 && c.zeroNote && <p className="text-[9.5px] text-slate-400 mt-0.5">{c.zeroNote}</p>}
          </>
        )}
        {!c.loading && c.foot && <p className="text-[9px] text-slate-400 mt-1.5">{c.foot}</p>}
      </div>
    </Link>
  );
}

export function HomeStaffHubScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  // sales = ตัวเอง ; admin ที่ "ดูในมุมมองพนักงาน" = rep ที่เลือก
  const adminStaffView = !!session?.isAdmin && session.adminViewMode === "staff" && !!session.adminViewRep;
  const repCode = adminStaffView ? session!.adminViewRep : (session?.repCode ?? null);

  const [cp, setCp] = useState<CommissionSummary | null>(null);
  const [ba, setBa] = useState<BaSummary | null>(null);
  const [lhsSum, setLhsSum] = useState<LhsSummary | null>(null);
  const [prodSales, setProdSales] = useState<PsSummary | null>(null);
  const [ssRudy, setSsRudy] = useState<SsSummary | null>(null);
  const [ssBa, setSsBa] = useState<SsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState<PeriodPick>(defaultPick);
  const [fresh, setFresh] = useState<Freshness | null>(null);

  // หน้านี้เฉพาะพนักงานขาย (หรือ admin ที่กำลังดูมุมมองพนักงาน); role อื่นกลับหน้าของตัวเอง
  useEffect(() => {
    if (ready && session && !session.isSales && !adminStaffView) {
      router.replace("/app/home");
    }
  }, [ready, session, router, adminStaffView]);

  useEffect(() => {
    let cancelled = false;
    fetchFreshness().then((f) => !cancelled && setFresh(f));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!repCode) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      fetchCommissionSummary(null, repCode),
      fetchBaSummary(null, repCode),
      fetchLhsSummary(null, repCode),
      fetchProductSales({ repCode, lite: true }),
      fetchServiceSalesSummary(null, "rudy", repCode),
      fetchServiceSalesSummary(null, "ba", repCode),
    ]).then((res) => {
      if (cancelled) return;
      if (res[0].status === "fulfilled") setCp(res[0].value);
      if (res[1].status === "fulfilled") setBa(res[1].value);
      if (res[2].status === "fulfilled") setLhsSum(res[2].value);
      if (res[3].status === "fulfilled") setProdSales(res[3].value);
      if (res[4].status === "fulfilled") setSsRudy(res[4].value.ok ? res[4].value : null);
      if (res[5].status === "fulfilled") setSsBa(res[5].value.ok ? res[5].value : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repCode]);

  if (!ready || !session) return null;
  if (!session.isSales && !adminStaffView) return null;

  const view = toView(pick);
  const viewTitle = viewLabel(view);
  const curP = currentPeriod();
  const fm = fresh?.monthly ?? {};
  const years = yearsOf([curP, ...[...(cp?.months ?? []), ...(ba?.months ?? []), ...(lhsSum?.months ?? [])].map((m) => m.period)]);

  // ผลประโยชน์ (ไฟล์รายเดือน)
  const src: { key: MonthlySource; months: { period: string; amount: number }[] }[] = [
    { key: "product-commission", months: (cp?.months ?? []).map((m) => ({ period: m.period, amount: m.net })) },
    { key: "ba-commission", months: (ba?.months ?? []).map((m) => ({ period: m.period, amount: m.incentive })) },
    { key: "lhs-commission", months: (lhsSum?.months ?? []).map((m) => ({ period: m.period, amount: m.payment })) },
  ];
  const vals: SourceValue[] = src.map((s) => monthlyValue(s.months, view, fm[s.key]));
  const waiting = vals.filter((v) => v.waiting).length;
  const myTotal = waiting === vals.length ? null : vals.reduce((a, v) => a + (v.amount ?? 0), 0);
  const pctOf = (v: number | null) => (v == null || myTotal == null || myTotal <= 0 ? null : (v / myTotal) * 100);
  const waitLabel = view.mode === "month" ? `รอข้อมูล ${periodShort(view.period)}` : "รอข้อมูล";
  const meta = [
    { key: "comm-product", href: "/app/commission-product", icon: "payments", label: "Product Commission", sub: "จากการขายสินค้าที่หน้าร้าน" },
    { key: "ba-inc", href: "/app/ba-incentive", icon: "home_repair_service", label: "BA Commission", sub: "จากการขายงานบริการคิวช่าง" },
    { key: "lhs", href: "/app/lhs-commission", icon: "roofing", label: "LHS Commission", sub: "จากการขายงานบริการหลังคา SCG & Onnex" },
  ];
  const cards: CardData[] = [
    ...meta.map((m, i) => ({
      ...m,
      loading,
      total: vals[i].amount,
      pct: pctOf(vals[i].amount),
      waiting: vals[i].waiting ? { label: waitLabel, latest: vals[i].latest } : null,
      zeroNote: view.mode === "month" ? "ไม่มียอดเดือนนี้" : "ไม่มียอดในปีนี้",
      foot: vals[i].dataUntil ? `ข้อมูลถึงเดือน ${periodShort(vals[i].dataUntil!)}` : null,
    })),
    { key: "points", href: "/app/points", icon: "emoji_events", label: "แต้มกิจกรรม", sub: "แต้มสะสม", total: null, loading: false },
  ];
  const completeness = fresh
    ? (p: string) => ({ total: src.length, have: src.filter((s) => !!fm[s.key] && p <= (fm[s.key] as string)).length })
    : undefined;

  // ยอดขายของฉัน (รายวัน)
  const amountIn = (months: { period: string; amount: number }[] | undefined, v: HubView) =>
    (months ?? []).filter((m) => (v.mode === "month" ? m.period === v.period : m.period.startsWith(v.year + "-"))).reduce((a, m) => a + m.amount, 0);
  const prodJobs: DailyJob[] = (prodSales?.sources ?? []).map((s) => (s === "di" ? "product-di" : "product-odoo"));
  const salesRows = [
    { data: prodSales?.months, jobs: prodJobs, href: "/app/product-sales", icon: "shopping_cart", label: "ยอดขายสินค้า", sub: "แยกกลุ่มสินค้า" },
    { data: ssRudy?.months, jobs: ["lhs"] as DailyJob[], href: "/app/service-sales/lhs", icon: "roofing", label: "ยอดขาย LHS/Rudy", sub: "งานบริการหลังคา (รวม VAT)" },
    { data: ssBa?.months, jobs: ["ba"] as DailyJob[], href: "/app/service-sales/ba", icon: "home_repair_service", label: "ยอดขาย BA", sub: "งานบริการคิวช่าง (gmv)" },
  ]
    .filter((r) => (r.data?.length ?? 0) > 0)
    .map((r) => ({ ...r, total: amountIn(r.data, view), fresh: freshText(fresh, r.jobs) }));

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <span className="font-bold text-[16px] text-[#231313]">หน้าหลัก</span>
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

      <div className="space-y-5 pb-4">
        {session.isAdmin && <ViewModeBar />}

        {adminStaffView && session.adminViewRepName && (
          <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 text-[12px] text-violet-800 flex items-center gap-1.5">
            <Icon name="visibility" style={{ fontSize: 15 }} />
            กำลังดูมุมมองพนักงาน: <span className="font-bold">{session.adminViewRepName}</span>
          </div>
        )}

        <ProfileCard />

        <PeriodBar pick={pick} onChange={setPick} years={years} completeness={completeness} />

        <section>
          <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
            <Icon name="account_circle" style={{ fontSize: 16 }} />
            ผลประโยชน์ของฉัน · {view.mode === "month" ? periodShort(view.period) : viewTitle}
          </h3>

          <div className="rounded-2xl bg-gradient-to-br from-[#8f1114] to-[#d32029] text-white p-4 shadow-md shadow-[#d32029]/20 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-red-100/90 leading-tight">{waiting ? "รวมที่มาแล้ว" : "รวมผลประโยชน์ของฉัน"}</p>
                <p className="text-[9.5px] text-red-100/70 leading-tight">
                  {view.mode === "month" ? viewTitle : `ยอด${viewTitle}`} · จ่ายจริง{waiting ? ` · รอข้อมูล ${waiting} แหล่ง` : ""}
                </p>
              </div>
              <p className="tnum text-[22px] font-bold leading-none shrink-0">{loading ? "…" : myTotal == null ? "รอข้อมูล" : baht(myTotal)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            {cards.map((c) => (
              <HubCard key={c.key} c={c} />
            ))}
          </div>
        </section>

        {salesRows.length > 0 && (
          <section>
            <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
              <Icon name="trending_up" style={{ fontSize: 16 }} />
              ยอดขายของฉัน · {view.mode === "month" ? periodShort(view.period) : viewTitle}
              {view.mode === "month" && view.period === curP && <span className="text-[10.5px] font-normal text-slate-400">(ถึงวันนี้)</span>}
            </h3>
            <div className="space-y-2">
              {salesRows.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="rounded-2xl border border-slate-100 bg-white shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] hover:border-red-200 hover:-translate-y-0.5 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                    <Icon name={r.icon} style={{ fontSize: 20 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 leading-tight">{r.label}</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{r.sub}</p>
                    {r.fresh && (
                      <p className={"text-[9.5px] leading-tight mt-0.5 " + (r.fresh.stale ? "text-amber-600 font-semibold" : "text-slate-400")}>{r.fresh.text}</p>
                    )}
                  </div>
                  <p className={"tnum text-[16px] font-bold shrink-0 " + (!loading && r.total === 0 ? "text-slate-300" : "text-[#a11119]")}>{loading ? "…" : baht(r.total)}</p>
                  <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="text-[11px] text-slate-400 text-center">
          แสดงเฉพาะของคุณ · ทุกการ์ดตามช่วงเวลาด้านบน ({viewTitle})
        </p>
      </div>

      <BottomNav active="home" />
    </>
  );
}
