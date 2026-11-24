/* Competency Test (ข้อสอบ SE) — ชนิดข้อมูล / เรียก API ฝั่งหน้าจอ */

export type TopicStatus = "todo" | "in_progress" | "failed" | "passed";

export interface ExamTopicState {
  id: number;
  title: string;
  group: string;
  questionCount: number;
  status: TopicStatus;
  attempts: number;
  passes: number;
  firstPassNo: number | null;
  bestPercent: number | null;
}

export interface ExamRoundState {
  id: number;
  title: string;
  startsOn: string;
  deadlineOn: string;
  passPercent: number;
  daysLeft: number;
  overdue: boolean;
  topicCount: number;
  doneCount: number;
  completed: boolean;
  topics: ExamTopicState[];
}

export interface ExamMine {
  enabled: boolean;
  examinee: boolean;
  rounds: ExamRoundState[];
}

export interface ExamQuestionView {
  id: number;
  kind: "single" | "multi";
  body: string;
  images: string[];
  options: { id: number; body: string; image?: string | null }[];
}

export interface ExamStart {
  attemptId: number;
  seq: number;
  passPercent: number;
  answers: Record<string, number[]>;
  questions: ExamQuestionView[];
}

export interface ExamResult {
  seq: number;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  passPercent: number;
}

export interface ProgressCell {
  topicId: number;
  attempts: number;
  passes: number;
  firstPassNo: number | null;
  bestPercent: number | null;
  passed: boolean;
}

export interface ProgressRep {
  repCode: string;
  name: string;
  nickname: string | null;
  dealerCode: string;
  dealerName: string;
  level: string | null;
  doneCount: number;
  attempts: number;
  passes: number;
  completed: boolean;
  started: boolean;
  topics: ProgressCell[];
}

export interface ProgressRound {
  id: number;
  title: string;
  startsOn: string;
  deadlineOn: string;
  passPercent: number;
  status: "open" | "closed";
  daysLeft: number;
}

export interface ExamProgress {
  role: string;
  rounds: ProgressRound[];
  round: ProgressRound | null;
  topics: { id: number; title: string; group: string; questionCount: number }[];
  reps: ProgressRep[];
  summary: { total: number; completed: number; inProgress: number; notStarted: number; topicCount: number; totalAttempts: number; totalPasses: number } | null;
  adminInfo?: { topics: { id: number; title: string; active: number; inactive: { sort: number; problem: string | null }[] }[] };
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const j = (await res.json().catch(() => null)) as ({ ok: boolean; error?: string } & Record<string, unknown>) | null;
  if (!res.ok || !j?.ok) throw new Error(errText(j?.error) || `เกิดข้อผิดพลาด (${res.status})`);
  return j as unknown as T;
}

const ERR: Record<string, string> = {
  already_passed: "หัวข้อนี้ผ่านแล้ว ไม่ต้องสอบซ้ำ",
  round_closed: "รอบสอบนี้ปิดหรือยังไม่เริ่ม",
  no_questions: "หัวข้อนี้ยังไม่มีข้อสอบที่พร้อมใช้",
  already_submitted: "ส่งข้อสอบครั้งนี้ไปแล้ว",
  forbidden: "ไม่มีสิทธิ์ใช้งานส่วนนี้",
  unauthenticated: "กรุณาเข้าสู่ระบบ",
};
const errText = (e?: string) => (e ? ERR[e] ?? e : "");

export const fetchExamMine = () => call<ExamMine>("/api/exam");
export const startExam = (roundId: number, topicId: number) =>
  call<ExamStart>("/api/exam/attempt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roundId, topicId }) });
export const saveExamAnswers = (attemptId: number, answers: Record<string, number[]>) =>
  call<{ ok: true }>(`/api/exam/attempt/${attemptId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
export const submitExam = (attemptId: number, answers: Record<string, number[]>) =>
  call<ExamResult>(`/api/exam/attempt/${attemptId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
export const fetchExamProgress = (roundId?: number | null, includeTest = false) =>
  call<ExamProgress>(`/api/exam/progress?${roundId ? `roundId=${roundId}&` : ""}${includeTest ? "includeTest=1" : ""}`);
export const createExamRound = (b: { title: string; startsOn: string; deadlineOn: string; passPercent: number }) =>
  call<{ id: number; pushed: number }>("/api/exam/rounds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
export const patchExamRound = (b: { id: number; status?: "open" | "closed"; deadlineOn?: string; title?: string }) =>
  call<{ ok: true }>("/api/exam/rounds", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** YYYY-MM-DD -> "20 พ.ย. 69" */
export function dayTh(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${TH_MONTH[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}`;
}

export function deadlineText(daysLeft: number): string {
  if (daysLeft < 0) return `เลยกำหนดมา ${-daysLeft} วัน`;
  if (daysLeft === 0) return "ครบกำหนดวันนี้";
  return `เหลืออีก ${daysLeft} วัน`;
}

/* ---------- อันดับคนสอบครบเร็วที่สุด (admin) ---------- */
export interface RankingRow {
  repCode: string;
  name: string;
  nickname: string | null;
  dealerCode: string;
  dealerName: string;
  level: string | null;
  firstStartAt: string;
  finishedAt: string;
  elapsedSec: number;
  attempts: number;
  passes: number;
}
export interface ExamRanking {
  rounds: { id: number; title: string; startsOn: string; deadlineOn: string; status: "open" | "closed" }[];
  round: { id: number; title: string; startsOn: string; deadlineOn: string; status: "open" | "closed" } | null;
  topicCount: number;
  rows: RankingRow[];
  summary: { total: number; completed: number };
}
export const fetchExamRanking = (roundId?: number | null, includeTest = false) =>
  call<ExamRanking>(`/api/exam/ranking?${roundId ? `roundId=${roundId}&` : ""}${includeTest ? "includeTest=1" : ""}`);

/** วินาที -> "12 ชม. 03 นาที 07 วินาที" (ชั่วโมงไม่ตัดเป็นวัน เพื่อเทียบกันตรง ๆ) */
export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h} ชม. ${String(m).padStart(2, "0")} นาที ${String(s).padStart(2, "0")} วินาที`;
}
/** ISO -> "24 พ.ย. 69 09:41:07" เวลาไทย */
export function fmtDateTimeTh(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${TH_MONTH[d.getUTCMonth()]} ${p((d.getUTCFullYear() + 543) % 100)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}