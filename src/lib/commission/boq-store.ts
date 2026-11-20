"use client";
/* BOQ สินค้า DECAAR — ตัวเรียก API ฝั่งหน้าจอ + ค่าคงที่ที่ใช้แสดงผล */
import { createClient } from "@/lib/supabase/client";
import { fileToResizedBlob } from "./image";
import type { BoqSummary } from "@/lib/server/boq-summary";
export type { BoqSummary };

export type BoqStatus = "waiting" | "working" | "submitted" | "revise" | "need_info" | "boq_ok" | "quoted" | "win" | "loss" | "cancelled";

/** ข้อมูลที่ห้องแบบขอเพิ่ม (ร่าง) — ต้องตรงกับ NEED_INFO_ITEMS ฝั่ง server */
export const NEED_INFO_ITEMS: { key: string; label: string }[] = [
  { key: "photo", label: "รูปจุดที่ใช้สินค้าไม่ชัด / ไม่ครบ" },
  { key: "plan", label: "ไม่มีแบบแปลน / ขนาด" },
  { key: "size_mismatch", label: "ขนาดพื้นที่ไม่ตรงกับรูป" },
  { key: "spec", label: "ไม่ได้ระบุสี / รุ่นสินค้า" },
  { key: "site_photo", label: "ไม่มีรูปหน้างานจริง" },
];
export type BoqRole = "sales" | "designer" | "marketing" | "admin" | "viewer";
export type BoqFileKind = "photo" | "plan" | "old_design" | "boq" | "d3" | "revise";

export const STATUS_META: Record<BoqStatus, { label: string; cls: string }> = {
  waiting: { label: "รอห้องแบบรับงาน", cls: "bg-amber-100 text-amber-800" },
  working: { label: "ห้องแบบกำลังทำ", cls: "bg-sky-100 text-sky-800" },
  submitted: { label: "ส่ง BOQ แล้ว รอตรวจ", cls: "bg-violet-100 text-violet-800" },
  revise: { label: "ขอแก้ไข", cls: "bg-orange-100 text-orange-800" },
  need_info: { label: "รอพนักงานเติมข้อมูล", cls: "bg-rose-100 text-rose-800" },
  boq_ok: { label: "BOQ ผ่าน รอใบเสนอราคา", cls: "bg-teal-100 text-teal-800" },
  quoted: { label: "เสนอราคาแล้ว รอผล", cls: "bg-indigo-100 text-indigo-800" },
  win: { label: "Win", cls: "bg-emerald-100 text-emerald-800" },
  loss: { label: "Loss", cls: "bg-slate-200 text-slate-700" },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-500" },
};
export const STEPS: { label: string; match: BoqStatus[] }[] = [
  { label: "ส่งคำขอ", match: ["waiting"] },
  { label: "ห้องแบบทำ", match: ["working", "revise", "need_info"] },
  { label: "ตรวจ BOQ", match: ["submitted"] },
  { label: "BOQ ผ่าน", match: ["boq_ok"] },
  { label: "เสนอราคา", match: ["quoted"] },
  { label: "Win/Loss", match: ["win", "loss"] },
];
export const CUST_TYPES = ["เจ้าของบ้าน", "ช่าง/ผรม.", "อื่นๆ"];
export const JOB_TYPES = ["สร้างใหม่", "รีโนเวท"];
export const BUILDING_TYPES = ["บ้านอยู่อาศัย", "อาคาร"];
export const NEEDS: { key: "boq" | "boq_3d"; label: string }[] = [
  { key: "boq", label: "ทำ BOQ" },
  { key: "boq_3d", label: "ทำ BOQ และ แบบ 3D" },
];
export const needLabel = (n: string) => NEEDS.find((x) => x.key === n)?.label ?? n;
export const SLA_DAYS = (need: string) => (need === "boq_3d" ? 5 : 3);

/** menu = กลุ่มใน dropdown (เช่น "กรุผนัง – SCG DECAAR โมดิน่า") ; null = สินค้าที่ถูกซ่อนแล้วแต่คำขอเก่ายังอ้างอยู่ */
export interface BoqProduct { code: string; name: string; grp: string | null; sub: string | null; size: string | null; unit: "m" | "area"; menu?: string | null; menu_sort?: number | null }
export interface LossReason { code: string; label: string }

export interface BoqListItem {
  id: number;
  reqNo: string;
  status: BoqStatus;
  customerName: string;
  province: string | null;
  need: string;
  budget: number;
  createdAt: string;
  dueAt: string;
  claimedAt: string | null;
  boqOkAt: string | null;
  closedAt: string | null;
  dealerCode: string;
  dealerName: string;
  repCode: string;
  repName: string;
  designerId: string | null;
  designerName: string | null;
  points: number;
  versions: number;
  quoteAmount: number | null;
  finalAmount: number | null;
  lossReason: string | null;
}

export interface BoqFile { id: number; kind: BoqFileKind; version: number | null; name: string; size: number | null; mime: string | null; created_at: string }
export interface BoqDetail {
  id: number;
  reqNo: string;
  status: BoqStatus;
  dealerCode: string;
  dealerName: string;
  repCode: string;
  repName: string;
  repPhone: string | null;
  recorderEmail: string | null;
  customerName: string;
  customerPhone: string | null;
  province: string | null;
  customerType: string;
  customerTypeOther: string | null;
  jobType: string;
  buildingType: string;
  need: string;
  budget: number;
  wantDate: string | null;
  note: string | null;
  opNo: string | null;
  createdAt: string;
  dueAt: string;
  claimedAt: string | null;
  designerId: string | null;
  designerName: string | null;
  approvedVersion: number | null;
  boqOkAt: string | null;
  finalAmount: number | null;
  lossReason: string | null;
  winReasons: string[];
  resultNote: string | null;
  closedAt: string | null;
  points: { no: number; code: string; length: number | null; width: number | null; detail: string | null; product: BoqProduct | null }[];
  files: BoqFile[];
  versions: { v: number; note: string | null; at: string; by: string | null }[];
  quotes: { no: string; amount: number; at: string }[];
  events: { at: string; actor_name: string | null; kind: string; text: string; tone: "warn" | "ok" | "bad" | null }[];
}
export interface BoqCaps { claim: boolean; release: boolean; submit: boolean; review: boolean; edit: boolean; requestInfo: boolean; provideInfo: boolean; quote: boolean; result: boolean; cancel: boolean }

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const j = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as T & { ok?: boolean; error?: string };
  if (!res.ok || j.ok === false) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export interface BoqRecorder { name: string; email: string | null; dealerCode: string; dealerName: string }
export const fetchBoqProducts = () =>
  getJson<{ products: BoqProduct[]; lossReasons: LossReason[]; recorder: BoqRecorder | null }>("/api/boq/products");
export const fetchBoqList = (dealerCode?: string | null) =>
  getJson<{ role: BoqRole; me: string; enabled: boolean; items: BoqListItem[] }>(`/api/boq${dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : ""}`);
export const fetchBoq = (id: number) => getJson<{ role: BoqRole; me: string; caps: BoqCaps; lossReasons: LossReason[]; winReasons: LossReason[]; item: BoqDetail }>(`/api/boq/${id}`);
export const boqAction = (id: number, body: Record<string, unknown>) =>
  getJson<{ ok: true }>(`/api/boq/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const createBoq = (body: Record<string, unknown>) =>
  getJson<{ id: number; reqNo: string }>("/api/boq", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export interface BoqFilterInput { year?: number | "all"; month?: number | null; model?: string | null; region?: string | null; area?: string | null; dealer?: string | null }
export const boqFilterQuery = (f: BoqFilterInput) => {
  const sp = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v != null && v !== "" && sp.set(k, String(v)));
  return sp.toString();
};
export const fetchBoqSummary = (f: BoqFilterInput = {}) => getJson<{ ok: true } & BoqSummary>(`/api/boq/summary?${boqFilterQuery(f)}`);
export const boqExportUrl = (f: BoqFilterInput) => `/api/boq/export?${boqFilterQuery(f)}`;
export const fileUrl = (id: number, download = false) => `/api/boq/file?id=${id}${download ? "&download=1" : ""}`;

export interface UploadedFile { path: string; name: string; size: number; mime: string; kind: BoqFileKind }

/** อัปโหลดไฟล์ตรงเข้า Storage ผ่าน signed URL (รูปภาพย่อก่อนส่ง ยกเว้น HEIC ที่เบราว์เซอร์อ่านไม่ได้) */
export async function uploadBoqFile(file: File, kind: BoqFileKind, requestId?: number): Promise<UploadedFile> {
  let blob: Blob = file;
  let name = file.name;
  let mime = file.type || "application/octet-stream";
  if (/^image\/(jpeg|png|webp)$/.test(mime) && (kind === "photo" || kind === "plan" || kind === "old_design" || kind === "revise")) {
    blob = await fileToResizedBlob(file, 2000, 0.85);
    mime = "image/jpeg";
    name = name.replace(/\.[^.]+$/, "") + ".jpg";
  }
  if (blob.size > 50 * 1024 * 1024) throw new Error(`${file.name}: ไฟล์ใหญ่เกิน 50MB`);
  const sign = await getJson<{ path: string; token: string }>("/api/boq/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, name, size: blob.size, mime, requestId }),
  });
  const { error } = await createClient().storage.from("boq-files").uploadToSignedUrl(sign.path, sign.token, blob, { contentType: mime });
  if (error) throw new Error(`${file.name}: อัปโหลดไม่สำเร็จ (${error.message})`);
  return { path: sign.path, name, size: blob.size, mime, kind };
}

/* ---------- แสดงผล ---------- */
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function dateTh(iso: string | null | undefined, time = false): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const s = `${d.getDate()} ${TH_MONTH[d.getMonth()]} ${String((d.getFullYear() + 543) % 100).padStart(2, "0")}`;
  return time ? `${s} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : s;
}
export const baht = (n: number | null | undefined) => (n == null ? "-" : `฿${Math.round(n).toLocaleString("th-TH")}`);
export const fmtNum = (n: number, d = 2) => n.toLocaleString("th-TH", { maximumFractionDigits: d });

export function pointText(p: { length: number | null; width: number | null; product: BoqProduct | null }): string {
  if (p.product?.unit === "area") return `${fmtNum(p.width ?? 0)} × ${fmtNum(p.length ?? 0)} ม. = ${fmtNum((p.width ?? 0) * (p.length ?? 0))} ตร.ม.`;
  return `${fmtNum(p.length ?? 0)} ม.`;
}

/** สถานะ SLA ของห้องแบบ (นับวันปฏิทินแบบหยาบ — ครบกำหนดจริงคำนวณที่ server รวมวันหยุดแล้ว) */
export function slaBadge(dueAt: string, now = new Date()): { text: string; cls: string } {
  const due = new Date(dueAt);
  const ms = due.getTime() - now.getTime();
  if (ms < 0) return { text: `เกินกำหนด (${dateTh(dueAt)})`, cls: "bg-red-100 text-red-700" };
  const days = ms / 86400000;
  if (days < 1) return { text: `ครบกำหนด ${dateTh(dueAt, true)}`, cls: "bg-amber-100 text-amber-800" };
  return { text: `กำหนดส่ง ${dateTh(dueAt)}`, cls: "bg-emerald-50 text-emerald-700" };
}

export const DESIGNER_PHASE: BoqStatus[] = ["waiting", "working", "revise"];
