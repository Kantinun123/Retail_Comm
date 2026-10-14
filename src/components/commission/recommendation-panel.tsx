"use client";

/* =============================================================
   การ์ด "คำแนะนำ" (Recommendations) — บนสุดของหน้าวิเคราะห์
   ช่วยทีมขายรู้ว่าควรโฟกัสอะไรเพื่อปิดการขาย/ได้ผลประโยชน์เพิ่ม
   4 หัวข้อย่อย: ใกล้ขั้นบันได / อันดับผลประโยชน์ / ปิดงานค้าง / ดาวรุ่ง
   ============================================================= */
import { Icon } from "./icon";
import {
  formatBaht,
  formatBahtShort,
  recommendations,
  SALES_TIERS,
} from "@/lib/commission/logic";
import { cn } from "@/lib/utils";

/** สีตามประเภทงาน: บริการ=ฟ้า, สินค้า=เขียว */
function groupColor(g: "solution" | "product"): string {
  return g === "solution" ? "#0ea5e9" : "#16a34a";
}
function groupLabel(g: "solution" | "product"): string {
  return g === "solution" ? "บริการ" : "สินค้า";
}

export function RecommendationPanel({
  empScope,
  dealerScope,
}: {
  empScope: string | null;
  dealerScope: string | null;
}) {
  const rec = recommendations(empScope, dealerScope);
  const nearTop = rec.nearNextTier.slice(0, 5);
  const rankTop = rec.benefitRank.slice(0, 5);
  const rising = rec.risingGroups.slice(0, 5);

  const hasAny = nearTop.length > 0 || rankTop.length > 0 || rising.length > 0;

  if (!hasAny) {
    return (
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
          <Icon name="lightbulb" className="text-lg text-amber-500" fill />
          <span>คำแนะนำ</span>
        </h3>
        <p className="text-[12px] text-slate-400 text-center py-4">
          ยังไม่มีข้อมูลเพียงพอสำหรับคำแนะนำ
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
      <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
        <Icon name="lightbulb" className="text-lg text-amber-500" fill />
        <span>คำแนะนำ</span>
      </h3>

      {/* 1) ใกล้ถึงขั้นบันไดถัดไป */}
      {nearTop.length > 0 && (
        <SubSection
          icon="stairs"
          iconColor="#d32029"
          title="ใกล้ได้ผลประโยชน์ขั้นถัดไป"
          hint="ขายเพิ่มอีกนิดเพื่อขึ้นขั้นอัตราผลประโยชน์"
        >
          <div className="space-y-2.5">
            {nearTop.map((n) => {
              const curMin = SALES_TIERS.find((t) => t.rate === n.currentRate)?.min ?? 0;
              const span = n.sales + n.remaining - curMin || 1;
              const pct = Math.min(100, ((n.sales - curMin) / span) * 100);
              return (
                <div key={n.solId} className="rounded-xl bg-slate-50/60 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-[12px] font-semibold text-slate-700 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full mr-1.5 shrink-0"
                        style={{ background: groupColor(n.group) }}
                      />
                      <span className="truncate">{n.name}</span>
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 shrink-0 ml-2">
                      {(n.currentRate * 100).toFixed(0)}% →{" "}
                      <span className="text-[#a11119] font-bold">
                        {(n.nextRate * 100).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#d32029] to-[#f6a5a5]"
                      style={{ width: `${Math.max(3, pct).toFixed(0)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    ขายอีก{" "}
                    <span className="tnum font-bold text-[#a11119]">
                      {formatBaht(n.remaining)}
                    </span>{" "}
                    ขึ้น{n.nextTierLabel} · ได้ผลประโยชน์เพิ่มราว{" "}
                    <span className="tnum font-semibold text-emerald-600">
                      {formatBahtShort(n.extraBenefit)}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </SubSection>
      )}

      {/* 2) กลุ่มที่ได้ผลประโยชน์มาก -> น้อย */}
      {rankTop.length > 0 && (
        <SubSection
          icon="trophy"
          iconColor="#f59e0b"
          title="กลุ่มที่ได้ผลประโยชน์มากสุด"
          hint="โฟกัสกลุ่มที่ทำเงินได้ดีอยู่แล้ว"
        >
          <div className="space-y-2">
            {rankTop.map((r, i) => (
              <div key={r.solId} className="flex items-center justify-between">
                <span className="flex items-center text-[12px] text-slate-700 min-w-0">
                  <span className="w-5 shrink-0 text-center font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <span
                    className="w-2 h-2 rounded-full mx-1.5 shrink-0"
                    style={{ background: groupColor(r.group) }}
                  />
                  <span className="truncate font-medium">{r.name}</span>
                </span>
                <span className="text-right shrink-0 ml-2">
                  <span className="tnum text-[12px] font-bold text-[#a11119] block leading-tight">
                    {formatBaht(r.commission)}
                  </span>
                  <span className="tnum text-[10px] font-semibold text-slate-400">
                    {r.pct.toFixed(1)}% ของทั้งหมด · Rate {r.rate.toFixed(2)}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {/* 3) กลุ่มดาวรุ่ง — ระดับกลุ่มงานย่อย */}
      {rising.length > 0 && (
        <SubSection
          icon="trending_up"
          iconColor="#16a34a"
          title="กลุ่มดาวรุ่ง (กำลังมา)"
          hint="กลุ่มงานย่อยที่ค่าคอมฯ โตขึ้นจากรอบก่อน เร่งปิดต่อ"
        >
          <div className="space-y-2">
            {rising.map((r) => (
              <div key={r.solId} className="flex items-center justify-between">
                <span className="flex items-center text-[12px] text-slate-700 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full mr-1.5 shrink-0"
                    style={{ background: groupColor(r.group) }}
                  />
                  <span className="min-w-0">
                    <span className="font-medium block truncate leading-tight">
                      {r.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {groupLabel(r.group)}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="tnum text-[11px] text-slate-500">
                    {formatBahtShort(r.latest)}
                  </span>
                  <span className="inline-flex items-center text-[11px] font-bold text-emerald-600">
                    <Icon name="arrow_upward" style={{ fontSize: 13 }} />
                    {r.changePct.toFixed(0)}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </SubSection>
      )}
    </section>
  );
}

function SubSection({
  icon,
  iconColor,
  title,
  hint,
  children,
}: {
  icon: string;
  iconColor: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 p-3">
      <div className="flex items-start space-x-2 mb-2.5">
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          )}
          style={{ background: iconColor + "1a", color: iconColor }}
        >
          <Icon name={icon} style={{ fontSize: 17 }} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-slate-800 leading-tight">
            {title}
          </p>
          <p className="text-[10px] text-slate-400">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
