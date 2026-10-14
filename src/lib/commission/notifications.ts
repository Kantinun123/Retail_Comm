/* =============================================================
   ระบบแจ้งเตือน (ระดับ 1 — ในเครื่อง)

   ตรวจจับการอัปเดตชุดข้อมูลผ่าน subscribeDataset ของ dataset store
   เมื่อจำนวนเรคคอร์ดของแต่ละ section เปลี่ยน จะบันทึกรายการแจ้งเตือน
   ลง localStorage (จำกัดจำนวน) และแจ้ง UI ให้ render ใหม่

   หมายเหตุ: เป็นการแจ้งเตือน "ในเครื่องนี้" เท่านั้น ไม่ใช่ push
   ข้ามอุปกรณ์/ผู้ใช้ (ซึ่งต้องใช้ backend realtime)
   ============================================================= */
import { getDataset, subscribeDataset, type DatasetSection } from "./dataset";

export interface NotifItem {
  id: string;
  /** section ของชุดข้อมูล (เฉพาะแจ้งเตือนอัปเดตข้อมูล) */
  section?: DatasetSection;
  title: string;
  detail: string;
  /** ไอคอนที่ใช้แสดง (ถ้าไม่ระบุ ใช้ไอคอนตาม section) */
  icon?: string;
  /** กลุ่มผู้รับ: "admin" หรือ owner key (emp:<id>/dealer:<code>)
   *  undefined/ว่าง = เห็นได้ทุกคน (เช่น แจ้งอัปเดตข้อมูล) */
  audience?: string[];
  /** ปลายทางเมื่อกดแจ้งเตือน (เช่น /app/redemptions?focus=<id>) */
  link?: string;
  /** epoch ms */
  time: number;
  read: boolean;
}

const LOG_KEY = "cmNotifLog";
const SNAPSHOT_KEY = "cmNotifSnapshot";
const MAX_ITEMS = 50;

/** จำนวนเรคคอร์ดต่อ section (ใช้ทำ snapshot เพื่อ diff) */
type Snapshot = Record<DatasetSection, number>;

const SECTION_META: Record<DatasetSection, { label: string; icon: string }> = {
  staff: { label: "ข้อมูลร้าน/พนักงาน", icon: "groups" },
  commission: { label: "ข้อมูลยอดขาย/ค่าคอมฯ", icon: "payments" },
  points: { label: "ข้อมูลแต้มกิจกรรม", icon: "stars" },
};

function sectionCounts(): Snapshot {
  const d = getDataset();
  return {
    staff: d.dealers.length + d.salesTeam.length + d.solutions.length,
    commission: d.sales.length,
    points: d.pointCompanies.length + d.pointEmployees.length,
  };
}

/* ---------------- storage helpers ---------------- */
function readLog(): NotifItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NotifItem[]) : [];
  } catch {
    return [];
  }
}

function writeLog(items: NotifItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore quota errors */
  }
}

function readSnapshot(): Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

function writeSnapshot(s: Snapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/* ---------------- pub/sub สำหรับ UI ---------------- */
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeNotifications(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** รายการนี้ส่งถึงผู้รับที่มี audience นี้ไหม
 *  - ไม่มี audience (undefined/ว่าง) = เห็นได้ทุกคน
 *  - มี audience = ต้องตรงกับหนึ่งใน myAudiences */
function visibleTo(n: NotifItem, myAudiences?: string[]): boolean {
  if (!n.audience || n.audience.length === 0) return true;
  if (!myAudiences || myAudiences.length === 0) return false;
  return n.audience.some((a) => myAudiences.includes(a));
}

/* ---------------- public API ---------------- */
export function getNotifications(myAudiences?: string[]): NotifItem[] {
  return readLog().filter((n) => visibleTo(n, myAudiences));
}

export function unreadCount(myAudiences?: string[]): number {
  return readLog().filter((n) => !n.read && visibleTo(n, myAudiences)).length;
}

export function markAllRead(myAudiences?: string[]) {
  const items = readLog().map((n) =>
    visibleTo(n, myAudiences) ? { ...n, read: true } : n
  );
  writeLog(items);
  emit();
}

export function clearNotifications() {
  writeLog([]);
  emit();
}

/** เพิ่มรายการแจ้งเตือนใหม่ไว้บนสุด */
function pushNotif(item: Omit<NotifItem, "id" | "time" | "read">) {
  const items = readLog();
  const next: NotifItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: Date.now(),
    read: false,
  };
  writeLog([next, ...items]);
  emit();
}

/** แจ้งเตือนแบบ event ตรง (ใช้จากฟีเจอร์อื่น เช่น การแลกแต้ม)
 *  audience: "admin" หรือ owner key — ไม่ระบุ = ทุกคน */
export function notify(opts: {
  title: string;
  detail: string;
  icon?: string;
  audience?: string[];
  link?: string;
}) {
  pushNotif({
    title: opts.title,
    detail: opts.detail,
    icon: opts.icon,
    audience: opts.audience,
    link: opts.link,
  });
}

/** เปรียบเทียบ snapshot เดิมกับปัจจุบัน แล้วบันทึกการเปลี่ยนแปลงที่พบ */
function detectChanges() {
  const prev = readSnapshot();
  const cur = sectionCounts();
  // ครั้งแรก: ยังไม่มี snapshot -> เก็บ baseline เงียบ ๆ ไม่แจ้งเตือน
  if (!prev) {
    writeSnapshot(cur);
    return;
  }
  (Object.keys(cur) as DatasetSection[]).forEach((sec) => {
    const before = prev[sec] ?? 0;
    const after = cur[sec] ?? 0;
    if (before === after) return;
    const meta = SECTION_META[sec];
    const diff = after - before;
    const diffText =
      diff > 0
        ? `เพิ่มขึ้น ${diff.toLocaleString("th-TH")} รายการ`
        : diff < 0
          ? `ลดลง ${Math.abs(diff).toLocaleString("th-TH")} รายการ`
          : "มีการเปลี่ยนแปลง";
    pushNotif({
      section: sec,
      title: `อัปเดต${meta.label}`,
      detail: `${diffText} · รวม ${after.toLocaleString("th-TH")} รายการ`,
      link: "/app/database",
    });
  });
  writeSnapshot(cur);
}

/* ---------------- init (client only, ครั้งเดียว) ---------------- */
let started = false;
export function initNotifications() {
  if (typeof window === "undefined" || started) return;
  started = true;
  // seed baseline ถ้ายังไม่มี
  if (!readSnapshot()) writeSnapshot(sectionCounts());
  // ฟังการเปลี่ยนแปลงชุดข้อมูล
  subscribeDataset(() => detectChanges());
}

/** ไอคอนของรายการแจ้งเตือน: ใช้ icon ที่ระบุ > ไอคอนตาม section > ค่าเริ่มต้น */
export function notifIcon(n: NotifItem): string {
  if (n.icon) return n.icon;
  if (n.section) return SECTION_META[n.section].icon;
  return "notifications";
}
