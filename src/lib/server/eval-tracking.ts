import type { createServiceClient } from "@/lib/supabase/service";

/* ติดตามการตรวจประเมินร้านรายเดือน (ใช้ทั้ง API หน้าติดตาม และงานแจ้งเตือนรายวัน)
   - ร้านที่ต้องตรวจ = ร้านที่เปิดใช้งาน (dealers.is_active) ทุกร้าน ; ผู้รับผิดชอบ = Coach ตาม rep_store_assignments
   - ร้านเดียวกันส่งหลายครั้งในเดือน = ตรวจซ้ำ ; ครั้งที่นับ = is_primary หรือครั้งล่าสุด (ตรงกับ view store_eval_effective)
   - ผู้ตรวจไม่ใช่ Coach ที่ดูแล = "ตรวจแทน" (เทียบชื่อต้น) */

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
  const [{ data: dealers }, { data: asg }, { data: lines }, { data: lastByStore }] = await Promise.all([
    dq,
    sb.from("rep_store_assignments").select("rep_code, dealer_code, role_in_store").in("role_in_store", ["coach", "manager"]),
    sb.from("store_eval_lines").select("submission_id, dealer_code, eval_date, inspector, pct, result, is_primary").eq("period", period).not("dealer_code", "is", null),
    sb.from("store_eval_lines").select("dealer_code, period").not("dealer_code", "is", null).order("period", { ascending: false }).limit(5000),
  ]);
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
    };
  });

  const groups = new Map<string | null, TrackStore[]>();
  stores.forEach((s) => groups.set(s.coachRep, [...(groups.get(s.coachRep) ?? []), s]));
  const coaches: TrackCoach[] = [...groups.entries()].map(([repCode, list]) => {
    const r = repCode ? repMap.get(repCode) : null;
    const sorted = list.sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.name.localeCompare(b.name, "th"));
    const lastEval = sorted.map((s) => lastPeriodOf.get(s.code)).filter(Boolean).sort().pop() ?? null;
    return {
      repCode,
      name: (r?.name as string | undefined) ?? (repCode ? repCode : "ยังไม่มี Coach"),
      nickname: (r?.nickname as string | null | undefined) ?? null,
      phone: (r?.phone as string | null | undefined) ?? null,
      photoUrl: (r?.photo_url as string | null | undefined) ?? null,
      total: list.length,
      done: list.filter((s) => s.status === "done").length,
      duplicates: list.filter((s) => s.duplicate).length,
      proxies: list.filter((s) => s.proxy).length,
      lastEvalPeriod: lastEval,
      stores: sorted,
    };
  });
  // ค้างมากสุดก่อน (สัดส่วนที่ตรวจแล้วน้อยสุด)
  coaches.sort((a, b) => a.done / Math.max(1, a.total) - b.done / Math.max(1, b.total) || b.total - a.total);

  const today = bangkokToday();
  const dim = daysInMonth(period);
  const daysLeft = today.slice(0, 7) === period ? dim - Number(today.slice(8, 10)) : today.slice(0, 7) < period ? dim : 0;
  return {
    period,
    today,
    daysLeft,
    totals: {
      stores: stores.length,
      done: stores.filter((s) => s.status === "done").length,
      missing: stores.filter((s) => s.status === "missing").length,
      duplicates: stores.filter((s) => s.duplicate).length,
      proxies: stores.filter((s) => s.proxy).length,
    },
    coaches,
  };
}
