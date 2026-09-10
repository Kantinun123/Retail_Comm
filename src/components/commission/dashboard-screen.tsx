"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { FilterPanel } from "./filter-panel";
import {
  STATUS_META,
  commissionOf,
  employeeById,
  formatBaht,
  formatBahtShort,
  perEmployee,
  perGroup,
  perSolutionByGroup,
  periodShort,
  scopedSales,
  selectedPeriods,
  solutionById,
  totals,
  type SolutionAgg,
} from "@/lib/commission/logic";
import { doLogout, useSession } from "@/lib/commission/session";
import type { FilterState, GroupKey, Sale } from "@/lib/commission/types";
import { cn } from "@/lib/utils";

const MODEL_STYLE: Record<string, { cls: string; icon: string }> = {
  "SCG Home": { cls: "bg-red-50 text-[#a11119] border-red-200", icon: "home" },
  "Housing Expert": {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: "engineering",
  },
  GT: { cls: "bg-sky-50 text-sky-700 border-sky-200", icon: "store" },
};

function periodCaption(periods: string[]): string {
  if (periods.length === 0) return "-";
  if (periods.length === 1) return periodShort(periods[0]);
  const s = periods.slice().sort();
  return `${periodShort(s[0])} – ${periodShort(s[s.length - 1])} (${periods.length} รอบ)`;
}

export function DashboardScreen() {
  const { session, ready, setFilter } = useSession();
  const router = useRouter();
  const [filter, setLocalFilter] = useState<FilterState | null>(null);

  if (!ready || !session) return null;

  const state = filter ?? session.filter;
  function updateFilter(next: FilterState) {
    setLocalFilter(next);
    setFilter(next);
  }

  const empScope = session.isSales ? session.empId : null;
  const t = totals(state, empScope);
  const groups = perGroup(state, empScope);
  const groupTotalComm = groups.reduce((a, g) => a + g.commission, 0);
  const periods = selectedPeriods(state);
  const model = session.dealer.model;
  const modelStyle =
    MODEL_STYLE[model] ?? {
      cls: "bg-slate-100 text-slate-600 border-slate-200",
      icon: "storefront",
    };

  return (
    <>
      {/* Header */}
      <header className="py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md shadow-[#d32029]/20 overflow-hidden shrink-0">
              <Image
                src="/logo.png"
                alt="SCG HOME"
                width={40}
                height={40}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[15px] text-[#231313] leading-tight truncate">
                {session.isSales && session.me ? session.me.name : session.dealer.name}
              </span>
              <span className="text-[11px] font-semibold text-[#b21e1e] flex items-center gap-1">
                {session.isSales && session.me ? (
                  <>
                    <Icon name="badge" style={{ fontSize: 13 }} /> พนักงานขาย ·{" "}
                    {session.me.id}
                    <span className="text-slate-300">|</span>
                    <Icon name="storefront" style={{ fontSize: 13 }} />{" "}
                    {session.dealer.name}
                  </>
                ) : (
                  <>
                    <Icon name="storefront" style={{ fontSize: 13 }} /> ร้านค้าตัวแทน ·{" "}
                    {session.dealer.code}
                  </>
                )}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              doLogout();
              router.replace("/");
            }}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-error active:scale-95 transition shrink-0 ml-2"
          >
            <Icon name="logout" className="text-xl" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 pl-[52px]">
          <span className="text-[11px] text-slate-400">Model ร้านค้า:</span>
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-bold border",
              modelStyle.cls
            )}
          >
            <Icon name={modelStyle.icon} style={{ fontSize: 15 }} className="mr-1" />
            <span>{model}</span>
          </span>
        </div>
      </header>

      {/* Hero Commission Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 mt-3 animate-fade-up">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <span className="text-[13px] font-medium text-red-100/90 flex items-center space-x-1.5">
            <Icon name="payments" className="text-base text-red-300" />
            <span>ค่าคอมมิชชั่นรวม รอบ {periodCaption(periods)}</span>
          </span>
          <span className="text-[11px] bg-red-900/40 text-red-200 px-2.5 py-0.5 rounded-full border border-red-400/20">
            ตัดรอบ 25
          </span>
        </div>
        <div className="mt-2 relative z-10">
          <span className="tnum text-[38px] font-bold leading-none">
            {formatBaht(t.totalCommission)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 relative z-10">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md p-3 border border-white/10">
            <p className="text-[11px] text-red-100/80">จ่ายแล้ว</p>
            <p className="tnum text-[16px] font-bold mt-0.5">
              {formatBaht(t.paidCommission)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-md p-3 border border-white/10">
            <p className="text-[11px] text-red-100/80">รอตัดรอบ</p>
            <p className="tnum text-[16px] font-bold mt-0.5">
              {formatBaht(t.pendingCommission)}
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/15 grid grid-cols-2 gap-3 relative z-10">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Icon name="trending_up" className="text-lg text-red-100" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-red-100/80">ยอดขายรวม</p>
              <p className="tnum text-[16px] font-bold">
                {formatBahtShort(t.totalSales)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Icon name="receipt_long" className="text-lg text-red-100" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-red-100/80">จำนวนงาน</p>
              <p className="tnum text-[16px] font-bold">{t.count} งาน</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-3">
        <FilterPanel state={state} onChange={updateFilter} />
      </div>

      {/* Analysis link */}
      <Link
        href="/app/analysis"
        className="mt-3 w-full py-3 px-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center space-x-2 text-[#d32029] font-bold text-[14px] active:scale-[0.99] hover:border-red-200 transition"
      >
        <Icon name="insights" className="text-xl" />
        <span>ดูการวิเคราะห์ (กราฟ)</span>
        <Icon name="chevron_right" className="text-lg text-slate-300" />
      </Link>

      {/* Group summary */}
      <div className="mt-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-2.5">
          ค่าคอมฯ แยกตามกลุ่ม
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {groups.map((g) => {
            const pct = groupTotalComm > 0 ? (g.commission / groupTotalComm) * 100 : 0;
            return (
              <div
                key={g.key}
                className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                    <Icon name={g.icon} className="text-lg" />
                  </div>
                  <span className="text-[13px] text-slate-700 font-semibold">
                    {g.label}
                  </span>
                </div>
                <p className="tnum text-[18px] font-bold text-[#a11119] mt-2">
                  {formatBaht(g.commission)}
                </p>
                <p className="tnum text-[11px] font-semibold text-[#d32029] mt-0.5">
                  {pct.toFixed(1)}% ของค่าคอมฯรวม
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {g.deals} งาน · ยอดขาย {formatBahtShort(g.sales)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Group breakdown */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[15px] font-bold text-slate-900">
            แยกตามกลุ่มการขาย(โซลูชัน/สินค้า)
          </h3>
        </div>
        <div className="space-y-4">
          {groups.map((g) => (
            <GroupBreakdown
              key={g.key}
              state={state}
              empScope={empScope}
              groupKey={g.key}
              groupLabel={g.label}
              groupIcon={g.icon}
              groupDeals={g.deals}
            />
          ))}
        </div>
      </div>

      {/* Employees (dealer only) */}
      {!session.isSales && <EmployeeBlock state={state} />}

      <BottomNav active="dashboard" />
    </>
  );
}

/* ---------- sub-components ---------- */

function StatusPill({ status }: { status: Sale["status"] }) {
  const st = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5",
        st.text,
        st.bg
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full mr-1", st.dot)} />
      {st.label}
    </span>
  );
}

function GroupBreakdown({
  state,
  empScope,
  groupKey,
  groupLabel,
  groupIcon,
  groupDeals,
}: {
  state: FilterState;
  empScope: string | null;
  groupKey: GroupKey;
  groupLabel: string;
  groupIcon: string;
  groupDeals: number;
}) {
  const items = perSolutionByGroup(state, groupKey, empScope);
  if (items.length === 0) return null;
  const maxComm = Math.max(...items.map((s) => s.commission), 1);
  const groupSum = items.reduce((a, s) => a + s.commission, 0);

  return (
    <div>
      <div className="flex items-center space-x-1.5 mb-1.5 px-0.5">
        <Icon name={groupIcon} className="text-base text-[#d32029]" />
        <span className="text-[13px] font-bold text-slate-700">{groupLabel}</span>
        <span className="text-[11px] text-slate-400">({groupDeals} งาน)</span>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
        {items.map((s) => (
          <SolutionRow
            key={s.id}
            state={state}
            empScope={empScope}
            sol={s}
            groupLabel={groupLabel}
            pctInGroup={groupSum > 0 ? (s.commission / groupSum) * 100 : 0}
            barPct={(s.commission / maxComm) * 100}
          />
        ))}
      </div>
    </div>
  );
}

function SolutionRow({
  state,
  empScope,
  sol,
  groupLabel,
  pctInGroup,
  barPct,
}: {
  state: FilterState;
  empScope: string | null;
  sol: SolutionAgg;
  groupLabel: string;
  pctInGroup: number;
  barPct: number;
}) {
  const [open, setOpen] = useState(false);
  const rows = scopedSales(state, empScope)
    .filter((x) => x.solId === sol.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full p-3.5 text-left hover:bg-red-50/30 transition"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
              <Icon name={sol.icon} className="text-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 truncate">
                {sol.name}
              </p>
              <p className="text-[11px] text-slate-400">
                {sol.deals} งาน · ยอดขาย {formatBahtShort(sol.sales)} · เรท{" "}
                {(sol.rate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="flex items-center shrink-0 ml-2">
            <div className="text-right">
              <p className="tnum text-[14px] font-bold text-[#a11119]">
                {formatBaht(sol.commission)}
              </p>
              <p className="tnum text-[10px] font-semibold text-[#d32029]">
                {pctInGroup.toFixed(1)}% ของ{groupLabel}
              </p>
            </div>
            <Icon
              name="expand_more"
              className={cn(
                "text-slate-300 text-lg ml-0.5 transition",
                open && "rotate-180"
              )}
            />
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#d32029] to-[#f6a5a5] rounded-full"
            style={{ width: `${barPct.toFixed(0)}%` }}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-50 divide-y divide-slate-50">
          {rows.length === 0 ? (
            <p className="text-[11px] text-slate-400 px-3.5 py-2.5">ไม่มีรายการ</p>
          ) : (
            rows.map((x) => {
              const emp = employeeById(x.empId);
              return (
                <div
                  key={x.id}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/40"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-slate-700 truncate">
                      ลูกค้า: {x.customer}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      พนักงานขาย: {emp ? emp.name : ""} · {x.date}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      <Icon
                        name="tag"
                        style={{ fontSize: 12 }}
                        className="align-middle mr-0.5"
                      />
                      {x.projectId} · ยอดขาย {formatBaht(x.amount)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="tnum text-[12px] font-bold text-[#a11119]">
                      {formatBaht(commissionOf(x))}
                    </p>
                    <StatusPill status={x.status} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function EmployeeBlock({ state }: { state: FilterState }) {
  const emps = perEmployee(state);
  const empTotalComm = emps.reduce((a, e) => a + e.commission, 0);
  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[15px] font-bold text-slate-900">แยกตามพนักงาน</h3>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
        {emps.map((e, i) => (
          <EmployeeRow
            key={e.id}
            state={state}
            emp={e}
            medal={medal[i] || ""}
            pct={empTotalComm > 0 ? (e.commission / empTotalComm) * 100 : 0}
          />
        ))}
      </div>
    </div>
  );
}

function EmployeeRow({
  state,
  emp,
  medal,
  pct,
}: {
  state: FilterState;
  emp: ReturnType<typeof perEmployee>[number];
  medal: string;
  pct: number;
}) {
  const [open, setOpen] = useState(false);
  const rows = scopedSales(state, null)
    .filter((x) => x.empId === emp.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-3.5 text-left hover:bg-red-50/30 transition"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center font-bold text-[13px]">
              {emp.avatar}
            </div>
            <span className="absolute -top-1 -right-1 text-[13px]">{medal}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 truncate">
              {emp.name}
            </p>
            <p className="text-[11px] text-slate-400">
              {emp.role} · {emp.deals} งาน
            </p>
          </div>
        </div>
        <div className="flex items-center shrink-0 ml-2">
          <div className="text-right">
            <p className="tnum text-[14px] font-bold text-[#a11119]">
              {formatBaht(emp.commission)}
            </p>
            <p className="tnum text-[10px] font-semibold text-[#d32029]">
              {pct.toFixed(1)}% ของทั้งหมด
            </p>
            <p className="text-[10px] text-slate-400">
              ยอดขาย {formatBahtShort(emp.sales)}
            </p>
          </div>
          <Icon
            name="expand_more"
            className={cn(
              "text-slate-300 text-lg ml-1 transition",
              open && "rotate-180"
            )}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-50 divide-y divide-slate-50">
          {rows.length === 0 ? (
            <p className="text-[11px] text-slate-400 px-3.5 py-2.5">ไม่มีรายการ</p>
          ) : (
            rows.map((x) => {
              const sol = solutionById(x.solId);
              return (
                <div
                  key={x.id}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/40"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-slate-700 truncate">
                      {sol ? sol.name : ""}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      ลูกค้า: {x.customer} · {x.date}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      <Icon
                        name="tag"
                        style={{ fontSize: 12 }}
                        className="align-middle mr-0.5"
                      />
                      {x.projectId} · ยอดขาย {formatBaht(x.amount)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="tnum text-[12px] font-bold text-[#a11119]">
                      {formatBaht(commissionOf(x))}
                    </p>
                    <StatusPill status={x.status} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
