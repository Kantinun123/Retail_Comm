"use client";

/* =============================================================
   Daily check-in — client data layer

   แนวทาง B (server-authoritative): source of truth อยู่ที่ Supabase
   ไฟล์นี้เป็นแค่ cache + pub/sub ของผลลัพธ์จาก /api/checkin
   - fetchCheckinState(empId): GET สถานะ
   - performCheckin(empId): POST เช็คอิน
   - getCachedState / subscribeCheckin: ให้หน้าอื่น (member) อ่านยอดแต้มเช็คอิน
   ============================================================= */

export interface CheckinState {
  ok: boolean;
  checkedToday: boolean;
  currentDay: number;      // วันในรอบล่าสุด (0 = ยังไม่เคย)
  currentStreak: number;
  nextDay: number;         // วันถัดไปถ้ากดตอนนี้ (1..7)
  nextPoints: number;      // แต้มถ้ากดตอนนี้
  checkinTotal: number;    // แต้มเช็คอินสะสมทั้งหมด (ทศนิยม)
  today: string;           // YYYY-MM-DD (server, Asia/Bangkok)
  error?: string;
}

export interface CheckinResult {
  ok: boolean;
  already: boolean;
  dayInCycle: number;
  streak: number;
  points: number;
  checkinTotal: number;
  error?: string;
}

/** แต้มต่อวันในรอบ (ตรงกับ reward schedule ฝั่ง server — ใช้แสดงปฏิทิน) */
export const CHECKIN_REWARDS: Record<number, number> = {
  1: 0.1,
  2: 0.2,
  3: 0.2,
  4: 0.2,
  5: 0.2,
  6: 0.2,
  7: 0.5,
};

export const CHECKIN_CYCLE_TOTAL = Object.values(CHECKIN_REWARDS).reduce(
  (a, b) => a + b,
  0
); // 1.6

/* ---------------- cache + pub/sub (key = empId) ---------------- */
const cache = new Map<string, CheckinState>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeCheckin(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** อ่าน state ที่ cache ไว้ (null ถ้ายังไม่โหลด) */
export function getCachedState(empId: string | null): CheckinState | null {
  if (!empId) return null;
  return cache.get(empId) ?? null;
}

/** ยอดแต้มเช็คอินสะสม (ทศนิยม) จาก cache — 0 ถ้ายังไม่โหลด */
export function checkinTotalPoints(empId: string | null): number {
  if (!empId) return 0;
  return cache.get(empId)?.checkinTotal ?? 0;
}

/* ---------------- map response (snake -> camel) ---------------- */
type RawState = {
  ok?: boolean;
  checked_today?: boolean;
  current_day?: number;
  current_streak?: number;
  next_day?: number;
  next_points?: number | string;
  checkin_total?: number | string;
  today?: string;
  error?: string;
};

function mapState(raw: RawState): CheckinState {
  return {
    ok: !!raw.ok,
    checkedToday: !!raw.checked_today,
    currentDay: Number(raw.current_day ?? 0),
    currentStreak: Number(raw.current_streak ?? 0),
    nextDay: Number(raw.next_day ?? 1),
    nextPoints: Number(raw.next_points ?? 0),
    checkinTotal: Number(raw.checkin_total ?? 0),
    today: raw.today ?? "",
    error: raw.error,
  };
}

/* ---------------- API calls ---------------- */

/** โหลดสถานะเช็คอินจาก server แล้วอัปเดต cache */
export async function fetchCheckinState(empId: string): Promise<CheckinState> {
  const res = await fetch(`/api/checkin?empId=${encodeURIComponent(empId)}`, {
    method: "GET",
    cache: "no-store",
  });
  const raw = (await res.json()) as RawState;
  const state = mapState(raw);
  if (state.ok) {
    cache.set(empId, state);
    emit();
  }
  return state;
}

/** เช็คอินวันนี้ — server เป็นผู้ตัดสินแต้ม/วัน; อัปเดต cache จากผลลัพธ์ */
export async function performCheckin(empId: string): Promise<CheckinResult> {
  const res = await fetch("/api/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empId }),
  });
  const raw = (await res.json()) as {
    ok?: boolean;
    already?: boolean;
    day_in_cycle?: number;
    streak?: number;
    points?: number | string;
    checkin_total?: number | string;
    error?: string;
  };

  const result: CheckinResult = {
    ok: !!raw.ok,
    already: !!raw.already,
    dayInCycle: Number(raw.day_in_cycle ?? 0),
    streak: Number(raw.streak ?? 0),
    points: Number(raw.points ?? 0),
    checkinTotal: Number(raw.checkin_total ?? 0),
    error: raw.error,
  };

  // อัปเดต cache ให้ตรงกับผลลัพธ์ล่าสุด (ไม่ต้อง refetch)
  if (result.ok) {
    const prev = cache.get(empId);
    cache.set(empId, {
      ok: true,
      checkedToday: true,
      currentDay: result.dayInCycle,
      currentStreak: result.streak,
      nextDay: result.dayInCycle, // เช็คแล้ววันนี้ -> โชว์วันปัจจุบัน
      nextPoints: CHECKIN_REWARDS[result.dayInCycle] ?? 0,
      checkinTotal: result.checkinTotal,
      today: prev?.today ?? "",
    });
    emit();
  }

  return result;
}
