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

/* ---------------- Donut ---------------- */
export function DonutChart({ data }: { data: GroupAgg[] }) {
  const total = data.reduce((a, d) => a + d.commission, 0);
  const colors: Record<string, string> = { solution: RED, product: "#f59e0b" };
  const size = 130,
    r = 52,
    cx = size / 2,
    cy = size / 2,
    sw = 22;
  const C = 2 * Math.PI * r;

  const segments: React.ReactNode[] = [];
  let offset = 0;
  if (total > 0) {
    data.forEach((d) => {
      const len = (d.commission / total) * C;
      segments.push(
        <circle
          key={d.key}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={colors[d.key]}
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
          return (
            <div key={d.key}>
              <div className="flex items-center justify-between">
                <span className="flex items-center text-[12px] font-semibold text-slate-700">
                  <span
                    className="w-3 h-3 rounded-sm mr-1.5"
                    style={{ background: colors[d.key] }}
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
              <p className="tnum text-[11px] text-slate-400 ml-[18px]">
                ยอดขาย {formatBaht(d.sales)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Bar (3 months) ---------------- */
export interface GroupBarPoint {
  label: string;
  commission: number;
  sales: number;
  deals: number;
}

export function GroupBar({
  data,
  barColor,
  lineColor,
}: {
  data: GroupBarPoint[];
  groupKey: "solution" | "product";
  barColor: string;
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
    H = 200,
    padT = 40,
    padB = 48,
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
                <rect
                  x={x - barW / 2}
                  y={y.toFixed(1)}
                  width={barW}
                  height={Math.max(1, h).toFixed(1)}
                  rx="6"
                  fill={isLast ? barColor : barColor + "99"}
                />
                <text
                  x={x}
                  y={H - 32}
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
                  y={H - 19}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#cbd5e1"
                  fontFamily="Prompt,sans-serif"
                >
                  {d.deals} งาน
                </text>
                <text
                  x={x}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#64748b"
                  fontFamily="Prompt,sans-serif"
                >
                  ขาย {formatBahtShort(d.sales)}
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
            <span>แท่ง = ค่าคอมมิชชั่น</span>
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
