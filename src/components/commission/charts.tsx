"use client";

import {
  formatBaht,
  formatBahtShort,
  type GroupAgg,
} from "@/lib/commission/logic";

/* =============================================================
   SVG charts ported from commission-app/detail.html
   ============================================================= */

const RED = "#d32029";

/* ---------------- Donut ----------------
   วงกลมแบ่งเป็น 4 ส่วน = 2 กลุ่ม × 2 สถานะ
   - จ่ายแล้ว = สีเข้ม (ทึบ) ของกลุ่ม
   - รอจ่าย  = สีอ่อน (โปร่ง) ของกลุ่ม */
const GROUP_COLORS: Record<string, string> = {
  solution: RED,
  product: "#f59e0b",
};
/** สีสำหรับสถานะรอจ่าย (โทนอ่อนของสีกลุ่ม) */
const PENDING_COLORS: Record<string, string> = {
  solution: "#f6a5a5",
  product: "#fcd9a0",
};

export function DonutChart({ data }: { data: GroupAgg[] }) {
  const total = data.reduce((a, d) => a + d.commission, 0);
  const size = 130,
    r = 52,
    cx = size / 2,
    cy = size / 2,
    sw = 22;
  const C = 2 * Math.PI * r;

  // สร้าง segment เรียง: กลุ่มละ 2 ท่อน (จ่ายแล้ว -> รอจ่าย)
  const parts: { key: string; value: number; color: string }[] = [];
  data.forEach((d) => {
    parts.push({
      key: d.key + "-paid",
      value: d.paidCommission,
      color: GROUP_COLORS[d.key] ?? RED,
    });
    parts.push({
      key: d.key + "-pending",
      value: d.pendingCommission,
      color: PENDING_COLORS[d.key] ?? "#e2e8f0",
    });
  });

  const segments: React.ReactNode[] = [];
  let offset = 0;
  if (total > 0) {
    parts.forEach((p) => {
      if (p.value <= 0) return;
      const len = (p.value / total) * C;
      segments.push(
        <circle
          key={p.key}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={p.color}
          strokeWidth={sw}
          strokeDasharray={`${len} ${C - len}`}
          strokeDashoffset={-offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      );
      offset += len;
    });
  } else {
    segments.push(
      <circle
        key="empty"
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={sw}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center mt-3">
        <div className="shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segments}
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fontSize="10"
              fill="#94a3b8"
              fontFamily="Prompt,sans-serif"
            >
              รวม
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="#231313"
              fontFamily="Prompt,sans-serif"
            >
              {formatBahtShort(total)}
            </text>
          </svg>
        </div>
        <div className="flex-1 min-w-0 ml-3 space-y-2.5">
          {data.map((d) => {
            const pct = total > 0 ? (d.commission / total) * 100 : 0;
            const base = GROUP_COLORS[d.key] ?? RED;
            const light = PENDING_COLORS[d.key] ?? "#e2e8f0";
            return (
              <div key={d.key}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-[12px] font-semibold text-slate-700">
                    <span
                      className="w-3 h-3 rounded-sm mr-1.5"
                      style={{ background: base }}
                    />
                    {d.label}
                  </span>
                  <span className="tnum text-[12px] font-bold text-slate-900">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <p className="tnum text-[11px] text-slate-400 ml-[18px]">
                  ค่าคอมฯ {formatBaht(d.commission)} · {d.deals} งาน
                </p>
                {/* แยกสถานะ จ่ายแล้ว / รอจ่าย */}
                <div className="ml-[18px] mt-0.5 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center text-slate-500">
                      <span
                        className="w-2 h-2 rounded-full mr-1.5"
                        style={{ background: base }}
                      />
                      จ่ายแล้ว
                    </span>
                    <span className="tnum text-slate-600 font-medium">
                      {formatBaht(d.paidCommission)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center text-slate-500">
                      <span
                        className="w-2 h-2 rounded-full mr-1.5"
                        style={{ background: light }}
                      />
                      รอจ่าย
                    </span>
                    <span className="tnum text-slate-600 font-medium">
                      {formatBaht(d.pendingCommission)}
                    </span>
                  </div>
                </div>
                <p className="tnum text-[11px] text-slate-400 ml-[18px] mt-0.5">
                  ยอดขาย {formatBaht(d.sales)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* คำอธิบายสี: เข้ม = จ่ายแล้ว, อ่อน = รอจ่าย */}
      <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
        <span className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#d32029]" />
          <span>สีเข้ม = จ่ายแล้ว</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#f6a5a5]" />
          <span>สีอ่อน = รอจ่าย</span>
        </span>
      </div>
    </div>
  );
}

/* ---------------- Bar (3 months) ---------------- */
export interface GroupBarPoint {
  label: string;
  commission: number;
  paidCommission: number;
  pendingCommission: number;
  sales: number;
  deals: number;
}

export function GroupBar({
  data,
  barColor,
  pendingColor,
  lineColor,
}: {
  data: GroupBarPoint[];
  groupKey: "solution" | "product";
  barColor: string;
  /** สีของส่วน "รอจ่าย" (โทนอ่อนของกลุ่ม) */
  pendingColor: string;
  lineColor: string;
}) {
  // data already sliced to relevant group by caller via mapping
  const g: GroupBarPoint[] = data;
  const latest = g[g.length - 1];
  const prev = g[g.length - 2];
  let trend: React.ReactNode = null;
  if (prev && prev.commission > 0) {
    const pct = ((latest.commission - prev.commission) / prev.commission) * 100;
    const up = pct >= 0;
    trend = (
      <span
        className={`inline-flex items-center text-[12px] font-bold px-2 py-0.5 rounded-full ${
          up ? "bg-red-50 text-[#a11119]" : "bg-slate-100 text-slate-600"
        }`}
      >
        <span className="material-symbols-outlined text-[15px] mr-0.5">
          {up ? "trending_up" : "trending_down"}
        </span>
        {up ? "+" : ""}
        {pct.toFixed(1)}% เทียบเดือนก่อน
      </span>
    );
  }

  const maxV = Math.max(...g.map((d) => d.commission), 1);
  const W = 320,
    H = 236,
    padT = 40,
    padB = 84,
    n = g.length,
    slot = W / n,
    barW = Math.min(56, slot * 0.42),
    chartH = H - padT - padB;
  const cx = (i: number) => slot * i + slot / 2;
  const baseY = padT + chartH;
  const topY = (d: GroupBarPoint) => baseY - Math.max(2, (d.commission / maxV) * chartH);
  const pts = g.map((d, i) => ({ x: cx(i), y: topY(d) }));
  const trendPath = pts
    .map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1))
    .join(" ");

  return (
    <>
      <div className="text-right mb-1">{trend}</div>
      <div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="กราฟแท่งค่าคอมมิชชั่น 3 เดือนล่าสุด"
        >
          <line x1="0" y1={baseY} x2={W} y2={baseY} stroke="#e2e8f0" strokeWidth="1" />
          {g.map((d, i) => {
            const x = cx(i),
              y = topY(d),
              h = baseY - y,
              isLast = i === g.length - 1;
            return (
              <g key={i}>
                <text
                  x={x}
                  y={(y - 16).toFixed(1)}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={isLast ? "#a11119" : "#94a3b8"}
                  fontFamily="Prompt,sans-serif"
                >
                  {formatBahtShort(d.commission)}
                </text>
                {(() => {
                  // แท่งซ้อน: จ่ายแล้ว (ล่าง) + รอจ่าย (บน)
                  const paidH =
                    d.commission > 0 ? (d.paidCommission / d.commission) * h : 0;
                  const pendH = Math.max(0, h - paidH);
                  const paidY = baseY - paidH;
                  const pendY = paidY - pendH;
                  return (
                    <>
                      {/* รอจ่าย (ส่วนบน) */}
                      {pendH > 0.5 && (
                        <rect
                          x={x - barW / 2}
                          y={pendY.toFixed(1)}
                          width={barW}
                          height={pendH.toFixed(1)}
                          rx="6"
                          fill={pendingColor}
                        />
                      )}
                      {/* จ่ายแล้ว (ส่วนล่าง) */}
                      {paidH > 0.5 && (
                        <rect
                          x={x - barW / 2}
                          y={paidY.toFixed(1)}
                          width={barW}
                          height={paidH.toFixed(1)}
                          rx="6"
                          fill={barColor}
                        />
                      )}
                      {/* กันกรณีทั้งแท่งเป็น 0 ให้เห็นเส้นบาง ๆ */}
                      {h <= 0.5 && (
                        <rect
                          x={x - barW / 2}
                          y={(baseY - 2).toFixed(1)}
                          width={barW}
                          height={2}
                          rx="1"
                          fill="#e2e8f0"
                        />
                      )}
                    </>
                  );
                })()}
                <text
                  x={x}
                  y={baseY + 16}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isLast ? 700 : 500}
                  fill={isLast ? "#231313" : "#94a3b8"}
                  fontFamily="Prompt,sans-serif"
                >
                  {d.label}
                </text>
                <text
                  x={x}
                  y={baseY + 29}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#cbd5e1"
                  fontFamily="Prompt,sans-serif"
                >
                  {d.deals} งาน
                </text>
                <text
                  x={x}
                  y={baseY + 42}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#64748b"
                  fontFamily="Prompt,sans-serif"
                >
                  ขาย {formatBahtShort(d.sales)}
                </text>
                <text
                  x={x}
                  y={baseY + 55}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill={barColor}
                  fontFamily="Prompt,sans-serif"
                >
                  จ่ายแล้ว {formatBahtShort(d.paidCommission)}
                </text>
                <text
                  x={x}
                  y={baseY + 68}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill="#b45309"
                  fontFamily="Prompt,sans-serif"
                >
                  รอจ่าย {formatBahtShort(d.pendingCommission)}
                </text>
              </g>
            );
          })}
          {n > 1 && (
            <path
              d={trendPath}
              fill="none"
              stroke={lineColor}
              strokeWidth="2"
              strokeDasharray="5 3"
              strokeLinejoin="round"
            />
          )}
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r="3"
              fill={lineColor}
            />
          ))}
          {g.map((d, i) => {
            if (i === 0) return null;
            const prevD = g[i - 1];
            if (prevD.commission <= 0) return null;
            const pct = ((d.commission - prevD.commission) / prevD.commission) * 100;
            const up = pct >= 0;
            const mx = (cx(i - 1) + cx(i)) / 2;
            const my = Math.min(topY(prevD), topY(d)) - 18;
            const color = up ? "#16a34a" : "#dc2626";
            return (
              <g key={`c${i}`}>
                <rect
                  x={mx - 24}
                  y={my - 9}
                  width="48"
                  height="16"
                  rx="8"
                  fill={up ? "#f0fdf4" : "#fef2f2"}
                  stroke={color}
                  strokeWidth="0.8"
                />
                <text
                  x={mx}
                  y={my + 2.5}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill={color}
                  fontFamily="Prompt,sans-serif"
                >
                  {up ? "▲" : "▼"} {up ? "+" : ""}
                  {pct.toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
          <span className="flex items-center space-x-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: barColor }}
            />
            <span>จ่ายแล้ว</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: pendingColor }}
            />
            <span>รอจ่าย</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-4 h-0.5 rounded" style={{ background: lineColor }} />
            <span>เส้นแนวโน้ม</span>
          </span>
          <span>ขาย = ยอดขาย</span>
        </div>
      </div>
    </>
  );
}

/* ---------------- Line (full year) ---------------- */
interface LinePoint {
  label: string;
  commission: number;
  sales: number;
}

export function LineChart({
  id,
  data,
  cColor,
  sColor,
}: {
  id: string;
  data: LinePoint[];
  cColor: string;
  sColor: string;
}) {
  const maxV = Math.max(
    ...data.map((d) => d.sales),
    ...data.map((d) => d.commission),
    1
  );
  const W = 560,
    H = 210,
    padT = 34,
    padB = 34,
    padL = 16,
    padR = 16,
    n = data.length;
  const chartH = H - padT - padB,
    chartW = W - padL - padR,
    step = chartW / (n - 1);
  const ptC = (d: LinePoint, i: number) => ({
    x: padL + step * i,
    y: padT + (chartH - (d.commission / maxV) * chartH),
  });
  const ptS = (d: LinePoint, i: number) => ({
    x: padL + step * i,
    y: padT + (chartH - (d.sales / maxV) * chartH),
  });
  const ptsC = data.map(ptC),
    ptsS = data.map(ptS);
  const pathOf = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const lineC = pathOf(ptsC),
    lineS = pathOf(ptsS);
  const areaC =
    lineC +
    ` L ${ptsC[n - 1].x.toFixed(1)} ${padT + chartH} L ${ptsC[0].x.toFixed(1)} ${padT + chartH} Z`;

  const yearComm = data.reduce((a, d) => a + d.commission, 0);
  const yearSales = data.reduce((a, d) => a + d.sales, 0);
  const gradId = "grad_" + id;

  const grid: React.ReactNode[] = [];
  for (let gi = 1; gi <= 3; gi++) {
    const gy = padT + chartH - (chartH * gi) / 3;
    grid.push(
      <line
        key={gi}
        x1={padL}
        y1={gy.toFixed(1)}
        x2={W - padR}
        y2={gy.toFixed(1)}
        stroke="#f1f5f9"
        strokeWidth="1"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-[12px]">
        <span className="tnum text-slate-400">
          ค่าคอมฯ ทั้งปี:{" "}
          <span className="font-bold" style={{ color: cColor }}>
            {formatBaht(yearComm)}
          </span>
        </span>
        <span className="tnum text-slate-400">
          ยอดขายทั้งปี:{" "}
          <span className="font-bold" style={{ color: sColor }}>
            {formatBaht(yearSales)}
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="กราฟเส้นแนวโน้มทั้งปี"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={cColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid}
        <path d={areaC} fill={`url(#${gradId})`} />
        <path
          d={lineS}
          fill="none"
          stroke={sColor}
          strokeWidth="1.8"
          strokeDasharray="4 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={lineC}
          fill="none"
          stroke={cColor}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {ptsS.map((p, i) =>
          data[i].sales > 0 ? (
            <circle key={`s${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.2" fill={sColor} />
          ) : null
        )}
        {ptsC.map((p, i) =>
          data[i].commission > 0 ? (
            <circle key={`c${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.2" fill={cColor} />
          ) : null
        )}
        {data.map((d, i) =>
          d.sales > 0 ? (
            <text
              key={`sl${i}`}
              x={ptsS[i].x.toFixed(1)}
              y={(ptsS[i].y - 6).toFixed(1)}
              textAnchor="middle"
              fontSize="7"
              fontWeight="600"
              fill={sColor}
              fontFamily="Prompt,sans-serif"
            >
              {formatBahtShort(d.sales)}
            </text>
          ) : null
        )}
        {data.map((d, i) =>
          d.commission > 0 ? (
            <text
              key={`cl${i}`}
              x={ptsC[i].x.toFixed(1)}
              y={(ptsC[i].y - 6).toFixed(1)}
              textAnchor="middle"
              fontSize="7.5"
              fontWeight="700"
              fill={cColor}
              fontFamily="Prompt,sans-serif"
            >
              {formatBahtShort(d.commission)}
            </text>
          ) : null
        )}
        {data.map((d, i) => {
          if (i === 0) return null;
          const prevD = data[i - 1];
          if (prevD.commission <= 0 || d.commission <= 0) return null;
          const pct = ((d.commission - prevD.commission) / prevD.commission) * 100;
          const up = pct >= 0;
          const color = up ? "#16a34a" : "#dc2626";
          return (
            <text
              key={`chg${i}`}
              x={ptsC[i].x.toFixed(1)}
              y={(ptsC[i].y + 12).toFixed(1)}
              textAnchor="middle"
              fontSize="7"
              fontWeight="700"
              fill={color}
              fontFamily="Prompt,sans-serif"
            >
              {up ? "▲" : "▼"}
              {up ? "+" : ""}
              {pct.toFixed(0)}%
            </text>
          );
        })}
        {data.map((d, i) => (
          <text
            key={`lbl${i}`}
            x={ptsC[i].x.toFixed(1)}
            y={H - 10}
            textAnchor="middle"
            fontSize="9"
            fill="#94a3b8"
            fontFamily="Prompt,sans-serif"
          >
            {d.label}
          </text>
        ))}
      </svg>
      <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
        <span className="flex items-center space-x-1.5">
          <span className="w-4 h-0.5 rounded" style={{ background: cColor }} />
          <span>ค่าคอมมิชชั่น</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-4 h-0.5 rounded" style={{ background: sColor }} />
          <span>ยอดขาย</span>
        </span>
        <span className="text-slate-400">▲▼ = % เปลี่ยนแปลงเทียบเดือนก่อน</span>
      </div>
    </div>
  );
}

/* =============================================================
   กราฟวิเคราะห์เพิ่มเติม (7 แบบ)
   ============================================================= */
import type {
  PaymentSplit,
  RankRow,
  BenefitSlice,
  FunnelStage,
  GapResult,
  CumulativeSeries,
  HeatmapResult,
} from "@/lib/commission/logic";

/* ---- 1) สถานะการจ่าย: จ่ายแล้ว vs รอจ่าย (stacked bar + สรุป) ---- */
export function PaymentStatusChart({ data }: { data: PaymentSplit }) {
  const total = data.totalCommission;
  const paidPct = total > 0 ? (data.paidCommission / total) * 100 : 0;
  const pendPct = total > 0 ? (data.pendingCommission / total) * 100 : 0;
  return (
    <div className="mt-3">
      {/* แถบสัดส่วนแนวนอน */}
      <div className="h-7 w-full rounded-lg overflow-hidden flex bg-slate-100">
        {paidPct > 0 && (
          <div
            className="h-full flex items-center justify-center"
            style={{ width: `${paidPct}%`, background: "#16a34a" }}
          >
            {paidPct >= 12 && (
              <span className="text-[10px] font-bold text-white">
                {paidPct.toFixed(0)}%
              </span>
            )}
          </div>
        )}
        {pendPct > 0 && (
          <div
            className="h-full flex items-center justify-center"
            style={{ width: `${pendPct}%`, background: "#f59e0b" }}
          >
            {pendPct >= 12 && (
              <span className="text-[10px] font-bold text-white">
                {pendPct.toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </div>
      {/* การ์ดสรุป 2 ช่อง */}
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
          <p className="flex items-center text-[11px] font-semibold text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-sm mr-1.5 bg-[#16a34a]" />
            จ่ายแล้ว
          </p>
          <p className="tnum text-[15px] font-bold text-emerald-700 mt-0.5">
            {formatBaht(data.paidCommission)}
          </p>
          <p className="tnum text-[10px] text-slate-400">
            {data.paidDeals} งาน
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5">
          <p className="flex items-center text-[11px] font-semibold text-amber-700">
            <span className="w-2.5 h-2.5 rounded-sm mr-1.5 bg-[#f59e0b]" />
            รอจ่าย
          </p>
          <p className="tnum text-[15px] font-bold text-amber-700 mt-0.5">
            {formatBaht(data.pendingCommission)}
          </p>
          <p className="tnum text-[10px] text-slate-400">
            {data.pendingDeals} งาน
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---- 2) Top ranking (horizontal bar + เหรียญ) ---- */
const MEDALS = ["🥇", "🥈", "🥉"];
export function RankBarChart({
  data,
  color = RED,
  unitLabel = "",
}: {
  data: RankRow[];
  color?: string;
  /** ข้อความต่อท้ายใต้ชื่อ เช่น รหัสร้าน */
  unitLabel?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 text-center py-6">
        ไม่มีข้อมูลในช่วงที่เลือก
      </p>
    );
  }
  const max = Math.max(...data.map((d) => d.commission), 1);
  return (
    <div className="mt-3 space-y-2.5">
      {data.map((d, i) => {
        const pct = (d.commission / max) * 100;
        return (
          <div key={d.code}>
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center min-w-0 text-[12px] font-semibold text-slate-700">
                <span className="shrink-0 w-5 text-center mr-1">
                  {i < 3 ? MEDALS[i] : i + 1}
                </span>
                <span className="truncate">{d.name}</span>
              </span>
              <span className="tnum text-[12px] font-bold shrink-0 ml-2" style={{ color }}>
                {formatBaht(d.commission)}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(2, pct)}%`, background: color }}
              />
            </div>
            <p className="tnum text-[10px] text-slate-400 mt-0.5 ml-6">
              {d.deals} งาน · ยอดขาย {formatBahtShort(d.sales)}
              {unitLabel ? ` · ${unitLabel} ${d.code}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ---- 3) สัดส่วนตามประเภทผลประโยชน์ (donut แบบทั่วไป) ---- */
const BENEFIT_COLORS: Record<string, string> = {
  Commission: "#d32029",
  "Back Margin": "#7c3aed",
  Incentive: "#0ea5e9",
};
const BENEFIT_TH: Record<string, string> = {
  Commission: "คอมมิชชั่น",
  "Back Margin": "Back Margin",
  Incentive: "อินเซนทีฟ",
};
export function BenefitTypeChart({ data }: { data: BenefitSlice[] }) {
  const total = data.reduce((a, d) => a + d.commission, 0);
  const size = 130,
    r = 52,
    cx = size / 2,
    cy = size / 2,
    sw = 22;
  const C = 2 * Math.PI * r;
  const segs: React.ReactNode[] = [];
  let offset = 0;
  if (total > 0) {
    data.forEach((d) => {
      if (d.commission <= 0) return;
      const len = (d.commission / total) * C;
      segs.push(
        <circle
          key={d.type}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={BENEFIT_COLORS[d.type] ?? "#94a3b8"}
          strokeWidth={sw}
          strokeDasharray={`${len} ${C - len}`}
          strokeDashoffset={-offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      );
      offset += len;
    });
  } else {
    segs.push(
      <circle key="e" cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
    );
  }
  return (
    <div className="flex items-center mt-3">
      <div className="shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segs}
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="Prompt,sans-serif">
            รวม
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="13" fontWeight="700" fill="#231313" fontFamily="Prompt,sans-serif">
            {formatBahtShort(total)}
          </text>
        </svg>
      </div>
      <div className="flex-1 min-w-0 ml-3 space-y-2.5">
        {data.map((d) => {
          const pct = total > 0 ? (d.commission / total) * 100 : 0;
          return (
            <div key={d.type}>
              <div className="flex items-center justify-between">
                <span className="flex items-center text-[12px] font-semibold text-slate-700">
                  <span
                    className="w-3 h-3 rounded-sm mr-1.5"
                    style={{ background: BENEFIT_COLORS[d.type] ?? "#94a3b8" }}
                  />
                  {BENEFIT_TH[d.type] ?? d.type}
                </span>
                <span className="tnum text-[12px] font-bold text-slate-900">
                  {pct.toFixed(1)}%
                </span>
              </div>
              <p className="tnum text-[11px] text-slate-400 ml-[18px]">
                {formatBaht(d.commission)} · {d.deals} งาน
              </p>
            </div>
          );
        })}
        {data.length === 0 && (
          <p className="text-[12px] text-slate-400">ไม่มีข้อมูล</p>
        )}
      </div>
    </div>
  );
}

/* ---- 4) Funnel สถานะงาน ---- */
const FUNNEL_COLORS: Record<string, string> = {
  processing: "#94a3b8",
  pending: "#f59e0b",
  paid: "#16a34a",
};
export function FunnelChart({ data }: { data: FunnelStage[] }) {
  const max = Math.max(...data.map((d) => d.deals), 1);
  return (
    <div className="mt-3 space-y-2">
      {data.map((d) => {
        const pct = (d.deals / max) * 100;
        return (
          <div key={d.key} className="flex items-center">
            <span className="w-24 shrink-0 text-[12px] font-medium text-slate-600">
              {d.label}
            </span>
            <div className="flex-1 h-9 rounded-lg bg-slate-100 overflow-hidden relative">
              <div
                className="h-full rounded-lg flex items-center px-2.5 transition-all"
                style={{ width: `${Math.max(10, pct)}%`, background: FUNNEL_COLORS[d.key] }}
              >
                <span className="text-[11px] font-bold text-white tnum">
                  {d.deals} งาน
                </span>
              </div>
            </div>
            <span className="w-20 shrink-0 text-right tnum text-[11px] font-semibold text-slate-500 ml-2">
              {formatBahtShort(d.commission)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- 5) Histogram ช่องว่างเวลาปิดขาย -> โอนจ่าย ---- */
export function GapHistogramChart({ data }: { data: GapResult }) {
  if (data.sampled === 0) {
    return (
      <p className="text-[12px] text-slate-400 text-center py-6">
        ไม่มีข้อมูลวันที่เพียงพอสำหรับคำนวณ
      </p>
    );
  }
  const max = Math.max(...data.buckets.map((b) => b.deals), 1);
  return (
    <div className="mt-3">
      <div className="rounded-xl bg-sky-50/60 border border-sky-100 px-3.5 py-2 flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-slate-500">
          ระยะเวลาเฉลี่ยกว่าจะได้รับเงิน
        </span>
        <span className="tnum text-[15px] font-bold text-sky-700">
          {data.avgDays ?? "-"} วัน
        </span>
      </div>
      <div className="space-y-2">
        {data.buckets.map((b) => {
          const pct = (b.deals / max) * 100;
          return (
            <div key={b.label} className="flex items-center">
              <span className="w-20 shrink-0 text-[11px] font-medium text-slate-600">
                {b.label}
              </span>
              <div className="flex-1 h-6 rounded-md bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-md bg-[#0ea5e9] transition-all"
                  style={{ width: `${b.deals > 0 ? Math.max(4, pct) : 0}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right tnum text-[11px] font-semibold text-slate-500 ml-2">
                {b.deals}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-2 text-center">
        คำนวณจาก {data.sampled} งานที่มีทั้งวันปิดขายและวันโอนจ่าย
      </p>
    </div>
  );
}

/* ---- 6) ค่าคอมฯ สะสม (cumulative) รายปี ---- */
export function CumulativeChart({ data }: { data: CumulativeSeries[] }) {
  const W = 560,
    H = 220,
    padT = 20,
    padB = 34,
    padL = 16,
    padR = 16;
  const chartH = H - padT - padB,
    chartW = W - padL - padR;
  const n = 12,
    step = chartW / (n - 1);
  const maxV = Math.max(
    1,
    ...data.flatMap((s) => s.points.map((p) => p.value))
  );
  const colors = [RED, "#cbd5e1"]; // ปีปัจจุบัน = แดง, ปีก่อน = เทา
  const yOf = (v: number) => padT + (chartH - (v / maxV) * chartH);
  const xOf = (i: number) => padL + step * i;
  const labels = data[0]?.points.map((p) => p.label) ?? [];
  const grid: React.ReactNode[] = [];
  for (let gi = 1; gi <= 3; gi++) {
    const gy = padT + chartH - (chartH * gi) / 3;
    grid.push(
      <line key={gi} x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="#f1f5f9" strokeWidth="1" />
    );
  }
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="กราฟค่าคอมมิชชั่นสะสมรายปี"
      >
        {grid}
        {data.map((s, si) => {
          const pts = s.points.map((p, i) => ({ x: xOf(i), y: yOf(p.value) }));
          const path = pts
            .map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1))
            .join(" ");
          return (
            <g key={s.year}>
              <path
                d={path}
                fill="none"
                stroke={colors[si] ?? "#94a3b8"}
                strokeWidth={si === 0 ? 2.6 : 1.8}
                strokeDasharray={si === 0 ? undefined : "5 3"}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {si === 0 && (
                <text
                  x={pts[n - 1].x}
                  y={(pts[n - 1].y - 7).toFixed(1)}
                  textAnchor="end"
                  fontSize="9"
                  fontWeight="700"
                  fill={colors[si]}
                  fontFamily="Prompt,sans-serif"
                >
                  {formatBahtShort(s.points[n - 1].value)}
                </text>
              )}
            </g>
          );
        })}
        {labels.map((lb, i) =>
          i % 2 === 0 ? (
            <text
              key={i}
              x={xOf(i).toFixed(1)}
              y={H - 10}
              textAnchor="middle"
              fontSize="9"
              fill="#94a3b8"
              fontFamily="Prompt,sans-serif"
            >
              {lb}
            </text>
          ) : null
        )}
      </svg>
      <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
        {data.map((s, si) => (
          <span key={s.year} className="flex items-center space-x-1.5">
            <span
              className="w-4 h-0.5 rounded"
              style={{ background: colors[si] ?? "#94a3b8" }}
            />
            <span>ปี {s.year}{si === 0 ? " (ปัจจุบัน)" : ""}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- 7) Heatmap เดือน x กลุ่มงานย่อย ---- */
const GROUP_HEAT: Record<string, { base: string }> = {
  solution: { base: "211, 32, 41" }, // แดง
  product: { base: "245, 158, 11" }, // อำพัน
};
export function HeatmapChart({ data }: { data: HeatmapResult }) {
  if (data.rows.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 text-center py-6">
        ไม่มีข้อมูลในปีที่เลือก
      </p>
    );
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: "2px" }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-white z-10" />
            {data.months.map((m) => (
              <th
                key={m}
                className="text-[9px] font-medium text-slate-400 px-0.5 pb-1"
              >
                {m.replace(".", "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => {
            const rgb = (GROUP_HEAT[r.group] ?? GROUP_HEAT.solution).base;
            return (
              <tr key={r.code}>
                <td className="sticky left-0 bg-white z-10 pr-2 max-w-[110px]">
                  <span className="block text-[10px] font-medium text-slate-600 truncate">
                    {r.name}
                  </span>
                </td>
                {r.cells.map((v, i) => {
                  const alpha = data.max > 0 ? 0.12 + (v / data.max) * 0.88 : 0;
                  return (
                    <td key={i} className="p-0">
                      <div
                        className="w-6 h-6 rounded-[4px] flex items-center justify-center"
                        style={{
                          background: v > 0 ? `rgba(${rgb}, ${alpha})` : "#f8fafc",
                        }}
                        title={`${r.name} · ${data.months[i]}: ${formatBaht(v)}`}
                      >
                        {v > 0 && alpha > 0.55 && (
                          <span className="w-1 h-1 rounded-full bg-white/80" />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[10px] text-slate-400 mt-2">
        สีเข้ม = ค่าคอมฯ สูงในเดือนนั้น · แสดงกลุ่มงานย่อยสูงสุด {data.rows.length} อันดับ
      </p>
    </div>
  );
}
