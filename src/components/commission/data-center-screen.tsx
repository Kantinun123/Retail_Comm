"use client";

/* =============================================================
   ศูนย์ข้อมูล (admin) — 2 แท็บ
   - รายวัน (อัตโนมัติ): สถานะ sync แต่ละแหล่งจาก sync_runs + ข้อมูลล่าสุด + แถบ 14 วัน
   - รายเดือน (อัปโหลด): ตารางความครบ แหล่ง × เดือน + รายละเอียดช่อง + ประวัติอัปโหลด
   ช่อง "ขาด" = เดือนที่จบไปแล้วและเลยวันที่ 15 ของเดือนถัดไปยังไม่มีข้อมูล
   ============================================================= */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { YearChips } from "./year-filter";
import { useHomeHref, useSession } from "@/lib/commission/session";
import {
  DAILY_JOBS,
  MONTHLY_SOURCES,
  fetchDataCenter,
  shortSummary,
  type DcDaily,
  type DcMonthly,
  type DcSummary,
} from "@/lib/commission/data-center-store";
import { BaUploadModal } from "./data-center-upload";
import { cn } from "@/lib/utils";

const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const monthFull = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_MONTH[m - 1]} ${y + 543}`; };
const pad = (n: number) => String(n).padStart(2, "0");
const periodOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const prevPeriod = (p: string) => { const [y, m] = p.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
const baht = (v: number) => "฿" + Math.round(v).toLocaleString("th-TH");
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-";
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-");

type Tone = "green" | "amber" | "red" | "grey";
const TONE: Record<Tone, { dot: string; card: string; text: string }> = {
  green: { dot: "bg-emerald-500", card: "border-slate-100", text: "text-emerald-700" },
  amber: { dot: "bg-amber-500", card: "border-amber-200 bg-amber-50/40", text: "text-amber-700" },
  red: { dot: "bg-rose-500", card: "border-rose-200 bg-rose-50/40", text: "text-rose-700" },
  grey: { dot: "bg-slate-300", card: "border-dashed border-slate-300", text: "text-slate-500" },
};

/** สถานะของแหล่งรายวัน */
function jobState(d: DcDaily | undefined, group: "gsheet" | "sharepoint", nowMs: number): { tone: Tone; text: string } {
  if (!d || !d.lastRun) return { tone: "grey", text: "ยังไม่เคย sync" };
  if (d.lastRun.status === "guard") return { tone: "amber", text: "หยุดเอง: ข้อมูลต้นทางลดลงผิดปกติ — ตรวจไฟล์/ชีตต้นทาง" };
  if (d.lastRun.status === "failed") return { tone: "red", text: `ผิดพลาด: ${shortSummary(d.lastRun.summary) ?? "-"}` };
  const okAt = d.lastOk?.finishedAt ? new Date(d.lastOk.finishedAt).getTime() : 0;
  if (!okAt || nowMs - okAt > 26 * 3600 * 1000) {
    return group === "gsheet"
      ? { tone: "red", text: "ไม่ได้ sync เกิน 1 วัน (เครื่องปิด/ไม่ได้ล็อกอิน?)" }
      : { tone: "amber", text: "ไม่มีไฟล์ใหม่เกิน 1 วัน (ต้นทางไม่อัปเดต หรือเครื่องปิด)" };
  }
  return { tone: "green", text: "ปกติ" };
}

/** รอบถัดไปของแต่ละกลุ่ม (ตามที่ลงทะเบียนใน Task Scheduler) */
function nextRun(group: "gsheet" | "sharepoint", now: Date): string {
  const mins = now.getHours() * 60 + now.getMinutes();
  const slots = group === "gsheet" ? Array.from({ length: 12 }, (_, i) => (8 + i) * 60) : [9 * 60 + 30, 12 * 60, 16 * 60];
  const next = slots.find((s) => s > mins);
  const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  return next != null ? fmt(next) : `พรุ่งนี้ ${fmt(slots[0])}`;
}

/* ---------------- แท็บรายวัน ---------------- */
function DailyTab({ data }: { data: DcSummary }) {
  const now = useMemo(() => new Date(data.now), [data.now]);
  const nowMs = now.getTime();
  const byJob = new Map(data.daily.map((d) => [d.job, d]));
  const states = DAILY_JOBS.map((j) => ({ j, d: byJob.get(j.job), st: jobState(byJob.get(j.job), j.group, nowMs) }));
  const okCount = states.filter((x) => x.st.tone === "green").length;
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(nowMs - (13 - i) * 86400000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [open, setOpen] = useState<string | null>(null);

  const group = (g: "gsheet" | "sharepoint", title: string) => (
    <section>
      <h3 className="text-[12.5px] font-bold text-[#8f1114] mb-2 px-0.5">{title}</h3>
      <div className="space-y-2">
        {states.filter((x) => x.j.group === g).map(({ j, d, st }, idx) => {
          const tone = TONE[st.tone];
          const dayMap = new Map((d?.days ?? []).map((x) => [x.d, x.status]));
          const isOpen = open === j.job;
          return (
            <div key={j.job} className={cn("rounded-2xl border bg-white shadow-sm animate-fade-up", tone.card, `stagger-${Math.min(idx + 1, 4)}`)}>
              <button type="button" onClick={() => setOpen(isOpen ? null : j.job)} aria-expanded={isOpen} className="w-full text-left p-3.5">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", tone.dot)} aria-hidden="true" />
                  <span className="flex-1 min-w-0 text-[13.5px] font-bold text-slate-900 truncate">{j.label}</span>
                  <span className="text-[10.5px] text-slate-500 shrink-0">sync {hhmm(d?.lastOk?.finishedAt ?? null)}</span>
                  <Icon name={isOpen ? "expand_less" : "expand_more"} className="text-slate-300" style={{ fontSize: 18 }} />
                </div>
                <p className={cn("text-[11px] mt-1 pl-4.5", st.tone === "green" ? "text-slate-600" : tone.text)} style={{ paddingLeft: 18 }}>
                  {st.tone === "green" ? shortSummary(d?.lastOk?.summary ?? null) ?? "ปกติ" : st.text}
                </p>
                <p className="text-[10.5px] text-slate-400 mt-0.5" style={{ paddingLeft: 18 }}>
                  {j.group === "sharepoint" && d?.lastOk?.fileMtime && <>ไฟล์อัปเดต {fmtTime(d.lastOk.fileMtime)} · </>}
                  ข้อมูลถึง {fmtDate(d?.dataDate ?? null)} · รวม {(d?.total ?? 0).toLocaleString("th-TH")} {j.unit}
                </p>
                <div className="flex gap-[3px] mt-2" style={{ paddingLeft: 18 }} aria-label="สถานะ 14 วันย้อนหลัง">
                  {days.map((day) => {
                    const s = dayMap.get(day);
                    return (
                      <span
                        key={day}
                        title={`${day}: ${s ?? "ไม่มีรอบ"}`}
                        className={cn(
                          "h-2.5 flex-1 max-w-[18px] rounded-sm",
                          s === "ok" ? "bg-emerald-400" : s === "guard" ? "bg-amber-400" : s === "failed" ? "bg-rose-400" : s === "skipped" ? "bg-slate-300" : "bg-slate-100"
                        )}
                      />
                    );
                  })}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 px-3.5 py-2.5 text-[11px] text-slate-600 space-y-1">
                  <p>รอบล่าสุด: {fmtTime(d?.lastRun?.startedAt ?? null)} · สถานะ <b>{d?.lastRun?.status ?? "-"}</b></p>
                  {d?.lastRun?.summary && <p className="text-slate-500 break-words">{d.lastRun.summary}</p>}
                  {d?.lastOk && d.lastOk.finishedAt !== d.lastRun?.finishedAt && <p>สำเร็จล่าสุด: {fmtTime(d.lastOk.finishedAt)}</p>}
                  <Link href={j.href} className="inline-flex items-center gap-0.5 font-bold text-[#c3161c] mt-1">
                    เปิดหน้ารายงาน <Icon name="chevron_right" style={{ fontSize: 15 }} />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-[12px] text-red-100/90">สถานะ ณ {fmtTime(data.now)}</p>
          <p className="text-[26px] font-bold leading-tight mt-1">
            {okCount} / {DAILY_JOBS.length} แหล่งปกติ
          </p>
          <p className="text-[11px] text-red-100/90 mt-1">
            รอบถัดไป: Google Sheet {nextRun("gsheet", now)} · SharePoint {nextRun("sharepoint", now)}
          </p>
          <span className="inline-block mt-2 rounded-full bg-white/15 px-2.5 py-0.5 text-[10.5px]">+ แต้มกิจกรรม ยังไม่เชื่อมต่อ</span>
        </div>
      </section>

      {group("gsheet", "Google Sheet · ทุก 1 ชม. 08:00–19:00")}
      {group("sharepoint", "ไฟล์ SharePoint · 09:30 / 12:00 / 16:00 (เฉพาะไฟล์ที่เปลี่ยน)")}

      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-3.5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" aria-hidden="true" />
        <span className="flex-1 text-[13px] font-bold text-slate-500">แต้มกิจกรรม</span>
        <span className="text-[11px] text-slate-400">รอยืนยันแหล่งข้อมูล</span>
      </section>

      <div className="rounded-xl bg-white border border-slate-100 px-3 py-2.5 text-[10.5px] text-slate-500 leading-relaxed">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />sync สำเร็จ</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />หยุดเอง (ข้อมูลลด)</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />ผิดพลาด</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-200" />ไม่มีรอบ/ไฟล์ไม่เปลี่ยน</span>
        </p>
        <p className="mt-1">sync รันบนเครื่องที่ตั้ง Task Scheduler — ต้องเปิดเครื่องและล็อกอินไว้ ; กดการ์ดเพื่อดูผลรอบล่าสุด</p>
      </div>
    </div>
  );
}

/* ---------------- แท็บรายเดือน ---------------- */
type CellState = "ok" | "waiting" | "missing" | "before" | "future";
const CELL: Record<CellState, string> = {
  ok: "bg-emerald-500 hover:bg-emerald-600",
  waiting: "bg-amber-200 border border-amber-500",
  missing: "bg-rose-200 border border-rose-500",
  before: "bg-slate-50 border border-dashed border-slate-300",
  future: "bg-slate-100",
};
const CELL_LABEL: Record<CellState, string> = { ok: "มีข้อมูล", waiting: "รอไฟล์เดือนล่าสุด", missing: "ขาด (เลยกำหนด)", before: "ก่อนเริ่มระบบ", future: "ยังไม่ถึงกำหนด" };

function cellState(p: string, has: boolean, firstPeriod: string | null, now: Date): CellState {
  if (has) return "ok";
  const cur = periodOf(now);
  if (p >= cur) return "future";
  if (firstPeriod && p < firstPeriod) return "before";
  if (p === prevPeriod(cur) && now.getDate() <= 15) return "waiting";
  return "missing";
}

function MonthlyTab({ data, onUpload }: { data: DcSummary; onUpload: (source: string, period: string) => void }) {
  const now = useMemo(() => new Date(data.now), [data.now]);
  const curYear = String(now.getFullYear());
  const years = useMemo(() => {
    const ys = new Set<string>([curYear, ...data.monthly.map((m) => m.period.slice(0, 4))]);
    return [...ys].sort((a, b) => b.localeCompare(a));
  }, [data.monthly, curYear]);
  const [year, setYear] = useState<string>(curYear);
  const [sel, setSel] = useState<{ source: string; period: string } | null>(null);
  const byKey = new Map(data.monthly.map((m) => [`${m.source}|${m.period}`, m]));
  const first = new Map<string, string>();
  data.monthly.forEach((m) => {
    const f = first.get(m.source);
    if (!f || m.period < f) first.set(m.source, m.period);
  });
  const periods = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
  const selRow: DcMonthly | undefined = sel ? byKey.get(`${sel.source}|${sel.period}`) : undefined;
  const selMeta = sel ? MONTHLY_SOURCES.find((s) => s.source === sel.source) : undefined;
  const selPrev = sel ? byKey.get(`${sel.source}|${prevPeriod(sel.period)}`) : undefined;
  const selState = sel ? cellState(sel.period, !!selRow, first.get(sel.source) ?? null, now) : null;
  const selUploads = sel ? data.uploads.filter((u) => u.source === sel.source && u.period === sel.period) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <YearChips years={years} activeYear={year} onSelect={(y) => { if (y) { setYear(y); setSel(null); } }} />
        <button
          type="button"
          onClick={() => onUpload("ba-commission", prevPeriod(periodOf(now)))}
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#d32029] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm shadow-[#d32029]/25 hover:-translate-y-0.5 active:scale-95 transition-all"
        >
          <Icon name="upload" style={{ fontSize: 16 }} />
          อัปโหลดไฟล์
        </button>
      </div>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 overflow-x-auto">
        <h3 className="text-[13.5px] font-bold text-slate-900 mb-2.5">ความครบของข้อมูล · {Number(year) + 543}</h3>
        <table className="w-full border-separate" style={{ borderSpacing: "3px" }}>
          <thead>
            <tr>
              <th className="text-left text-[10px] font-semibold text-slate-400 w-[118px]" scope="col">แหล่ง</th>
              {periods.map((p) => (
                <th key={p} scope="col" className="text-[9.5px] font-semibold text-slate-500 text-center">{TH_SHORT[Number(p.slice(5)) - 1]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MONTHLY_SOURCES.map((s) => (
              <tr key={s.source}>
                <th scope="row" className="text-left text-[11px] font-semibold text-slate-800 pr-1 truncate max-w-[118px]">{s.label}</th>
                {periods.map((p) => {
                  const has = byKey.has(`${s.source}|${p}`);
                  const st = cellState(p, has, first.get(s.source) ?? null, now);
                  const active = sel?.source === s.source && sel.period === p;
                  return (
                    <td key={p} className="p-0">
                      <button
                        type="button"
                        onClick={() => setSel({ source: s.source, period: p })}
                        aria-label={`${s.label} ${monthFull(p)}: ${CELL_LABEL[st]}`}
                        aria-pressed={active}
                        className={cn("block w-full aspect-square min-w-[16px] rounded-[4px] transition", CELL[st], active && "ring-2 ring-offset-1 ring-[#d32029]")}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row" className="text-left text-[11px] font-semibold text-slate-400 pr-1">แต้มกิจกรรม</th>
              <td colSpan={12} className="text-center text-[10.5px] text-slate-400">ยังไม่เชื่อมต่อ</td>
            </tr>
          </tbody>
        </table>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[10px] text-slate-500">
          {(["ok", "waiting", "missing", "before"] as CellState[]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1"><span className={cn("w-3 h-3 rounded-[3px]", CELL[c])} />{CELL_LABEL[c]}</span>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">กดช่องเพื่อดูรายละเอียด · &quot;ขาด&quot; = เลยวันที่ 15 ของเดือนถัดไปแล้วยังไม่มีข้อมูล</p>
      </section>

      {sel && selMeta && (
        <section className={cn("bg-white rounded-2xl border shadow-sm p-4 animate-fade-up", selState === "missing" ? "border-rose-200" : selState === "waiting" ? "border-amber-200" : "border-slate-100")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500">{selMeta.label} · {monthFull(sel.period)}</p>
              {selRow ? (
                <>
                  <p className="tnum text-[18px] font-bold text-slate-900 leading-tight mt-0.5">{baht(selRow.amount)}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selRow.rows.toLocaleString("th-TH")} รายการ · {selRow.stores} ร้าน
                    {selPrev && selPrev.amount ? (
                      <span className={cn("ml-1 font-semibold", selRow.amount >= selPrev.amount ? "text-emerald-600" : "text-rose-600")}>
                        {selRow.amount >= selPrev.amount ? "▲" : "▼"} {Math.abs(((selRow.amount - selPrev.amount) / selPrev.amount) * 100).toFixed(1)}% จากเดือนก่อน
                      </span>
                    ) : null}
                  </p>
                </>
              ) : (
                <p className={cn("text-[15px] font-bold mt-0.5", selState === "missing" ? "text-rose-700" : selState === "waiting" ? "text-amber-700" : "text-slate-500")}>
                  {CELL_LABEL[selState!]}
                </p>
              )}
            </div>
            <button type="button" onClick={() => setSel(null)} aria-label="ปิด" className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <Icon name="close" style={{ fontSize: 16 }} />
            </button>
          </div>
          {selRow && (
            <div className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-600 space-y-1">
              <p className="flex items-center gap-1"><Icon name="description" style={{ fontSize: 14 }} className="text-slate-400" />มาจาก {selRow.files.toLocaleString("th-TH")} ไฟล์</p>
              <p className="flex items-center gap-1"><Icon name="schedule" style={{ fontSize: 14 }} className="text-slate-400" />นำเข้าล่าสุด {fmtTime(selRow.loadedAt)}</p>
            </div>
          )}
          {selUploads.length > 0 && (
            <p className="text-[10.5px] text-slate-400 mt-1.5">อัปโหลดผ่านหน้านี้ {selUploads.length} ครั้ง · ล่าสุดโดย {selUploads[0].uploadedBy ?? "-"} {fmtTime(selUploads[0].createdAt)}</p>
          )}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {selMeta.uploadable ? (
              <button
                type="button"
                onClick={() => onUpload(sel.source, sel.period)}
                className="rounded-xl bg-[#fee2e2]/70 py-2 text-[12px] font-bold text-[#c3161c] hover:-translate-y-0.5 active:scale-[0.98] transition-all"
              >
                {selRow ? "อัปโหลดแทนที่เดือนนี้" : "อัปโหลดเดือนนี้"}
              </button>
            ) : (
              <span className="rounded-xl bg-slate-50 py-2 text-center text-[11px] font-semibold text-slate-400">อัปโหลดผ่านหน้าเว็บ: เร็ว ๆ นี้</span>
            )}
            <Link href={selMeta.href} className="rounded-xl bg-slate-50 border border-slate-200 py-2 text-center text-[12px] font-bold text-slate-600 hover:-translate-y-0.5 transition-all">
              ดูหน้ารายงาน ›
            </Link>
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[13.5px] font-bold text-slate-900 mb-2">ประวัติการอัปโหลด</h3>
        {data.uploads.length === 0 ? (
          <p className="text-[11.5px] text-slate-400 py-2">ยังไม่มีการอัปโหลดผ่านหน้านี้ (ข้อมูลเดิมนำเข้าด้วยสคริปต์)</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {data.uploads.map((u) => (
              <li key={u.id} className="py-2">
                <div className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="font-bold text-slate-800 truncate">
                    {MONTHLY_SOURCES.find((s) => s.source === u.source)?.label ?? u.source} · {monthFull(u.period)}
                  </span>
                  <span className={cn("shrink-0 font-bold", u.status === "applied" ? "text-emerald-600" : u.status === "failed" ? "text-rose-600" : "text-amber-600")}>
                    {u.status === "applied" ? "บันทึกแล้ว" : u.status === "failed" ? "ผิดพลาด" : "ยกเลิก"}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  {u.fileCount} ไฟล์
                  {u.rowsAfter != null && <> · {u.rowsAfter.toLocaleString("th-TH")} แถว (เดิม {(u.rowsBefore ?? 0).toLocaleString("th-TH")})</>}
                  {u.message && <> · {u.message}</>} · {u.uploadedBy ?? "-"} · {fmtTime(u.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------------- หน้า ---------------- */
export function DataCenterScreen() {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const [state, setState] = useState<{ v: number; data: DcSummary | null; error: string | null; status: number } | null>(null);
  const [version, setVersion] = useState(0);
  const [upload, setUpload] = useState<{ source: string; period: string } | null>(null);
  const isAdmin = !!session?.isAdmin;

  useEffect(() => {
    if (!ready || !isAdmin) return;
    let cancelled = false;
    fetchDataCenter()
      .then((r) => !cancelled && setState(r.ok ? { v: version, data: r.data, error: null, status: 200 } : { v: version, data: null, error: r.error, status: r.status }))
      .catch((e) => !cancelled && setState({ v: version, data: null, error: String(e), status: 0 }));
    return () => {
      cancelled = true;
    };
  }, [ready, isAdmin, version]);

  if (!ready || !session) return null;

  const header = (
    <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
      <div className="flex items-center space-x-2.5">
        <Link href={homeHref} aria-label="กลับ" className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition">
          <Icon name="arrow_back" className="text-xl" />
        </Link>
        <div className="flex flex-col">
          <span className="font-bold text-[16px] text-[#231313] leading-tight">ศูนย์ข้อมูล</span>
          <span className="text-[10.5px] font-semibold text-[#b21e1e]">เฉพาะผู้ดูแลระบบ</span>
        </div>
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setVersion((v) => v + 1)}
          aria-label="โหลดใหม่"
          className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#a11119] active:scale-95 transition"
        >
          <Icon name="refresh" className="text-xl" />
        </button>
      )}
    </header>
  );

  if (!isAdmin) {
    return (
      <>
        {header}
        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
            <Icon name="lock" className="text-3xl" />
          </div>
          <p className="mt-3 text-[15px] font-bold text-slate-900">เฉพาะผู้ดูแลระบบ (Admin)</p>
        </div>
        <BottomNav active="home" />
      </>
    );
  }

  const loading = !state || state.v !== version;
  const data = state?.data ?? null;

  return (
    <>
      {header}
      <div className="space-y-4 pb-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="ประเภทข้อมูล">
          {(["daily", "monthly"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("rounded-lg py-2 text-[12.5px] font-bold transition", tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              {t === "daily" ? "รายวัน (อัตโนมัติ)" : "รายเดือน (อัปโหลด)"}
            </button>
          ))}
        </div>

        {loading && !data ? (
          <div className="py-12 text-center text-slate-300"><Icon name="progress_activity" className="animate-spin text-3xl" /></div>
        ) : !data ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center text-[13px] text-slate-600">
            {state?.status === 401
              ? "ต้องเข้าสู่ระบบด้วยบัญชีแอดมินจริง (โหมดเดโมดูหน้านี้ไม่ได้)"
              : `โหลดข้อมูลไม่สำเร็จ: ${state?.error ?? "-"}`}
          </div>
        ) : tab === "daily" ? (
          <DailyTab data={data} />
        ) : (
          <MonthlyTab data={data} onUpload={(source, period) => setUpload({ source, period })} />
        )}
      </div>

      {upload && (
        <BaUploadModal
          initialPeriod={upload.period}
          onClose={() => setUpload(null)}
          onApplied={() => {
            setUpload(null);
            setVersion((v) => v + 1);
          }}
        />
      )}

      <BottomNav active="home" />
    </>
  );
}
