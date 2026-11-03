"use client";

/* =============================================================
   หน้ายอดขายงานบริการ (Service Sales)
   - hero: ยอดรวมของปีที่เลือก + จำนวนงาน + 3 กลุ่ม (สรุปปี)
   - เลือกปีได้ (default = ปีล่าสุด)
   - รายเดือนของปีนั้น -> ใต้แต่ละเดือนมี 3 กลุ่มงานบริการ
   - กดกลุ่มในเดือน -> เปิด modal ดูราย job (ตัด PII ชื่อลูกค้า)
   - dealer เห็นเฉพาะร้านตัวเอง ; admin เห็นรวมทุกร้าน + ยอดไม่ระบุร้าน
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { doLogout, useHomeHref, useSession } from "@/lib/commission/session";
import { ProfileCard } from "./profile-card";
import { YearChips, yearsOf } from "./year-filter";
import {
  fetchServiceSalesSummary,
  fetchServiceSalesGroups,
  fetchServiceSalesMonths,
  fetchServiceSalesJobs,
  type SsSummary,
  type SsGroup,
  type SsMonthDetail,
  type SsJob,
} from "@/lib/commission/service-sales-store";

function baht(n: number): string {
  return "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 0 });
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

/* สีประจำกลุ่ม */
const GROUP_META: Record<string, { icon: string; color: string; bar: string; soft: string }> = {
  "ROOF SERVICE": { icon: "roofing", color: "text-[#d32029]", bar: "bg-[#d32029]", soft: "bg-red-50" },
  "SMART SOLUTION": { icon: "bolt", color: "text-sky-600", bar: "bg-sky-500", soft: "bg-sky-50" },
  "Qchang": { icon: "handyman", color: "text-amber-600", bar: "bg-amber-500", soft: "bg-amber-50" },
};
function groupMeta(k: string) {
  return GROUP_META[k] ?? { icon: "category", color: "text-slate-600", bar: "bg-slate-400", soft: "bg-slate-50" };
}

/* ---------------- modal ราย job ของเดือน+กลุ่ม ---------------- */
function JobsModal({
  dealerCode,
  period,
  group,
  onClose,
}: {
  dealerCode: string | null;
  period: string;
  group: string;
  onClose: () => void;
}) {
  const [jobs, setJobs] = useState<SsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const meta = groupMeta(group);

  useEffect(() => {
    let cancelled = false;
    fetchServiceSalesJobs(dealerCode, period, group)
      .then((j) => { if (!cancelled) setJobs(j); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dealerCode, period, group]);

  const total = jobs.reduce((s, j) => s + j.amount, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
          <div className="min-w-0 flex items-center gap-2">
            <div className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 " + meta.soft + " " + meta.color}>
              <Icon name={meta.icon} style={{ fontSize: 17 }} />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900 truncate">{group}</p>
              <p className="text-[11px] text-slate-400">{periodLabel(period)} · {jobs.length} งาน · {baht(total)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 shrink-0">
            <Icon name="close" style={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {loading ? (
            <p className="text-[12px] text-slate-400 text-center py-6">กำลังโหลด...</p>
          ) : jobs.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-6">ไม่มีงานในกลุ่มนี้</p>
          ) : (
            jobs.map((j, i) => (
              <div key={i} className="rounded-xl border border-slate-100 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] font-semibold text-slate-700 flex-1 min-w-0">
                    {j.subSolutionName || j.solutionName || j.subGroup || "-"}
                  </p>
                  <span className="tnum text-[13px] font-bold text-[#a11119] shrink-0">{baht(j.amount)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-400">
                  {j.subGroup && (
                    <span className={"inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold " + meta.soft + " " + meta.color}>
                      {j.subGroup}
                    </span>
                  )}
                  {j.provinceName && <span className="inline-flex items-center gap-0.5"><Icon name="location_on" style={{ fontSize: 11 }} />{j.provinceName}</span>}
                  <span className="inline-flex items-center gap-0.5"><Icon name="event" style={{ fontSize: 11 }} />{fmtDate(j.closeDate)}</span>
                  {j.projectNumber && <span className="text-slate-300">{j.projectNumber}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- การ์ดเดือน + 3 กลุ่มใต้เดือน ---------------- */
function MonthCard({
  month,
  onOpenJobs,
}: {
  month: SsMonthDetail;
  onOpenJobs: (period: string, group: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left p-3.5 active:scale-[0.99] transition">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
              <Icon name="calendar_month" className="text-xl" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900">{periodLabel(month.period)}</p>
              <p className="text-[11px] text-slate-400">{month.jobCount.toLocaleString("th-TH")} งาน · {month.groups.length} กลุ่ม</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="tnum text-[16px] font-bold text-slate-900 leading-none">{baht(month.amount)}</p>
            <div className="flex items-center justify-end gap-0.5 mt-1 text-[10px] font-semibold text-slate-400">
              {open ? "ซ่อนกลุ่มงาน" : "ดูกลุ่มงาน"}
              <Icon name={open ? "expand_less" : "expand_more"} style={{ fontSize: 14 }} />
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3 py-2.5 space-y-2 bg-slate-50/50">
          {month.groups.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-2">ไม่มีกลุ่มงาน</p>
          ) : (
            month.groups.map((g) => {
              const meta = groupMeta(g.group3);
              const ratio = month.amount > 0 ? g.amount / month.amount : 0;
              return (
                <button
                  key={g.group3}
                  type="button"
                  onClick={() => onOpenJobs(month.period, g.group3)}
                  className="w-full text-left rounded-xl bg-white border border-slate-100 p-2.5 active:scale-[0.99] hover:border-red-200 transition"
                >
                  <div className="flex items-center gap-2">
                    <div className={"w-7 h-7 rounded-lg flex items-center justify-center shrink-0 " + meta.soft + " " + meta.color}>
                      <Icon name={meta.icon} style={{ fontSize: 15 }} />
                    </div>
                    <p className="text-[12px] font-bold text-slate-800 flex-1 min-w-0 truncate">{g.group3}</p>
                    <span className="tnum text-[12.5px] font-bold text-slate-900 shrink-0">{baht(g.amount)}</span>
                    <Icon name="chevron_right" className="text-slate-300 shrink-0" style={{ fontSize: 16 }} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={"h-full rounded-full " + meta.bar} style={{ width: `${Math.max(3, ratio * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{g.jobCount.toLocaleString("th-TH")} งาน</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function ServiceSalesScreen() {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const router = useRouter();
  const [summary, setSummary] = useState<SsSummary | null>(null);
  const [groups, setGroups] = useState<SsGroup[]>([]);
  const [months, setMonths] = useState<SsMonthDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(true);
  const [year, setYear] = useState<string | null | undefined>(undefined); // undefined = ยังไม่ตั้ง
  const [jobsView, setJobsView] = useState<{ period: string; group: string } | null>(null);

  const dealerCode = session
    ? session.isAdmin
      ? session.storeFilter
      : session.isSales
        ? null
        : session.dealer.code
    : null;

  // พนักงานขายไม่เกี่ยวกับยอดขายงานบริการร้าน -> พาออก
  useEffect(() => {
    if (ready && session && session.isSales) router.replace("/app/member");
  }, [ready, session, router]);

  // สรุปรวม + รายเดือน (ทุกปี) สำหรับคำนวณปี
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchServiceSalesSummary(dealerCode)
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dealerCode]);

  const years = useMemo(() => yearsOf((summary?.months ?? []).map((m) => m.period)), [summary]);
  const curYear = String(new Date().getFullYear());
  const activeYear =
    year === undefined ? (years.includes(curYear) ? curYear : years[0] ?? null) : year;

  // 3 กลุ่มใหญ่ (สรุปปี) + รายเดือน+กลุ่ม ตามปีที่เลือก
  useEffect(() => {
    if (!ready || !session || session.isSales) return;
    let cancelled = false;
    setDetailLoading(true);
    Promise.allSettled([
      fetchServiceSalesGroups(dealerCode, activeYear),
      fetchServiceSalesMonths(dealerCode, activeYear),
    ]).then((res) => {
      if (cancelled) return;
      if (res[0].status === "fulfilled") setGroups(res[0].value);
      if (res[1].status === "fulfilled") setMonths(res[1].value);
      setDetailLoading(false);
    });
    return () => { cancelled = true; };
  }, [dealerCode, activeYear, ready, session]);

  if (!ready || !session) return null;
  if (session.isSales) return null;

  const yearTotal = groups.reduce((s, g) => s + g.amount, 0);
  const yearJobs = groups.reduce((s, g) => s + g.jobCount, 0);
  const isAdminAll = session.isAdmin && !session.storeFilter;

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link href={homeHref} className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">ยอดขายงานบริการ</span>
        </div>
        <button
          onClick={() => { doLogout(); router.replace("/"); }}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[#a11119] bg-white border border-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition"
        >
          <Icon name="logout" style={{ fontSize: 16 }} />
          ออกจากระบบ
        </button>
      </header>

      <div className="space-y-4 pb-4">
        <ProfileCard />

        {/* Hero: ยอดรวมของปีที่เลือก */}
        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
              <Icon name="construction" style={{ fontSize: 16 }} />
              ยอดขายงานบริการ {activeYear ? `ปี ${Number(activeYear) + 543}` : "ทุกปี"}
              {isAdminAll ? " · ทุกร้าน" : ""}
            </p>
            <p className="tnum text-[32px] font-bold leading-none mt-1">
              {detailLoading ? "…" : baht(yearTotal)}
            </p>
            <p className="text-[11px] text-red-100/80 mt-1">
              {detailLoading ? "" : `${yearJobs.toLocaleString("th-TH")} งาน · รวม VAT`}
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {["ROOF SERVICE", "SMART SOLUTION", "Qchang"].map((k) => {
                const g = groups.find((x) => x.group3 === k);
                return (
                  <div key={k} className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2">
                    <p className="text-[10px] text-red-100/80 truncate">{k === "SMART SOLUTION" ? "SMART" : k === "ROOF SERVICE" ? "ROOF" : "Qchang"}</p>
                    <p className="tnum text-[12.5px] font-bold">{detailLoading ? "…" : baht(g?.amount ?? 0)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {isAdminAll && (
          <p className="text-[10.5px] text-slate-400 flex items-center gap-1 px-1">
            <Icon name="info" style={{ fontSize: 13 }} />
            ยอดรวมนี้รวมงานที่ยังระบุร้านไม่ได้ (เช่น Onetime / SCG Home)
          </p>
        )}

        {/* เลือกปี */}
        {years.length > 0 && (
          <YearChips years={years} activeYear={activeYear} onSelect={(y) => setYear(y)} />
        )}

        {/* รายเดือน -> 3 กลุ่มใต้เดือน -> ราย job */}
        <section>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
            <Icon name="calendar_month" className="text-lg text-[#d32029]" />
            ยอดขายรายเดือน
            {activeYear && <span className="text-[12px] font-semibold text-slate-400">· ปี {Number(activeYear) + 543}</span>}
          </h3>

          {detailLoading ? (
            <div className="py-8 text-center text-slate-300">
              <Icon name="progress_activity" className="animate-spin text-3xl" />
            </div>
          ) : months.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
                <Icon name="construction" className="text-2xl" />
              </div>
              <p className="mt-2 text-[13px] text-slate-500">ยังไม่มียอดขายงานบริการในปีนี้</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {months.map((m) => (
                <MonthCard
                  key={m.period}
                  month={m}
                  onOpenJobs={(period, group) => setJobsView({ period, group })}
                />
              ))}
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          ยอดขายงานบริการ (รวม VAT) · รายเดือน แบ่ง 3 กลุ่มงาน · กดกลุ่มเพื่อดูราย job
        </p>
      </div>

      {jobsView && (
        <JobsModal
          dealerCode={dealerCode}
          period={jobsView.period}
          group={jobsView.group}
          onClose={() => setJobsView(null)}
        />
      )}

      <BottomNav active="serviceSales" />
    </>
  );
}
