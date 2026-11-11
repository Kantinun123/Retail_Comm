"use client";

/* =============================================================
   หน้า LHS Purchase Discount (ส่วนลดซื้อ 7% Housing Expert — Roof, ฝั่งร้านค้า)
   - hero สรุปส่วนลดรวม + ยอดขายก่อน VAT, รายเดือน, drill-down รายโครงการ
   - server-authoritative ผ่าน /api/lhs-purchase-discount (แสดงเฉพาะร้านที่ map เจอ)
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLinkedPeriod } from "@/lib/commission/linked-period";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { doLogout, useHomeHref, useSession } from "@/lib/commission/session";
import { ProfileCard } from "./profile-card";
import { YearFilter, computeYearFilter } from "./year-filter";
import {
  fetchPdSummary,
  fetchPdMonthLines,
  type PdSummary,
  type PdMonth,
  type PdLine,
} from "@/lib/commission/lhs-purchase-discount-store";
import { downloadPurchaseDiscount, type PdExportRow } from "@/lib/commission/excel";
import { DownloadMonthSheet } from "./download-month-sheet";

function baht(n: number): string {
  return "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}
const MONTH_TH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTH_TH[Number(m)] ?? m} ${Number(y) + 543}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}

/* ---------------- modal drill-down รายโครงการ ---------------- */
function MonthDetailModal({
  dealerCode,
  month,
  onClose,
}: {
  dealerCode: string | null;
  month: PdMonth;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<PdLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPdMonthLines(dealerCode, month.period)
      .then((l) => {
        if (!cancelled) setLines(l);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealerCode, month.period]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-slate-900 truncate">รายละเอียด {periodLabel(month.period)}</p>
            <p className="text-[11px] text-slate-400">{month.lineCount.toLocaleString()} โครงการ · ส่วนลด {baht(month.discount)}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 shrink-0">
            <Icon name="close" style={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="p-3">
          {loading ? (
            <p className="text-[12px] text-slate-400 text-center py-6">กำลังโหลด...</p>
          ) : lines.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-6">ไม่มีรายการ</p>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-slate-800 flex-1 min-w-0">
                      {l.subSolutionName ?? l.solutionName ?? l.projectName ?? "-"}
                    </p>
                    <span className="tnum text-[12px] font-bold text-[#a11119] shrink-0">{baht(l.discountAmount)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                    <span>{l.orderNumber ?? "-"}</span>
                    <span>·</span>
                    <span className="truncate">{l.customerName ?? l.projectName ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 text-[10px] text-slate-400">
                    <span>ยอดขาย {baht(l.salesExclVat)}</span>
                    <span>ปิดการขาย {fmtDate(l.projectCloseDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LhsPurchaseDiscountScreen() {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const router = useRouter();
  const [summary, setSummary] = useState<PdSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PdMonth | null>(null);
  // ช่วงเวลาจากหน้าหลัก (?p= / ?y=) -> เลือกปีนั้น + ไฮไลต์เดือนนั้น
  const linked = useLinkedPeriod();
  const [selectedYear, setSelectedYear] = useState<string | null>(linked.year);
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
    // LHS Channel Discount เฉพาะร้าน Housing Expert (admin ดูได้ทุกร้าน)
    else if (ready && session && !session.isAdmin && session.dealer?.model !== "Housing Expert") {
      router.replace("/app/home");
    }
  }, [ready, session, router]);

  useEffect(() => {
    let cancelled = false;
    fetchPdSummary(dealerCode)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  if (!ready || !session) return null;
  if (session.isSales) return null;

  const allMonths = summary?.months ?? [];
  const yf = computeYearFilter(allMonths, selectedYear);
  const months = yf.filtered as PdMonth[];
  // ยอดรวม hero คิดจากเดือนที่กรองปีแล้ว (ขยับตามปีที่เลือก)
  const totalDiscount = months.reduce((s, m) => s + m.discount, 0);
  const totalSales = months.reduce((s, m) => s + m.sales, 0);

  async function handleDownload(chosenPeriods: string[]) {
    const chosen = new Set(chosenPeriods);
    const picked = allMonths.filter((m) => chosen.has(m.period));
    if (picked.length === 0) return;
    setShowDownload(false);
    const all = await Promise.all(
      picked.map((m) =>
        fetchPdMonthLines(dealerCode, m.period).then((lines) =>
          lines.map((l) => ({ ...l, period: m.period }) as PdExportRow)
        )
      )
    );
    downloadPurchaseDiscount(all.flat());
  }

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link href={homeHref} className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">LHS Channel Discount (ร้านค้า)</span>
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

        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
                <Icon name="sell" style={{ fontSize: 16 }} />
ส่วนลดช่องทางสะสม 7% (Housing Expert · Roof)
                {session.isAdmin && !session.storeFilter ? " · ทุกร้าน" : ""}
              </p>
              <button
                type="button"
                onClick={() => setShowDownload(true)}
                disabled={loading || allMonths.length === 0}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-full border border-white/25 active:scale-95 transition disabled:opacity-50"
              >
                <Icon name="download" style={{ fontSize: 14 }} />
                ดาวน์โหลดข้อมูล
              </button>
            </div>
            <p className="tnum text-[36px] font-bold leading-none mt-1">{baht(totalDiscount)}</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">ยอดขายก่อน VAT</p>
                <p className="tnum text-[15px] font-bold">{baht(totalSales)}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">อัตราส่วนลด</p>
                <p className="tnum text-[15px] font-bold">7%</p>
              </div>
            </div>
          </div>
        </section>

        <YearFilter years={yf.years} activeYear={yf.activeYear} onSelect={setSelectedYear} />

        <section>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
            <Icon name="calendar_month" className="text-lg text-[#d32029]" />
LHS Channel Discount รายเดือน
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
                <Icon name="sell" className="text-2xl" />
              </div>
              <p className="mt-2 text-[13px] text-slate-500">ยังไม่มีข้อมูล LHS Channel Discount สำหรับร้านนี้</p>
            </div>
          ) : (
            <div className="space-y-2">
              {months.map((m) => (
                <button
                  key={m.period}
                  type="button"
                  onClick={() => setDetail(m)}
                  aria-current={m.period === linked.period ? "true" : undefined}
                  className={"w-full text-left bg-white rounded-2xl border shadow-sm p-3.5 active:scale-[0.99] hover:border-red-200 transition " + (m.period === linked.period ? "border-[#d32029] ring-2 ring-red-100" : "border-slate-100")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                        <Icon name="sell" className="text-xl" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-slate-900">{periodLabel(m.period)}</p>
                        <p className="text-[11px] text-slate-400">{m.lineCount.toLocaleString()} โครงการ</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="tnum text-[16px] font-bold text-[#a11119] leading-none">{baht(m.discount)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">ยอดขาย {baht(m.sales)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-1.5 text-[10px] text-slate-400 gap-1">
                    ดูรายละเอียดโครงการ
                    <Icon name="chevron_right" style={{ fontSize: 14 }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center">
ส่วนลดช่องทาง 7% สำหรับร้าน Housing Expert กลุ่มงานหลังคา (Roof) · คิดจากยอดขายก่อน VAT
        </p>
      </div>

      {detail && <MonthDetailModal dealerCode={dealerCode} month={detail} onClose={() => setDetail(null)} />}

      {showDownload && (
        <DownloadMonthSheet
          periods={allMonths.map((m) => m.period)}
          defaultYear={yf.activeYear}
          onConfirm={handleDownload}
          onClose={() => setShowDownload(false)}
        />
      )}

      <BottomNav active="lhsPurchaseDiscount" />
    </>
  );
}
