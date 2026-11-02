"use client";

/* =============================================================
   หน้าผลตรวจประเมินร้านค้า (แบบตรวจมาตรฐานการให้บริการ Housing Expert)
   - hero: ผลล่าสุด (คะแนน % + ผ่าน/ไม่ผ่าน) + จำนวนครั้ง + เฉลี่ย
   - รายเดือน (คะแนน + ผ่าน/ไม่ผ่าน), drill-down 6 หมวดคะแนน
   - server-authoritative ผ่าน /api/store-eval (แสดงเฉพาะร้านที่มีผลตรวจ)
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
  fetchEvalSummary,
  fetchEvalMonthLines,
  type EvalSummary,
  type EvalMonth,
  type EvalLine,
} from "@/lib/commission/store-eval-store";

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
const pctText = (p: number) => `${Math.round(p * 100)}%`;
const isPass = (r: string | null) => r === "ผ่าน";

/* ---------------- modal drill-down 6 หมวด ---------------- */
function MonthDetailModal({
  dealerCode,
  month,
  onClose,
}: {
  dealerCode: string | null;
  month: EvalMonth;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<EvalLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchEvalMonthLines(dealerCode, month.period)
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
            <p className="text-[15px] font-bold text-slate-900 truncate">ผลตรวจ {periodLabel(month.period)}</p>
            <p className="text-[11px] text-slate-400">ตรวจวันที่ {fmtDate(month.evalDate)}{month.inspector ? ` · ${month.inspector}` : ""}</p>
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
            lines.map((l, i) => (
              <div key={i} className="space-y-2.5">
                {/* สรุปผลรอบนี้ */}
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[12px] text-slate-500">คะแนนรวม</p>
                    <p className="tnum text-[20px] font-bold text-slate-900">{l.totalScore} / {l.maxScore}</p>
                  </div>
                  <span className={
                    "px-3 py-1 rounded-full text-[12px] font-bold " +
                    (isPass(l.result) ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-[#d32029]")
                  }>
                    {l.result ?? "-"} · {pctText(l.pct)}
                  </span>
                </div>
                {/* 6 หมวด */}
                {l.categories.map((c) => {
                  const ratio = c.max > 0 ? c.score / c.max : 0;
                  const full = ratio >= 1;
                  return (
                    <div key={c.key} className="rounded-xl border border-slate-100 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-semibold text-slate-700 flex-1 min-w-0">{c.label}</p>
                        <span className={"tnum text-[12px] font-bold shrink-0 " + (full ? "text-emerald-600" : "text-amber-600")}>
                          {c.score} / {c.max}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={"h-full rounded-full " + (full ? "bg-emerald-500" : "bg-amber-500")}
                          style={{ width: `${Math.min(100, ratio * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function StoreEvalScreen() {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const router = useRouter();
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<EvalMonth | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const dealerCode = session
    ? session.isAdmin
      ? session.storeFilter
      : session.isSales
        ? null
        : session.dealer.code
    : null;

  // พนักงานขายไม่เกี่ยวกับผลตรวจร้าน -> พาออก
  useEffect(() => {
    if (ready && session && session.isSales) router.replace("/app/member");
  }, [ready, session, router]);

  useEffect(() => {
    let cancelled = false;
    fetchEvalSummary(dealerCode)
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
  const months = yf.filtered as EvalMonth[];
  const latest = summary?.latest ?? null;
  const count = summary?.count ?? 0;
  const passCount = summary?.passCount ?? 0;
  const avgPct = summary?.avgPct ?? 0;

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link href={homeHref} className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">ผลตรวจประเมินร้านค้า</span>
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

        {/* Hero: ผลล่าสุด */}
        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
              <Icon name="verified" style={{ fontSize: 16 }} />
              ผลตรวจมาตรฐานการให้บริการล่าสุด
              {session.isAdmin && !session.storeFilter ? " · ทุกร้าน" : ""}
            </p>
            {loading ? (
              <p className="tnum text-[36px] font-bold leading-none mt-1">…</p>
            ) : latest ? (
              <>
                <div className="flex items-end gap-2 mt-1">
                  <p className="tnum text-[36px] font-bold leading-none">{pctText(latest.pct)}</p>
                  <span className={
                    "mb-0.5 px-2.5 py-0.5 rounded-full text-[12px] font-bold " +
                    (isPass(latest.result) ? "bg-white/20 text-white" : "bg-black/20 text-white")
                  }>
                    {latest.result ?? "-"}
                  </span>
                </div>
                <p className="text-[11px] text-red-100/80 mt-1">
                  {latest.totalScore} / {latest.maxScore} คะแนน · ตรวจ {fmtDate(latest.evalDate)}
                </p>
              </>
            ) : (
              <p className="tnum text-[20px] font-bold leading-none mt-2">ยังไม่มีผลตรวจ</p>
            )}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">ตรวจแล้ว</p>
                <p className="tnum text-[15px] font-bold">{count} ครั้ง</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">ผ่าน</p>
                <p className="tnum text-[15px] font-bold">{passCount} ครั้ง</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">เฉลี่ย</p>
                <p className="tnum text-[15px] font-bold">{pctText(avgPct)}</p>
              </div>
            </div>
          </div>
        </section>

        <YearFilter years={yf.years} activeYear={yf.activeYear} onSelect={setSelectedYear} />

        <section>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
            <Icon name="fact_check" className="text-lg text-[#d32029]" />
            ผลตรวจรายเดือน
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
                <Icon name="fact_check" className="text-2xl" />
              </div>
              <p className="mt-2 text-[13px] text-slate-500">ยังไม่มีผลตรวจประเมินสำหรับร้านนี้</p>
            </div>
          ) : (
            <div className="space-y-2">
              {months.map((m) => {
                const pass = isPass(m.result);
                return (
                  <button
                    key={m.period}
                    type="button"
                    onClick={() => setDetail(m)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 active:scale-[0.99] hover:border-red-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 " +
                          (pass ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-[#d32029]")
                        }>
                          <Icon name={pass ? "check_circle" : "cancel"} className="text-xl" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-slate-900">{periodLabel(m.period)}</p>
                          <p className="text-[11px] text-slate-400">ตรวจ {fmtDate(m.evalDate)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="tnum text-[16px] font-bold text-slate-900 leading-none">{pctText(m.pct)}</p>
                        <p className={"text-[11px] font-semibold mt-0.5 " + (pass ? "text-emerald-600" : "text-[#d32029]")}>
                          {m.result ?? "-"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end mt-1.5 text-[10px] text-slate-400 gap-1">
                      ดูรายละเอียดคะแนน
                      <Icon name="chevron_right" style={{ fontSize: 14 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          แบบตรวจมาตรฐานการให้บริการ Housing Expert · คะแนนเต็ม 100 (6 หมวด)
        </p>
      </div>

      {detail && <MonthDetailModal dealerCode={dealerCode} month={detail} onClose={() => setDetail(null)} />}

      <BottomNav active="storeEval" />
    </>
  );
}
