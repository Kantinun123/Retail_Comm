/* Mock: CRM (Lead -> Opp -> ปิดขาย -> ติดตามหน่วยงานอื่น) ตาม Project Timeline งาน Roof Installation (01/08/2026)
   ข้อมูลสมมติในหน่วยความจำ — ชื่อลูกค้าเป็นชื่อสมมติทั้งหมด
   หน่วยงานปลายทาง (KIM / SCM / ห้องแบบ) เป็นแอปอื่น: CRM จ่ายข้อมูลออก และรับสถานะ/ไฟล์กลับเข้ามา */

/** เวลา "ตอนนี้" ของ Mock (คงที่ เพื่อให้ SLA/งานค้างแสดงผลเหมือนเดิมทุกครั้ง) — วันอังคาร */
export const NOW = new Date("2026-11-24T10:30:00+07:00");
/** SLA ติดต่อลูกค้าครั้งแรก (ชั่วโมง) ตามช่องทาง — ตามต้นแบบของทีม JV */
export const SLA_BY_CHANNEL: Record<string, number> = { "Home Online": 24, "Contact Center": 4, "Walk-in": 2, "LINE OA": 4, "Dealer Referral": 24 };
export const slaHoursOf = (channel: string) => SLA_BY_CHANNEL[channel] ?? 24;
/** ติดต่อไม่ได้ครบกี่ครั้งถึงนับเป็น Loss */
export const MAX_CONTACT_TRIES = 3;
export const DEPOSIT_PCT = 30;
/** มัดจำคงที่ของโมเดล SCG Home (ร้าน Housing Expert ใช้ 30% ของราคา) */
export const DEPOSIT_SCG = 30000;
const TZ = "Asia/Bangkok";
const BKK = 7 * 3600e3;

const hAgo = (h: number) => new Date(NOW.getTime() - h * 3600e3).toISOString();
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const atHour = (ymd: string, hour: number) => new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00+07:00`).toISOString();
const dFromNow = (d: number, hour = 10) => atHour(dayKey(new Date(NOW.getTime() + d * 86400e3).toISOString()), hour);

/** บวกวันทำการ (ไม่นับเสาร์-อาทิตย์ ; Mock ไม่นับวันหยุดนักขัตฤกษ์) ผลลัพธ์ = 17:00 ของวันนั้น */
export function addWd(iso: string, n: number): string {
  let t = new Date(iso).getTime();
  let left = n;
  while (left > 0) {
    t += 86400e3;
    const dow = new Date(t + BKK).getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return atHour(dayKey(new Date(t).toISOString()), 17);
}
/** จำนวนวันทำการจาก a ไปถึง b (บวก = b อยู่หลัง a) นับระดับวัน */
export function wdBetween(a: string, b: string): number {
  const sign = new Date(b).getTime() >= new Date(a).getTime() ? 1 : -1;
  const [from, to] = sign > 0 ? [a, b] : [b, a];
  let cur = new Date(from).getTime();
  const end = dayKey(to);
  let n = 0;
  while (dayKey(new Date(cur).toISOString()) < end) {
    cur += 86400e3;
    const dow = new Date(cur + BKK).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return sign * n;
}
const subWd = (n: number, hour = 9) => {
  let t = NOW.getTime();
  let left = n;
  while (left > 0) {
    t -= 86400e3;
    const dow = new Date(t + BKK).getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return atHour(dayKey(new Date(t).toISOString()), hour);
};

/* ---------- Lead ---------- */
export type LeadStatus = "waiting" | "contacting" | "qualified" | "converted" | "dealer" | "lost";
export type DealerStep = "sent" | "accepted" | "quoted" | "won" | "lost";
export interface Lead {
  id: string; name: string; phone: string; product: string; channel: string; province: string;
  createdAt: string; firstContactAt?: string; status: LeadStatus; note?: string; lostReason?: string; interest?: string; tries?: number;
  /** สายสินค้า: ส่งให้ร้านทำใบเสนอราคาในระบบร้าน */
  district?: string; /** ร้านที่รับพื้นที่นี้ (คำนวณจากตารางพื้นที่ ไม่เก็บ) */ store?: string; owner?: string;
  visitAt?: string; dealerStore?: string; dealerStep?: DealerStep; dealerAmount?: number; sentAt?: string;
}
export const PRODUCTS = ["Roof Install", "Solar Roof", "Roof Repair", "Ceiling & Insulation", "Home Automation"];
export const CHANNELS = ["Home Online", "Contact Center", "LINE OA", "Walk-in", "Dealer Referral", "ลูกค้าเดิม"];
export const OWNERS = ["ฝน", "บอส", "มิ้น"];
export const LEAD_STATUS: Record<LeadStatus, { label: string; cls: string }> = {
  waiting: { label: "รอติดต่อ", cls: "bg-amber-100 text-amber-800" },
  contacting: { label: "กำลังสกรีน", cls: "bg-sky-100 text-sky-800" },
  qualified: { label: "รอเปิด Opp", cls: "bg-violet-100 text-violet-800" },
  converted: { label: "เปิด Opp แล้ว", cls: "bg-emerald-100 text-emerald-800" },
  dealer: { label: "ส่งให้ร้านแล้ว", cls: "bg-fuchsia-100 text-fuchsia-800" },
  lost: { label: "Loss", cls: "bg-rose-100 text-rose-700" },
};
export const DEALER_STEP: Record<DealerStep, { label: string; cls: string }> = {
  sent: { label: "รอร้านรับ", cls: "bg-fuchsia-50 text-fuchsia-700" },
  accepted: { label: "ร้านรับแล้ว", cls: "bg-sky-50 text-sky-700" },
  quoted: { label: "ร้านเสนอราคาแล้ว", cls: "bg-violet-50 text-violet-700" },
  won: { label: "ร้านปิดขาย", cls: "bg-emerald-100 text-emerald-800" },
  lost: { label: "ร้านแจ้ง Loss", cls: "bg-rose-50 text-rose-700" },
};
/* ---------- ตารางพื้นที่รับงานของร้าน (ใช้จ่าย Lead ออนไลน์) ---------- */
export interface Coverage { store: string; province: string; district?: string; priority: number }
export const DEFAULT_COVERAGE: Coverage[] = [
  { store: "ร้านหาดใหญ่โฮม", province: "สงขลา", district: "หาดใหญ่", priority: 1 },
  { store: "ร้านหาดใหญ่โฮม", province: "สงขลา", priority: 1 },
  { store: "ร้านสงขลาวัสดุ", province: "สงขลา", district: "เมืองสงขลา", priority: 1 },
  { store: "ร้านสงขลาวัสดุ", province: "สงขลา", priority: 2 },
  { store: "ร้านภูเก็ตวัสดุ", province: "ภูเก็ต", priority: 1 },
  { store: "ร้านขอนแก่นโฮม", province: "ขอนแก่น", priority: 1 },
  { store: "ร้านโคราชซีเมนต์", province: "นครราชสีมา", priority: 1 },
  { store: "ร้านขอนแก่นโฮม", province: "นครราชสีมา", priority: 2 },
  { store: "ร้านอุดรวัสดุ", province: "อุดรธานี", priority: 1 },
  { store: "ร้านชลบุรีโฮม", province: "ชลบุรี", priority: 1 },
  { store: "ร้านชลบุรีโฮม", province: "ระยอง", priority: 1 },
  { store: "ร้านเชียงใหม่ซีเมนต์", province: "เชียงใหม่", priority: 1 },
  { store: "ร้านกรุงเทพโฮม", province: "กรุงเทพมหานคร", priority: 1 },
  { store: "ร้านกรุงเทพโฮม", province: "นครปฐม", priority: 1 },
  { store: "ร้านนครสวรรค์วัสดุ", province: "นครสวรรค์", priority: 1 },
];
/** ร้านที่รับพื้นที่นี้: ตรงอำเภอก่อน แล้วเรียงตามลำดับ ; candidates = ทุกร้านที่รับพื้นที่ (เรียงตามลำดับจ่ายงาน) */
export function assignStore(cov: Coverage[], province: string, district?: string): { store: string | null; candidates: string[] } {
  const p = province.trim();
  const d = (district ?? "").trim();
  const rows = cov.filter((c) => c.province === p && (!c.district || (d && c.district === d)));
  rows.sort((a, b) => (a.district ? 0 : 1) - (b.district ? 0 : 1) || a.priority - b.priority);
  const candidates = [...new Set(rows.map((r) => r.store))];
  return { store: candidates[0] ?? null, candidates };
}
export const ROLE_STORES: Record<"coach" | "dealer", string[]> = { coach: ["ร้านหาดใหญ่โฮม", "ร้านสงขลาวัสดุ", "ร้านภูเก็ตวัสดุ"], dealer: ["ร้านหาดใหญ่โฮม"] };
const hashOf = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
export const ownerOfLead = (id: string) => OWNERS[hashOf(id) % OWNERS.length];
export const DEALER_STORES = ["ร้านอุดรวัสดุ", "ร้านขอนแก่นโฮม", "ร้านหาดใหญ่โฮม", "ร้านภูเก็ตวัสดุ", "ร้านชลบุรีโฮม", "ร้านเชียงใหม่ซีเมนต์"];
export const DEALER_LOST = ["ลูกค้าต้องการเปรียบเทียบราคาเท่านั้น", "ยังไม่ตัดสินใจ รอพิจารณา", "ยังไม่มีแผนต่อเติมในช่วงนี้", "ราคาสูง ซื้อ SCG ที่ร้านอื่น", "ราคาสูง เปลี่ยนยี่ห้ออื่น", "สินค้าไม่พร้อมขาย ซื้อ SCG ที่ร้านอื่น", "สินค้าไม่พร้อมขาย เปลี่ยนยี่ห้ออื่น", "ไม่ตรงกับความต้องการลูกค้า"];
export const LOST_REASONS = ["งบประมาณไม่ถึง", "ยังไม่พร้อมต่อเติม", "อยู่นอกพื้นที่บริการ", "ติดต่อไม่ได้", "เลือกผู้ให้บริการอื่น"];

/* ---------- หน่วยงาน ---------- */
export type Party = "SE" | "KIM" | "SCM" | "ROOM" | "SURV";
export const PARTY: Record<Party, { label: string; sub: string; cls: string; icon: string }> = {
  SE: { label: "ทีมขาย", sub: "Lead · Opp · ใบเสนอราคา · ปิดขาย", cls: "bg-indigo-100 text-indigo-700", icon: "badge" },
  KIM: { label: "KIM", sub: "สำรวจ · แผนติดตั้ง · ควบคุมงาน · ส่งมอบ", cls: "bg-cyan-100 text-cyan-800", icon: "engineering" },
  SCM: { label: "SCM", sub: "เตรียมสินค้า · สั่งโรงงาน · ขนส่ง", cls: "bg-amber-100 text-amber-800", icon: "inventory_2" },
  ROOM: { label: "ห้องแบบ", sub: "ขีดแนวอะเส · แบบทรัส · Cutting List", cls: "bg-fuchsia-100 text-fuchsia-800", icon: "architecture" },
  SURV: { label: "ทีมสำรวจ", sub: "สำรวจหน้างาน Smart Solution · รายงานสำรวจ · ใบเสนอราคา", cls: "bg-teal-100 text-teal-800", icon: "engineering" },
};

/* ---------- Project Timeline (แม่แบบตามไฟล์ PT) ---------- */
export type Segment = "general" | "hbd";
export type Work = "roof" | "truss" | "ase" | "survey";
/** ค่าสำรวจของงานชนิดสำรวจ (ค่าสมมติ รอยืนยัน) หักจากค่าติดตั้งตอนปิดขาย */
export const SURVEY_FEE = 1500;
export type StepKey = "plan_in" | "ase_mark" | "truss_design" | "quote1" | "deposit" | "survey" | "quote2" | "close" | "install_plan" | "deliver" | "install" | "handover";
export interface Send { party: Party; title: string; at: "start" | "done" }
export interface StepDef { key: StepKey; label: string; owner: Party; day: number; post: boolean; hint: string; sends: Send[]; result?: string }

export const SEGMENT_LABEL: Record<Segment, string> = { general: "ลูกค้าทั่วไป", hbd: "HBD Focus (ปิดขายจากแบบ)" };
export const WORK_LABEL: Record<Work, string> = { roof: "มุงหลังคาอย่างเดียว", truss: "โครงทรัส + มุงหลังคา", ase: "อะเส + โครงทรัส + มุงหลังคา", survey: "งานสำรวจ (Smart Solution / BA)" };

const DAYS: Record<Segment, Record<Work, Partial<Record<StepKey, number>>>> = {
  general: {
    roof: { plan_in: 1, quote1: 3, deposit: 4, survey: 9, quote2: 11, close: 12, install_plan: 15, deliver: 23, install: 30, handover: 31 },
    truss: { plan_in: 1, ase_mark: 4, quote1: 6, deposit: 7, survey: 12, truss_design: 16, quote2: 18, close: 19, install_plan: 21, deliver: 35, install: 42, handover: 43 },
    ase: { plan_in: 1, ase_mark: 4, quote1: 6, deposit: 7, survey: 12, truss_design: 16, quote2: 18, close: 19, install_plan: 21, deliver: 37, install: 44, handover: 45 },
    survey: { plan_in: 1, deposit: 2, survey: 7, quote2: 10, close: 12, install_plan: 15, deliver: 23, install: 30, handover: 31 },
  },
  hbd: {
    roof: { plan_in: 1, quote1: 3, close: 4, install_plan: 7, deliver: 15, install: 22, handover: 23 },
    truss: { plan_in: 1, truss_design: 5, quote1: 7, close: 8, install_plan: 11, deliver: 24, install: 31, handover: 32 },
    ase: { plan_in: 1, truss_design: 5, quote1: 7, close: 8, install_plan: 11, deliver: 26, install: 33, handover: 34 },
    survey: { plan_in: 1, deposit: 2, survey: 7, quote2: 10, close: 12, install_plan: 15, deliver: 23, install: 30, handover: 31 },
  },
};
const ORDER: Record<Segment, Record<Work, StepKey[]>> = {
  general: {
    roof: ["plan_in", "quote1", "deposit", "survey", "quote2", "close", "install_plan", "deliver", "install", "handover"],
    truss: ["plan_in", "ase_mark", "quote1", "deposit", "survey", "truss_design", "quote2", "close", "install_plan", "deliver", "install", "handover"],
    ase: ["plan_in", "ase_mark", "quote1", "deposit", "survey", "truss_design", "quote2", "close", "install_plan", "deliver", "install", "handover"],
    survey: ["plan_in", "deposit", "survey", "quote2", "close", "install_plan", "deliver", "install", "handover"],
  },
  hbd: {
    roof: ["plan_in", "quote1", "close", "install_plan", "deliver", "install", "handover"],
    truss: ["plan_in", "truss_design", "quote1", "close", "install_plan", "deliver", "install", "handover"],
    ase: ["plan_in", "truss_design", "quote1", "close", "install_plan", "deliver", "install", "handover"],
    survey: ["plan_in", "deposit", "survey", "quote2", "close", "install_plan", "deliver", "install", "handover"],
  },
};
const POST: StepKey[] = ["install_plan", "deliver", "install", "handover"];
const DELIVER_LABEL: Record<Work, string> = { roof: "ส่งกระเบื้อง", truss: "ส่งทรัส & กระเบื้อง", ase: "ส่งอะเส + ทรัส & กระเบื้อง", survey: "ส่งอุปกรณ์เข้าหน้างาน" };
const INSTALL_LABEL: Record<Work, string> = { roof: "ติดตั้งกระเบื้อง", truss: "ติดตั้งทรัส & กระเบื้อง", ase: "ติดตั้งอะเส & ทรัส & กระเบื้อง", survey: "ติดตั้งหน้างาน" };

function surveyMeta(key: StepKey): Omit<StepDef, "day" | "post" | "key"> | null {
  switch (key) {
    case "plan_in": return { label: "เปิด Opp รับความต้องการ", owner: "SE", hint: "ทีมขายเปิด Opp และสรุปความต้องการลูกค้า (งานชนิดสำรวจไม่มีขั้นรับแบบ/ถอดแบบ)", sends: [] };
    case "deposit": return { label: "เก็บค่าสำรวจ + ส่งงานให้ทีมสำรวจ", owner: "SE", hint: "ลูกค้าชำระค่าสำรวจ ล็อกวันนัดสำรวจ แล้วส่งข้อมูลลูกค้า/หน้างานเข้าแอปทีมสำรวจ", sends: [{ party: "SURV", title: "ข้อมูลลูกค้า/หน้างาน + วันนัดสำรวจที่ล็อกคิวแล้ว", at: "done" }] };
    case "survey": return { label: "ลงสำรวจ + ส่งรายงานสำรวจและใบเสนอราคา", owner: "SURV", hint: "ทีมสำรวจเข้าสำรวจหน้างาน แล้วส่งรายงานสำรวจและใบเสนอราคากลับมาให้ทีมขาย", sends: [], result: "รายงานสำรวจ + ใบเสนอราคา (ไฟล์)" };
    case "quote2": return { label: "นำเสนอราคาให้ลูกค้า", owner: "SE", hint: "ทีมขายนำใบเสนอราคาจากทีมสำรวจเสนอลูกค้า ตามผลและต่อรอง", sends: [] };
    case "close": return { label: "ปิดขาย + เก็บค่าติดตั้ง", owner: "SE", hint: "เก็บค่าติดตั้ง (หักค่าสำรวจแล้ว) แล้วส่งข้อมูลปิดขายให้ KIM และรายการสินค้าให้ SCM", sends: [{ party: "KIM", title: "ข้อมูลปิดขาย เพื่อเตรียมแผนติดตั้ง", at: "done" }, { party: "SCM", title: "รายการสินค้า/อุปกรณ์ (เตรียมของ + ขนส่ง)", at: "done" }] };
    default: return null;
  }
}
function meta(key: StepKey, seg: Segment, work: Work): Omit<StepDef, "day" | "post" | "key"> {
  if (work === "survey") { const m = surveyMeta(key); if (m) return m; }
  switch (key) {
    case "plan_in": return { label: "รับแบบ", owner: "SE", hint: "ทีมขายรับแบบจากลูกค้า และเปิด Opp", sends: [] };
    case "ase_mark": return { label: "ขีดแนวอะเส", owner: "ROOM", hint: "ห้องแบบขีดแนวอะเส ส่งผลกลับมาให้ทีมขายใช้ทำประมาณการ", sends: [{ party: "ROOM", title: "ข้อมูลลูกค้า + แบบแปลน ขอขีดแนวอะเส", at: "start" }], result: "ผลขีดแนวอะเส (ไฟล์)" };
    case "truss_design":
      return seg === "hbd"
        ? { label: "ขีดแนวอะเส + ทำแบบทรัส + Cutting List", owner: "ROOM", hint: "ลูกค้า HBD ส่งแบบมา ห้องแบบทำแบบทรัสทันที ไม่ต้องรอสำรวจ", sends: [{ party: "ROOM", title: "แบบแปลน ขอขีดแนวอะเส + ทำแบบทรัส", at: "start" }], result: "แบบทรัส + Cutting List (ไฟล์)" }
        : { label: "ทำแบบทรัส + Cutting List", owner: "ROOM", hint: "ส่งรายงานสำรวจจาก KIM ให้ห้องแบบทำแบบทรัสและ Cutting List", sends: [{ party: "ROOM", title: "รายงานสำรวจ + แบบ ขอทำแบบทรัส/Cutting List", at: "start" }], result: "แบบทรัส + Cutting List (ไฟล์)" };
    case "quote1": return { label: "เสนอราคาจากแบบ", owner: "SE", hint: work === "roof" ? "ทีมขายถอดแบบรายหมวด ทำประมาณการ และส่งใบเสนอราคาให้ลูกค้า" : "ทีมขายถอดแบบรายหมวดโดยใช้ผลขีดแนวอะเสจากห้องแบบ ทำประมาณการ แล้วส่งใบเสนอราคาให้ลูกค้า", sends: [] };
    case "deposit": return { label: "ปิดมัดจำ + ล็อกคิวสำรวจ", owner: "SE", hint: "ลูกค้าจ่ายมัดจำบนแอป ล็อกวันเข้าสำรวจ แล้วส่งข้อมูลให้ KIM และรายการจองสินค้าให้ SCM", sends: [{ party: "KIM", title: "ข้อมูลงานสำรวจ + วันนัดสำรวจที่ล็อกคิวแล้ว", at: "done" }, { party: "SCM", title: "รายการสินค้าที่ขอจอง (กันสินค้า)", at: "done" }] };
    case "survey": return { label: "สำรวจหน้างาน + รายงานสำรวจ", owner: "KIM", hint: "KIM เข้าสำรวจตามวันนัด และส่งไฟล์รายงานสำรวจกลับมา", sends: [], result: "รายงานสำรวจ (ไฟล์)" };
    case "quote2": return { label: "เสนอราคาหลังสำรวจ", owner: "SE", hint: work === "roof" ? "ทีมขายถอดแบบละเอียดตามรายงานสำรวจ (Confirm/Revise รายหมวด) แล้วเสนอราคาใหม่" : "ทีมขายถอดแบบละเอียด เช็ครายงานสำรวจ + แบบทรัส/Cutting List จากห้องแบบ แล้วทำใบเสนอราคาฉบับหลังสำรวจ", sends: [] };
    case "close": return { label: "ปิดขาย (ลูกค้าจ่ายครบ 100%)", owner: "SE", hint: "เก็บเงินครบ แล้วส่งข้อมูลปิดขายให้ KIM และใบเสนอราคาฉบับแก้ไขให้ SCM", sends: [{ party: "KIM", title: "ข้อมูลปิดขาย เพื่อเตรียมแผนติดตั้ง", at: "done" }, { party: "SCM", title: "ใบเสนอราคาฉบับแก้ไข (Map สินค้า + สั่งโรงงาน)", at: "done" }] };
    case "install_plan": return { label: "แจ้งแผนติดตั้งลูกค้า", owner: "KIM", hint: "KIM วางแผนติดตั้งจากวันที่สินค้าครบ แล้วแจ้งลูกค้าใน Line กลุ่ม", sends: [], result: "แผนติดตั้ง (วันเริ่ม-วันจบ)" };
    case "deliver": return { label: DELIVER_LABEL[work], owner: "SCM", hint: "SCM สั่งโรงงานและขนส่งสินค้าเข้าหน้างาน", sends: [], result: "สถานะจัดส่งสินค้า" };
    case "install": return { label: INSTALL_LABEL[work], owner: "KIM", hint: "ช่างเข้าติดตั้ง และ KIM เข้าตรวจงาน", sends: [], result: "ความคืบหน้าติดตั้ง / ผลตรวจงาน" };
    case "handover": return { label: "ส่งมอบงาน + ใบรับประกัน", owner: "KIM", hint: "KIM ส่งมอบงานกับลูกค้า และออกใบรับประกัน", sends: [], result: "ใบส่งมอบงาน + ใบรับประกัน" };
  }
}
export function template(seg: Segment, work: Work): StepDef[] {
  return ORDER[seg][work].map((key) => ({ key, day: DAYS[seg][work][key] ?? 0, post: POST.includes(key), ...meta(key, seg, work) }));
}
export const planTotals = (steps: StepDef[]) => {
  const close = steps.find((s) => s.key === "close")?.day ?? 0;
  const last = steps[steps.length - 1].day;
  return { total: last, afterClose: last - close };
};

/* ---------- ใบเปิดงาน (Step 1–5 ตามต้นแบบทีม JV) ---------- */
export type ShopType = "GT" | "MT";
export interface Intake {
  email?: string; ctype: string; fam?: string;
  requestDate: string; shop?: string; shopCode?: string; shopType?: ShopType;
  btype: string; bchar: string; district: string; loc?: string; sea: string; terr: string[];
  warrSame: boolean; warrName?: string;
  refJob?: string; svc: string[]; pkgType: "total" | "standard"; pkg: string; det: Cat[]; round: "all" | "top" | "bottom";
  ase: string; chc: string; st2: boolean; truss?: string; muk?: string; rc?: string; eave: number;
  tile: string; tileModel: string; color: string; shape?: string; deg?: string; ins: string;
  files: { name: string; size: string }[];
}
export const CTYPES = ["ลูกค้าทั่วไป", "HBD", "VIP"];
/** GT = ร้านค้าทั่วไป · MT = Modern Trade */
export const SHOPS: Record<string, ShopType> = { "ร้าน สหชัยรุ่งเรือง จำกัด": "GT", "ยงฮวดการค้า": "GT", "ไทวัสดุ หาดใหญ่": "MT", "โฮมโปร หาดใหญ่": "MT", "SCG Home Experience": "MT" };
export const PROV: Record<string, string[]> = {
  "สงขลา": ["หาดใหญ่", "เมืองสงขลา", "สะเดา", "จะนะ"],
  "กรุงเทพมหานคร": ["บางซื่อ", "จตุจักร", "บางนา", "ลาดพร้าว"],
  "เชียงใหม่": ["เมืองเชียงใหม่", "สันทราย", "หางดง"],
  "ภูเก็ต": ["เมืองภูเก็ต", "กะทู้", "ถลาง"],
  "ขอนแก่น": ["เมืองขอนแก่น", "บ้านไผ่"],
};
/** ลูกค้า SCG Family (ข้อมูลสมมติ) */
export const FAMILY = [
  { name: "คุณกวี มิ่งขวัญเจริญ", tel: "062-345-6789", fam: "Fam2026000101", ctype: "ลูกค้าทั่วไป", email: "kawee.m@example.com" },
  { name: "คุณกวีนา ทองดี", tel: "089-555-1212", fam: "Fam2026000345", ctype: "VIP", email: "kaweena.t@example.com" },
  { name: "คุณสมชาย ใจดี", tel: "081-234-5678", fam: "Fam2026000112", ctype: "HBD", email: "somchai.j@example.com" },
  { name: "คุณเยาวลักษณ์ เพชรนิล", tel: "062-555-0077", fam: "Fam2026000077", ctype: "HBD", email: "yaowalak.p@example.com" },
];
export const BTYPES = ["บ้านเดี่ยว/โครงการ/อาคารขนาดใหญ่", "ทาวน์โฮม", "อาคารพาณิชย์", "โรงงาน/โกดัง"];
export const BCHARS = ["ที่พักอาศัย", "โรงพยาบาล/อาคารสำนักงาน", "ร้านค้า", "โรงเรียน"];
export const SEA_OPTS = ["น้อยกว่า 2 กม.", "2 - 5 กม.", "มากกว่า 5 กม."];
export const TERRAIN: Record<string, string> = {
  A: "A : หลังคาทั่วไปที่ตั้งอยู่บนพื้นที่ทั่วไป",
  B: "B : หลังคาซับซ้อน / อาคารขนาดใหญ่ / โค้งโอบลม",
  C: "C : หลังคาที่สันหลังคาเกิน 18 เมตร / อยู่บนเนินเขา หน้าผา ช่องลม หรือที่ตั้งอยู่บริเวณที่เกิด Dramatic Effects",
  D: "D : อาคารที่ไม่มีฝ้าเพดาน",
};
export const SVC_LABEL: Record<string, string> = { prod: "ประมาณการเฉพาะค่าสินค้า", labor: "ประมาณการเฉพาะค่าแรง", sol: "ประมาณการ Solution (ของรวมแรง)" };
export const PKG_OPTS = ["Complete Roof (รับประกัน 5 ปี)", "Basic Roof (รับประกัน 1 ปี)"];
export const ASE_OPTS = ["อะเสกัลวาไนซ์", "อะเสไม้", "อะเสเหล็กกล่อง"];
export const CHC_OPTS = ["6 นิ้ว และ 8 นิ้ว", "6 นิ้ว", "8 นิ้ว"];
export const RC_OPTS = ["ใหม่ (ไม่มีหลังคาเดิม)", "รื้อหลังคาเดิม", "ซ่อมบางส่วน"];
export const TILE_OPTS = ["Prestige (เพรสทีจ)", "Excella", "Neustile", "Cotto Roof"];
export const TILE_MODEL_OPTS = ["Standard (ธรรมดา)", "Cool", "Cool Plus"];
export const COLOR_OPTS = ["มิดไนท์เกรย์", "เทาปีกนก", "โอ๊คแดง", "น้ำตาลช็อกโกแลต"];
export const SHAPE_OPTS = ["ทรงจั่ว", "ทรงปั้นหยา", "ทรงมะนิลา", "ทรงเพิงหมาแหงน"];
export const INS_OPTS = ["ไม่ใช้", "แผ่นสะท้อนความร้อน", "Ultra Cool InnoGreen"];
export const ROUND_LABEL = { all: "รวมรอบ (รอบบน+รอบล่าง)", top: "รอบบน", bottom: "รอบล่าง" } as const;
export const CAT_ORDER: Cat[] = ["ase", "truss", "tile", "fascia"];
/** กลุ่มลูกค้าที่ใช้เลือก Flow: ประเภทลูกค้า HBD = ปิดขายจากแบบ (ไม่มีมัดจำ/สำรวจ) นอกนั้นเป็นลูกค้าทั่วไป */
export const segmentOfCtype = (ctype: string): Segment => (ctype === "HBD" ? "hbd" : "general");
/** ประเภทงานที่ใช้เลือกแม่แบบ PT: เลือกอะเส = อะเส+ทรัส+มุง · เลือกโครงหลังคา = ทรัส+มุง · นอกนั้นมุงอย่างเดียว */
export const workOfDet = (det: Cat[]): Work => (det.includes("ase") ? "ase" : det.includes("truss") ? "truss" : "roof");
/** ข้อมูลที่ยังขาดในใบเปิดงาน (ตามต้นแบบ: Step 4 ต้องมีบริการ/หมวดส่งถอดแบบ/max truss/Roof condition/ทรงหลังคา/องศา, Step 5 ต้องมีไฟล์แนบ) */
export function missingOf(i: Intake): { s4: string[]; s5: boolean; any: boolean } {
  const s4: string[] = [];
  if (!i.svc.length) s4.push("บริการ");
  if (!i.det.length) s4.push("หมวดส่งถอดแบบ");
  if (i.det.includes("truss") && !i.truss) s4.push("ระยะ max truss");
  if (!i.rc) s4.push("Roof condition");
  if (!i.shape) s4.push("ทรงหลังคา");
  if (!i.deg) s4.push("องศา");
  const s5 = i.files.length === 0;
  return { s4, s5, any: s4.length > 0 || s5 };
}
/** ใบเปิดงานตัวอย่างของงานในข้อมูลตั้งต้น */
export function sampleIntake(s: { province: string; segment: Segment; work: Work; requestDate: string }): Intake {
  const det = catsOf(s.work);
  const roofOnly = s.work === "roof";
  return {
    ctype: s.segment === "hbd" ? "HBD" : "ลูกค้าทั่วไป", requestDate: s.requestDate, shop: "ร้าน สหชัยรุ่งเรือง จำกัด", shopType: "GT",
    btype: BTYPES[0], bchar: BCHARS[0], district: (PROV[s.province] ?? [])[0] ?? "-", loc: "https://maps.app.goo.gl/sample", sea: SEA_OPTS[1], terr: ["B"],
    warrSame: true, svc: ["sol"], pkgType: roofOnly ? "standard" : "total", pkg: PKG_OPTS[0], det, round: "all",
    ase: ASE_OPTS[0], chc: CHC_OPTS[0], st2: false, truss: roofOnly ? undefined : "1.20", muk: roofOnly ? undefined : "4", rc: RC_OPTS[0], eave: 2,
    tile: TILE_OPTS[0], tileModel: TILE_MODEL_OPTS[0], color: COLOR_OPTS[0], shape: SHAPE_OPTS[0], deg: "30", ins: INS_OPTS[2],
    files: [{ name: "แบบแปลนหลังคา.pdf", size: "1.2 MB" }],
  };
}

/* ---------- Job ---------- */
/** โมเดลธุรกิจ: Housing Expert (ร้านตัวแทน มัดจำ 30%) / SCG Home (มัดจำคงที่ 30,000 บาท) */
export type Model = "he" | "scg";
export const MODEL_LABEL: Record<Model, string> = { he: "Housing Expert", scg: "SCG Home" };
/** หมวดงานที่ห้องแบบถอดแบบ */
export type Cat = "ase" | "truss" | "tile" | "fascia";
export const CAT_LABEL: Record<Cat, string> = { ase: "อะเส (ขีดแนวอะเส)", truss: "โครงทรัส", tile: "กระเบื้อง", fascia: "เชิงชาย" };
export const catsOf = (w: Work): Cat[] => (w === "survey" ? [] : w === "roof" ? ["tile", "fascia"] : w === "truss" ? ["truss", "tile", "fascia"] : ["ase", "truss", "tile", "fascia"]);
export interface Csat { avg: number; nps: number; comment?: string; at: string }
export interface CsatRound { sentAt?: string; done?: Csat }
export interface Right { id: string; name: string; expiresAt: string; usedAt?: string }
/** ชุดสิทธิพิเศษที่มอบหลังลูกค้าตอบแบบประเมินรอบ 1 (ค่าสมมติ อายุตามจำนวนวัน) */
export const RIGHT_TEMPLATES = [
  { name: "ส่วนลดล้างแอร์ 15%", days: 90 },
  { name: "สำรวจต่อเติมโรงจอดรถ ราคาพิเศษ", days: 60 },
  { name: "สำรวจรางน้ำฝน ราคาพิเศษ", days: 60 },
];
/** คำถาม CSAT ตามต้นแบบ JV (2 รอบ) */
export const CSAT_Q = {
  r1: ["ความรวดเร็วในการติดต่อและนัดหมาย", "ความชัดเจนของใบเสนอราคาและคำแนะนำ", "ความเหมาะสมของราคาและเงื่อนไข"],
  r2: ["คุณภาพงานติดตั้ง", "ความตรงต่อเวลาตามแผนงาน", "ความสะอาดเรียบร้อยหลังติดตั้งและการส่งมอบ"],
};
export const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * 86400e3).toISOString();
export function rightState(r: Right): "ok" | "soon" | "used" | "expired" {
  if (r.usedAt) return "used";
  const left = (new Date(r.expiresAt).getTime() - NOW.getTime()) / 86400e3;
  return left < 0 ? "expired" : left <= 14 ? "soon" : "ok";
}
export interface JobLog { at: string; text: string }
export interface Job {
  id: string; opsId: string; leadId?: string; customer: string; phone: string; province: string; segment: Segment; work: Work;
  value: number; quote1Value?: number; model: Model; revise?: Cat[]; intake?: Intake; owner: string; startedAt: string; done: Partial<Record<StepKey, string>>; surveyAt?: string;
  /** งานชนิดสำรวจ: รายละเอียดงาน เช่น ติดตั้งแอร์ 3 ห้อง */ scope?: string;
  csat?: { r1?: CsatRound; r2?: CsatRound }; rights?: Right[]; /** ร้านที่รับงาน (คำนวณจากจังหวัด) */ store?: string;
  scm: { ordered?: string; readyEta?: string }; lastTouchAt: string; log: JobLog[]; cancelReason?: string;
}
export const stepsOf = (j: Job) => template(j.segment, j.work);
export const currentStep = (j: Job): StepDef | null => (j.cancelReason ? null : stepsOf(j).find((s) => !j.done[s.key]) ?? null);
export const isFinished = (j: Job) => !j.cancelReason && stepsOf(j).every((s) => j.done[s.key]);
export const hasDeposit = (j: Job) => j.segment === "general";
export const depositOf = (j: Job) => (!hasDeposit(j) ? 0 : j.work === "survey" ? SURVEY_FEE : j.model === "scg" ? DEPOSIT_SCG : Math.round(((j.quote1Value ?? j.value) * DEPOSIT_PCT) / 100));
export const depositLabel = (j: Job) => (j.work === "survey" ? "ค่าสำรวจ (หักจากค่าติดตั้ง)" : j.model === "scg" ? "มัดจำคงที่ ฿30,000 (SCG Home)" : "มัดจำ 30% (Housing Expert)");
/** ทีมขายเป็นผู้ถอดแบบรายหมวด หลังสำรวจเลือก Confirm (ใช้ผลเดิม) หรือ Revise (ถอดใหม่) — โครงทรัส/อะเสต้อง Revise เสมอ เพราะใช้แบบทรัส + Cutting List ใหม่จากห้องแบบ */
export const lockedOf = (j: Job): Cat[] => (j.segment !== "general" ? [] : j.work === "ase" ? ["ase", "truss"] : j.work === "truss" ? ["truss"] : []);
export const reviseOf = (j: Job): Cat[] => (j.segment !== "general" ? [] : catsOf(j.work).filter((c) => lockedOf(j).includes(c) || (j.revise ?? []).includes(c)));

/** กำหนดเสร็จของขั้นตอน: ขั้นหลังปิดขายนับจากวันปิดขาย (คำมั่นกับลูกค้า) ขั้นอื่นนับต่อจากวันที่ขั้นก่อนหน้าเสร็จ */
export function dueOf(j: Job, s: StepDef): string {
  const steps = stepsOf(j);
  const closeDef = steps.find((x) => x.key === "close")!;
  if (s.post && j.done.close) return addWd(j.done.close, s.day - closeDef.day);
  const prev = steps[steps.indexOf(s) - 1];
  if (prev && j.done[prev.key]) return addWd(j.done[prev.key]!, s.day - prev.day);
  return addWd(j.startedAt, s.day - 1);
}
export const lateWd = (iso: string) => wdBetween(iso, NOW.toISOString());

export type ColKey = "intake" | "quote1" | "deposit" | "survey" | "post_survey" | "close" | "prep" | "install" | "done";
export const COLS: { key: ColKey; label: string; hint: string; icon: string; tone: string }[] = [
  { key: "intake", label: "รับแบบ / ห้องแบบ", hint: "ขีดแนวอะเส · แบบทรัส (HBD)", icon: "architecture", tone: "#a855f7" },
  { key: "quote1", label: "เสนอราคาจากแบบ", hint: "ประมาณการ + ใบเสนอราคา", icon: "request_quote", tone: "#6366f1" },
  { key: "deposit", label: "รอมัดจำ", hint: `ปิดมัดจำ ${DEPOSIT_PCT}% + ล็อกคิวสำรวจ`, icon: "payments", tone: "#d97706" },
  { key: "survey", label: "รอสำรวจ / รายงาน", hint: "KIM สำรวจและส่งรายงาน", icon: "pin_drop", tone: "#0891b2" },
  { key: "post_survey", label: "หลังสำรวจ", hint: "แบบทรัส + ราคาหลังสำรวจ", icon: "edit_note", tone: "#7c3aed" },
  { key: "close", label: "รอปิดขาย", hint: "รอลูกค้าจ่ายครบ 100%", icon: "account_balance_wallet", tone: "#ea580c" },
  { key: "prep", label: "เตรียมสินค้า + แผนติดตั้ง", hint: "SCM สั่งของ · KIM วางแผน", icon: "local_shipping", tone: "#0d9488" },
  { key: "install", label: "ติดตั้ง / ส่งมอบ", hint: "KIM + ช่าง", icon: "construction", tone: "#059669" },
  { key: "done", label: "จบงาน", hint: "ส่งมอบและออกใบรับประกันแล้ว", icon: "verified", tone: "#475569" },
];
export function colOf(j: Job): ColKey | null {
  if (j.cancelReason) return null;
  const c = currentStep(j);
  if (!c) return "done";
  switch (c.key) {
    case "plan_in": case "ase_mark": return "intake";
    case "truss_design": return j.segment === "hbd" ? "intake" : "post_survey";
    case "quote1": return "quote1";
    case "deposit": return "deposit";
    case "survey": return "survey";
    case "quote2": return "post_survey";
    case "close": return "close";
    case "install_plan": case "deliver": return "prep";
    default: return "install";
  }
}

/* ---------- ข้อมูลที่แลกกับแอปปลายทาง (คำนวณจากสถานะงาน) ---------- */
export interface Packet {
  id: string; jobId: string; customer: string; party: Party; dir: "out" | "in"; title: string; stepKey: StepKey;
  state: "sent" | "received" | "waiting"; at?: string; due?: string;
}
export function packetsOf(j: Job): Packet[] {
  const steps = stepsOf(j);
  const out: Packet[] = [];
  steps.forEach((s, i) => {
    const prev = steps[i - 1];
    const startAt = i === 0 ? j.startedAt : prev ? j.done[prev.key] : undefined;
    s.sends.forEach((sd, k) => {
      const at = sd.at === "done" ? j.done[s.key] : startAt;
      if (at) out.push({ id: `${j.id}-${s.key}-o${k}`, jobId: j.id, customer: j.customer, party: sd.party, dir: "out", title: sd.title, stepKey: s.key, state: "sent", at });
    });
    if (s.result && s.owner !== "SE") {
      const done = j.done[s.key];
      if (done) out.push({ id: `${j.id}-${s.key}-i`, jobId: j.id, customer: j.customer, party: s.owner, dir: "in", title: s.result, stepKey: s.key, state: "received", at: done });
      else if (startAt && !j.cancelReason) out.push({ id: `${j.id}-${s.key}-i`, jobId: j.id, customer: j.customer, party: s.owner, dir: "in", title: s.result, stepKey: s.key, state: "waiting", due: dueOf(j, s) });
    }
  });
  return out;
}

/* ---------- ตัวช่วยแสดงผล ---------- */
export const valueText = (j: { value: number }) => (j.value > 0 ? baht(j.value) : "ยังไม่ประเมิน");
export const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
export const dateTh = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: TZ }) : "-");
export const timeTh = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "-");
export const dtTh = (iso?: string) => (iso ? `${dateTh(iso)} ${timeTh(iso)}` : "-");
export const hoursSince = (iso: string) => (NOW.getTime() - new Date(iso).getTime()) / 3600e3;
export function durText(hours: number) {
  const h = Math.abs(hours);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} นาที`;
  if (h < 24) return `${Math.floor(h)} ชม.`;
  const d = Math.floor(h / 24);
  const r = Math.round(h - d * 24);
  return r ? `${d} วัน ${r} ชม.` : `${d} วัน`;
}
export const agoText = (iso: string) => `${durText(hoursSince(iso))}ที่แล้ว`;
export const isToday = (iso?: string) => !!iso && dayKey(iso) === dayKey(NOW.toISOString());
export const dueLabel = (due: string) => {
  const l = lateWd(due);
  return l > 0 ? `เลยกำหนด ${l} วันทำการ` : l === 0 ? "ครบกำหนดวันนี้" : `อีก ${-l} วันทำการ`;
};

/** SLA ติดต่อครั้งแรกของ Lead */
export function leadSla(l: Lead): { state: "ok" | "warn" | "breach" | "met" | "na"; text: string } {
  if (l.status === "lost" && !l.firstContactAt) return { state: "na", text: "-" };
  if (l.firstContactAt) {
    const took = (new Date(l.firstContactAt).getTime() - new Date(l.createdAt).getTime()) / 3600e3;
    return took <= slaHoursOf(l.channel) ? { state: "met", text: `ทัน SLA · ${durText(took)}` } : { state: "breach", text: `เกิน SLA · ${durText(took)}` };
  }
  const target = slaHoursOf(l.channel);
  const left = target - hoursSince(l.createdAt);
  if (left < 0) return { state: "breach", text: `เกิน SLA ${durText(left)}` };
  return { state: left < Math.min(1.5, target * 0.25) ? "warn" : "ok", text: `เหลือ ${durText(left)}` };
}

/* ---------- ข้อมูลตั้งต้น ---------- */
export function seedLeads(): Lead[] {
  return [
    { id: "L-2611-009", name: "คุณนภา ใจงาม", phone: "081-555-0931", product: "Roof Install", channel: "Home Online", province: "อุดรธานี", createdAt: hAgo(1.2), status: "waiting", interest: "ต้องการเปลี่ยนหลังคาบ้านชั้นเดียว ประมาณ 180 ตร.ม." },
    { id: "L-2611-001", name: "คุณวิภา ศรีสุข", phone: "062-555-1204", product: "Roof Install", channel: "Home Online", province: "สงขลา", createdAt: hAgo(2.8), status: "waiting", interest: "สร้างบ้านใหม่ ต้องการโครงทรัสพร้อมมุงกระเบื้อง" },
    { id: "L-2611-002", name: "คุณธนากร ใจดี", phone: "085-555-1822", product: "Roof Install", channel: "Contact Center", province: "ขอนแก่น", createdAt: hAgo(6), status: "waiting", interest: "หลังคารั่ว อยากเปลี่ยนทั้งหลัง" },
    { id: "L-2611-003", name: "คุณมนัสนันท์ วงศ์ดี", phone: "089-555-4410", product: "Roof Repair", channel: "LINE OA", province: "เชียงใหม่", createdAt: hAgo(27), status: "waiting", interest: "ซ่อมหลังคารั่วบริเวณระเบียง" },
    { id: "L-2611-010", name: "คุณกิตติ ประเสริฐ", phone: "086-555-7712", product: "Solar Roof", channel: "Walk-in", province: "ระยอง", createdAt: hAgo(20), firstContactAt: hAgo(19), status: "contacting", note: "โทรแล้ว ลูกค้าขอเทียบกับอีก 2 เจ้า นัดโทรกลับพรุ่งนี้", interest: "บ้านสองชั้น ติดโซลาร์ 10 kWp" },
    { id: "L-2611-004", name: "คุณปรีชา แก้วใส", phone: "087-555-3305", product: "Ceiling & Insulation", channel: "Walk-in", province: "นครราชสีมา", createdAt: hAgo(30), firstContactAt: hAgo(28), status: "contacting", note: "ส่งรูปหน้างานแล้ว รอตอบเรื่องงบ", interest: "ฝ้าเพดาน + ฉนวนกันความร้อน" },
    { id: "L-2611-005", name: "คุณสุดา มีสุข", phone: "064-555-9018", product: "Roof Install", channel: "Dealer Referral", province: "ภูเก็ต", createdAt: hAgo(50), firstContactAt: hAgo(49), status: "contacting", note: "ร้านตัวแทนแนะนำมา พื้นที่อยู่ในขอบเขต", interest: "บ้านใหม่ ต้องการหลังคาพร้อมโครง" },
    { id: "L-2611-006", name: "คุณอนันต์ ทองดี", phone: "083-555-6620", product: "Roof Install", channel: "Home Online", province: "กรุงเทพมหานคร", createdAt: hAgo(72), firstContactAt: hAgo(71), status: "qualified", note: "ผ่านเงื่อนไขรับงาน พร้อมให้สำรวจ", interest: "เปลี่ยนกระเบื้องหลังคา" },
    { id: "L-2611-007", name: "คุณพิมพ์ใจ รักไทย", phone: "082-555-2231", product: "Roof Install", channel: "Contact Center", province: "สงขลา", createdAt: hAgo(100), firstContactAt: hAgo(98), status: "qualified", note: "งบ 3-4 แสน ต้องการเริ่มก่อนสิ้นปี", interest: "โรงจอดรถ + ตัวบ้าน ต้องมีอะเสและทรัส" },
    { id: "L-2611-008", name: "คุณวีระ สุขสบาย", phone: "080-555-1177", product: "Home Automation", channel: "LINE OA", province: "ชลบุรี", createdAt: hAgo(120), firstContactAt: hAgo(118), status: "lost", lostReason: "งบประมาณไม่ถึง", interest: "ระบบบ้านอัจฉริยะ" },
    { id: "L-2611-016", name: "คุณมาลี สุขใจ", phone: "081-555-4416", product: "กระเบื้องหลังคา (สินค้า)", channel: "Home Online", province: "ภูเก็ต", createdAt: hAgo(5), firstContactAt: hAgo(4), status: "dealer", dealerStore: "ร้านภูเก็ตวัสดุ", dealerStep: "sent", sentAt: hAgo(3), interest: "กระเบื้อง 120 ตร.ม. ไม่ต้องการแบบ" },
    { id: "L-2611-012", name: "คุณมานะ พงษ์ไทย", phone: "089-555-1212", product: "รางน้ำฝน (สินค้า)", channel: "LINE OA", province: "ชลบุรี", createdAt: hAgo(40), firstContactAt: hAgo(39), status: "dealer", dealerStore: "ร้านชลบุรีโฮม", dealerStep: "quoted", dealerAmount: 48200, sentAt: hAgo(38), interest: "รางน้ำรอบบ้าน" },
    { id: "L-2611-011", name: "คุณวิไล รักดี", phone: "085-555-1111", product: "ฝ้าเพดาน (สินค้า)", channel: "Walk-in", province: "เชียงใหม่", createdAt: hAgo(90), firstContactAt: hAgo(89), status: "dealer", dealerStore: "ร้านเชียงใหม่ซีเมนต์", dealerStep: "won", dealerAmount: 36500, sentAt: hAgo(88), interest: "ฝ้าเพดานห้องนั่งเล่น" },
  ];
}

interface Spec {
  id: string; customer: string; phone: string; province: string; segment: Segment; work: Work; value: number; quote1Value?: number;
  at: StepKey | "done"; /** วันทำการที่ผ่านไปแล้วนับจากวันรับแบบ */ daysIn: number; owner?: string; surveyOffset?: number; scm?: Job["scm"]; touchH?: number; cancel?: string; model?: Model; draft?: boolean; scope?: string;
}
function mk(sp: Spec): Job {
  const job: Job = {
    id: sp.id, opsId: sp.id.replace("J-", "OP-"), customer: sp.customer, phone: sp.phone, province: sp.province, segment: sp.segment, work: sp.work,
    value: sp.value, quote1Value: sp.quote1Value, model: sp.model ?? "he", owner: sp.owner ?? "ฝน", startedAt: subWd(sp.daysIn), done: {}, scm: sp.scm ?? {},
    lastTouchAt: hAgo(sp.touchH ?? 6), log: [],
  };
  const intake = sampleIntake({ province: sp.province, segment: sp.segment, work: sp.work, requestDate: dayKey(job.startedAt) });
  if (sp.draft) { intake.files = []; intake.shape = undefined; intake.deg = undefined; }
  job.intake = sp.work === "survey" ? undefined : intake;
  if (sp.scope) job.scope = sp.scope;
  if (sp.cancel) { job.cancelReason = sp.cancel; }
  const steps = stepsOf(job);
  for (const s of steps) {
    if (s.key === sp.at) break;
    if (sp.cancel && s.key === "quote1") break;
    const d = s.key === "plan_in" ? job.startedAt : dueOf(job, s);
    const at = new Date(d).getTime() > NOW.getTime() - 2 * 3600e3 ? hAgo(2) : d;
    job.done[s.key] = at;
    job.log.push({ at, text: s.key === "plan_in" ? "เปิด Opp และรับแบบจากลูกค้า" : `${s.label} เสร็จ` });
  }
  if (sp.surveyOffset !== undefined) job.surveyAt = dFromNow(sp.surveyOffset, 14);
  if (sp.cancel) job.log.push({ at: hAgo(300), text: `ยกเลิกงาน: ${sp.cancel}` });
  if (sp.at !== "done" && job.log.length === 0) job.log.push({ at: job.startedAt, text: "เปิด Opp" });
  return job;
}

export function seedJobs(): Job[] {
  const js = seedJobsRaw();
  const done = (avg: number, nps: number, comment: string, h: number) => ({ done: { avg, nps, comment, at: hAgo(h) } });
  const a = js.find((j) => j.id === "J-2611-0111");
  if (a) {
    a.csat = { r1: done(4.5, 9, "ทีมงานให้คำแนะนำดี อธิบายใบเสนอราคาชัดเจน", 900), r2: done(4.9, 10, "ติดตั้งเรียบร้อยตรงเวลา", 100) };
    a.rights = RIGHT_TEMPLATES.map((t, i) => ({ id: `${a.id}-R${i + 1}`, name: t.name, expiresAt: addDays(hAgo(900), t.days), usedAt: i === 0 ? hAgo(300) : undefined }));
  }
  const b = js.find((j) => j.id === "J-2611-0110");
  if (b) b.csat = { r1: { sentAt: hAgo(30) } };
  return js;
}
function seedJobsRaw(): Job[] {
  return [
    mk({ id: "J-2611-0113", customer: "คุณสมศักดิ์ ใจเย็น", phone: "081-555-0113", province: "สงขลา", segment: "general", work: "truss", value: 486000, at: "ase_mark", daysIn: 4, touchH: 30, draft: true }),
    mk({ id: "J-2611-0101", customer: "คุณจันทร์เพ็ญ สายสุด", phone: "089-555-0101", province: "ขอนแก่น", segment: "general", work: "roof", value: 168000, at: "quote1", daysIn: 2, touchH: 20 }),
    mk({ id: "J-2611-0102", customer: "คุณรัตนา พรหมมา", phone: "062-555-0102", province: "สงขลา", segment: "general", work: "roof", value: 245000, quote1Value: 245000, at: "deposit", daysIn: 6, touchH: 100, model: "scg" }),
    mk({ id: "J-2611-0114", customer: "คุณธีรพงษ์ มั่นคง", phone: "085-555-0114", province: "นครปฐม", segment: "hbd", work: "roof", value: 212000, at: "quote1", daysIn: 1, touchH: 20 }),
    mk({ id: "J-2611-0103", customer: "คุณชนิดา วงศ์ใหญ่", phone: "087-555-0103", province: "สงขลา", segment: "general", work: "ase", value: 355000, quote1Value: 355000, at: "deposit", daysIn: 6, touchH: 60 }),
    mk({ id: "J-2611-0104", customer: "คุณเอกชัย ธรรมดี", phone: "086-555-0104", province: "ขอนแก่น", segment: "general", work: "roof", value: 186500, quote1Value: 186500, at: "survey", daysIn: 7, surveyOffset: 0, touchH: 26, model: "scg" }),
    mk({ id: "J-2611-0105", customer: "คุณวรรณา เพชรดี", phone: "064-555-0105", province: "กรุงเทพมหานคร", segment: "general", work: "roof", value: 122000, quote1Value: 122000, at: "survey", daysIn: 10, surveyOffset: -3, touchH: 80 }),
    mk({ id: "J-2611-0115", customer: "คุณสมพร บุญรอด", phone: "081-555-0115", province: "ภูเก็ต", segment: "general", work: "truss", value: 398000, quote1Value: 398000, at: "survey", daysIn: 9, surveyOffset: 2, touchH: 40 }),
    mk({ id: "J-2611-0116", customer: "คุณวิชัย รุ่งเรือง", phone: "089-555-0116", province: "เชียงใหม่", segment: "general", work: "truss", value: 276000, quote1Value: 276000, at: "truss_design", daysIn: 17, surveyOffset: -6, touchH: 70 }),
    mk({ id: "J-2611-0106", customer: "คุณประเสริฐ บุญมี", phone: "083-555-0106", province: "กรุงเทพมหานคร", segment: "general", work: "roof", value: 520000, quote1Value: 480000, at: "quote2", daysIn: 10, surveyOffset: -2, touchH: 30 }),
    mk({ id: "J-2611-0117", customer: "คุณมาลี ใจดี", phone: "082-555-0117", province: "ชลบุรี", segment: "hbd", work: "truss", value: 330000, at: "truss_design", daysIn: 4, touchH: 28 }),
    mk({ id: "J-2611-0107", customer: "คุณสมหมาย แก้วมณี", phone: "089-555-0107", province: "เชียงใหม่", segment: "general", work: "roof", value: 98000, quote1Value: 90000, at: "close", daysIn: 14, surveyOffset: -5, touchH: 54 }),
    mk({ id: "J-2611-0119", customer: "คุณนิรันดร์ เจริญสุข", phone: "086-555-0119", province: "นครราชสีมา", segment: "general", work: "roof", value: 205000, quote1Value: 205000, at: "install_plan", daysIn: 14, surveyOffset: -8, touchH: 20 }),
    mk({ id: "J-2611-0108", customer: "คุณลักขณา สายทอง", phone: "082-555-0108", province: "สงขลา", segment: "general", work: "roof", value: 245000, quote1Value: 240000, at: "install_plan", daysIn: 15, surveyOffset: -9, scm: { ordered: hAgo(60), readyEta: addWd(NOW.toISOString(), 6) }, touchH: 40 }),
    mk({ id: "J-2611-0118", customer: "คุณอรทัย สมบูรณ์", phone: "084-555-0118", province: "นครสวรรค์", segment: "hbd", work: "ase", value: 640000, at: "deliver", daysIn: 20, scm: { ordered: hAgo(240), readyEta: addWd(NOW.toISOString(), 2) }, touchH: 30 }),
    mk({ id: "J-2611-0109", customer: "คุณบุญเรือง ทองคำ", phone: "080-555-0109", province: "ภูเก็ต", segment: "general", work: "truss", value: 310000, quote1Value: 300000, at: "install", daysIn: 36, surveyOffset: -28, scm: { ordered: hAgo(500), readyEta: hAgo(200) }, touchH: 8 }),
    mk({ id: "J-2611-0110", customer: "คุณไพโรจน์ ดวงดี", phone: "087-555-0110", province: "ขอนแก่น", segment: "hbd", work: "roof", value: 175000, at: "handover", daysIn: 22, scm: { ordered: hAgo(700), readyEta: hAgo(500) }, touchH: 52 }),
    mk({ id: "J-2611-0111", customer: "คุณศิริพร จันทร์เพ็ญ", phone: "086-555-0111", province: "ระยอง", segment: "general", work: "roof", value: 129000, quote1Value: 129000, at: "done", daysIn: 40, surveyOffset: -33, scm: { ordered: hAgo(700), readyEta: hAgo(600) }, touchH: 200 }),
    mk({ id: "J-2611-0121", customer: "คุณกิตติ ประเสริฐ", phone: "086-555-7712", province: "ระยอง", segment: "general", work: "survey", value: 0, at: "survey", daysIn: 4, surveyOffset: 1, touchH: 20, scope: "ติดตั้งแอร์ 3 ห้อง" }),
    mk({ id: "J-2611-0120", customer: "คุณปรีชา แก้วใส", phone: "087-555-3305", province: "นครราชสีมา", segment: "general", work: "survey", value: 86000, at: "quote2", daysIn: 9, surveyOffset: -3, touchH: 8, scope: "ฝ้าเพดาน + ฉนวนกันความร้อน" }),
    mk({ id: "J-2611-0112", customer: "คุณทวีศักดิ์ ศรีสวัสดิ์", phone: "081-555-0112", province: "นครสวรรค์", segment: "general", work: "roof", value: 98000, at: "quote1", daysIn: 9, cancel: "ลูกค้าเลื่อนโครงการไปปีหน้า", touchH: 300 }),
  ];
}

/* ---------- น้องเลขา: สร้างงานจากกฎ ---------- */
export type TaskKind = "lead_sla" | "lead_followup" | "lead_convert" | "se_step" | "deposit_chase" | "close_chase" | "survey_today" | "follow_party" | "scm_status" | "intake_missing";
export interface Task {
  id: string; kind: TaskKind; priority: 1 | 2 | 3; title: string; who: string; reason: string; action: string;
  ref: { type: "lead" | "job"; id: string }; draft?: string; value?: number; phone?: string; party?: Party;
}
export const TASK_ICON: Record<TaskKind, string> = {
  lead_sla: "call", lead_followup: "forum", lead_convert: "rocket_launch", se_step: "task_alt", deposit_chase: "payments", close_chase: "account_balance_wallet",
  survey_today: "pin_drop", follow_party: "support_agent", scm_status: "inventory_2", intake_missing: "assignment_late",
};

export function buildTasks(leads: Lead[], jobs: Job[]): Task[] {
  const out: Task[] = [];
  const first = (n: string) => n.replace(/^คุณ/, "");
  for (const l of leads) {
    if (l.status === "waiting") {
      const sla = leadSla(l);
      out.push({
        id: `t-${l.id}`, kind: "lead_sla", priority: sla.state === "breach" ? 1 : 2, title: `โทรหา ${l.name}`, who: l.name, phone: l.phone,
        reason: sla.state === "breach" ? `${sla.text} · ${l.product} จาก ${l.channel}` : `${sla.text} จะครบ SLA · ${l.product} จาก ${l.channel}`,
        action: "โทรสกรีน", ref: { type: "lead", id: l.id },
        draft: `สวัสดีค่ะ คุณ${first(l.name)} ติดต่อจากทีม Housing Expert นะคะ ได้รับข้อมูลที่สนใจ ${l.product} ไว้แล้วค่ะ ขออนุญาตสอบถามรายละเอียดเพิ่มเติมสักครู่ได้ไหมคะ`,
      });
    } else if (l.status === "contacting" && l.firstContactAt && hoursSince(l.firstContactAt) > 24) {
      out.push({
        id: `t-${l.id}`, kind: "lead_followup", priority: 2, title: `ติดตามผลสกรีน ${l.name}`, who: l.name, phone: l.phone,
        reason: `ติดต่อครั้งแรกเมื่อ ${agoText(l.firstContactAt)} ยังไม่ตัดสินใจรับงาน/Loss${l.note ? ` · "${l.note}"` : ""}`, action: "อัปเดตสถานะ", ref: { type: "lead", id: l.id },
        draft: `สวัสดีค่ะ คุณ${first(l.name)} ทีม Housing Expert ติดตามเรื่อง ${l.product} ที่คุยกันไว้นะคะ ตอนนี้สะดวกให้ทีมเข้าไปดูหน้างานหรือยังคะ`,
      });
    } else if (l.status === "qualified") {
      out.push({
        id: `t-${l.id}`, kind: "lead_convert", priority: 2, title: `เปิด Opp ให้ ${l.name}`, who: l.name, phone: l.phone,
        reason: `ผ่านการสกรีนแล้ว รอเปิด Opp มา ${durText(hoursSince(l.createdAt))} · ${l.product}`, action: "เปิด Opp", ref: { type: "lead", id: l.id },
      });
    }
  }

  for (const j of jobs) {
    const cur = currentStep(j);
    if (!cur) continue;
    const due = dueOf(j, cur);
    const late = lateWd(due);
    const idle = hoursSince(j.lastTouchAt);
    const ref = { type: "job" as const, id: j.id };
    const base = { who: j.customer, phone: j.phone, value: j.value, ref };
    const fn = first(j.customer);
    const miss = j.intake ? missingOf(j.intake) : null;
    if (miss?.any) {
      out.push({ ...base, id: `t-${j.id}-im`, kind: "intake_missing", priority: 2, title: `ใบเปิดงานยังไม่ครบ · ${j.customer}`, reason: `ขาด: ${[...miss.s4, ...(miss.s5 ? ["เอกสารแนบ"] : [])].join(", ")}`, action: "กรอกใบเปิดงาน" });
    }

    if (cur.owner === "SE") {
      if (cur.key === "deposit" && (idle > 48 || late > 0)) {
        out.push({ ...base, id: `t-${j.id}`, kind: "deposit_chase", priority: 2, title: `ตามมัดจำ ${j.customer}`, reason: `รอมัดจำ ${baht(depositOf(j))} · ${late > 0 ? `เลยแผน ${late} วันทำการ` : `ลูกค้าเงียบมา ${durText(idle)}`}`, action: "แจ้งเตือน",
          draft: `สวัสดีค่ะ คุณ${fn} ขอแจ้งยอดมัดจำ ${baht(depositOf(j))} เพื่อล็อกคิวสำรวจหน้างานนะคะ ชำระผ่านแอปได้เลย หากโอนแล้วรบกวนส่งสลิปค่ะ` });
      } else if (cur.key === "close" && (idle > 48 || late > 0)) {
        const remain = j.value - depositOf(j);
        out.push({ ...base, id: `t-${j.id}`, kind: "close_chase", priority: late >= 2 ? 1 : 2, title: `ตามลูกค้าจ่ายครบ 100% · ${j.customer}`, reason: `ต้องเก็บครบก่อนส่งข้อมูลให้ KIM/SCM · คงเหลือ ${baht(remain)} · ${late > 0 ? `เลยแผน ${late} วันทำการ` : `เงียบมา ${durText(idle)}`}`, action: "บันทึกรับเงิน",
          draft: `สวัสดีค่ะ คุณ${fn} ใบเสนอราคาฉบับหลังสำรวจส่งให้แล้วนะคะ ยอดคงเหลือ ${baht(remain)} เมื่อชำระครบทีมจะเข้าคิวสั่งสินค้าและวางแผนติดตั้งทันทีค่ะ` });
      } else if (late >= 0) {
        out.push({ ...base, id: `t-${j.id}`, kind: "se_step", priority: late > 0 ? 1 : 2, title: `${cur.label} · ${j.customer}`, reason: `${dueLabel(due)} (แผน PT ${dateTh(due)}) · ${cur.hint}`, action: "ดูงาน" });
      }
    } else {
      const party = PARTY[cur.owner];
      if (cur.key === "survey" && isToday(j.surveyAt)) {
        out.push({ ...base, id: `t-${j.id}-sv`, kind: "survey_today", priority: 2, title: `วันนี้ KIM เข้าสำรวจ ${j.customer}`, reason: `นัด ${timeTh(j.surveyAt)} · ${j.province} · แจ้งลูกค้าให้มีผู้ดูแลพื้นที่อยู่ด้วย`, action: "ดูงาน",
          draft: `สวัสดีค่ะ คุณ${fn} วันนี้ทีม KIM จะเข้าสำรวจหน้างานเวลา ${timeTh(j.surveyAt)} นะคะ รบกวนให้มีผู้ดูแลพื้นที่อยู่ด้วยค่ะ` });
      }
      if (late >= 0) {
        out.push({ ...base, id: `t-${j.id}`, kind: "follow_party", party: cur.owner, priority: late > 0 ? 1 : 2, title: `ตาม ${party.label}: ${cur.result ?? cur.label} · ${j.customer}`,
          reason: `${dueLabel(due)} (กำหนด ${dateTh(due)}) · รอ ${party.label} · ${cur.label}`, action: "ถามหน่วยงาน",
          draft: `สวัสดีครับ ทีม${party.label} ขอสถานะ "${cur.result ?? cur.label}" ของงาน ${j.id} (${j.customer}, ${j.province}) หน่อยครับ กำหนดเดิม ${dateTh(due)} ทีมขายต้องใช้ต่อในขั้นถัดไป` });
      }
    }
    if (j.done.close && !j.scm.ordered && !isFinished(j) && wdBetween(j.done.close, NOW.toISOString()) >= 2) {
      out.push({ ...base, id: `t-${j.id}-scm`, kind: "scm_status", party: "SCM", priority: 2, title: `ตาม SCM: สถานะสั่งซื้อโรงงาน · ${j.customer}`,
        reason: `ปิดขายเมื่อ ${dateTh(j.done.close)} ส่งใบเสนอราคาฉบับแก้ไขให้ SCM แล้ว ยังไม่มีสถานะสั่งซื้อกลับมา`, action: "ถามหน่วยงาน",
        draft: `สวัสดีครับ ทีม SCM ขอสถานะการ Map สินค้าและสั่งซื้อโรงงานของงาน ${j.id} (${j.customer}) หน่อยครับ ใบเสนอราคาฉบับแก้ไขส่งไปเมื่อ ${dateTh(j.done.close)} KIM ต้องรู้วันที่สินค้าครบเพื่อวางแผนติดตั้ง` });
    }
  }
  return out.sort((a, b) => a.priority - b.priority || (b.value ?? 0) - (a.value ?? 0));
}

/** งานที่เสี่ยงหลุด/ช้ากว่าแผน PT (ใช้ในหน้าหลักและแชตเลขา) */
export function atRisk(leads: Lead[], jobs: Job[]) {
  const tasks = buildTasks(leads, jobs);
  const ids = new Set(tasks.filter((t) => t.ref.type === "job" && (t.priority === 1 || t.kind === "deposit_chase" || t.kind === "close_chase")).map((t) => t.ref.id));
  const risky = jobs.filter((j) => ids.has(j.id));
  const breach = leads.filter((l) => l.status === "waiting" && leadSla(l).state === "breach");
  return { jobs: risky, leads: breach, value: risky.reduce((s, j) => s + j.value, 0) };
}

/** ยอดที่ต้องเก็บตอนนี้ของงาน (มัดจำ หรือส่วนที่เหลือก่อนปิดขาย) */
export function dueMoney(j: Job): number {
  const c = currentStep(j);
  if (!c) return 0;
  if (c.key === "deposit") return depositOf(j);
  if (c.key === "close") return j.value - depositOf(j);
  return 0;
}
