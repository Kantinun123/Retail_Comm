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
import { fetchBackMarginSummary } from "@/lib/commission/back-margin-store";
import { fetchProfitShareSummary } from "@/lib/commission/ba-profit-share-store";
import { fetchCommissionSummary } from "@/lib/commission/commission-product-store";
import { fetchBaSummary } from "@/lib/commission/ba-incentive-store";
import { fetchLhsSummary } from "@/lib/commission/lhs-commission-store";
import { fetchPdSummary } from "@/lib/commission/lhs-purchase-discount-store";

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
        {c.total !== null && (
          <>
            <p className={"tnum text-[15px] font-bold mt-1 " + (c.accent ? "text-white" : "text-[#a11119]")}>
              {c.loading ? "…" : baht(c.total)}
            </p>
            {!c.loading && c.pct != null && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-[#f0e3e4] overflow-hidden">
                  <div className="h-full rounded-full bg-[#d32029]" style={{ width: `${Math.max(2, Math.round(c.pct))}%` }} />
                </div>
                <span className="tnum text-[10px] font-bold text-[#d32029] shrink-0">{Math.round(c.pct)}%</span>
              </div>
            )}
          </>
        )}
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

  const dealerCode = session && !session.isAdmin && !session.isSales ? session.dealer.code : null;

  // Hub (ร้านค้า) — admin -> dashboard, sales -> Hub พนักงาน
  useEffect(() => {
    if (ready && session && session.isAdmin) router.replace("/app/dashboard");
    else if (ready && session && session.isSales) router.replace("/app/home-staff");
  }, [ready, session, router]);

  // ยอดสรุปแต่ละระบบ
  const [backMargin, setBackMargin] = useState<number | null>(null);
  const [profitBa, setProfitBa] = useState<number | null>(null);
  const [purchaseDiscount, setPurchaseDiscount] = useState<number | null>(null);
  const [commProduct, setCommProduct] = useState<number | null>(null);
  const [baInc, setBaInc] = useState<number | null>(null);
  const [lhs, setLhs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

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
    ]).then((res) => {
      if (cancelled) return;
      if (res[0].status === "fulfilled") setBackMargin(res[0].value.totalPayout ?? 0);
      if (res[1].status === "fulfilled") setProfitBa(res[1].value.totalProfitShare ?? 0);
      if (res[2].status === "fulfilled") setCommProduct(res[2].value.totalNet ?? 0);
      if (res[3].status === "fulfilled") setBaInc(res[3].value.totalIncentive ?? 0);
      if (res[4].status === "fulfilled") setLhs(res[4].value.totalPayment ?? 0);
      if (res[5].status === "fulfilled") setPurchaseDiscount(res[5].value.totalDiscount ?? 0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  if (!ready || !session) return null;

  // ยอดรวมแต่ละกลุ่ม (จ่ายจริง) — null ถ้ายังโหลดไม่เสร็จทั้งกลุ่ม
  // LHS Channel Discount แสดงเฉพาะร้าน Housing Expert เท่านั้น
  const showLhsDiscount = session.dealer?.model === "Housing Expert";
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

  // กลุ่มร้านค้า (หน้า "รวมผลประโยชน์ร้านค้า" ย้ายไปอยู่ bottom-nav แล้ว)
  const storeCards: CardData[] = [
    { key: "back-margin", href: "/app/back-margin", icon: "savings", label: "Back Margin", sub: "จากการขายสินค้าที่หน้าร้าน", total: backMargin, loading, pct: pctOf(backMargin, storeTotal) },
    { key: "profit-ba", href: "/app/ba-profit-share", icon: "storefront", label: "Profit Share BA", sub: "จากการขายงานบริการคิวช่าง", total: profitBa, loading, pct: pctOf(profitBa, storeTotal) },
    ...(showLhsDiscount
      ? [{ key: "lhs-pd", href: "/app/lhs-purchase-discount", icon: "sell", label: "LHS Channel Discount", sub: "ส่วนลดช่องทาง 7% งานหลังคา (HE)", total: purchaseDiscount, loading, pct: pctOf(purchaseDiscount, storeTotal) } as CardData]
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
        <ProfileCard />

        {/* กลุ่มร้านค้า */}
        <section>
          <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
            <Icon name="storefront" style={{ fontSize: 16 }} />
            ผลประโยชน์ร้านค้า
          </h3>
          <SummaryBar icon="store" label="รวมผลประโยชน์ร้านค้า" total={storeTotal} loading={loading} href="/app/benefit-store" />
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
          <SummaryBar icon="groups" label="รวมผลประโยชน์พนักงาน" total={empTotal} loading={loading} note="จ่ายจริง (หลังหักภาษี)" href="/app/benefit-staff" />
          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            {empCards.map((c) => (
              <HubCard key={c.key} c={c} />
            ))}
          </div>
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          เลือกดูผลประโยชน์แต่ละระบบ · ยอดบนการ์ดคือยอดสะสมของร้านนี้
        </p>
      </div>

      <BottomNav active="home" />
    </>
  );
}
