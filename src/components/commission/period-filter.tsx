"use client";

import { Icon } from "./icon";
import {
  GROUPS,
  TH_MONTHS,
  availableYears,
  latestMonthNumOfYear,
  periodsOfYear,
  selectedGroups,
  selectedMonthsOfYear,
  selectedYears,
} from "@/lib/commission/logic";
import type { FilterState, GroupKey } from "@/lib/commission/types";
import { cn } from "@/lib/utils";

const ALL_GROUPS: GroupKey[] = ["solution", "product"];
const GROUP_LABELS: Record<GroupKey, string> = {
  solution: "โซลูชัน",
  product: "สินค้า",
};

interface Props {
  state: FilterState;
  onChange: (next: FilterState) => void;
}

/** Small square checkbox used across all filter chips */
function Check({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0",
        on ? "bg-[#d32029] border-[#d32029]" : "bg-white border-slate-300"
      )}
    >
      <Icon
        name="check"
        className="text-white"
        style={{ fontSize: 13, lineHeight: 1, opacity: on ? 1 : 0 }}
      />
    </span>
  );
}

export function PeriodFilter({ state, onChange }: Props) {
  const years = availableYears().slice().sort();
  const selYears = selectedYears(state);
  const groups = selectedGroups(state);
  const groupAllOn = groups.length >= ALL_GROUPS.length;

  /* ----- group actions ----- */
  function toggleGroup(key: GroupKey) {
    let cur = groups.slice();
    cur = cur.includes(key) ? cur.filter((g) => g !== key) : [...cur, key];
    onChange({
      ...state,
      groups: cur.length >= ALL_GROUPS.length ? "all" : cur,
    });
  }
  function toggleAllGroups() {
    onChange({ ...state, groups: groupAllOn ? [] : "all" });
  }

  /* ----- year actions ----- */
  function toggleYear(year: string) {
    let ys = selYears.slice();
    const map = { ...state.monthsByYear };
    if (ys.includes(year)) {
      ys = ys.filter((y) => y !== year);
      delete map[year];
    } else {
      ys.push(year);
      map[year] = [];
    }
    if (ys.length === 0) ys = [year];
    ys.sort();
    onChange({ ...state, years: ys, monthsByYear: map });
  }

  /* ----- month actions ----- */
  function toggleMonth(year: string, mm: string) {
    const monthsInYear = periodsOfYear(year).map((p) => p.split("-")[1]);
    const cur = selectedMonthsOfYear(state, year);
    let arr = cur === "all" ? monthsInYear.slice() : cur.slice();
    arr = arr.includes(mm) ? arr.filter((x) => x !== mm) : [...arr, mm];
    const map = { ...state.monthsByYear };
    map[year] = arr.length >= monthsInYear.length ? "all" : arr;
    onChange({ ...state, monthsByYear: map });
  }
  function toggleAllMonths(year: string) {
    const map = { ...state.monthsByYear };
    map[year] = selectedMonthsOfYear(state, year) === "all" ? [] : "all";
    onChange({ ...state, monthsByYear: map });
  }

  function isMonthOn(year: string, mm: string) {
    const cur = selectedMonthsOfYear(state, year);
    return cur === "all" || cur.includes(mm);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
      {/* ประเภทการขาย */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-slate-600 flex items-center space-x-1.5 pl-0.5">
            <Icon name="sell" className="text-lg text-[#d32029]" />
            <span>ประเภทการขาย</span>
          </span>
          <button
            type="button"
            onClick={toggleAllGroups}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition whitespace-nowrap",
              groupAllOn
                ? "bg-[#d32029] text-white border-[#d32029]"
                : "bg-white text-slate-600 border-slate-200 hover:border-red-200"
            )}
          >
            ทั้งหมด
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_GROUPS.map((key) => {
            const on = groups.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleGroup(key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] font-semibold transition",
                  on
                    ? "bg-red-50 border-[#d32029] text-[#a11119]"
                    : "bg-white border-slate-200 text-slate-600 hover:border-red-200"
                )}
              >
                <Check on={on} />
                <span>{GROUP_LABELS[key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ปี */}
      <div className="mt-3 pt-3 border-t border-slate-50">
        <span className="text-[12px] font-semibold text-slate-600 flex items-center space-x-1.5 pl-0.5 mb-2">
          <Icon name="event" className="text-lg text-[#d32029]" />
          <span>รอบชำระเงิน · เลือกปี (เลือกได้หลายปี)</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {years.map((y) => {
            const on = selYears.includes(y);
            return (
              <button
                key={y}
                type="button"
                onClick={() => toggleYear(y)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] font-semibold transition",
                  on
                    ? "bg-red-50 border-[#d32029] text-[#a11119]"
                    : "bg-white border-slate-200 text-slate-600 hover:border-red-200"
                )}
              >
                <Check on={on} />
                <span>ปี {y}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* เดือน แยกตามปี */}
      {selYears
        .slice()
        .sort()
        .map((y, idx) => {
          const allOn = selectedMonthsOfYear(state, y) === "all";
          const monthsInYear = periodsOfYear(y)
            .map((p) => p.split("-")[1])
            .sort();
          const selMonths = allOn
            ? []
            : (selectedMonthsOfYear(state, y) as string[]).slice().sort();
          const summary = allOn
            ? "ทุกเดือน"
            : selMonths.length
              ? selMonths
                  .map((mm) => TH_MONTHS[parseInt(mm, 10) - 1])
                  .join(", ")
              : "ยังไม่เลือกเดือน";
          void latestMonthNumOfYear; // (kept parity w/ reference default logic)
          return (
            <div
              key={y}
              className={cn(
                "mt-3 pt-3 border-t border-slate-50",
                idx === 0 && "first:mt-2 first:pt-0 first:border-t-0"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-bold text-slate-700 pl-0.5">
                  เดือนของปี {y}
                </p>
                <button
                  type="button"
                  onClick={() => toggleAllMonths(y)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition whitespace-nowrap",
                    allOn
                      ? "bg-[#d32029] text-white border-[#d32029]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-red-200"
                  )}
                >
                  {allOn ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {monthsInYear.map((mm) => {
                  const on = isMonthOn(y, mm);
                  return (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => toggleMonth(y, mm)}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[12px] font-semibold transition text-left",
                        on
                          ? "bg-red-50 border-[#d32029] text-[#a11119]"
                          : "bg-white border-slate-200 text-slate-600 hover:border-red-200"
                      )}
                    >
                      <Check on={on} />
                      <span>{TH_MONTHS[parseInt(mm, 10) - 1]}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 pl-0.5">
                แสดง: {summary}
              </p>
            </div>
          );
        })}
    </div>
  );
}
