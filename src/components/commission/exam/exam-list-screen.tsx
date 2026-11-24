"use client";
/* ข้อสอบ Competency ของพนักงานขาย (SE): รอบสอบที่เปิด + สถานะรายหัวข้อ (ยังไม่ทำ / กำลังทำ / ยังไม่ผ่าน / ผ่านแล้ว) */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import { dayTh, deadlineText, fetchExamMine, type ExamMine, type ExamRoundState, type ExamTopicState, type TopicStatus } from "@/lib/commission/exam-store";
import { card } from "../boq/boq-shared";
import { ExamCounts } from "./exam-counts";

const STATUS: Record<TopicStatus, { label: string; cls: string; icon: string }> = {
  todo: { label: "ยังไม่ทำ", cls: "bg-slate-100 text-slate-600", icon: "radio_button_unchecked" },
  in_progress: { label: "กำลังทำ", cls: "bg-amber-50 text-amber-700", icon: "edit_note" },
  failed: { label: "ยังไม่ผ่าน", cls: "bg-rose-50 text-rose-700", icon: "replay" },
  passed: { label: "ผ่านแล้ว", cls: "bg-emerald-50 text-emerald-700", icon: "check_circle" },
};

function TopicRow({ round, t }: { round: ExamRoundState; t: ExamTopicState }) {
  const router = useRouter();
  const s = STATUS[t.status];
  const action = t.status === "passed" ? null : t.status === "in_progress" ? "ทำต่อ" : t.status === "failed" ? "สอบใหม่" : "เริ่มสอบ";
  // โทนแดงเดียวกัน แต่ต่างน้ำหนัก: เริ่มสอบ = แดงเข้มทึบ / สอบใหม่ = แดงอ่อน / ทำต่อ = ขอบแดง
  const actionCls = t.status === "failed" ? "bg-rose-100 text-rose-700" : t.status === "in_progress" ? "border border-[#d32029] text-[#d32029] bg-white" : "bg-[#d32029] text-white";
  const detail =
    t.attempts > 0
      ? `สอบ ${t.attempts} ครั้ง${t.passes > 0 ? ` · ผ่านครั้งที่ ${t.firstPassNo}` : ""} · สูงสุด ${t.bestPercent ?? 0}%`
      : `${t.questionCount} ข้อ`;
  const inner = (
    <div className="flex items-center gap-3 p-3">
      <span className={cn("w-9 h-9 rounded-xl grid place-items-center shrink-0", s.cls)}>
        <Icon name={s.icon} style={{ fontSize: 19 }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-slate-800 leading-snug">{t.title}</p>
        <p className="text-[11px] text-slate-500">{detail}</p>
      </div>
      {action ? (
        <span className={cn("text-[12px] font-bold shrink-0 flex items-center rounded-full pl-3 pr-1.5 py-1", actionCls)}>
          {action}
          <Icon name="chevron_right" style={{ fontSize: 16 }} />
        </span>
      ) : (
        <span className={cn("text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0", s.cls)}>{s.label}</span>
      )}
    </div>
  );
  return action ? (
    // ?v= ทำให้ทุกครั้งที่กดเริ่ม/สอบใหม่เป็นหน้าใหม่ ไม่ย้อนไปใช้สถานะหน้าเดิมที่ Next เก็บไว้ (ไม่งั้นผลสอบครั้งก่อนค้างอยู่)
    <Link
      href={`/app/exam/take/${round.id}/${t.id}`}
      onClick={(e) => {
        e.preventDefault();
        router.push(`/app/exam/take/${round.id}/${t.id}?v=${Date.now()}`);
      }}
      className="block hover:bg-red-50/40 transition"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}

function RoundCard({ r }: { r: ExamRoundState }) {
  const state = r.completed ? { label: "ทำเสร็จแล้ว", cls: "bg-emerald-50 text-emerald-700" } : r.topics.every((x) => x.status === "todo") ? { label: "ยังไม่ทำ", cls: "bg-slate-100 text-slate-600" } : { label: `ผ่านแล้ว ${r.doneCount}/${r.topicCount} หัวข้อ`, cls: "bg-amber-50 text-amber-700" };
  const groups = [...new Set(r.topics.map((t) => t.group))];
  return (
    <section className={cn(card, "overflow-hidden")}>
      <div className="p-4">
        <div className="flex items-start gap-2">
          <h2 className="text-[15px] font-bold text-slate-900 leading-snug flex-1">{r.title}</h2>
          <span className={cn("text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0", state.cls)}>{state.label}</span>
        </div>
        <div className={cn("mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-lg px-2.5 py-1.5", r.completed ? "bg-emerald-50 text-emerald-800" : r.overdue ? "bg-rose-50 text-rose-700" : r.daysLeft <= 3 ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-700")}>
          <Icon name={r.overdue && !r.completed ? "event_busy" : "event"} style={{ fontSize: 16 }} />
          ส่งภายใน {dayTh(r.deadlineOn)}
          {!r.completed && <span className="font-bold">· {deadlineText(r.daysLeft)}</span>}
        </div>
        <ExamCounts topics={r.topics} />
        <p className="text-[11px] text-slate-500 mt-1.5">ต้องผ่านทุกหัวข้อ · เกณฑ์ผ่านหัวข้อละ {r.passPercent}% · สอบซ้ำได้ไม่จำกัดครั้ง</p>
      </div>
      {groups.map((g) => (
        <div key={g}>
          <p className="px-4 py-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 border-y border-slate-100">{g || "อื่นๆ"}</p>
          <div className="divide-y divide-slate-100">
            {r.topics
              .filter((t) => t.group === g)
              .map((t) => (
                <TopicRow key={t.id} round={r} t={t} />
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function ExamListScreen() {
  const { ready } = useSession();
  const [data, setData] = useState<ExamMine | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchExamMine()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return (
    <>
      <header className="flex items-center gap-2 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <Link href="/app/home-staff" className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="กลับ">
          <Icon name="arrow_back" style={{ fontSize: 18 }} />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 leading-tight">พัฒนาตัวเอง</p>
          <h1 className="font-bold text-[16px] text-[#231313] leading-tight">ข้อสอบ Competency</h1>
        </div>
      </header>
      <div className="space-y-3 pb-24">
        {error && <p className="rounded-xl bg-rose-50 text-rose-700 text-[12.5px] p-3">{error}</p>}
        {!data && !error && <p className="text-center text-[12px] text-slate-400 py-10">กำลังโหลด…</p>}
        {data && !data.examinee && (
          <div className={cn(card, "p-4 text-[13px] text-slate-600")}>
            ข้อสอบนี้สำหรับพนักงานขาย (SE)
            <Link href="/app/exam/progress" className="block mt-2 font-bold text-[#d32029]">ดูความคืบหน้าการสอบของพนักงาน →</Link>
          </div>
        )}
        {data?.examinee && !data.enabled && <div className={cn(card, "p-4 text-[13px] text-slate-600")}>ระบบข้อสอบยังไม่เปิดใช้งาน</div>}
        {data?.examinee && data.enabled && data.rounds.length === 0 && (
          <div className={cn(card, "p-6 text-center")}>
            <Icon name="quiz" className="text-slate-300" style={{ fontSize: 40 }} />
            <p className="text-[13px] text-slate-600 mt-1">ยังไม่มีรอบสอบที่เปิดอยู่</p>
          </div>
        )}
        {data?.rounds.map((r) => <RoundCard key={r.id} r={r} />)}
      </div>
    </>
  );
}
