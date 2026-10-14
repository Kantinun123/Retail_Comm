"use client";

import { useState } from "react";
import { Icon } from "./icon";
import {
  GROUPS,
  TH_MONTHS,
  availableYears,
  getSolutions,
  latestMonthNumOfYear,
  periodsOfYear,
  availableBenefitTypes,
  getSales,
  selectedBenefitTypes,
  selectedDateField,
  selectedDateMode,
  selectedGroups,
  selectedJobGroups,
  selectedMonthsOfYear,
  selectedStatuses,
  selectedYears,
} from "@/lib/commission/logic";
import type {
  FilterState,
  GroupKey,
  PaymentStatus,
} from "@/lib/commission/types";
import { cn } from "@/lib/utils";

const ALL_GROUPS: GroupKey[] = ["solution", "product"];
const GROUP_LABELS: Record<GroupKey, string> = {
  solution: "บริการ",
  product: "สินค้า",
};

const ALL_STATUSES: PaymentStatus[] = ["paid", "pending"];
const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "จ่ายแล้ว",
  pending: "รอจ่าย",
};

/** ป้ายภาษาไทยของประเภทผลประโยชน์ */
const BENEFIT_TYPE_LABELS: Record<string, string> = {
  Commission: "ค่าคอมมิชชัน (Commission)",
  "Back Margin": "แบ็คมาร์จิน (Back Margin)",
  Incentive: "อินเซนทีฟ (Incentive)",
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
  const [jobGroupOpen, setJobGroupOpen] = useState(false);
  const years = availableYears().slice().sort();
  const selYears = selectedYears(state);
  const groups = selectedGroups(state);
  const groupAllOn = groups.length >= ALL_GROUPS.length;
  const statuses = selectedStatuses(state);
  const statusAllOn = statuses.length >= ALL_STATUSES.length;

  // กลุ่มของงาน (solId) ที่เลือกได้ = เฉพาะที่อยู่ในประเภทการขายที่เลือก
  const jobGroupOptions = getSolutions()
    .filter((s) => groups.includes(s.group))
    .sort((a, b) =>
      a.group === b.group
        ? a.name.localeCompare(b.name)
        : a.group.localeCompare(b.group)
    );
  const selJobGroups = selectedJobGroups(state);
  const jobGroupAllOn = selJobGroups.length >= jobGroupOptions.length;

  const dateField = selectedDateField(state);
  const dateMode = selectedDateMode(state);

  // ประเภทผลประโยชน์ที่มีจริงตามมุมมองปัจจุบัน (แสดงตัวกรองเฉพาะเมื่อมี > 1 ประเภท)
  const benefitTypesAvail = availableBenefitTypes(getSales());
  const selBenefitTypes = selectedBenefitTypes(state, benefitTypesAvail);
  const benefitTypeAllOn = selBenefitTypes.length >= benefitTypesAvail.length;
  function toggleBenefitType(t: string) {
    let cur = selBenefitTypes.slice();
    cur = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
    onChange({
      ...state,
      benefitTypes: cur.length >= benefitTypesAvail.length ? "all" : cur,
    });
  }
  function toggleAllBenefitTypes() {
    onChange({ ...state, benefitTypes: benefitTypeAllOn ? [] : "all" });
  }

  /* ----- date-field / date-mode actions ----- */
  function setDateField(field: "pay" | "close") {
    onChange({ ...state, dateField: field });
  }
  function setDateMode(mode: "period" | "range") {
    onChange({ ...state, dateMode: mode });
  }
  function setDateFrom(v: string) {
    onChange({ ...state, dateFrom: v || undefined });
  }
  function setDateTo(v: string) {
    onChange({ ...state, dateTo: v || undefined });
  }

  /* ----- group actions ----- */
  function toggleGroup(key: GroupKey) {
    let cur = groups.slice();
    cur = cur.includes(key) ? cur.filter((g) => g !== key) : [...cur, key];
    onChange({
      ...state,
      groups: cur.length >= ALL_GROUPS.length ? "all" : cur,
      // เปลี่ยนประเภทการขายแล้วรีเซ็ตกลุ่มของงานเป็นทั้งหมด (รายการกลุ่มงานเปลี่ยนตาม)
      jobGroups: "all",
    });
  }
  function toggleAllGroups() {
    // สลับประเภทการขาย: รีเซ็ตกลุ่มของงานเป็น "ทั้งหมด" เพื่อไม่ให้มีค่าค้างข้ามประเภท
    onChange({ ...state, groups: groupAllOn ? [] : "all", jobGroups: "all" });
  }

  /* ----- job group (กลุ่มของงาน) actions ----- */
  function toggleJobGroup(id: string) {
    const allIds = jobGroupOptions.map((s) => s.id);
    let cur = selJobGroups.slice();
    cur = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onChange({
      ...state,
      jobGroups: cur.length >= allIds.length ? "all" : cur,
    });
  }
  function toggleAllJobGroups() {
    onChange({ ...state, jobGroups: jobGroupAllOn ? [] : "all" });
  }

  /* ----- payment status actions ----- */
  function toggleStatus(key: PaymentStatus) {
    let cur = statuses.slice();
    cur = cur.includes(key) ? cur.filter((s) => s !== key) : [...cur, key];
    onChange({
      ...state,
      statuses: cur.length >= ALL_STATUSES.length ? "all" : cur,
    });
  }
  function toggleAllStatuses() {
    onChange({ ...state, statuses: statusAllOn ? [] : "all" });
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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 [&>*]:mt-3 [&>*]:pt-3 [&>*]:border-t [&>*]:border-slate-50 [&>*:first-child]:mt-0 [&>*:first-child]:pt-0 [&>*:first-child]:border-t-0">
      {/* 1) สถานะการจ่าย */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-slate-600 flex items-center space-x-1.5 pl-0.5">
            <Icon name="account_balance_wallet" className="text-lg text-[#d32029]" />
            <span>สถานะการจ่าย</span>
          </span>
          <button
            type="button"
            onClick={toggleAllStatuses}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition whitespace-nowrap",
              statusAllOn
                ? "bg-[#d32029] text-white border-[#d32029]"
                : "bg-white text-slate-600 border-slate-200 hover:border-red-200"
            )}
          >
            ทั้งหมด
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((key) => {
            const on = statuses.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleStatus(key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] font-semibold transition",
                  on
                    ? "bg-red-50 border-[#d32029] text-[#a11119]"
                    : "bg-white border-slate-200 text-slate-600 hover:border-red-200"
                )}
              >
                <Check on={on} />
                <span>{STATUS_LABELS[key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2) ประเภทผลประโยชน์ (แสดงเฉพาะเมื่อมีมากกว่า 1 ประเภท) */}
      {benefitTypesAvail.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-slate-600 flex items-center space-x-1.5 pl-0.5">
              <Icon name="paid" className="text-lg text-[#d32029]" />
              <span>ประเภทผลประโยชน์</span>
            </span>
            <button
              type="button"
              onClick={toggleAllBenefitTypes}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition whitespace-nowrap",
                benefitTypeAllOn
                  ? "bg-[#d32029] text-white border-[#d32029]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-red-200"
              )}
            >
              ทั้งหมด
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {benefitTypesAvail.map((t) => {
              const on = selBenefitTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleBenefitType(t)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-semibold transition",
                    on
                      ? "bg-red-50 border-[#d32029] text-[#a11119]"
                      : "bg-white border-slate-200 text-slate-600 hover:border-red-200"
                  )}
                >
                  <Check on={on} />
                  <span>{BENEFIT_TYPE_LABELS[t] ?? t}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3) ประเภทการขาย */}
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

      {/* กลุ่มของงาน (ถัดจากประเภทการขาย) — ยุบ/ขยายได้ */}
      {jobGroupOptions.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setJobGroupOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 pl-0.5"
            >
              <Icon name="category" className="text-lg text-[#d32029]" />
              <span>กลุ่มของงาน (เลือกได้หลายรายการ)</span>
              <span className="text-[11px] font-medium text-slate-400">
                ·{" "}
                {jobGroupAllOn
                  ? "ทั้งหมด"
                  : selJobGroups.length
                    ? `${selJobGroups.length} กลุ่ม`
                    : "ยังไม่เลือก"}
              </span>
              <Icon
                name={jobGroupOpen ? "expand_less" : "expand_more"}
                className="text-slate-400 text-base"
              />
            </button>
            {jobGroupOpen && (
              <button
                type="button"
                onClick={toggleAllJobGroups}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition whitespace-nowrap",
                  jobGroupAllOn
                    ? "bg-[#d32029] text-white border-[#d32029]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-red-200"
                )}
              >
                {jobGroupAllOn ? "ทั้งหมด" : "เลือกทั้งหมด"}
              </button>
            )}
          </div>
          {jobGroupOpen && (
            <>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {jobGroupOptions.map((s) => {
                  const on = selJobGroups.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleJobGroup(s.id)}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[12px] font-semibold transition",
                        on
                          ? "bg-red-50 border-[#d32029] text-[#a11119]"
                          : "bg-white border-slate-200 text-slate-600 hover:border-red-200"
                      )}
                    >
                      <Check on={on} />
                      <span>{s.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 pl-0.5">
                {jobGroupAllOn
                  ? "แสดงทุกกลุ่มงาน"
                  : selJobGroups.length
                    ? `เลือก ${selJobGroups.length} กลุ่ม`
                    : "ยังไม่เลือกกลุ่มงาน (จะไม่มีข้อมูล)"}
              </p>
            </>
          )}
        </div>
      )}

      {/* 4) กรองตามวันที่ — ประเภทวันที่ + โหมดการเลือก */}
      <div>
        <span className="text-[12px] font-semibold text-slate-600 flex items-center space-x-1.5 pl-0.5 mb-2">
          <Icon name="calendar_month" className="text-lg text-[#d32029]" />
          <span>กรองตามวันที่</span>
        </span>
        {/* ประเภทวันที่: โอนจ่าย / ปิดขาย */}
        <div className="flex gap-1.5 mb-2">
          {([
            { key: "pay" as const, label: "วันที่โอนจ่าย" },
            { key: "close" as const, label: "วันที่ปิดขาย" },
          ]).map((o) => {
            const on = dateField === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setDateField(o.key)}
                className={cn(
                  "flex-1 px-3 py-2 rounded-xl border text-[12px] font-semibold transition",
                  on
                    ? "bg-red-50 border-[#d32029] text-[#a11119]"
                    : "bg-white border-slate-200 text-slate-600 hover:border-red-200"
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {/* โหมด: ปี-เดือน / ช่วงวันที่ */}
        <div className="flex gap-1.5">
          {([
            { key: "period" as const, label: "เลือกปี-เดือน" },
            { key: "range" as const, label: "ช่วงวันที่" },
          ]).map((o) => {
            const on = dateMode === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setDateMode(o.key)}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition",
                  on
                    ? "bg-[#d32029] text-white border-[#d32029]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-red-200"
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* โหมดช่วงวันที่ */}
      {dateMode === "range" && (
        <div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-600 pl-0.5">
                ตั้งแต่วันที่
              </span>
              <input
                type="date"
                value={state.dateFrom ?? ""}
                max={state.dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-[#faf8f8] text-slate-900 text-[13px] rounded-lg px-2.5 py-2 border border-slate-200 focus:border-[#d32029] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-600 pl-0.5">
                ถึงวันที่
              </span>
              <input
                type="date"
                value={state.dateTo ?? ""}
                min={state.dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-[#faf8f8] text-slate-900 text-[13px] rounded-lg px-2.5 py-2 border border-slate-200 focus:border-[#d32029] focus:outline-none"
              />
            </label>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 pl-0.5">
            {!state.dateFrom && !state.dateTo
              ? "ยังไม่ระบุช่วง = แสดงทุกวันที่"
              : `กรองตาม${dateField === "close" ? "วันที่ปิดขาย" : "วันที่โอนจ่าย"}`}
          </p>
        </div>
      )}

      {/* ปี + เดือน (เฉพาะโหมดปี-เดือน) */}
      {dateMode === "period" && (
      <>
      <div>
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
      </>
      )}
    </div>
  );
}
