"use client";

/* ติดตามการตรวจประเมินร้านรายเดือน (client) — ข้อมูลจาก /api/store-eval/tracking */

/** แบบฟอร์มตรวจประเมินร้านที่ Coach ใช้ทุกเดือน (JotForm เดิม) */
export const EVAL_FORM_URL = "https://form.jotform.com/252040443758455";

export interface EvalSubmission {
  submissionId: string;
  evalDate: string | null;
  inspector: string | null;
  pct: number | null;
  result: string | null;
  counted: boolean;
  isPrimary: boolean;
}
export interface TrackStore {
  code: string;
  name: string;
  model: string | null;
  region: string | null;
  coachRep: string | null;
  areaRep: string | null;
  status: "done" | "missing";
  duplicate: boolean;
  proxy: boolean;
  submissions: EvalSubmission[];
}
export interface TrackCoach {
  repCode: string | null;
  name: string;
  nickname: string | null;
  phone: string | null;
  photoUrl: string | null;
  total: number;
  done: number;
  duplicates: number;
  proxies: number;
  lastEvalPeriod: string | null;
  stores: TrackStore[];
}
export interface Tracking {
  period: string;
  today: string;
  daysLeft: number;
  totals: { stores: number; done: number; missing: number; duplicates: number; proxies: number };
  coaches: TrackCoach[];
  me: { role: string; repCode: string | null };
}

type Res<T> = ({ ok: true } & T) | { ok: false; error: string; status?: number };

async function call<T>(url: string, init?: RequestInit): Promise<Res<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return { ok: false, error: j?.error ?? "โหลดข้อมูลไม่สำเร็จ", status: res.status };
    return j as { ok: true } & T;
  } catch {
    return { ok: false, error: "เชื่อมต่อไม่สำเร็จ" };
  }
}

export const fetchTracking = (period?: string) => call<Tracking>(`/api/store-eval/tracking${period ? `?period=${period}` : ""}`);

export const setCountedSubmission = (submissionId: string) =>
  call<object>("/api/store-eval/tracking", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId }) });

export const remindCoachNow = (repCode: string) =>
  call<{ sent: number }>("/api/push/remind", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repCode }) });

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function monthLabel(period: string, long = false): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${long ? y + 543 : String(y + 543).slice(-2)}`;
}
export function shiftPeriod(period: string, delta: number): string {
  const d = new Date(`${period}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}
export function shortDate(iso: string | null): string {
  if (!iso) return "-";
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]}`;
}
export const pctText = (p: number | null) => (p === null ? "-" : `${Math.round(p * 100)}%`);
