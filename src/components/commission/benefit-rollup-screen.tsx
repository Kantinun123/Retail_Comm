"use client";

/* =============================================================
   หน้ารวมผลประโยชน์ (roll-up) — รวมหลายระบบเป็นรายเดือน (by period)
   ใช้ซ้ำได้ทั้ง 2 กลุ่ม:
   - ร้านค้า: Back Margin + Profit BA
   - พนักงาน: ค่าคอมฯ สินค้า + ค่าคอมฯ BA + ค่าคอมฯ LHS (ใช้ยอด "จ่ายจริง")
   แต่ละเดือนกดขยายดูยอดแยกระบบ + ลิงก์ไปหน้าเต็มของระบบนั้น
   server-authoritative: เรียก fetch...Summary ของแต่ละระบบแล้ว merge ฝั่ง client
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { doLogout, useHomeHref, useSession } from "@/lib/commission/session";
import { ProfileCard } from "./profile-card";
import { YearFilter, computeYearFilter } from "./year-filter";
import { fetchBackMarginSummary } from "@/lib/commission/back-margin-store";
import { fetchProfitShareSummary } from "@/lib/commission/ba-profit-share-store";
import { fetchCommissionSummary } from "@/lib/commission/commission-product-store";
import { fetchBaSummary } from "@/lib/commission/ba-incentive-store";
import { fetchLhsSummary } from "@/lib/commission/lhs-commission-store";
import { fetchPdSummary } from "@/lib/commission/lhs-purchase-discount-store";
import { downloadBenefitRollup, type RollupExportRow } from "@/lib/commission/excel";
import { DownloadMonthSheet } from "./download-month-sheet";

function baht(n: number): string {
  return "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}
const MONTH_TH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTH_TH[Number(m)] ?? m} ${Number(y) + 543}`;
}

export type RollupKind = "store" | "staff";

interface SourceRow {
  key: string;
  label: string;
  icon: string;
  href: string;
  /** period -> ยอดของระบบนี้ในเดือนนั้น */
  byPeriod: Map<string, number>;
  total: number;
}

export function BenefitRollupScreen({ kind }: { kind: RollupKind }) {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const router = useRouter();
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [openPeriod, setOpenPeriod] = useState<string | null>(null);
  const [showDownload, setShowDownload] = useState(false);

  const dealerCode = session
    ? session.isAdmin
      ? session.storeFilter
      : session.isSales
        ? null
        : session.dealer.code
    : null;

  useEffect(() => {
    if (ready && session && session.isSales) router.replace("/app/member");
  }, [ready, session, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      const out: SourceRow[] = [];
      if (kind === "store") {
        const [bm, ps, pd] = await Promise.all([
          fetchBackMarginSummary(dealerCode),
          fetchProfitShareSummary(dealerCode),
          fetchPdSummary(dealerCode),
        ]);
        out.push({
          key: "back-margin", label: "Back Margin", icon: "savings", href: "/app/back-margin",
          byPeriod: new Map(bm.months.map((m) => [m.period, m.payoutTotal ?? m.lineTotal])),
          total: bm.totalPayout,
        });
        out.push({
          key: "profit-ba", label: "Profit Share BA", icon: "storefront", href: "/app/ba-profit-share",
          byPeriod: new Map(ps.months.map((m) => [m.period, m.profitShare])),
          total: ps.totalProfitShare,
        });
        // LHS Channel Discount เฉพาะร้าน Housing Expert (admin เห็นทุกร้าน)
        if (session?.isAdmin || session?.dealer?.model === "Housing Expert") {
          out.push({
            key: "lhs-pd", label: "LHS Channel Discount", icon: "sell", href: "/app/lhs-purchase-discount",
            byPeriod: new Map(pd.months.map((m) => [m.period, m.discount])),
            total: pd.totalDiscount,
          });
        }
      } else {
        const [cp, ba, lhs] = await Promise.all([
          fetchCommissionSummary(dealerCode),
          fetchBaSummary(dealerCode),
          fetchLhsSummary(dealerCode),
        ]);
        out.push({
          key: "comm-product", label: "Product Commission", icon: "payments", href: "/app/commission-product",
          byPeriod: new Map(cp.months.map((m) => [m.period, m.net])),
          total: cp.totalNet,
        });
        out.push({
          key: "ba-inc", label: "BA Commission", icon: "home_repair_service", href: "/app/ba-incentive",
          byPeriod: new Map(ba.months.map((m) => [m.period, m.incentive])),
          total: ba.totalIncentive,
        });
        out.push({
          key: "lhs", label: "LHS Commission", icon: "roofing", href: "/app/lhs-commission",
          byPeriod: new Map(lhs.months.map((m) => [m.period, m.payment])),
          total: lhs.totalPayment,
        });
      }
      if (!cancelled) {
        setSources(out);
        setLoading(false);
      }
    }
    load().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dealerCode, kind, session?.isAdmin, session?.dealer?.model]);

  if (!ready || !session) return null;
  if (session.isSales) return null;

  const title = kind === "store" ? "รวมผลประโยชน์ร้านค้า" : "รวมผลประโยชน์พนักงาน";
  const heroIcon = kind === "store" ? "storefront" : "groups";
  const heroNote = kind === "staff" ? "จ่ายจริง (หลังหักภาษี)" : "จ่ายจริง";

  // รวมทุก period ที่พบในทุกระบบ
  const allPeriods = new Set<string>();
  sources.forEach((s) => s.byPeriod.forEach((_, p) => allPeriods.add(p)));
  type MonthRow = { period: string; total: number; parts: { key: string; label: string; icon: string; href: string; amount: number }[] };
  const monthRows: MonthRow[] = [...allPeriods]
    .sort((a, b) => b.localeCompare(a))
    .map((p) => {
      const parts = sources
        .map((s) => ({ key: s.key, label: s.label, icon: s.icon, href: s.href, amount: s.byPeriod.get(p) ?? 0 }))
        .filter((x) => x.amount !== 0);
      const total = parts.reduce((a, x) => a + x.amount, 0);
      return { period: p, total, parts };
    })
    .filter((r) => r.total !== 0);

  const grandTotal = sources.reduce((a, s) => a + s.total, 0);

  // ตัวกรองปี (auto-show)
  const yf = computeYearFilter(monthRows, selectedYear);
  const months = yf.filtered as MonthRow[];

  const sourceLabels = sources.map((s) => s.label);
  // ดาวน์โหลดเฉพาะเดือนที่เลือกจาก sheet (ใช้ monthRows ทั้งหมด ไม่ติดตัวกรองปีบนจอ)
  function handleDownload(chosenPeriods: string[]) {
    const chosen = new Set(chosenPeriods);
    const picked = monthRows.filter((m) => chosen.has(m.period));
    if (picked.length === 0) return;
    const rows: RollupExportRow[] = picked.map((m) => {
      const parts: Record<string, number> = {};
      for (const label of sourceLabels) {
        const found = m.parts.find((p) => p.label === label);
        parts[label] = found ? found.amount : 0;
      }
      return { period: m.period, parts, total: m.total };
    });
    const fname = kind === "store" ? "รวมผลประโยชน์ร้านค้า.xlsx" : "รวมผลประโยชน์พนักงาน.xlsx";
    downloadBenefitRollup(rows, sourceLabels, fname);
    setShowDownload(false);
  }

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link
            href={homeHref}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">{title}</span>
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

        {/* Hero รวม */}
        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
                <Icon name={heroIcon} style={{ fontSize: 16 }} />
                {title} · {heroNote}
                {session.isAdmin && !session.storeFilter ? " · ทุกร้าน" : ""}
              </p>
              <button
                type="button"
                onClick={() => setShowDownload(true)}
                disabled={loading || monthRows.length === 0}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-full border border-white/25 active:scale-95 transition disabled:opacity-50"
              >
                <Icon name="download" style={{ fontSize: 14 }} />
                ดาวน์โหลดข้อมูล
              </button>
            </div>
            <p className="tnum text-[36px] font-bold leading-none mt-1">
              {loading ? "…" : baht(grandTotal)}
            </p>
            {/* แยกยอดต่อระบบ */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {sources.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2 active:scale-[0.98] transition"
                >
                  <p className="text-[11px] text-red-100/80 flex items-center gap-1">
                    <Icon name={s.icon} style={{ fontSize: 13 }} /> {s.label}
                  </p>
                  <p className="tnum text-[15px] font-bold">{loading ? "…" : baht(s.total)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <YearFilter years={yf.years} activeYear={yf.activeYear} onSelect={setSelectedYear} />

        {/* รายเดือน (รวมทุกระบบ) */}
        <section>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
            <Icon name="calendar_month" className="text-lg text-[#d32029]" />
            รวมผลประโยชน์ รายเดือน
            {yf.multiYear && yf.activeYear && (
              <span className="text-[12px] font-semibold text-slate-400">· ปี {Number(yf.activeYear) + 543}</span>
            )}
          </h3>

          {loading ? (
            <div className="py-8 text-center text-slate-300">
              <Icon name="progress_activity" className="animate-spin text-3xl" />
            </div>
          ) : months.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
                <Icon name={heroIcon} className="text-2xl" />
              </div>
              <p className="mt-2 text-[13px] text-slate-500">ยังไม่มีข้อมูลสำหรับร้านนี้</p>
            </div>
          ) : (
            <div className="space-y-2">
              {months.map((m) => {
                const open = openPeriod === m.period;
                return (
                  <div key={m.period} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenPeriod(open ? null : m.period)}
                      className="w-full text-left p-3.5 flex items-center justify-between active:scale-[0.99] transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                          <Icon name="calendar_month" className="text-xl" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-slate-900">{periodLabel(m.period)}</p>
                          <p className="text-[11px] text-slate-400">{m.parts.length} ระบบ</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <p className="tnum text-[16px] font-bold text-[#a11119] leading-none">{baht(m.total)}</p>
                        <Icon name={open ? "expand_less" : "expand_more"} className="text-slate-400" style={{ fontSize: 20 }} />
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-slate-100 px-3.5 py-2 space-y-1.5 bg-slate-50/50">
                        {m.parts.map((p) => (
                          <Link
                            key={p.key}
                            href={p.href}
                            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white active:scale-[0.99] transition"
                          >
                            <span className="flex items-center gap-2 text-[12.5px] text-slate-700">
                              <Icon name={p.icon} className="text-[#d32029]" style={{ fontSize: 16 }} />
                              {p.label}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="tnum text-[13px] font-semibold text-[#a11119]">{baht(p.amount)}</span>
                              <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 16 }} />
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          รวมทุกระบบในกลุ่มเป็นรายเดือน · กดแต่ละเดือนเพื่อดูยอดแยกระบบ
        </p>
      </div>

      {showDownload && (
        <DownloadMonthSheet
          periods={monthRows.map((m) => m.period)}
          defaultYear={yf.activeYear}
          onConfirm={handleDownload}
          onClose={() => setShowDownload(false)}
        />
      )}

      <BottomNav active={kind === "store" ? "dashboard" : "staffIncentive"} />
    </>
  );
}
