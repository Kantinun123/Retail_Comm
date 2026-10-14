/* =============================================================
   แต้มที่ผู้ดูแลระบบเพิ่มให้พนักงาน (point adjustments)

   เก็บแยกจาก raw-data (ไม่ถูกทับเมื่ออัปโหลด) ใน localStorage
   - รวมเข้ายอดสะสม/อันดับ (leaderboard) และแต้มคงเหลือของพนักงาน
   - แสดงเป็นล็อตแต้ม (มีวันหมดอายุ 1 ปี) เพื่อให้ statement/คงเหลือตรงกัน
   คีย์ = empCode (= empId จริง)
   ============================================================= */
import { notify } from "./notifications";

export interface PointAdjustment {
  id: string;
  empCode: string;
  points: number;
  reason: string;
  /** epoch ms */
  time: number;
  /** ชื่อผู้เพิ่ม (แอดมิน) */
  byName: string;
}

const STORAGE_KEY = "cmPointAdjustments";

type Store = Record<string, PointAdjustment[]>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}
function writeStore(s: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeAdjustments(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** ประวัติการเพิ่มแต้มของพนักงานคนหนึ่ง (ใหม่สุดก่อน) */
export function getAdjustments(empCode: string): PointAdjustment[] {
  return (readStore()[empCode] ?? []).slice().sort((a, b) => b.time - a.time);
}

/** แต้มรวมที่ถูกเพิ่มให้พนักงานคนนี้ */
export function adjustmentTotal(empCode: string): number {
  return getAdjustments(empCode).reduce((a, x) => a + x.points, 0);
}

/** ปรับแต้มพนักงาน (เพิ่ม = points > 0, หัก = points < 0) เข้าทันที + แจ้งเตือน
 *  currentBalance: แต้มคงเหลือปัจจุบัน (ใช้กันหักเกินจนติดลบ) */
export function addAdjustment(opts: {
  empCode: string;
  empName: string;
  points: number; // + เพิ่ม / - หัก
  reason: string;
  byName: string;
  currentBalance?: number;
}): { ok: boolean; error?: string } {
  if (!opts.empCode) return { ok: false, error: "ไม่พบพนักงาน" };
  const pts = Math.round(opts.points);
  if (pts === 0) return { ok: false, error: "จำนวนแต้มต้องไม่เป็น 0" };
  // กันหักเกินแต้มคงเหลือ
  if (
    pts < 0 &&
    typeof opts.currentBalance === "number" &&
    Math.abs(pts) > opts.currentBalance
  ) {
    return { ok: false, error: "แต้มคงเหลือไม่พอให้หัก" };
  }

  const isAdd = pts > 0;
  const store = readStore();
  const list = store[opts.empCode] ?? [];
  const entry: PointAdjustment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    empCode: opts.empCode,
    points: pts,
    reason:
      opts.reason.trim() ||
      (isAdd ? "เพิ่มแต้มโดยผู้ดูแลระบบ" : "หักแต้มโดยผู้ดูแลระบบ"),
    time: Date.now(),
    byName: opts.byName,
  };
  store[opts.empCode] = [entry, ...list];
  writeStore(store);
  emit();

  // แจ้งพนักงาน
  notify({
    title: isAdd ? "ได้รับแต้มเพิ่ม" : "ถูกหักแต้ม",
    detail: `${isAdd ? "+" : "−"}${Math.abs(pts).toLocaleString("th-TH")} แต้ม · ${entry.reason}`,
    icon: isAdd ? "add_circle" : "remove_circle",
    audience: [`emp:${opts.empCode}`],
    link: "/app/member",
  });
  return { ok: true };
}
