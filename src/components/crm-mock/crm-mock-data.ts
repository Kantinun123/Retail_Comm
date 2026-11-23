/* Mock: CRM ลูกค้า (Lead -> Ops/Job -> ปิดขาย -> หลังปิดขาย) + "น้องเลขา"
   ข้อมูลสมมติในหน่วยความจำ — ชื่อลูกค้าเป็นชื่อสมมติทั้งหมด */

/** เวลา "ตอนนี้" ของ Mock (คงที่ เพื่อให้ SLA/งานค้างแสดงผลเหมือนเดิมทุกครั้ง) */
export const NOW = new Date("2026-11-24T10:30:00+07:00");
export const SLA_HOURS = 4;
export const DEPOSIT_PCT = 30;

const hAgo = (h: number) => new Date(NOW.getTime() - h * 3600e3).toISOString();
const dFromNow = (d: number, hour = 10) => {
  const t = new Date(NOW.getTime() + d * 86400e3);
  const ymd = t.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00+07:00`).toISOString();
};

/* ---------- ชนิดข้อมูล ---------- */
export type LeadStatus = "waiting" | "contacting" | "qualified" | "converted" | "lost";
export interface Lead {
  id: string; name: string; phone: string; product: string; channel: string; province: string;
  createdAt: string; firstContactAt?: string; status: LeadStatus; note?: string; lostReason?: string; interest?: string;
}
export type Stage = "design" | "quote" | "deposit" | "survey" | "final" | "collect" | "aftersale" | "done" | "cancelled";
export type AfterKey = "prep" | "ship" | "install" | "handover" | "warranty";
export interface JobLog { at: string; text: string }
export interface Job {
  id: string; opsId: string; leadId?: string; customer: string; phone: string; province: string; product: string; pkg: string;
  value: number; stage: Stage; owner: string; createdAt: string; lastTouchAt: string; surveyAt?: string;
  depositPaidAt?: string; paidAt?: string; after: Partial<Record<AfterKey, string>>; afterEta: Partial<Record<AfterKey, string>>;
  log: JobLog[]; cancelReason?: string;
}

/* ---------- ค่าคงที่ ---------- */
export const PRODUCTS = ["Roof Install", "Solar Roof", "Roof Repair", "Ceiling & Insulation", "Home Automation"];
export const CHANNELS = ["Home Online", "Contact Center", "LINE OA", "Walk-in", "Dealer Referral"];
export const PACKAGES = ["Total Roof – Complete Roof", "Standard Roof – โครงหลังคา", "Standard Roof – กระเบื้อง", "Solar Roof – 5 kWp", "Solar Roof – 10 kWp"];
export const OWNERS = ["ฝน", "บอส", "มิ้น"];

export const LEAD_STATUS: Record<LeadStatus, { label: string; cls: string }> = {
  waiting: { label: "รอติดต่อ", cls: "bg-amber-100 text-amber-800" },
  contacting: { label: "กำลังสกรีน", cls: "bg-sky-100 text-sky-800" },
  qualified: { label: "รอเปิด Ops", cls: "bg-violet-100 text-violet-800" },
  converted: { label: "เปิด Ops แล้ว", cls: "bg-emerald-100 text-emerald-800" },
  lost: { label: "Loss", cls: "bg-rose-100 text-rose-700" },
};
export const LOST_REASONS = ["งบประมาณไม่ถึง", "ยังไม่พร้อมต่อเติม", "อยู่นอกพื้นที่บริการ", "ติดต่อไม่ได้", "เลือกผู้ให้บริการอื่น"];

export interface StageMeta { key: Stage; label: string; hint: string; icon: string; tone: string }
export const STAGES: StageMeta[] = [
  { key: "design", label: "ออกแบบ + ประมาณการ", hint: "ถอดแบบและทำราคาเบื้องต้น", icon: "draw", tone: "#6366f1" },
  { key: "quote", label: "เสนอราคา", hint: "รอลูกค้าตอบรับราคา", icon: "request_quote", tone: "#8b5cf6" },
  { key: "deposit", label: "รอมัดจำ", hint: `เก็บมัดจำ ${DEPOSIT_PCT}%`, icon: "payments", tone: "#d97706" },
  { key: "survey", label: "สำรวจหน้างาน", hint: "นัดและเข้าสำรวจ", icon: "pin_drop", tone: "#0891b2" },
  { key: "final", label: "ราคา Final", hint: "ปรับใบเสนอราคาหลังสำรวจ", icon: "edit_note", tone: "#7c3aed" },
  { key: "collect", label: "รอเก็บเงิน 100%", hint: "เก็บส่วนที่เหลือก่อนติดตั้ง", icon: "account_balance_wallet", tone: "#ea580c" },
  { key: "aftersale", label: "หลังปิดขาย", hint: "เตรียมของ จัดส่ง ติดตั้ง ส่งมอบ", icon: "local_shipping", tone: "#059669" },
  { key: "done", label: "จบงาน", hint: "ส่งมอบและออกใบรับประกันแล้ว", icon: "verified", tone: "#475569" },
];
export const STAGE_ORDER: Stage[] = STAGES.map((s) => s.key);
export const stageMeta = (k: Stage) => STAGES.find((s) => s.key === k) ?? { key: k, label: "ยกเลิกงาน", hint: "", icon: "block", tone: "#e11d48" };

export const AFTER_STEPS: { key: AfterKey; label: string; icon: string; team: string }[] = [
  { key: "prep", label: "เตรียมสินค้า", icon: "inventory_2", team: "ทีมคลัง" },
  { key: "ship", label: "จัดส่งสินค้า", icon: "local_shipping", team: "ทีมส่งสินค้า" },
  { key: "install", label: "เริ่มติดตั้ง", icon: "construction", team: "ทีมติดตั้ง" },
  { key: "handover", label: "ส่งมอบงาน", icon: "handshake", team: "ทีมติดตั้ง" },
  { key: "warranty", label: "ออกใบรับประกัน", icon: "workspace_premium", team: "ฝ่ายขาย" },
];

/* ---------- ตัวช่วยแสดงผล ---------- */
export const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const TZ = "Asia/Bangkok";
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
const isSameDay = (a: string, b: Date) => new Date(a).toLocaleDateString("en-CA", { timeZone: TZ }) === b.toLocaleDateString("en-CA", { timeZone: TZ });
export const isToday = (iso?: string) => !!iso && isSameDay(iso, NOW);
export const depositOf = (j: Job) => Math.round((j.value * DEPOSIT_PCT) / 100);

/** SLA ติดต่อครั้งแรกของ Lead */
export function leadSla(l: Lead): { state: "ok" | "warn" | "breach" | "met" | "na"; text: string } {
  if (l.status === "lost" && !l.firstContactAt) return { state: "na", text: "-" };
  if (l.firstContactAt) {
    const took = (new Date(l.firstContactAt).getTime() - new Date(l.createdAt).getTime()) / 3600e3;
    return took <= SLA_HOURS ? { state: "met", text: `ทัน SLA · ${durText(took)}` } : { state: "breach", text: `เกิน SLA · ${durText(took)}` };
  }
  const left = SLA_HOURS - hoursSince(l.createdAt);
  if (left < 0) return { state: "breach", text: `เกิน SLA ${durText(left)}` };
  return { state: left < 1.5 ? "warn" : "ok", text: `เหลือ ${durText(left)}` };
}

/* ---------- ข้อมูลตั้งต้น ---------- */
const mkJob = (p: Partial<Job> & Pick<Job, "id" | "customer" | "phone" | "province" | "product" | "pkg" | "value" | "stage">): Job => ({
  opsId: p.id.replace("J-", "OP-"), owner: "ฝน", createdAt: hAgo(240), lastTouchAt: hAgo(6), after: {}, afterEta: {}, log: [], ...p,
});

export function seedLeads(): Lead[] {
  return [
    { id: "L-2611-009", name: "คุณนภา ใจงาม", phone: "081-555-0931", product: "Roof Install", channel: "Home Online", province: "อุดรธานี", createdAt: hAgo(1.2), status: "waiting", interest: "ต้องการเปลี่ยนหลังคาบ้านชั้นเดียว ประมาณ 180 ตร.ม." },
    { id: "L-2611-001", name: "คุณวิภา ศรีสุข", phone: "062-555-1204", product: "Solar Roof", channel: "Home Online", province: "สงขลา", createdAt: hAgo(2.8), status: "waiting", interest: "สนใจโซลาร์รูฟ ค่าไฟเดือนละ 6,000 บาท" },
    { id: "L-2611-002", name: "คุณธนากร ใจดี", phone: "085-555-1822", product: "Roof Install", channel: "Contact Center", province: "ขอนแก่น", createdAt: hAgo(6), status: "waiting", interest: "หลังคารั่ว อยากเปลี่ยนทั้งหลัง" },
    { id: "L-2611-003", name: "คุณมนัสนันท์ วงศ์ดี", phone: "089-555-4410", product: "Roof Repair", channel: "LINE OA", province: "เชียงใหม่", createdAt: hAgo(27), status: "waiting", interest: "ซ่อมหลังคารั่วบริเวณระเบียง" },
    { id: "L-2611-010", name: "คุณกิตติ ประเสริฐ", phone: "086-555-7712", product: "Solar Roof", channel: "Walk-in", province: "ระยอง", createdAt: hAgo(20), firstContactAt: hAgo(19), status: "contacting", note: "โทรแล้ว ลูกค้าขอเทียบกับอีก 2 เจ้า นัดโทรกลับพรุ่งนี้", interest: "บ้านสองชั้น ติดโซลาร์ 10 kWp" },
    { id: "L-2611-004", name: "คุณปรีชา แก้วใส", phone: "087-555-3305", product: "Ceiling & Insulation", channel: "Walk-in", province: "นครราชสีมา", createdAt: hAgo(30), firstContactAt: hAgo(28), status: "contacting", note: "ส่งรูปหน้างานแล้ว รอตอบเรื่องงบ", interest: "ฝ้าเพดาน + ฉนวนกันความร้อน" },
    { id: "L-2611-005", name: "คุณสุดา มีสุข", phone: "064-555-9018", product: "Roof Install", channel: "Dealer Referral", province: "ภูเก็ต", createdAt: hAgo(50), firstContactAt: hAgo(49), status: "contacting", note: "ร้านตัวแทนแนะนำมา พื้นที่อยู่ในขอบเขต", interest: "บ้านใหม่ ต้องการหลังคาพร้อมโครง" },
    { id: "L-2611-006", name: "คุณอนันต์ ทองดี", phone: "083-555-6620", product: "Solar Roof", channel: "Home Online", province: "กรุงเทพมหานคร", createdAt: hAgo(72), firstContactAt: hAgo(71), status: "qualified", note: "ผ่านเงื่อนไขรับงาน พร้อมให้สำรวจ", interest: "ติดโซลาร์ 5 kWp" },
    { id: "L-2611-007", name: "คุณพิมพ์ใจ รักไทย", phone: "082-555-2231", product: "Roof Install", channel: "Contact Center", province: "สงขลา", createdAt: hAgo(100), firstContactAt: hAgo(98), status: "qualified", note: "งบ 3-4 แสน ต้องการเริ่มก่อนสิ้นปี", interest: "เปลี่ยนหลังคาโรงจอดรถ + ตัวบ้าน" },
    { id: "L-2611-008", name: "คุณวีระ สุขสบาย", phone: "080-555-1177", product: "Home Automation", channel: "LINE OA", province: "ชลบุรี", createdAt: hAgo(120), firstContactAt: hAgo(118), status: "lost", lostReason: "งบประมาณไม่ถึง", interest: "ระบบบ้านอัจฉริยะ" },
  ];
}

export function seedJobs(): Job[] {
  return [
    mkJob({ id: "J-2611-0113", leadId: "L-2610-088", customer: "คุณสมศักดิ์ ใจเย็น", phone: "081-555-0113", province: "สงขลา", product: "Roof Install", pkg: "Total Roof – Complete Roof", value: 486000, stage: "design", lastTouchAt: hAgo(5), log: [{ at: hAgo(5), text: "เปิด Ops จาก Lead และแนบแบบแปลน" }] }),
    mkJob({ id: "J-2611-0101", customer: "คุณจันทร์เพ็ญ สายสุด", phone: "089-555-0101", province: "ขอนแก่น", product: "Roof Install", pkg: "Standard Roof – กระเบื้อง", value: 168000, stage: "design", lastTouchAt: hAgo(30), log: [{ at: hAgo(30), text: "รับข้อมูลหน้างานจากลูกค้า รอถอดแบบ" }] }),
    mkJob({ id: "J-2611-0102", customer: "คุณรัตนา พรหมมา", phone: "062-555-0102", province: "สงขลา", product: "Solar Roof", pkg: "Solar Roof – 5 kWp", value: 245000, stage: "quote", lastTouchAt: hAgo(100), log: [{ at: hAgo(100), text: "ส่งใบเสนอราคาเบื้องต้นทาง LINE" }] }),
    mkJob({ id: "J-2611-0114", customer: "คุณธีรพงษ์ มั่นคง", phone: "085-555-0114", province: "นครปฐม", product: "Roof Install", pkg: "Standard Roof – โครงหลังคา", value: 212000, stage: "quote", lastTouchAt: hAgo(20), log: [{ at: hAgo(20), text: "ส่งใบเสนอราคาเบื้องต้น ลูกค้าขอเวลาปรึกษาครอบครัว" }] }),
    mkJob({ id: "J-2611-0103", customer: "คุณชนิดา วงศ์ใหญ่", phone: "087-555-0103", province: "สงขลา", product: "Roof Install", pkg: "Standard Roof – โครงหลังคา", value: 155000, stage: "deposit", lastTouchAt: hAgo(60), log: [{ at: hAgo(60), text: "ลูกค้าตกลงราคาเบื้องต้น ส่งใบแจ้งมัดจำ" }] }),
    mkJob({ id: "J-2611-0104", customer: "คุณเอกชัย ธรรมดี", phone: "086-555-0104", province: "ขอนแก่น", product: "Roof Install", pkg: "Standard Roof – กระเบื้อง", value: 186500, stage: "survey", surveyAt: dFromNow(0, 14), depositPaidAt: hAgo(90), lastTouchAt: hAgo(26), log: [{ at: hAgo(90), text: "รับมัดจำ 30% แล้ว" }, { at: hAgo(26), text: "นัดสำรวจหน้างานวันนี้ 14:00" }] }),
    mkJob({ id: "J-2611-0105", customer: "คุณวรรณา เพชรดี", phone: "064-555-0105", province: "กรุงเทพมหานคร", product: "Solar Roof", pkg: "Solar Roof – 5 kWp", value: 122000, stage: "survey", surveyAt: dFromNow(2, 10), depositPaidAt: hAgo(48), lastTouchAt: hAgo(12), log: [{ at: hAgo(48), text: "รับมัดจำ 30% แล้ว" }] }),
    mkJob({ id: "J-2611-0115", customer: "คุณสมพร บุญรอด", phone: "081-555-0115", province: "ภูเก็ต", product: "Roof Install", pkg: "Total Roof – Complete Roof", value: 398000, stage: "survey", depositPaidAt: hAgo(120), lastTouchAt: hAgo(70), log: [{ at: hAgo(120), text: "รับมัดจำ 30% แล้ว" }] }),
    mkJob({ id: "J-2611-0106", customer: "คุณประเสริฐ บุญมี", phone: "083-555-0106", province: "กรุงเทพมหานคร", product: "Roof Install", pkg: "Total Roof – Complete Roof", value: 520000, stage: "final", depositPaidAt: hAgo(200), lastTouchAt: hAgo(55), log: [{ at: hAgo(55), text: "สำรวจเสร็จ พบโครงเดิมต้องเสริม ปรับราคาใหม่" }] }),
    mkJob({ id: "J-2611-0107", customer: "คุณสมหมาย แก้วมณี", phone: "089-555-0107", province: "เชียงใหม่", product: "Solar Roof", pkg: "Solar Roof – 5 kWp", value: 98000, stage: "collect", depositPaidAt: hAgo(260), lastTouchAt: hAgo(30), log: [{ at: hAgo(30), text: "ลูกค้ายืนยันราคา Final ส่งใบแจ้งชำระส่วนที่เหลือ" }] }),
    mkJob({ id: "J-2611-0108", customer: "คุณลักขณา สายทอง", phone: "082-555-0108", province: "สงขลา", product: "Roof Install", pkg: "Standard Roof – กระเบื้อง", value: 245000, stage: "aftersale", depositPaidAt: hAgo(400), paidAt: hAgo(150), lastTouchAt: hAgo(40),
      after: { prep: hAgo(120) }, afterEta: { ship: dFromNow(-1, 9), install: dFromNow(2, 8), handover: dFromNow(6, 16) }, log: [{ at: hAgo(150), text: "รับเงินครบ 100% ส่งข้อมูลให้ทีมติดตั้ง" }, { at: hAgo(120), text: "คลังเตรียมสินค้าเสร็จ" }] }),
    mkJob({ id: "J-2611-0109", customer: "คุณบุญเรือง ทองคำ", phone: "080-555-0109", province: "ภูเก็ต", product: "Solar Roof", pkg: "Solar Roof – 10 kWp", value: 310000, stage: "aftersale", depositPaidAt: hAgo(500), paidAt: hAgo(260), lastTouchAt: hAgo(8),
      after: { prep: hAgo(240), ship: hAgo(200), install: hAgo(80) }, afterEta: { handover: dFromNow(0, 16) }, log: [{ at: hAgo(80), text: "ทีมติดตั้งเริ่มงานแล้ว" }] }),
    mkJob({ id: "J-2611-0110", customer: "คุณไพโรจน์ ดวงดี", phone: "087-555-0110", province: "ขอนแก่น", product: "Roof Install", pkg: "Standard Roof – โครงหลังคา", value: 175000, stage: "aftersale", depositPaidAt: hAgo(700), paidAt: hAgo(500), lastTouchAt: hAgo(52),
      after: { prep: hAgo(450), ship: hAgo(400), install: hAgo(300), handover: hAgo(52) }, afterEta: {}, log: [{ at: hAgo(52), text: "ส่งมอบงานให้ลูกค้า ลูกค้าเซ็นรับแล้ว" }] }),
    mkJob({ id: "J-2611-0111", customer: "คุณศิริพร จันทร์เพ็ญ", phone: "086-555-0111", province: "ระยอง", product: "Roof Install", pkg: "Standard Roof – กระเบื้อง", value: 129000, stage: "done", depositPaidAt: hAgo(900), paidAt: hAgo(750), lastTouchAt: hAgo(200),
      after: { prep: hAgo(700), ship: hAgo(650), install: hAgo(600), handover: hAgo(500), warranty: hAgo(480) }, log: [{ at: hAgo(480), text: "ออกใบรับประกัน 5 ปี" }] }),
    mkJob({ id: "J-2611-0112", customer: "คุณทวีศักดิ์ ศรีสวัสดิ์", phone: "081-555-0112", province: "นครสวรรค์", product: "Roof Install", pkg: "Standard Roof – โครงหลังคา", value: 98000, stage: "cancelled", cancelReason: "ลูกค้าเลื่อนโครงการไปปีหน้า", lastTouchAt: hAgo(300), log: [{ at: hAgo(300), text: "ลูกค้าแจ้งยกเลิก" }] }),
  ];
}

/* ---------- น้องเลขา: สร้างงานที่ต้องทำจากกฎ ---------- */
export type TaskKind = "lead_sla" | "lead_followup" | "lead_convert" | "survey_today" | "survey_book" | "quote_stale" | "deposit_chase" | "final_chase" | "collect" | "after_overdue" | "after_today" | "warranty";
export interface Task {
  id: string; kind: TaskKind; priority: 1 | 2 | 3; title: string; who: string; reason: string; action: string;
  ref: { type: "lead" | "job"; id: string }; draft?: string; value?: number; phone?: string;
}

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
        id: `t-${l.id}`, kind: "lead_convert", priority: 2, title: `เปิด Ops ให้ ${l.name}`, who: l.name, phone: l.phone,
        reason: `ผ่านการสกรีนแล้ว รอเปิด Ops มา ${durText(hoursSince(l.createdAt))} · ${l.product}`, action: "เปิด Ops", ref: { type: "lead", id: l.id },
      });
    }
  }
  for (const j of jobs) {
    const idle = hoursSince(j.lastTouchAt);
    const ref = { type: "job" as const, id: j.id };
    const base = { who: j.customer, phone: j.phone, value: j.value, ref };
    if (j.stage === "survey") {
      if (isToday(j.surveyAt)) out.push({ ...base, id: `t-${j.id}`, kind: "survey_today", priority: 1, title: `สำรวจหน้างาน ${j.customer}`, reason: `นัดวันนี้ ${timeTh(j.surveyAt)} · ${j.province}`, action: "ดูงาน",
        draft: `สวัสดีค่ะ คุณ${first(j.customer)} วันนี้ทีมสำรวจจะเข้าไปที่หน้างานเวลา ${timeTh(j.surveyAt)} นะคะ รบกวนให้มีผู้ดูแลพื้นที่อยู่ด้วยค่ะ` });
      else if (!j.surveyAt) out.push({ ...base, id: `t-${j.id}`, kind: "survey_book", priority: 2, title: `นัดสำรวจ ${j.customer}`, reason: `รับมัดจำแล้วแต่ยังไม่มีวันนัดสำรวจ (${durText(idle)})`, action: "นัดสำรวจ",
        draft: `สวัสดีค่ะ คุณ${first(j.customer)} ทีมได้รับมัดจำเรียบร้อยแล้วนะคะ ขอนัดวันเข้าสำรวจหน้างาน สะดวกวันไหนช่วงสัปดาห์นี้คะ` });
    }
    if (j.stage === "quote" && idle > 72) out.push({ ...base, id: `t-${j.id}`, kind: "quote_stale", priority: 2, title: `ตามใบเสนอราคา ${j.customer}`, reason: `ส่งราคาไปแล้ว ${durText(idle)} ยังไม่มีความเคลื่อนไหว`, action: "ตามลูกค้า",
      draft: `สวัสดีค่ะ คุณ${first(j.customer)} ทีม Housing Expert ติดตามใบเสนอราคา ${j.pkg} นะคะ มีส่วนไหนอยากให้ปรับหรืออธิบายเพิ่มไหมคะ` });
    if (j.stage === "deposit" && idle > 48) out.push({ ...base, id: `t-${j.id}`, kind: "deposit_chase", priority: 2, title: `เตือนมัดจำ ${j.customer}`, reason: `รอมัดจำ ${baht(depositOf(j))} มา ${durText(idle)}`, action: "แจ้งเตือน",
      draft: `สวัสดีค่ะ คุณ${first(j.customer)} ขอแจ้งยอดมัดจำ ${baht(depositOf(j))} เพื่อจองคิวสำรวจหน้างานนะคะ หากโอนแล้วรบกวนส่งสลิปได้เลยค่ะ` });
    if (j.stage === "final" && idle > 48) out.push({ ...base, id: `t-${j.id}`, kind: "final_chase", priority: 2, title: `ตามราคา Final ${j.customer}`, reason: `ส่งราคาหลังสำรวจไปแล้ว ${durText(idle)}`, action: "ตามลูกค้า",
      draft: `สวัสดีค่ะ คุณ${first(j.customer)} ทีมส่งใบเสนอราคาฉบับสุดท้ายหลังสำรวจหน้างานไปแล้วนะคะ ขออนุญาตสอบถามว่าสะดวกยืนยันราคาได้เมื่อไหร่คะ` });
    if (j.stage === "collect") out.push({ ...base, id: `t-${j.id}`, kind: "collect", priority: 1, title: `เก็บเงินส่วนที่เหลือ ${j.customer}`, reason: `ต้องเก็บครบ 100% ก่อนส่งงานติดตั้ง · คงเหลือ ${baht(j.value - depositOf(j))}`, action: "บันทึกรับเงิน",
      draft: `สวัสดีค่ะ คุณ${first(j.customer)} ขอแจ้งยอดคงเหลือ ${baht(j.value - depositOf(j))} เพื่อเข้าคิวติดตั้งนะคะ โอนแล้วรบกวนส่งสลิปให้ทีมได้เลยค่ะ` });
    if (j.stage === "aftersale") {
      const next = AFTER_STEPS.find((s) => !j.after[s.key]);
      if (next) {
        const eta = j.afterEta[next.key];
        if (eta && new Date(eta).getTime() < NOW.getTime() && !isToday(eta)) out.push({ ...base, id: `t-${j.id}`, kind: "after_overdue", priority: 1, title: `${next.label}เลยกำหนด · ${j.customer}`, reason: `${next.team} ควรเสร็จเมื่อ ${dtTh(eta)} (เลยมา ${durText(hoursSince(eta))}) ยังไม่มีสถานะกลับมา`, action: "ถามทีม",
          draft: `ทีม${next.team.replace("ทีม", "")} ขอสถานะงาน ${j.id} (${j.customer}) ขั้น "${next.label}" หน่อยครับ เลยกำหนดมาแล้ว` });
        else if (eta && isToday(eta)) out.push({ ...base, id: `t-${j.id}`, kind: "after_today", priority: 2, title: `${next.label}วันนี้ · ${j.customer}`, reason: `กำหนด ${timeTh(eta)} วันนี้ โดย${next.team}`, action: "ดูสถานะ" });
        if (next.key === "warranty" && j.after.handover) out.push({ ...base, id: `t-${j.id}-w`, kind: "warranty", priority: 2, title: `ออกใบรับประกัน ${j.customer}`, reason: `ส่งมอบเมื่อ ${agoText(j.after.handover)} ยังไม่ออกใบรับประกัน`, action: "ออกใบรับประกัน",
          draft: `สวัสดีค่ะ คุณ${first(j.customer)} ทีมขอส่งใบรับประกันงาน ${j.pkg} ให้นะคะ หากมีข้อสงสัยหลังใช้งานติดต่อได้ตลอดค่ะ` });
      }
    }
  }
  return out.sort((a, b) => a.priority - b.priority || (b.value ?? 0) - (a.value ?? 0));
}

export const TASK_ICON: Record<TaskKind, string> = {
  lead_sla: "call", lead_followup: "forum", lead_convert: "rocket_launch", survey_today: "pin_drop", survey_book: "event", quote_stale: "request_quote",
  deposit_chase: "payments", final_chase: "edit_note", collect: "account_balance_wallet", after_overdue: "warning", after_today: "schedule", warranty: "workspace_premium",
};

/** งานที่เสี่ยงหลุด (ใช้ในหน้าหลักและแชตเลขา) */
export function atRisk(leads: Lead[], jobs: Job[]) {
  const risky = jobs.filter((j) => (j.stage === "quote" && hoursSince(j.lastTouchAt) > 72) || (j.stage === "deposit" && hoursSince(j.lastTouchAt) > 48) || (j.stage === "final" && hoursSince(j.lastTouchAt) > 48));
  const breach = leads.filter((l) => l.status === "waiting" && leadSla(l).state === "breach");
  return { jobs: risky, leads: breach, value: risky.reduce((s, j) => s + j.value, 0) };
}
