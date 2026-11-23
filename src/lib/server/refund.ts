/* ขอคืนเงินลูกค้า (กรณีลูกค้าจ่ายเงินตรง SCG) — กติกากลางฝั่ง server: บทบาท, สิทธิ์, ผู้อนุมัติ, ตรวจข้อมูล, แจ้งเตือน */
import type { AuthContext } from "@/lib/supabase/auth-context";
import { canAccessDealer } from "@/lib/supabase/auth-context";
import type { createServiceClient } from "@/lib/supabase/service";
import { pushToUser } from "@/lib/server/push";
type Sb = ReturnType<typeof createServiceClient>;

export const REFUND_BUCKET = "refund-files";
export const REFUND_TYPES = ["wht", "full", "partial"] as const;
export const JOB_GROUPS = ["roof", "metal", "smart"] as const;
export const DOC_KINDS = ["wht_cert", "company_cert", "id_card", "bookbank", "slip", "receipt"] as const;
export type RefundType = (typeof REFUND_TYPES)[number];
export type JobGroup = (typeof JOB_GROUPS)[number];
export type DocKind = (typeof DOC_KINDS)[number];
export const TYPE_LABEL: Record<RefundType, string> = { wht: "คืนภาษีหัก ณ ที่จ่าย", full: "คืนเต็มจำนวน", partial: "คืนบางส่วน" };
export const GROUP_LABEL: Record<JobGroup, string> = { roof: "Roof Installation", metal: "Metal Roof", smart: "Smart Solution" };
/** อัตราภาษีหัก ณ ที่จ่าย (คงที่) */
export const WHT_RATE = 3;
/** SLA (วันทำการ) : Finance นับจากอนุมัติ ; บัญชีนับจาก Finance ผ่าน */
export const SLA = { finance: 3, accounting: 7 };

/** เอกสารที่ต้องแนบตามประเภทคำขอ (ผู้ใช้กำหนด 20-23 พ.ย. 69) */
export function requiredDocs(type: RefundType, cust: "company" | "person"): DocKind[] {
  if (type === "wht") return ["wht_cert", "company_cert", "bookbank", "slip", "receipt"];
  return cust === "company" ? ["company_cert", "bookbank", "slip", "receipt"] : ["id_card", "bookbank", "slip", "receipt"];
}

/* ---------- บทบาท ---------- */
export type RefundRole = "sales" | "approver" | "finance" | "accounting" | "admin" | "viewer";
const AREA_ROLES = ["area", "coach", "re", "area_head"];
export function refundRoleOf(ctx: AuthContext): RefundRole {
  if (ctx.role === "sales") return "sales";
  if (ctx.role === "finance") return "finance";
  if (ctx.role === "accounting") return "accounting";
  if (ctx.role === "admin") return "admin";
  if (ctx.role === "refund_approver" || AREA_ROLES.includes(ctx.role)) return "approver";
  return "viewer";
}

export interface RefundRow {
  id: number; req_no: string; is_test: boolean; status: string; round: number;
  refund_type: RefundType; job_group: JobGroup;
  requester_id: string; rep_code: string | null; dealer_code: string | null;
  approver_id: string | null; finance_id: string | null;
  docs_received_at: string | null; parcel_tracking: string | null;
  cust_name: string; refund_amount: number;
}
/** คำขอจากบัญชีทดสอบ เห็นเฉพาะบัญชีทดสอบ (และ admin) */
export function canViewRefund(ctx: AuthContext, r: RefundRow): boolean {
  const role = refundRoleOf(ctx);
  if (role !== "admin" && !!r.is_test !== ctx.isTest) return false;
  if (role === "admin" || role === "finance" || role === "accounting") return true;
  if (r.requester_id === ctx.userId || r.approver_id === ctx.userId) return true;
  // Area / Coach / หัวหน้า Area: ดูงานของร้านที่ดูแล (อ่านอย่างเดียว)
  return role === "approver" && AREA_ROLES.includes(ctx.role) && !!r.dealer_code && canAccessDealer(ctx, r.dealer_code);
}
/** เห็นเลขบัญชีเต็มได้ไหม (Area ที่ดูอย่างเดียวเห็นแบบปิดบางหลัก) */
export function canSeeBank(ctx: AuthContext, r: RefundRow): boolean {
  const role = refundRoleOf(ctx);
  return role === "admin" || role === "finance" || role === "accounting" || r.requester_id === ctx.userId || r.approver_id === ctx.userId;
}
export interface RefundCaps { approve: boolean; edit: boolean; parcel: boolean; cancel: boolean }
export function refundCaps(ctx: AuthContext, r: RefundRow): RefundCaps {
  const mine = r.requester_id === ctx.userId;
  const closed = ["closed", "rejected", "cancelled"].includes(r.status);
  return {
    approve: r.status === "pending_approval" && r.approver_id === ctx.userId,
    edit: mine && (r.status === "returned" || r.status === "finance_returned"),
    // ใส่ / เปลี่ยนเลขพัสดุได้จนกว่าบัญชีได้รับเอกสาร (ถ้า Finance แจ้งแก้ ส่งพัสดุใหม่ได้)
    parcel: mine && !closed && (!r.docs_received_at || r.status === "finance_returned"),
    cancel: mine && ["pending_approval", "returned", "finance_returned"].includes(r.status),
  };
}

/* ---------- ผู้อนุมัติ ---------- */
export interface Person { id: string; name: string; title: string }
/** Area ที่เลือกได้ (กรณีพนักงานไม่อยู่ใต้ร้าน / หา Area ของร้านไม่เจอ) */
export async function areaApprovers(sb: Sb, isTest: boolean): Promise<Person[]> {
  const { data } = await sb.from("profiles").select("id, full_name, rep_code").eq("role", "area").eq("status", "approved").eq("is_test", isTest).order("full_name");
  return (data ?? []).map((p) => ({ id: p.id as string, name: (p.full_name as string | null) ?? "Area", title: "Area Manager" }));
}
/** ผู้อนุมัติตามกลุ่มงาน: roof = Area ของร้าน (rep_store_assignments role manager) ; metal / smart = refund_approvers
 *  บัญชีทดสอบ: ใช้บัญชี Area ทดสอบทุกกลุ่ม (กันงานทดสอบไปถึงผู้อนุมัติจริง) */
export async function autoApprover(sb: Sb, ctx: AuthContext, group: JobGroup): Promise<Person | null> {
  if (ctx.isTest) return (await areaApprovers(sb, true))[0] ?? null;
  if (group !== "roof") {
    const { data } = await sb.from("refund_approvers").select("profile_id, title, profiles(full_name, status)").eq("job_group", group).maybeSingle();
    const p = data?.profiles as unknown as { full_name: string | null; status: string } | null;
    return data && p?.status === "approved" ? { id: data.profile_id as string, name: p.full_name ?? "-", title: (data.title as string | null) ?? GROUP_LABEL[group] } : null;
  }
  if (!ctx.dealerCode) return null;
  const { data: asg } = await sb.from("rep_store_assignments").select("rep_code").eq("dealer_code", ctx.dealerCode).eq("role_in_store", "manager");
  const reps = (asg ?? []).map((a) => a.rep_code as string);
  if (!reps.length) return null;
  const { data: prof } = await sb.from("profiles").select("id, full_name").eq("role", "area").eq("status", "approved").eq("is_test", false).in("rep_code", reps).limit(1);
  const p = prof?.[0];
  return p ? { id: p.id as string, name: (p.full_name as string | null) ?? "Area", title: "Area ของร้าน" } : null;
}

/* ---------- ตรวจข้อมูลคำขอ ---------- */
export interface RefundInput {
  refundType?: string; jobGroup?: string; projectNo?: string; soNo?: string; receiptNo?: string; projectName?: string;
  custType?: string; custName?: string; custTaxId?: string; custBranch?: string; custPhone?: string;
  paidAmount?: number; whtBase?: number | null; refundAmount?: number; cancelDetail?: string; reason?: string;
  bankName?: string; bankAccountNo?: string; bankAccountName?: string; customerSendsDirect?: boolean; approverId?: string;
}
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const money = (v: unknown) => { const n = Math.round(Number(v) * 100) / 100; return Number.isFinite(n) ? n : 0; };
/** คืน row (ไม่รวมผู้ขอ / ผู้อนุมัติ / สถานะ) หรือข้อความผิดพลาดภาษาไทย */
export function validateRefund(b: RefundInput): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const type = REFUND_TYPES.find((t) => t === b.refundType);
  const group = JOB_GROUPS.find((g) => g === b.jobGroup);
  if (!type) return { ok: false, error: "กรุณาเลือกประเภทการคืนเงิน" };
  if (!group) return { ok: false, error: "กรุณาเลือกกลุ่มงาน" };
  const custType = type === "wht" ? "company" : b.custType === "company" || b.custType === "person" ? b.custType : null;
  if (!custType) return { ok: false, error: "กรุณาเลือกประเภทลูกค้า" };
  const projectNo = txt(b.projectNo, 40).toUpperCase();
  if (!/^(E?RD|BA)[A-Z0-9-]{4,}$/.test(projectNo)) return { ok: false, error: "เลข Project ต้องขึ้นต้นด้วย RD หรือ BA" };
  const soNo = txt(b.soNo, 40).toUpperCase();
  if (group === "roof" && !soNo) return { ok: false, error: "กรุณาใส่เลข SO" };
  const custName = txt(b.custName, 200);
  if (!custName) return { ok: false, error: "กรุณาใส่ชื่อลูกค้า" };
  const taxId = String(b.custTaxId ?? "").replace(/\D/g, "");
  if (taxId.length !== 13) return { ok: false, error: custType === "company" ? "เลขผู้เสียภาษีต้องมี 13 หลัก" : "เลขบัตรประชาชนต้องมี 13 หลัก" };
  const paid = money(b.paidAmount);
  if (!(paid > 0) || paid > 1e10) return { ok: false, error: "กรุณาใส่ยอดที่ลูกค้าชำระ" };
  let whtBase: number | null = null;
  let refund = 0;
  if (type === "wht") {
    whtBase = b.whtBase != null && Number(b.whtBase) > 0 ? money(b.whtBase) : Math.round((paid / 1.07) * 100) / 100;
    refund = Math.round(whtBase * WHT_RATE) / 100;
  } else if (type === "full") refund = paid;
  else refund = money(b.refundAmount);
  if (!(refund > 0)) return { ok: false, error: "กรุณาใส่ยอดขอคืน" };
  if (refund > paid) return { ok: false, error: "ยอดขอคืนเกินยอดที่ลูกค้าชำระ" };
  const cancelDetail = txt(b.cancelDetail, 500);
  if (type === "partial" && !cancelDetail) return { ok: false, error: "กรุณาระบุส่วนที่ยกเลิก" };
  const reason = txt(b.reason, 1000) || (type === "wht" ? "ลูกค้าชำระเต็มจำนวน แล้วหักภาษี ณ ที่จ่ายภายหลัง" : "");
  if (!reason) return { ok: false, error: "กรุณาใส่สาเหตุการคืนเงิน" };
  const bankName = txt(b.bankName, 80), accNo = String(b.bankAccountNo ?? "").replace(/\D/g, "").slice(0, 20), accName = txt(b.bankAccountName, 200);
  if (!bankName || accNo.length < 6 || !accName) return { ok: false, error: "กรุณากรอกบัญชีรับเงินคืนให้ครบ" };
  return {
    ok: true,
    row: {
      refund_type: type, job_group: group, project_no: projectNo, so_no: group === "roof" ? soNo : null,
      receipt_no: txt(b.receiptNo, 60) || null, project_name: txt(b.projectName, 200) || null,
      cust_type: custType, cust_name: custName, cust_tax_id: taxId, cust_branch: custType === "company" ? txt(b.custBranch, 80) || null : null, cust_phone: txt(b.custPhone, 20) || null,
      paid_amount: paid, wht_base: whtBase, wht_rate: type === "wht" ? WHT_RATE : null, refund_amount: refund,
      cancel_detail: type === "partial" ? cancelDetail : null, reason,
      bank_name: bankName, bank_account_no: accNo, bank_account_name: accName, customer_sends_direct: type === "wht" && !!b.customerSendsDirect,
    },
  };
}

/* ---------- ประวัติ + แจ้งเตือน ---------- */
export async function addRefundEvent(sb: Sb, requestId: number, ctx: AuthContext | null, name: string, kind: string, text: string, tone?: "warn" | "ok" | "bad", data?: unknown) {
  await sb.from("refund_events").insert({ request_id: requestId, actor_id: ctx?.userId ?? null, actor_name: name, kind, text, tone: tone ?? null, data: data ?? null });
}
async function safePush(sb: Sb, ids: (string | null | undefined)[], title: string, body: string, url: string) {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  await Promise.all(list.map((u) => pushToUser(sb, u, { title, body, url, tag: url }).catch(() => 0)));
}
export async function roleIds(sb: Sb, role: string, isTest: boolean): Promise<string[]> {
  const { data } = await sb.from("profiles").select("id").eq("role", role).eq("status", "approved").eq("is_test", isTest);
  return (data ?? []).map((r) => r.id as string);
}
export type RefundEvent = "new" | "approved" | "returned" | "rejected" | "resubmitted" | "parcel" | "cancelled";
export async function notifyRefund(sb: Sb, r: RefundRow, event: RefundEvent, extra?: string) {
  const who = `${r.req_no} · ${r.cust_name} · ฿${Number(r.refund_amount).toLocaleString("th-TH")}`;
  const url = `/app/refund/${r.id}`;
  switch (event) {
    case "new":
    case "resubmitted":
      return safePush(sb, [r.approver_id], event === "new" ? "คำขอคืนเงินรออนุมัติ" : `คำขอคืนเงินแก้ไขแล้ว รออนุมัติใหม่ (รอบที่ ${r.round})`, who, url);
    case "approved":
      // กลับมาจาก Finance แจ้งแก้ -> แจ้ง Finance คนเดิม ; ครั้งแรก -> Finance ทุกคน
      return r.finance_id
        ? safePush(sb, [r.finance_id, r.requester_id], "คำขอคืนเงินอนุมัติใหม่แล้ว · ตรวจต่อได้", who, url)
        : safePush(sb, [...(await roleIds(sb, "finance", r.is_test)), r.requester_id], "คำขอคืนเงินอนุมัติแล้ว · รอ Finance รับงาน", who, url);
    case "returned":
      return safePush(sb, [r.requester_id], "ผู้อนุมัติตีกลับคำขอคืนเงิน", `${who} — ${extra ?? "กรุณาแก้ไข"}`, url);
    case "rejected":
      return safePush(sb, [r.requester_id], "คำขอคืนเงินไม่ได้รับอนุมัติ", `${who} — ${extra ?? ""}`, url);
    case "parcel":
      return safePush(sb, await roleIds(sb, "accounting", r.is_test), "มีเอกสารตัวจริงส่งมา (คำขอคืนเงิน)", `${who} — ${extra ?? ""}`, url);
    case "cancelled":
      return safePush(sb, [r.approver_id, r.finance_id], "คำขอคืนเงินถูกยกเลิก", who, url);
  }
}
