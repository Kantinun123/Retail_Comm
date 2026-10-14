"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { FilterPanel } from "./filter-panel";
import { AnalysisCharts } from "./analysis-charts";
import { periodShort, selectedPeriods } from "@/lib/commission/logic";
import { useSession } from "@/lib/commission/session";
import type { FilterState } from "@/lib/commission/types";

function analysisCaption(periods: string[]): string {
  const sorted = periods.slice().sort();
  if (sorted.length === 0) return "-";
  if (sorted.length === 1) return periodShort(sorted[0]);
  return `${periodShort(sorted[0])} – ${periodShort(sorted[sorted.length - 1])} (${sorted.length} รอบ)`;
}

export function AnalysisScreen() {
  const { session, ready, setFilter } = useSession();
  const [filter, setLocalFilter] = useState<FilterState | null>(null);

  if (!ready || !session) return null;

  const state = filter ?? session.filter;
  function updateFilter(next: FilterState) {
    setLocalFilter(next);
    setFilter(next);
  }

  const empScope = session.isSales ? session.empId : null;
  const dealerScope = session.isSales
    ? null
    : session.isAdmin
      ? session.storeFilter
      : session.dealer.code;
  const periods = selectedPeriods(state);

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
                : session.isAdmin && !session.storeFilter
                  ? "ภาพรวมทุกร้าน"
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
      <div className="flex items-center space-x-1.5 mt-2 mb-1 px-1">
        <Icon name="filter_alt" className="text-base text-[#d32029]" />
        <span className="text-[12px] text-slate-500 font-medium">
          กำลังวิเคราะห์รอบ:
        </span>
        <span className="text-[12px] font-bold text-slate-800">
          {analysisCaption(periods)}
        </span>
      </div>

      {/* Charts */}
      <AnalysisCharts
        state={state}
        empScope={empScope}
        dealerScope={dealerScope}
      />

      <BottomNav active="analysis" />
    </>
  );
}
