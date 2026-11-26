"use client";
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { NOW, baht, dayKey, dateTh, type Job } from "./crm-mock-data";
import { jobPhase } from "./crm-overview";
import { Avatar, glass, grad } from "./crm-ui";
import type { Ctx } from "./crm-views";

/* ---------- กติกาและตัวเลขตัวอย่าง (เดโม ยังไม่ใช่กติกาจริง) ---------- */
const MONTH_TARGET = 1_200_000;
const COMM_RATE = 0.02; // ค่าคอมมิชชัน 2% ของยอดปิดขาย
const POINT_PER = 1000; // 1 แต้มต่อทุก ฿1,000
const PAID_AFTER_DAYS = 14; // ปิดขายเกิน 14 วัน = จ่ายแล้ว
const TIERS = [{ pct: 100, bonus: 5000 }, { pct: 80, bonus: 2500 }];
const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/* ยอดย้อนหลัง ม.ค.-ต.ค. (ตัวอย่าง) */
const HISTORY = [880_000, 1_020_000, 760_000, 1_310_000, 1_150_000, 940_000, 1_280_000, 1_090_000, 1_240_000, 1_170_000];
const LEVEL = { now: "Standard (S)", next: "Advance (A)", doneJobs: 9, needJobs: 12, ytdNeed: 12_000_000 };

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
function workdays(y: number, m: number, upTo?: number) {
  const last = upTo ?? new Date(y, m + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) { const w = new Date(y, m, d).getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
const bonusOf = (p: number) => TIERS.find((t) => p >= t.pct)?.bonus ?? 0;

function closedThisMonth(jobs: Job[]) {
  const ym = dayKey(NOW.toISOString()).slice(0, 7);
  return jobs.filter((j) => !j.cancelReason && j.done.close && dayKey(j.done.close).slice(0, 7) === ym);
}
const daysSince = (iso: string) => Math.floor((NOW.getTime() - new Date(iso).getTime()) / 86400e3);

export function PerformanceView({ c }: { c: Ctx }) {
  const [tab, setTab] = useState<"month" | "year">("month");
  const y = NOW.getFullYear();
  const m = NOW.getMonth();
  const closed = closedThisMonth(c.jobs);
  const monthActual = closed.reduce((s, j) => s + j.value, 0);
  const histSum = HISTORY.reduce((s, v) => s + v, 0);
  const target = tab === "month" ? MONTH_TARGET : MONTH_TARGET * (m + 1);
  const actual = tab === "month" ? monthActual : histSum + monthActual;
  const p = pct(actual, target);
  const wdAll = workdays(y, m);
  const wdDone = workdays(y, m, NOW.getDate());
  const expected = Math.round(MONTH_TARGET * (wdDone / wdAll));
  const ahead = monthActual - expected;
  const left = Math.max(0, MONTH_TARGET - monthActual);
  const wdLeft = wdAll - wdDone;

  /* ผลประโยชน์ */
  const paidJobs = closed.filter((j) => daysSince(j.done.close!) >= PAID_AFTER_DAYS);
  const pendJobs = closed.filter((j) => daysSince(j.done.close!) < PAID_AFTER_DAYS);
  const commPaid = Math.round(paidJobs.reduce((s, j) => s + j.value, 0) * COMM_RATE);
  const commPend = Math.round(pendJobs.reduce((s, j) => s + j.value, 0) * COMM_RATE);
  const pipeline = c.jobs.filter((j) => !j.cancelReason && !j.done.close && (jobPhase(j) === 5 || jobPhase(j) === 6) && j.value > 0).sort((a, b) => b.value - a.value);
  const pipeSum = pipeline.reduce((s, j) => s + j.value, 0);
  const commExpect = Math.round(pipeSum * COMM_RATE);
  const pMonth = pct(monthActual, MONTH_TARGET);
  const pIf = pct(monthActual + pipeSum, MONTH_TARGET);
  const bonusNow = bonusOf(pMonth);
  const bonusIf = bonusOf(pIf);
  const nextTier = [...TIERS].reverse().find((t) => pMonth < t.pct);
  const points = Math.floor(monthActual / POINT_PER);
  const totalGot = commPaid + commPend + bonusNow;

  const bars = [...HISTORY.slice(-5), monthActual];
  const labels = [...MONTHS_TH.slice(Math.max(0, m - 5), m), MONTHS_TH[m]];
  const maxBar = Math.max(MONTH_TARGET, ...bars) * 1.05;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">ผลงานของฉัน</h1>
          <p className="text-[12.5px] text-slate-500">ยอดขายเทียบเป้า และผลประโยชน์ที่ได้รับ · ตัวเลขเป้าและกติกาเป็นตัวอย่างเพื่อทดลองใช้งาน</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-[12px] font-bold">
          {([["month", `${MONTHS_TH[m]} ${y + 543}`], ["year", `สะสมปี ${y + 543}`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("rounded-lg px-3 py-1.5 transition", tab === k ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-indigo-600")}>{l}</button>
          ))}
        </div>
      </div>

      {/* ยอดขายเทียบเป้า */}
      <div className={cn("rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/20", grad)}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold text-white/80">ยอดขายที่ปิดแล้ว {tab === "month" ? "เดือนนี้" : "ตั้งแต่ต้นปี"}</p>
            <p className="text-[34px] font-bold leading-tight tracking-tight">{baht(actual)}</p>
            <p className="text-[12.5px] text-white/85">เป้า {baht(target)} · {tab === "month" ? `${closed.length} งานที่ปิดขาย` : `ถึงสิ้น ${MONTHS_TH[m]}`}</p>
          </div>
          <div className="text-right">
            <p className="text-[40px] font-bold leading-none">{p}%</p>
            <p className="text-[12px] text-white/80">ของเป้า</p>
          </div>
        </div>
        <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, p)}%` }} />
          {tab === "month" && <span className="absolute top-0 h-3 w-0.5 bg-amber-300" style={{ left: `${Math.min(100, pct(expected, MONTH_TARGET))}%` }} title="จังหวะที่ควรเป็นวันนี้" />}
        </div>
        {tab === "month" ? (
          <div className="mt-3 grid gap-2 text-[12px] sm:grid-cols-3">
            <div className="rounded-xl bg-white/15 px-3 py-2">จังหวะวันนี้ที่ควรได้ <b>{baht(expected)}</b></div>
            <div className="rounded-xl bg-white/15 px-3 py-2">{ahead >= 0 ? "นำอยู่" : "ตามอยู่"} <b>{baht(Math.abs(ahead))}</b></div>
            <div className="rounded-xl bg-white/15 px-3 py-2">เหลืออีก <b>{baht(left)}</b> ใน {wdLeft} วันทำการ{left > 0 && wdLeft > 0 ? ` (วันละ ${baht(Math.ceil(left / wdLeft))})` : ""}</div>
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-white/85">เป้าสะสมนับ {baht(MONTH_TARGET)} ต่อเดือน × {m + 1} เดือน</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ผลประโยชน์ */}
        <div className="space-y-3">
          <div className={cn(glass, "p-4")}>
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-slate-900">ผลประโยชน์เดือนนี้</h3>
              <span className="text-[18px] font-bold text-emerald-600">{baht(totalGot)}</span>
            </div>
            <p className="text-[11px] text-slate-400">ค่าคอมมิชชัน {COMM_RATE * 100}% ของยอดปิดขาย + โบนัสตามเปอร์เซ็นต์ถึงเป้า (ตัวอย่าง)</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-2.5"><p className="text-[10.5px] font-semibold text-emerald-700">จ่ายแล้ว</p><p className="text-[15px] font-bold text-emerald-700">{baht(commPaid)}</p></div>
              <div className="rounded-xl bg-amber-50 p-2.5"><p className="text-[10.5px] font-semibold text-amber-700">รอจ่าย</p><p className="text-[15px] font-bold text-amber-700">{baht(commPend)}</p></div>
              <div className="rounded-xl bg-indigo-50 p-2.5"><p className="text-[10.5px] font-semibold text-indigo-700">โบนัสถึงเป้า</p><p className="text-[15px] font-bold text-indigo-700">{baht(bonusNow)}</p></div>
            </div>
            {nextTier && <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">ถึง <b>{nextTier.pct}%</b> ของเป้า จะได้โบนัส <b>{baht(nextTier.bonus)}</b> · ต้องมียอดอีก <b>{baht(Math.max(0, Math.ceil((MONTH_TARGET * nextTier.pct) / 100) - monthActual))}</b></p>}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-700"><Icon name="stars" className="!text-[18px]" />แต้มสะสมเดือนนี้</span>
              <b className="text-[15px] text-violet-700">{points.toLocaleString("en-US")} แต้ม</b>
            </div>
          </div>

          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 text-[13px] font-bold text-slate-900">งานที่ปิดขายเดือนนี้</h3>
            <ul className="space-y-1.5">
              {closed.map((j) => {
                const paid = daysSince(j.done.close!) >= PAID_AFTER_DAYS;
                return (
                  <li key={j.id}>
                    <button onClick={() => c.openJob(j.id)} className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left text-[12px] hover:bg-indigo-50">
                      <Avatar name={j.customer} size={24} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{j.customer}<span className="ml-1 font-normal text-slate-400">ปิด {dateTh(j.done.close)}</span></span>
                      <span className="shrink-0 font-bold text-slate-700">{baht(j.value)}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold", paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{paid ? "จ่ายแล้ว" : "รอจ่าย"}</span>
                    </button>
                  </li>
                );
              })}
              {!closed.length && <li className="py-4 text-center text-[12px] text-slate-400">ยังไม่มีงานที่ปิดขายเดือนนี้</li>}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          {/* งานที่ช่วยให้ถึงเป้า */}
          <div className={cn(glass, "p-4")}>
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-slate-900">งานที่ช่วยให้ถึงเป้า</h3>
              <span className="text-[11px] text-slate-400">เสนอราคาหลังสำรวจ / รอปิดขาย</span>
            </div>
            <div className="mt-2 rounded-xl bg-indigo-50 p-3 text-[12px] text-indigo-900">
              ถ้าปิด {pipeline.length} งานนี้ได้ครบ ยอดเดือนนี้จะเป็น <b>{baht(monthActual + pipeSum)}</b> (<b>{pIf}%</b> ของเป้า)
              {" "}และจะได้ค่าคอมเพิ่ม <b>{baht(commExpect)}</b>{bonusIf > bonusNow ? <>, โบนัสเพิ่ม <b>{baht(bonusIf - bonusNow)}</b></> : null}
            </div>
            <ul className="mt-2 space-y-1.5">
              {pipeline.map((j) => (
                <li key={j.id}>
                  <button onClick={() => c.openJob(j.id)} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-[12px] hover:border-indigo-300">
                    <Avatar name={j.customer} size={24} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{j.customer}<span className="ml-1 font-normal text-slate-400">{jobPhase(j) === 6 ? "รอปิดขาย" : "เสนอราคาหลังสำรวจ"}</span></span>
                    <span className="shrink-0 font-bold text-slate-700">{baht(j.value)}</span>
                    <Icon name="chevron_right" className="text-slate-300" />
                  </button>
                </li>
              ))}
              {!pipeline.length && <li className="py-4 text-center text-[12px] text-slate-400">ยังไม่มีงานในช่วงนี้</li>}
            </ul>
          </div>

          {/* กราฟ 6 เดือน */}
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-3 text-[13px] font-bold text-slate-900">ยอดขาย 6 เดือนล่าสุด</h3>
            <div className="relative h-36 pt-5">
              <div className="relative flex h-full items-end gap-2">
                <span className="absolute left-0 right-0 border-t border-dashed border-amber-400" style={{ bottom: `${(MONTH_TARGET / maxBar) * 100}%` }} />
                {bars.map((v, i) => (
                  <div key={i} className="relative flex h-full flex-1 items-end">
                    <div className={cn("relative w-full rounded-t-lg", i === bars.length - 1 ? "bg-indigo-600" : v >= MONTH_TARGET ? "bg-emerald-400" : "bg-slate-300")} style={{ height: `${(v / maxBar) * 100}%` }}>
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-slate-500">{(v / 1e6).toFixed(2)}M</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-1 flex gap-2">{labels.map((l) => <span key={l} className="flex-1 text-center text-[10.5px] text-slate-500">{l}</span>)}</div>            <p className="mt-2 text-[10.5px] text-slate-400">เส้นประ = เป้า {baht(MONTH_TARGET)} · เขียว = ถึงเป้า · เทา = ไม่ถึงเป้า · น้ำเงิน = เดือนนี้</p>
          </div>

          {/* ระดับ */}
          <div className={cn(glass, "p-4")}>
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-slate-900">ระดับของฉัน</h3>
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">{LEVEL.now}</span>
            </div>
            <p className="mt-1 text-[12px] text-slate-600">ขึ้นเป็น <b>{LEVEL.next}</b> เมื่อปิดขายได้ {LEVEL.needJobs} งานในปีนี้ (ตอนนี้ {LEVEL.doneJobs} งาน)</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${pct(LEVEL.doneJobs, LEVEL.needJobs)}%` }} /></div>
            <p className="mt-1 text-[11px] text-slate-400">เหลืออีก {LEVEL.needJobs - LEVEL.doneJobs} งาน</p>
          </div>
        </div>
      </div>
    </div>
  );
}
