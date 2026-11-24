"use client";

/* การ์ด "ต้องตรวจประเมินร้าน" ในหน้ารายละเอียดร้าน (Admin เท่านั้น)
   - ปิด = ไม่นับในการติดตาม/แจ้งเตือน ตั้งแต่เดือนนี้ ; เดือนก่อนหน้ายังนับตามเดิม */
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { fetchStoreEvalRequired, monthLabel, setStoreEvalRequired } from "@/lib/commission/eval-tracking-store";
import { cn } from "@/lib/utils";

type State = { required: boolean; reason: string | null; since: string | null; period: string };

export function EvalRequiredCard({ dealerCode }: { dealerCode: string }) {
  const [st, setSt] = useState<State | null>(null);
  const [ask, setAsk] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStoreEvalRequired(dealerCode).then((r) => {
      if (!cancelled && r.ok) setSt({ required: r.required, reason: r.reason, since: r.since, period: r.period });
    });
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  if (!st) return null;

  async function save(required: boolean) {
    setBusy(true);
    setErr(null);
    const r = await setStoreEvalRequired(dealerCode, required, required ? undefined : reason);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setAsk(false);
    setReason("");
    const g = await fetchStoreEvalRequired(dealerCode);
    if (g.ok) setSt({ required: g.required, reason: g.reason, since: g.since, period: g.period });
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5" aria-label="การตรวจประเมินร้าน">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", st.required ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>
          <Icon name="fact_check" className="text-xl" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-900">ตรวจประเมินร้านรายเดือน</p>
          <p className="text-[11px] text-slate-500">
            {st.required
              ? "Coach ต้องตรวจร้านนี้ทุกเดือน"
              : `ไม่ต้องตรวจ${st.since ? ` ตั้งแต่ ${monthLabel(st.since)}` : ""}${st.reason ? ` · ${st.reason}` : ""}`}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={st.required}
          aria-label="ต้องตรวจประเมินร้าน"
          disabled={busy}
          onClick={() => (st.required ? setAsk(true) : save(true))}
          className={cn("relative w-12 h-7 rounded-full transition shrink-0 disabled:opacity-50", st.required ? "bg-emerald-500" : "bg-slate-300")}
        >
          <span className={cn("absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all", st.required ? "left-[22px]" : "left-0.5")} />
        </button>
      </div>
      {ask && (
        <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-1.5">
          <p className="text-[11px] text-slate-600">ปิดการตรวจตั้งแต่ {monthLabel(st.period)} · เดือนก่อนหน้ายังนับตามเดิม · ไม่แจ้งเตือน Coach/Area สำหรับร้านนี้</p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="สาเหตุที่ไม่ตรวจ (บังคับ) เช่น ร้านปรับปรุง"
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[#d32029]"
          />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => { setAsk(false); setReason(""); }} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-bold text-slate-600">
              ยกเลิก
            </button>
            <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => save(false)} className="rounded-full bg-[#d32029] text-white px-3 py-1 text-[11.5px] font-bold disabled:opacity-40">
              ยืนยันปิดการตรวจ
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-1.5 text-[11px] text-[#a11119]" role="alert">{err}</p>}
    </section>
  );
}
