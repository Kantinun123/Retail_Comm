"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { FilterPanel } from "./filter-panel";
import { DonutChart, GroupBar, LineChart } from "./charts";
import {
  availableYears,
  commissionByGroupAll,
  commissionByMonthOfYear,
  commissionLast3Months,
  periodShort,
  selectedPeriods,
  selectedYears,
  type MonthBucket,
} from "@/lib/commission/logic";
import { useSession } from "@/lib/commission/session";
import type { FilterState } from "@/lib/commission/types";

const RED = "#d32029";

function analysisCaption(periods: string[]): string {
  const sorted = periods.slice().sort();
  if (sorted.length === 0) return "-";
  if (sorted.length === 1) return periodShort(sorted[0]);
  return `${periodShort(sorted[0])} – ${periodShort(sorted[sorted.length - 1])} (${sorted.length} รอบ)`;
}

/** map a full MonthBucket list into a single group's bar points */
function groupBarData(buckets: MonthBucket[], key: "solution" | "product") {
  return buckets.map((d) => ({
    label: d.label,
    commission: d[key].commission,
    sales: d[key].sales,
    deals: d[key].deals,
  }));
}

export function AnalysisScreen() {
  const { session, ready, setFilter } = useSession();
  const [filter, setLocalFilter] = useState<FilterState | null>(null);
  const [lineYear, setLineYear] = useState<string | null>(null);

  if (!ready || !session) return null;

  const state = filter ?? session.filter;
  function updateFilter(next: FilterState) {
    setLocalFilter(next);
    setFilter(next);
  }

  const empScope = session.isSales ? session.empId : null;
  const periods = selectedPeriods(state);
  const donut = commissionByGroupAll(state, empScope);
  const last3 = commissionLast3Months(state, empScope);

  const years = availableYears();
  const selYears = selectedYears(state);
  const activeYear =
    lineYear ?? (selYears.find((y) => years.includes(y)) || years[0]);
  const monthData = commissionByMonthOfYear(state, activeYear, empScope);
  const lineSol = monthData.map((d) => ({
    label: d.label,
    commission: d.solution.commission,
    sales: d.solution.sales,
  }));
  const linePrd = monthData.map((d) => ({
    label: d.label,
    commission: d.product.commission,
    sales: d.product.sales,
  }));

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link
            href="/app/dashboard"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <div className="flex flex-col">
            <span className="font-bold text-[15px] text-[#231313] leading-tight">
              การวิเคราะห์
            </span>
            <span className="text-[11px] font-semibold text-[#b21e1e]">
              {session.isSales && session.me
                ? "เฉพาะ " + session.me.name
                : "ภาพรวมทั้งร้าน"}
            </span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#d32029]">
          <Icon name="insights" className="text-xl" />
        </div>
      </header>

      {/* Filter */}
      <div className="mt-1">
        <FilterPanel state={state} onChange={updateFilter} />
      </div>

      {/* Period caption */}
      <div className="flex items-center space-x-1.5 mt-2 px-1">
        <Icon name="filter_alt" className="text-base text-[#d32029]" />
        <span className="text-[12px] text-slate-500 font-medium">
          กำลังวิเคราะห์รอบ:
        </span>
        <span className="text-[12px] font-bold text-slate-800">
          {analysisCaption(periods)}
        </span>
      </div>

      {/* Donut */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mt-1">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
          <Icon name="donut_large" className="text-lg text-[#d32029]" />
          <span>สัดส่วนค่าคอมมิชชั่น (โซลูชัน / สินค้า)</span>
        </h3>
        <DonutChart data={donut} />
      </section>

      {/* Bar — solution */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mt-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5 mb-1">
          <Icon name="bar_chart" className="text-lg text-[#d32029]" />
          <span>เปรียบเทียบค่าคอมฯ 3 เดือนล่าสุด (โซลูชัน)</span>
        </h3>
        <GroupBar
          data={groupBarData(last3, "solution")}
          groupKey="solution"
          barColor={RED}
          lineColor="#8f1114"
        />
      </section>

      {/* Bar — product */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mt-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5 mb-1">
          <Icon name="bar_chart" className="text-lg text-amber-500" />
          <span>เปรียบเทียบค่าคอมฯ 3 เดือนล่าสุด (สินค้า)</span>
        </h3>
        <GroupBar
          data={groupBarData(last3, "product")}
          groupKey="product"
          barColor="#f59e0b"
          lineColor="#b45309"
        />
      </section>

      {/* Line — solution */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
            <Icon name="show_chart" className="text-lg text-[#d32029]" />
            <span>แนวโน้มค่าคอมฯ ทั้งปี (โซลูชัน)</span>
          </h3>
          <div className="relative flex items-center">
            <select
              value={activeYear}
              onChange={(e) => setLineYear(e.target.value)}
              className="appearance-none bg-[#faf8f8] text-slate-900 text-[12px] font-semibold rounded-lg pl-3 pr-8 py-1.5 border border-slate-200/80 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  ปี {y}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="absolute right-2 text-slate-400 text-base pointer-events-none"
            />
          </div>
        </div>
        <LineChart id="sol" data={lineSol} cColor={RED} sColor="#f59e0b" />
      </section>

      {/* Line — product */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mt-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5 mb-2">
          <Icon name="show_chart" className="text-lg text-amber-500" />
          <span>แนวโน้มค่าคอมฯ ทั้งปี (สินค้า)</span>
        </h3>
        <LineChart id="prd" data={linePrd} cColor="#ea580c" sColor="#eab308" />
      </section>

      <BottomNav active="analysis" />
    </>
  );
}
