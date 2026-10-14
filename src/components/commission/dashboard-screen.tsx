"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { FilterPanel } from "./filter-panel";
import { AnalysisCharts } from "./analysis-charts";
import { DataTable, type TableDef } from "./data-table";
import {
  GROUPS,
  STATUS_META,
  commissionOf,
  employeeById,
  formatBaht,
  formatBahtShort,
  perEmployee,
  perGroup,
  periodShort,
  scopedSales,
  searchSales,
  selectedPeriods,
  selectedStatuses,
  setBenefitView,
  solutionById,
  statusSummary,
  totals,
  type SearchResult,
} from "@/lib/commission/logic";
import { getDataset } from "@/lib/commission/dataset";
import { storeTable, empTable } from "@/lib/commission/sales-table";
import { doLogout, setStoreFilter, useSession } from "@/lib/commission/session";
import { getProfileOverride } from "@/lib/commission/profile";
import { downloadSales } from "@/lib/commission/excel";
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

export function DashboardScreen({
  variant = "store",
}: {
  /** "store" = ผลประโยชน์ร้านค้า (ตาม role), "staffIncentive" = ผลประโยชน์พนักงานในร้าน (บังคับมุมมอง incentive) */
  variant?: "store" | "staffIncentive";
}) {
  const { session, ready, setFilter } = useSession();
  const router = useRouter();
  const [filter, setLocalFilter] = useState<FilterState | null>(null);
  const [showData, setShowData] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const isStaffIncentive = variant === "staffIncentive";
  // บังคับมุมมองค่าคอมฯ: หน้าพนักงานในร้าน = incentive เสมอ, หน้าปกติ = ตาม role
  // ตั้งก่อน render (synchronous) เพื่อให้การคำนวณในรอบนี้ใช้มุมมองที่ถูกต้อง
  setBenefitView(isStaffIncentive ? "emp" : null);
  useEffect(() => {
    setBenefitView(isStaffIncentive ? "emp" : null);
    return () => setBenefitView(null);
  }, [isStaffIncentive]);

  if (!ready || !session) return null;

  const state = filter ?? session.filter;
  function updateFilter(next: FilterState) {
    setLocalFilter(next);
    setFilter(next);
  }

  // ขอบเขตข้อมูล:
  //  - พนักงานขาย = เฉพาะงานของตน
  //  - ร้านค้าตัวแทน = เฉพาะร้านของตน
  //  - ผู้ดูแลระบบ = ทุกร้าน (null) หรือร้านที่เจาะดู (storeFilter)
  const isAdminView = session.isAdmin;
  const empScope = session.isSales ? session.empId : null;
  const dealerScope = session.isSales
    ? null
    : isAdminView
      ? session.storeFilter // null = ทุกร้าน, หรือรหัสร้านที่เจาะ
      : session.dealer.code;
  const benefitView: "store" | "emp" =
    isStaffIncentive || session.isSales ? "emp" : "store";

  // รูปโปรไฟล์ของผู้ล็อกอิน (ถ้าตั้งไว้ในหน้าสมาชิก) สำหรับแสดงใน header
  const myProfileKey = session.isSales
    ? session.empId
      ? `emp:${session.empId}`
      : null
    : session.isAdmin
      ? null
      : `dealer:${session.dealer.code}`;
  const myPhoto = myProfileKey
    ? getProfileOverride(myProfileKey).photoUrl ?? ""
    : "";
  const t = totals(state, empScope, dealerScope);
  const groups = perGroup(state, empScope, dealerScope);
  const groupTotalComm = groups.reduce((a, g) => a + g.commission, 0);
  const periods = selectedPeriods(state);

  // สรุปสถานะการจ่าย (ไม่สนตัวกรองสถานะ) สำหรับการ์ด "จ่ายแล้ว/รอจ่าย" ให้กดเป็นตัวกรองได้
  const ss = statusSummary(state, empScope, dealerScope);
  const curStatuses = selectedStatuses(state); // ["paid","pending"] = ทั้งหมด
  const activeStatus: "paid" | "pending" | null =
    curStatuses.length === 1 ? curStatuses[0] : null;
  // กดการ์ด -> toggle: กดสถานะเดิมซ้ำ = ล้างกลับเป็นทั้งหมด
  function toggleStatus(s: "paid" | "pending") {
    updateFilter({
      ...state,
      statuses: activeStatus === s ? "all" : [s],
    });
  }
  function clearStatus() {
    updateFilter({ ...state, statuses: "all" });
  }
  // เปิดตารางข้อมูลแล้วเลื่อนหน้าจอไปที่ตาราง (ใช้จากปุ่มในแถบสรุป)
  function openTable() {
    setShowData(true);
    // รอให้ตาราง render ก่อนค่อยเลื่อน
    requestAnimationFrame(() =>
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  // ตาราง "ดูข้อมูล" ใช้รูปแบบเดียวกับหน้าฐานข้อมูล (คอลัมน์ครบตามไฟล์ดิบ)
  // แยกตาม role: ร้านค้าตัวแทน -> มุมมองร้านค้า (Commission), พนักงานขาย -> มุมมองพนักงาน (Incentive)
  const salesRows = scopedSales(state, empScope, dealerScope);
  const dataset = getDataset();
  const commissionTable: TableDef = (benefitView === "emp"
    ? empTable(
        salesRows,
        dataset,
        "รายการค่าคอมมิชชัน — พนักงาน (Incentive)"
      )
    : storeTable(
        salesRows,
        dataset,
        "รายการค่าคอมมิชชัน — ร้านค้า (Commission)"
      )) as TableDef;

  // ผลประโยชน์แยกตาม "ประเภทผลประโยชน์" จริงจากข้อมูลดิบ
  //  - พนักงานขาย: ทุกแถว = Incentive (ใช้ยอด inc)
  //  - ร้านค้า:    DI = Back Margin, อื่นๆ (BA/Netsuite) = Commission (ใช้ยอด comm)
  type BenefitAgg = {
    amount: number;
    deals: number;
    sales: number;
    paidAmount: number;
    paidDeals: number;
    pendingAmount: number;
    pendingDeals: number;
  };
  const benefitByType = (() => {
    const acc: Record<string, BenefitAgg> = {};
    const add = (type: string, value: number, sale: Sale) => {
      const a =
        acc[type] ??
        {
          amount: 0,
          deals: 0,
          sales: 0,
          paidAmount: 0,
          paidDeals: 0,
          pendingAmount: 0,
          pendingDeals: 0,
        };
      a.amount += value || 0;
      a.deals += 1;
      a.sales += sale.amount || 0;
      if (sale.status === "paid") {
        a.paidAmount += value || 0;
        a.paidDeals += 1;
      } else {
        a.pendingAmount += value || 0;
        a.pendingDeals += 1;
      }
      acc[type] = a;
    };
    salesRows.forEach((s) => {
      if (benefitView === "emp") {
        add("Incentive", s.inc ?? 0, s);
      } else {
        const type =
          (s.src ?? "").trim().toUpperCase() === "DI"
            ? "Back Margin"
            : "Commission";
        add(type, s.comm ?? 0, s);
      }
    });
    return acc;
  })();
  const benefitTypeList = Object.keys(benefitByType).sort();
  const benefitTotal = benefitTypeList.reduce(
    (a, k) => a + benefitByType[k].amount,
    0
  );
  const BENEFIT_TYPE_META: Record<string, { label: string; icon: string }> = {
    Commission: { label: "ค่าคอมมิชชัน (Commission)", icon: "payments" },
    "Back Margin": { label: "แบ็คมาร์จิน (Back Margin)", icon: "savings" },
    Incentive: { label: "อินเซนทีฟ (Incentive)", icon: "redeem" },
  };

  const model = session.dealer.model;
  const modelStyle =
    MODEL_STYLE[model] ?? {
      cls: "bg-slate-100 text-slate-600 border-slate-200",
      icon: "storefront",
    };
  // จำนวนร้านทั้งหมด (ใช้แสดงใน header ของผู้ดูแลระบบ)
  const dealerCount = dataset.dealers.length;
  // ตัวเลือกร้านสำหรับผู้ดูแลระบบ (ทุกร้าน + รายร้าน)
  const adminStoreOptions = isAdminView
    ? [
        { value: "", label: "ทุกร้าน (รวมทั้งระบบ)" },
        ...dataset.dealers.map((d) => ({
          value: d.code,
          label: d.name + " · " + d.code,
        })),
      ]
    : [];

  return (
    <>
      {/* Header */}
      <header className="py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center justify-between">
          <Link
            href="/app/member"
            className="flex items-center space-x-2.5 min-w-0 rounded-xl -m-1 p-1 hover:bg-black/[0.03] active:scale-[0.99] transition"
            aria-label="หน้าสมาชิก"
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md shadow-[#d32029]/20 overflow-hidden shrink-0">
              {myPhoto ? (
                <Image
                  src={myPhoto}
                  alt="โปรไฟล์"
                  width={40}
                  height={40}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src="/logo.png"
                  alt="SCG HOME"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[15px] text-[#231313] leading-tight truncate">
                {session.isSales && session.me
                  ? session.me.name
                  : session.isAdmin
                    ? "ผู้ดูแลระบบ"
                    : session.dealer.name}
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
                ) : session.isAdmin ? (
                  <>
                    <Icon name="admin_panel_settings" style={{ fontSize: 13 }} />{" "}
                    Admin ·{" "}
                    {session.storeFilter
                      ? session.dealer.name
                      : "ทุกร้าน (" + dealerCount + " ร้าน)"}
                  </>
                ) : (
                  <>
                    <Icon name="storefront" style={{ fontSize: 13 }} /> ร้านค้าตัวแทน ·{" "}
                    {session.dealer.code}
                  </>
                )}
              </span>
            </div>
          </Link>
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
        {/* ผู้ดูแลระบบ: เลือกเจาะดูรายร้าน / ร้านอื่น (dealer/sales แสดง model badge ตามเดิม) */}
        {isAdminView ? (
          <div className="mt-2 flex items-center gap-2 pl-[52px]">
            <Icon name="filter_alt" style={{ fontSize: 15 }} className="text-[#d32029]" />
            <span className="text-[11px] text-slate-400 shrink-0">ขอบเขตร้าน:</span>
            <div className="relative flex items-center min-w-0 flex-1 max-w-[260px]">
              <select
                value={session.storeFilter ?? ""}
                onChange={(e) => setStoreFilter(e.target.value || null)}
                className="w-full appearance-none bg-[#faf8f8] text-slate-900 text-[12px] font-semibold rounded-lg pl-3 pr-8 py-1.5 border border-slate-200/80 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all truncate"
              >
                {adminStoreOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="absolute right-2 text-slate-400 text-base pointer-events-none"
              />
            </div>
          </div>
        ) : (
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
        )}
      </header>

      {/* Hero Commission Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 mt-3 animate-fade-up">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <span className="text-[13px] font-medium text-red-100/90 flex items-center space-x-1.5">
            <Icon name="payments" className="text-base text-red-300" />
            <span>
              {isStaffIncentive
                ? "ผลประโยชน์ของพนักงานในร้าน"
                : session.isSales
                  ? "ผลประโยชน์พนักงาน"
                  : isAdminView
                    ? session.storeFilter
                      ? "ผลประโยชน์ร้านค้า"
                      : "ผลประโยชน์รวมทุกร้าน"
                    : "ผลประโยชน์ร้านค้า"}{" "}
              รอบ {periodCaption(periods)}
            </span>
          </span>
          <button
            type="button"
            onClick={() =>
              downloadSales(
                salesRows,
                benefitView,
                dataset,
                benefitView === "emp"
                  ? "ผลประโยชน์พนักงาน.xlsx"
                  : "ค่าคอมมิชชั่นร้านค้า.xlsx"
              )
            }
            className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-full border border-white/25 active:scale-95 transition"
          >
            <Icon name="download" style={{ fontSize: 14 }} />
            ดาวน์โหลดข้อมูล
          </button>
        </div>
        <div className="mt-2 relative z-10">
          <span className="tnum text-[38px] font-bold leading-none">
            {formatBaht(t.totalCommission)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 relative z-10">
          <button
            type="button"
            onClick={() => toggleStatus("paid")}
            aria-pressed={activeStatus === "paid"}
            className={cn(
              "text-left rounded-2xl backdrop-blur-md p-3 border transition active:scale-[0.98] hover:bg-white/20",
              activeStatus === "paid"
                ? "bg-white/25 border-white/70 ring-2 ring-white/60"
                : "bg-white/10 border-white/10"
            )}
          >
            <p className="text-[11px] text-red-100/80 flex items-center justify-between">
              <span>จ่ายแล้ว</span>
              {activeStatus === "paid" && (
                <Icon name="check_circle" style={{ fontSize: 14 }} className="text-white" />
              )}
            </p>
            <p className="tnum text-[16px] font-bold mt-0.5">
              {formatBaht(ss.paidCommission)}
            </p>
            <p className="text-[10px] text-red-100/70 mt-0.5">{ss.paidDeals} งาน</p>
          </button>
          <button
            type="button"
            onClick={() => toggleStatus("pending")}
            aria-pressed={activeStatus === "pending"}
            className={cn(
              "text-left rounded-2xl backdrop-blur-md p-3 border transition active:scale-[0.98] hover:bg-white/20",
              activeStatus === "pending"
                ? "bg-white/25 border-white/70 ring-2 ring-white/60"
                : "bg-white/10 border-white/10"
            )}
          >
            <p className="text-[11px] text-red-100/80 flex items-center justify-between">
              <span>รอจ่าย</span>
              {activeStatus === "pending" && (
                <Icon name="check_circle" style={{ fontSize: 14 }} className="text-white" />
              )}
            </p>
            <p className="tnum text-[16px] font-bold mt-0.5">
              {formatBaht(ss.pendingCommission)}
            </p>
            <p className="text-[10px] text-red-100/70 mt-0.5">{ss.pendingDeals} งาน</p>
          </button>
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

      {/* แถบสรุปเมื่อกรองสถานะจากการ์ด จ่ายแล้ว/รอจ่าย */}
      {activeStatus && (
        <div className="mt-3 rounded-2xl bg-white border border-slate-100 shadow-sm px-3.5 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-start space-x-2">
            <span
              className={cn(
                "mt-1 w-2 h-2 rounded-full shrink-0",
                activeStatus === "paid" ? "bg-[#d32029]" : "bg-amber-500"
              )}
            />
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-slate-700">
                กำลังแสดงเฉพาะ{" "}
                <span className={activeStatus === "paid" ? "text-[#a11119]" : "text-amber-600"}>
                  {activeStatus === "paid" ? "จ่ายแล้ว" : "รอจ่าย"}
                </span>
              </p>
              <p className="tnum text-[11px] text-slate-500 mt-0.5">
                {(activeStatus === "paid" ? ss.paidDeals : ss.pendingDeals)} งาน ·{" "}
                {formatBaht(
                  activeStatus === "paid" ? ss.paidCommission : ss.pendingCommission
                )}{" "}
                ·{" "}
                {ss.totalCommission > 0
                  ? (
                      ((activeStatus === "paid"
                        ? ss.paidCommission
                        : ss.pendingCommission) /
                        ss.totalCommission) *
                      100
                    ).toFixed(1)
                  : "0.0"}
                % ของค่าคอมฯ ทั้งหมด
              </p>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={openTable}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#d32029] hover:bg-[#b91c21] px-2.5 py-1.5 rounded-full transition active:scale-95"
            >
              <Icon name="table_chart" style={{ fontSize: 14 }} />
              ดูตาราง
            </button>
            <button
              type="button"
              onClick={clearStatus}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#a11119] bg-slate-50 hover:bg-red-50 px-2.5 py-1.5 rounded-full border border-slate-200 transition active:scale-95"
            >
              <Icon name="close" style={{ fontSize: 14 }} />
              ล้างตัวกรอง
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mt-3">
        <FilterPanel state={state} onChange={updateFilter} />
      </div>

      {/* ค้นหา — ชื่อร้าน/พนักงาน/ลูกค้า/เลขที่งาน (เคารพ scope ตาม role, ไม่ผูกตัวกรองวันที่) */}
      <div className="mt-3">
        <SearchBox empScope={empScope} dealerScope={dealerScope} />
      </div>

      {/* View data (table) — ชุดเดียวกับปุ่มดาวน์โหลดของกล่องค่าคอมมิชชั่นรวม */}
      <div className="mt-3 scroll-mt-4" ref={tableRef}>
        <button
          type="button"
          onClick={() => setShowData((s) => !s)}
          className="w-full py-2.5 px-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.99] hover:border-red-200 transition"
        >
          <span className="flex items-center space-x-2 text-[13px] font-bold text-slate-700">
            <Icon
              name={showData ? "visibility_off" : "table_chart"}
              className="text-lg text-[#d32029]"
            />
            <span>{showData ? "ซ่อนข้อมูล" : "ดูข้อมูล (ตาราง)"}</span>
            <span className="text-[11px] font-medium text-slate-400">
              · {salesRows.length} รายการ
            </span>
          </span>
          <Icon
            name="expand_more"
            className={cn(
              "text-slate-400 text-xl transition",
              showData && "rotate-180"
            )}
          />
        </button>
        {showData && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mt-2">
            <DataTable table={commissionTable} />
          </div>
        )}
      </div>

      {/* Analysis (เปิด/ซ่อนกราฟในหน้าเดียวกัน) */}
      <button
        type="button"
        onClick={() => setShowAnalysis((s) => !s)}
        className="mt-3 w-full py-3 px-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center space-x-2 text-[#d32029] font-bold text-[14px] active:scale-[0.99] hover:border-red-200 transition"
      >
        <Icon name="insights" className="text-xl" />
        <span>{showAnalysis ? "ซ่อนการวิเคราะห์ (กราฟ)" : "ดูการวิเคราะห์ (กราฟ)"}</span>
        <Icon
          name="expand_more"
          className={cn(
            "text-lg text-slate-300 transition",
            showAnalysis && "rotate-180"
          )}
        />
      </button>
      {showAnalysis && (
        <div className="mt-3">
          <AnalysisCharts
            state={state}
            empScope={empScope}
            dealerScope={dealerScope}
          />
        </div>
      )}

      {/* ส่วนสรุป 3 บล็อก — ซ่อนในหน้า "ผลประโยชน์พนักงานในร้าน" (ให้เห็นเฉพาะแยกตามพนักงาน) */}
      {!isStaffIncentive && (
      <>
      {/* ผลประโยชน์แยกตามประเภทการจ่าย (อ้างอิงคอลัมน์ "ประเภทผลประโยชน์" ของข้อมูลดิบ) */}
      <div className="mt-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-2.5">
          ผลประโยชน์แยกตามประเภทการจ่าย
        </h3>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
          {benefitTypeList.length === 0 ? (
            <p className="text-[12px] text-slate-400 px-3.5 py-4 text-center">
              ไม่มีข้อมูลในรอบที่เลือก
            </p>
          ) : (
            benefitTypeList.map((type) => {
              const info = benefitByType[type];
              const meta = BENEFIT_TYPE_META[type] ?? {
                label: type,
                icon: "sell",
              };
              const pct =
                benefitTotal > 0 ? (info.amount / benefitTotal) * 100 : 0;
              // งานของประเภทนี้ (จำแนกด้วย logic เดียวกับ benefitByType)
              const typeRows = salesRows.filter(
                (s) => benefitTypeKey(s, benefitView) === type
              );
              return (
                <BenefitTypeRow
                  key={type}
                  label={meta.label}
                  icon={meta.icon}
                  amount={info.amount}
                  sales={info.sales}
                  deals={info.deals}
                  pct={pct}
                  paidDeals={info.paidDeals}
                  paidAmount={info.paidAmount}
                  pendingDeals={info.pendingDeals}
                  pendingAmount={info.pendingAmount}
                  rows={typeRows}
                />
              );
            })
          )}
          {benefitTypeList.length > 1 && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#faf3f3]">
              <span className="text-[12px] font-bold text-slate-700">
                รวมทั้งหมด
              </span>
              <span className="tnum text-[14px] font-bold text-[#a11119]">
                {formatBaht(benefitTotal)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ผลประโยชน์แยกตามกลุ่ม (สินค้า/บริการ) — รายการแถว กดกางดูรายละเอียดได้ */}
      <div className="mt-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-2.5">
          ผลประโยชน์แยกตามกลุ่ม (สินค้า/บริการ)
        </h3>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
          {groups.filter((g) => g.deals > 0).length === 0 ? (
            <p className="text-[12px] text-slate-400 px-3.5 py-4 text-center">
              ไม่มีข้อมูลในรอบที่เลือก
            </p>
          ) : (
            groups
              .filter((g) => g.deals > 0)
              .map((g) => {
                const groupRows = salesRows.filter((s) => {
                  const sol = solutionById(s.solId);
                  return sol ? sol.group === g.key : false;
                });
                return (
                  <GroupBenefitRow
                    key={g.key}
                    groupKey={g.key}
                    label={g.label}
                    icon={g.icon}
                    rows={groupRows}
                    benefitTotal={groupTotalComm}
                  />
                );
              })
          )}
        </div>
      </div>
      </>
      )}

      {/* Employees (ไม่แสดงเมื่อ login เป็นพนักงานขาย) */}
      {!session.isSales && (
        <EmployeeBlock
          state={state}
          dealerScope={dealerScope}
          title={
            isStaffIncentive
              ? "ผลประโยชน์พนักงานในร้าน : แยกตามพนักงานขาย"
              : "ผลประโยชน์ร้านค้า : แยกตามพนักงานขาย"
          }
        />
      )}

      <BottomNav active={isStaffIncentive ? "staffIncentive" : "dashboard"} />
    </>
  );
}

/* ---------- sub-components ---------- */

/** สถานะย่อย (ตรงกับไฟล์ดิบ) ของสถานะ "รอจ่าย" เพื่อให้รู้ว่าเป็นรอจ่ายแบบไหน */
const STATUS_SUBLABEL: Partial<Record<Sale["status"], string>> = {
  pending: "มีกำหนดชำระแล้ว",
  processing: "รอสรุป",
};

function StatusPill({ status }: { status: Sale["status"] }) {
  const st = STATUS_META[status];
  const sub = STATUS_SUBLABEL[status];
  return (
    <span className="inline-flex flex-col items-end mt-0.5">
      <span
        className={cn(
          "inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
          st.text,
          st.bg
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full mr-1", st.dot)} />
        {st.label}
      </span>
      {sub && (
        <span className="text-[8px] text-slate-400 mt-0.5 leading-tight">
          {sub}
        </span>
      )}
    </span>
  );
}

/** Rate (อัตราผลประโยชน์) เฉลี่ยถ่วงน้ำหนัก = ค่าคอมฯรวม ÷ ยอดขายรวม -> "X.XX%" */
function rateText(commission: number, sales: number): string {
  if (!sales) return "-";
  return ((commission / sales) * 100).toFixed(2) + "%";
}

/** จำแนกประเภทผลประโยชน์ของงานหนึ่งแถว ให้ตรงกับ benefitByType */
function benefitTypeKey(s: Sale, view: "store" | "emp"): string {
  if (view === "emp") return "Incentive";
  return (s.src ?? "").trim().toUpperCase() === "DI"
    ? "Back Margin"
    : "Commission";
}

/** แถวประเภทผลประโยชน์ — กดเปิด/ซ่อนเพื่อดู 3 ชั้น (สถานะ -> กลุ่ม -> งาน) */
function BenefitTypeRow({
  label,
  icon,
  amount,
  sales,
  deals,
  pct,
  paidDeals,
  paidAmount,
  pendingDeals,
  pendingAmount,
  rows,
}: {
  label: string;
  icon: string;
  amount: number;
  sales: number;
  deals: number;
  pct: number;
  paidDeals: number;
  paidAmount: number;
  pendingDeals: number;
  pendingAmount: number;
  rows: Sale[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3.5 py-3 text-left hover:bg-red-50/30 transition"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
              <Icon name={icon} className="text-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 truncate">
                {label}
              </p>
              <p className="text-[11px] text-slate-400">
                {deals} รายการ · ยอดขาย {formatBahtShort(sales)}
              </p>
            </div>
          </div>
          <div className="flex items-center shrink-0 ml-2">
            <div className="text-right">
              <p className="tnum text-[14px] font-bold text-[#a11119]">
                {formatBaht(amount)}
              </p>
              <p className="tnum text-[11px] font-semibold text-[#d32029]">
                {pct.toFixed(1)}% ของผลประโยชน์รวม
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
        </div>

        {/* แถบกราฟแนวนอน ยาวตาม % ของผลประโยชน์รวม */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#d32029] to-[#f6a5a5] rounded-full"
            style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
          />
        </div>

        {/* รายละเอียดสถานะการจ่าย: จำนวนงาน + ยอดจ่าย (ยอดผลประโยชน์) */}
        <div className="mt-2 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-[10px]">
          <span className="flex items-center text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d32029] mr-1.5" />
            จ่ายแล้ว: {paidDeals} งาน ·{" "}
            <span className="tnum font-semibold text-slate-700 ml-0.5">
              {formatBaht(paidAmount)}
            </span>
          </span>
          <span className="flex items-center text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            รอจ่าย: {pendingDeals} งาน ·{" "}
            <span className="tnum font-semibold text-slate-700 ml-0.5">
              {formatBaht(pendingAmount)}
            </span>
          </span>
        </div>
      </button>

      {/* เปิดดู 3 ชั้น: สถานะ -> กลุ่มการขาย -> รายการงาน (ใช้ตัวเดียวกับแยกตามพนักงาน) */}
      {open && (
        <div className="border-t border-slate-50">
          <EmployeeBreakdown rows={rows} />
        </div>
      )}
    </div>
  );
}

/** แปลงวันที่โอนจ่ายดิบ DD-MM-YY (ปี 2 หลักท้าย ค.ศ.) -> YYYY-MM-DD; ไม่มีข้อมูล = null */
function payDateDisplay(x: Sale): string | null {
  const raw = x.payDateRaw;
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (!m) return null;
  const yyyy = 2000 + parseInt(m[3], 10);
  return `${yyyy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** แถวรายการงานหนึ่งรายการ (ใช้ซ้ำในมุมมองแยกกลุ่มของพนักงาน) */
function SaleLine({ x }: { x: Sale }) {
  const sol = solutionById(x.solId);
  const comm = commissionOf(x);
  const payDate = payDateDisplay(x);
  // ชื่อพนักงานขาย: ใช้ชื่อที่ลงทะเบียนในระบบก่อน, ไม่มีค่อย fallback เป็นชื่อผู้ขายในไฟล์
  const sellerName = employeeById(x.empId)?.name ?? x.seller ?? "";
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/40">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-slate-700 truncate">
          {sol ? sol.name : ""}
        </p>
        {sellerName && (
          <p className="text-[10px] text-slate-500 truncate">
            <Icon
              name="person"
              style={{ fontSize: 12 }}
              className="align-middle mr-0.5 text-slate-400"
            />
            พนักงานขาย: {sellerName}
          </p>
        )}
        <p className="text-[10px] text-slate-400 truncate">
          ลูกค้า: {x.customer}
        </p>
        <p className="text-[10px] text-slate-400 truncate">
          วันที่ปิดขาย: {x.date} · วันที่โอนจ่าย: {payDate ?? "N/A"}
        </p>
        <p className="text-[10px] text-slate-400 truncate mt-0.5">
          <Icon
            name="tag"
            style={{ fontSize: 12 }}
            className="align-middle mr-0.5"
          />
          {x.projectId} · ยอดขาย {formatBaht(x.amount)} · Rate{" "}
          {rateText(comm, x.amount)}
        </p>
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className="tnum text-[12px] font-bold text-[#a11119]">
          {formatBaht(comm)}
        </p>
        <StatusPill status={x.status} />
      </div>
    </div>
  );
}

/** แถวสรุปของร้าน/พนักงานในผลค้นหา */
function SearchHitRow({
  rank,
  label,
  sub,
  deals,
  commission,
}: {
  rank: number;
  label: string;
  sub: string;
  deals: number;
  commission: number;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <div className="min-w-0 flex items-center space-x-2">
        <span className="shrink-0 w-5 h-5 rounded-full bg-red-50 text-[#a11119] text-[10px] font-bold flex items-center justify-center">
          {rank}
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-slate-700 truncate">
            {label}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            {sub} · {deals} งาน
          </p>
        </div>
      </div>
      <p className="tnum text-[12px] font-bold text-[#a11119] shrink-0 ml-2">
        {formatBaht(commission)}
      </p>
    </div>
  );
}

/** กล่องค้นหา (ยุบได้) — ชื่อร้าน/พนักงาน/ลูกค้า/เลขที่งาน */
function SearchBox({
  empScope,
  dealerScope,
}: {
  empScope: string | null;
  dealerScope: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim();
  const result: SearchResult | null = q
    ? searchSales(q, empScope, dealerScope)
    : null;

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full py-2.5 px-3.5 flex items-center justify-between active:scale-[0.99] hover:border-red-200 transition"
      >
        <span className="flex items-center space-x-2 text-[13px] font-bold text-slate-700">
          <Icon name="search" style={{ fontSize: 18 }} className="text-[#a11119]" />
          <span>ค้นหางาน / เช็คสถานะ</span>
        </span>
        <Icon
          name={open ? "expand_less" : "expand_more"}
          style={{ fontSize: 20 }}
          className="text-slate-400"
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 p-3.5 space-y-3">
          <div className="relative">
            <Icon
              name="search"
              style={{ fontSize: 18 }}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="พิมพ์ชื่อร้าน / พนักงาน / ลูกค้า / เลขที่งาน"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-red-300 focus:bg-white transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <Icon name="close" style={{ fontSize: 18 }} />
              </button>
            )}
          </div>

          {!q && (
            <p className="text-[11px] text-slate-400 text-center py-2">
              ค้นได้ทุกรอบบิลในขอบเขตของคุณ (ไม่ผูกกับตัวกรองวันที่)
            </p>
          )}

          {result && result.totalDeals === 0 && (
            <p className="text-[12px] text-slate-500 text-center py-3">
              ไม่พบรายการที่ตรงกับ “{q}”
            </p>
          )}

          {result && result.totalDeals > 0 && (
            <>
              {/* สรุปรวม */}
              <div className="flex items-center justify-between rounded-xl bg-red-50/60 px-3.5 py-2">
                <span className="text-[11px] font-medium text-slate-500">
                  พบ {result.totalDeals} งาน · {result.dealers.length} ร้าน ·{" "}
                  {result.employees.length} พนักงาน
                </span>
                <span className="tnum text-[13px] font-bold text-[#a11119]">
                  {formatBaht(result.totalCommission)}
                </span>
              </div>

              {/* สรุปแยกตามร้าน (ซ่อนเมื่อถูกจำกัดเป็นร้านเดียว) */}
              {result.dealers.length > 1 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1 px-1">
                    สรุปตามร้านค้า
                  </p>
                  <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                    {result.dealers.map((d, i) => (
                      <SearchHitRow
                        key={d.code}
                        rank={i + 1}
                        label={d.name || d.code}
                        sub={d.code}
                        deals={d.deals}
                        commission={d.commission}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* สรุปแยกตามพนักงาน (ซ่อนเมื่อ scope เป็นพนักงานคนเดียว) */}
              {!empScope && result.employees.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1 px-1">
                    สรุปตามพนักงานขาย
                  </p>
                  <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                    {result.employees.map((e, i) => (
                      <SearchHitRow
                        key={e.code}
                        rank={i + 1}
                        label={e.name || e.code}
                        sub={e.code}
                        deals={e.deals}
                        commission={e.commission}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* รายการงานที่ตรงกับคำค้น */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 mb-1 px-1">
                  รายการงาน ({result.rows.length})
                </p>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                  {result.rows.slice(0, 50).map((x) => (
                    <SaleLine key={x.id} x={x} />
                  ))}
                </div>
                {result.rows.length > 50 && (
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    แสดง 50 รายการแรกจากทั้งหมด {result.rows.length} รายการ
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EmployeeBlock({
  state,
  dealerScope,
  title = "แยกตามพนักงาน",
}: {
  state: FilterState;
  dealerScope: string | null;
  title?: string;
}) {
  const emps = perEmployee(state, dealerScope);
  const empTotalComm = emps.reduce((a, e) => a + e.commission, 0);
  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
      </div>
      {emps.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center text-[12px] text-slate-400">
          ไม่มีข้อมูลพนักงานของร้านนี้
        </div>
      ) : (
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
      )}
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
  // รูปโปรไฟล์ที่พนักงานตั้งไว้ (ถ้ามี) ไม่งั้นใช้ตัวย่อ
  const empPhoto = getProfileOverride(`emp:${emp.id}`).photoUrl ?? "";
  // สโคปตามพนักงานคนนี้โดยตรง (empId) จึงไม่ต้องส่ง dealerScope ซ้ำ
  const rows = scopedSales(state, emp.id)
    .filter((x) => x.empId === emp.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // สรุปสถานะการจ่าย: จำนวนงาน + ยอดผลประโยชน์ (จ่ายแล้ว / รอจ่าย)
  const paidRows = rows.filter((x) => x.status === "paid");
  const pendingRows = rows.filter((x) => x.status !== "paid");
  const paidComm = paidRows.reduce((a, x) => a + commissionOf(x), 0);
  const pendingComm = pendingRows.reduce((a, x) => a + commissionOf(x), 0);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full p-3.5 text-left hover:bg-red-50/30 transition"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center font-bold text-[13px] overflow-hidden">
                {empPhoto ? (
                  <Image
                    src={empPhoto}
                    alt={emp.name}
                    width={40}
                    height={40}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  emp.avatar
                )}
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
        </div>

        {/* แถบกราฟแนวนอน โทนแดงเข้ม (ชั้นบนสุด) ยาวตาม % ของค่าคอมฯเทียบทั้งหมด */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#8f1114] to-[#d32029] rounded-full"
            style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
          />
        </div>

        {/* สรุปสถานะการจ่าย: จำนวนงาน + ยอดผลประโยชน์ */}
        <div className="mt-2 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-[10px]">
          <span className="flex items-center text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d32029] mr-1.5" />
            จ่ายแล้ว: {paidRows.length} งาน ·{" "}
            <span className="tnum font-semibold text-slate-700 ml-0.5">
              {formatBaht(paidComm)}
            </span>
          </span>
          <span className="flex items-center text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            รอจ่าย: {pendingRows.length} งาน ·{" "}
            <span className="tnum font-semibold text-slate-700 ml-0.5">
              {formatBaht(pendingComm)}
            </span>
          </span>
        </div>
      </button>
      {/* ลิงก์ไปหน้าประวัติพนักงาน (แยกจากปุ่มเปิด/ซ่อน) */}
      <div className="px-3.5 pb-2 -mt-1">
        <Link
          href={`/app/employee/${encodeURIComponent(emp.id)}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a11119] hover:underline active:scale-95 transition"
        >
          <Icon name="account_circle" style={{ fontSize: 14 }} />
          ดูประวัติพนักงาน
        </Link>
      </div>
      {open && (
        <div className="border-t border-slate-50">
          {rows.length === 0 ? (
            <p className="text-[11px] text-slate-400 px-3.5 py-2.5">ไม่มีรายการ</p>
          ) : (
            // แยกตามพนักงาน: ประเภทของงาน -> กลุ่มงานย่อย -> สถานะการจ่าย -> รายการงาน
            <EmployeeJobKindBreakdown rows={rows} />
          )}
        </div>
      )}
    </div>
  );
}

/** รายละเอียดงานของพนักงาน แยก 2 ชั้น: สถานะการจ่าย -> กลุ่มการขาย (บริการ/สินค้า) -> รายการงาน */
function EmployeeBreakdown({ rows }: { rows: Sale[] }) {
  // ชั้นที่ 1: สถานะการจ่าย (จ่ายแล้ว = paid, รอจ่าย = pending/processing)
  const statusOrder: { key: "paid" | "pending"; label: string }[] = [
    { key: "paid", label: "จ่ายแล้ว" },
    { key: "pending", label: "รอจ่าย" },
  ];
  const payStatusOf = (s: Sale) => (s.status === "paid" ? "paid" : "pending");

  return (
    <div className="divide-y divide-slate-100">
      {statusOrder.map(({ key, label }) => {
        const statusRows = rows.filter((x) => payStatusOf(x) === key);
        if (statusRows.length === 0) return null;
        const sComm = statusRows.reduce((a, x) => a + commissionOf(x), 0);
        const sSales = statusRows.reduce((a, x) => a + x.amount, 0);
        const dot = key === "paid" ? "bg-[#d32029]" : "bg-amber-500";
        return (
          <div key={key}>
            {/* หัวข้อสถานะ */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-[#faf3f3]">
              <span className="flex items-center text-[12px] font-bold text-slate-700">
                <span className={cn("w-2 h-2 rounded-full mr-1.5", dot)} />
                {label}
              </span>
              <span className="text-[10px] text-slate-500 tnum">
                {statusRows.length} งาน · {formatBaht(sComm)} · Rate{" "}
                {rateText(sComm, sSales)}
              </span>
            </div>
            {/* ชั้นที่ 2: กลุ่มการขาย (บริการ/สินค้า) — กดเปิด/ซ่อนรายการงาน */}
            {(Object.keys(GROUPS) as GroupKey[]).map((g) => {
              const groupRows = statusRows.filter((x) => {
                const sol = solutionById(x.solId);
                return sol ? sol.group === g : false;
              });
              if (groupRows.length === 0) return null;
              return <GroupBreakdownRow key={g} groupKey={g} rows={groupRows} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

/** แยกตามพนักงาน: ประเภทของงาน (บริการ/สินค้า) -> กลุ่มงานย่อย -> สถานะ -> รายการงาน
 *  % ของประเภทงาน เทียบกับยอดรวมของพนักงานคนนั้น */
function EmployeeJobKindBreakdown({ rows }: { rows: Sale[] }) {
  const empTotal = rows.reduce((a, x) => a + commissionOf(x), 0);
  return (
    <div className="divide-y divide-slate-100">
      {(Object.keys(GROUPS) as GroupKey[]).map((g) => {
        const kindRows = rows.filter((x) => {
          const sol = solutionById(x.solId);
          return sol ? sol.group === g : false;
        });
        if (kindRows.length === 0) return null;
        return (
          <JobKindRow
            key={g}
            groupKey={g}
            rows={kindRows}
            empTotal={empTotal}
          />
        );
      })}
    </div>
  );
}

/** ชั้นประเภทของงาน (บริการ/สินค้า) — กดเปิด/ซ่อน -> กลุ่มงานย่อย -> สถานะ -> งาน (เริ่มต้นยุบ)
 *  มี % + แถบกราฟสีแดง (เทียบกับยอดรวมของพนักงาน) */
function JobKindRow({
  groupKey,
  rows,
  empTotal,
}: {
  groupKey: GroupKey;
  rows: Sale[];
  empTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const comm = rows.reduce((a, x) => a + commissionOf(x), 0);
  const sales = rows.reduce((a, x) => a + x.amount, 0);
  const pct = empTotal > 0 ? (comm / empTotal) * 100 : 0;
  // ประเภทของงาน: บริการ (solution) = ฟ้า, สินค้า (product) = เขียว
  const st =
    groupKey === "product"
      ? {
          head: "bg-emerald-50 hover:bg-emerald-100/70",
          icon: "text-emerald-600",
          bar: "from-emerald-500 to-emerald-300",
          pctText: "text-emerald-700",
        }
      : {
          head: "bg-sky-50 hover:bg-sky-100/70",
          icon: "text-sky-600",
          bar: "from-sky-500 to-sky-300",
          pctText: "text-sky-700",
        };
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("w-full px-3.5 py-2 text-left transition", st.head)}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center text-[12px] font-bold text-slate-700 min-w-0">
            <Icon
              name={GROUPS[groupKey].icon}
              style={{ fontSize: 15 }}
              className={cn("mr-1 shrink-0", st.icon)}
            />
            <span className="truncate">{GROUPS[groupKey].label}</span>
          </span>
          <span className="flex items-center shrink-0 ml-2">
            <span className="text-[10px] text-slate-500 tnum">
              {rows.length} งาน · {formatBaht(comm)} · Rate{" "}
              {rateText(comm, sales)}
            </span>
            <Icon
              name="expand_more"
              className={cn(
                "text-slate-400 text-base ml-1 transition",
                open && "rotate-180"
              )}
            />
          </span>
        </div>
        {/* % + แถบกราฟ: บริการ=ฟ้า / สินค้า=เขียว */}
        <div className="mt-1.5 flex items-center gap-2 pr-1">
          <div className="flex-1 h-1.5 rounded-full bg-white/70 overflow-hidden">
            <div
              className={cn(
                "h-full bg-gradient-to-r rounded-full",
                st.bar
              )}
              style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
            />
          </div>
          <span
            className={cn("tnum text-[10px] font-semibold shrink-0", st.pctText)}
          >
            {pct.toFixed(1)}%
          </span>
        </div>
      </button>
      {open && <SubGroupBreakdown rows={rows} />}
    </div>
  );
}

/** รายละเอียดแบบ: กลุ่มงานย่อย (เช่น Roof Installation) -> สถานะการจ่าย -> รายการงาน
 *  ใช้ในกล่อง "ผลประโยชน์แยกตามกลุ่ม" ที่ fix บริการ/สินค้าไว้แล้ว
 *  % ของกลุ่มงานย่อย เทียบกับยอดรวมของกลุ่มการขาย (บริการ/สินค้า) นั้น */
function SubGroupBreakdown({ rows }: { rows: Sale[] }) {
  const groupTotal = rows.reduce((a, x) => a + commissionOf(x), 0);
  // กลุ่มงานย่อย (solId) เรียงตามค่าคอมฯมาก->น้อย
  const solIds = Array.from(new Set(rows.map((x) => x.solId))).sort((a, b) => {
    const ca = rows
      .filter((x) => x.solId === a)
      .reduce((s, x) => s + commissionOf(x), 0);
    const cb = rows
      .filter((x) => x.solId === b)
      .reduce((s, x) => s + commissionOf(x), 0);
    return cb - ca;
  });
  return (
    <div className="divide-y divide-slate-100">
      {solIds.map((id) => {
        const subRows = rows.filter((x) => x.solId === id);
        return (
          <SubGroupRow
            key={id}
            solId={id}
            rows={subRows}
            groupTotal={groupTotal}
          />
        );
      })}
    </div>
  );
}

/** ชั้นกลุ่มงานย่อย (เช่น Roof Installation) — กดเปิด/ซ่อน -> สถานะ -> รายการงาน (เริ่มต้นยุบ)
 *  มี % + แถบกราฟสีอำพัน (ต่างจากแถบหลักสีแดง) */
function SubGroupRow({
  solId,
  rows,
  groupTotal,
}: {
  solId: string;
  rows: Sale[];
  groupTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const sol = solutionById(solId);
  const comm = rows.reduce((a, x) => a + commissionOf(x), 0);
  const sales = rows.reduce((a, x) => a + x.amount, 0);
  const pct = groupTotal > 0 ? (comm / groupTotal) * 100 : 0;

  const statusOrder: { key: "paid" | "pending"; label: string }[] = [
    { key: "paid", label: "จ่ายแล้ว" },
    { key: "pending", label: "รอจ่าย" },
  ];
  const payStatusOf = (s: Sale) => (s.status === "paid" ? "paid" : "pending");

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3.5 py-2 bg-slate-50 pl-6 text-left hover:bg-slate-100/70 transition"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center text-[11px] font-semibold text-slate-600 min-w-0">
            <Icon
              name={sol?.icon ?? "sell"}
              style={{ fontSize: 14 }}
              className="text-[#e08a8a] mr-1 shrink-0"
            />
            <span className="truncate">{sol?.name ?? solId}</span>
          </span>
          <span className="flex items-center shrink-0 ml-2">
            <span className="text-[10px] text-slate-400 tnum">
              {rows.length} งาน · {formatBaht(comm)} · Rate{" "}
              {rateText(comm, sales)}
            </span>
            <Icon
              name="expand_more"
              className={cn(
                "text-slate-300 text-base ml-1 transition",
                open && "rotate-180"
              )}
            />
          </span>
        </div>
        {/* % + แถบกราฟโทนแดงอ่อน/ชมพู (เฉดอ่อนสุดของโทนแดง — ชั้นลึกสุด) */}
        <div className="mt-1.5 flex items-center gap-2 pr-1">
          <div className="flex-1 h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#f08a8a] to-[#f9cccc] rounded-full"
              style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
            />
          </div>
          <span className="tnum text-[10px] font-semibold text-[#c76b6b] shrink-0">
            {pct.toFixed(1)}%
          </span>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {statusOrder.map(({ key, label }) => {
            const statusRows = rows.filter((x) => payStatusOf(x) === key);
            if (statusRows.length === 0) return null;
            const sComm = statusRows.reduce((a, x) => a + commissionOf(x), 0);
            const sSales = statusRows.reduce((a, x) => a + x.amount, 0);
            const dot = key === "paid" ? "bg-[#d32029]" : "bg-amber-500";
            return (
              <div key={key}>
                {/* หัวข้อสถานะ */}
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#faf3f3] pl-9">
                  <span className="flex items-center text-[11px] font-bold text-slate-700">
                    <span className={cn("w-2 h-2 rounded-full mr-1.5", dot)} />
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-500 tnum">
                    {statusRows.length} งาน · {formatBaht(sComm)} · Rate{" "}
                    {rateText(sComm, sSales)}
                  </span>
                </div>
                {/* รายการงาน */}
                <div className="divide-y divide-slate-50">
                  {statusRows.map((x) => (
                    <SaleLine key={x.id} x={x} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** แถวกลุ่มการขาย (บริการ/สินค้า) ในกล่อง "ผลประโยชน์แยกตามกลุ่ม" — รูปแบบเดียวกับ BenefitTypeRow
 *  กดเปิด/ซ่อน -> สถานะ -> กลุ่มงานย่อย -> รายการงาน */
function GroupBenefitRow({
  groupKey,
  label,
  icon,
  rows,
  benefitTotal,
}: {
  groupKey: GroupKey;
  label: string;
  icon: string;
  rows: Sale[];
  benefitTotal: number;
}) {
  const [open, setOpen] = useState(false);
  const amount = rows.reduce((a, x) => a + commissionOf(x), 0);
  const sales = rows.reduce((a, x) => a + x.amount, 0);
  const pct = benefitTotal > 0 ? (amount / benefitTotal) * 100 : 0;
  const paidRows = rows.filter((x) => x.status === "paid");
  const pendingRows = rows.filter((x) => x.status !== "paid");
  const paidAmount = paidRows.reduce((a, x) => a + commissionOf(x), 0);
  const pendingAmount = pendingRows.reduce((a, x) => a + commissionOf(x), 0);
  void groupKey;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3.5 py-3 text-left hover:bg-red-50/30 transition"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
              <Icon name={icon} className="text-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 truncate">
                {label}
              </p>
              <p className="text-[11px] text-slate-400">
                {rows.length} งาน · ยอดขาย {formatBahtShort(sales)}
              </p>
            </div>
          </div>
          <div className="flex items-center shrink-0 ml-2">
            <div className="text-right">
              <p className="tnum text-[14px] font-bold text-[#a11119]">
                {formatBaht(amount)}
              </p>
              <p className="tnum text-[11px] font-semibold text-[#d32029]">
                {pct.toFixed(1)}% ของค่าคอมฯรวม
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
        </div>

        {/* แถบกราฟแนวนอน ยาวตาม % */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#d32029] to-[#f6a5a5] rounded-full"
            style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
          />
        </div>

        {/* สรุปสถานะการจ่าย */}
        <div className="mt-2 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-[10px]">
          <span className="flex items-center text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d32029] mr-1.5" />
            จ่ายแล้ว: {paidRows.length} งาน ·{" "}
            <span className="tnum font-semibold text-slate-700 ml-0.5">
              {formatBaht(paidAmount)}
            </span>
          </span>
          <span className="flex items-center text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            รอจ่าย: {pendingRows.length} งาน ·{" "}
            <span className="tnum font-semibold text-slate-700 ml-0.5">
              {formatBaht(pendingAmount)}
            </span>
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-50">
          <SubGroupBreakdown rows={rows} />
        </div>
      )}
    </div>
  );
}

/** ชั้นกลุ่มการขาย (บริการ/สินค้า) ในรายละเอียด — กดเปิด/ซ่อนรายการงาน (เริ่มต้นยุบ) */
function GroupBreakdownRow({
  groupKey,
  rows,
}: {
  groupKey: GroupKey;
  rows: Sale[];
}) {
  const [open, setOpen] = useState(false);
  const gComm = rows.reduce((a, x) => a + commissionOf(x), 0);
  const gSales = rows.reduce((a, x) => a + x.amount, 0);
  return (
    <div>
      {/* หัวข้อกลุ่มการขาย (กดได้) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-1.5 bg-slate-50 pl-6 text-left hover:bg-slate-100/70 transition"
      >
        <span className="flex items-center text-[11px] font-semibold text-slate-600">
          <Icon
            name={GROUPS[groupKey].icon}
            style={{ fontSize: 14 }}
            className="text-[#d32029] mr-1"
          />
          {GROUPS[groupKey].label}
        </span>
        <span className="flex items-center">
          <span className="text-[10px] text-slate-400 tnum">
            {rows.length} งาน · {formatBaht(gComm)} · Rate{" "}
            {rateText(gComm, gSales)}
          </span>
          <Icon
            name="expand_more"
            className={cn(
              "text-slate-300 text-base ml-1 transition",
              open && "rotate-180"
            )}
          />
        </span>
      </button>
      {/* รายการงาน (ยุบไว้) */}
      {open && (
        <div className="divide-y divide-slate-50">
          {rows.map((x) => (
            <SaleLine key={x.id} x={x} />
          ))}
        </div>
      )}
    </div>
  );
}
