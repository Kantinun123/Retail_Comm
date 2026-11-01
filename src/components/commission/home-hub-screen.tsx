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
}

function HubCard({ c }: { c: CardData }) {
  return (
    <Link
      href={c.href}
      className={
        "rounded-2xl border shadow-sm p-3.5 flex flex-col justify-between min-h-[104px] active:scale-[0.98] transition " +
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
        {c.total !== null ? (
          <p className={"tnum text-[15px] font-bold mt-0.5 " + (c.accent ? "text-white" : "text-[#a11119]")}>
            {c.loading ? "…" : baht(c.total)}
          </p>
        ) : (
          <p className={"text-[10px] mt-0.5 " + (c.accent ? "text-red-100/80" : "text-slate-400")}>{c.sub}</p>
        )}
      </div>
    </Link>
  );
}

export function HomeHubScreen() {
  const { session, ready } = useSession();
  const router = useRouter();

  const dealerCode = session && !session.isAdmin && !session.isSales ? session.dealer.code : null;

  // Hub ใช้สำหรับร้านค้าตัวแทน; admin/sales กลับไปหน้าเดิม
  useEffect(() => {
    if (ready && session && (session.isAdmin || session.isSales)) {
      router.replace("/app/dashboard");
    }
  }, [ready, session, router]);

  // ยอดสรุปแต่ละระบบ
  const [backMargin, setBackMargin] = useState<number | null>(null);
  const [profitBa, setProfitBa] = useState<number | null>(null);
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
    ]).then((res) => {
      if (cancelled) return;
      if (res[0].status === "fulfilled") setBackMargin(res[0].value.totalPayout ?? 0);
      if (res[1].status === "fulfilled") setProfitBa(res[1].value.totalProfitShare ?? 0);
      if (res[2].status === "fulfilled") setCommProduct(res[2].value.totalNet ?? 0);
      if (res[3].status === "fulfilled") setBaInc(res[3].value.totalIncentive ?? 0);
      if (res[4].status === "fulfilled") setLhs(res[4].value.totalPayment ?? 0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  if (!ready || !session) return null;

  // กลุ่มร้านค้า (หน้า "รวมผลประโยชน์ร้านค้า" ย้ายไปอยู่ bottom-nav แล้ว)
  const storeCards: CardData[] = [
    { key: "back-margin", href: "/app/back-margin", icon: "savings", label: "Back Margin", sub: "แบ็คมาร์จิน", total: backMargin, loading },
    { key: "profit-ba", href: "/app/ba-profit-share", icon: "storefront", label: "Profit BA", sub: "ผลประโยชน์ร้าน Q-CHANG", total: profitBa, loading },
  ];

  // กลุ่มพนักงาน (หน้า "รวมผลประโยชน์พนักงาน" ย้ายไปอยู่ bottom-nav แล้ว)
  const empCards: CardData[] = [
    { key: "comm-product", href: "/app/commission-product", icon: "payments", label: "ค่าคอมฯ สินค้า", sub: "คอมมิชชั่นสินค้า", total: commProduct, loading },
    { key: "ba-inc", href: "/app/ba-incentive", icon: "home_repair_service", label: "ค่าคอมฯ BA", sub: "งานบริการ Q-CHANG", total: baInc, loading },
    { key: "lhs", href: "/app/lhs-commission", icon: "roofing", label: "ค่าคอมฯ LHS", sub: "ระบบ Rudy", total: lhs, loading },
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
          <div className="grid grid-cols-2 gap-2.5">
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
          <div className="grid grid-cols-2 gap-2.5">
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
