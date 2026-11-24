"use client";
/* การ์ดข้อสอบ Competency บนหน้าหลัก: พนักงานขาย (สถานะของตัวเอง) / ผู้ดู (Admin, หัวหน้า Area, Area, Coach, ร้านค้า = ความคืบหน้าของ SE) */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../icon";
import { ExamCounts } from "./exam-counts";
import { cn } from "@/lib/utils";
import { dayTh, deadlineText, fetchExamMine, fetchExamProgress, type ExamProgress, type ExamRoundState } from "@/lib/commission/exam-store";

type Variant = "sales" | "viewer";

export function ExamHomeCard({ variant }: { variant: Variant }) {
  const [mine, setMine] = useState<ExamRoundState | null>(null);
  const [prog, setProg] = useState<ExamProgress | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (variant === "sales") {
      fetchExamMine()
        .then((d) => !cancelled && (setMine(d.enabled && d.examinee ? d.rounds.find((r) => !r.completed) ?? d.rounds[0] ?? null : null), setReady(true)))
        .catch(() => !cancelled && setReady(true));
    } else {
      fetchExamProgress()
        .then((d) => !cancelled && (setProg(d), setReady(true)))
        .catch(() => !cancelled && setReady(true));
    }
    return () => {
      cancelled = true;
    };
  }, [variant]);

  if (!ready) return null;

  if (variant === "sales") {
    if (!mine) return null;
    const r = mine;
    const tone = r.completed ? "border-emerald-200" : r.overdue ? "border-rose-300" : "border-slate-200";
    const chip = r.completed ? { t: "ทำเสร็จแล้ว", c: "bg-emerald-50 text-emerald-700" } : r.topics.every((x) => x.status === "todo") ? { t: "ยังไม่ทำ", c: "bg-slate-100 text-slate-600" } : { t: `ผ่านแล้ว ${r.doneCount}/${r.topicCount}`, c: "bg-amber-50 text-amber-700" };
    return (
      <Link href="/app/exam" className={cn("rounded-2xl bg-white border shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] transition", tone)}>
        <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#d32029] flex items-center justify-center shrink-0">
          <Icon name="quiz" style={{ fontSize: 21 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-bold text-slate-900 leading-snug truncate">ข้อสอบ Competency</p>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", chip.c)}>{chip.t}</span>
          </div>
          <p className={cn("text-[10.5px]", !r.completed && (r.overdue ? "text-rose-600 font-semibold" : r.daysLeft <= 3 ? "text-amber-700 font-semibold" : "text-slate-400"), r.completed && "text-slate-400")}>
            {r.completed ? `ผ่านครบ ${r.topicCount} หัวข้อ` : `ส่งภายใน ${dayTh(r.deadlineOn)} · ${deadlineText(r.daysLeft)}`}
          </p>
          {!r.completed && <ExamCounts topics={r.topics} size="sm" />}
        </div>
        <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
      </Link>
    );
  }

  // ผู้ดู: ไม่มีรอบ = เฉพาะ admin เห็น (ไว้เปิดรอบ)
  const isAdmin = prog?.role === "admin";
  if (!prog || (!prog.round && !isAdmin)) return null;
  const s = prog.summary;
  return (
    <Link href="/app/exam/progress" className="rounded-2xl bg-white border border-slate-200 shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] transition">
      <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#d32029] flex items-center justify-center shrink-0">
        <Icon name="quiz" style={{ fontSize: 21 }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-slate-900 leading-snug">ข้อสอบ Competency ของ SE</p>
        <p className="text-[10.5px] text-slate-400">
          {prog.round && s ? `ทำเสร็จ ${s.completed}/${s.total} คน · ${deadlineText(prog.round.daysLeft)}` : "ยังไม่มีรอบสอบ — เปิดรอบใหม่"}
        </p>
      </div>
      <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
    </Link>
  );
}
