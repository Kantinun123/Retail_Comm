"use client";

/* =============================================================
   หน้าความพึงพอใจของลูกค้า (Cust. Sat.)
   - hero: ความพึงพอใจเฉลี่ยรวม (%) + จำนวนรีวิว
   - รายเดือน (% เฉลี่ย + จำนวนรีวิว), drill-down คะแนนย่อย 6 ด้าน
   - server-authoritative ผ่าน /api/cust-sat (แสดงเฉพาะร้านที่มีข้อมูล)
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { doLogout, useHomeHref, useSession } from "@/lib/commission/session";
import { ProfileCard } from "./profile-card";
import { YearFilter, computeYearFilter } from "./year-filter";
import {
  fetchCustSatSummary,
  fetchCustSatMonthAgg,
  fetchCustSatReviews,
  type CsSummary,
  type CsMonth,
  type CsAgg,
  type CsReview,
} from "@/lib/commission/cust-sat-store";

const MONTH_TH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTH_TH[Number(m)] ?? m} ${Number(y) + 543}`;
}
const pctText = (p: number) => `${Math.round(p * 100)}%`;
function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}

/* ---------------- modal drill-down คะแนนย่อย 6 ด้าน ---------------- */
function MonthDetailModal({
  dealerCode,
  month,
  onClose,
}: {
  dealerCode: string | null;
  month: CsMonth;
  onClose: () => void;
}) {
  const [agg, setAgg] = useState<CsAgg | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCustSatMonthAgg(dealerCode, month.period)
      .then((a) => {
        if (!cancelled) setAgg(a);
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
            <p className="text-[15px] font-bold text-slate-900 truncate">ความพึงพอใจ {periodLabel(month.period)}</p>
            <p className="text-[11px] text-slate-400">{month.reviewCount.toLocaleString()} รีวิว · เฉลี่ย {pctText(month.pct)}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 shrink-0">
            <Icon name="close" style={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="p-3">
          {loading ? (
            <p className="text-[12px] text-slate-400 text-center py-6">กำลังโหลด...</p>
          ) : !agg ? (
            <p className="text-[12px] text-slate-400 text-center py-6">ไม่มีรายการ</p>
          ) : (
            <div className="space-y-2.5">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-slate-500">ความพึงพอใจโดยรวม</p>
                  <p className="tnum text-[20px] font-bold text-slate-900">{agg.overall.toFixed(1)} / 10</p>
                </div>
                <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-600">
                  {pctText(agg.pct)}
                </span>
              </div>
              {agg.categories.map((c) => {
                const ratio = c.score / 10;
                const good = ratio >= 0.8;
                return (
                  <div key={c.key} className="rounded-xl border border-slate-100 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-slate-700 flex-1 min-w-0">{c.label}</p>
                      <span className={"tnum text-[12px] font-bold shrink-0 " + (good ? "text-emerald-600" : "text-amber-600")}>
                        {c.score.toFixed(1)} / 10
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={"h-full rounded-full " + (good ? "bg-emerald-500" : "bg-amber-500")}
                        style={{ width: `${Math.min(100, ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- sheet รายรีวิว (ตัด PII) ---------------- */
type ReviewFilter = "all" | "improve" | "low";
function ReviewsModal({
  dealerCode,
  month,
  onClose,
}: {
  dealerCode: string | null;
  month: CsMonth;
  onClose: () => void;
}) {
  const [reviews, setReviews] = useState<CsReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>("all");

  useEffect(() => {
    let cancelled = false;
    fetchCustSatReviews(dealerCode, month.period)
      .then((rv) => {
        if (!cancelled) setReviews(rv);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealerCode, month.period]);

  const shown = reviews.filter((r) =>
    filter === "improve" ? !!r.improve : filter === "low" ? r.overall <= 8 : true
  );
  const improveCount = reviews.filter((r) => r.improve).length;

  const chip = (key: ReviewFilter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      className={
        "px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition active:scale-95 " +
        (filter === key ? "bg-[#d32029] text-white" : "bg-white border border-slate-200 text-slate-600")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 z-10">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-slate-900 truncate">รายรีวิว {periodLabel(month.period)}</p>
              <p className="text-[11px] text-slate-400">{reviews.length.toLocaleString()} รีวิว · มีข้อเสนอแก้ไข {improveCount}</p>
            </div>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 shrink-0">
              <Icon name="close" style={{ fontSize: 18 }} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
            {chip("all", `ทั้งหมด (${reviews.length})`)}
            {chip("improve", `มีข้อเสนอแก้ไข (${improveCount})`)}
            {chip("low", "คะแนนต่ำ (≤8)")}
          </div>
        </div>
        <div className="p-3 space-y-2">
          {loading ? (
            <p className="text-[12px] text-slate-400 text-center py-6">กำลังโหลด...</p>
          ) : shown.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-6">ไม่มีรีวิวในหมวดนี้</p>
          ) : (
            shown.map((r, i) => {
              const hasComment = !!r.improve || !!r.impress;
              const scoreColor = r.overall <= 7 ? "bg-amber-500" : r.overall <= 9 ? "bg-emerald-500" : "bg-emerald-100 text-emerald-700";
              const highlight = !!r.improve;
              return (
                <div
                  key={i}
                  className={
                    "rounded-xl border p-2.5 " +
                    (highlight ? "bg-amber-50 border-amber-200" : hasComment ? "bg-white border-slate-100" : "bg-white border-slate-100 opacity-70")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className={
                      "tnum text-[11px] font-extrabold px-2 py-0.5 rounded-md shrink-0 " +
                      (r.overall <= 9 ? "text-white " + scoreColor : "bg-emerald-50 text-emerald-700")
                    }>
                      {r.overall.toFixed(0)}/10
                    </span>
                    <span className="text-[10px] text-slate-400">{fmtDate(r.evalDate)}</span>
                    {r.useEstimate && (
                      <span className="text-[9px] text-slate-400 truncate">· {r.useEstimate === "ใช้บริการ" ? "ถอดแบบประมาณการ" : "ไม่ถอดแบบ"}</span>
                    )}
                  </div>
                  {(r.product || r.purpose) && (
                    <div className="mt-1 space-y-0.5">
                      {r.product && <p className="text-[9.5px] text-slate-500 truncate">🏷 {r.product}</p>}
                      {r.purpose && <p className="text-[9.5px] text-slate-500 truncate">🎯 {r.purpose}</p>}
                    </div>
                  )}
                  {r.impress && (
                    <div className="mt-1.5">
                      <p className="text-[9.5px] font-bold text-emerald-600">👍 ประทับใจ</p>
                      <p className="text-[11px] text-slate-700 whitespace-pre-line">{r.impress}</p>
                    </div>
                  )}
                  {r.improve && (
                    <div className="mt-1.5">
                      <p className="text-[9.5px] font-bold text-[#dc2626]">🔧 ต้องการให้แก้ไข</p>
                      <p className="text-[11px] text-slate-700 whitespace-pre-line">{r.improve}</p>
                    </div>
                  )}
                  {!hasComment && <p className="text-[9.5px] text-slate-300 mt-1">— ไม่มีคอมเมนต์ —</p>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function CustSatScreen() {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const router = useRouter();
  const [summary, setSummary] = useState<CsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CsMonth | null>(null);
  const [reviewsMonth, setReviewsMonth] = useState<CsMonth | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const dealerCode = session
    ? session.isAdmin
      ? session.storeFilter
      : session.isSales
        ? null
        : session.dealer.code
    : null;

  // พนักงานขายไม่เกี่ยวกับความพึงพอใจร้าน -> พาออก
  useEffect(() => {
    if (ready && session && session.isSales) router.replace("/app/member");
  }, [ready, session, router]);

  useEffect(() => {
    let cancelled = false;
    fetchCustSatSummary(dealerCode)
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
  const months = yf.filtered as CsMonth[];
  const count = summary?.count ?? 0;
  const avgPct = summary?.avgPct ?? 0;
  const insight = summary?.insight ?? [];
  const improveTotal = summary?.improveTotal ?? 0;

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link href={homeHref} className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">ความพึงพอใจของลูกค้า</span>
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

        {/* Hero: ความพึงพอใจเฉลี่ยรวม */}
        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
              <Icon name="sentiment_very_satisfied" style={{ fontSize: 16 }} />
              ความพึงพอใจของลูกค้า (เฉลี่ยรวม)
              {session.isAdmin && !session.storeFilter ? " · ทุกร้าน" : ""}
            </p>
            <p className="tnum text-[36px] font-bold leading-none mt-1">{loading ? "…" : pctText(avgPct)}</p>
            <p className="text-[11px] text-red-100/80 mt-1">
              {loading ? "" : `จากแบบประเมิน ${count.toLocaleString()} รายการ`}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">คะแนนเฉลี่ย</p>
                <p className="tnum text-[15px] font-bold">{loading ? "…" : `${(avgPct * 10).toFixed(1)} / 10`}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">จำนวนรีวิว</p>
                <p className="tnum text-[15px] font-bold">{loading ? "…" : count.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </section>

        {/* แถบสรุปประเด็นที่ลูกค้าอยากให้ปรับปรุง */}
        {!loading && improveTotal > 0 && insight.length > 0 && (
          <section className="rounded-2xl bg-orange-50 border border-orange-200 p-3.5">
            <p className="text-[12px] font-bold text-orange-700 flex items-center gap-1.5">
              <Icon name="lightbulb" style={{ fontSize: 15 }} />
              ประเด็นที่ลูกค้าอยากให้ปรับปรุง ({improveTotal} ความเห็น)
            </p>
            <div className="mt-2 space-y-1.5">
              {insight.slice(0, 5).map((it) => {
                const ratio = improveTotal > 0 ? it.n / insight[0].n : 0;
                return (
                  <div key={it.label} className="flex items-center gap-2">
                    <span className="text-[10.5px] text-orange-900 w-[160px] shrink-0 truncate">{it.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-orange-100 overflow-hidden">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(6, ratio * 100)}%` }} />
                    </div>
                    <span className="tnum text-[10.5px] font-bold text-orange-700 shrink-0 w-6 text-right">{it.n}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-orange-400 mt-2">* จัดกลุ่มจากความเห็น &quot;สิ่งที่ต้องการให้แก้ไข&quot; · กดดูรายรีวิวในแต่ละเดือนด้านล่าง</p>
          </section>
        )}

        <YearFilter years={yf.years} activeYear={yf.activeYear} onSelect={setSelectedYear} />

        <section>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
            <Icon name="reviews" className="text-lg text-[#d32029]" />
            ความพึงพอใจรายเดือน
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
                <Icon name="reviews" className="text-2xl" />
              </div>
              <p className="mt-2 text-[13px] text-slate-500">ยังไม่มีข้อมูลความพึงพอใจสำหรับร้านนี้</p>
            </div>
          ) : (
            <div className="space-y-2">
              {months.map((m) => (
                <div
                  key={m.period}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Icon name="sentiment_satisfied" className="text-xl" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-slate-900">{periodLabel(m.period)}</p>
                        <p className="text-[11px] text-slate-400">
                          {m.reviewCount.toLocaleString()} รีวิว
                          {m.improveCount > 0 && <span className="text-[#dc2626]"> · ขอแก้ไข {m.improveCount}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="tnum text-[16px] font-bold text-slate-900 leading-none">{pctText(m.pct)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{m.overall.toFixed(1)} / 10</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => setDetail(m)}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-[10.5px] font-semibold text-slate-600 bg-slate-50 rounded-full py-1.5 active:scale-95 transition"
                    >
                      คะแนนรายด้าน
                      <Icon name="chevron_right" style={{ fontSize: 13 }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewsMonth(m)}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-[10.5px] font-bold text-[#c3161c] bg-[#fee2e2] rounded-full py-1.5 active:scale-95 transition"
                    >
                      เจาะดูรายรีวิว
                      <Icon name="chevron_right" style={{ fontSize: 13 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          แบบประเมินความพึงพอใจลูกค้า · คะแนนเต็ม 10 (แสดงเป็น %)
        </p>
      </div>

      {detail && <MonthDetailModal dealerCode={dealerCode} month={detail} onClose={() => setDetail(null)} />}
      {reviewsMonth && <ReviewsModal dealerCode={dealerCode} month={reviewsMonth} onClose={() => setReviewsMonth(null)} />}

      <BottomNav active="custSat" />
    </>
  );
}
