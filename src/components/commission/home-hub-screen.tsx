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
import { YearChips, yearsOf, sumByYear } from "./year-filter";
import { ViewModeBar } from "./view-mode-bar";

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
}

function HubCard({ c }: { c: CardData }) {
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
          </>
        ) : null}
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
}: {
  icon: string;
  label: string;
  total: number | null;
  loading: boolean;
  note?: string;
  href: string;
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
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <p className="tnum text-[22px] font-bold leading-none">{loading ? "…" : baht(total)}</p>
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
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<string | null | undefined>(undefined); // undefined = ยังไม่ตั้ง

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
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  if (!ready || !session) return null;

  // Back Margin + LHS Channel Discount = เฉพาะร้าน Housing Expert (SCG Home ซ่อน)
  // admin ที่ดู "ทุกร้าน" (ไม่เจาะร้าน) ให้แสดงทั้งคู่ (เพราะรวมทุกประเภท)
  const adminAllStores = session.isAdmin && !dealerCode;
  const isHousingExpert = session.dealer?.model === "Housing Expert";
  const showLhsDiscount = adminAllStores || isHousingExpert;
  const showBackMargin = adminAllStores || isHousingExpert;

  // รวมทุก period จากทุกระบบ -> รายการปีที่มีข้อมูล
  const allPeriods = [
    ...(bm?.months ?? []),
    ...(ps?.months ?? []),
    ...(cp?.months ?? []),
    ...(ba?.months ?? []),
    ...(lhsSum?.months ?? []),
    ...(showLhsDiscount ? pd?.months ?? [] : []),
    ...(ssSum?.months ?? []),
  ].map((m) => m.period);
  const years = yearsOf(allPeriods);
  // ปีตั้งต้น = ปีปัจจุบัน ถ้ามีข้อมูล ไม่งั้นปีล่าสุด (null = ทุกปี เมื่อผู้ใช้เลือกเอง)
  const curYear = String(new Date().getFullYear());
  const activeYear =
    year === undefined ? (years.includes(curYear) ? curYear : years[0] ?? null) : year;
  const yearLabel = activeYear ? `ปี ${Number(activeYear) + 543}` : "ทุกปี";

  // ยอดแต่ละระบบ ตามปีที่เลือก (จ่ายจริง)
  const backMarginRaw = bm ? sumByYear(bm.months, activeYear, (m) => m.payoutTotal ?? m.lineTotal) : null;
  const backMargin = showBackMargin ? backMarginRaw : null;
  const profitBa = ps ? sumByYear(ps.months, activeYear, (m) => m.profitShare) : null;
  const commProduct = cp ? sumByYear(cp.months, activeYear, (m) => m.net) : null;
  const baInc = ba ? sumByYear(ba.months, activeYear, (m) => m.incentive) : null;
  const lhs = lhsSum ? sumByYear(lhsSum.months, activeYear, (m) => m.payment) : null;
  const purchaseDiscount = pd ? sumByYear(pd.months, activeYear, (m) => m.discount) : null;
  const pdValue = showLhsDiscount ? purchaseDiscount : null;

  const storeTotal =
    backMargin === null && profitBa === null && pdValue === null
      ? null
      : (backMargin ?? 0) + (profitBa ?? 0) + (pdValue ?? 0);
  const empTotal =
    commProduct === null && baInc === null && lhs === null
      ? null
      : (commProduct ?? 0) + (baInc ?? 0) + (lhs ?? 0);

  const pctOf = (v: number | null, base: number | null) =>
    v == null || base == null || base <= 0 ? null : (v / base) * 100;

  // ผลตรวจประเมินร้าน (แสดงเฉพาะร้านที่มีผลตรวจ)
  const evalLatest = evalSum?.latest ?? null;
  const showEval = (evalSum?.count ?? 0) > 0;

  // ความพึงพอใจของลูกค้า (แสดงเฉพาะร้านที่มีข้อมูล)
  const showCustSat = (csSum?.count ?? 0) > 0;
  const custSatPct = csSum?.avgPct ?? 0;

  // ยอดขายงานบริการ (แยกหัวข้อยอดขาย) — ยอดตามปีที่เลือก
  const showServiceSales = (ssSum?.count ?? 0) > 0;
  const serviceSalesTotal = ssSum ? sumByYear(ssSum.months, activeYear, (m) => m.amount) : null;
  const salesRudy = ssRudy ? sumByYear(ssRudy.months, activeYear, (m) => m.amount) : null;
  const salesBa = ssBa ? sumByYear(ssBa.months, activeYear, (m) => m.amount) : null;
  const pctOfSales = (v: number | null) =>
    v == null || serviceSalesTotal == null || serviceSalesTotal <= 0 ? null : (v / serviceSalesTotal) * 100;
  // การ์ดย่อยแยกตามแหล่งข้อมูล (แสดงเฉพาะแหล่งที่มีข้อมูล)
  const salesCards: CardData[] = [
    ...((ssRudy?.count ?? 0) > 0
      ? [{ key: "sales-lhs", href: "/app/service-sales/lhs", icon: "roofing", label: "ยอดขาย LHS/Rudy", sub: "งานบริการหลังคาและโซลูชัน (รวม VAT)", total: salesRudy, loading, pct: pctOfSales(salesRudy) } as CardData]
      : []),
    ...((ssBa?.count ?? 0) > 0
      ? [{ key: "sales-ba", href: "/app/service-sales/ba", icon: "home_repair_service", label: "ยอดขาย BA", sub: "งานบริการคิวช่าง รายวัน (gmv)", total: salesBa, loading, pct: pctOfSales(salesBa) } as CardData]
      : []),
  ];

  // กลุ่มร้านค้า (หน้า "รวมผลประโยชน์ร้านค้า" ย้ายไปอยู่ bottom-nav แล้ว)
  const storeCards: CardData[] = [
    ...(showBackMargin
      ? [{ key: "back-margin", href: "/app/back-margin", icon: "savings", label: "Back Margin", sub: "จากการขายสินค้าที่หน้าร้าน", total: backMargin, loading, pct: pctOf(backMargin, storeTotal) } as CardData]
      : []),
    { key: "profit-ba", href: "/app/ba-profit-share", icon: "storefront", label: "Profit Share BA", sub: "จากการขายงานบริการคิวช่าง", total: profitBa, loading, pct: pctOf(profitBa, storeTotal) },
    ...(showLhsDiscount
      ? [{ key: "lhs-pd", href: "/app/lhs-purchase-discount", icon: "sell", label: "LHS Channel Discount", sub: "ส่วนลดช่องทาง 7% งานหลังคา (HE)", total: purchaseDiscount, loading, pct: pctOf(purchaseDiscount, storeTotal) } as CardData]
      : []),
    ...(showEval
      ? [{
          key: "store-eval",
          href: "/app/store-eval",
          icon: "fact_check",
          label: "ผลตรวจประเมินร้านค้า",
          sub: "มาตรฐานการให้บริการ (ล่าสุด)",
          total: null,
          loading,
          display: evalLatest ? `${Math.round(evalLatest.pct * 100)}%` : "—",
          badge: evalLatest?.result ? { text: evalLatest.result, pass: evalLatest.result === "ผ่าน" } : null,
        } as CardData]
      : []),
    ...(showCustSat
      ? [{
          key: "cust-sat",
          href: "/app/cust-sat",
          icon: "sentiment_satisfied",
          label: "ความพึงพอใจของลูกค้า",
          sub: "คะแนนเฉลี่ยจากแบบประเมิน",
          total: null,
          loading,
          display: `${Math.round(custSatPct * 100)}%`,
        } as CardData]
      : []),
  ];

  // กลุ่มพนักงาน (หน้า "รวมผลประโยชน์พนักงาน" ย้ายไปอยู่ bottom-nav แล้ว)
  const empCards: CardData[] = [
    { key: "comm-product", href: "/app/commission-product", icon: "payments", label: "Product Commission", sub: "จากการขายสินค้าที่หน้าร้าน", total: commProduct, loading, pct: pctOf(commProduct, empTotal) },
    { key: "ba-inc", href: "/app/ba-incentive", icon: "home_repair_service", label: "BA Commission", sub: "จากการขายงานบริการคิวช่าง", total: baInc, loading, pct: pctOf(baInc, empTotal) },
    { key: "lhs", href: "/app/lhs-commission", icon: "roofing", label: "LHS Commission", sub: "จากการขายงานบริการหลังคา SCG & Onnex", total: lhs, loading, pct: pctOf(lhs, empTotal) },
    { key: "points", href: "/app/points", icon: "emoji_events", label: "แต้มกิจกรรม", sub: "แต้มสะสม", total: null, loading: false },
  ];

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

        <ProfileCard />

        {/* เลือกปี */}
        {years.length > 0 && (
          <YearChips years={years} activeYear={activeYear} onSelect={(y) => setYear(y)} />
        )}

        {/* กลุ่มร้านค้า */}
        <section>
          <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
            <Icon name="storefront" style={{ fontSize: 16 }} />
            ผลประโยชน์ร้านค้า
          </h3>
          <SummaryBar icon="store" label="รวมผลประโยชน์ร้านค้า" total={storeTotal} loading={loading} note={`ยอดสะสม ${yearLabel}`} href="/app/benefit-store" />
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
            ผลประโยชน์พนักงานของร้าน
          </h3>
          <SummaryBar icon="groups" label="รวมผลประโยชน์พนักงาน" total={empTotal} loading={loading} note={`ยอดสะสม ${yearLabel} · จ่ายจริง`} href="/app/benefit-staff" />
          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            {empCards.map((c) => (
              <HubCard key={c.key} c={c} />
            ))}
          </div>
        </section>

        {/* กลุ่มยอดขาย (แยกหัวข้อ) */}
        {showServiceSales && (
          <section>
            <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
              <Icon name="trending_up" style={{ fontSize: 16 }} />
              ยอดขาย
            </h3>
            <SummaryBar
              icon="construction"
              label="รวมยอดขายงานบริการ"
              total={serviceSalesTotal}
              loading={loading}
              note={`${yearLabel} · LHS/Rudy + BA · 3 กลุ่มงานบริการ`}
              href="/app/service-sales"
            />
            {salesCards.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                {salesCards.map((c) => (
                  <HubCard key={c.key} c={c} />
                ))}
              </div>
            )}
          </section>
        )}

        <p className="text-[11px] text-slate-400 text-center">
          เลือกดูผลประโยชน์แต่ละระบบ · ยอดบนการ์ดคือยอดสะสมของร้านนี้
        </p>
      </div>

      <BottomNav active="home" />
    </>
  );
}
