"use client";

/* =============================================================
   เนื้อหากราฟวิเคราะห์ (ใช้ซ้ำได้) — ไม่มี header / filter / bottom nav
   ใช้ทั้งในหน้า /app/analysis และกล่องเปิด-ซ่อนในหน้าภาพรวม
   ============================================================= */
import { useState } from "react";
import { Icon } from "./icon";
import { RecommendationPanel } from "./recommendation-panel";
import {
  DonutChart,
  GroupBar,
  LineChart,
  PaymentStatusChart,
  RankBarChart,
  BenefitTypeChart,
  FunnelChart,
  GapHistogramChart,
  CumulativeChart,
  HeatmapChart,
} from "./charts";
import {
  availableYears,
  commissionByGroupAll,
  commissionByMonthOfYear,
  commissionLast3Months,
  paymentSplit,
  topEmployees,
  topDealers,
  commissionByBenefitType,
  statusFunnel,
  payGapHistogram,
  cumulativeByYear,
  commissionHeatmap,
  selectedYears,
  type MonthBucket,
} from "@/lib/commission/logic";
import type { FilterState } from "@/lib/commission/types";

const RED = "#d32029";

/** map a full MonthBucket list into a single group's bar points */
function groupBarData(buckets: MonthBucket[], key: "solution" | "product") {
  return buckets.map((d) => ({
    label: d.label,
    commission: d[key].commission,
    paidCommission: d[key].paidCommission,
    pendingCommission: d[key].pendingCommission,
    sales: d[key].sales,
    deals: d[key].deals,
  }));
}

export function AnalysisCharts({
  state,
  empScope,
  dealerScope,
}: {
  state: FilterState;
  empScope: string | null;
  dealerScope: string | null;
}) {
  const [lineYear, setLineYear] = useState<string | null>(null);

  const donut = commissionByGroupAll(state, empScope, dealerScope);
  const last3 = commissionLast3Months(state, empScope, dealerScope);

  const years = availableYears();
  const selYears = selectedYears(state);
  const activeYear =
    lineYear ?? (selYears.find((y) => years.includes(y)) || years[0]);
  const monthData = commissionByMonthOfYear(
    state,
    activeYear,
    empScope,
    dealerScope
  );
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

  // กราฟวิเคราะห์เพิ่มเติม
  const payStatus = paymentSplit(state, empScope, dealerScope);
  const topEmps = topEmployees(state, empScope, dealerScope, 10);
  const topDlrs = topDealers(state, empScope, dealerScope, 10);
  const benefitSlices = commissionByBenefitType(state, empScope, dealerScope);
  const funnel = statusFunnel(state, empScope, dealerScope);
  const gap = payGapHistogram(state, empScope, dealerScope);
  const cumulative = cumulativeByYear(state, activeYear, empScope, dealerScope);
  const heatmap = commissionHeatmap(state, activeYear, empScope, dealerScope, 8);
  // ซ่อนการจัดอันดับร้าน/พนักงานเมื่อขอบเขตแคบเกินจนไม่มีความหมาย
  const showEmpRank = topEmps.length > 1;
  const showDealerRank = !dealerScope && topDlrs.length > 1;

  return (
    <div className="space-y-4">
      {/* คำแนะนำ — actionable บนสุดก่อนกราฟ */}
      <RecommendationPanel empScope={empScope} dealerScope={dealerScope} />

      {/* Donut */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
          <Icon name="donut_large" className="text-lg text-[#d32029]" />
          <span>สัดส่วนค่าคอมมิชชั่น (บริการ / สินค้า)</span>
        </h3>
        <DonutChart data={donut} />
      </section>

      {/* 1) สถานะการจ่าย: จ่ายแล้ว vs รอจ่าย */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
          <Icon name="account_balance_wallet" className="text-lg text-[#16a34a]" />
          <span>สถานะการจ่ายเงิน (จ่ายแล้ว / รอจ่าย)</span>
        </h3>
        <PaymentStatusChart data={payStatus} />
      </section>

      {/* 2) สัดส่วนตามประเภทผลประโยชน์ */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
          <Icon name="pie_chart" className="text-lg text-[#7c3aed]" />
          <span>สัดส่วนตามประเภทผลประโยชน์</span>
        </h3>
        <BenefitTypeChart data={benefitSlices} />
      </section>

      {/* 3) Top พนักงานขาย */}
      {showEmpRank && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
            <Icon name="military_tech" className="text-lg text-[#d32029]" />
            <span>อันดับพนักงานขาย (ค่าคอมฯ สูงสุด)</span>
          </h3>
          <RankBarChart data={topEmps} color="#d32029" unitLabel="รหัส" />
        </section>
      )}

      {/* 4) Top ร้านค้า */}
      {showDealerRank && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
            <Icon name="storefront" className="text-lg text-[#f59e0b]" />
            <span>อันดับร้านค้า (ค่าคอมฯ สูงสุด)</span>
          </h3>
          <RankBarChart data={topDlrs} color="#f59e0b" unitLabel="รหัส" />
        </section>
      )}

      {/* 5) Funnel สถานะงาน */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
          <Icon name="filter_alt" className="text-lg text-[#f59e0b]" />
          <span>ขั้นสถานะงาน (ดำเนินการ → รอจ่าย → จ่ายแล้ว)</span>
        </h3>
        <FunnelChart data={funnel} />
      </section>

      {/* 6) ช่องว่างเวลา ปิดขาย → โอนจ่าย */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
          <Icon name="schedule" className="text-lg text-[#0ea5e9]" />
          <span>ระยะเวลาปิดขาย → โอนจ่าย</span>
        </h3>
        <GapHistogramChart data={gap} />
      </section>

      {/* Bar — solution */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5 mb-1">
          <Icon name="bar_chart" className="text-lg text-[#d32029]" />
          <span>เปรียบเทียบค่าคอมฯ 3 เดือนล่าสุด (บริการ)</span>
        </h3>
        <GroupBar
          data={groupBarData(last3, "solution")}
          groupKey="solution"
          barColor={RED}
          pendingColor="#f6a5a5"
          lineColor="#8f1114"
        />
      </section>

      {/* Bar — product */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5 mb-1">
          <Icon name="bar_chart" className="text-lg text-amber-500" />
          <span>เปรียบเทียบค่าคอมฯ 3 เดือนล่าสุด (สินค้า)</span>
        </h3>
        <GroupBar
          data={groupBarData(last3, "product")}
          groupKey="product"
          barColor="#f59e0b"
          pendingColor="#fcd9a0"
          lineColor="#b45309"
        />
      </section>

      {/* Line — solution */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
            <Icon name="show_chart" className="text-lg text-[#d32029]" />
            <span>แนวโน้มค่าคอมฯ ทั้งปี (บริการ)</span>
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
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5 mb-2">
          <Icon name="show_chart" className="text-lg text-amber-500" />
          <span>แนวโน้มค่าคอมฯ ทั้งปี (สินค้า)</span>
        </h3>
        <LineChart id="prd" data={linePrd} cColor="#ea580c" sColor="#eab308" />
      </section>

      {/* 7a) ค่าคอมฯ สะสม เทียบปีก่อน */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5 mb-1">
          <Icon name="trending_up" className="text-lg text-[#d32029]" />
          <span>ค่าคอมฯ สะสมทั้งปี (เทียบปีก่อน) · ปี {activeYear}</span>
        </h3>
        <CumulativeChart data={cumulative} />
      </section>

      {/* 7b) Heatmap เดือน × กลุ่มงานย่อย */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5 mb-1">
          <Icon name="grid_on" className="text-lg text-[#d32029]" />
          <span>ความหนาแน่นตามเดือน × กลุ่มงานย่อย · ปี {activeYear}</span>
        </h3>
        <HeatmapChart data={heatmap} />
      </section>
    </div>
  );
}
