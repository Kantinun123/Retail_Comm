import { randomInt } from "node:crypto";
import type { AuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";

/* Competency Test (ข้อสอบ SE) — helper ฝั่ง server : สิทธิ์ / สุ่ม / ตรวจคะแนน
   เฉลย (exam_options.is_correct) อยู่ฝั่ง server เท่านั้น ไม่ส่งไปเบราว์เซอร์ */

export type Sb = ReturnType<typeof createServiceClient>;

export const EXAM_BUCKET = "exam-images";
/** ผู้ดูความคืบหน้าได้ (ตามขอบเขตร้านใน allowedDealerCodes) */
export const EXAM_VIEWER_ROLES = ["admin", "area_head", "area", "coach", "re", "dealer"];

/** วันนี้ตามเวลาไทย YYYY-MM-DD */
export function todayBkk(now = Date.now()): string {
  return new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
}

/** จำนวนวันจาก a ถึง b (YYYY-MM-DD) ; b ก่อน a = ติดลบ */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/** ก่อนเปิดใช้จริง (ไม่มี EXAM_ENABLED=1) พนักงานขายจริงยังไม่เห็น ; บัญชีทดสอบ/ผู้ดูแลเห็นได้ */
export function examEnabled(ctx: AuthContext): boolean {
  return process.env.EXAM_ENABLED === "1" || ctx.isTest || ctx.role !== "sales";
}

/** ผู้สอบ = พนักงานขาย (SE) ที่ผูกรหัสพนักงาน */
export function isExaminee(ctx: AuthContext): boolean {
  return ctx.role === "sales" && !!ctx.repCode;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function imageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${EXAM_BUCKET}/${path}`;
}

export interface RoundRow {
  id: number;
  title: string;
  starts_on: string;
  deadline_on: string;
  pass_percent: number;
  status: "open" | "closed";
}

/** รายการหัวข้อที่เปิดสอบได้ (มีข้อที่ใช้งานอย่างน้อย 1 ข้อ) พร้อมจำนวนข้อ */
export async function activeTopics(sb: Sb) {
  const [t, q] = await Promise.all([
    sb.from("exam_topics").select("id, code, title, group_name, sort").eq("is_active", true).order("sort"),
    sb.from("exam_questions").select("topic_id").eq("is_active", true).limit(5000),
  ]);
  const counts = new Map<number, number>();
  for (const r of q.data ?? []) counts.set(r.topic_id as number, (counts.get(r.topic_id as number) ?? 0) + 1);
  return (t.data ?? [])
    .map((x) => ({ id: x.id as number, code: x.code as string, title: x.title as string, group: (x.group_name as string | null) ?? "", questionCount: counts.get(x.id as number) ?? 0 }))
    .filter((x) => x.questionCount > 0);
}

/** ตรวจคะแนน: ข้อถูกเมื่อชุดตัวเลือกที่เลือก = ชุดตัวเลือกที่ถูกทุกตัวพอดี (ข้อเลือกหลายคำตอบต้องครบ) */
export async function gradeAttempt(
  sb: Sb,
  questionIds: number[],
  answers: Record<string, number[]>,
  passPercent: number
): Promise<{ score: number; total: number; percent: number; passed: boolean }> {
  const { data } = await sb.from("exam_options").select("id, question_id, is_correct").in("question_id", questionIds);
  const correct = new Map<number, Set<number>>();
  const all = new Map<number, Set<number>>();
  for (const o of data ?? []) {
    const q = o.question_id as number;
    if (!all.has(q)) all.set(q, new Set());
    all.get(q)!.add(o.id as number);
    if (o.is_correct) {
      if (!correct.has(q)) correct.set(q, new Set());
      correct.get(q)!.add(o.id as number);
    }
  }
  let score = 0;
  for (const q of questionIds) {
    const want = correct.get(q);
    if (!want || want.size === 0) continue;
    const picked = new Set((answers[String(q)] ?? []).filter((id) => all.get(q)?.has(id)));
    if (picked.size === want.size && [...picked].every((id) => want.has(id))) score++;
  }
  const total = questionIds.length;
  const percent = total ? Math.round((score / total) * 10000) / 100 : 0;
  return { score, total, percent, passed: total > 0 && percent >= passPercent };
}

/** รับ answers จาก client : { "<questionId>": [optionId,...] } เฉพาะข้อที่อยู่ในชุดสอบ */
export function cleanAnswers(raw: unknown, questionIds: number[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!raw || typeof raw !== "object") return out;
  const allowed = new Set(questionIds.map(String));
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(k) || !Array.isArray(v)) continue;
    const ids = v.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    out[k] = [...new Set(ids)].slice(0, 12);
  }
  return out;
}

/** SE ที่ยังทำงานอยู่ (position se) ในร้านที่อยู่ในขอบเขต */
export async function examinees(sb: Sb, allowed: "all" | string[]) {
  let q = sb.from("sale_reps").select("rep_code, name, nickname, dealer_code, level").eq("position", "se").eq("is_active", true).not("dealer_code", "is", null).limit(1000);
  if (allowed !== "all") q = q.in("dealer_code", allowed.length ? allowed : ["-"]);
  const { data } = await q;
  return (data ?? []) as { rep_code: string; name: string; nickname: string | null; dealer_code: string; level: string | null }[];
}

/** ประกอบชุดข้อสอบของการสอบครั้งนี้ (ลำดับข้อ/ตัวเลือกตามที่สุ่มไว้) — ไม่ส่งเฉลย */
export async function buildAttemptView(sb: Sb, attempt: { question_ids: number[]; option_order: Record<string, number[]> }) {
  const [qs, os] = await Promise.all([
    sb.from("exam_questions").select("id, kind, body, image_paths").in("id", attempt.question_ids),
    sb.from("exam_options").select("id, question_id, body, image_path").in("question_id", attempt.question_ids),
  ]);
  const qMap = new Map((qs.data ?? []).map((q) => [q.id as number, q]));
  const oMap = new Map((os.data ?? []).map((o) => [o.id as number, o]));
  return attempt.question_ids
    .map((qid) => {
      const q = qMap.get(qid);
      if (!q) return null;
      const order = attempt.option_order[String(qid)] ?? [];
      return {
        id: qid,
        kind: q.kind as "single" | "multi",
        body: q.body as string,
        images: ((q.image_paths as string[] | null) ?? []).map(imageUrl),
        options: order.map((oid) => oMap.get(oid)).filter(Boolean).map((o) => ({ id: o!.id as number, body: o!.body as string, image: o!.image_path ? imageUrl(o!.image_path as string) : null })),
      };
    })
    .filter(Boolean);
}
