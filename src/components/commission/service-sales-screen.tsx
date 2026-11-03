"use client";

/* =============================================================
   หน้ายอดขายงานบริการ (Service Sales)
   - hero: ยอดรวมของปีที่เลือก + จำนวนงาน
   - เลือกปีได้ (default = ปีล่าสุด)
   - 3 กลุ่มใหญ่ (ROOF SERVICE / SMART SOLUTION / Qchang) กดขยายดูหมวดย่อย
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
  type SsSummary,
  type SsGroup,
} from "@/lib/commission/service-sales-store";

function baht(n: number): string {
  return "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 0 });
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

/* ---------------- การ์ดกลุ่มใหญ่ + ขยายหมวดย่อย ---------------- */
function GroupRow({ group, grandTotal }: { group: SsGroup; grandTotal: number }) {
  const [open, setOpen] = useState(false);
  const meta = groupMeta(group.group3);
  const ratio = grandTotal > 0 ? group.amount / grandTotal : 0;
  const maxSub = group.subs.reduce((mx, s) => Math.max(mx, s.amount), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left p-3.5 active:scale-[0.99] transition">
        <div className="flex items-center gap-2.5">
          <div className={"w-10 h-10 rounded-xl flex items-center justify-center shrink-0 " + meta.soft + " " + meta.color}>
            <Icon name={meta.icon} className="text-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-slate-900">{group.group3}</p>
            <p className="text-[11px] text-slate-400">{group.jobCount.toLocaleString("th-TH")} งาน · {group.subs.length} หมวดย่อย</p>
          </div>
          <div className="text-right shrink-0">
            <p className="tnum text-[15px] font-bold text-slate-900 leading-none">{baht(group.amount)}</p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">{Math.round(ratio * 100)}% ของยอดรวม</p>
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={"h-full rounded-full " + meta.bar} style={{ width: `${Math.max(3, ratio * 100)}%` }} />
        </div>
        <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] font-semibold text-slate-400">
          {open ? "ซ่อนหมวดย่อย" : "ดูหมวดย่อย"}
          <Icon name={open ? "expand_less" : "expand_more"} style={{ fontSize: 14 }} />
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3.5 py-2.5 space-y-2 bg-slate-50/50">
          {group.subs.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-2">ไม่มีหมวดย่อย</p>
          ) : (
            group.subs.map((s) => {
              const r = maxSub > 0 ? s.amount / maxSub : 0;
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600 w-[150px] shrink-0 truncate">{s.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={"h-full rounded-full " + meta.bar} style={{ width: `${Math.max(4, r * 100)}%` }} />
                  </div>
                  <span className="tnum text-[11px] font-bold text-slate-700 shrink-0 w-[90px] text-right">{baht(s.amount)}</span>
                </div>
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
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [year, setYear] = useState<string | null | undefined>(undefined); // undefined = ยังไม่ตั้ง

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

  // สรุปรวม + รายเดือน
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

  // 3 กลุ่มใหญ่ ตามปีที่เลือก
  useEffect(() => {
    if (!ready || !session || session.isSales) return;
    let cancelled = false;
    setGroupsLoading(true);
    fetchServiceSalesGroups(dealerCode, activeYear)
      .then((g) => { if (!cancelled) setGroups(g); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setGroupsLoading(false); });
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
              {groupsLoading ? "…" : baht(yearTotal)}
            </p>
            <p className="text-[11px] text-red-100/80 mt-1">
              {groupsLoading ? "" : `${yearJobs.toLocaleString("th-TH")} งาน · รวม VAT`}
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {["ROOF SERVICE", "SMART SOLUTION", "Qchang"].map((k) => {
                const g = groups.find((x) => x.group3 === k);
                return (
                  <div key={k} className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-2">
                    <p className="text-[10px] text-red-100/80 truncate">{k === "SMART SOLUTION" ? "SMART" : k === "ROOF SERVICE" ? "ROOF" : "Qchang"}</p>
                    <p className="tnum text-[12.5px] font-bold">{groupsLoading ? "…" : baht(g?.amount ?? 0)}</p>
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

        {/* 3 กลุ่มใหญ่ */}
        <section>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
            <Icon name="category" className="text-lg text-[#d32029]" />
            ยอดขายตามกลุ่มงานบริการ
          </h3>

          {groupsLoading ? (
            <div className="py-8 text-center text-slate-300">
              <Icon name="progress_activity" className="animate-spin text-3xl" />
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
                <Icon name="construction" className="text-2xl" />
              </div>
              <p className="mt-2 text-[13px] text-slate-500">ยังไม่มียอดขายงานบริการสำหรับร้านนี้</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {groups.map((g) => (
                <GroupRow key={g.group3} group={g} grandTotal={yearTotal} />
              ))}
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          ยอดขายงานบริการ (รวม VAT) · แบ่ง 3 กลุ่มใหญ่ · เลือกปีได้
        </p>
      </div>

      <BottomNav active="serviceSales" />
    </>
  );
}
