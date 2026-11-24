"use client";
/* ติดตามการสอบ Competency ของ SE (Admin / หัวหน้า Area / Area / Coach / ร้านค้า ตามขอบเขตร้าน)
   - ทำเสร็จหรือยัง, จำนวนครั้งที่สอบ, จำนวนครั้งที่สอบผ่าน, ผ่านครั้งแรกที่ครั้งที่เท่าไร
   - Admin: เปิดรอบสอบใหม่ (กำหนดเดดไลน์) / ขยายเดดไลน์ / ปิดรอบ + รายการข้อที่ยังใช้ไม่ได้ */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useHomeHref, useSession } from "@/lib/commission/session";
import { createExamRound, dayTh, deadlineText, fetchExamProgress, patchExamRound, type ExamProgress, type ProgressRep } from "@/lib/commission/exam-store";
import { Chips, btn, card, inputCls, labelCls } from "../boq/boq-shared";

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "todo", label: "ยังไม่เสร็จ" },
  { key: "none", label: "ยังไม่เริ่ม" },
  { key: "done", label: "ทำเสร็จแล้ว" },
];

function Tile({ n, label, tone }: { n: number | string; label: string; tone: string }) {
  return (
    <div className={cn("rounded-2xl px-2 py-3 text-center", tone)}>
      <p className="text-[22px] font-bold leading-none">{n}</p>
      <p className="text-[10.5px] mt-1 leading-tight">{label}</p>
    </div>
  );
}

function RepCard({ r, topics, showStore = true }: { r: ProgressRep; topics: ExamProgress["topics"]; showStore?: boolean }) {
  const [open, setOpen] = useState(false);
  const state = r.completed ? { t: "ทำเสร็จแล้ว", c: "bg-emerald-50 text-emerald-700" } : r.started ? { t: `ทำแล้ว ${r.doneCount}/${topics.length}`, c: "bg-amber-50 text-amber-700" } : { t: "ยังไม่ทำ", c: "bg-slate-100 text-slate-600" };
  return (
    <div className={cn(card, "overflow-hidden")}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left p-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-slate-800 truncate">
            {r.name}
            {r.nickname ? ` (${r.nickname})` : ""}
          </p>
          <p className="text-[11px] text-slate-500 truncate">{[showStore ? r.dealerName : "", r.level ? `Level ${r.level}` : ""].filter(Boolean).join(" · ") || "-"}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">สอบ {r.attempts} ครั้ง · สอบผ่าน {r.passes} ครั้ง</p>
        </div>
        <span className={cn("text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0", state.c)}>{state.t}</span>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-slate-400" style={{ fontSize: 20 }} />
      </button>
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {topics.map((t) => {
            const c = r.topics.find((x) => x.topicId === t.id);
            const passed = !!c?.passed;
            return (
              <div key={t.id} className="px-3.5 py-2 flex items-center gap-2 text-[12px]">
                <Icon name={passed ? "check_circle" : c && c.attempts ? "replay" : "radio_button_unchecked"} className={passed ? "text-emerald-500" : c && c.attempts ? "text-rose-400" : "text-slate-300"} style={{ fontSize: 17 }} />
                <span className="flex-1 text-slate-700">{t.title}</span>
                <span className="text-[11px] text-slate-500 text-right">
                  {c && c.attempts ? `สอบ ${c.attempts} · ผ่าน ${c.passes}${c.firstPassNo ? ` (ครั้งที่ ${c.firstPassNo})` : ""} · ${c.bestPercent ?? 0}%` : "ยังไม่ทำ"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StoreGroup({ name, reps, topics, open, onToggle }: { name: string; reps: ProgressRep[]; topics: ExamProgress["topics"]; open: boolean; onToggle: () => void }) {
  const done = reps.filter((r) => r.completed).length;
  const doing = reps.filter((r) => !r.completed && r.started).length;
  const none = reps.length - done - doing;
  const pct = reps.length ? Math.round((done / reps.length) * 100) : 0;
  return (
    <section className={cn(card, "overflow-hidden")}>
      <button type="button" onClick={onToggle} className="w-full text-left p-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-slate-900 truncate">{name}</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-[#d32029]")} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            ทำเสร็จ <b className="text-emerald-700">{done}</b>/{reps.length} คน
            {doing > 0 && <> · กำลังทำ <b className="text-amber-700">{doing}</b></>}
            {none > 0 && <> · ยังไม่เริ่ม <b className="text-slate-700">{none}</b></>}
          </p>
        </div>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-slate-400" style={{ fontSize: 22 }} />
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-2 space-y-2">
          {reps.map((r) => (
            <RepCard key={r.repCode} r={r} topics={topics} showStore={false} />
          ))}
        </div>
      )}
    </section>
  );
}

function csv(p: ExamProgress): string {
  const q = (s: string | number | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const head = ["รหัสพนักงาน", "ชื่อ", "ร้าน", "Level", "สถานะ", "หัวข้อที่ผ่าน", "จำนวนครั้งที่สอบ", "จำนวนครั้งที่สอบผ่าน", ...p.topics.flatMap((t) => [`${t.title} - สถานะ`, `${t.title} - สอบ(ครั้ง)`, `${t.title} - ผ่าน(ครั้ง)`, `${t.title} - ผ่านครั้งแรกที่ครั้งที่`])];
  const rows = p.reps.map((r) => [
    r.repCode,
    r.nickname ? `${r.name} (${r.nickname})` : r.name,
    r.dealerName,
    r.level ?? "",
    r.completed ? "ทำเสร็จแล้ว" : r.started ? "กำลังทำ" : "ยังไม่ทำ",
    `${r.doneCount}/${p.topics.length}`,
    r.attempts,
    r.passes,
    ...p.topics.flatMap((t) => {
      const c = r.topics.find((x) => x.topicId === t.id);
      return [c?.passed ? "ผ่าน" : c && c.attempts ? "ยังไม่ผ่าน" : "ยังไม่ทำ", c?.attempts ?? 0, c?.passes ?? 0, c?.firstPassNo ?? ""];
    }),
  ]);
  return "\uFEFF" + [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
}

function RoundAdmin({ p, onChanged }: { p: ExamProgress; onChanged: () => void }) {
  const round = p.round;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [deadline, setDeadline] = useState("");
  const [pass, setPass] = useState("80");
  const [newDeadline, setNewDeadline] = useState("");

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      setMsg(ok);
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  const info = p.adminInfo?.topics ?? [];
  const bad = info.filter((t) => t.inactive.length > 0);
  return (
    <div className="space-y-3">
      {round && (
        <div className={cn(card, "p-3.5 space-y-2")}>
          <p className="text-[12px] font-bold text-slate-700">จัดการรอบนี้</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className={labelCls}>เปลี่ยนเดดไลน์</label>
              <input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className={cn(inputCls, "w-auto")} />
            </div>
            <button type="button" disabled={busy || !newDeadline} onClick={() => run(() => patchExamRound({ id: round.id, deadlineOn: newDeadline }), "เปลี่ยนเดดไลน์แล้ว")} className={cn(btn, "bg-slate-900 text-white")}>
              บันทึก
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => patchExamRound({ id: round.id, status: round.status === "open" ? "closed" : "open" }), round.status === "open" ? "ปิดรอบแล้ว" : "เปิดรอบอีกครั้งแล้ว")} className={cn(btn, "border border-slate-300 text-slate-700 bg-white")}>
              {round.status === "open" ? "ปิดรอบ" : "เปิดรอบอีกครั้ง"}
            </button>
          </div>
        </div>
      )}
      <div className={cn(card, "p-3.5 space-y-2")}>
        <p className="text-[12px] font-bold text-slate-700">เปิดรอบสอบใหม่ (ทุก SE สอบทุกหัวข้อ)</p>
        <div>
          <label className={labelCls}>ชื่อรอบ</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น Competency Test รอบ ธ.ค. 2569" className={inputCls} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>เริ่ม</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>เดดไลน์</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>ผ่าน (%)</label>
            <input inputMode="numeric" value={pass} onChange={(e) => setPass(e.target.value.replace(/\D/g, ""))} className={inputCls} />
          </div>
        </div>
        <button
          type="button"
          disabled={busy || !title.trim() || !start || !deadline}
          onClick={() => run(() => createExamRound({ title, startsOn: start, deadlineOn: deadline, passPercent: Number(pass) || 80 }), "เปิดรอบสอบแล้ว")}
          className={cn(btn, "w-full bg-[#d32029] text-white")}
        >
          เปิดรอบสอบ
        </button>
        {msg && <p className="text-[12px] text-slate-600">{msg}</p>}
      </div>
      {bad.length > 0 && (
        <div className={cn(card, "p-3.5")}>
          <p className="text-[12px] font-bold text-slate-700">ข้อสอบที่ยังไม่เปิดใช้ (ไม่ถูกนับในการสอบ)</p>
          <p className="text-[11px] text-slate-500 mb-2">แก้ไฟล์ข้อสอบแล้วนำเข้าใหม่ได้ก่อนเริ่มมีคนสอบ</p>
          <div className="space-y-1.5">
            {bad.map((t) => (
              <div key={t.id} className="text-[11.5px]">
                <p className="font-semibold text-slate-700">
                  {t.title} <span className="font-normal text-slate-500">· ใช้ได้ {t.active} ข้อ · ขาด {t.inactive.length} ข้อ</span>
                  {t.active === 0 && <span className="ml-1 text-rose-600 font-bold">(ยังไม่ถูกนับเป็นหัวข้อสอบ)</span>}
                </p>
                <p className="text-slate-500">{[...new Set(t.inactive.map((x) => x.problem ?? "?"))].join(" · ")} (ข้อที่ {t.inactive.map((x) => x.sort).join(", ")})</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ExamProgressScreen() {
  const { session, ready } = useSession();
  const home = useHomeHref();
  const [roundId, setRoundId] = useState<number | null>(null);
  const [data, setData] = useState<ExamProgress | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [reload, setReload] = useState(0);
  const [includeTest, setIncludeTest] = useState(false);
  const [openStores, setOpenStores] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchExamProgress(roundId, includeTest)
      .then((d) => !cancelled && (setData(d), setError("")))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [ready, roundId, reload, includeTest]);

  const reps = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return (data?.reps ?? []).filter((r) => {
      if (filter === "todo" && r.completed) return false;
      if (filter === "none" && r.started) return false;
      if (filter === "done" && !r.completed) return false;
      return !kw || `${r.name} ${r.nickname ?? ""} ${r.dealerName} ${r.repCode}`.toLowerCase().includes(kw);
    });
  }, [data, filter, q]);

  // จัดกลุ่มตามร้าน : ร้านที่ยังเหลือคนไม่เสร็จมากสุดขึ้นก่อน
  const stores = useMemo(() => {
    const m = new Map<string, { code: string; name: string; reps: ProgressRep[] }>();
    for (const r of reps) {
      if (!m.has(r.dealerCode)) m.set(r.dealerCode, { code: r.dealerCode, name: r.dealerName, reps: [] });
      m.get(r.dealerCode)!.reps.push(r);
    }
    const remain = (g: { reps: ProgressRep[] }) => g.reps.filter((r) => !r.completed).length;
    return [...m.values()].sort((a, b) => remain(b) - remain(a) || a.name.localeCompare(b.name, "th"));
  }, [reps]);
  const searching = q.trim() !== "";
  const toggleStore = (code: string) =>
    setOpenStores((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });

  if (!ready || !session) return null;
  const round = data?.round ?? null;
  const s = data?.summary ?? null;

  function download() {
    if (!data) return;
    const blob = new Blob([csv(data)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `competency-test-${round?.id ?? "all"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <header className="flex items-center gap-2 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <Link href={home} className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="กลับ">
          <Icon name="arrow_back" style={{ fontSize: 18 }} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 leading-tight">ติดตามพนักงานขาย (SE)</p>
          <h1 className="font-bold text-[16px] text-[#231313] leading-tight">ความคืบหน้าข้อสอบ Competency</h1>
        </div>
        {data && data.reps.length > 0 && (
          <button type="button" onClick={download} className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="ดาวน์โหลด CSV" title="ดาวน์โหลด CSV">
            <Icon name="download" style={{ fontSize: 18 }} />
          </button>
        )}
      </header>

      <div className="space-y-3 pb-24">
        {error && <p className="rounded-xl bg-rose-50 text-rose-700 text-[12.5px] p-3">{error}</p>}
        {!data && !error && <p className="text-center text-[12px] text-slate-400 py-10">กำลังโหลด…</p>}

        {data && data.rounds.length > 1 && (
          <Chips options={data.rounds.map((r) => ({ key: String(r.id), label: r.title }))} value={String(round?.id ?? "")} onChange={(v) => setRoundId(Number(v))} />
        )}

        {data && !round && <div className={cn(card, "p-5 text-center text-[13px] text-slate-600")}>ยังไม่มีรอบสอบ{data.role === "admin" ? " — เปิดรอบสอบใหม่ด้านล่าง" : ""}</div>}

        {round && s && (
          <>
            <div className={cn(card, "p-3.5")}>
              <div className="flex items-start gap-2">
                <p className="text-[14px] font-bold text-slate-900 flex-1">{round.title}</p>
                <span className={cn("text-[10.5px] font-bold px-2 py-1 rounded-full", round.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{round.status === "open" ? "เปิดอยู่" : "ปิดรอบแล้ว"}</span>
              </div>
              <p className="text-[12px] text-slate-600 mt-1">
                {dayTh(round.startsOn)} – {dayTh(round.deadlineOn)}{" "}
                <span className={cn("font-bold", round.daysLeft < 0 ? "text-rose-600" : round.daysLeft <= 3 ? "text-amber-700" : "text-slate-700")}>· {deadlineText(round.daysLeft)}</span>
              </p>
              <p className="text-[11px] text-slate-500">ต้องผ่านครบ {s.topicCount} หัวข้อ · เกณฑ์ผ่านหัวข้อละ {round.passPercent}%</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Tile n={s.total} label="SE ทั้งหมด" tone="bg-white border border-slate-200 text-slate-800" />
              <Tile n={s.completed} label="ทำเสร็จแล้ว" tone="bg-emerald-50 text-emerald-800" />
              <Tile n={s.inProgress} label="กำลังทำ" tone="bg-amber-50 text-amber-800" />
              <Tile n={s.notStarted} label="ยังไม่เริ่ม" tone="bg-slate-100 text-slate-700" />
            </div>
            <p className="text-[11.5px] text-slate-500 px-1">รวมสอบ {s.totalAttempts} ครั้ง · สอบผ่าน {s.totalPasses} ครั้ง</p>
            {data?.role === "admin" && (
              <Link href="/app/exam/ranking" className="rounded-2xl bg-gradient-to-br from-[#8f1114] to-[#d32029] text-white p-3.5 flex items-center gap-3 shadow-sm active:scale-[0.99] transition">
                <Icon name="emoji_events" className="text-amber-300" fill style={{ fontSize: 26 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold leading-snug">Top Rank สอบครบเร็วที่สุด</p>
                  <p className="text-[10.5px] text-white/80">ดูผู้ที่ผ่านครบทุกหัวข้อและใช้เวลาน้อยที่สุด เพื่อแจกรางวัล</p>
                </div>
                <Icon name="chevron_right" style={{ fontSize: 20 }} />
              </Link>
            )}

            <Chips options={FILTERS} value={filter} onChange={setFilter} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / ร้าน" className={inputCls} />
            <div className="flex items-center justify-between gap-2 text-[11.5px] text-slate-500 px-1">
              <span>{stores.length} ร้าน · {reps.length} คน</span>
              {stores.length > 1 && (
                <button type="button" className="font-semibold text-[#d32029]" onClick={() => setOpenStores(openStores.size ? new Set() : new Set(stores.map((g) => g.code)))}>
                  {openStores.size ? "ย่อทุกร้าน" : "ขยายทุกร้าน"}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {stores.map((g) => (
                <StoreGroup key={g.code} name={g.name} reps={g.reps} topics={data!.topics} open={searching || stores.length === 1 || openStores.has(g.code)} onToggle={() => toggleStore(g.code)} />
              ))}
              {stores.length === 0 && <p className="text-center text-[12px] text-slate-400 py-6">ไม่มีรายการ</p>}
            </div>
            {data?.role === "admin" && (
              <label className="flex items-center gap-2 text-[11.5px] text-slate-500 px-1 pt-1">
                <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} className="accent-[#d32029]" />
                รวมผลสอบของบัญชีทดสอบ (ไว้ลองใช้ ไม่นับในรายงานจริง)
              </label>
            )}
          </>
        )}

        {data?.role === "admin" && <RoundAdmin p={data} onChanged={() => setReload((x) => x + 1)} />}
      </div>
    </>
  );
}
