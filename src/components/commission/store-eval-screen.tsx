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
  fetchEvalItems,
  fetchEvalFailSummary,
  type EvalSummary,
  type EvalMonth,
  type EvalLine,
  type EvalItem,
  type EvalFail,
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

/* จัดกลุ่มข้อย่อยตามพนักงาน (staffNo); null = หมวดร้าน */
type StaffGroup = { staffNo: number | null; items: EvalItem[]; failCount: number };
function groupByStaff(items: EvalItem[]): StaffGroup[] {
  const map = new Map<number | null, EvalItem[]>();
  for (const it of items) {
    const k = it.staffNo;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === null) return -1;
    if (b === null) return 1;
    return a - b;
  });
  return keys.map((k) => {
    const arr = map.get(k)!.slice().sort((x, y) => x.itemNo - y.itemNo);
    return { staffNo: k, items: arr, failCount: arr.filter((x) => !x.passed).length };
  });
}

/* ---------------- แถวหมวด + ขยายข้อย่อย (เฉพาะหมวดไม่เต็ม) ---------------- */
function CategoryRow({
  categoryKey,
  label,
  score,
  max,
  submissionId,
}: {
  categoryKey: string;
  label: string;
  score: number;
  max: number;
  submissionId: string | null;
}) {
  const ratio = max > 0 ? score / max : 0;
  const full = ratio >= 1;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EvalItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null && submissionId) {
      setLoading(true);
      try {
        const all = await fetchEvalItems(submissionId);
        setItems(all.filter((it) => it.categoryKey === categoryKey));
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
  }

  // หมวดเต็ม = การ์ดปกติ (กดไม่ได้)
  if (full) {
    return (
      <div className="rounded-xl border border-slate-100 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-semibold text-slate-700 flex-1 min-w-0">{label}</p>
          <span className="tnum text-[12px] font-bold shrink-0 text-emerald-600">{score} / {max}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  // หมวดไม่เต็ม = เหลืองเด่น + กดดูข้อย่อย
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
      <button type="button" onClick={toggle} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-bold text-amber-800 flex-1 min-w-0">{label}</p>
          <span className="tnum text-[12px] font-bold shrink-0 text-amber-700">{score} / {max}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-amber-200/60 overflow-hidden">
          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
        <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] font-semibold text-amber-700">
          {open ? "ซ่อนข้อย่อย" : "ดูข้อที่ตก"}
          <Icon name={open ? "expand_less" : "expand_more"} style={{ fontSize: 14 }} />
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-2 border-t border-amber-200 pt-2">
          {loading ? (
            <p className="text-[11px] text-amber-600 text-center py-2">กำลังโหลด...</p>
          ) : !items || items.length === 0 ? (
            <p className="text-[11px] text-amber-600 text-center py-2">ไม่มีข้อมูลข้อย่อย</p>
          ) : (
            groupByStaff(items).map((grp) => (
              <div key={grp.staffNo ?? "store"} className="space-y-1.5">
                {grp.staffNo != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <Icon name="person" style={{ fontSize: 12 }} />
                      พนักงานคนที่ {grp.staffNo}
                    </span>
                    {grp.failCount > 0 && (
                      <span className="tnum text-[10px] font-semibold text-[#b91c1c]">ตก {grp.failCount} ข้อ</span>
                    )}
                  </div>
                )}
                {grp.items.map((it) => (
                  <div
                    key={`${grp.staffNo ?? "s"}-${it.itemNo}`}
                    className={
                      "flex items-start gap-2 rounded-lg p-2 " +
                      (it.passed ? "bg-white/60" : "bg-red-50 border border-red-200")
                    }
                  >
                    <span className={
                      "w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 " +
                      (it.passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-[#dc2626]")
                    }>
                      <Icon name={it.passed ? "check" : "close"} style={{ fontSize: 11 }} />
                    </span>
                    <p className={"text-[11px] leading-snug " + (it.passed ? "text-slate-600" : "text-[#b91c1c] font-semibold")}>
                      {it.itemNo}. {it.itemLabel}
                    </p>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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
                {/* 6 หมวด (หมวดไม่เต็มกดดูข้อย่อยได้) */}
                {l.categories.map((c) => (
                  <CategoryRow
                    key={c.key}
                    categoryKey={c.key}
                    label={c.label}
                    score={c.score}
                    max={c.max}
                    submissionId={l.submissionId}
                  />
                ))}
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
  const [fails, setFails] = useState<EvalFail[]>([]);
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
    fetchEvalFailSummary(dealerCode)
      .then((f) => {
        if (!cancelled) setFails(f);
      })
      .catch(() => {});
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

        {/* แถบสรุปข้อที่ร้านตกบ่อยสุด */}
        {!loading && fails.length > 0 && (
          <section className="rounded-2xl bg-orange-50 border border-orange-200 p-3.5">
            <p className="text-[12px] font-bold text-orange-700 flex items-center gap-1.5">
              <Icon name="warning" style={{ fontSize: 15 }} />
              ข้อที่ร้านคุณตกบ่อยสุด (รวมทุกครั้งที่ตรวจ)
            </p>
            <div className="mt-2 space-y-1.5">
              {fails.slice(0, 5).map((f, i) => {
                const ratio = fails[0].failCount > 0 ? f.failCount / fails[0].failCount : 0;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10.5px] text-orange-900 flex-1 min-w-0 truncate">{f.itemLabel}</span>
                    <div className="w-16 h-2 rounded-full bg-orange-100 overflow-hidden shrink-0">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(8, ratio * 100)}%` }} />
                    </div>
                    <span className="tnum text-[10.5px] font-bold text-orange-700 shrink-0 w-7 text-right">{f.failCount}×</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-orange-400 mt-2">* นับจำนวนครั้งที่ข้อนั้น &quot;ไม่ผ่าน&quot; · ข้อที่ตกซ้ำควรแก้เป็นอันดับแรก</p>
          </section>
        )}

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
