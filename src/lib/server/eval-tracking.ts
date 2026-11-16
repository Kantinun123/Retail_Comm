import type { createServiceClient } from "@/lib/supabase/service";

/* ติดตามการตรวจประเมินร้านรายเดือน (ใช้ทั้ง API หน้าติดตาม และงานแจ้งเตือนรายวัน)
   - ร้านที่ต้องตรวจ = ร้านที่เปิดใช้งาน (dealers.is_active) ทุกร้าน ; ผู้รับผิดชอบ = Coach ตาม rep_store_assignments
   - ร้านเดียวกันส่งหลายครั้งในเดือน = ตรวจซ้ำ ; ครั้งที่นับ = is_primary หรือครั้งล่าสุด (ตรงกับ view store_eval_effective)
   - ผู้ตรวจไม่ใช่ Coach ที่ดูแล = "ตรวจแทน" (เทียบชื่อต้น)
   - Admin ปิดการตรวจรายร้านได้ (store_eval_requirements) มีผลตั้งแต่เดือนที่ตั้ง ; เดือนก่อนหน้ายังนับตามเดิม
     ร้านที่ไม่ต้องตรวจ: ไม่นับในตัวเลข/ขาดติดกัน/แจ้งเตือน แต่ยังแสดง (ส่วน "ไม่ต้องตรวจ") */

type Sb = ReturnType<typeof createServiceClient>;

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
  /** จำนวนเดือนติดกันที่ไม่ได้ตรวจ นับถึงเดือนที่เลือก (ตรวจแล้ว = 0) ; null = ไม่เคยถูกตรวจเลย */
  missedStreak: number | null;
  /** ขาดติดกันตั้งแต่ CHRONIC_MONTHS เดือน หรือไม่เคยถูกตรวจ */
  chronic: boolean;
  /** เดือนล่าสุดที่เคยตรวจ (ก่อนหรือเท่ากับเดือนที่เลือก) */
  lastEvalPeriod: string | null;
  /** เดือนที่เลือกร้านนี้ต้องตรวจหรือไม่ (false = Admin ปิดการตรวจไว้) */
  required: boolean;
  /** เหตุผลที่ปิดการตรวจ (เมื่อ required = false) */
  exemptReason: string | null;
  /** เดือนที่เริ่มปิดการตรวจ (เมื่อ required = false) */
  exemptSince: string | null;
}

/** ขาดติดกันกี่เดือนถึงนับเป็น "ขาดติดกัน" (เตือนเข้มขึ้น) */
export const CHRONIC_MONTHS = 2;

export function monthsBetween(from: string, to: string): number {
  const [ya, ma] = from.split("-").map(Number);
  const [yb, mb] = to.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
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
  /** ร้านที่ขาดติดกัน ≥ CHRONIC_MONTHS เดือน (รวมร้านที่ไม่เคยถูกตรวจ) */
  chronic: number;
  /** ร้านที่ปิดการตรวจในเดือนนี้ (ไม่นับใน total) */
  exempt: number;
  lastEvalPeriod: string | null;
  stores: TrackStore[];
}

export interface Tracking {
  period: string;
  today: string;
  daysLeft: number;
  chronicMonths: number;
  /** stores/done/missing/... นับเฉพาะร้านที่ต้องตรวจ ; exempt = ร้านที่ปิดการตรวจในเดือนนี้ */
  totals: { stores: number; done: number; missing: number; duplicates: number; proxies: number; chronic: number; exempt: number };
  coaches: TrackCoach[];
}

/** วันที่ตามเวลาไทย (YYYY-MM-DD) */
export function bangkokToday(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function daysInMonth(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const firstWord = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/^(นางสาว|น\.ส\.|นาย|นาง|คุณ)\s*/, "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase() ?? "";

/** scope = null -> ทุกร้าน ; ไม่งั้นเฉพาะรหัสร้านที่ให้มา */
export async function buildTracking(sb: Sb, period: string, scope: string[] | null): Promise<Tracking> {
  let dq = sb.from("dealers").select("code, name, model, region").eq("is_active", true);
  if (scope) dq = dq.in("code", scope.length ? scope : ["__none__"]);
  const [{ data: dealers }, { data: asg }, { data: lines }, { data: lastByStore }, { data: reqRows }] = await Promise.all([
    dq,
    sb.from("rep_store_assignments").select("rep_code, dealer_code, role_in_store").in("role_in_store", ["coach", "manager"]),
    sb.from("store_eval_lines").select("submission_id, dealer_code, eval_date, inspector, pct, result, is_primary").eq("period", period).not("dealer_code", "is", null),
    sb.from("store_eval_lines").select("dealer_code, period").not("dealer_code", "is", null).order("period", { ascending: false }).limit(5000),
    sb.from("store_eval_requirements").select("dealer_code, effective_period, required, reason").lte("effective_period", period).order("effective_period", { ascending: true }),
  ]);
  // สถานะต้องตรวจรายเดือน: แถวล่าสุดที่ effective_period <= เดือนนั้น ; ไม่มีแถว = ต้องตรวจ
  const reqHist = new Map<string, { p: string; required: boolean; reason: string | null }[]>();
  (reqRows ?? []).forEach((r) =>
    reqHist.set(r.dealer_code as string, [
      ...(reqHist.get(r.dealer_code as string) ?? []),
      { p: r.effective_period as string, required: r.required === true, reason: (r.reason as string | null) ?? null },
    ])
  );
  const reqAt = (code: string, p: string) => {
    let cur: { p: string; required: boolean; reason: string | null } | null = null;
    for (const h of reqHist.get(code) ?? []) if (h.p <= p) cur = h;
    return cur ?? { p: "", required: true, reason: null };
  };
  /** จำนวนเดือนที่ต้องตรวจ ในช่วง (from, to] — ข้ามเดือนที่ปิดการตรวจ */
  const requiredMonthsBetween = (code: string, from: string, to: string) => {
    let n = 0;
    let [y, m] = from.split("-").map(Number);
    for (let i = 0; i < 600; i++) {
      m++;
      if (m > 12) { m = 1; y++; }
      const p = `${y}-${String(m).padStart(2, "0")}`;
      if (p > to) break;
      if (reqAt(code, p).required) n++;
    }
    return n;
  };
  const codes = new Set((dealers ?? []).map((d) => d.code as string));
  const coachOf = new Map<string, string>();
  const areaOf = new Map<string, string>();
  (asg ?? []).forEach((a) => {
    if (!codes.has(a.dealer_code as string)) return;
    if (a.role_in_store === "coach" && !coachOf.has(a.dealer_code as string)) coachOf.set(a.dealer_code as string, a.rep_code as string);
    if (a.role_in_store === "manager" && !areaOf.has(a.dealer_code as string)) areaOf.set(a.dealer_code as string, a.rep_code as string);
  });
  const coachCodes = Array.from(new Set(coachOf.values()));
  const { data: reps } = coachCodes.length
    ? await sb.from("sale_reps").select("rep_code, name, nickname, phone, photo_url").in("rep_code", coachCodes)
    : { data: [] as never[] };
  const repMap = new Map((reps ?? []).map((r) => [r.rep_code as string, r]));

  const byStore = new Map<string, typeof lines>();
  (lines ?? []).forEach((l) => {
    if (!codes.has(l.dealer_code as string)) return;
    byStore.set(l.dealer_code as string, [...(byStore.get(l.dealer_code as string) ?? []), l]);
  });
  const lastPeriodOf = new Map<string, string>();
  (lastByStore ?? []).forEach((l) => {
    if (!lastPeriodOf.has(l.dealer_code as string) && l.period && l.period <= period) lastPeriodOf.set(l.dealer_code as string, l.period as string);
  });

  const stores: TrackStore[] = (dealers ?? []).map((d) => {
    const code = d.code as string;
    const coachRep = coachOf.get(code) ?? null;
    const coachName = coachRep ? (repMap.get(coachRep)?.name as string | undefined) : undefined;
    const subs = [...(byStore.get(code) ?? [])].sort(
      (a, b) =>
        Number(b.is_primary === true) - Number(a.is_primary === true) ||
        String(b.eval_date ?? "").localeCompare(String(a.eval_date ?? "")) ||
        String(b.submission_id).localeCompare(String(a.submission_id))
    );
    const submissions: EvalSubmission[] = subs.map((s, i) => ({
      submissionId: s.submission_id as string,
      evalDate: (s.eval_date as string | null) ?? null,
      inspector: (s.inspector as string | null) ?? null,
      pct: s.pct === null ? null : Number(s.pct),
      result: (s.result as string | null) ?? null,
      counted: i === 0,
      isPrimary: s.is_primary === true,
    }));
    const counted = submissions[0];
    const lastP = lastPeriodOf.get(code) ?? null;
    const req = reqAt(code, period);
    // นับเฉพาะเดือนที่ต้องตรวจ (ช่วงที่ปิดการตรวจไม่นับเป็นเดือนที่ขาด)
    const missedStreak = submissions.length ? 0 : lastP ? requiredMonthsBetween(code, lastP, period) : null;
    return {
      code,
      name: d.name as string,
      model: (d.model as string | null) ?? null,
      region: (d.region as string | null) ?? null,
      coachRep,
      areaRep: areaOf.get(code) ?? null,
      status: submissions.length ? "done" : "missing",
      duplicate: submissions.length > 1,
      proxy: !!counted && !!coachName && firstWord(counted.inspector) !== firstWord(coachName),
      submissions,
      missedStreak,
      chronic: req.required && !submissions.length && (missedStreak === null || missedStreak >= CHRONIC_MONTHS),
      lastEvalPeriod: lastP,
      required: req.required,
      exemptReason: req.required ? null : req.reason,
      exemptSince: req.required ? null : req.p,
    };
  });

  const groups = new Map<string | null, TrackStore[]>();
  stores.forEach((s) => groups.set(s.coachRep, [...(groups.get(s.coachRep) ?? []), s]));
  const coaches: TrackCoach[] = [...groups.entries()].map(([repCode, list]) => {
    const r = repCode ? repMap.get(repCode) : null;
    // ขาดติดกันก่อน -> ยังไม่ตรวจ -> ตรวจแล้ว -> ไม่ต้องตรวจ (ท้ายสุด)
    const sorted = list.sort(
      (a, b) =>
        Number(b.required) - Number(a.required) ||
        Number(b.chronic) - Number(a.chronic) ||
        Number(a.status === "done") - Number(b.status === "done") ||
        a.name.localeCompare(b.name, "th")
    );
    const lastEval = sorted.map((s) => lastPeriodOf.get(s.code)).filter(Boolean).sort().pop() ?? null;
    return {
      repCode,
      name: (r?.name as string | undefined) ?? (repCode ? repCode : "ยังไม่มี Coach"),
      nickname: (r?.nickname as string | null | undefined) ?? null,
      phone: (r?.phone as string | null | undefined) ?? null,
      photoUrl: (r?.photo_url as string | null | undefined) ?? null,
      ...countsOf(list),
      lastEvalPeriod: lastEval,
      stores: sorted,
    };
  });
  // ค้างมากสุดก่อน (สัดส่วนที่ตรวจแล้วน้อยสุด)
  // Coach ที่ทุกร้านปิดการตรวจ (total 0) ถือว่าครบ -> ไปท้าย
  const ratio = (x: TrackCoach) => (x.total ? x.done / x.total : 1);
  coaches.sort((a, b) => ratio(a) - ratio(b) || b.total - a.total);

  const today = bangkokToday();
  const dim = daysInMonth(period);
  const daysLeft = today.slice(0, 7) === period ? dim - Number(today.slice(8, 10)) : today.slice(0, 7) < period ? dim : 0;
  return {
    period,
    today,
    daysLeft,
    chronicMonths: CHRONIC_MONTHS,
    totals: totalsOf(stores),
    coaches,
  };
}

/** ตัวเลขของ Coach — นับเฉพาะร้านที่ต้องตรวจ */
function countsOf(list: TrackStore[]) {
  const req = list.filter((s) => s.required);
  return {
    total: req.length,
    done: req.filter((s) => s.status === "done").length,
    duplicates: req.filter((s) => s.duplicate).length,
    proxies: req.filter((s) => s.proxy).length,
    chronic: req.filter((s) => s.chronic).length,
    exempt: list.length - req.length,
  };
}

export function totalsOf(stores: TrackStore[]): Tracking["totals"] {
  const req = stores.filter((s) => s.required);
  return {
    stores: req.length,
    done: req.filter((s) => s.status === "done").length,
    missing: req.filter((s) => s.status === "missing").length,
    duplicates: req.filter((s) => s.duplicate).length,
    proxies: req.filter((s) => s.proxy).length,
    chronic: req.filter((s) => s.chronic).length,
    exempt: stores.length - req.length,
  };
}
