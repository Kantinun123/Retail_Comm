"use client";

/* =============================================================
   หน้า Back Margin (ผลประโยชน์ร้านค้า — rebate ตาม back margin)
   - เฉพาะร้านค้าตัวแทน (dealer) + ผู้ดูแลระบบ (admin ดูรวม/เจาะร้าน)
   - hero สรุปยอดรวม, รายเดือน (ยอด + วันที่จ่าย), drill-down รายสินค้า
   - server-authoritative ผ่าน /api/back-margin (back-margin-store)
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { doLogout, useSession } from "@/lib/commission/session";
import { ProfileCard } from "./profile-card";
import { YearFilter, computeYearFilter } from "./year-filter";
import {
  fetchBackMarginSummary,
  fetchBackMarginMonthLines,
  type BackMarginSummary,
  type BackMarginMonth,
  type BackMarginLine,
} from "@/lib/commission/back-margin-store";
import { cn } from "@/lib/utils";

function baht(n: number): string {
  return "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

const MONTH_TH = [
  "", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  const mm = Number(m);
  return `${MONTH_TH[mm] ?? m} ${Number(y) + 543}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}

/* ---------------- modal drill-down รายสินค้า ---------------- */
function MonthDetailModal({
  dealerCode,
  month,
  onClose,
}: {
  dealerCode: string | null;
  month: BackMarginMonth;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<BackMarginLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchBackMarginMonthLines(dealerCode, month.period)
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
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold text-slate-900">
              รายละเอียด {periodLabel(month.period)}
            </p>
            <p className="text-[11px] text-slate-400">
              {month.jobCount.toLocaleString()} รายการ · back margin {baht(month.lineTotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95"
          >
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
                      {l.itemName ?? "-"}
                    </p>
                    <span className="tnum text-[12px] font-bold text-[#a11119] shrink-0">
                      {baht(l.backMargin)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span>{l.docNo ?? "-"}</span>
                    <span>·</span>
                    <span>{l.custName ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 text-[10px] text-slate-400">
                    <span>ยอดขาย {baht(l.netAmount)} · {l.qty ?? 0} หน่วย</span>
                    <span>{fmtDate(l.salesDate)}</span>
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

export function BackMarginScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const [summary, setSummary] = useState<BackMarginSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BackMarginMonth | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  // dealer -> ร้านตัวเอง; admin -> storeFilter (null = ทุกร้าน); sales ไม่เกี่ยว
  const dealerCode = session
    ? session.isAdmin
      ? session.storeFilter
      : session.isSales
        ? null
        : session.dealer.code
    : null;

  // sales ไม่มี back margin -> พาออก
  useEffect(() => {
    if (ready && session && session.isSales) {
      router.replace("/app/member");
    }
  }, [ready, session, router]);

  useEffect(() => {
    let cancelled = false;
    fetchBackMarginSummary(dealerCode)
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
  const totalPayout = summary?.totalPayout ?? 0;
  const paidMonths = allMonths.filter((m) => m.payoutTotal != null).length;
  // กรองปี (auto-show เมื่อ >1 ปี) — รายการเดือนแสดงเฉพาะปีที่เลือก
  const yf = computeYearFilter(allMonths, selectedYear);
  const months = yf.filtered;

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link
            href="/app/dashboard"
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">แบ็คมาร์จิน (Back Margin)</span>
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
        {/* การ์ดโปรไฟล์สมาชิก */}
        <ProfileCard />

        {/* Hero สรุปรวม */}
        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
              <Icon name="savings" style={{ fontSize: 16 }} />
              back margin สะสม (จ่ายจริง)
              {session.isAdmin && !session.storeFilter ? " · ทุกร้าน" : ""}
            </p>
            <p className="tnum text-[36px] font-bold leading-none mt-1">{baht(totalPayout)}</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">จ่ายแล้ว</p>
                <p className="tnum text-[16px] font-bold">{paidMonths} เดือน</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">รอบที่มีข้อมูล</p>
                <p className="tnum text-[16px] font-bold">{months.length} เดือน</p>
              </div>
            </div>
          </div>
        </section>

        {/* ตัวกรองปี (โผล่เมื่อมี >1 ปี) */}
        <YearFilter years={yf.years} activeYear={yf.activeYear} onSelect={setSelectedYear} />

        {/* รายเดือน */}
        <section>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
            <Icon name="calendar_month" className="text-lg text-[#d32029]" />
            ผลประโยชน์รายเดือน
            {yf.multiYear && yf.activeYear && (
              <span className="text-[12px] font-semibold text-slate-400">
                · ปี {Number(yf.activeYear) + 543}
              </span>
            )}
          </h3>

          {loading ? (
            <div className="py-8 text-center text-slate-300">
              <Icon name="progress_activity" className="animate-spin text-3xl" />
            </div>
          ) : months.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
                <Icon name="savings" className="text-2xl" />
              </div>
              <p className="mt-2 text-[13px] text-slate-500">ยังไม่มีข้อมูล back margin สำหรับร้านนี้</p>
            </div>
          ) : (
            <div className="space-y-2">
              {months.map((m) => {
                const paid = m.payoutTotal != null;
                return (
                  <button
                    key={m.period}
                    type="button"
                    onClick={() => setDetail(m)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 active:scale-[0.99] hover:border-red-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                          <Icon name="savings" className="text-xl" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-slate-900">
                            {periodLabel(m.period)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {m.jobCount.toLocaleString()} รายการ · ยอดขาย {baht(m.netSales)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="tnum text-[16px] font-bold text-[#a11119] leading-none">
                          {baht(m.payoutTotal ?? m.lineTotal)}
                        </p>
                        <p className="text-[10px] mt-1">
                          {paid ? (
                            <span className="text-emerald-600 font-semibold">
                              จ่ายแล้ว {fmtDate(m.paidDate)}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold">รอจ่าย</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end mt-1.5 text-[10px] text-slate-400 gap-1">
                      ดูรายละเอียดรายสินค้า
                      <Icon name="chevron_right" style={{ fontSize: 14 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          back margin จ่ายตามยอดขายที่เข้าเงื่อนไข · อิงข้อมูลที่อนุมัติทำจ่ายแล้ว
        </p>
      </div>

      {detail && (
        <MonthDetailModal dealerCode={dealerCode} month={detail} onClose={() => setDetail(null)} />
      )}

      <BottomNav active="backMargin" />
    </>
  );
}
