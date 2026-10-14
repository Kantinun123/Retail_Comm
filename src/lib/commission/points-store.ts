/* =============================================================
   ระบบแต้ม: ล็อต (วันหมดอายุ) + การแลกของรางวัล

   - ล็อตแต้ม derive จากยอดแต้มรวมของแต่ละคน แบบ deterministic
     (seed จาก key) เพื่อให้ "มีวันหมดอายุ" โดยไม่ต้องเก็บล็อตในไฟล์ดิบ
   - การแลก (redemptions) เก็บใน localStorage ของเครื่องนี้ (แนวทาง A)
   - แต้มคงเหลือ = แต้มในล็อตที่ยังไม่หมดอายุ − แต้มที่แลกไปแล้ว

   เป็นข้อมูล/การทำงานตัวอย่างในเครื่อง (ยังไม่ sync ข้ามอุปกรณ์)
   ============================================================= */
import type {
  PointLot,
  Redemption,
  RedemptionStatus,
  DeliveryMethod,
} from "./types";
import { notify } from "./notifications";

const STORAGE_KEY = "cmRedemptions";

/* ---------------- deterministic PRNG จาก string ---------------- */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * แบ่งยอดแต้มรวมเป็น 2-3 ล็อต โดยอิง seed จาก key (คงที่ต่อคน)
 * กำหนดวันได้มา/หมดอายุให้มีทั้งล็อตใกล้หมดและล็อตที่ยังอีกนาน
 * อายุแต้ม = 1 ปีนับจากวันได้มา
 */
export function deriveLots(key: string, total: number): PointLot[] {
  if (total <= 0) return [];
  const rnd = mulberry32(hashSeed(key));
  const nLots = total < 50 ? 1 : total < 200 ? 2 : 3;

  // สุ่มสัดส่วนการแบ่ง
  const weights = Array.from({ length: nLots }, () => 0.3 + rnd());
  const sumW = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => Math.max(1, Math.round((w / sumW) * total)));
  // ปรับให้รวมได้พอดี total
  let diff = total - parts.reduce((a, b) => a + b, 0);
  parts[0] += diff;
  if (parts[0] < 1) {
    diff = 1 - parts[0];
    parts[0] = 1;
  }

  // วันฐาน: วันนี้ (ใช้เวลาเครื่อง) ล็อตแรกได้มานานสุด -> ใกล้หมดอายุสุด
  const now = new Date();
  // ล็อตที่ i ได้มาเมื่อ ~ (nLots - i) * 4 เดือนก่อน -> หมดอายุ = ได้มา + 12 เดือน
  return parts.map((p, i) => {
    const monthsAgo = (nLots - i) * 4 - 1; // ล็อตแรกเก่าสุด
    const earned = new Date(now);
    earned.setMonth(earned.getMonth() - monthsAgo);
    const expire = new Date(earned);
    expire.setFullYear(expire.getFullYear() + 1);
    return { points: p, earnedDate: iso(earned), expireDate: iso(expire) };
  });
}

/** ล็อตที่ยังไม่หมดอายุ (เทียบกับวันนี้) */
export function activeLots(lots: PointLot[]): PointLot[] {
  const today = iso(new Date());
  return lots.filter((l) => l.expireDate >= today);
}

/** ล็อตที่ใกล้หมดอายุภายใน N วัน (ค่าเริ่มต้น 60) */
export function expiringLots(lots: PointLot[], withinDays = 60): PointLot[] {
  const now = new Date();
  const limit = new Date(now);
  limit.setDate(limit.getDate() + withinDays);
  const todayIso = iso(now);
  const limitIso = iso(limit);
  return activeLots(lots).filter(
    (l) => l.expireDate >= todayIso && l.expireDate <= limitIso
  );
}

/* ---------------- redemptions (localStorage) ---------------- */
type Store = Record<string, Redemption[]>;

const VALID_STATUSES: RedemptionStatus[] = [
  "pending",
  "approved",
  "shipping",
  "delivered",
  "received",
  "rejected",
];

/** คำขอที่ใช้งานได้: มี id + สถานะที่รู้จัก + timeline ครบ (กันข้อมูลเก่า/เสีย) */
function isValidRedemption(r: unknown): r is Redemption {
  if (!r || typeof r !== "object") return false;
  const o = r as Partial<Redemption>;
  return (
    typeof o.id === "string" &&
    typeof o.cost === "number" &&
    typeof o.status === "string" &&
    VALID_STATUSES.includes(o.status as RedemptionStatus) &&
    !!o.timeline &&
    typeof o.timeline === "object"
  );
}

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    // sanitize: ตัดคำขอที่โครงสร้างเสีย/สถานะเพี้ยนออก (migration อัตโนมัติ)
    const clean: Store = {};
    let dropped = false;
    for (const [key, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(list)) {
        dropped = true;
        continue;
      }
      const valid = list.filter(isValidRedemption);
      if (valid.length !== list.length) dropped = true;
      if (valid.length > 0) clean[key] = valid;
    }
    // ถ้ามีการตัดข้อมูลเสีย เขียนกลับทันทีให้สะอาด
    if (dropped) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      } catch {
        /* ignore */
      }
    }
    return clean;
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
export function subscribeRedemptions(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getRedemptions(key: string | null): Redemption[] {
  if (!key) return [];
  return (readStore()[key] ?? []).slice().sort((a, b) => b.time - a.time);
}

/** คำขอทั้งหมดจากทุกคน (สำหรับแอดมิน) เรียงใหม่สุดก่อน */
export function getAllRedemptions(): Redemption[] {
  const store = readStore();
  return Object.values(store)
    .flat()
    .sort((a, b) => b.time - a.time);
}

/** แต้มที่ถูกใช้ไป (ไม่นับคำขอที่ถูกปฏิเสธ = คืนแต้มแล้ว) */
export function redeemedPoints(key: string | null): number {
  return getRedemptions(key)
    .filter((r) => r.status !== "rejected")
    .reduce((a, r) => a + r.cost, 0);
}

/** แต้มคงเหลือที่ใช้ได้ = ล็อตที่ยังไม่หมดอายุ − ที่แลกไปแล้ว (ไม่ต่ำกว่า 0) */
export function availableBalance(
  key: string | null,
  lots: PointLot[]
): number {
  const active = activeLots(lots).reduce((a, l) => a + l.points, 0);
  return Math.max(0, active - redeemedPoints(key));
}

export interface RedeemResult {
  ok: boolean;
  error?: string;
}

/** เลขคำขอถัดไป (นับจากจำนวนคำขอทั้งหมด) */
function nextReqNo(): string {
  const n = getAllRedemptions().length + 1;
  return "RDM-" + String(n).padStart(6, "0");
}

/** แลกของรางวัล: หักแต้มทันที (สถานะ pending รออนุมัติ) — กันแลกเกินแต้มคงเหลือ */
export function redeem(
  key: string | null,
  gift: { id: string; name: string; cost: number },
  lots: PointLot[],
  opts: { ownerName: string; method: DeliveryMethod; address?: string }
): RedeemResult {
  if (!key) return { ok: false, error: "บัญชีนี้แลกแต้มไม่ได้" };
  const balance = availableBalance(key, lots);
  if (gift.cost > balance) {
    return { ok: false, error: "แต้มคงเหลือไม่พอ" };
  }
  if (opts.method === "parcel" && !opts.address?.trim()) {
    return { ok: false, error: "กรุณาระบุที่อยู่จัดส่ง" };
  }
  const now = Date.now();
  const store = readStore();
  const list = store[key] ?? [];
  const entry: Redemption = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    reqNo: nextReqNo(),
    giftId: gift.id,
    giftName: gift.name,
    cost: gift.cost,
    time: now,
    status: "pending",
    method: opts.method,
    address: opts.method === "parcel" ? opts.address?.trim() : undefined,
    timeline: {
      requested: now,
      reviewed: null,
      shipping: null,
      delivered: null,
      received: null,
    },
    ownerKey: key,
    ownerName: opts.ownerName,
  };
  store[key] = [entry, ...list];
  writeStore(store);
  emit();
  // แจ้งแอดมิน: มีคำขอใหม่
  notify({
    title: "คำขอแลกของรางวัลใหม่",
    detail: `${entry.reqNo} · ${opts.ownerName} · ${gift.name}`,
    icon: "redeem",
    audience: ["admin"],
    link: `/app/redemptions?focus=${entry.id}`,
  });
  return { ok: true };
}

/** การกระทำของแอดมินต่อคำขอ */
export type RedemptionAction = "approve" | "reject" | "deliver";

/** อัปเดตสถานะคำขอ (ฝั่งแอดมิน)
 *  - approve: pending -> shipping (ประทับ reviewed + shipping)
 *  - reject:  pending -> rejected (ประทับ reviewed + เหตุผล, คืนแต้มอัตโนมัติเพราะไม่ถูกนับ)
 *  - deliver: shipping -> delivered (ประทับ delivered + เลขพัสดุถ้า parcel) */
export function updateRedemptionStatus(
  ownerKey: string,
  id: string,
  action: RedemptionAction,
  extra?: { rejectReason?: string; trackingNo?: string }
): RedeemResult {
  const store = readStore();
  const list = store[ownerKey];
  if (!list) return { ok: false, error: "ไม่พบคำขอ" };
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "ไม่พบคำขอ" };
  const r = { ...list[idx] };
  const now = Date.now();

  if (action === "approve") {
    if (r.status !== "pending") return { ok: false, error: "สถานะไม่ถูกต้อง" };
    r.status = "shipping";
    r.timeline = { ...r.timeline, reviewed: now, shipping: now };
  } else if (action === "reject") {
    if (r.status !== "pending") return { ok: false, error: "สถานะไม่ถูกต้อง" };
    r.status = "rejected";
    r.rejectReason = extra?.rejectReason?.trim() || "ไม่ระบุเหตุผล";
    r.timeline = { ...r.timeline, reviewed: now };
  } else if (action === "deliver") {
    if (r.status !== "shipping") return { ok: false, error: "สถานะไม่ถูกต้อง" };
    r.status = "delivered";
    if (r.method === "parcel") r.trackingNo = extra?.trackingNo?.trim() || undefined;
    r.timeline = { ...r.timeline, delivered: now };
  }

  const nextList = list.slice();
  nextList[idx] = r;
  store[ownerKey] = nextList;
  writeStore(store);
  emit();

  // แจ้งเจ้าของคำขอ: สถานะเปลี่ยน
  const ownerMsg: Record<string, string> = {
    approve: `${r.reqNo} ได้รับการอนุมัติ · เตรียมจัดส่ง`,
    reject: `${r.reqNo} ไม่อนุมัติ · คืนแต้มแล้ว`,
    deliver: `${r.reqNo} จัดส่งของรางวัลแล้ว`,
  };
  const ownerIcon: Record<string, string> = {
    approve: "check_circle",
    reject: "cancel",
    deliver: "task_alt",
  };
  notify({
    title: `สถานะคำขอ: ${r.giftName}`,
    detail: ownerMsg[action] ?? r.reqNo,
    icon: ownerIcon[action] ?? "redeem",
    audience: [ownerKey],
    link: `/app/my-redemptions?focus=${r.id}`,
  });
  return { ok: true };
}

/** สมาชิกยืนยันรับของ (เฉพาะสถานะ delivered) + แนบรูปหลักฐาน (ไม่บังคับ หลายรูป) */
export function confirmReceived(
  ownerKey: string,
  id: string,
  photos: string[]
): RedeemResult {
  const store = readStore();
  const list = store[ownerKey];
  if (!list) return { ok: false, error: "ไม่พบคำขอ" };
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "ไม่พบคำขอ" };
  const r = { ...list[idx] };
  if (r.status !== "delivered") return { ok: false, error: "สถานะไม่ถูกต้อง" };

  const now = Date.now();
  r.status = "received";
  r.timeline = { ...r.timeline, received: now };
  if (photos.length > 0) r.proofPhotos = photos;

  const nextList = list.slice();
  nextList[idx] = r;
  store[ownerKey] = nextList;
  writeStore(store);
  emit();

  // แจ้งแอดมิน: สมาชิกรับของแล้ว
  notify({
    title: "สมาชิกยืนยันรับของแล้ว",
    detail: `${r.reqNo} · ${r.ownerName} · ${r.giftName}`,
    icon: "inventory_2",
    audience: ["admin"],
    link: `/app/redemptions?focus=${r.id}`,
  });
  return { ok: true };
}

/* ---------------- meta สำหรับแสดงผล timeline ---------------- */
export const REDEMPTION_STATUS_META: Record<
  RedemptionStatus,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "รออนุมัติการแลกแต้ม", color: "#f59e0b", icon: "hourglass_top" },
  approved: { label: "อนุมัติแล้ว", color: "#16a34a", icon: "check_circle" },
  shipping: { label: "รอจัดส่งของรางวัล", color: "#0ea5e9", icon: "local_shipping" },
  delivered: { label: "จัดส่งของรางวัลแล้ว", color: "#0ea5e9", icon: "local_shipping" },
  received: { label: "รับของแล้ว", color: "#16a34a", icon: "inventory_2" },
  rejected: { label: "ไม่อนุมัติการแลกแต้ม", color: "#dc2626", icon: "cancel" },
};

/** meta ของสถานะแบบปลอดภัย — กันข้อมูลเก่า/สถานะที่ไม่รู้จัก (status undefined) */
export function statusMeta(status: RedemptionStatus | undefined | null): {
  label: string;
  color: string;
  icon: string;
} {
  return (
    (status && REDEMPTION_STATUS_META[status]) ?? {
      label: "ไม่ทราบสถานะ",
      color: "#94a3b8",
      icon: "help",
    }
  );
}

export const DELIVERY_METHOD_META: Record<
  DeliveryMethod,
  { label: string; icon: string }
> = {
  self: { label: "รับเอง", icon: "storefront" },
  team: { label: "ทีมงานรับให้", icon: "groups" },
  parcel: { label: "จัดส่งพัสดุ", icon: "local_shipping" },
};

/* ---------------- รายการเดินแต้ม (statement แบบแอปธนาคาร) ---------------- */
export type StatementKind = "earn" | "use" | "refund";

export interface StatementEntry {
  id: string;
  kind: StatementKind;
  label: string;
  /** จำนวนแต้ม: + รับเข้า, − ใช้ไป */
  amount: number;
  /** epoch ms (ไม่มีเวลาจริง เช่นล็อต = เที่ยงของวัน) */
  time: number;
}

/** สร้างรายการเดินแต้ม: รับ(ล็อต) + ใช้(แลกที่ไม่ถูกปฏิเสธ) + คืน(ถูกปฏิเสธ) */
export function pointsStatement(
  key: string | null,
  lots: PointLot[]
): StatementEntry[] {
  if (!key) return [];
  const entries: StatementEntry[] = [];

  // รับแต้ม — จากล็อต (ใช้เที่ยงวันของ earnedDate เป็นเวลา)
  lots.forEach((l, i) => {
    entries.push({
      id: `earn-${l.earnedDate}-${i}`,
      kind: "earn",
      label: "รับแต้มกิจกรรม",
      amount: l.points,
      time: new Date(l.earnedDate + "T12:00:00").getTime(),
    });
  });

  // ใช้แต้ม / คืนแต้ม — จากคำขอแลก
  getRedemptions(key).forEach((r) => {
    if (r.status === "rejected") {
      // ใช้ตอนกดแลก แล้วคืนตอนถูกปฏิเสธ -> แสดง 2 รายการให้ยอดตรง
      entries.push({
        id: `use-${r.id}`,
        kind: "use",
        label: `แลก ${r.giftName}`,
        amount: -r.cost,
        time: r.timeline.requested,
      });
      entries.push({
        id: `refund-${r.id}`,
        kind: "refund",
        label: `คืนแต้ม (${r.giftName} ไม่อนุมัติ)`,
        amount: r.cost,
        time: r.timeline.reviewed ?? r.timeline.requested,
      });
    } else {
      entries.push({
        id: `use-${r.id}`,
        kind: "use",
        label: `แลก ${r.giftName}`,
        amount: -r.cost,
        time: r.timeline.requested,
      });
    }
  });

  return entries.sort((a, b) => b.time - a.time);
}
