"use client";

/* =============================================================
   ติดตามกลุ่ม Line ลูกค้า — /app/line-groups (?p=YYYY-MM)
   งาน ROOF SERVICE (LHS/Rudy) ร้าน HE + SCG Home · นับต่อลูกค้า (ลูกค้า 1 คน = 1 กลุ่ม Line)
   ① ภาพรวมเดือน + ราย Coach (Admin / หัวหน้า Area / Area)
   ② รายชื่อลูกค้า (กด Coach ; Coach เข้าหน้านี้ทันที) — ค้นหา / กรองสถานะ / จัดกลุ่มตามร้าน
   ③ รายละเอียดลูกค้า (กดลูกค้า) — กลุ่ม Line + งานทั้งหมด + โทรพนักงานขาย / คัดลอกเลขงาน
   ============================================================= */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { useHomeHref, useSession } from "@/lib/commission/session";
import { monthLabel, shiftPeriod, shortDate } from "@/lib/commission/eval-tracking-store";
import {
  fetchLineTracking,
  LINE_STATUS,
  LINE_STATUS_ORDER,
  lineTrackingCsv,
  type LineCoach,
  type LineCounts,
  type LineCustomer,
  type LineStatus,
  type LineTracking,
} from "@/lib/commission/line-groups-store";
import { cn } from "@/lib/utils";

const baht = (v: number | null) => (v === null ? "-" : `฿${Math.round(v).toLocaleString("th-TH")}`);
const pct = (c: LineCounts) => (c.customers ? Math.round((c.register / c.customers) * 100) : 0);

export function LineGroupsScreen() {
  const { session, ready } = useSession();
  const sp = useSearchParams();
  const homeHref = useHomeHref();
  const [period, setPeriod] = useState<string | null>(() => (/^\d{4}-\d{2}$/.test(sp.get("p") ?? "") ? sp.get("p") : null));
  const [data, setData] = useState<{ key: string; t: LineTracking | null; error: string | null } | null>(null);
  const [coach, setCoach] = useState<string | null>(null); // repCode | "none" | null(=ภาพรวม)
  const [filter, setFilter] = useState<LineStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<LineCustomer | null>(null);
  const key = period ?? "";

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchLineTracking(period ?? undefined).then((r) => {
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

  const t = data?.t ?? null;
  const isCoachUser = !!t && (t.me.role === "coach" || t.me.role === "re");
  // Coach เห็นรายชื่อลูกค้าของตัวเองทันที
  const listMode = isCoachUser || coach !== null;
  const scoped = useMemo(() => {
    if (!t) return [];
    return isCoachUser || coach === null || coach === "__all__" ? t.customers : t.customers.filter((c) => (c.coachRep ?? "none") === coach);
  }, [t, coach, isCoachUser]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter(
      (c) =>
        (filter === "all" || c.status === filter) &&
        (!q || c.name.toLowerCase().includes(q) || c.dealerName.toLowerCase().includes(q) || c.dealerCode.includes(q) || c.jobs.some((j) => j.project.toLowerCase().includes(q) || (j.opps ?? "").toLowerCase().includes(q)))
    );
  }, [scoped, filter, query]);
  const byStore = useMemo(() => {
    const m = new Map<string, LineCustomer[]>();
    shown.forEach((c) => m.set(c.dealerCode, [...(m.get(c.dealerCode) ?? []), c]));
    return [...m.values()];
  }, [shown]);

  if (!ready || !session) return null;
  if (!session.isAdmin && !session.isArea) return <p className="mt-10 text-center text-sm text-slate-500">หน้านี้สำหรับ Coach / Area / Admin</p>;

  const loading = !data || data.key !== key;
  // เลื่อนได้ถึงเดือนล่าสุดที่มีข้อมูล หรือเดือนปัจจุบัน (ที่เซิร์ฟเวอร์ให้ตอนเปิดครั้งแรก) แล้วแต่อันไหนหลังกว่า
  const lastData = t?.months[t.months.length - 1] ?? "";
  const thisMonth = [lastData, t?.period ?? "", period ?? ""].sort().pop() ?? "";
  const current = period ?? t?.period ?? "";
  const minMonth = t?.months[0] ?? current;
  const coachObj = t && coach !== null ? t.coaches.find((c) => (c.repCode ?? "none") === coach) ?? null : null;
  const counts: LineCounts | null = !t ? null : listMode && coachObj ? coachObj : listMode ? countsOf(scoped) : t.totals;

  function download() {
    if (!t) return;
    const blob = new Blob([lineTrackingCsv(t, listMode ? shown : t.customers)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `กลุ่มLine_${current}${coachObj ? `_${coachObj.nickname ?? coachObj.name}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5 min-w-0">
          {listMode && !isCoachUser ? (
            <button type="button" aria-label="กลับภาพรวม" onClick={() => { setCoach(null); setFilter("all"); setQuery(""); }} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition shrink-0">
              <Icon name="arrow_back" className="text-xl" />
            </button>
          ) : (
            <Link href={homeHref} aria-label="กลับ" className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition shrink-0">
              <Icon name="arrow_back" className="text-xl" />
            </Link>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[15px] text-[#231313] leading-tight truncate">
              {coachObj ? `Coach ${coachObj.nickname ?? coachObj.name}` : coach === "__all__" ? "ลูกค้าทั้งหมด" : "ติดตามกลุ่ม Line ลูกค้า"}
            </span>
            <span className="text-[11px] font-semibold text-[#b21e1e] truncate">งาน Roof Service · HE + SCG Home</span>
          </div>
        </div>
        <button type="button" onClick={download} disabled={!t || loading} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 text-[11.5px] font-bold text-blue-700 px-3 py-1.5 disabled:opacity-40 shrink-0">
          <Icon name="download" style={{ fontSize: 16 }} />
          Excel
        </button>
      </header>

      <div className="space-y-3 pb-24">
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-2 py-1.5">
          <button type="button" aria-label="เดือนก่อน" disabled={!current || current <= minMonth} onClick={() => setPeriod(shiftPeriod(current, -1))} className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-30">
            <Icon name="chevron_left" />
          </button>
          <span className="text-[14px] font-bold text-slate-900">{current ? monthLabel(current, true) : "…"}</span>
          <button type="button" aria-label="เดือนถัดไป" disabled={!current || current >= thisMonth} onClick={() => setPeriod(shiftPeriod(current, 1))} className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-30">
            <Icon name="chevron_right" />
          </button>
        </div>

        {data?.error ? (
          <p className="text-[13px] text-[#a11119] bg-red-50 border border-red-200 rounded-xl p-4">{data.error}</p>
        ) : loading || !t || !counts ? (
          <div className="py-12 text-center">
            <Icon name="progress_activity" className="animate-spin text-3xl text-slate-300" />
          </div>
        ) : (
          <>
            <Hero c={counts} jobs={listMode ? scoped.reduce((a, c) => a + c.jobs.length, 0) : t.totals.jobs} sourceDate={t.sourceDate} filter={filter} onFilter={listMode ? setFilter : undefined} />

            {!listMode ? (
              <>
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-[13px] font-bold text-[#231313]">แยกตาม Coach</h2>
                  <span className="text-[10.5px] text-slate-500">ลงทะเบียนน้อยสุดก่อน</span>
                </div>
                {t.coaches.length === 0 && <p className="text-[12px] text-slate-400 text-center py-6">ไม่มีงานในเดือนนี้</p>}
                {t.coaches.map((c) => (
                  <CoachRow key={c.repCode ?? "none"} c={c} onClick={() => setCoach(c.repCode ?? "none")} />
                ))}
                <Legend />
                <button type="button" onClick={() => setCoach("__all__")} className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-[12.5px] font-bold text-slate-700">
                  ดูรายชื่อลูกค้าทั้งหมด ({t.totals.customers})
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นชื่อลูกค้า / เลขงาน / ร้าน" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-[#d32029]" />
                </div>
                {byStore.length === 0 && <p className="text-[12px] text-slate-400 text-center py-6">ไม่พบลูกค้า</p>}
                {byStore.map((list) => (
                  <section key={list[0].dealerCode} className="space-y-1.5">
                    <h3 className="text-[12px] font-bold text-[#8f1114] px-1">
                      {list[0].dealerName} <span className="font-normal text-slate-400">({list.length} ลูกค้า)</span>
                    </h3>
                    {list.map((c) => (
                      <CustomerRow key={c.id} c={c} onClick={() => setOpen(c)} />
                    ))}
                  </section>
                ))}
                <p className="text-[10.5px] text-slate-400 text-center">เรียง: ไม่ Add Bot → ยังไม่ลงทะเบียน → ไม่มีข้อมูล → ลงทะเบียนแล้ว</p>
              </>
            )}

            <p className="text-[10.5px] text-slate-400 text-center px-4">
              ลูกค้า 1 คน = 1 กลุ่ม Line (รวมงานด้วยรหัสบ้านใน CRM หรือ ร้าน + ชื่อลูกค้า) · เดือน = เดือนเปิดงานแรกของลูกค้า · เลขใบเสนอราคา (Q…) ยังจับคู่ไม่ได้
            </p>
          </>
        )}
      </div>

      {open && <CustomerSheet c={open} onClose={() => setOpen(null)} />}
      <BottomNav active={session.isArea ? "areaHome" : "home"} />
    </>
  );
}

function countsOf(list: { status: LineStatus }[]): LineCounts {
  return {
    customers: list.length,
    register: list.filter((c) => c.status === "register").length,
    not_register: list.filter((c) => c.status === "not_register").length,
    no_bot: list.filter((c) => c.status === "no_bot").length,
    none: list.filter((c) => c.status === "none").length,
  };
}

function Hero({ c, jobs, sourceDate, filter, onFilter }: { c: LineCounts; jobs: number; sourceDate: string | null; filter: LineStatus | "all"; onFilter?: (f: LineStatus | "all") => void }) {
  const p = pct(c);
  const chips: [LineStatus | "all", string, number][] = [
    ["all", "ทั้งหมด", c.customers],
    ["no_bot", LINE_STATUS.no_bot.short, c.no_bot],
    ["not_register", LINE_STATUS.not_register.short, c.not_register],
    ["none", LINE_STATUS.none.short, c.none],
    ["register", LINE_STATUS.register.short, c.register],
  ];
  return (
    <section className="rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-4" aria-label="สรุปเดือน">
      <p className="text-[11.5px] text-emerald-200">ลูกค้าที่ลงทะเบียนกลุ่ม Line แล้ว</p>
      <div className="flex items-end justify-between">
        <p className="tnum text-[30px] font-bold leading-tight">
          {c.register}
          <span className="text-[16px] text-emerald-200"> / {c.customers} ลูกค้า</span>
        </p>
        <p className="tnum text-[22px] font-bold">{p}%</p>
      </div>
      <div className="mt-2 h-2.5 rounded-full bg-white/20 overflow-hidden">
        <div className="h-full bg-white rounded-full" style={{ width: `${p}%` }} />
      </div>
      <p className="mt-1.5 text-[10.5px] text-emerald-100">จาก {jobs} งาน · ลูกค้า 1 คน = 1 กลุ่ม Line</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10.5px] font-bold">
        {chips
          .filter(([k]) => k !== "all" || onFilter)
          .map(([k, label, n]) =>
            onFilter ? (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => onFilter(k)} className={cn("rounded-full px-2.5 py-1 border", filter === k ? "bg-white text-emerald-900 border-white" : "bg-white/10 text-white border-white/20")}>
                {label} {n}
              </button>
            ) : k === "register" ? null : (
              <span key={k} className={cn("rounded-full px-2.5 py-1", k === "no_bot" ? "bg-red-100 text-[#991b1b]" : k === "not_register" ? "bg-amber-100 text-amber-900" : "bg-white/15")}>
                {label} {n}
              </span>
            )
          )}
      </div>
      {sourceDate && <p className="mt-2 text-[10px] text-emerald-200">ข้อมูลกลุ่ม Line ล่าสุด: {shortDate(sourceDate)} {Number(sourceDate.slice(0, 4)) + 543}</p>}
    </section>
  );
}

function Bar({ c }: { c: LineCounts }) {
  const seg = (n: number, cls: string, k: string) => (n ? <span key={k} className={cn("block h-full", cls)} style={{ width: `${(n / Math.max(1, c.customers)) * 100}%` }} /> : null);
  return (
    <span className="mt-2 flex h-2 rounded-full bg-slate-100 overflow-hidden">
      {seg(c.register, LINE_STATUS.register.bar, "r")}
      {seg(c.not_register, LINE_STATUS.not_register.bar, "n")}
      {seg(c.no_bot, LINE_STATUS.no_bot.bar, "b")}
      {seg(c.none, LINE_STATUS.none.bar, "x")}
    </span>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10.5px] text-slate-500">
      {(["register", "not_register", "no_bot", "none"] as LineStatus[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className={cn("w-2.5 h-2.5 rounded-sm", LINE_STATUS[s].bar)} />
          {LINE_STATUS[s].short}
        </span>
      ))}
    </p>
  );
}

function CoachRow({ c, onClick }: { c: LineCoach; onClick: () => void }) {
  const p = pct(c);
  return (
    <button type="button" onClick={onClick} className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-3 hover:-translate-y-0.5 transition-all">
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-slate-900 truncate">{c.nickname ? `${c.nickname} (${c.name.split(" ")[0]})` : c.name}</span>
          <span className="block text-[10.5px] text-slate-500">
            {c.stores} ร้าน · {c.customers} ลูกค้า{c.no_bot ? ` · ไม่ Add Bot ${c.no_bot}` : ""}{c.not_register ? ` · ยังไม่ลงทะเบียน ${c.not_register}` : ""}
          </span>
        </span>
        <span className={cn("tnum text-[15px] font-bold shrink-0", p >= 50 ? "text-emerald-600" : "text-amber-600")}>{p}%</span>
        <Icon name="chevron_right" className="text-slate-300 shrink-0" />
      </span>
      <Bar c={c} />
    </button>
  );
}

function StatusChip({ s }: { s: LineStatus }) {
  return <span className={cn("shrink-0 text-[10px] font-bold border rounded-full px-2 py-0.5", LINE_STATUS[s].chip)}>{LINE_STATUS[s].label}</span>;
}

function CustomerRow({ c, onClick }: { c: LineCustomer; onClick: () => void }) {
  const sub = c.status === "register" || c.status === "not_register" ? (c.groupName ? `กลุ่ม: ${c.groupName}` : "มีกลุ่ม Line") : c.status === "no_bot" ? "ยังไม่ Add Bot เข้ากลุ่ม" : "ไม่อยู่ในข้อมูลกลุ่ม Line";
  return (
    <button type="button" onClick={onClick} className={cn("w-full text-left bg-white rounded-2xl border shadow-sm px-3 py-2.5 hover:-translate-y-0.5 transition-all", c.status === "no_bot" ? "border-red-200" : "border-slate-100")}>
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 block text-[13px] font-bold text-slate-900 truncate">{c.name}</span>
        <StatusChip s={c.status} />
      </span>
      <span className="block text-[10.5px] text-slate-500 mt-0.5 truncate">
        {c.salesName ? `พนักงานขาย: ${c.salesName}` : "ไม่ระบุพนักงานขาย"} · {c.jobs[0]?.h5 ?? "-"}
      </span>
      <span className="flex items-center gap-2 mt-0.5">
        <span className="min-w-0 flex-1 block text-[10.5px] text-slate-600 truncate">{sub}</span>
        <span className="shrink-0 text-[11px] font-bold text-blue-700">{c.jobs.length} งาน ›</span>
      </span>
    </button>
  );
}

function CustomerSheet({ c, onClose }: { c: LineCustomer; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }
  const next =
    c.status === "not_register"
      ? `ให้ลงทะเบียนกลุ่มด้วยเลขงาน ${c.jobs[0]?.project ?? ""}`
      : c.status === "no_bot"
        ? "ให้เปิดกลุ่ม Line และ Add Bot แล้วลงทะเบียนด้วยเลขงาน"
        : c.status === "none"
          ? "ยังไม่พบในข้อมูลกลุ่ม Line — ตรวจสอบกับทีมขายว่าเปิดกลุ่มแล้วหรือยัง"
          : null;
  const kv = (k: string, v: string | null) => (
    <div className="flex gap-3 text-[12px]">
      <span className="w-24 shrink-0 text-slate-500">{k}</span>
      <span className="min-w-0 flex-1 font-semibold text-slate-900">{v || "-"}</span>
    </div>
  );
  const box = c.status === "register" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : c.status === "none" ? "bg-slate-50 border-slate-200 text-slate-700" : c.status === "no_bot" ? "bg-red-50 border-red-200 text-[#991b1b]" : "bg-amber-50 border-amber-200 text-amber-900";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="cust-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-xl">
        <div className="sticky top-0 bg-white/95 backdrop-blur px-4 pt-3 pb-2 border-b border-slate-100">
          <div className="mx-auto w-10 h-1.5 rounded-full bg-slate-200 mb-2" />
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="cust-title" className="text-[16px] font-bold text-slate-900">{c.name}</h2>
              <div className="mt-1">
                <StatusChip s={c.status} />
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="ปิด" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <Icon name="close" style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            {kv("ร้าน", `${c.dealerName}${c.model ? ` (${c.model === "Housing Expert" ? "HE" : c.model})` : ""}`)}
            {kv("พนักงานขาย", c.salesName)}
            {kv("Coach / Area", [c.coachName, c.areaName].filter(Boolean).join(" / "))}
            {kv("ประเภทลูกค้า", c.type)}
            {kv("จังหวัด", c.province)}
          </div>

          <div className={cn("rounded-2xl border p-3 space-y-1", box)}>
            <p className="text-[12.5px] font-bold flex items-center gap-1">
              <Icon name="forum" style={{ fontSize: 16 }} />
              กลุ่ม Line
            </p>
            {c.groupName && <p className="text-[12px] font-semibold break-words">{c.groupName}</p>}
            <p className="text-[11px]">
              {LINE_STATUS[c.status].label}
              {c.groupCreated ? ` · สร้างกลุ่ม ${shortDate(c.groupCreated)}` : ""}
            </p>
            {next && <p className="text-[11px] font-bold">→ {next}</p>}
            {c.source && <p className="text-[10px] opacity-70">แหล่ง: {c.source}</p>}
          </div>

          <h3 className="text-[13px] font-bold text-slate-900">
            งานของลูกค้านี้ ({c.jobs.length} งาน{c.jobs.length > 1 ? " · ใช้กลุ่มเดียวกัน" : ""})
          </h3>
          <div className="space-y-1.5">
            {c.jobs.map((j) => (
              <button key={j.project} type="button" onClick={() => copy(j.project)} className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-[12.5px] font-bold text-blue-700">{j.project}</span>
                  <StatusChip s={j.status} />
                </span>
                <span className="block text-[10.5px] text-slate-600 mt-0.5">
                  CRM: {j.opps ?? "—"} · {j.h5 ?? "-"}
                </span>
                <span className="block text-[10.5px] text-slate-600">
                  เปิดงาน {shortDate(j.orderDate)} · ยอด {baht(j.amount)}
                  {j.sales && j.sales !== c.salesName ? ` · ${j.sales}` : ""}
                </span>
                <span className="block text-[9.5px] text-slate-400 mt-0.5">{copied === j.project ? "คัดลอกแล้ว ✓" : "แตะเพื่อคัดลอกเลขงาน"}</span>
              </button>
            ))}
          </div>
          {c.jobs.length > 1 && <p className="text-[10.5px] text-slate-500">งานที่ &ldquo;ไม่มีข้อมูล&rdquo; ใช้สถานะของงานอื่นของลูกค้าคนเดียวกัน (รวมด้วยรหัสบ้านใน CRM หรือ ร้าน + ชื่อลูกค้า)</p>}

          <div className="grid grid-cols-2 gap-2 pt-1">
            {c.salesPhone ? (
              <a href={`tel:${c.salesPhone.replace(/[^0-9+]/g, "")}`} className="py-2.5 rounded-xl border border-slate-200 text-[12.5px] font-bold text-slate-700 flex items-center justify-center gap-1">
                <Icon name="call" style={{ fontSize: 16 }} />
                โทรพนักงานขาย
              </a>
            ) : (
              <span className="py-2.5 rounded-xl border border-slate-100 text-[12px] text-slate-400 flex items-center justify-center">ไม่มีเบอร์พนักงานขาย</span>
            )}
            <button type="button" onClick={() => copy(c.jobs.map((j) => j.project).join(", "))} className="py-2.5 rounded-xl bg-[#d32029] text-white text-[12.5px] font-bold flex items-center justify-center gap-1">
              <Icon name="content_copy" style={{ fontSize: 16 }} />
              {copied && copied.includes(",") ? "คัดลอกแล้ว" : c.jobs.length > 1 ? "คัดลอกเลขงานทั้งหมด" : "คัดลอกเลขงาน"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
