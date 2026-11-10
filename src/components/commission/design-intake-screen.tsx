"use client";

/* =============================================================
   แบบรับเข้า — จำนวนแบบที่เข้ามาแต่ละเดือน แยก Material / Solution
   - ร้านค้า: ของร้านตัวเอง + แยกรายพนักงาน (SE) ของเดือนที่เลือก
   - admin : ทุกร้าน (หรือร้านที่เจาะดู) + แยกรายร้าน
   - พนักงานขาย: เฉพาะแบบที่ตัวเองสร้าง
   ข้อมูลจาก CRM Opportunity ; เดือน = วันที่สร้างเอกสาร
   ============================================================= */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { ProfileCard } from "./profile-card";
import { YearChips, yearsOf } from "./year-filter";
import { doLogout, useHomeHref, useSession } from "@/lib/commission/session";
import { fetchDesignIntake, type DiMonth, type DiSummary } from "@/lib/commission/design-intake-store";
import { DesignIntakeJobsModal } from "./design-intake-jobs-modal";
import { cn } from "@/lib/utils";

const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthFull = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_MONTH[m - 1]} ${y + 543}`; };
const monthShort = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_SHORT[m - 1]} ${String(y + 543).slice(-2)}`; };
const prevPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const lyPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return `${y - 1}-${String(m).padStart(2, "0")}`; };
const total = (m: DiMonth | undefined) => (m ? m.material + m.solution : 0);
const fmt = (v: number) => v.toLocaleString("th-TH");

function Delta({ cur, base, label }: { cur: number; base: number | null; label: string }) {
  if (base == null || base === 0) return <span className="text-[11px] text-red-100/70">{label}: -</span>;
  const pct = ((cur - base) / base) * 100;
  const up = pct >= 0;
  return (
    <span className="text-[11px] text-red-50 inline-flex items-center gap-0.5">
      {label}
      <Icon name={up ? "arrow_upward" : "arrow_downward"} style={{ fontSize: 13 }} />
      <span className="tnum font-bold">{Math.abs(pct).toFixed(0)}%</span>
      <span className="text-red-100/70">({fmt(base)})</span>
    </span>
  );
}

/** แท่งสัดส่วน Material / Solution */
function SplitBar({ material, solution, max }: { material: number; solution: number; max: number }) {
  const w = max > 0 ? ((material + solution) / max) * 100 : 0;
  const mPct = material + solution > 0 ? (material / (material + solution)) * 100 : 0;
  return (
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
      <div className="h-full flex rounded-full overflow-hidden" style={{ width: `${Math.max(w, material + solution > 0 ? 3 : 0)}%` }}>
        <div className="h-full bg-[#1e5a7a]" style={{ width: `${mPct}%` }} />
        <div className="h-full bg-[#4fb0b3]" style={{ width: `${100 - mPct}%` }} />
      </div>
    </div>
  );
}

export function DesignIntakeScreen() {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const router = useRouter();
  const [data, setData] = useState<{ key: string; s: DiSummary | null } | null>(null);
  const [year, setYear] = useState<string | null | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [jobsPeriod, setJobsPeriod] = useState<string | null>(null);

  const isSales = !!session?.isSales;
  const isAdmin = !!session?.isAdmin;
  const dealerCode = session ? (isAdmin ? session.storeFilter : isSales ? null : session.dealer.code || null) : null;
  const repCode = isSales ? session?.repCode ?? session?.empId ?? null : null;
  const key = `${dealerCode ?? ""}|${repCode ?? ""}`;

  useEffect(() => {
    if (!ready || !session) return;
    if (!isAdmin && !dealerCode && !repCode) return;
    let cancelled = false;
    fetchDesignIntake({ dealerCode, repCode })
      .then((s) => !cancelled && setData({ key, s }))
      .catch(() => !cancelled && setData({ key, s: null }));
    return () => {
      cancelled = true;
    };
  }, [ready, session, isAdmin, dealerCode, repCode, key]);

  const s = data && data.key === key ? data.s : null;
  const loading = !data || data.key !== key;
  const months = useMemo(() => s?.months ?? [], [s]);
  const byPeriod = useMemo(() => new Map(months.map((m) => [m.period, m])), [months]);
  const years = yearsOf(months.map((m) => m.period));
  const curYear = String(new Date().getFullYear());
  const activeYear = year === undefined ? (years.includes(curYear) ? curYear : years[0] ?? null) : year;
  const shown = months.filter((m) => !activeYear || m.period.startsWith(activeYear));
  const maxTotal = Math.max(1, ...shown.map(total));

  const latest = months[0];
  const focus = (selected && byPeriod.get(selected)) || latest;
  const focusPeriod = focus?.period ?? null;

  // แยกตามเดือนที่เลือก: ร้านค้า -> รายพนักงาน ; admin ทุกร้าน -> รายร้าน
  const breakdown = useMemo(() => {
    if (!s || !focusPeriod) return [];
    const rows = dealerCode
      ? s.reps.filter((r) => r.period === focusPeriod).map((r) => ({
          key: r.repCode ?? "-",
          label: r.name ? `${r.name}${r.nickname ? ` (${r.nickname})` : ""}` : "ไม่ระบุพนักงาน",
          material: r.material,
          solution: r.solution,
          muted: !r.repCode,
        }))
      : s.stores.filter((r) => r.period === focusPeriod).map((r) => ({
          key: r.dealerCode ?? "-",
          label: r.dealerName ?? "ไม่ระบุร้าน",
          material: r.material,
          solution: r.solution,
          muted: !r.dealerCode,
        }));
    return rows.sort((a, b) => b.material + b.solution - (a.material + a.solution));
  }, [s, focusPeriod, dealerCode]);

  if (!ready || !session) return null;

  const latestTotal = total(latest);
  const prev = latest ? byPeriod.get(prevPeriod(latest.period)) : undefined;
  const ly = latest ? byPeriod.get(lyPeriod(latest.period)) : undefined;
  const scopeLabel = isSales ? "แบบที่คุณรับเข้า" : dealerCode ? "แบบรับเข้าของร้าน" : "แบบรับเข้า · ทุกร้าน";
  const maxBreak = Math.max(1, ...breakdown.map((b) => b.material + b.solution));
  const latestDate = s?.latestDate
    ? new Date(s.latestDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
    : null;

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link href={homeHref} aria-label="กลับ" className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">แบบรับเข้า</span>
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

        {/* Hero: เดือนล่าสุด */}
        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
              <Icon name="architecture" style={{ fontSize: 16 }} />
              {scopeLabel} {latest ? `· ${monthFull(latest.period)}` : ""}
            </p>
            <p className="tnum text-[36px] font-bold leading-none mt-1">
              {loading ? "…" : fmt(latestTotal)}
              <span className="text-[14px] font-semibold text-red-100/90 ml-1.5">แบบ</span>
            </p>
            {!loading && latest && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                <Delta cur={latestTotal} base={prev ? total(prev) : null} label="เทียบเดือนก่อน" />
                <Delta cur={latestTotal} base={ly ? total(ly) : null} label="เทียบปีก่อน" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#7fc4e6]" aria-hidden="true" /> แบบ Material
                </p>
                <p className="tnum text-[18px] font-bold">{loading ? "…" : fmt(latest?.material ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#9be3e5]" aria-hidden="true" /> แบบ Solution
                </p>
                <p className="tnum text-[18px] font-bold">{loading ? "…" : fmt(latest?.solution ?? 0)}</p>
              </div>
            </div>
            {latestDate && <p className="text-[10.5px] text-red-100/70 mt-2">ข้อมูลถึง {latestDate} · เดือนปัจจุบันยังนับไม่ครบ</p>}
          </div>
        </section>

        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
          <b className="text-slate-700">Material</b> = งานถอดแบบ/ออกแบบประมาณการสินค้า ·{" "}
          <b className="text-slate-700">Solution</b> = งานบริการ เช่น ติดตั้งหลังคา (นับตามวันที่สร้างเอกสารใน CRM)
        </div>

        <YearChips years={years} activeYear={activeYear} onSelect={(y) => setYear(y)} />

        {/* รายเดือน */}
        <section>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
            <Icon name="calendar_month" className="text-lg text-[#d32029]" />
            แบบรับเข้ารายเดือน
          </h3>
          {loading ? (
            <div className="py-8 text-center text-slate-300">
              <Icon name="progress_activity" className="animate-spin text-3xl" />
            </div>
          ) : shown.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center text-[13px] text-slate-500">
              ยังไม่มีข้อมูลแบบรับเข้า
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
              {shown.map((m) => {
                const active = m.period === focusPeriod;
                return (
                  <button
                    key={m.period}
                    type="button"
                    onClick={() => {
                      setSelected(m.period);
                      setJobsPeriod(m.period);
                    }}
                    aria-pressed={active}
                    aria-label={`ดูรายการแบบรับเข้า ${monthFull(m.period)}`}
                    className={cn("w-full text-left px-3.5 py-2.5 transition", active ? "bg-red-50/60" : "hover:bg-slate-50")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-[13px] font-bold", active ? "text-[#a11119]" : "text-slate-900")}>{monthShort(m.period)}</span>
                      <span className="text-[11.5px] text-slate-500 inline-flex items-center">
                        <span className="text-[#1e5a7a] font-semibold">M {fmt(m.material)}</span>
                        <span className="mx-1">·</span>
                        <span className="text-[#2b8a8d] font-semibold">S {fmt(m.solution)}</span>
                        <span className="tnum text-[14px] font-bold text-slate-900 ml-2">{fmt(total(m))}</span>
                        <Icon name="chevron_right" className="text-slate-300 text-lg ml-0.5" />
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <SplitBar material={m.material} solution={m.solution} max={maxTotal} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[10.5px] text-slate-400 mt-1.5 flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#1e5a7a]" aria-hidden="true" /> Material</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#4fb0b3]" aria-hidden="true" /> Solution</span>
            <span>กดที่เดือนเพื่อดูรายการแบบทีละงาน</span>
          </p>
        </section>

        {/* แยกรายพนักงาน / รายร้าน ของเดือนที่เลือก */}
        {!isSales && focusPeriod && breakdown.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                <Icon name={dealerCode ? "groups" : "storefront"} className="text-lg text-[#d32029]" />
                {dealerCode ? "แยกตามพนักงาน" : "แยกตามร้าน"} · {monthFull(focusPeriod)}
              </h3>
              <button
                type="button"
                onClick={() => setJobsPeriod(focusPeriod)}
                className="shrink-0 text-[11px] font-bold text-[#c3161c] bg-[#fee2e2] rounded-full px-3 py-1 active:scale-95 transition"
              >
                ดูรายการแบบ
              </button>
            </div>
            <ul className="space-y-2">
              {breakdown.map((b) => (
                <li key={b.key}>
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className={cn("truncate", b.muted ? "text-slate-400" : "text-slate-800 font-semibold")}>{b.label}</span>
                    <span className="shrink-0 text-slate-500">
                      M {fmt(b.material)} · S {fmt(b.solution)}
                      <span className="tnum font-bold text-slate-900 ml-1.5">{fmt(b.material + b.solution)}</span>
                    </span>
                  </div>
                  <div className="mt-1">
                    <SplitBar material={b.material} solution={b.solution} max={maxBreak} />
                  </div>
                </li>
              ))}
            </ul>
            {dealerCode && (
              <p className="text-[10px] text-slate-400 mt-2">&quot;ไม่ระบุพนักงาน&quot; = ผู้สร้างเอกสารใน CRM ที่จับคู่กับพนักงานในระบบไม่ได้</p>
            )}
          </section>
        )}
      </div>

      {jobsPeriod && (
        <DesignIntakeJobsModal
          period={jobsPeriod}
          title={monthFull(jobsPeriod)}
          dealerCode={dealerCode}
          repCode={repCode}
          showStore={!dealerCode && !repCode}
          onClose={() => setJobsPeriod(null)}
        />
      )}

      <BottomNav active="home" />
    </>
  );
}
