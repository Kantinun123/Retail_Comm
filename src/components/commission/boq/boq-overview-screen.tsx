"use client";
/* ภาพรวม BOQ DECAAR — หน้าแรกของ Marketing ; admin / ร้าน / Area เปิดจากการ์ดหน้าหลัก
   ตัวกรอง: ปี/เดือน + ประเภทร้าน + ภาค + Area + ร้าน (ทุกส่วนเปลี่ยนตาม + Excel ใช้ตัวกรองเดียวกัน) */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import { STATUS_META, baht, boqExportUrl, fetchBoqSummary, type BoqFilterInput, type BoqStatus, type BoqSummary } from "@/lib/commission/boq-store";
import { BoqHeader, card } from "./boq-shared";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const sel = "w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[12px] outline-none";
const mil = (n: number) => (n >= 1e6 ? `฿${(n / 1e6).toFixed(2)}M` : baht(n));

function H3({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
      <Icon name={icon} style={{ fontSize: 16 }} />
      {children}
    </h3>
  );
}

function Bars({ rows, color }: { rows: { label: string; n: number; extra?: string }[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-[11.5px] gap-2">
            <span className="text-slate-700 truncate">{r.label}</span>
            <span className="font-bold text-slate-800 shrink-0">
              {r.n}
              {r.extra && <span className="font-normal text-slate-400"> · {r.extra}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 mt-1 overflow-hidden">
            <div className={cn("h-full rounded-full", color)} style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Funnel({ s }: { s: BoqSummary }) {
  const steps = [
    { label: "ขอ BOQ", n: s.funnel.requested },
    { label: "เสนอราคา", n: s.funnel.quoted },
    { label: "Win", n: s.funnel.win },
  ];
  const max = Math.max(1, s.funnel.requested);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {steps.map((st) => (
          <div key={st.label} className="flex items-center gap-2">
            <span className="w-16 text-[11px] text-slate-500">{st.label}</span>
            <div className="flex-1 h-5 rounded-md bg-slate-100 overflow-hidden">
              <div className="h-full rounded-md bg-gradient-to-r from-sky-500 to-sky-400" style={{ width: `${(st.n / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right text-[12px] font-bold text-slate-800">{st.n}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 py-2"><p className="text-[10px] text-slate-500">อัตรา Win</p><p className="text-[14px] font-bold text-emerald-700">{s.winRate == null ? "-" : `${s.winRate}%`}</p></div>
        <div className="rounded-xl bg-slate-50 py-2"><p className="text-[10px] text-slate-500">ยอดปิดจริง</p><p className="text-[14px] font-bold text-slate-800">{mil(s.finalTotal)}</p></div>
        <div className="rounded-xl bg-slate-50 py-2 px-1"><p className="text-[10px] text-slate-500">แพ้เพราะ</p><p className="text-[10.5px] font-bold text-slate-700 leading-tight mt-0.5 line-clamp-2">{s.lossReasons[0] ? `${s.lossReasons[0].label.replace(/^Lost - /, "")} (${s.lossReasons[0].n})` : "-"}</p></div>
      </div>
    </div>
  );
}

export function BoqOverviewScreen() {
  const { session, ready } = useSession();
  const sp = useSearchParams();
  const thisYear = new Date().getFullYear();
  const [f, setF] = useState<BoqFilterInput>(() => ({ year: thisYear, dealer: sp.get("dealer") }));
  const [s, setS] = useState<BoqSummary | null>(null);
  const [error, setError] = useState("");
  const key = JSON.stringify(f);
  const [loadedKey, setLoadedKey] = useState("");

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchBoqSummary(JSON.parse(key) as BoqFilterInput)
      .then((x) => {
        if (cancelled) return;
        setS(x);
        setLoadedKey(key);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [ready, key]);

  const opt = s?.options;
  const storeChoices = useMemo(
    () => (opt?.stores ?? []).filter((x) => (!f.model || x.model === f.model) && (!f.region || x.region === f.region) && (!f.area || x.area === f.area)),
    [opt, f.model, f.region, f.area]
  );
  if (!ready || !session) return null;
  const set = (patch: BoqFilterInput) => setF((o) => ({ ...o, ...patch }));
  const role = s?.role;
  const marketing = role === "marketing";
  const storeLabel = f.dealer ? opt?.stores.find((x) => x.code === f.dealer)?.name ?? f.dealer : "ทุกร้าน";
  const periodLabel = f.year === "all" ? "ทุกช่วงเวลา" : f.month ? `${TH_MONTH[f.month - 1]} ${Number(f.year) + 543}` : `ปี ${Number(f.year) + 543}`;
  const loading = loadedKey !== key;
  const pipe: { st: BoqStatus[]; label: string; cls: string }[] = [
    { st: ["waiting"], label: "รอห้องแบบรับ", cls: "bg-amber-50 text-amber-800" },
    { st: ["working", "revise"], label: "ห้องแบบกำลังทำ", cls: "bg-sky-50 text-sky-800" },
    { st: ["submitted"], label: "รอพนักงานตรวจ", cls: "bg-violet-50 text-violet-800" },
    { st: ["boq_ok"], label: "รอใบเสนอราคา", cls: "bg-teal-50 text-teal-800" },
    { st: ["quoted"], label: "รอผล Win/Loss", cls: "bg-indigo-50 text-indigo-800" },
  ];

  return (
    <>
      <BoqHeader title="ภาพรวม BOQ DECAAR" sub={marketing ? "Marketing · ดูอย่างเดียว" : undefined} back={marketing ? undefined : "/app/boq"} />
      <div className="space-y-5 pb-6">
        <div className="flex gap-2">
          <span className="flex-1 text-center py-2 rounded-xl bg-slate-900 text-white text-[12px] font-bold">ภาพรวม</span>
          <Link href="/app/boq" className="flex-1 text-center py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-[12px] font-bold">รายการงาน</Link>
        </div>

        <section className={cn(card, "p-3 space-y-2")}>
          <p className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5"><Icon name="tune" className="text-sky-700" style={{ fontSize: 17 }} />ตัวกรอง</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">ปี</label>
              <select className={sel} value={String(f.year)} onChange={(e) => set({ year: e.target.value === "all" ? "all" : Number(e.target.value), month: null })}>
                {[thisYear, thisYear - 1].map((y) => <option key={y} value={y}>{y + 543}</option>)}
                <option value="all">ทั้งหมด</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">เดือน</label>
              <select className={sel} disabled={f.year === "all"} value={f.month ?? ""} onChange={(e) => set({ month: e.target.value ? Number(e.target.value) : null })}>
                <option value="">ทั้งปี</option>
                {TH_MONTH.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            {opt && (
              <>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">ประเภทร้าน</label>
                  <select className={sel} value={f.model ?? ""} onChange={(e) => set({ model: e.target.value || null, dealer: null })}>
                    <option value="">ทั้งหมด</option>
                    {opt.models.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">ภาค</label>
                  <select className={sel} value={f.region ?? ""} onChange={(e) => set({ region: e.target.value || null, dealer: null })}>
                    <option value="">ทุกภาค</option>
                    {opt.regions.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                {opt.areas.length > 1 && (
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500 mb-0.5">Area</label>
                    <select className={sel} value={f.area ?? ""} onChange={(e) => set({ area: e.target.value || null, dealer: null })}>
                      <option value="">ทุก Area</option>
                      {opt.areas.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                {opt.stores.length > 1 && (
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500 mb-0.5">ร้าน ({storeChoices.length})</label>
                    <select className={sel} value={f.dealer ?? ""} onChange={(e) => set({ dealer: e.target.value || null })}>
                      <option value="">ทุกร้าน</option>
                      {storeChoices.map((x) => <option key={x.code} value={x.code}>{x.name} ({x.code})</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[10.5px]">
            <span className="rounded-full bg-sky-100 text-sky-800 font-semibold px-2 py-0.5">กำลังดู: {storeLabel} · {periodLabel}</span>
            {(f.model || f.region || f.area || f.dealer || f.month) && (
              <button type="button" onClick={() => setF({ year: thisYear })} className="text-slate-500 underline">ล้างตัวกรอง</button>
            )}
            {role !== "sales" && (
              <a href={boqExportUrl(f)} className="ml-auto inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">
                <Icon name="download" style={{ fontSize: 15 }} />Excel
              </a>
            )}
          </div>
        </section>

        {error && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">โหลดไม่สำเร็จ: {error}</p>}
        {!s && !error && <p className="text-center text-[12px] text-slate-400 py-8">กำลังโหลด...</p>}
        {s && (
          <div className={cn("space-y-5 transition-opacity", loading && "opacity-50")}>
            <section>
              <H3 icon="pending_actions">สถานะงานตอนนี้</H3>
              <div className="grid grid-cols-3 gap-2">
                {pipe.map((p) => (
                  <div key={p.label} className={cn("rounded-xl px-1.5 py-2 text-center", p.cls)}>
                    <p className="text-[17px] font-bold leading-none">{p.st.reduce((a, k) => a + (s.status[k] ?? 0), 0)}</p>
                    <p className="text-[9.5px] mt-1 leading-tight">{p.label}</p>
                  </div>
                ))}
                <div className="rounded-xl px-1.5 py-2 text-center bg-red-50 text-red-700">
                  <p className="text-[17px] font-bold leading-none">{s.attention.overdue.n}</p>
                  <p className="text-[9.5px] mt-1 leading-tight">ห้องแบบเกินกำหนด</p>
                </div>
              </div>
            </section>

            <section>
              <H3 icon="filter_alt">ผลลัพธ์ · {periodLabel}</H3>
              <div className={cn(card, "p-3.5")}>
                <Funnel s={s} />
                <p className="text-[10.5px] text-slate-500 mt-2.5">
                  ยอดเสนอราคารวม {mil(s.quoteTotal)} · ยอดปิดจริง {mil(s.finalTotal)}
                  {s.avgDaysToWin != null ? ` · เฉลี่ย ขอ → Win ${s.avgDaysToWin} วัน` : ""}
                  {s.status.cancelled ? ` · ยกเลิก ${s.status.cancelled}` : ""}
                </p>
              </div>
            </section>

            {(s.attention.staleOk.n > 0 || s.attention.staleQuote.n > 0 || s.attention.overdue.n > 0) && (
              <section>
                <H3 icon="notification_important">เรื่องที่ต้องตาม</H3>
                <div className="space-y-1.5 text-[11.5px]">
                  {s.attention.overdue.n > 0 && <p className="rounded-xl bg-red-50 text-red-700 px-3 py-2">ห้องแบบเกินกำหนด {s.attention.overdue.n} งาน · {s.attention.overdue.stores.join(", ")}</p>}
                  {s.attention.staleOk.n > 0 && <p className="rounded-xl bg-amber-50 text-amber-800 px-3 py-2">BOQ ผ่านเกิน 7 วัน ยังไม่เสนอราคา {s.attention.staleOk.n} งาน · {s.attention.staleOk.stores.join(", ")}</p>}
                  {s.attention.staleQuote.n > 0 && <p className="rounded-xl bg-amber-50 text-amber-800 px-3 py-2">เสนอราคาเกิน 30 วัน ยังไม่มีผล {s.attention.staleQuote.n} งาน · {s.attention.staleQuote.stores.join(", ")}</p>}
                </div>
              </section>
            )}

            {s.products.length > 0 && (
              <section>
                <H3 icon="inventory_2">สินค้าที่ถูกขอ BOQ มากสุด</H3>
                <div className={cn(card, "p-3.5")}>
                  <p className="text-[10px] text-slate-400 mb-2">นับตามจุดที่ขอ · Win = จุดในคำขอที่ปิดได้</p>
                  <Bars color="bg-[#d32029]" rows={s.products.map((p) => ({ label: p.name, n: p.n, extra: `Win ${p.win}` }))} />
                </div>
              </section>
            )}

            {s.lossReasons.length > 0 && (
              <section>
                <H3 icon="thumb_down">เหตุผลที่ไม่ได้งาน</H3>
                <div className={cn(card, "p-3.5 space-y-2")}>
                  <p className="text-[10px] text-slate-400">Loss {s.funnel.loss} งาน</p>
                  <Bars color="bg-slate-500" rows={s.lossReasons.map((r) => ({ label: r.label.replace(/^Lost - /, ""), n: r.n }))} />
                  {(() => {
                    const scg = s.lossReasons.filter((r) => r.code.endsWith("scg_other_store")).reduce((a, r) => a + r.n, 0);
                    return scg > 0 ? <p className="text-[10.5px] text-amber-800 bg-amber-50 rounded-xl px-3 py-2">💡 เสียงานให้ร้าน SCG อื่น {scg} งาน = ลูกค้ายังใช้สินค้า SCG (ไม่ได้เสียให้คู่แข่ง)</p> : null;
                  })()}
                </div>
              </section>
            )}

            {s.designers.length > 0 && (
              <section>
                <H3 icon="timer">ห้องแบบส่งทันกำหนด</H3>
                <div className={cn(card, "p-3.5")}>
                  <p className="text-[10px] text-slate-400 mb-2">SLA 3 วันทำการ (BOQ) / 5 วันทำการ (BOQ + 3D) · นับการส่งครั้งแรก</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {s.designers.map((d) => (
                      <div key={d.id} className="rounded-xl bg-slate-50 py-2 px-1">
                        <p className="text-[11px] text-slate-600 truncate">{d.name}</p>
                        <p className={cn("text-[16px] font-bold", d.pct == null ? "text-slate-400" : d.pct >= 90 ? "text-emerald-700" : d.pct >= 70 ? "text-amber-700" : "text-red-700")}>{d.pct == null ? "-" : `${d.pct}%`}</p>
                        <p className="text-[10px] text-slate-400">ส่ง {d.done} · ทำอยู่ {d.active}</p>
                        {d.avgRounds != null && <p className="text-[10px] text-slate-400">เฉลี่ย {d.avgRounds.toFixed(1)} รอบ</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {(f.dealer || role === "sales" ? s.reps : s.stores).length > 0 && (
              <section>
                <H3 icon={f.dealer ? "badge" : "storefront"}>{f.dealer ? "แยกรายพนักงาน" : "แยกรายร้าน"}</H3>
                <div className={cn(card, "divide-y divide-slate-100")}>
                  {(f.dealer ? s.reps : s.stores).map((r) => {
                    const row = (
                      <>
                        <span className="flex-1 text-slate-700 truncate">{r.name}</span>
                        <span className="text-slate-500 shrink-0">ขอ {r.req}</span>
                        <span className="text-indigo-700 shrink-0">เสนอ {r.quoted}</span>
                        <span className="text-emerald-700 font-semibold shrink-0">Win {r.win}</span>
                        <span className="w-16 text-right font-bold text-slate-800 shrink-0">{mil(r.final)}</span>
                      </>
                    );
                    return f.dealer || !opt ? (
                      <div key={r.code} className="flex items-center gap-2 px-3 py-2 text-[11.5px]">{row}</div>
                    ) : (
                      <button key={r.code} type="button" onClick={() => set({ dealer: r.code })} className="w-full text-left flex items-center gap-2 px-3 py-2 text-[11.5px] hover:bg-slate-50">{row}</button>
                    );
                  })}
                </div>
                {!f.dealer && opt && <p className="text-[10px] text-slate-400 mt-1 px-1">แตะร้านเพื่อดูแยกรายพนักงาน</p>}
              </section>
            )}

            {s.funnel.requested === 0 && <p className="text-center text-[12px] text-slate-400 py-6">ยังไม่มีคำขอในช่วงนี้</p>}
            <p className="text-[10px] text-slate-400 text-center">สถานะ: {Object.entries(s.status).map(([k, n]) => `${STATUS_META[k as BoqStatus]?.label ?? k} ${n}`).join(" · ") || "-"}</p>
          </div>
        )}
      </div>
    </>
  );
}
