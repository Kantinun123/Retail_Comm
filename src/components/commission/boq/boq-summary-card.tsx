"use client";
/* การ์ด BOQ DECAAR บนหน้าหลัก (ร้าน / Area / Coach / admin) — สรุปปีนี้ + เรื่องที่ต้องตาม ; แตะเพื่อเปิดภาพรวม */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../icon";
import { baht, fetchBoqSummary, type BoqSummary } from "@/lib/commission/boq-store";
import { Funnel } from "./boq-overview-screen";

export function BoqSummaryCard({ dealer, title, sub, showAttention = false, rowsBy }: { dealer?: string | null; title: string; sub: string; showAttention?: boolean; rowsBy?: "stores" | "reps" }) {
  const [s, setS] = useState<BoqSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchBoqSummary({ year: new Date().getFullYear(), dealer: dealer ?? null })
      .then((x) => !cancelled && setS(x))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dealer]);
  // ซ่อนจนกว่าระบบเปิดใช้ (หรือมีคำขอแล้ว)
  if (!s || (!s.enabled && s.funnel.requested === 0)) return null;
  const a = s.attention;
  const rows = rowsBy ? (rowsBy === "reps" ? s.reps : s.stores).slice(0, 3) : [];
  const href = `/app/boq/overview${dealer ? `?dealer=${encodeURIComponent(dealer)}` : ""}`;

  return (
    <section className="space-y-2">
      <h3 className="text-[13px] font-bold text-[#8f1114] flex items-center gap-1.5 px-1">
        <Icon name="design_services" style={{ fontSize: 16 }} />
        {title}
      </h3>
      {showAttention && (a.overdue.n > 0 || a.staleOk.n > 0 || a.staleQuote.n > 0) && (
        <div className="rounded-2xl bg-white border border-amber-200 shadow-sm p-3 space-y-1.5 text-[11.5px]">
          <p className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5"><Icon name="notification_important" className="text-amber-600" style={{ fontSize: 17 }} />BOQ ที่ต้องตาม</p>
          {a.overdue.n > 0 && <p className="rounded-xl bg-red-50 text-red-700 px-3 py-1.5">ห้องแบบเกินกำหนด {a.overdue.n} งาน · {a.overdue.stores.join(", ")}</p>}
          {a.staleOk.n > 0 && <p className="rounded-xl bg-amber-50 text-amber-800 px-3 py-1.5">BOQ ผ่านเกิน 7 วัน ยังไม่เสนอราคา {a.staleOk.n} งาน · {a.staleOk.stores.join(", ")}</p>}
          {a.staleQuote.n > 0 && <p className="rounded-xl bg-amber-50 text-amber-800 px-3 py-1.5">เสนอราคาเกิน 30 วัน ยังไม่มีผล {a.staleQuote.n} งาน · {a.staleQuote.stores.join(", ")}</p>}
        </div>
      )}
      <Link href={href} className="block rounded-2xl bg-white border border-slate-100 shadow-sm p-3.5 space-y-3 hover:border-sky-200 hover:-translate-y-0.5 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0"><Icon name="design_services" style={{ fontSize: 21 }} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900">BOQ DECAAR · ปี {new Date().getFullYear() + 543}</p>
            <p className="text-[10px] text-slate-400">{sub}</p>
          </div>
          <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
        </div>
        {s.funnel.requested === 0 ? (
          <p className="text-[12px] text-slate-400 text-center py-2">ยังไม่มีคำขอ BOQ ปีนี้</p>
        ) : (
          <>
            <Funnel s={s} />
            {rows.length > 0 && (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {rows.map((r) => (
                  <div key={r.code} className="flex items-center gap-2 px-3 py-2 text-[11.5px]">
                    <span className="flex-1 text-slate-700 truncate">{r.name}</span>
                    <span className="text-slate-500">ขอ {r.req}</span>
                    <span className="text-emerald-700 font-semibold">Win {r.win}</span>
                    <span className="w-16 text-right font-bold text-slate-800">{baht(r.final)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Link>
    </section>
  );
}
