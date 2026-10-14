"use client";

import { useState } from "react";
import { Icon } from "./icon";
import { PeriodFilter } from "./period-filter";
import {
  periodShort,
  selectedGroups,
  selectedJobGroups,
  selectedPeriods,
  selectedStatuses,
  selectedDateField,
  selectedDateMode,
  availableBenefitTypes,
  selectedBenefitTypes,
  getSales,
  getSolutions,
} from "@/lib/commission/logic";
import { getPanelOpen, setPanelOpen } from "@/lib/commission/session";
import type { FilterState } from "@/lib/commission/types";
import { cn } from "@/lib/utils";

interface Props {
  state: FilterState;
  onChange: (next: FilterState) => void;
}

function summaryText(state: FilterState): string {
  const dField = selectedDateField(state) === "close" ? "ปิดขาย" : "โอนจ่าย";
  let p: string;
  if (selectedDateMode(state) === "range") {
    const from = state.dateFrom;
    const to = state.dateTo;
    if (from && to) p = `${from} – ${to}`;
    else if (from) p = `ตั้งแต่ ${from}`;
    else if (to) p = `ถึง ${to}`;
    else p = "ทุกวันที่";
    p = dField + " · " + p;
  } else {
    const periods = selectedPeriods(state);
    if (periods.length === 1) p = periodShort(periods[0]);
    else if (periods.length > 1) {
      const s = periods.slice().sort();
      p = periodShort(s[0]) + " – " + periodShort(s[s.length - 1]);
    } else p = "-";
  }
  const g = selectedGroups(state);
  const gTxt =
    g.length >= 2
      ? "ทุกประเภท"
      : g.length === 1
        ? g[0] === "solution"
          ? "บริการ"
          : "สินค้า"
        : "-";
  const st = selectedStatuses(state);
  const stTxt =
    st.length >= 2
      ? "ทุกสถานะ"
      : st.length === 1
        ? st[0] === "paid"
          ? "จ่ายแล้ว"
          : "รอจ่าย"
        : "-";
  // กลุ่มของงาน: ถ้าเลือกครบ = ไม่แสดง (ไม่รก), ถ้าเลือกบางส่วน = "N กลุ่ม"
  const jg = selectedJobGroups(state);
  const totalInGroup = getSolutions().filter((s) =>
    g.includes(s.group)
  ).length;
  const jgTxt =
    jg.length > 0 && jg.length < totalInGroup ? ` · ${jg.length} กลุ่มงาน` : "";
  // ประเภทผลประโยชน์: แสดงเมื่อเลือกบางส่วน (ไม่ครบ)
  const btAvail = availableBenefitTypes(getSales());
  const btSel = selectedBenefitTypes(state, btAvail);
  const btTxt =
    btAvail.length > 1 && btSel.length > 0 && btSel.length < btAvail.length
      ? " · " + btSel.join("/")
      : "";
  return "· " + gTxt + " · " + stTxt + jgTxt + btTxt + " · " + p;
}

export function FilterPanel({ state, onChange }: Props) {
  const [open, setOpen] = useState(() => getPanelOpen());

  function toggle() {
    const next = !open;
    setOpen(next);
    setPanelOpen(next);
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="w-full py-2.5 px-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.99] hover:border-red-200 transition"
      >
        <span className="flex items-center space-x-2 text-[13px] font-bold text-slate-700">
          <Icon name="tune" className="text-lg text-[#d32029]" />
          <span>ตัวกรองข้อมูล</span>
          <span className="text-[11px] font-medium text-slate-400">
            {summaryText(state)}
          </span>
        </span>
        <Icon
          name={open ? "expand_less" : "expand_more"}
          className={cn("text-slate-400 text-xl transition-transform")}
        />
      </button>
      {open && (
        <div className="mt-2">
          <PeriodFilter state={state} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
