/* ขอคืนเงินลูกค้า — ชนิดข้อมูล / ป้าย / เรียก API ฝั่งหน้าจอ */
import { createClient } from "@/lib/supabase/client";
import { fileToResizedBlob } from "./image";

export type RefundType = "wht" | "full" | "partial";
export type JobGroup = "roof" | "metal" | "smart";
export type CustType = "company" | "person";
export type DocKind = "wht_cert" | "company_cert" | "id_card" | "bookbank" | "slip" | "receipt";
export type RefundRole = "sales" | "approver" | "finance" | "accounting" | "admin" | "viewer";
export type RefundStatus = "pending_approval" | "returned" | "finance_returned" | "pending_finance" | "finance_working" | "pending_transfer" | "transferred" | "closed" | "rejected" | "cancelled";

export const REFUND_TYPES: { key: RefundType; label: string; desc: string; icon: string }[] = [
  { key: "wht", label: "คืนภาษีหัก ณ ที่จ่าย", desc: "ลูกค้าชำระเต็มจำนวน แล้วส่งหนังสือรับรองหัก ณ ที่จ่ายมาภายหลัง", icon: "receipt_long" },
  { key: "full", label: "คืนเต็มจำนวน", desc: "ลูกค้ายกเลิกงานทั้งหมด", icon: "cancel" },
  { key: "partial", label: "คืนบางส่วน", desc: "ลูกค้ายกเลิกงานบางส่วน / ลดขอบเขตงาน", icon: "content_cut" },
];
export const JOB_GROUPS: { key: JobGroup; label: string }[] = [
  { key: "roof", label: "Roof Installation" },
  { key: "metal", label: "Metal Roof" },
  { key: "smart", label: "Smart Solution" },
];
export const CUST_TYPES: { key: CustType; label: string }[] = [
  { key: "company", label: "นิติบุคคล" },
  { key: "person", label: "บุคคลธรรมดา" },
];
export const WHT_RATE = 3;
export const BANKS = ["กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย", "กรุงศรีอยุธยา", "ทหารไทยธนชาต", "ออมสิน", "ธ.ก.ส.", "ยูโอบี", "ซีไอเอ็มบี ไทย", "เกียรตินาคินภัทร", "แลนด์ แอนด์ เฮ้าส์", "อาคารสงเคราะห์", "อื่นๆ"];
export const CARRIERS = ["ไปรษณีย์ไทย (EMS)", "Kerry Express", "Flash Express", "J&T Express", "แมสเซนเจอร์ภายใน", "อื่นๆ"];
export const DOC_ADDRESS = [
  "คุณบุษบาศ ซื่อสัตย์ (บัญชี LHS) โทร. 065-719-7915",
  "อาคาร 17 ชั้น 2 สำนักงานใหญ่บางซื่อ บริษัท เอสซีจี ลิฟวิ่ง แอนด์ เฮ้าส์ซิ่ง โซลูชั่น จำกัด",
  "1 ถนนปูนซิเมนต์ไทย แขวงบางซื่อ เขตบางซื่อ กรุงเทพมหานคร 10800",
];
export const DOC_META: Record<DocKind, { label: string; hint: string }> = {
  wht_cert: { label: "หนังสือรับรองการหักภาษี ณ ที่จ่าย (ฉบับจริง)", hint: "ระบุยอดถูกต้อง พร้อมประทับตราบริษัท" },
  company_cert: { label: "สำเนาหนังสือรับรองบริษัท / ภ.พ.20", hint: "เซ็นรับรองสำเนาถูกต้อง พร้อมลงลายมือชื่อ" },
  id_card: { label: "สำเนาบัตรประจำตัวประชาชน", hint: "เซ็นรับรองสำเนาถูกต้อง พร้อมลงลายมือชื่อ" },
  bookbank: { label: "สำเนา Book bank", hint: "เซ็นรับรองสำเนาถูกต้อง ชื่อบัญชีตรงกับชื่อลูกค้า" },
  slip: { label: "สลิปโอนเงินที่ลูกค้าชำระ", hint: "หลักฐานการชำระเงินของลูกค้า" },
  receipt: { label: "ใบเสร็จรับเงิน (CSD)", hint: "ใบเสร็จที่ออกให้ลูกค้า" },
};
export function docHint(key: DocKind, type: RefundType | ""): string {
  if (key === "bookbank" && type === "wht") return "เซ็นรับรองสำเนาถูกต้อง ใช้ชื่อเดียวกันที่ระบุในเอกสารหักภาษี ณ ที่จ่าย";
  return DOC_META[key].hint;
}
export function requiredDocs(type: RefundType, cust: CustType): DocKind[] {
  if (type === "wht") return ["wht_cert", "company_cert", "bookbank", "slip", "receipt"];
  return cust === "company" ? ["company_cert", "bookbank", "slip", "receipt"] : ["id_card", "bookbank", "slip", "receipt"];
}
export const STATUS_META: Record<RefundStatus, { label: string; cls: string }> = {
  pending_approval: { label: "รออนุมัติ", cls: "bg-amber-100 text-amber-800" },
  returned: { label: "ตีกลับให้แก้", cls: "bg-orange-100 text-orange-800" },
  finance_returned: { label: "Finance แจ้งแก้ไข", cls: "bg-rose-100 text-rose-800" },
  pending_finance: { label: "รอ Finance รับงาน", cls: "bg-sky-100 text-sky-800" },
  finance_working: { label: "Finance กำลังตรวจ", cls: "bg-indigo-100 text-indigo-800" },
  pending_transfer: { label: "รอบัญชีโอนเงิน", cls: "bg-violet-100 text-violet-800" },
  transferred: { label: "โอนแล้ว · รอแจ้งลูกค้า", cls: "bg-emerald-100 text-emerald-800" },
  closed: { label: "ปิดงาน", cls: "bg-slate-200 text-slate-700" },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-red-100 text-red-700" },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-500" },
};
export const STEPS = ["ส่งคำขอ", "อนุมัติ", "Finance", "บัญชีโอนเงิน", "แจ้งลูกค้า"];
export const stepIndex = (s: RefundStatus): number =>
  ({ pending_approval: 1, returned: 0, finance_returned: 0, pending_finance: 2, finance_working: 2, pending_transfer: 3, transferred: 4, closed: 5, rejected: 1, cancelled: 0 })[s];
export const typeLabel = (t: RefundType) => REFUND_TYPES.find((x) => x.key === t)?.label ?? t;
export const groupLabel = (g: JobGroup) => JOB_GROUPS.find((x) => x.key === g)?.label ?? g;

/* ---------- รูปแบบตัวเลข ---------- */
export const baht2 = (n: number | null | undefined) => (n == null ? "-" : "฿" + Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const fmt2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (s: string) => { const n = parseFloat(String(s).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
/** เลขผู้เสียภาษี / บัตรประชาชน ตามรูปแบบกรมสรรพากร X-XXXX-XXXXX-XX-X */
export const fmtTaxId = (raw: string) => {
  const d = String(raw ?? "").replace(/\D/g, "").slice(0, 13);
  return [d.slice(0, 1), d.slice(1, 5), d.slice(5, 10), d.slice(10, 12), d.slice(12, 13)].filter(Boolean).join("-");
};

/* ---------- API ---------- */
async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const j = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as T & { ok?: boolean; error?: string };
  if (!res.ok || j.ok === false) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}
const post = <T>(url: string, body: unknown) => getJson<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export interface RefundListItem {
  id: number; reqNo: string; isTest: boolean; status: RefundStatus; round: number; type: RefundType; group: JobGroup;
  custName: string; amount: number; projectNo: string; soNo: string | null;
  requesterId: string; requesterName: string; dealerName: string | null;
  approverId: string | null; approverName: string | null; financeId: string | null; financeName: string | null;
  hasParcel: boolean; docsReceived: boolean; createdAt: string; updatedAt: string; dueAt: string | null; transferDate: string | null;
}
export interface Person { id: string; name: string; title: string }
export interface RefundOptions {
  requester: { name: string; email: string | null; phone: string | null; unit: string | null; dealerCode: string | null };
  approvers: Record<JobGroup, Person | null>;
  areas: Person[];
  enabled: boolean;
  /** บัญชีพนักงานขายส่วนกลาง: ผู้ขอกรอกข้อมูลตัวเองในฟอร์ม */
  central?: boolean;
}
export interface RequesterForm { name: string; nickname: string; email: string; phone: string; unit: string }
export interface RefundFile { id: number; kind: DocKind | "revised_receipt" | "other"; round: number; name: string; size: number | null; mime: string | null; created_at: string }
export interface RefundEventRow { at: string; actor_name: string | null; kind: string; text: string | null; tone: "ok" | "warn" | "bad" | null }
export interface RefundDetail {
  id: number; req_no: string; status: RefundStatus; round: number; refund_type: RefundType; job_group: JobGroup; is_test: boolean;
  project_no: string; so_no: string | null; receipt_no: string | null; project_name: string | null;
  cust_type: CustType; cust_name: string; cust_tax_id: string; cust_branch: string | null; cust_phone: string | null;
  paid_amount: number; wht_base: number | null; wht_rate: number | null; refund_amount: number; cancel_detail: string | null; reason: string | null;
  bank_name: string; bank_account_no: string; bank_account_name: string; customer_sends_direct: boolean;
  parcel_carrier: string | null; parcel_tracking: string | null; parcel_sent_at: string | null; docs_received_at: string | null;
  approved_at: string | null; finance_done_at: string | null; finance_note: string | null; finance_issue: { items: string[]; text: string; at: string } | null;
  transfer_date: string | null; created_at: string; due_at: string | null;
  requester: { id: string; name: string; phone: string | null; email: string | null };
  dealer_name: string | null; requester_unit: string | null;
  requester_name: string | null; requester_nickname: string | null; requester_email: string | null; requester_phone: string | null;
  approver: { id: string; name: string; phone: string | null } | null;
  finance: { id: string; name: string; phone: string | null } | null;
  required_docs: DocKind[]; files: RefundFile[]; events: RefundEventRow[];
}
export interface RefundCaps {
  approve: boolean; edit: boolean; parcel: boolean; cancel: boolean;
  claim: boolean; financeAct: boolean; receiveDocs: boolean; transfer: boolean; inform: boolean;
}
/** รายการที่ Finance เลือกตอนแจ้งกลับ (นอกเหนือจากชนิดเอกสาร) — ตรงกับ FINANCE_CHECKS ฝั่ง server */
export const FINANCE_CHECKS: { key: string; label: string }[] = [
  { key: "amount", label: "ยอดเงินที่ขอคืนไม่ถูกต้อง / ไม่ตรงกับเอกสาร" },
  { key: "bank", label: "บัญชีรับเงินคืน (ชื่อ / เลขบัญชี) ไม่ตรงกับ Book bank" },
  { key: "customer", label: "ข้อมูลลูกค้า / เลขผู้เสียภาษีไม่ถูกต้อง" },
  { key: "project", label: "เลข Project / SO / ใบเสร็จไม่ถูกต้อง" },
  { key: "reason", label: "สาเหตุการคืนเงินไม่ชัดเจน" },
];
export interface RefundInput {
  refundType: RefundType | ""; jobGroup: JobGroup | ""; projectNo: string; soNo: string; receiptNo: string; projectName: string;
  custType: CustType | ""; custName: string; custTaxId: string; custBranch: string; custPhone: string;
  paidAmount: number; whtBase: number | null; refundAmount: number; cancelDetail: string; reason: string;
  bankName: string; bankAccountNo: string; bankAccountName: string; customerSendsDirect: boolean; approverId?: string;
}
export interface UploadedDoc { kind: DocKind | "revised_receipt"; path: string; name: string; size: number; mime: string }

export const fetchRefundList = () => getJson<{ role: RefundRole; me: string; enabled: boolean; items: RefundListItem[] }>("/api/refund");
export const fetchRefundOptions = () => getJson<RefundOptions>("/api/refund/options");
export const fetchRefund = (id: number) => getJson<{ role: RefundRole; me: string; caps: RefundCaps; item: RefundDetail }>(`/api/refund/${id}`);
export const createRefund = (body: RefundInput & { files: UploadedDoc[] }) => post<{ id: number; reqNo: string }>("/api/refund", body);
export const refundAction = (id: number, body: Record<string, unknown>) => post<{ ok: true }>(`/api/refund/${id}`, body);
export const refundFileUrl = (id: number, download = false) => `/api/refund/file?id=${id}${download ? "&download=1" : ""}`;

/** อัปโหลดเอกสารตรงเข้า Storage (รูปย่อด้านยาว 2000px ก่อนส่ง ; PDF / HEIC ส่งตามเดิม) */
export async function uploadRefundDoc(file: File, kind: DocKind | "revised_receipt", requestId?: number): Promise<UploadedDoc> {
  let blob: Blob = file;
  let name = file.name;
  let mime = file.type || "application/octet-stream";
  if (/^image\/(jpeg|png|webp)$/.test(mime)) {
    blob = await fileToResizedBlob(file, 2000, 0.85);
    mime = "image/jpeg";
    name = name.replace(/\.[^.]+$/, "") + ".jpg";
  }
  if (blob.size > 10 * 1024 * 1024) throw new Error(`${file.name}: ไฟล์ใหญ่เกิน 10MB`);
  const sign = await post<{ path: string; token: string }>("/api/refund/upload", { kind, name, size: blob.size, mime, requestId });
  const { error } = await createClient().storage.from("refund-files").uploadToSignedUrl(sign.path, sign.token, blob, { contentType: mime });
  if (error) throw new Error(`${file.name}: อัปโหลดไม่สำเร็จ (${error.message})`);
  return { kind, path: sign.path, name, size: blob.size, mime };
}

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function dateTh(iso: string | null | undefined, time = false): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const s = `${d.getDate()} ${TH_MONTH[d.getMonth()]} ${String((d.getFullYear() + 543) % 100).padStart(2, "0")}`;
  return time ? `${s} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : s;
}
