"use client";
/* Top Rank ข้อสอบ Competency (Admin): พนักงานที่สอบผ่านครบทุกหัวข้อและเสร็จเร็วที่สุด — ไว้ดูเพื่อแจกรางวัลผู้ให้ความร่วมมือ
   เวลาที่ใช้ = จากเริ่มสอบครั้งแรก ถึง เวลาที่ผ่านหัวข้อสุดท้าย (รวมช่วงที่พักไว้ เพราะระบบให้หยุดแล้วกลับมาทำต่อได้) */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import { dayTh, fetchExamRanking, fmtDateTimeTh, fmtDuration, type ExamRanking, type RankingRow } from "@/lib/commission/exam-store";
import { Chips, card } from "../boq/boq-shared";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const PODIUM: Record<number, { h: string; color: string; ring: string }> = {
  1: { h: "h-24", color: "#fbbf24", ring: "ring-amber-300" },
  2: { h: "h-16", color: "#cbd5e1", ring: "ring-slate-300" },
  3: { h: "h-12", color: "#d97706", ring: "ring-orange-300" },
};
const BASIS = [
  { key: "time", label: "ใช้เวลาน้อยที่สุด" },
  { key: "first", label: "ผ่านครบก่อน" },
];

type Ranked = RankingRow & { rank: number };

const person = (r: RankingRow) => (r.nickname ? `${r.name} (${r.nickname})` : r.name);
// ตัวย่อในวงกลม: ข้ามสระหน้า (เ แ โ ใ ไ) แล้วใช้พยัญชนะตัวแรกพร้อมเครื่องหมายที่ติดกัน (ไม่ตัดกลางตัวอักษร)
const initials = (r: RankingRow) => {
  const s = (r.nickname || r.name).replace(/^(นางสาว|นาย|นาง|น\.ส\.)\s*/, "").replace(/^[เแโใไ]+/, "");
  const seg = new Intl.Segmenter("th", { granularity: "grapheme" });
  return [...seg.segment(s)].slice(0, 1).map((x) => x.segment).join("") || "?";
};

function csv(rows: Ranked[], title: string): string {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const head = ["อันดับ", "รหัสพนักงาน", "ชื่อ", "ร้าน", "เริ่มสอบครั้งแรก", "ผ่านครบเมื่อ", "ใช้เวลา", "จำนวนครั้งที่สอบ", "จำนวนครั้งที่สอบผ่าน"];
  const body = rows.map((r) => [r.rank, r.repCode, person(r), r.dealerName, fmtDateTimeTh(r.firstStartAt), fmtDateTimeTh(r.finishedAt), fmtDuration(r.elapsedSec), r.attempts, r.passes]);
  return "\uFEFF" + [[title], head, ...body].map((r) => r.map(q).join(",")).join("\r\n");
}

export function ExamRankingScreen() {
  const { session, ready } = useSession();
  const [roundId, setRoundId] = useState<number | null>(null);
  const [includeTest, setIncludeTest] = useState(false);
  const [basis, setBasis] = useState("time");
  const [data, setData] = useState<ExamRanking | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchExamRanking(roundId, includeTest)
      .then((d) => !cancelled && (setData(d), setError("")))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [ready, roundId, includeTest]);

  const ranked: Ranked[] = useMemo(() => {
    const rows = [...(data?.rows ?? [])];
    rows.sort((a, b) => (basis === "time" ? a.elapsedSec - b.elapsedSec || a.finishedAt.localeCompare(b.finishedAt) : a.finishedAt.localeCompare(b.finishedAt) || a.elapsedSec - b.elapsedSec));
    // เท่ากันเป๊ะ (วินาทีเดียวกัน) = อันดับเดียวกัน
    const key = (r: RankingRow) => (basis === "time" ? r.elapsedSec : r.finishedAt);
    const out: Ranked[] = [];
    rows.forEach((r, i) => out.push({ ...r, rank: i > 0 && key(rows[i - 1]) === key(r) ? out[i - 1].rank : i + 1 }));
    return out;
  }, [data, basis]);

  if (!ready || !session) return null;
  if (!session.isAdmin) return <p className="text-center text-[13px] text-slate-500 py-10">หน้านี้สำหรับผู้ดูแลระบบ</p>;

  const round = data?.round ?? null;
  // โพเดียม: ซ้าย = ที่ 2, กลาง = ที่ 1, ขวา = ที่ 3 (เรียงตามลำดับจริง ไม่ใช่เลขอันดับ เพื่อให้เสมอกันก็ยังครบ 3 คน)
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean) as Ranked[];

  function download() {
    const blob = new Blob([csv(ranked, `${round?.title ?? ""} · อันดับสอบครบเร็วที่สุด (${BASIS.find((b) => b.key === basis)?.label})`)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `competency-ranking-${round?.id ?? "all"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <header className="flex items-center gap-2 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <Link href="/app/exam/progress" className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="กลับ">
          <Icon name="arrow_back" style={{ fontSize: 18 }} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 leading-tight">ข้อสอบ Competency</p>
          <h1 className="font-bold text-[16px] text-[#231313] leading-tight">Top Rank สอบครบเร็วที่สุด</h1>
        </div>
        {ranked.length > 0 && (
          <button type="button" onClick={download} className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="ดาวน์โหลด CSV" title="ดาวน์โหลด CSV">
            <Icon name="download" style={{ fontSize: 18 }} />
          </button>
        )}
      </header>

      <div className="space-y-3 pb-24">
        {error && <p className="rounded-xl bg-rose-50 text-rose-700 text-[12.5px] p-3">{error}</p>}
        {!data && !error && <p className="text-center text-[12px] text-slate-400 py-10">กำลังโหลด…</p>}
        {data && data.rounds.length > 1 && <Chips options={data.rounds.map((r) => ({ key: String(r.id), label: r.title }))} value={String(round?.id ?? "")} onChange={(v) => setRoundId(Number(v))} />}
        {data && !round && <div className={cn(card, "p-5 text-center text-[13px] text-slate-600")}>ยังไม่มีรอบสอบ</div>}

        {round && data && (
          <>
            <div className={cn(card, "p-3.5")}>
              <p className="text-[14px] font-bold text-slate-900">{round.title}</p>
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                {dayTh(round.startsOn)} – {dayTh(round.deadlineOn)} · ต้องผ่านครบ {data.topicCount} หัวข้อ
              </p>
              <p className="text-[12px] text-slate-700 mt-1.5">
                สอบครบแล้ว <b className="text-emerald-700">{data.summary.completed}</b> จาก {data.summary.total} คน
              </p>
              <p className="text-[10.5px] text-slate-400 mt-1">เวลาที่ใช้ = จากเริ่มสอบครั้งแรก ถึง ผ่านหัวข้อสุดท้าย (รวมช่วงที่พักไว้แล้วกลับมาทำต่อ)</p>
            </div>

            <Chips options={BASIS} value={basis} onChange={setBasis} />

            {ranked.length === 0 ? (
              <div className={cn(card, "p-6 text-center")}>
                <Icon name="hourglass_empty" className="text-slate-300" style={{ fontSize: 38 }} />
                <p className="text-[13px] text-slate-600 mt-1">ยังไม่มีใครสอบผ่านครบทุกหัวข้อ</p>
              </div>
            ) : (
              <>
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-4 pt-5 text-white shadow-lg shadow-[#d32029]/25">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                  <h3 className="text-[14px] font-bold flex items-center gap-1.5 relative z-10">
                    <Icon name="workspace_premium" className="text-lg text-amber-300" fill />
                    <span>{basis === "time" ? "ใช้เวลาน้อยที่สุด" : "ผ่านครบก่อน"} · Top 3</span>
                  </h3>
                  <div className="relative z-10 mt-4 flex items-end gap-2">
                    {podium.map((r) => {
                      const m = PODIUM[r.rank];
                      return (
                        <div key={r.repCode} className="flex flex-col items-center justify-end flex-1 min-w-0">
                          <div className="relative mb-1.5">
                            <div className={cn("w-14 h-14 rounded-full bg-white text-[#a11119] flex items-center justify-center font-bold text-[16px] ring-4 shadow-lg", m.ring)}>{initials(r)}</div>
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[20px] drop-shadow">{MEDAL[r.rank]}</span>
                          </div>
                          <p className="text-[11px] font-bold text-white text-center truncate max-w-[100px] mt-1.5">{r.nickname || r.name}</p>
                          <p className="text-[9px] text-white/80 text-center truncate max-w-[100px]">🏪 {r.dealerName}</p>
                          <p className="tnum text-[10.5px] font-bold text-amber-200 mt-0.5 text-center leading-tight">{fmtDuration(r.elapsedSec)}</p>
                          <div className={cn("w-full bg-white/15 backdrop-blur rounded-t-xl mt-1.5 flex items-start justify-center pt-1.5 border-t-2", m.h)} style={{ borderColor: m.color }}>
                            <span className="text-[13px] font-black text-white/90">{r.rank}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-1.5">
                      <Icon name="leaderboard" className="text-lg text-[#d32029]" />
                      <span>Top Rank ทั้งหมด</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">{ranked.length} คน</span>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
                    {ranked.map((r) => (
                      <div key={r.repCode} className={cn("flex items-center gap-3 p-3", r.rank <= 3 && "bg-amber-50/40")}>
                        <div className="w-8 text-center shrink-0">{r.rank <= 3 ? <span className="text-[20px]">{MEDAL[r.rank]}</span> : <span className="tnum text-[13px] font-bold text-slate-400">{r.rank}</span>}</div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center font-bold text-[12px] shrink-0">{initials(r)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-slate-800 truncate">{person(r)}</p>
                          <p className="text-[11px] text-slate-500 truncate">🏪 {r.dealerName}</p>
                          <p className="text-[10.5px] text-slate-400">ผ่านครบ {fmtDateTimeTh(r.finishedAt)} · สอบ {r.attempts} ครั้ง</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="tnum text-[13px] font-bold text-[#a11119] leading-tight">{fmtDuration(r.elapsedSec)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            <label className="flex items-center gap-2 text-[11.5px] text-slate-500 px-1 pt-1">
              <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} className="accent-[#d32029]" />
              รวมผลสอบของบัญชีทดสอบ (ไว้ลองใช้ ไม่นับในรายงานจริง)
            </label>
          </>
        )}
      </div>
    </>
  );
}
