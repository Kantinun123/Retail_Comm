/* Shared domain types for the commission portal */

export type Role = "dealer" | "sales" | "admin";

export type GroupKey = "solution" | "product";

export type SaleStatus = "paid" | "pending" | "processing";

/** กลุ่มสถานะการจ่ายที่ใช้ในตัวกรอง (รอจ่าย = pending + processing) */
export type PaymentStatus = "paid" | "pending";

export type TrackingKey =
  | "contract"
  | "survey"
  | "install"
  | "qc"
  | "delivered";

export interface Dealer {
  code: string;
  name: string;
  branch: string;
  taxId: string;
  tier: string;
  model: string;
  pointCompanyCode: string;
}

export interface Solution {
  id: string;
  group: GroupKey;
  name: string;
  category: string;
  rate: number;
  icon: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  phone: string;
  /** รหัสร้านค้าที่พนักงานสังกัด (ใช้กรองข้อมูลรายพนักงานตามร้านที่ล็อกอิน) */
  dealerCode?: string;
  /** URL รูปพนักงาน (ถ้ามี) — ไม่มี = ใช้ตัวย่อ avatar แทน */
  photoUrl?: string;
}

export interface Sale {
  id: string;
  period: string; // YYYY-MM
  empId: string;
  solId: string;
  date: string;
  soldDate: string;
  customer: string;
  amount: number;
  status: SaleStatus;
  projectId: string;
  tracking: TrackingKey;
  /** รหัสร้านค้าที่งานนี้สังกัด (ข้อมูลจริงจากไฟล์) */
  dealerCode?: string;
  /** ค่าคอมมิชชันร้านค้า (บาท) — ค่าจริงจากไฟล์ */
  comm?: number;
  /** อินเซนทีฟพนักงาน (บาท) — ค่าจริงจากไฟล์ */
  inc?: number;
  /* ---- ค่าดิบเพิ่มเติมจากไฟล์ CSV (เฉพาะที่ derive จาก field อื่นไม่ได้) ---- */
  /** ที่มาของข้อมูล เช่น "Netsuite" */
  src?: string;
  /** ชื่อผู้ขาย (ตามไฟล์) */
  seller?: string;
  /** กลุ่มผู้ที่รับผลประโยชน์ (ฝั่งร้านค้า) */
  benGroup?: string;
  /** ช่วงเวลาที่ปิดขาย เช่น "21/07/2026 - 20/09/2026" */
  closeRange?: string;
  /** วันที่ปิดขาย (ดิบ DD/MM/YY ตามไฟล์) */
  closeDateRaw?: string;
  /** วันที่โอนจ่าย (ดิบ DD-MM-YY ตามไฟล์) */
  payDateRaw?: string;
  /** อัตราผลประโยชน์ร้านค้า (ดิบ เช่น "7.00%") */
  commRate?: string;
  /** อัตราผลประโยชน์พนักงาน (ดิบ เช่น "0.80%") */
  incRate?: string;
}

export interface PointCompany {
  code: string;
  name: string;
  model: string;
  region: string;
  points: number;
}

export interface PointEmployee {
  empCode: string;
  name: string;
  companyCode: string;
  avatar: string;
  points: number;
}

/** ล็อตแต้ม: แต้มที่ได้มาเป็นก้อน มีวันได้มา + วันหมดอายุ */
export interface PointLot {
  /** แต้มในล็อตนี้ */
  points: number;
  /** วันที่ได้แต้ม (YYYY-MM-DD) */
  earnedDate: string;
  /** วันหมดอายุ (YYYY-MM-DD) */
  expireDate: string;
}

/** ของรางวัลใน catalog */
export interface GiftItem {
  id: string;
  name: string;
  /** หมวด เช่น บัตรกำนัล / เครื่องใช้ไฟฟ้า */
  category: string;
  /** ไอคอน Material Symbols (fallback เมื่อไม่มีรูป) */
  icon: string;
  /** รูปของรางวัล (ไฟล์ใน public/gifts/) — ไม่มี = ใช้ไอคอนแทน */
  imageUrl?: string;
  /** แต้มที่ใช้แลก */
  cost: number;
}

/** สถานะการแลกของรางวัล (flow) */
export type RedemptionStatus =
  | "pending" // รออนุมัติ
  | "approved" // อนุมัติแล้ว (จะเข้าสู่รอจัดส่งทันที)
  | "shipping" // รอจัดส่ง/กำลังจัดส่ง
  | "delivered" // ส่งมอบแล้ว (รอสมาชิกกดรับ)
  | "received" // สมาชิกยืนยันรับของแล้ว
  | "rejected"; // ไม่อนุมัติ (คืนแต้ม)

/** วิธีรับของรางวัล */
export type DeliveryMethod = "self" | "team" | "parcel";

/** ช่วงเวลาที่แต่ละขั้นถูกดำเนินการ (epoch ms, null = ยังไม่ถึง) */
export interface RedemptionTimeline {
  requested: number; // กดแลก
  reviewed: number | null; // แอดมินอนุมัติ/ไม่อนุมัติ
  shipping: number | null; // เข้าสู่รอจัดส่ง
  delivered: number | null; // จัดส่งแล้ว
  received: number | null; // สมาชิกกดรับของ
}

/** ประวัติ/คำขอแลกของรางวัล (เก็บในเครื่อง) */
export interface Redemption {
  id: string;
  /** เลขคำขออ้างอิง เช่น RDM-000123 */
  reqNo: string;
  giftId: string;
  giftName: string;
  cost: number;
  /** epoch ms (= timeline.requested) */
  time: number;
  status: RedemptionStatus;
  method: DeliveryMethod;
  /** ที่อยู่จัดส่ง (เฉพาะ method = parcel) */
  address?: string;
  /** เลขพัสดุ (เฉพาะ parcel ตอนจัดส่ง) */
  trackingNo?: string;
  /** เหตุผลเมื่อไม่อนุมัติ */
  rejectReason?: string;
  /** รูปหลักฐานรับของ (base64 ย่อขนาด, แนบได้หลายรูป ไม่บังคับ) */
  proofPhotos?: string[];
  timeline: RedemptionTimeline;
  /** เจ้าของคำขอ (key = emp:<id> / dealer:<code>) + ชื่อแสดงผล (ให้แอดมินเห็น) */
  ownerKey: string;
  ownerName: string;
}

export interface GroupMeta {
  key: GroupKey;
  label: string;
  icon: string;
}

export interface Totals {
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  count: number;
}

/** Selection state persisted per-session, mirrors the reference sessionStorage keys */
export interface FilterState {
  years: string[];
  /** map of year -> selected months ("all" | ["01", ...]) */
  monthsByYear: Record<string, "all" | string[]>;
  /** "all" | selected group keys */
  groups: "all" | GroupKey[];
  /** "all" | selected payment statuses (รอจ่าย = pending + processing) */
  statuses?: "all" | PaymentStatus[];
  /** "all" | รหัสกลุ่มของงานที่เลือก (solId เช่น "G01") — ตัวกรองย่อยถัดจากประเภทการขาย */
  jobGroups?: "all" | string[];
  /** "all" | ประเภทผลประโยชน์ที่เลือก (เช่น "Commission", "Back Margin", "Incentive") */
  benefitTypes?: "all" | string[];
  /** ประเภทวันที่ที่ใช้กรอง: "pay" = วันที่โอนจ่าย (ค่าเริ่มต้น), "close" = วันที่ปิดขาย */
  dateField?: "pay" | "close";
  /** โหมดการเลือกช่วงเวลา: "period" = ปี-เดือน (ค่าเริ่มต้น), "range" = ช่วงวันที่ */
  dateMode?: "period" | "range";
  /** โหมด range: วันที่เริ่ม (YYYY-MM-DD) */
  dateFrom?: string;
  /** โหมด range: วันที่สิ้นสุด (YYYY-MM-DD) */
  dateTo?: string;
}
