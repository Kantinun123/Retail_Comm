"use client";

/* =============================================================
   ติดตามการตรวจประเมินร้าน — /app/eval-tracking (?p=YYYY-MM)
   - ภาพรวมเดือน: ตรวจแล้ว / ขาด / ซ้ำ / ตรวจแทน
   - แยกตาม Coach (ค้างมากสุดก่อน) -> กดดูรายร้าน
   - ร้านตรวจซ้ำ: นับครั้งล่าสุด ; Admin เลือกครั้งที่นับได้
   - Admin: ส่งเตือน Coach ทันที (แจ้งเตือนบนมือถือ)
   ============================================================= */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { useHomeHref, useSession } from "@/lib/commission/session";
import {
  chronicText,
  EVAL_FORM_URL,
  fetchTracking,
  monthLabel,
  pctText,
  remindCoachNow,
  setCountedSubmission,
  setStoreEvalRequired,
  shiftPeriod,
  shortDate,
  type TrackCoach,
  type TrackStore,
  type Tracking,
} from "@/lib/commission/eval-tracking-store";
import { cn } from "@/lib/utils";

export function EvalTrackingScreen() {
  const { session, ready } = useSession();
  const sp = useSearchParams();
  const homeHref = useHomeHref();
  const [period, setPeriod] = useState<string | null>(() => (/^\d{4}-\d{2}$/.test(sp.get("p") ?? "") ? sp.get("p") : null));
  const [data, setData] = useState<{ key: string; t: Tracking | null; error: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [chronicOnly, setChronicOnly] = useState(false);
  const key = `${period ?? ""}|${reload}`;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchTracking(period ?? undefined).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setData({ key, t: r, error: null });
        if (!period) setPeriod(r.period);
      } else setData({ key, t: null, error: r.status === 401 ? "ต้องเข้าสู่ระบบด้วยบัญชีจริงจึงจะใช้งานได้" : r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, period, key]);

  if (!ready || !session) return null;
  if (!session.isAdmin && !session.isArea) return <p className="mt-10 text-center text-sm text-slate-500">หน้านี้สำหรับ Coach / Area / Admin</p>;

  const t = data?.t ?? null;
  const loading = !data || data.key !== key;
  const isAdmin = session.isAdmin;
  const isCoach = t ? t.me.role === "coach" || t.me.role === "re" : false;
  // เดือนปัจจุบันตามเซิร์ฟเวอร์ (เวลาไทย) — ห้ามเลื่อนไปเดือนอนาคต
  const thisMonth = t?.today.slice(0, 7) ?? period ?? "";
  const current = period ?? t?.period ?? thisMonth;
  // กรองเฉพาะร้านที่ขาดติดกัน (มีผลเมื่อเดือนนั้นมีร้านแบบนี้)
  const filterOn = chronicOnly && (t?.totals.chronic ?? 0) > 0;
  // เดือนที่ดูยังไม่จบ -> ยังไม่นับเดือนนี้เป็นเดือนที่ "ขาด"
  const inProgress = !!t && t.period === thisMonth;
  const coachOpen = (c: TrackCoach) => isCoach || filterOn || open === (c.repCode ?? "none");
  const coaches = !t ? [] : filterOn ? t.coaches.filter((c) => c.chronic > 0).map((c) => ({ ...c, stores: c.stores.filter((s) => s.chronic) })) : t.coaches;

  async function pickCounted(s: TrackStore, submissionId: string) {
    setBusy(submissionId);
    const r = await setCountedSubmission(submissionId);
    setBusy(null);
    if (r.ok) {
      setMsg({ type: "ok", text: `ใช้ผลตรวจครั้งที่เลือกเป็นคะแนนของ ${s.name} แล้ว` });
      setReload((n) => n + 1);
    } else setMsg({ type: "err", text: r.error });
  }

  async function toggleRequired(s: TrackStore, required: boolean, reason?: string) {
    setBusy(`req:${s.code}`);
    const r = await setStoreEvalRequired(s.code, required, reason);
    setBusy(null);
    if (r.ok) {
      setMsg({ type: "ok", text: required ? `เปิดการตรวจ ${s.name} แล้ว (มีผลตั้งแต่ ${monthLabel(r.period)})` : `ปิดการตรวจ ${s.name} แล้ว (มีผลตั้งแต่ ${monthLabel(r.period)} · เดือนก่อนหน้ายังนับตามเดิม)` });
      setReload((n) => n + 1);
    } else setMsg({ type: "err", text: r.error });
  }

  async function remind(c: TrackCoach) {
    if (!c.repCode) return;
    setBusy(c.repCode);
    const r = await remindCoachNow(c.repCode);
    setBusy(null);
    setMsg(r.ok ? { type: "ok", text: `ส่งเตือน ${c.nickname || c.name} แล้ว (${r.sent} อุปกรณ์)` } : { type: "err", text: r.error });
  }

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link href={homeHref} aria-label="กลับ" className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <div className="flex flex-col">
            <span className="font-bold text-[15px] text-[#231313] leading-tight">ติดตามการตรวจร้าน</span>
            <span className="text-[11px] font-semibold text-[#b21e1e]">{isCoach ? "ร้านที่ฉันรับผิดชอบ" : "ครบ / ขาด / ซ้ำ ราย Coach"}</span>
          </div>
        </div>
        <a href={EVAL_FORM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-blue-600 text-white text-[11.5px] font-bold px-3 py-1.5">
          <Icon name="edit_note" style={{ fontSize: 16 }} />
          แบบฟอร์ม
        </a>
      </header>

      <div className="space-y-3 pb-24">
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-2 py-1.5">
          <button type="button" aria-label="เดือนก่อน" onClick={() => setPeriod(shiftPeriod(current, -1))} className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600">
            <Icon name="chevron_left" />
          </button>
          <span className="text-[14px] font-bold text-slate-900">{monthLabel(current, true)}</span>
          <button
            type="button"
            aria-label="เดือนถัดไป"
            disabled={current >= thisMonth}
            onClick={() => setPeriod(shiftPeriod(current, 1))}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-30"
          >
            <Icon name="chevron_right" />
          </button>
        </div>

        {msg && (
          <p className={cn("text-[12px] rounded-lg px-3 py-2 border", msg.type === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-[#a11119] border-red-200")} role="status">
            {msg.text}
          </p>
        )}

        {data?.error ? (
          <p className="text-[13px] text-[#a11119] bg-red-50 border border-red-200 rounded-xl p-4">{data.error}</p>
        ) : loading || !t ? (
          <div className="py-12 text-center">
            <Icon name="progress_activity" className="animate-spin text-3xl text-slate-300" />
          </div>
        ) : (
          <>
            <section className="rounded-2xl bg-gradient-to-br from-blue-800 to-blue-950 text-white p-4" aria-label="สรุปเดือน">
              <p className="text-[11.5px] text-blue-200">ตรวจแล้ว{isCoach ? "" : "ทั้งหมด"}</p>
              <p className="tnum text-[30px] font-bold leading-tight">
                {t.totals.done}
                <span className="text-[16px] text-blue-200"> / {t.totals.stores} ร้าน</span>
              </p>
              <div className="mt-2 h-2.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${Math.round((t.totals.done / Math.max(1, t.totals.stores)) * 100)}%` }} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10.5px] font-bold">
                <span className="rounded-full bg-amber-100 text-amber-900 px-2.5 py-1">ขาด {t.totals.missing} ร้าน</span>
                {t.totals.duplicates > 0 && <span className="rounded-full bg-red-100 text-[#a11119] px-2.5 py-1">ซ้ำ {t.totals.duplicates} ร้าน</span>}
                {t.totals.proxies > 0 && <span className="rounded-full bg-indigo-100 text-indigo-800 px-2.5 py-1">ตรวจแทน {t.totals.proxies}</span>}
                {t.totals.chronic > 0 && (
                  <button
                    type="button"
                    aria-pressed={filterOn}
                    onClick={() => setChronicOnly((v) => !v)}
                    className={cn("rounded-full px-2.5 py-1 inline-flex items-center gap-0.5 border", filterOn ? "bg-white text-[#a11119] border-white" : "bg-red-600 text-white border-red-400")}
                  >
                    <Icon name="error" style={{ fontSize: 12 }} />
                    {inProgress ? "ค้างจากเดือนก่อน" : `ขาดติดกัน ≥${t.chronicMonths} เดือน`} {t.totals.chronic} ร้าน
                  </button>
                )}
                {t.totals.exempt > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1">ไม่ต้องตรวจ {t.totals.exempt} ร้าน</span>}
                {t.daysLeft > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1">เหลือ {t.daysLeft} วัน</span>}
              </div>
            </section>

            {filterOn && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[11.5px] text-[#a11119]" role="status">
                <span>
                  {inProgress
                    ? "แสดงเฉพาะร้านที่เดือนก่อนก็ไม่ได้ตรวจ และเดือนนี้ยังไม่ตรวจ (รวมร้านที่ยังไม่เคยตรวจ)"
                    : `แสดงเฉพาะร้านที่ไม่ได้ตรวจติดกันตั้งแต่ ${t.chronicMonths} เดือน หรือยังไม่เคยตรวจ`}
                </span>
                <button type="button" onClick={() => setChronicOnly(false)} className="shrink-0 rounded-full bg-white border border-red-200 px-2 py-0.5 font-bold">
                  ดูทั้งหมด
                </button>
              </div>
            )}

            {!isCoach && (
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-[13px] font-bold text-[#231313]">แยกตาม Coach</h2>
                <span className="text-[10.5px] text-slate-500">ค้างมากสุดก่อน</span>
              </div>
            )}

            {coaches.map((c) => {
              const k = c.repCode ?? "none";
              // ทุกร้านปิดการตรวจ (total 0) = ไม่มีงานค้าง
              const pct = c.total ? Math.round((c.done / c.total) * 100) : 100;
              const reqStores = c.stores.filter((s) => s.required);
              const exemptStores = c.stores.filter((s) => !s.required);
              const isOpen = coachOpen(c);
              const tone = pct === 100 ? "bg-emerald-500" : pct === 0 ? "bg-red-400" : "bg-amber-500";
              return (
                <article key={k} className={cn("bg-white rounded-2xl border shadow-sm", pct === 100 ? "border-emerald-100" : pct === 0 ? "border-red-200" : "border-amber-200")}>
                  <button type="button" onClick={() => !isCoach && setOpen(isOpen ? null : k)} aria-expanded={isOpen} className="w-full flex items-center gap-3 p-3 text-left">
                    {c.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 text-[12px] font-bold flex items-center justify-center shrink-0" aria-hidden>
                        {(c.nickname || c.name).replace(/\s+/g, "").slice(0, 2)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-slate-900 truncate">{c.nickname ? `${c.name} (${c.nickname})` : c.name}</span>
                      <span className="block text-[11px] text-slate-500">
                        {c.done} / {c.total} ร้าน
                        {c.exempt > 0 ? ` · ไม่ต้องตรวจ ${c.exempt}` : ""}
                        {c.done === 0 && c.lastEvalPeriod ? ` · ส่งล่าสุด ${monthLabel(c.lastEvalPeriod)}` : ""}
                        {c.chronic > 0 && <span className="font-bold text-[#a11119]"> · {inProgress ? "ค้างจากเดือนก่อน" : "ขาดติดกัน"} {c.chronic} ร้าน</span>}
                        {c.duplicates > 0 ? ` · ซ้ำ ${c.duplicates}` : ""}
                        {c.proxies > 0 ? ` · ตรวจแทน ${c.proxies}` : ""}
                      </span>
                      <span className="mt-1.5 block h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.max(pct, 2)}%` }} />
                      </span>
                    </span>
                    <span className={cn("tnum text-[14px] font-bold shrink-0", pct === 100 ? "text-emerald-600" : pct === 0 ? "text-[#a11119]" : "text-amber-600")}>{pct}%</span>
                    {!isCoach && <Icon name={isOpen ? "expand_less" : "expand_more"} className="text-slate-400 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {!isCoach && (c.phone || (isAdmin && c.repCode && c.done < c.total)) && (
                        <div className="grid grid-cols-2 gap-1.5 pb-1">
                          {c.phone ? (
                            <a href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`} className="py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-700 flex items-center justify-center gap-1">
                              <Icon name="call" style={{ fontSize: 15 }} />
                              โทรหา Coach
                            </a>
                          ) : (
                            <span />
                          )}
                          {isAdmin && c.repCode && c.done < c.total && (
                            <button type="button" disabled={busy === c.repCode} onClick={() => remind(c)} className="py-2 rounded-xl bg-blue-600 text-white text-[12px] font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                              <Icon name="notifications_active" style={{ fontSize: 15 }} />
                              ส่งเตือนตอนนี้
                            </button>
                          )}
                        </div>
                      )}
                      {reqStores.map((s) => (
                        <StoreRow key={s.code} s={s} inProgress={inProgress} isAdmin={isAdmin} isCoach={isCoach} busy={busy} canToggle={isAdmin && inProgress} onToggle={(v, why) => toggleRequired(s, v, why)} onPick={(sid) => pickCounted(s, sid)} />
                      ))}
                      {exemptStores.length > 0 && (
                        <>
                          <p className="pt-1.5 px-0.5 text-[11px] font-bold text-slate-500">ไม่ต้องตรวจ ({exemptStores.length}) · ไม่นับในตัวเลข</p>
                          {exemptStores.map((s) => (
                            <StoreRow key={s.code} s={s} inProgress={inProgress} isAdmin={isAdmin} isCoach={isCoach} busy={busy} canToggle={isAdmin && inProgress} onToggle={(v, why) => toggleRequired(s, v, why)} onPick={(sid) => pickCounted(s, sid)} />
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}

            <p className="text-[10.5px] text-slate-400 text-center px-4">
              ข้อมูลจากแบบฟอร์ม JotForm → Google Sheet → แอป ทุก 1 ชั่วโมง (08:00–19:00) · ร้านที่ต้องตรวจ = ร้านที่เปิดใช้งาน · ตรวจซ้ำนับครั้งล่าสุด
            </p>
          </>
        )}
      </div>
      <BottomNav active="member" />
    </>
  );
}

function StoreRow({
  s,
  inProgress,
  isAdmin,
  isCoach,
  busy,
  canToggle,
  onToggle,
  onPick,
}: {
  s: TrackStore;
  inProgress: boolean;
  isAdmin: boolean;
  isCoach: boolean;
  busy: string | null;
  /** Admin + เดือนปัจจุบัน: เปิด/ปิดการตรวจของร้าน */
  canToggle: boolean;
  onToggle: (required: boolean, reason?: string) => void;
  onPick: (sid: string) => void;
}) {
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState("");
  const counted = s.submissions[0];
  const chronic = chronicText(s, inProgress);
  const badge = !s.required
    ? { t: "ไม่ต้องตรวจ", c: "bg-slate-100 text-slate-500 border-slate-200", i: "do_not_disturb_on" }
    : chronic
    ? { t: chronic, c: "bg-red-600 text-white border-red-600", i: "error" }
    : s.status === "missing"
      ? { t: "ยังไม่ตรวจ", c: "bg-amber-50 text-amber-800 border-amber-200", i: "hourglass_top" }
      : s.duplicate
        ? { t: `ตรวจซ้ำ ${s.submissions.length} ครั้ง`, c: "bg-red-50 text-[#a11119] border-red-200", i: "warning" }
        : s.proxy
          ? { t: "ตรวจแทน", c: "bg-indigo-50 text-indigo-700 border-indigo-200", i: "warning" }
          : { t: "ตรวจแล้ว", c: "bg-emerald-50 text-emerald-700 border-emerald-200", i: "check_circle" };
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", !s.required ? "bg-slate-50 border-slate-200 opacity-80" : s.chronic ? "bg-red-50/60 border-red-300" : s.status === "missing" ? "bg-amber-50/50 border-amber-200" : s.duplicate ? "border-red-200" : "border-slate-100 bg-slate-50/50")}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-slate-900 truncate">{s.name}</span>
          <span className="block text-[10.5px] text-slate-500">
            {s.code}
            {counted ? ` · ${shortDate(counted.evalDate)} · ${pctText(counted.pct)}` : ""}
            {s.proxy && counted?.inspector ? ` · ผู้ตรวจ: ${counted.inspector}` : ""}
            {s.required && s.status === "missing" && s.lastEvalPeriod ? ` · ตรวจล่าสุด ${monthLabel(s.lastEvalPeriod)}` : ""}
            {!s.required && s.exemptSince ? ` · ปิดตั้งแต่ ${monthLabel(s.exemptSince)}` : ""}
            {!s.required && s.exemptReason ? ` · ${s.exemptReason}` : ""}
          </span>
        </span>
        <span className={cn("shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold border rounded-full px-2 py-0.5", badge.c)}>
          <Icon name={badge.i} style={{ fontSize: 12 }} />
          {badge.t}
        </span>
        {s.required && s.status === "missing" && isCoach && (
          <a href={EVAL_FORM_URL} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-blue-600 text-white text-[11px] font-bold px-2.5 py-1">
            ทำแบบประเมิน
          </a>
        )}
      </div>
      {canToggle && !askReason && (
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            disabled={busy === `req:${s.code}`}
            onClick={() => (s.required ? setAskReason(true) : onToggle(true))}
            className="text-[10.5px] font-bold text-slate-500 hover:text-[#a11119] inline-flex items-center gap-0.5 disabled:opacity-50"
          >
            <Icon name={s.required ? "toggle_off" : "toggle_on"} style={{ fontSize: 15 }} />
            {s.required ? "ปิดการตรวจร้านนี้" : "เปิดการตรวจอีกครั้ง"}
          </button>
        </div>
      )}
      {canToggle && askReason && (
        <div className="mt-2 rounded-lg bg-white border border-slate-200 p-2 space-y-1.5">
          <p className="text-[11px] text-slate-600">ปิดการตรวจตั้งแต่เดือนนี้ · เดือนก่อนหน้ายังนับตามเดิม</p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="เหตุผล (ไม่บังคับ) เช่น ร้านปรับปรุง"
            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[#d32029]"
          />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => { setAskReason(false); setReason(""); }} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={busy === `req:${s.code}`}
              onClick={() => { onToggle(false, reason); setAskReason(false); setReason(""); }}
              className="rounded-full bg-[#d32029] text-white px-2.5 py-1 text-[11px] font-bold disabled:opacity-50"
            >
              ยืนยันปิดการตรวจ
            </button>
          </div>
        </div>
      )}
      {s.duplicate && (
        <ul className="mt-2 space-y-1">
          {s.submissions.map((x) => (
            <li key={x.submissionId} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]", x.counted ? "bg-emerald-50 text-emerald-800" : "bg-white text-slate-500")}>
              <span className="flex-1 min-w-0 truncate">
                {shortDate(x.evalDate)} · {pctText(x.pct)} · {x.inspector ?? "-"}
              </span>
              {x.counted ? (
                <span className="shrink-0 font-bold">ใช้ครั้งนี้</span>
              ) : (
                isAdmin && (
                  <button type="button" disabled={busy === x.submissionId} onClick={() => onPick(x.submissionId)} className="shrink-0 rounded-full border border-slate-300 bg-white px-2 py-0.5 font-bold text-slate-700 disabled:opacity-50">
                    ใช้ครั้งนี้แทน
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
