"use client";
/* ทำข้อสอบทีละหัวข้อ: ทีละข้อ, บันทึกคำตอบอัตโนมัติ (ปิดแล้วกลับมาทำต่อได้), ส่งแล้วเห็นคะแนน/ผ่านหรือไม่ผ่าน (ไม่แสดงเฉลย) */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import { saveExamAnswers, startExam, submitExam, type ExamResult, type ExamStart } from "@/lib/commission/exam-store";
import { btn, card } from "../boq/boq-shared";

type Answers = Record<string, number[]>;

export function ExamTakeScreen({ roundId, topicId }: { roundId: number; topicId: number }) {
  const { ready } = useSession();
  const [exam, setExam] = useState<ExamStart | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState("");
  const [saveErr, setSaveErr] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    startExam(roundId, topicId)
      .then((d) => {
        if (cancelled) return;
        setExam(d);
        setAnswers(d.answers ?? {});
        // ทำต่อจากข้อแรกที่ยังไม่ตอบ
        const first = d.questions.findIndex((q) => !(d.answers?.[String(q.id)]?.length));
        setIdx(first < 0 ? 0 : first);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "เริ่มสอบไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [ready, roundId, topicId]);

  function pick(qid: number, oid: number, multi: boolean) {
    if (!exam) return;
    const key = String(qid);
    const cur = answers[key] ?? [];
    const next = multi ? (cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid]) : [oid];
    const all = { ...answers, [key]: next };
    setAnswers(all);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveExamAnswers(exam.attemptId, all).then(() => setSaveErr(false)).catch(() => setSaveErr(true));
    }, 600);
  }

  async function submit() {
    if (!exam) return;
    setBusy(true);
    setError("");
    try {
      if (timer.current) clearTimeout(timer.current);
      setResult(await submitExam(exam.attemptId, answers));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งข้อสอบไม่สำเร็จ");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <header className="flex items-center gap-2 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
      <Link href="/app/exam" className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="กลับ">
        <Icon name="arrow_back" style={{ fontSize: 18 }} />
      </Link>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 leading-tight">ข้อสอบ Competency{exam ? ` · ครั้งที่ ${exam.seq}` : ""}</p>
        <h1 className="font-bold text-[16px] text-[#231313] leading-tight">{result ? "ผลการสอบ" : "ทำข้อสอบ"}</h1>
      </div>
    </header>
  );

  if (error && !exam) {
    return (
      <>
        {header}
        <div className={cn(card, "p-5 text-center")}>
          <Icon name="error" className="text-rose-400" style={{ fontSize: 36 }} />
          <p className="text-[13px] text-slate-700 mt-1">{error}</p>
          <Link href="/app/exam" className={cn(btn, "inline-block mt-3 bg-[#d32029] text-white")}>กลับหน้าข้อสอบ</Link>
        </div>
      </>
    );
  }
  if (!exam) return <>{header}<p className="text-center text-[12px] text-slate-400 py-10">กำลังเตรียมข้อสอบ…</p></>;

  if (result) {
    return (
      <>
        {header}
        <div className={cn(card, "p-6 text-center space-y-2")}>
          <div className={cn("w-16 h-16 rounded-full mx-auto grid place-items-center", result.passed ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
            <Icon name={result.passed ? "emoji_events" : "replay"} style={{ fontSize: 34 }} />
          </div>
          <p className={cn("text-[18px] font-bold", result.passed ? "text-emerald-700" : "text-rose-700")}>{result.passed ? "ผ่าน" : "ยังไม่ผ่าน"}</p>
          <p className="text-[34px] font-bold text-slate-900 leading-none">{result.percent}%</p>
          <p className="text-[12px] text-slate-500">ถูก {result.score} จาก {result.total} ข้อ · เกณฑ์ผ่าน {result.passPercent}% · สอบครั้งที่ {result.seq}</p>
          {!result.passed && <p className="text-[12px] text-slate-500">ทบทวนเนื้อหาแล้วกลับมาสอบใหม่ได้ ไม่จำกัดจำนวนครั้ง</p>}
          <Link href="/app/exam" className={cn(btn, "inline-block mt-2 bg-[#d32029] text-white")}>กลับหน้าข้อสอบ</Link>
        </div>
      </>
    );
  }

  const q = exam.questions[idx];
  const total = exam.questions.length;
  const answered = exam.questions.filter((x) => answers[String(x.id)]?.length).length;
  const sel = answers[String(q.id)] ?? [];
  const unanswered = total - answered;

  return (
    <>
      {header}
      <div className="space-y-3 pb-28">
        <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
          <span className="font-bold text-slate-700">ข้อ {idx + 1}/{total}</span>
          <span>· ตอบแล้ว {answered}</span>
          {saveErr && <span className="text-rose-600 font-semibold">· บันทึกอัตโนมัติไม่สำเร็จ (จะลองใหม่เมื่อตอบข้อถัดไป)</span>}
          <div className="ml-auto h-1.5 w-24 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-[#d32029]" style={{ width: `${(answered / total) * 100}%` }} />
          </div>
        </div>

        <section className={cn(card, "p-4")}>
          <p className="text-[14px] font-semibold text-slate-900 leading-relaxed whitespace-pre-line">{q.body}</p>
          {q.kind === "multi" && <p className="text-[11px] font-bold text-amber-700 mt-1.5">เลือกได้มากกว่า 1 ข้อ</p>}
          {q.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="รูปประกอบข้อสอบ" className="mt-3 w-full rounded-xl border border-slate-200 bg-white" loading="lazy" />
          ))}
          <div className="mt-3 space-y-2">
            {q.options.map((o) => {
              const on = sel.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pick(q.id, o.id, q.kind === "multi")}
                  className={cn("w-full text-left rounded-xl border px-3 py-3 flex items-start gap-2.5 transition", on ? "border-[#d32029] bg-red-50" : "border-slate-200 bg-white hover:border-slate-300")}
                >
                  <span className={cn("mt-0.5 w-5 h-5 shrink-0 grid place-items-center border-2", q.kind === "multi" ? "rounded-md" : "rounded-full", on ? "border-[#d32029] bg-[#d32029] text-white" : "border-slate-300")}>
                    {on && <Icon name="check" style={{ fontSize: 14 }} />}
                  </span>
                  {o.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.image} alt="ตัวเลือก" className="h-10 w-auto rounded bg-slate-100 p-1" loading="lazy" />
                  )}
                  {o.body && <span className="text-[13px] text-slate-800 leading-snug">{o.body}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap gap-1.5">
          {exam.questions.map((x, i) => {
            const done = !!answers[String(x.id)]?.length;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`ไปข้อ ${i + 1}`}
                className={cn("w-8 h-8 rounded-lg text-[11.5px] font-bold border", i === idx ? "border-[#d32029] text-[#d32029] bg-white ring-2 ring-red-100" : done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-500")}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        {error && <p className="rounded-xl bg-rose-50 text-rose-700 text-[12.5px] p-3">{error}</p>}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3">
        <div className="max-w-md mx-auto flex gap-2">
          <button type="button" disabled={idx === 0} onClick={() => setIdx(idx - 1)} className={cn(btn, "border border-slate-200 bg-white text-slate-700")}>
            ก่อนหน้า
          </button>
          {idx < total - 1 ? (
            <button type="button" onClick={() => setIdx(idx + 1)} className={cn(btn, "flex-1 bg-slate-900 text-white")}>
              ข้อถัดไป
            </button>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={cn(btn, "flex-1 bg-[#d32029] text-white")}>
              ส่งข้อสอบ
            </button>
          )}
          {idx < total - 1 && (
            <button type="button" onClick={() => setConfirming(true)} className={cn(btn, "border border-[#d32029] text-[#d32029] bg-white")}>
              ส่ง
            </button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm grid place-items-end sm:place-items-center p-3" onClick={() => !busy && setConfirming(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold text-slate-900">ส่งข้อสอบ?</p>
            <p className="text-[13px] text-slate-600">
              {unanswered > 0 ? <>ยังไม่ได้ตอบ <b className="text-rose-600">{unanswered} ข้อ</b> (ข้อที่ไม่ตอบนับเป็นผิด)</> : "ตอบครบทุกข้อแล้ว"} · ส่งแล้วแก้ไม่ได้
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={cn(btn, "flex-1 border border-slate-200 text-slate-700")}>
                กลับไปทำต่อ
              </button>
              <button type="button" disabled={busy} onClick={submit} className={cn(btn, "flex-1 bg-[#d32029] text-white")}>
                {busy ? "กำลังส่ง…" : "ยืนยันส่ง"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
