"use client";

/* =============================================================
   หน้ายอดขายงานบริการ (Service Sales) — LHS/Rudy · BA · รวม
   - hero: ยอดสะสมปีที่เลือก + เทียบปีก่อน + เดือนล่าสุดที่ครบ / เฉลี่ย / กลุ่มอันดับ 1
   - กราฟรายเดือน (ไฮไลต์เดือนล่าสุดที่มีข้อมูลเป็นค่าเริ่มต้น ; กดแท่งเพื่อเลือกเดือน)
   - ทั้งปี: 3 กลุ่มงาน (+หมวดย่อย) · พนักงานขาย (มุมมองร้าน) · อันดับร้าน (admin ทุกร้าน)
   - เดือนที่เลือก: 3 กลุ่มงาน (+หมวดย่อย) · พนักงานขาย · ปุ่มดูรายการงานทั้งเดือน
   - ทุกแถวกดได้ -> หน้าต่างรายการงาน (รูปแบบเดิม) กรองตามกลุ่ม/หมวดย่อย/พนักงาน/ร้าน
   - ขอบเขต: ร้านเห็นร้านตัวเอง ; พนักงานเห็นเฉพาะงานที่ตัวเองขาย ; admin ทุกร้าน (+ไม่ระบุร้าน)
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
  fetchServiceSalesSources,
  fetchServiceSalesBreakdown,
  ssPersonLabel,
  type SsSummary,
  type SsGroup,
  type SsMonthDetail,
  type SsJob,
  type SsJobQuery,
  type SsJobsResult,
  type SsSource,
  type SsSourceAmount,
  type SsBreakdown,
  type SsPersonRow,
} from "@/lib/commission/service-sales-store";
import { cn } from "@/lib/utils";
import { fetchFreshness, freshText, lastFullPeriod, type Freshness } from "@/lib/commission/freshness-store";
import { useLinkedPeriod } from "@/lib/commission/linked-period";
import { fetchTargets, pctLabel, tgTone, tgTotals, type TgCompare, type TgTotals } from "@/lib/commission/targets-store";
import { LyText, TargetBar, TargetProgress } from "./target-progress";

/** ข้อมูลประจำแหล่งข้อมูล (หัวข้อ + ลิงก์หน้า detail) */
const SOURCE_META: Record<SsSource, { label: string; short: string; icon: string; href: string }> = {
  rudy: { label: "ยอดขาย LHS/Rudy", short: "LHS/Rudy", icon: "roofing", href: "/app/service-sales/lhs" },
  ba: { label: "ยอดขาย BA", short: "BA", icon: "home_repair_service", href: "/app/service-sales/ba" },
};

const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthFull = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_MONTH[m - 1]} ${y + 543}`; };
const monthShort = (p: string) => { const [, m] = p.split("-").map(Number); return TH_SHORT[m - 1]; };
const prevPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const lyPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return `${y - 1}-${String(m).padStart(2, "0")}`; };
const curPeriod = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const yearLabelOf = (y: string | null) => (y ? `ปี ${Number(y) + 543}` : "ทุกปี");
function baht(n: number): string {
  return "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 0 });
}
const mil = (v: number) => (Math.abs(v) >= 1e6 ? `฿${(v / 1e6).toFixed(2)}M` : Math.abs(v) >= 1e3 ? `฿${(v / 1e3).toFixed(0)}K` : baht(v));
function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}
const pctText = (cur: number, base: number | null | undefined) =>
  base == null || base === 0 ? null : ((cur - base) / Math.abs(base)) * 100;

/* สีประจำกลุ่ม */
const GROUP_META: Record<string, { icon: string; color: string; bar: string; soft: string; ring: string }> = {
  "ROOF SERVICE": { icon: "roofing", color: "text-[#d32029]", bar: "bg-[#d32029]", soft: "bg-red-50", ring: "border-red-100" },
  "SMART SOLUTION": { icon: "bolt", color: "text-sky-600", bar: "bg-sky-500", soft: "bg-sky-50", ring: "border-sky-100" },
  "Qchang": { icon: "handyman", color: "text-amber-600", bar: "bg-amber-500", soft: "bg-amber-50", ring: "border-amber-100" },
};
function groupMeta(k: string | null | undefined) {
  return (k && GROUP_META[k]) || { icon: "category", color: "text-slate-600", bar: "bg-slate-400", soft: "bg-slate-50", ring: "border-slate-100" };
}
const GROUP_SHORT: Record<string, string> = { "ROOF SERVICE": "ROOF", "SMART SOLUTION": "SMART", Qchang: "Qchang" };

/* ---------------- หน้าต่างรายการงาน ---------------- */
interface JobsView {
  query: SsJobQuery;
  title: string;
  /** ช่วงเวลา/ขอบเขต เช่น "พ.ศ. 2569" หรือ "ก.ย. 2569" */
  scope: string;
  icon: string;
  group: string | null;
}
const PAGE = 100;

function JobCard({ j, showSource }: { j: SsJob; showSource: boolean }) {
  const meta = groupMeta(j.group3);
  return (
    <div className="rounded-xl border border-slate-100 p-2.5">
      {j.customerName && (
        <p className="text-[12.5px] font-bold text-slate-900 flex items-center gap-1 mb-0.5">
          <Icon name="person" style={{ fontSize: 14 }} className="text-slate-400" />
          <span className="truncate">{j.customerName}</span>
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-semibold text-slate-700 flex-1 min-w-0">{j.subSolutionName || j.solutionName || j.subGroup || "-"}</p>
        <span className="tnum text-[13px] font-bold text-[#a11119] shrink-0">{baht(j.amount)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-400">
        {showSource && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500">{SOURCE_META[j.source].short}</span>
        )}
        {j.typeOfJob && (
          <span className={"inline-flex items-center rounded-full px-1.5 py-0.5 font-semibold " + (j.typeOfJob === "I" ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600")}>
            {j.typeOfJob === "I" ? "I · ติดตั้ง" : "S · สำรวจ"}
          </span>
        )}
        {j.subGroup && <span className={"inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold " + meta.soft + " " + meta.color}>{j.subGroup}</span>}
        {j.provinceName && (
          <span className="inline-flex items-center gap-0.5">
            <Icon name="location_on" style={{ fontSize: 11 }} />
            {j.provinceName}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5">
          <Icon name="event" style={{ fontSize: 11 }} />
          {fmtDate(j.closeDate)}
        </span>
        {j.projectNumber && <span className="text-slate-300">{j.projectNumber}</span>}
      </div>
      {j.salesName && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
          <Icon name="badge" style={{ fontSize: 12 }} />
          พนักงานขาย: <span className="text-slate-600 font-medium truncate">{j.salesName}</span>
        </p>
      )}
    </div>
  );
}

function JobsModal({ view, showSource, onClose }: { view: JobsView; showSource: boolean; onClose: () => void }) {
  const isYear = !view.query.period;
  const [sub, setSub] = useState<string | null>(view.query.sub ?? null);
  const [order, setOrder] = useState<"amount" | "date">(isYear ? "date" : "amount");
  const [res, setRes] = useState<{ key: string; r: SsJobsResult } | null>(null);
  const [more, setMore] = useState(false);
  const query = view.query;
  const key = JSON.stringify([query, sub, order]);

  useEffect(() => {
    let cancelled = false;
    fetchServiceSalesJobs({ ...query, sub, order, offset: 0, limit: PAGE })
      .then((r) => !cancelled && setRes({ key, r }))
      .catch(() => !cancelled && setRes({ key, r: { jobs: [], total: 0, totalAmount: 0, subs: [] } }));
    return () => {
      cancelled = true;
    };
  }, [query, sub, order, key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loading = !res || res.key !== key;
  const r = !loading ? res!.r : null;
  const jobs = r?.jobs ?? [];
  const meta = groupMeta(view.group);
  const subs = r?.subs ?? [];

  const loadMore = async () => {
    if (!r || more) return;
    setMore(true);
    try {
      const next = await fetchServiceSalesJobs({ ...query, sub, order, offset: jobs.length, limit: PAGE });
      setRes((cur) => (cur && cur.key === key ? { key, r: { ...cur.r, jobs: [...cur.r.jobs, ...next.jobs] } } : cur));
    } finally {
      setMore(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={view.title}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 z-10">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex items-center gap-2">
              <div className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 " + meta.soft + " " + meta.color}>
                <Icon name={view.icon} style={{ fontSize: 17 }} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-slate-900 truncate">{view.title}</p>
                <p className="text-[11px] text-slate-400">
                  {view.scope}
                  {r ? ` · ${r.total.toLocaleString("th-TH")} งาน · ${baht(r.totalAmount)}` : ""}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="ปิด" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 shrink-0">
              <Icon name="close" style={{ fontSize: 18 }} />
            </button>
          </div>
          {(subs.length > 1 || sub) && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2.5 -mx-1 px-1">
              {[{ label: null as string | null, jobCount: subs.reduce((a, s) => a + s.jobCount, 0) }, ...subs].map((s) => {
                const active = s.label === sub;
                return (
                  <button
                    key={s.label ?? "__all__"}
                    type="button"
                    onClick={() => setSub(s.label)}
                    aria-pressed={active}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold transition",
                      active ? "bg-[#d32029] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {s.label ?? "ทั้งหมด"} <span className={active ? "text-red-100" : "text-slate-400"}>{s.jobCount}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-1 mt-2 text-[10.5px]">
            <span className="text-slate-400 mr-0.5">เรียงตาม:</span>
            {(["amount", "date"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrder(o)}
                aria-pressed={order === o}
                className={cn("rounded-full px-2 py-0.5 font-semibold", order === o ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}
              >
                {o === "amount" ? "ยอดเงิน" : "วันที่ล่าสุด"}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 space-y-2">
          {loading ? (
            <p className="text-[12px] text-slate-400 text-center py-6">กำลังโหลด...</p>
          ) : jobs.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-6">ไม่มีงาน</p>
          ) : (
            jobs.map((j, i) => {
              const divider = isYear && order === "date" && j.period && j.period !== jobs[i - 1]?.period;
              return (
                <div key={`${j.projectNumber ?? ""}|${i}`}>
                  {divider && <p className="text-[11px] font-bold text-slate-500 pt-2 pb-1 px-0.5">{monthFull(j.period!)}</p>}
                  <JobCard j={j} showSource={showSource} />
                </div>
              );
            })
          )}
          {r && jobs.length < r.total && (
            <button
              type="button"
              onClick={loadMore}
              disabled={more}
              className="w-full rounded-xl bg-[#fee2e2]/60 py-2.5 text-[12px] font-bold text-[#c3161c] active:scale-[0.99] transition disabled:opacity-60"
            >
              {more ? "กำลังโหลด..." : `โหลดเพิ่ม (แสดง ${jobs.length.toLocaleString("th-TH")} จาก ${r.total.toLocaleString("th-TH")} งาน)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- ส่วนประกอบหน้า ---------------- */
function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const w = max > 0 ? Math.max(0, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
      <div className={cn("h-full rounded-full transition-all duration-500", className ?? "bg-[#d32029]")} style={{ width: `${Math.max(w, value > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

/** 3 กลุ่มงาน + หมวดย่อย — กดกลุ่ม/หมวดย่อยเพื่อดูงาน */
function GroupsBlock({
  groups,
  total,
  onOpen,
  targets,
}: {
  groups: SsGroup[];
  total: number;
  onOpen: (group: string, sub: string | null) => void;
  /** เป้ารายกลุ่ม (เฉพาะหน้ารวม + มุมมองร้าน/admin) */
  targets?: Map<string, TgTotals> | null;
}) {
  if (groups.length === 0) return <p className="text-[12px] text-slate-400 text-center py-3">ไม่มีข้อมูล</p>;
  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const meta = groupMeta(g.group3);
        const maxSub = Math.max(1, ...g.subs.map((s) => s.amount));
        return (
          <div key={g.group3} className={cn("rounded-xl border overflow-hidden", meta.ring)}>
            <button
              type="button"
              onClick={() => onOpen(g.group3, null)}
              aria-label={`ดูงานกลุ่ม ${g.group3}`}
              className={cn("w-full text-left px-3 py-2.5 flex items-center gap-2 active:scale-[0.99] transition", meta.soft)}
            >
              <div className={"w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-white " + meta.color}>
                <Icon name={meta.icon} style={{ fontSize: 15 }} />
              </div>
              <span className="flex-1 min-w-0">
                <span className="block text-[12.5px] font-bold text-slate-900 truncate">{g.group3}</span>
                <span className="block text-[10px] text-slate-500">{g.jobCount.toLocaleString("th-TH")} งาน</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block tnum text-[13px] font-bold text-slate-900">{mil(g.amount)}</span>
                <span className="block text-[10px] text-slate-500">{total ? ((g.amount / total) * 100).toFixed(0) : 0}%</span>
              </span>
              <Icon name="chevron_right" className="text-slate-300 shrink-0" style={{ fontSize: 16 }} />
            </button>
            {(() => {
              const t = targets?.get(g.group3);
              if (!t || t.target <= 0) return null;
              const tone = tgTone(t.pct);
              return (
                <div className="px-3 pt-2 pb-2 bg-white border-b border-slate-50">
                  <div className="flex items-center justify-between gap-2 text-[10.5px]">
                    <span className="text-slate-500">
                      เป้า <b className="tnum text-slate-700">{mil(t.target)}</b>
                    </span>
                    <span className={cn("font-bold tnum", tone.text)}>{pctLabel(t.pct)} ของเป้า</span>
                  </div>
                  <TargetBar pct={t.pct} className="mt-1" />
                  <p className="text-[10px] mt-1 text-right"><LyText t={t} fmt={mil} /></p>
                </div>
              );
            })()}
            {g.subs.length > 0 && (
              <ul className="px-3 py-1.5 bg-white divide-y divide-slate-50">
                {g.subs.map((s) => (
                  <li key={s.label}>
                    <button
                      type="button"
                      onClick={() => onOpen(g.group3, s.label)}
                      aria-label={`ดูงาน ${s.label}`}
                      className="w-full text-left py-1.5 hover:bg-slate-50 rounded-md transition"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="truncate text-slate-700">{s.label}</span>
                        <span className="shrink-0 text-slate-500 inline-flex items-center">
                          <span className="tnum font-semibold text-slate-800">{mil(s.amount)}</span>
                          <span className="ml-1">· {s.jobCount} งาน</span>
                          <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 14 }} />
                        </span>
                      </div>
                      <div className="mt-1"><Bar value={s.amount} max={maxSub} className={meta.bar} /></div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface PersonAgg {
  key: string;
  repCode: string | null;
  salesName: string | null;
  label: string;
  amount: number;
  jobs: number;
  byGroup: Map<string, number>;
}
function aggregatePeople(rows: SsPersonRow[]): PersonAgg[] {
  const m = new Map<string, PersonAgg>();
  rows.forEach((r) => {
    const key = r.repCode ? `rep:${r.repCode}` : r.salesName ? `name:${r.salesName}` : "none";
    let a = m.get(key);
    if (!a) {
      a = { key, repCode: r.repCode, salesName: r.salesName, label: ssPersonLabel(r), amount: 0, jobs: 0, byGroup: new Map() };
      m.set(key, a);
    }
    a.amount += r.amount;
    a.jobs += r.jobCount;
    a.byGroup.set(r.group3, (a.byGroup.get(r.group3) ?? 0) + r.jobCount);
  });
  // พนักงานในระบบ -> ชื่ออื่น -> ไม่ระบุ ; แต่ละกลุ่มเรียงตามยอด
  const rank = (a: PersonAgg) => (a.repCode ? 0 : a.salesName ? 1 : 2);
  return [...m.values()].sort((a, b) => rank(a) - rank(b) || b.amount - a.amount);
}

function PeopleBlock({ people, total, onOpen }: { people: PersonAgg[]; total: number; onOpen: (p: PersonAgg) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? people : people.slice(0, 8);
  return (
    <>
      <ul className="divide-y divide-slate-50">
        {shown.map((p, i) => {
          const unknown = !p.repCode && !p.salesName;
          const groupsText = [...p.byGroup.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${GROUP_SHORT[g] ?? g} ${n}`).join(" · ");
          return (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => onOpen(p)}
                aria-label={`ดูงานของ ${p.label}`}
                className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-slate-50 rounded-lg -mx-1.5 px-1.5 transition"
              >
                <span
                  className={cn(
                    "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold",
                    unknown || !p.repCode ? "border border-dashed border-slate-300 text-slate-400" : i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  )}
                >
                  {p.repCode ? i + 1 : "?"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={cn("block truncate text-[12.5px]", p.repCode ? "text-slate-800 font-semibold" : "text-slate-500")}>
                    {p.label}
                    {p.repCode && <Icon name="verified" className="text-[#d32029] align-[-2px] ml-1" style={{ fontSize: 13 }} />}
                  </span>
                  <span className="block text-[10.5px] text-slate-400 truncate">{p.jobs.toLocaleString("th-TH")} งาน · {groupsText}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block tnum text-[13px] font-bold text-slate-900">{mil(p.amount)}</span>
                  <span className="block text-[10.5px] text-slate-400">{total ? ((p.amount / total) * 100).toFixed(0) : 0}%</span>
                </span>
                <Icon name="chevron_right" className="text-slate-300 shrink-0" style={{ fontSize: 16 }} />
              </button>
            </li>
          );
        })}
      </ul>
      {people.length > 8 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 w-full text-[12px] font-bold text-[#c3161c] bg-[#fee2e2]/60 rounded-xl py-2">
          {all ? "ย่อ" : `ดูทั้งหมด ${people.length} คน`}
        </button>
      )}
      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
        <Icon name="verified" className="text-[#d32029]" style={{ fontSize: 12 }} />
        = พนักงานในระบบ · ชื่ออื่นเป็นชื่อตามระบบต้นทาง · กดชื่อเพื่อดูงาน
      </p>
    </>
  );
}

/** source: null = รวมทุกแหล่ง, 'rudy' = LHS/Rudy, 'ba' = BA ร้านค้า */
export function ServiceSalesScreen({ source = null }: { source?: SsSource | null }) {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const router = useRouter();
  const pageTitle = source ? SOURCE_META[source].label : "ยอดขายงานบริการ (รวม)";
  const [sumState, setSumState] = useState<{ key: string; s: SsSummary | null } | null>(null);
  const [detail, setDetail] = useState<{
    key: string;
    groups: SsGroup[];
    months: SsMonthDetail[];
    breakdown: SsBreakdown;
    sources: SsSourceAmount[];
  } | null>(null);
  // ช่วงเวลาจากหน้าหลัก (?p= เดือน / ?y= สะสมปี) — ไม่มี = เดือนที่ครบล่าสุด
  const linked = useLinkedPeriod();
  const [year, setYear] = useState<string | null | undefined>(linked.year ?? undefined); // undefined = ยังไม่ตั้ง
  const [selected, setSelected] = useState<string | null>(linked.period);
  const [jobsView, setJobsView] = useState<JobsView | null>(null);
  const [allStores, setAllStores] = useState(false);
  /** อันดับร้าน (admin): เรียงตามยอดขาย หรือ % ถึงเป้า */
  const [storeSort, setStoreSort] = useState<"amount" | "pct">("amount");
  const [fresh, setFresh] = useState<Freshness | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchFreshness().then((f) => !cancelled && setFresh(f));
    return () => {
      cancelled = true;
    };
  }, []);
  /** ส่วนล่างกราฟ: "month" = เดือนที่เลือก (ค่าเริ่มต้น) | "year" = ทั้งปี */
  const [view, setView] = useState<"month" | "year">(linked.mode === "year" ? "year" : "month");

  // ขอบเขต: ร้าน / พนักงาน (เฉพาะงานตัวเอง) / admin (ทุกร้าน, เจาะร้าน, มุมมองร้าน/พนักงาน)
  const isAdmin = !!session?.isAdmin;
  const adminStoreView = isAdmin && session?.adminViewMode === "store" && !!session.adminViewDealer;
  // มุมมองพนักงาน (admin หรือ Area/Coach เลือกพนักงานในร้านที่ดูแล) -> เห็นเหมือนพนักงานคนนั้น
  const staffView = !session?.isSales && !!session?.viewRep;
  const isSales = !!session?.isSales || staffView;
  const dealerCode = session
    ? isAdmin
      ? staffView ? null : adminStoreView ? session.adminViewDealer : session.storeFilter
      : isSales ? null : session.dealer.code || null
    : null;
  const repCode = staffView ? session?.viewRep ?? null : isSales ? session?.repCode ?? session?.empId ?? null : null;
  const adminAll = isAdmin && !dealerCode && !repCode;
  const canFetch = !!session && (isAdmin || !!dealerCode || !!repCode);
  const sumKey = `${dealerCode ?? ""}|${repCode ?? ""}|${source ?? ""}`;

  // สรุปรวม + รายเดือน (ทุกปี) สำหรับคำนวณปี / เทียบปีก่อน
  useEffect(() => {
    if (!ready || !canFetch) return;
    let cancelled = false;
    fetchServiceSalesSummary(dealerCode, source, repCode)
      .then((s) => !cancelled && setSumState({ key: sumKey, s }))
      .catch(() => !cancelled && setSumState({ key: sumKey, s: null }));
    return () => {
      cancelled = true;
    };
  }, [ready, canFetch, dealerCode, source, repCode, sumKey]);

  const summary = sumState && sumState.key === sumKey ? sumState.s : null;
  const summaryLoaded = !!sumState && sumState.key === sumKey;
  const allMonths = useMemo(() => summary?.months ?? [], [summary]);
  const years = useMemo(() => yearsOf(allMonths.map((m) => m.period)), [allMonths]);
  const curYear = String(new Date().getFullYear());
  // ปีที่เลือกต้องอยู่ในช่วงที่แสดง (ปีปัจจุบัน + ปีก่อน) — ลิงก์ปีเก่า / ค่าเดิม "ทุกปี" ให้กลับเป็นปีปัจจุบัน
  const activeYear = year && years.includes(year) ? year : years.includes(curYear) ? curYear : years[0] ?? null;
  const detailKey = `${sumKey}|${activeYear ?? ""}`;

  // 3 กลุ่ม (ปี) + รายเดือน+กลุ่ม + แยกพนักงาน/ร้าน + แยกแหล่ง ตามปีที่เลือก
  useEffect(() => {
    if (!ready || !canFetch || !summaryLoaded) return;
    let cancelled = false;
    Promise.allSettled([
      fetchServiceSalesGroups(dealerCode, activeYear, source, repCode),
      fetchServiceSalesMonths(dealerCode, activeYear, source, repCode),
      repCode ? Promise.resolve({ people: [], stores: [] } as SsBreakdown) : fetchServiceSalesBreakdown(dealerCode, activeYear, source),
      source === null ? fetchServiceSalesSources(dealerCode, activeYear, repCode) : Promise.resolve([] as SsSourceAmount[]),
    ]).then((res) => {
      if (cancelled) return;
      setDetail({
        key: detailKey,
        groups: res[0].status === "fulfilled" ? res[0].value : [],
        months: res[1].status === "fulfilled" ? res[1].value : [],
        breakdown: res[2].status === "fulfilled" ? res[2].value : { people: [], stores: [] },
        sources: res[3].status === "fulfilled" ? res[3].value : [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, canFetch, summaryLoaded, dealerCode, activeYear, source, repCode, detailKey]);

  // เป้า (TG) / ปีก่อน (LY): เฉพาะหน้ารวม (LHS/Rudy + BA ตามรายงาน Power BI) — พนักงานไม่มีเป้ารายคน
  const tgOn = source === null && !isSales && !!activeYear;
  const tgKey = `${dealerCode ?? ""}|${activeYear ?? ""}`;
  const [tgState, setTgState] = useState<{ key: string; t: TgCompare } | null>(null);
  useEffect(() => {
    if (!ready || !canFetch || !tgOn || !activeYear) return;
    let cancelled = false;
    fetchTargets("service_sales", dealerCode, activeYear).then((t) => !cancelled && setTgState({ key: tgKey, t }));
    return () => {
      cancelled = true;
    };
  }, [ready, canFetch, tgOn, dealerCode, activeYear, tgKey]);
  const tg = tgOn && tgState?.key === tgKey && tgState.t.ok && tgState.t.hasTarget ? tgState.t : null;

  const d = detail && detail.key === detailKey ? detail : null;
  const detailLoading = !d;
  const months = useMemo(() => d?.months ?? [], [d]); // ใหม่ -> เก่า
  const byPeriodAll = useMemo(() => new Map(allMonths.map((m) => [m.period, m])), [allMonths]);

  if (!ready || !session) return null;

  const groups = [...(d?.groups ?? [])].sort((a, b) => b.amount - a.amount);
  const yearTotal = groups.reduce((s, g) => s + g.amount, 0);
  const yearJobs = groups.reduce((s, g) => s + g.jobCount, 0);
  const nowP = curPeriod();
  const fullMonths = months.filter((m) => m.period !== nowP);
  const ytdFull = fullMonths.reduce((a, m) => a + m.amount, 0);
  const hasLy = fullMonths.length > 0 && fullMonths.every((m) => byPeriodAll.has(lyPeriod(m.period)));
  const lyBase = fullMonths.reduce((a, m) => a + (byPeriodAll.get(lyPeriod(m.period))?.amount ?? 0), 0);
  const yoy = activeYear && hasLy ? pctText(ytdFull, lyBase) : null;
  const lastFull = fullMonths[0];
  const avg = fullMonths.length ? ytdFull / fullMonths.length : 0;
  const top = groups[0];

  // เดือนที่เลือก: ค่าเริ่มต้น = เดือนล่าสุดที่มีข้อมูล
  // เดือนที่ดู: ที่เลือก/ส่งมาจากหน้าหลัก -> เดือนที่ครบล่าสุด (เหมือนค่าเริ่มต้นหน้าหลัก) -> เดือนล่าสุดที่มีข้อมูล
  const focus =
    (selected && months.find((m) => m.period === selected)) || months.find((m) => m.period === lastFullPeriod()) || months[0];
  const chart = [...months].reverse();
  const tgMonthMax = (() => {
    if (!tg) return 0;
    const m = new Map<string, number>();
    tg.months.forEach((c) => m.set(c.period, (m.get(c.period) ?? 0) + Math.max(c.target, c.ly)));
    return Math.max(0, ...m.values());
  })();
  const maxAmt = Math.max(1, tgMonthMax, ...chart.map((m) => m.amount));
  const unitM = maxAmt >= 1e6;

  const showPeople = !!dealerCode && !repCode;
  const peopleYear = showPeople ? aggregatePeople(d?.breakdown.people ?? []) : [];
  const peopleMonth = showPeople && focus ? aggregatePeople((d?.breakdown.people ?? []).filter((p) => p.period === focus.period)) : [];
  // มุมมองส่วนล่าง: เดือนที่เลือกจากกราฟ (ค่าเริ่มต้น = เดือนล่าสุด) หรือทั้งปี
  const isMonth = view === "month" && !!focus;
  const storePeriod = isMonth ? focus!.period : null;
  const storesYear = adminAll
    ? (() => {
        const m = new Map<string, { code: string | null; name: string; model: string | null; amount: number; jobs: number }>();
        (d?.breakdown.stores ?? []).filter((s) => !storePeriod || s.period === storePeriod).forEach((s) => {
          const k = s.dealerCode ?? "__none__";
          const a = m.get(k) ?? { code: s.dealerCode, name: s.dealerName ?? (s.dealerCode ? s.dealerCode : "ไม่ระบุร้าน"), model: s.model, amount: 0, jobs: 0 };
          a.amount += s.amount;
          a.jobs += s.jobCount;
          m.set(k, a);
        });
        return [...m.values()].sort((a, b) => (a.code ? 0 : 1) - (b.code ? 0 : 1) || b.amount - a.amount);
      })()
    : [];
  const maxStore = Math.max(1, ...storesYear.filter((s) => s.code).map((s) => s.amount));

  const scopeQuery: SsJobQuery = { dealerCode, repCode, source };
  const yScope = activeYear ? `พ.ศ. ${Number(activeYear) + 543}` : "ทุกปี";
  // ทุกปี -> ใช้ปีของแต่ละเดือนไม่ได้ จึงเปิดรายการงานได้เฉพาะเมื่อเลือกปี
  const openYear = (v: Omit<JobsView, "scope" | "query"> & { query: SsJobQuery }) => {
    if (!activeYear) return;
    setJobsView({ ...v, scope: yScope, query: { ...scopeQuery, ...v.query, year: activeYear } });
  };
  const openMonth = (period: string, v: Omit<JobsView, "scope" | "query"> & { query: SsJobQuery }) =>
    setJobsView({ ...v, scope: monthFull(period), query: { ...scopeQuery, ...v.query, period } });
  // ค่าที่ส่วนล่างกราฟใช้ (ตามเดือนที่เลือก หรือทั้งปี)
  const vGroups = isMonth ? [...focus!.groups].sort((a, b) => b.amount - a.amount) : groups;
  const vTotal = isMonth ? focus!.amount : yearTotal;
  const vJobs = isMonth ? focus!.jobCount : yearJobs;
  const vPeople = isMonth ? peopleMonth : peopleYear;

  // เป้า: ทั้งปี = สะสมถึงเดือนที่ครบล่าสุด (ไม่นับเดือนปัจจุบันที่ยังไม่ครบ) ; เดือน = เดือนที่เลือก
  const tgUpTo = activeYear ? (activeYear < nowP.slice(0, 4) ? `${activeYear}-12` : lastFull?.period ?? null) : null;
  const tgUpToLabel = tgUpTo ? `สะสมถึง ${monthShort(tgUpTo)}` : "";
  const tgYear = tg && tgUpTo ? tgTotals(tg.months, (p) => p <= tgUpTo) : null;
  const tgKeep = (p: string) => (isMonth ? p === focus!.period : !!tgUpTo && p <= tgUpTo);
  const tgView = tg ? tgTotals(tg.months, tgKeep) : null;
  const tgGroups = tg ? new Map(["ROOF SERVICE", "SMART SOLUTION", "Qchang"].map((g) => [g, tgTotals(tg.months, tgKeep, g)])) : null;
  const tgByMonth = new Map<string, { target: number; ly: number }>();
  tg?.months.forEach((c) => {
    const o = tgByMonth.get(c.period) ?? { target: 0, ly: 0 };
    o.target += c.target;
    o.ly += c.ly;
    tgByMonth.set(c.period, o);
  });
  // กลุ่มที่มีเป้าแต่ยังไม่มียอด -> แสดงแถวว่างให้เห็นว่ายังไม่ถึงเป้า
  const vGroupsT: SsGroup[] = tgGroups
    ? [
        ...vGroups,
        ...[...tgGroups.entries()]
          .filter(([g, t]) => t.target > 0 && !vGroups.some((x) => x.group3 === g))
          .map(([g]) => ({ group3: g, amount: 0, jobCount: 0, subs: [] })),
      ]
    : vGroups;
  // อันดับร้าน (admin): % ถึงเป้ารายร้าน ตามช่วงเดียวกับส่วนล่างกราฟ
  const storeTg = new Map<string, TgTotals>();
  if (tg && adminAll) {
    const by = new Map<string, TgCompare["stores"]>();
    tg.stores.forEach((s) => by.set(s.dealerCode, [...(by.get(s.dealerCode) ?? []), s]));
    by.forEach((cells, code) => storeTg.set(code, tgTotals(cells, tgKeep)));
  }
  const pctOf = (code: string | null) => (code ? storeTg.get(code)?.pct ?? null : null);
  const storesShown =
    storeSort === "pct" && storeTg.size
      ? [...storesYear].sort((a, b) => (a.code ? 0 : 1) - (b.code ? 0 : 1) || (pctOf(b.code) ?? -1) - (pctOf(a.code) ?? -1))
      : storesYear;
  const vKey = isMonth ? focus!.period : `y${activeYear ?? "all"}`;
  const openView = (v: Omit<JobsView, "scope" | "query"> & { query: SsJobQuery }) =>
    isMonth ? openMonth(focus!.period, v) : openYear(v);
  const personQuery = (p: PersonAgg): SsJobQuery =>
    p.repCode ? { repCode: p.repCode } : p.salesName ? { sales: p.salesName } : { unassigned: true };

  const unitNote = source === "rudy" ? "รวม VAT" : source === "ba" ? "ยอด gmv" : "LHS/Rudy รวม VAT · BA ยอด gmv";
  const scopeLabel = isSales ? "ยอดที่คุณขาย" : dealerCode ? "ยอดขายของร้าน" : "ทุกร้าน";
  const latestDate = summary?.latestDate ? fmtDate(summary.latestDate) : null;
  const prevFocus = focus ? byPeriodAll.get(prevPeriod(focus.period)) : undefined;
  const focusDelta = focus && focus.period !== nowP ? pctText(focus.amount, prevFocus?.amount) : null;

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link href={homeHref} aria-label="กลับ" className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">{pageTitle}</span>
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

        {/* Hero: ยอดสะสมของปีที่เลือก */}
        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
              <Icon name={source ? SOURCE_META[source].icon : "construction"} style={{ fontSize: 16 }} />
              {scopeLabel} · ยอดสะสม{yearLabelOf(activeYear)} ({unitNote})
            </p>
            <p className="tnum text-[32px] font-bold leading-none mt-1">{detailLoading ? "…" : baht(yearTotal)}</p>
            {!detailLoading && (
              <p className="text-[11px] text-red-50 mt-1.5 flex flex-wrap items-center gap-x-1">
                {yoy != null ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Icon name={yoy >= 0 ? "arrow_upward" : "arrow_downward"} style={{ fontSize: 13 }} />
                    <span className="tnum font-bold">{Math.abs(yoy).toFixed(1)}%</span> เทียบช่วงเดียวกันปีก่อน
                  </span>
                ) : (
                  <span className="text-red-100/70">เทียบปีก่อน: -</span>
                )}
                <span className="text-red-100/70">· {yearJobs.toLocaleString("th-TH")} งาน</span>
              </p>
            )}
            {!detailLoading && tgYear && tgYear.target > 0 && (
              <div className="mt-3 rounded-xl bg-black/10 px-3 py-2">
                <TargetProgress t={tgYear} fmt={mil} dark label={tgUpToLabel} />
                {adminAll && <p className="text-[9.5px] text-red-100/70 mt-1">เทียบเป้า: เฉพาะร้าน HE / SCG Home ที่ยังเป็นตัวแทน (ไม่รวมไม่ระบุร้าน)</p>}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2">
                <p className="text-[10.5px] text-red-100/80">เดือนล่าสุดที่ครบ</p>
                <p className="tnum text-[14px] font-bold leading-tight mt-0.5">{lastFull ? mil(lastFull.amount) : "-"}</p>
                <p className="text-[10px] text-red-100/70">{lastFull ? monthFull(lastFull.period) : ""}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2">
                <p className="text-[10.5px] text-red-100/80">เฉลี่ย/เดือน</p>
                <p className="tnum text-[14px] font-bold leading-tight mt-0.5">{avg ? mil(avg) : "-"}</p>
                <p className="text-[10px] text-red-100/70">{fullMonths.length} เดือน</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2 min-w-0">
                <p className="text-[10.5px] text-red-100/80">กลุ่มอันดับ 1</p>
                <p className="text-[12.5px] font-bold leading-tight mt-0.5 truncate">{top?.group3 ?? "-"}</p>
                <p className="text-[10px] text-red-100/70">{top && yearTotal ? `${((top.amount / yearTotal) * 100).toFixed(0)}% ของยอด` : ""}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
          แหล่งข้อมูล <b className="text-slate-700">{source === "rudy" ? "Rudy (win contract)" : source === "ba" ? "BA App (win)" : "LHS/Rudy + BA"}</b>
          {(() => {
            const ft = freshText(fresh, source === "rudy" ? ["lhs"] : source === "ba" ? ["ba"] : ["lhs", "ba"]);
            return ft ? <> · <span className={ft.stale ? "text-amber-600 font-semibold" : ""}>{ft.text}</span></> : latestDate ? <> · ข้อมูลถึง {latestDate}</> : null;
          })()}
          {isSales && <> · นับเฉพาะงานที่ผูกกับชื่อของคุณ</>}
        </div>

        {/* โหมดรวม: การ์ดย่อยแยกตามแหล่งข้อมูล */}
        {source === null && (
          <section className="grid grid-cols-2 gap-2.5">
            {(["rudy", "ba"] as SsSource[]).map((k) => {
              const meta = SOURCE_META[k];
              const s = d?.sources.find((x) => x.source === k);
              return (
                <Link key={k} href={meta.href} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-3.5 active:scale-[0.98] hover:border-red-200 hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center">
                      <Icon name={meta.icon} style={{ fontSize: 19 }} />
                    </div>
                    <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
                  </div>
                  <p className="text-[12.5px] font-bold text-slate-900 mt-2 leading-tight">{meta.label}</p>
                  <p className="tnum text-[15px] font-bold text-[#a11119] mt-1">{detailLoading ? "…" : baht(s?.amount ?? 0)}</p>
                  <p className="text-[10px] text-slate-400">{detailLoading ? "" : `${(s?.jobCount ?? 0).toLocaleString("th-TH")} งาน`}</p>
                </Link>
              );
            })}
          </section>
        )}

        {adminAll && (
          <p className="text-[10.5px] text-slate-400 flex items-center gap-1 px-1">
            <Icon name="info" style={{ fontSize: 13 }} />
            ยอดรวมนี้รวมงานที่ยังระบุร้านไม่ได้ (เช่น Onetime / SCG Home / ร้าน Q-CHANG ที่ไม่อยู่ในระบบ)
          </p>
        )}

        {years.length > 0 && (
          <YearChips
            years={years}
            activeYear={activeYear}
            onSelect={(y) => {
              setYear(y);
              setSelected(null);
              setView("month");
              setAllStores(false);
            }}
          />
        )}

        {/* กราฟรายเดือน */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 mb-3">
            <Icon name="bar_chart" className="text-lg text-[#d32029]" />
            ยอดขายรายเดือน
          </h3>
          {detailLoading ? (
            <div className="py-8 text-center text-slate-300"><Icon name="progress_activity" className="animate-spin text-3xl" /></div>
          ) : chart.length === 0 ? (
            <div className="py-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
                <Icon name="construction" className="text-2xl" />
              </div>
              <p className="mt-2 text-[13px] text-slate-500">ยังไม่มียอดขายงานบริการในปีนี้</p>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-36 overflow-x-auto no-scrollbar">
                {chart.map((m) => {
                  const active = view === "month" && m.period === focus?.period;
                  const partial = m.period === nowP;
                  const h = Math.max(3, (m.amount / maxAmt) * 100);
                  const v = unitM ? m.amount / 1e6 : m.amount / 1e3;
                  return (
                    <button
                      key={m.period}
                      type="button"
                      onClick={() => {
                        setSelected(m.period);
                        setView("month");
                        setAllStores(false);
                      }}
                      aria-pressed={active && view === "month"}
                      aria-label={`${monthFull(m.period)} ${baht(m.amount)}`}
                      className="flex-1 min-w-[26px] h-full flex flex-col justify-end items-center group"
                    >
                      <span className={cn("tnum text-[9px] mb-0.5", active ? "text-[#a11119] font-bold" : "text-slate-400")}>
                        {v.toFixed(unitM ? (v >= 10 ? 0 : 1) : 0)}
                      </span>
                      <span className="relative w-full flex-1 flex items-end">
                        <span
                          className={cn(
                            "w-full rounded-t-md transition-all duration-500",
                            active ? "bg-[#d32029]" : partial ? "bg-red-200 border border-dashed border-red-300" : "bg-red-300/80 group-hover:bg-red-400"
                          )}
                          style={{ height: `${h}%` }}
                        />
                        {(() => {
                          const t = tgByMonth.get(m.period);
                          if (!t) return null;
                          return (
                            <>
                              {t.target > 0 && (
                                <span className="absolute -left-0.5 -right-0.5 h-[2px] bg-slate-900 rounded" style={{ bottom: `${(t.target / maxAmt) * 100}%` }} aria-hidden="true" />
                              )}
                              {t.ly > 0 && (
                                <span className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-500 ring-1 ring-white" style={{ bottom: `calc(${(t.ly / maxAmt) * 100}% - 3px)` }} aria-hidden="true" />
                              )}
                            </>
                          );
                        })()}
                      </span>
                      <span className={cn("text-[10px] mt-1", active ? "text-[#a11119] font-bold" : "text-slate-500")}>{monthShort(m.period)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10.5px] text-slate-400 mt-2">
                หน่วย: {unitM ? "ล้านบาท" : "พันบาท"} · แท่งสีเข้ม = เดือนที่กำลังดู (เริ่มที่เดือนล่าสุด) · กดแท่งเพื่อเปลี่ยนเดือน
                {chart.some((m) => m.period === nowP) ? " · เส้นประ = เดือนปัจจุบัน (ยังไม่ครบเดือน)" : ""}
              </p>
              {tg && (
                <p className="text-[10.5px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="inline-flex items-center gap-1"><span className="w-3 h-[2px] bg-slate-900 rounded" aria-hidden="true" />เป้า (TG)</span>
                  <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" aria-hidden="true" />ปีก่อน (LY)</span>
                  {adminAll && <span className="text-slate-400">แท่งรวมไม่ระบุร้าน · เป้าเฉพาะร้าน HE/SCG Home</span>}
                </p>
              )}
            </>
          )}
        </section>

        {!detailLoading && months.length > 0 && (
          <>
            {/* ===== ส่วนล่างกราฟ: ปรับตามเดือนที่กด (หรือทั้งปี) ===== */}
            <div className="flex items-end justify-between gap-2 px-0.5 pt-1">
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500">{isMonth ? "รายละเอียดเดือน" : "รายละเอียดทั้งปี"}</p>
                <h3 className="text-[16px] font-bold text-slate-900">{isMonth ? monthFull(focus!.period) : yearLabelOf(activeYear)}</h3>
              </div>
              <div className="text-right shrink-0">
                <p className="tnum text-[16px] font-bold text-slate-900">{baht(vTotal)}</p>
                <p className="text-[10.5px] text-slate-500">
                  {vJobs.toLocaleString("th-TH")} งาน
                  {isMonth && focusDelta != null && (
                    <span className={cn("ml-1 font-semibold", focusDelta >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {focusDelta >= 0 ? "▲" : "▼"} {Math.abs(focusDelta).toFixed(1)}% จากเดือนก่อน
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="ช่วงข้อมูล">
              {(["month", "year"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={(t === "month") === isMonth}
                  onClick={() => {
                    setView(t);
                    setAllStores(false);
                  }}
                  className={cn(
                    "rounded-lg py-1.5 text-[12px] font-bold transition",
                    (t === "month") === isMonth ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {t === "month" ? `เดือน ${focus ? monthFull(focus.period) : ""}` : `ทั้ง${yearLabelOf(activeYear)}`}
                </button>
              ))}
            </div>

            <section key={`g-${vKey}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-fade-up">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                  <Icon name="category" className="text-lg text-[#d32029]" />
                  กลุ่มงานบริการ
                </h3>
                <span className="text-[10.5px] text-slate-400">กดกลุ่มเพื่อดูงาน</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex my-2.5" aria-hidden="true">
                {vGroups.map((g) => (
                  <div key={g.group3} className={groupMeta(g.group3).bar} style={{ width: `${vTotal ? (g.amount / vTotal) * 100 : 0}%` }} />
                ))}
              </div>
              {tgView && tgView.target > 0 && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 mb-2.5">
                  <TargetProgress
                    t={tgView}
                    fmt={mil}
                    label={isMonth ? monthShort(focus!.period) : tgUpToLabel}
                    partial={isMonth && focus!.period === nowP}
                  />
                </div>
              )}
              <GroupsBlock
                groups={vGroupsT}
                total={vTotal}
                targets={tgGroups}
                onOpen={(group, sub) => openView({ title: sub ?? group, icon: groupMeta(group).icon, group, query: { group, sub } })}
              />
              {!isMonth && !activeYear && <p className="text-[10px] text-slate-400 mt-2">เลือกปีด้านบนเพื่อกดดูรายการงาน</p>}
            </section>

            {showPeople && vPeople.length > 0 && (
              <section key={`p-${vKey}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-fade-up">
                <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 mb-1.5">
                  <Icon name="groups" className="text-lg text-[#d32029]" />
                  พนักงานขาย
                </h3>
                <PeopleBlock
                  people={vPeople}
                  total={vTotal}
                  onOpen={(p) => openView({ title: p.label, icon: "badge", group: null, query: personQuery(p) })}
                />
              </section>
            )}

            {adminAll && storesYear.length > 0 && (
              <section key={`s-${vKey}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-fade-up">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                    <Icon name="storefront" className="text-lg text-[#d32029]" />
                    อันดับร้าน
                  </h3>
                  {storeTg.size > 0 && (
                    <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-[10.5px] font-bold" role="group" aria-label="เรียงอันดับร้าน">
                      {(["amount", "pct"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={storeSort === k}
                          onClick={() => setStoreSort(k)}
                          className={cn("rounded-full px-2.5 py-1 transition", storeSort === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
                        >
                          {k === "amount" ? "ยอดขาย" : "% ถึงเป้า"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ul className="space-y-1">
                  {(allStores ? storesShown : storesShown.slice(0, 10)).map((s, i) => (
                    <li key={s.code ?? "__none__"}>
                      <button
                        type="button"
                        disabled={!s.code}
                        onClick={() => s.code && openView({ title: s.name, icon: "storefront", group: null, query: { dealerCode: s.code } })}
                        aria-label={`ดูงานของ ${s.name}`}
                        className="w-full text-left rounded-lg -mx-1.5 px-1.5 py-1.5 hover:bg-slate-50 active:bg-slate-100 transition disabled:hover:bg-transparent"
                      >
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="truncate text-slate-800">
                            <span className="tnum text-slate-400 w-6 inline-block">{s.code ? i + 1 : "–"}</span>
                            <span className={s.code ? "font-semibold" : "text-slate-400"}>{s.name}</span>
                          </span>
                          <span className="shrink-0 tnum font-bold text-slate-900 inline-flex items-center">
                            {mil(s.amount)}
                            <span className="text-[10px] font-normal text-slate-400 ml-1">{s.jobs} งาน</span>
                            {s.code && <Icon name="chevron_right" className="text-slate-300 text-lg ml-0.5" />}
                          </span>
                        </div>
                        {s.code && (() => {
                          const t = storeTg.get(s.code);
                          if (storeSort === "pct" && t && t.target > 0) {
                            return (
                              <div className="mt-1 pl-6">
                                <TargetBar pct={t.pct} />
                                <p className="text-[10px] text-slate-500 mt-0.5 flex justify-between gap-2">
                                  <span>
                                    เป้า {mil(t.target)} · <b className={tgTone(t.pct).text}>{pctLabel(t.pct)}</b>
                                  </span>
                                  <LyText t={t} fmt={mil} />
                                </p>
                              </div>
                            );
                          }
                          return (
                            <div className="mt-1 pl-6">
                              <Bar value={s.amount} max={maxStore} className={s.model === "SCG Home" ? "bg-blue-500" : "bg-[#d32029]"} />
                              {t && t.target > 0 && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  เป้า {mil(t.target)} · <b className={tgTone(t.pct).text}>{pctLabel(t.pct)}</b>
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </button>
                    </li>
                  ))}
                </ul>
                {storesYear.length > 10 && (
                  <button type="button" onClick={() => setAllStores((v) => !v)} className="mt-2 w-full text-[12px] font-bold text-[#c3161c] bg-[#fee2e2]/60 rounded-xl py-2">
                    {allStores ? "ย่อ" : `ดูทั้งหมด ${storesYear.length} ร้าน`}
                  </button>
                )}
              </section>
            )}

            {(isMonth || activeYear) && (
              <button
                type="button"
                onClick={() => openView({ title: "รายการงานทั้งหมด", icon: "receipt_long", group: null, query: {} })}
                className="w-full rounded-2xl bg-white border border-slate-100 shadow-sm p-3.5 flex items-center gap-3 text-left hover:border-red-200 hover:-translate-y-0.5 active:scale-[0.99] transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                  <Icon name="receipt_long" style={{ fontSize: 19 }} />
                </div>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-bold text-slate-900">ดูรายการงานทั้งหมด</span>
                  <span className="block text-[10.5px] text-slate-400">
                    {isMonth ? monthFull(focus!.period) : yearLabelOf(activeYear)} · {vJobs.toLocaleString("th-TH")} งาน
                  </span>
                </span>
                <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
              </button>
            )}
          </>
        )}

        <p className="text-[11px] text-slate-400 text-center">
          {source === "ba"
            ? "ยอดขายงานบริการ BA รายวัน (gmv รวมค่าสำรวจ+ติดตั้ง) · พนักงานจาก BA Incentive"
            : source === "rudy"
              ? "ยอดขายงานบริการ LHS/Rudy (รวม VAT) · พนักงาน = ผู้สร้างโครงการใน Rudy"
              : "ยอดขายงานบริการรวม 2 แหล่ง (LHS/Rudy รวม VAT · BA ยอด gmv)"}
        </p>
      </div>

      {jobsView && <JobsModal view={jobsView} showSource={source === null} onClose={() => setJobsView(null)} />}

      <BottomNav active="serviceSales" />
    </>
  );
}
