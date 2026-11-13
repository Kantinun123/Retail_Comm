"use client";

/* =============================================================
   หน้าหลัก (Hub) — เฉพาะร้านค้าตัวแทน (dealer)
   การ์ด 2 กลุ่ม: ผลประโยชน์ร้านค้า / ผลประโยชน์พนักงานของร้าน
   แต่ละการ์ดโชว์ยอดสรุปของระบบนั้น (ดึง summary ขนานกัน)
   - admin/sales ยังใช้ /app/dashboard เดิม (หน้านี้เผื่อ dealer เป็นหลัก)
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { doLogout, useSession } from "@/lib/commission/session";
import { ProfileCard } from "./profile-card";
import { fetchBackMarginSummary, type BackMarginSummary } from "@/lib/commission/back-margin-store";
import { fetchProfitShareSummary, type ProfitShareSummary } from "@/lib/commission/ba-profit-share-store";
import { fetchCommissionSummary, type CommissionSummary } from "@/lib/commission/commission-product-store";
import { fetchBaSummary, type BaSummary } from "@/lib/commission/ba-incentive-store";
import { fetchLhsSummary, type LhsSummary } from "@/lib/commission/lhs-commission-store";
import { fetchPdSummary, type PdSummary } from "@/lib/commission/lhs-purchase-discount-store";
import { fetchEvalSummary, type EvalSummary } from "@/lib/commission/store-eval-store";
import { fetchCustSatSummary, type CsSummary } from "@/lib/commission/cust-sat-store";
import { fetchServiceSalesSummary, type SsSummary } from "@/lib/commission/service-sales-store";
import { fetchDesignIntake, type DiSummary } from "@/lib/commission/design-intake-store";
import { fetchProductSales, type PsSummary } from "@/lib/commission/product-sales-store";
import { PRODUCT_GROUP6, fetchTargets, tgTotals, type TgCompare } from "@/lib/commission/targets-store";
import { withPeriod } from "@/lib/commission/linked-period";
import { LyText, TargetBar, TargetProgress } from "./target-progress";
import { pctLabel, tgTone } from "@/lib/commission/targets-store";
import { yearsOf } from "./year-filter";
import { ViewModeBar } from "./view-mode-bar";
import { EmployeeRequestCard } from "./employee-request-card";
import { AttentionList, MonthOverview, PerformanceCards, buildAttention, perfStatus, useLatestEvalFails } from "./home-performance";
import { PeriodBar, defaultPick, toView, type PeriodPick } from "./hub-period";
import {
  currentPeriod,
  fetchFreshness,
  freshText,
  lastFullPeriod,
  monthlyValue,
  periodShort,
  prevPeriod,
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
  /** ยอดสรุป (null = ไม่โชว์ยอด เช่น หน้ารวม/แต้ม) */
  total: number | null;
  loading: boolean;
  accent?: boolean; // การ์ด "รวม" เน้นพิเศษ
  /** สัดส่วน % เทียบยอดรวมในกลุ่ม (null = ไม่โชว์ เช่น แต้ม) */
  pct?: number | null;
  /** ข้อความแสดงแทนยอดเงิน (เช่น "95%") — ถ้าตั้งไว้จะไม่โชว์ progress bar */
  display?: string | null;
  /** ป้ายสถานะ เช่น ผ่าน/ไม่ผ่าน */
  badge?: { text: string; pass: boolean } | null;
  /** ไฟล์ของช่วงที่เลือกยังไม่มา -> แสดง "รอข้อมูล" + ยอดล่าสุดของร้าน */
  waiting?: { label: string; latest: { period: string; amount: number } | null } | null;
  /** ข้อความใต้ยอด ฿0 (เช่น "ไม่มียอดของร้านเดือนนี้") */
  zeroNote?: string | null;
  /** บรรทัดเล็กท้ายการ์ด: ข้อมูลถึง / อัปเดต */
  foot?: { text: string; warn?: boolean } | null;
}

function CardFoot({ foot }: { foot: CardData["foot"] }) {
  if (!foot) return null;
  return (
    <p className={"text-[9px] leading-tight mt-1.5 flex items-center gap-0.5 " + (foot.warn ? "text-amber-600 font-semibold" : "text-slate-400")}>
      <Icon name={foot.warn ? "warning" : "schedule"} style={{ fontSize: 11 }} />
      {foot.text}
    </p>
  );
}

function HubCard({ c }: { c: CardData }) {
  if (c.waiting && !c.loading) {
    return (
      <Link
        href={c.href}
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5 flex flex-col justify-between min-h-[118px] active:scale-[0.98] hover:border-slate-400 hover:-translate-y-0.5 transition-all"
      >
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white text-slate-400">
            <Icon name={c.icon} style={{ fontSize: 19 }} />
          </div>
          <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
        </div>
        <div className="mt-2">
          <p className="text-[12.5px] font-bold leading-tight text-slate-600">{c.label}</p>
          <span className="inline-block mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] font-bold text-amber-800">⏳ {c.waiting.label}</span>
          <p className="text-[10px] text-slate-500 mt-1">
            {c.waiting.latest ? <>ล่าสุด {periodShort(c.waiting.latest.period)} <b className="tnum text-slate-700">{baht(c.waiting.latest.amount)}</b></> : "ร้านนี้ยังไม่มียอด"}
          </p>
          <CardFoot foot={c.foot} />
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={c.href}
      className={
        "rounded-2xl border shadow-sm p-3.5 flex flex-col justify-between min-h-[118px] active:scale-[0.98] transition " +
        (c.accent
          ? "bg-gradient-to-br from-[#8f1114] to-[#d32029] text-white border-transparent shadow-[#d32029]/25 hover:shadow-lg"
          : "bg-white border-slate-100 hover:border-red-200")
      }
    >
      <div className="flex items-start justify-between">
        <div
          className={
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 " +
            (c.accent ? "bg-white/15 text-white" : "bg-red-50 text-[#d32029]")
          }
        >
          <Icon name={c.icon} style={{ fontSize: 19 }} />
        </div>
        <Icon
          name="chevron_right"
          className={c.accent ? "text-white/70" : "text-slate-300"}
          style={{ fontSize: 18 }}
        />
      </div>
      <div className="mt-2">
        <p className={"text-[12.5px] font-bold leading-tight " + (c.accent ? "text-white" : "text-slate-900")}>
          {c.label}
        </p>
        <p className={"text-[9.5px] leading-tight mt-0.5 " + (c.accent ? "text-red-100/80" : "text-slate-400")}>
          {c.sub}
        </p>
        {c.display !== undefined && c.display !== null ? (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <p className={"tnum text-[15px] font-bold " + (c.accent ? "text-white" : "text-[#a11119]")}>
              {c.loading ? "…" : c.display}
            </p>
            {!c.loading && c.badge && (
              <span className={
                "px-1.5 py-0.5 rounded-full text-[9px] font-bold " +
                (c.badge.pass ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-[#d32029]")
              }>
                {c.badge.text}
              </span>
            )}
          </div>
        ) : c.total !== null ? (
          <>
            <p
              className={
                "tnum text-[15px] font-bold mt-1 " +
                (c.loading
                  ? c.accent ? "text-white" : "text-[#a11119]"
                  : c.total === 0
                    ? "text-slate-300"
                    : c.accent ? "text-white" : "text-[#a11119]")
              }
            >
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
        ) : null}
        {!c.loading && <CardFoot foot={c.foot} />}
      </div>
    </Link>
  );
}

/** แถบสรุปยอดรวมของกลุ่ม (hero เล็ก) — กดเข้าหน้ารวมรายเดือน */
function SummaryBar({
  icon,
  label,
  total,
  loading,
  note,
  href,
  display,
  fresh,
}: {
  icon: string;
  label: string;
  total: number | null;
  loading: boolean;
  note?: string;
  href: string;
  /** ข้อความแทนยอด (เช่น "รอข้อมูล") */
  display?: string | null;
  /** ข้อมูลถึง / อัปเดต */
  fresh?: { text: string; stale: boolean } | null;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl bg-gradient-to-br from-[#8f1114] to-[#d32029] text-white p-4 shadow-md shadow-[#d32029]/20 relative overflow-hidden active:scale-[0.99] hover:shadow-lg transition"
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Icon name={icon} style={{ fontSize: 19 }} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-red-100/90 leading-tight">{label}</p>
            {note && <p className="text-[9.5px] text-red-100/70 leading-tight">{note}</p>}
            {fresh && (
              <p className={"text-[9.5px] leading-tight mt-0.5 flex items-center gap-0.5 " + (fresh.stale ? "text-amber-200 font-semibold" : "text-red-100/80")}>
                <Icon name={fresh.stale ? "warning" : "schedule"} style={{ fontSize: 11 }} />
                {fresh.text}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <p className="tnum text-[22px] font-bold leading-none">{loading ? "…" : display ?? baht(total)}</p>
          <Icon name="chevron_right" className="text-white/70" style={{ fontSize: 20 }} />
        </div>
      </div>
    </Link>
  );
}

export function HomeHubScreen() {
  const { session, ready } = useSession();
  const router = useRouter();

  // ร้านที่ดู:
  //  - dealer      = ร้านตัวเอง
  //  - admin       = Hub แบบ "ทุกร้าน" (dealerCode = null) หรือร้านที่เจาะผ่าน storeFilter
  //  - admin เจาะมุมมองร้านค้า (store view) = ร้านที่เลือก
  const adminStoreView = !!session?.isAdmin && session.adminViewMode === "store" && !!session.adminViewDealer;
  const dealerCode = session
    ? session.isAdmin
      ? (adminStoreView ? session.adminViewDealer : session.storeFilter)
      : !session.isSales
        ? session.dealer.code
        : null
    : null;

  // Hub = หน้าแรกของ dealer + admin (admin เห็นเวอร์ชันทุกร้าน) ; sales -> Hub พนักงาน
  useEffect(() => {
    if (ready && session && session.isSales) router.replace("/app/home-staff");
  }, [ready, session, router]);

  // summary เต็มแต่ละระบบ (เก็บ months ไว้กรองปี)
  const [bm, setBm] = useState<BackMarginSummary | null>(null);
  const [ps, setPs] = useState<ProfitShareSummary | null>(null);
  const [pd, setPd] = useState<PdSummary | null>(null);
  const [cp, setCp] = useState<CommissionSummary | null>(null);
  const [ba, setBa] = useState<BaSummary | null>(null);
  const [lhsSum, setLhsSum] = useState<LhsSummary | null>(null);
  const [evalSum, setEvalSum] = useState<EvalSummary | null>(null);
  const [csSum, setCsSum] = useState<CsSummary | null>(null);
  const [ssSum, setSsSum] = useState<SsSummary | null>(null);
  const [ssRudy, setSsRudy] = useState<SsSummary | null>(null);
  const [ssBa, setSsBa] = useState<SsSummary | null>(null);
  const [di, setDi] = useState<DiSummary | null>(null);
  const [prodSales, setProdSales] = useState<PsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // ช่วงเวลาเดียวคุมทั้งหน้า: ค่าเริ่มต้น = เดือนที่ครบล่าสุด
  const [pick, setPick] = useState<PeriodPick>(defaultPick);
  const [fresh, setFresh] = useState<Freshness | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFreshness().then((f) => !cancelled && setFresh(f));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      fetchBackMarginSummary(dealerCode),
      fetchProfitShareSummary(dealerCode),
      fetchCommissionSummary(dealerCode),
      fetchBaSummary(dealerCode),
      fetchLhsSummary(dealerCode),
      fetchPdSummary(dealerCode),
      fetchEvalSummary(dealerCode),
      fetchCustSatSummary(dealerCode),
      fetchServiceSalesSummary(dealerCode),
      fetchServiceSalesSummary(dealerCode, "rudy"),
      fetchServiceSalesSummary(dealerCode, "ba"),
      fetchDesignIntake({ dealerCode }),
      fetchProductSales({ dealerCode, lite: true }),
    ]).then((res) => {
      if (cancelled) return;
      if (res[0].status === "fulfilled") setBm(res[0].value);
      if (res[1].status === "fulfilled") setPs(res[1].value);
      if (res[2].status === "fulfilled") setCp(res[2].value);
      if (res[3].status === "fulfilled") setBa(res[3].value);
      if (res[4].status === "fulfilled") setLhsSum(res[4].value);
      if (res[5].status === "fulfilled") setPd(res[5].value);
      if (res[6].status === "fulfilled") setEvalSum(res[6].value);
      if (res[7].status === "fulfilled") setCsSum(res[7].value);
      if (res[8].status === "fulfilled") setSsSum(res[8].value);
      if (res[9].status === "fulfilled") setSsRudy(res[9].value);
      if (res[10].status === "fulfilled") setSsBa(res[10].value);
      if (res[11].status === "fulfilled") setDi(res[11].value);
      if (res[12].status === "fulfilled") setProdSales(res[12].value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  // ข้อที่ตกในการตรวจล่าสุด (เฉพาะดูร้านเดียว) — ใช้ในเรื่องที่ควรดู
  const evalFails = useLatestEvalFails(dealerCode, evalSum);

  // เป้า (TG) ของปีที่เลือก: ยอดขายงานบริการ + แบบรับเข้า (dealerCode ว่าง = admin ทุกร้าน)
  const tgYear = pick.mode === "month" ? pick.period.slice(0, 4) : pick.year;
  const tgKey = `${dealerCode ?? ""}|${tgYear}`;
  const [tgs, setTgs] = useState<{ key: string; svc: TgCompare | null; di: TgCompare | null; prod: TgCompare | null } | null>(null);
  useEffect(() => {
    if (!ready || !session) return;
    let cancelled = false;
    Promise.all([
      fetchTargets("service_sales", dealerCode, tgYear),
      fetchTargets("design_intake", dealerCode, tgYear),
      fetchTargets("product_sales", dealerCode, tgYear),
    ]).then(([svc, di2, prod]) => {
      if (!cancelled)
        setTgs({ key: tgKey, svc: svc.ok && svc.hasTarget ? svc : null, di: di2.ok && di2.hasTarget ? di2 : null, prod: prod.ok && prod.hasTarget ? prod : null });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, session, dealerCode, tgYear, tgKey]);

  if (!ready || !session) return null;

  // Back Margin + LHS Channel Discount = เฉพาะร้าน Housing Expert (SCG Home ซ่อน)
  // admin ที่ดู "ทุกร้าน" (ไม่เจาะร้าน) ให้แสดงทั้งคู่ (เพราะรวมทุกประเภท)
  const adminAllStores = session.isAdmin && !dealerCode;
  const isHousingExpert = session.dealer?.model === "Housing Expert";
  const showLhsDiscount = adminAllStores || isHousingExpert;
  const showBackMargin = adminAllStores || isHousingExpert;

  // ---- ช่วงเวลาที่เลือก (เดือน / สะสมปี) คุมทุกการ์ด ----
  const view = toView(pick);
  const viewTitle = viewLabel(view); // "ต.ค. 2569" | "สะสมปี 2569"
  const curP = currentPeriod();
  const fm = fresh?.monthly ?? {};
  const years = yearsOf([
    curP,
    ...(bm?.months ?? []), ...(ps?.months ?? []), ...(cp?.months ?? []), ...(ba?.months ?? []), ...(lhsSum?.months ?? []),
    ...(ssSum?.months ?? []), ...(prodSales?.months ?? []),
  ].map((m) => (typeof m === "string" ? m : m.period)));

  // แหล่งรายเดือน (ผลประโยชน์) -> ค่าในช่วงที่เลือก / รอข้อมูล / ฿0
  type Src = { key: MonthlySource; months: { period: string; amount: number }[] } | null;
  const srcBm: Src = showBackMargin ? { key: "back-margin", months: (bm?.months ?? []).map((m) => ({ period: m.period, amount: m.payoutTotal ?? m.lineTotal })) } : null;
  const srcPs: Src = { key: "profit-share-ba", months: (ps?.months ?? []).map((m) => ({ period: m.period, amount: m.profitShare })) };
  const srcPd: Src = showLhsDiscount ? { key: "lhs-discount", months: (pd?.months ?? []).map((m) => ({ period: m.period, amount: m.discount })) } : null;
  const srcCp: Src = { key: "product-commission", months: (cp?.months ?? []).map((m) => ({ period: m.period, amount: m.net })) };
  const srcBa: Src = { key: "ba-commission", months: (ba?.months ?? []).map((m) => ({ period: m.period, amount: m.incentive })) };
  const srcLhs: Src = { key: "lhs-commission", months: (lhsSum?.months ?? []).map((m) => ({ period: m.period, amount: m.payment })) };
  const valueOf = (s: Src, v: HubView = view): SourceValue | null => (s ? monthlyValue(s.months, v, fm[s.key]) : null);
  const agg = (vals: (SourceValue | null)[]) => {
    const live = vals.filter((v): v is SourceValue => !!v);
    const waiting = live.filter((v) => v.waiting).length;
    return { amount: live.length && waiting === live.length ? null : live.reduce((a, v) => a + (v.amount ?? 0), 0), waiting };
  };
  const pctChange = (cur: number | null, base: number | null) => (cur == null || !base ? null : ((cur - base) / Math.abs(base)) * 100);
  const prevView: HubView | null = view.mode === "month" ? { mode: "month", period: prevPeriod(view.period) } : null;

  const vBm = valueOf(srcBm), vPs = valueOf(srcPs), vPd = valueOf(srcPd);
  const vCp = valueOf(srcCp), vBa = valueOf(srcBa), vLhs = valueOf(srcLhs);
  const storeAgg = agg([vBm, vPs, vPd]);
  const empAgg = agg([vCp, vBa, vLhs]);
  const storePrev = prevView ? agg([valueOf(srcBm, prevView), valueOf(srcPs, prevView), valueOf(srcPd, prevView)]) : null;
  const storeDelta = storeAgg.waiting === 0 && storePrev && storePrev.waiting === 0 ? pctChange(storeAgg.amount, storePrev.amount) : null;

  const pctOf = (v: number | null, base: number | null) =>
    v == null || base == null || base <= 0 ? null : (v / base) * 100;
  const waitLabel = view.mode === "month" ? `รอข้อมูล ${periodShort(view.period)}` : "รอข้อมูล";
  // ลิงก์ไปหน้ารายละเอียด: แนบช่วงเวลาที่เลือก (?p= / ?y=) ให้หน้าปลายทางเปิดที่ช่วงเดียวกัน
  const lp = (href: string) => withPeriod(href, view);
  const benCard = (key: string, href: string, icon: string, label: string, sub: string, v: SourceValue | null, base: number | null): CardData | null =>
    v && {
      key, href: lp(href), icon, label, sub, loading,
      total: v.amount,
      pct: pctOf(v.amount, base),
      waiting: v.waiting ? { label: waitLabel, latest: v.latest } : null,
      zeroNote: view.mode === "month" ? "ไม่มียอดของร้านเดือนนี้" : "ไม่มียอดในปีนี้",
      foot: v.dataUntil ? { text: `ข้อมูลถึงเดือน ${periodShort(v.dataUntil)}` } : null,
    };

  // ยอดขาย (รายวัน) ในช่วงที่เลือก
  const amountIn = (months: { period: string; amount: number }[] | undefined, v: HubView) =>
    (months ?? []).filter((m) => (v.mode === "month" ? m.period === v.period : m.period.startsWith(v.year + "-"))).reduce((a, m) => a + m.amount, 0);
  const prodJobs: DailyJob[] = (prodSales?.sources ?? []).map((s) => (s === "di" ? "product-di" : "product-odoo"));
  const showProductSales = (prodSales?.months.length ?? 0) > 0;
  const showServiceSales = (ssSum?.count ?? 0) > 0;
  const productSalesTotal = amountIn(prodSales?.months, view);
  const serviceSalesTotal = amountIn(ssSum?.months, view);
  const salesRudy = amountIn(ssRudy?.months, view);
  const salesBa = amountIn(ssBa?.months, view);
  const salesPrevTotal = prevView ? amountIn(prodSales?.months, prevView) + amountIn(ssSum?.months, prevView) : null;
  // เดือนปัจจุบันยังไม่ครบ -> ไม่เทียบเดือนก่อน
  const salesDelta = view.mode === "month" && view.period !== curP ? pctChange(productSalesTotal + serviceSalesTotal, salesPrevTotal) : null;
  const productSalesSource = (prodSales?.sources ?? []).map((x) => (x === "di" ? "DI" : "Odoo")).join(" + ");
  const fr = (jobs: DailyJob[]) => freshText(fresh, jobs);
  const pctOfSales = (v: number) => (serviceSalesTotal > 0 ? (v / serviceSalesTotal) * 100 : null);
  const toFoot = (f: { text: string; stale: boolean } | null) => (f ? { text: f.text, warn: f.stale } : null);
  const salesCards: CardData[] = [
    ...((ssRudy?.count ?? 0) > 0
      ? [{ key: "sales-lhs", href: lp("/app/service-sales/lhs"), icon: "roofing", label: "ยอดขาย LHS/Rudy", sub: "งานบริการหลังคาและโซลูชัน (รวม VAT)", total: salesRudy, loading, pct: pctOfSales(salesRudy), foot: toFoot(fr(["lhs"])), zeroNote: "ไม่มียอดในช่วงนี้" } as CardData]
      : []),
    ...((ssBa?.count ?? 0) > 0
      ? [{ key: "sales-ba", href: lp("/app/service-sales/ba"), icon: "home_repair_service", label: "ยอดขาย BA", sub: "งานบริการคิวช่าง รายวัน (gmv)", total: salesBa, loading, pct: pctOfSales(salesBa), foot: toFoot(fr(["ba"])), zeroNote: "ไม่มียอดในช่วงนี้" } as CardData]
      : []),
  ];

  // ---- เป้า (TG) ตามช่วงที่เลือก: เดือน = เดือนนั้น ; สะสมปี = ถึงเดือนที่ครบล่าสุด ----
  const tgNow = tgs && tgs.key === tgKey ? tgs : null;
  const lfP = lastFullPeriod();
  const tgKeepView = (p: string) => (view.mode === "month" ? p === view.period : p.startsWith(view.year + "-") && p <= lfP);
  const tgLabel = view.mode === "month" ? periodShort(view.period) : view.year === lfP.slice(0, 4) ? `สะสมถึง ${periodShort(lfP)}` : `ทั้งปี`;
  const svcT = tgNow?.svc ? tgTotals(tgNow.svc.months, tgKeepView) : null;
  const diT = tgNow?.di ? tgTotals(tgNow.di.months, tgKeepView) : null;
  const svcGroupsT = tgNow?.svc
    ? ["ROOF SERVICE", "Qchang", "SMART SOLUTION"].map((g) => ({ g, t: tgTotals(tgNow.svc!.months, tgKeepView, g) })).filter((x) => x.t.target > 0)
    : [];
  const mil = (v: number) => (Math.abs(v) >= 1e6 ? `฿${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `฿${(v / 1e3).toFixed(0)}K` : baht(v));
  // เป้ายอดขายสินค้า: ACT = Retail ใน 6 กลุ่ม (ตาม Power BI)
  const prodT = tgNow?.prod ? tgTotals(tgNow.prod.months, tgKeepView) : null;
  const prodGroupsT = tgNow?.prod
    ? PRODUCT_GROUP6.map((g) => ({ g, t: tgTotals(tgNow.prod!.months, tgKeepView, g) })).filter((x) => x.t.target > 0)
    : [];

  // ---- ผลงานร้าน + เรื่องที่ควรดู (เรื่องที่ควรดูอิงข้อมูลล่าสุดเสมอ) ----
  const attention = adminAllStores ? [] : buildAttention({ evalSum, evalFails, csSum, di });
  const hasPerf = (evalSum?.count ?? 0) > 0 || (csSum?.count ?? 0) > 0 || (di?.months.length ?? 0) > 0;
  const status = adminAllStores ? null : perfStatus(attention, hasPerf);
  const attentionLoading = loading || (!!dealerCode && !!evalSum?.latest && evalFails === null);

  // จุดความครบของแต่ละเดือนในตัวเลือกเดือน (นับเฉพาะแหล่งที่ร้านนี้ใช้)
  const monthlyKeys = [srcBm, srcPs, srcPd, srcCp, srcBa, srcLhs].filter((s): s is NonNullable<Src> => !!s).map((s) => s.key);
  const completeness = fresh
    ? (p: string) => ({ total: monthlyKeys.length, have: monthlyKeys.filter((k) => !!fm[k] && p <= (fm[k] as string)).length })
    : undefined;

  // กลุ่มร้านค้า = ยอดเงินล้วน
  // LHS Channel Discount sync รายวัน (PO ที่ปิดแล้ว) -> แสดงเวลาอัปเดตแทน "ข้อมูลถึงเดือน"
  const pdCard = benCard("lhs-pd", "/app/lhs-purchase-discount", "sell", "LHS Channel Discount", "ส่วนลดช่องทาง 7% จาก PO ที่ปิดแล้ว (HE)", vPd, storeAgg.amount);
  if (pdCard) pdCard.foot = toFoot(fr(["lhs-discount"])) ?? pdCard.foot;
  const storeCards: CardData[] = [
    benCard("back-margin", "/app/back-margin", "savings", "Back Margin", "จากการขายสินค้าที่หน้าร้าน", vBm, storeAgg.amount),
    benCard("profit-ba", "/app/ba-profit-share", "storefront", "Profit Share BA", "จากการขายงานบริการคิวช่าง", vPs, storeAgg.amount),
    pdCard,
  ].filter((c): c is CardData => !!c);

  // กลุ่มพนักงาน
  const empCards: CardData[] = [
    benCard("comm-product", "/app/commission-product", "payments", "Product Commission", "จากการขายสินค้าที่หน้าร้าน", vCp, empAgg.amount),
    benCard("ba-inc", "/app/ba-incentive", "home_repair_service", "BA Commission", "จากการขายงานบริการคิวช่าง", vBa, empAgg.amount),
    benCard("lhs", "/app/lhs-commission", "roofing", "LHS Commission", "จากการขายงานบริการหลังคา SCG & Onnex", vLhs, empAgg.amount),
    { key: "points", href: "/app/points", icon: "emoji_events", label: "แต้มกิจกรรม", sub: "แต้มสะสม", total: null, loading: false },
  ].filter((c): c is CardData => !!c);
  const groupNote = (a: { waiting: number }) =>
    view.mode === "month" ? `${viewTitle}${a.waiting ? ` · รอข้อมูล ${a.waiting} แหล่ง` : ""}` : `ยอด${viewTitle}`;

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <span className="font-bold text-[16px] text-[#231313]">หน้าหลัก</span>
        <div className="flex items-center gap-2">
          <Link
            href="/app/change-password"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[#a11119] bg-white border border-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition"
          >
            <Icon name="key" style={{ fontSize: 16 }} />
            เปลี่ยนรหัสผ่าน
          </Link>
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
        </div>
      </header>

      <div className="space-y-5 pb-4">
        {/* แถบมุมมอง admin (เฉพาะ admin) — ดูหน้านี้ในมุมมองร้านค้า */}
        {session.isAdmin && <ViewModeBar />}

        {adminStoreView && (
          <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 text-[12px] text-violet-800 flex items-center gap-1.5">
            <Icon name="visibility" style={{ fontSize: 15 }} />
            กำลังดูมุมมองร้านค้า: <span className="font-bold">{session.dealer.name}</span>
          </div>
        )}

        {/* Area/Coach/หัวหน้า Area: ดูทีละร้าน — ทุกกล่องและหน้าที่เจาะเข้าไปกรองเฉพาะร้านนี้ */}
        {session.isArea && (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 px-3 py-2.5 flex items-center gap-2.5">
            <Icon name="visibility" className="text-blue-700 shrink-0" style={{ fontSize: 18 }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-blue-700">กำลังดูข้อมูลร้าน{session.areaName ? ` · ${session.areaName}` : ""}</p>
              <p className="text-[13px] font-bold text-blue-950 truncate">{session.dealer.name} ({session.dealer.code})</p>
            </div>
            <Link
              href="/app/stores"
              className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-[12px] font-bold text-blue-700 hover:-translate-y-0.5 transition-all"
            >
              เปลี่ยนร้าน
            </Link>
          </div>
        )}

        <ProfileCard />

        {/* Coach / Area: แจ้งพนักงานใหม่ของร้านที่กำลังดู (เลือกร้านไว้ให้) */}
        {session.isArea && <EmployeeRequestCard dealerCode={session.dealer.code} />}

        {/* ช่วงเวลาเดียวคุมทั้งหน้า (ติดด้านบนเวลาเลื่อน) */}
        <PeriodBar pick={pick} onChange={setPick} years={years} completeness={completeness} />

        {/* ภาพรวม → ผลงานร้าน → เรื่องที่ควรดู */}
        <MonthOverview
          loading={loading}
          title={viewTitle}
          benefit={{ amount: storeAgg.amount, waiting: storeAgg.waiting, deltaPct: storeDelta }}
          sales={{ product: productSalesTotal, service: serviceSalesTotal, deltaPct: salesDelta, fresh: fr([...prodJobs, "lhs", "ba"]) }}
          status={status}
          attention={attention}
          scopeAll={adminAllStores}
        />
        <PerformanceCards loading={loading} view={view} evalSum={evalSum} csSum={csSum} di={di} scopeAll={adminAllStores} diTarget={diT} />
        {!adminAllStores && hasPerf && <AttentionList loading={attentionLoading} items={attention} />}

        {/* กลุ่มร้านค้า (เงินล้วน) */}
        <section id="store-benefits" className="scroll-mt-28">
          <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
            <Icon name="storefront" style={{ fontSize: 16 }} />
            ผลประโยชน์ร้านค้า · {view.mode === "month" ? periodShort(view.period) : viewTitle}
          </h3>
          <SummaryBar
            icon="store"
            label={storeAgg.waiting ? "รวมที่มาแล้ว" : "รวมผลประโยชน์ร้านค้า"}
            total={storeAgg.amount}
            display={storeAgg.amount == null ? "รอข้อมูล" : null}
            loading={loading}
            note={groupNote(storeAgg)}
            href={lp("/app/benefit-store")}
          />
          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            {storeCards.map((c) => (
              <HubCard key={c.key} c={c} />
            ))}
          </div>
        </section>

        {/* กลุ่มพนักงาน */}
        <section>
          <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
            <Icon name="groups" style={{ fontSize: 16 }} />
            ผลประโยชน์พนักงานของร้าน · {view.mode === "month" ? periodShort(view.period) : viewTitle}
          </h3>
          <SummaryBar
            icon="groups"
            label={empAgg.waiting ? "รวมที่มาแล้ว" : "รวมผลประโยชน์พนักงาน"}
            total={empAgg.amount}
            display={empAgg.amount == null ? "รอข้อมูล" : null}
            loading={loading}
            note={`${groupNote(empAgg)} · จ่ายจริง`}
            href={lp("/app/benefit-staff")}
          />
          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            {empCards.map((c) => (
              <HubCard key={c.key} c={c} />
            ))}
          </div>
        </section>

        {/* กลุ่มยอดขาย */}
        {(showServiceSales || showProductSales) && (
          <section id="sales" className="scroll-mt-28">
            <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
              <Icon name="trending_up" style={{ fontSize: 16 }} />
              ยอดขาย · {view.mode === "month" ? periodShort(view.period) : viewTitle}
              {view.mode === "month" && view.period === curP && <span className="text-[10.5px] font-normal text-slate-400">(ถึงวันนี้)</span>}
            </h3>
            {showProductSales && (
              <div className={showServiceSales ? "mb-2.5" : ""}>
                <SummaryBar
                  icon="shopping_cart"
                  label="ยอดขายสินค้า"
                  total={productSalesTotal}
                  loading={loading}
                  note={`${productSalesSource} · แยกกลุ่มสินค้า/พนักงาน`}
                  fresh={fr(prodJobs)}
                  href={lp("/app/product-sales")}
                />
                {prodT && prodT.target > 0 && (
                  <Link
                    href={lp("/app/product-sales")}
                    className="mt-2.5 block rounded-2xl bg-white border border-slate-100 shadow-sm p-3.5 hover:border-red-200 hover:-translate-y-0.5 active:scale-[0.99] transition-all"
                  >
                    <p className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                      <Icon name="flag" className="text-[#d32029]" style={{ fontSize: 16 }} />
                      เป้ายอดขายสินค้า
                      {adminAllStores && <span className="text-[10px] font-normal text-slate-400">· ร้าน HE / SCG Home</span>}
                    </p>
                    <TargetProgress t={prodT} fmt={mil} label={tgLabel} partial={view.mode === "month" && view.period === curP} />
                    {prodGroupsT.length > 0 && (
                      <ul className="mt-2.5 pt-2 border-t border-slate-50 space-y-1.5">
                        {prodGroupsT.map(({ g, t }) => (
                          <li key={g}>
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-slate-700">{g}</span>
                              <span className="text-slate-500 tnum">
                                <b className="text-slate-900">{mil(t.actual)}</b> / {mil(t.target)} · <b className={tgTone(t.pct).text}>{pctLabel(t.pct)}</b>
                              </span>
                            </div>
                            <TargetBar pct={t.pct} className="mt-1" />
                          </li>
                        ))}
                      </ul>
                    )}
                    {!adminAllStores && productSalesTotal - prodT.actual > 1 && (
                      <p className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2 text-[10.5px] text-slate-600 leading-relaxed">
                        ยอดขายสินค้ารวม <b className="tnum">{mil(productSalesTotal)}</b> = Retail ใน 6 กลุ่ม (นับเป้า) <b className="tnum">{mil(prodT.actual)}</b> + Project / สินค้านอก 6 กลุ่ม (ไม่นับเป้า){" "}
                        <b className="tnum">{mil(productSalesTotal - prodT.actual)}</b>
                      </p>
                    )}
                    <p className="text-[9.5px] text-slate-400 mt-2 flex justify-between gap-2">
                      <span>เป้าไม่รวม VAT · ขอบเขตเดียวกับรายงาน Power BI</span>
                      <LyText t={prodT} fmt={mil} />
                    </p>
                  </Link>
                )}
              </div>
            )}
            {showServiceSales && (
              <SummaryBar
                icon="construction"
                label="รวมยอดขายงานบริการ"
                total={serviceSalesTotal}
                loading={loading}
                note="LHS/Rudy + BA · 3 กลุ่มงานบริการ"
                fresh={fr(["lhs", "ba"])}
                href={lp("/app/service-sales")}
              />
            )}
            {showServiceSales && svcT && svcT.target > 0 && (
              <Link
                href={lp("/app/service-sales")}
                className="mt-2.5 block rounded-2xl bg-white border border-slate-100 shadow-sm p-3.5 hover:border-red-200 hover:-translate-y-0.5 active:scale-[0.99] transition-all"
              >
                <p className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                  <Icon name="flag" className="text-[#d32029]" style={{ fontSize: 16 }} />
                  เป้ายอดขายงานบริการ
                  {adminAllStores && <span className="text-[10px] font-normal text-slate-400">· ร้าน HE / SCG Home</span>}
                </p>
                <TargetProgress t={svcT} fmt={mil} label={tgLabel} partial={view.mode === "month" && view.period === curP} />
                {svcGroupsT.length > 0 && (
                  <ul className="mt-2.5 pt-2 border-t border-slate-50 space-y-1.5">
                    {svcGroupsT.map(({ g, t }) => (
                      <li key={g}>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-700">{g}</span>
                          <span className="text-slate-500 tnum">
                            <b className="text-slate-900">{mil(t.actual)}</b> / {mil(t.target)} · <b className={tgTone(t.pct).text}>{pctLabel(t.pct)}</b>
                          </span>
                        </div>
                        <TargetBar pct={t.pct} className="mt-1" />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[9.5px] text-slate-400 mt-2 flex justify-between gap-2">
                  <span>เป้าไม่รวม VAT · ทำได้ = LHS/Rudy + BA ทุกงานจากระบบต้นทาง</span>
                  <LyText t={svcT} fmt={mil} />
                </p>
              </Link>
            )}
            {showServiceSales && salesCards.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                {salesCards.map((c) => (
                  <HubCard key={c.key} c={c} />
                ))}
              </div>
            )}
          </section>
        )}

        <p className="text-[11px] text-slate-400 text-center">
          ทุกการ์ดแสดงตามช่วงเวลาด้านบน ({viewTitle}) · &quot;รอข้อมูล&quot; = ไฟล์ของช่วงนี้ยังไม่มา
        </p>
      </div>

      <BottomNav active="home" />
    </>
  );
}
