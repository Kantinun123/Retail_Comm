"use client";

/* =============================================================
   หน้าหลัก (Hub) พนักงานขาย — เห็นเฉพาะผลประโยชน์ของตัวเอง (scope ด้วย repCode)
   การ์ด: Product Commission (ผู้รับเงิน) · BA Commission · LHS Commission · แต้มกิจกรรม
   + แถบรวม "ผลประโยชน์ของฉัน" (จ่ายจริง)
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { doLogout, useSession } from "@/lib/commission/session";
import { ProfileCard } from "./profile-card";
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
  total: number | null;
  loading: boolean;
}

function HubCard({ c }: { c: CardData }) {
  return (
    <Link
      href={c.href}
      className="rounded-2xl border border-slate-100 bg-white shadow-sm p-3.5 flex flex-col justify-between min-h-[118px] active:scale-[0.98] hover:border-red-200 transition"
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
          <p className="tnum text-[15px] font-bold mt-1 text-[#a11119]">
            {c.loading ? "…" : baht(c.total)}
          </p>
        )}
      </div>
    </Link>
  );
}

export function HomeStaffHubScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const repCode = session?.repCode ?? null;

  const [commProduct, setCommProduct] = useState<number | null>(null);
  const [baInc, setBaInc] = useState<number | null>(null);
  const [lhs, setLhs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // หน้านี้เฉพาะพนักงานขาย; role อื่นกลับหน้าของตัวเอง
  useEffect(() => {
    if (ready && session && !session.isSales) {
      router.replace(session.isAdmin ? "/app/dashboard" : "/app/home");
    }
  }, [ready, session, router]);

  useEffect(() => {
    if (!repCode) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      fetchCommissionSummary(null, repCode),
      fetchBaSummary(null, repCode),
      fetchLhsSummary(null, repCode),
    ]).then((res) => {
      if (cancelled) return;
      if (res[0].status === "fulfilled") setCommProduct(res[0].value.totalNet ?? 0);
      if (res[1].status === "fulfilled") setBaInc(res[1].value.totalIncentive ?? 0);
      if (res[2].status === "fulfilled") setLhs(res[2].value.totalPayment ?? 0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repCode]);

  if (!ready || !session) return null;
  if (!session.isSales) return null;

  const myTotal =
    commProduct === null && baInc === null && lhs === null
      ? null
      : (commProduct ?? 0) + (baInc ?? 0) + (lhs ?? 0);

  const cards: CardData[] = [
    { key: "comm-product", href: "/app/commission-product", icon: "payments", label: "Product Commission", sub: "จากการขายสินค้าที่หน้าร้าน", total: commProduct, loading },
    { key: "ba-inc", href: "/app/ba-incentive", icon: "home_repair_service", label: "BA Commission", sub: "จากการขายงานบริการคิวช่าง", total: baInc, loading },
    { key: "lhs", href: "/app/lhs-commission", icon: "roofing", label: "LHS Commission", sub: "จากการขายงานบริการหลังคา SCG & Onnex", total: lhs, loading },
    { key: "points", href: "/app/points", icon: "emoji_events", label: "แต้มกิจกรรม", sub: "แต้มสะสม", total: null, loading: false },
  ];

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
        <ProfileCard />

        <section>
          <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
            <Icon name="account_circle" style={{ fontSize: 16 }} />
            ผลประโยชน์ของฉัน
          </h3>

          {/* แถบรวม */}
          <div className="rounded-2xl bg-gradient-to-br from-[#8f1114] to-[#d32029] text-white p-4 shadow-md shadow-[#d32029]/20 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-red-100/90 leading-tight">รวมผลประโยชน์ของฉัน</p>
                <p className="text-[9.5px] text-red-100/70 leading-tight">จ่ายจริง (หลังหักภาษี)</p>
              </div>
              <p className="tnum text-[22px] font-bold leading-none shrink-0">
                {loading ? "…" : baht(myTotal)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            {cards.map((c) => (
              <HubCard key={c.key} c={c} />
            ))}
          </div>
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          แสดงเฉพาะผลประโยชน์ของคุณ · ยอดบนการ์ดคือยอดสะสมรายคน
        </p>
      </div>

      <BottomNav active="home" />
    </>
  );
}
