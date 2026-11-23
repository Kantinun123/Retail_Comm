import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { actorName } from "@/lib/server/boq";
import {
  DOC_KINDS, REFUND_BUCKET, TYPE_LABEL, addRefundEvent, areaApprovers, autoApprover, canViewRefund, notifyRefund, refundRoleOf, requiredDocs, validateRefund,
  type RefundInput, type RefundRow,
} from "@/lib/server/refund";

const LIST_COLS = "id, req_no, is_test, status, round, refund_type, job_group, requester_id, rep_code, dealer_code, approver_id, finance_id, docs_received_at, parcel_tracking, cust_name, refund_amount, project_no, so_no, created_at, updated_at, due_at, approved_at, transfer_date";
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
/** เปิดให้ทุกคน: REFUND_ENABLED=1 ใน Vercel ; ก่อนเปิด = บัญชีทดสอบ + admin */
const isEnabled = (isTest: boolean, role: string) => process.env.REFUND_ENABLED === "1" || isTest || role === "admin";

/** รายการคำขอตามบทบาท */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return bad("unauthenticated", 401);
  const role = refundRoleOf(ctx);
  const sb = createServiceClient();
  let q = sb.from("refund_requests").select(LIST_COLS).order("created_at", { ascending: false }).limit(500);
  if (role !== "admin") q = q.eq("is_test", ctx.isTest);
  if (role === "sales") q = q.eq("requester_id", ctx.userId);
  else if (role === "approver") {
    const dealers = ctx.allowedDealerCodes === "all" ? null : ctx.allowedDealerCodes;
    q = dealers && dealers.length ? q.or(`approver_id.eq.${ctx.userId},dealer_code.in.(${dealers.map((d) => `"${d}"`).join(",")})`) : q.eq("approver_id", ctx.userId);
  } else if (role === "viewer") return NextResponse.json({ ok: true, role, me: ctx.userId, enabled: false, items: [] });
  const { data, error } = await q;
  if (error) return bad(error.message, 500);
  const rows = ((data ?? []) as unknown as (RefundRow & Record<string, unknown>)[]).filter((r) => canViewRefund(ctx, r));
  // ชื่อผู้ขอ / ผู้อนุมัติ / Finance / ร้าน
  const ids = [...new Set(rows.flatMap((r) => [r.requester_id, r.approver_id, r.finance_id]).filter(Boolean))] as string[];
  const { data: ppl } = ids.length ? await sb.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nameOf = new Map((ppl ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? "-"]));
  const reps = [...new Set(rows.map((r) => r.rep_code).filter(Boolean))] as string[];
  const { data: rr } = reps.length ? await sb.from("sale_reps").select("rep_code, name, nickname").in("rep_code", reps) : { data: [] };
  const repName = new Map((rr ?? []).map((r) => [r.rep_code as string, r.nickname ? `${r.name} (${r.nickname})` : (r.name as string)]));
  const dls = [...new Set(rows.map((r) => r.dealer_code).filter(Boolean))] as string[];
  const { data: dd } = dls.length ? await sb.from("dealers").select("code, name").in("code", dls) : { data: [] };
  const dealerName = new Map((dd ?? []).map((d) => [d.code as string, d.name as string]));
  return NextResponse.json({
    ok: true,
    role,
    me: ctx.userId,
    enabled: isEnabled(ctx.isTest, ctx.role),
    items: rows.map((r) => ({
      id: r.id, reqNo: r.req_no, isTest: !!r.is_test, status: r.status, round: r.round, type: r.refund_type, group: r.job_group,
      custName: r.cust_name, amount: Number(r.refund_amount), projectNo: r.project_no, soNo: r.so_no,
      requesterId: r.requester_id, requesterName: (r.rep_code && repName.get(r.rep_code as string)) || nameOf.get(r.requester_id) || "-",
      dealerName: r.dealer_code ? dealerName.get(r.dealer_code as string) ?? r.dealer_code : null,
      approverId: r.approver_id, approverName: r.approver_id ? nameOf.get(r.approver_id) ?? "-" : null,
      financeId: r.finance_id, financeName: r.finance_id ? nameOf.get(r.finance_id) ?? "-" : null,
      hasParcel: !!r.parcel_tracking, docsReceived: !!r.docs_received_at,
      createdAt: r.created_at, updatedAt: r.updated_at, dueAt: r.due_at, transferDate: r.transfer_date,
    })),
  });
}

type CreateBody = RefundInput & { files?: { kind?: string; path?: string; name?: string; size?: number; mime?: string }[] };

/** สร้างคำขอ (พนักงานขาย) */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return bad("unauthenticated", 401);
  if (refundRoleOf(ctx) !== "sales" || !ctx.repCode) return bad("เฉพาะพนักงานขายสร้างคำขอได้", 403);
  if (!isEnabled(ctx.isTest, ctx.role)) return bad("ระบบขอคืนเงินยังไม่เปิดใช้งาน", 403);
  const b = (await req.json().catch(() => null)) as CreateBody | null;
  if (!b) return bad("ข้อมูลไม่ถูกต้อง");
  const v = validateRefund(b);
  if (!v.ok) return bad(v.error);
  const row = v.row;
  const sb = createServiceClient();
  // ผู้อนุมัติ: ตามกลุ่มงาน ; roof หา Area ของร้านไม่เจอ -> ใช้คนที่เลือก (ต้องอยู่ในรายชื่อ Area)
  let approver = await autoApprover(sb, ctx, row.job_group as RefundRow["job_group"]);
  if (!approver && row.job_group === "roof" && b.approverId) approver = (await areaApprovers(sb, ctx.isTest)).find((a) => a.id === b.approverId) ?? null;
  if (!approver) return bad(row.job_group === "roof" ? "กรุณาเลือกผู้อนุมัติ (Area)" : "ยังไม่ได้ตั้งผู้อนุมัติของกลุ่มงานนี้ ติดต่อผู้ดูแลระบบ");
  // เอกสาร: ไฟล์ที่ผู้ใช้คนนี้อัปโหลดไว้ใน tmp/<userId>/ + ครบตามประเภทคำขอ
  const files = (b.files ?? []).slice(0, 30).filter((f) => (DOC_KINDS as readonly string[]).includes(f.kind ?? "") && typeof f.path === "string" && f.path.startsWith(`tmp/${ctx.userId}/`) && !f.path.includes(".."));
  const need = requiredDocs(row.refund_type as "wht", row.cust_type as "company");
  const missing = need.filter((k) => !files.some((f) => f.kind === k));
  if (missing.length) return bad(`กรุณาแนบเอกสารให้ครบ (ขาด ${missing.length} รายการ)`);

  const { data: no, error: noErr } = await sb.rpc("refund_next_no");
  if (noErr || !no) return bad(noErr?.message ?? "ออกเลขที่คำขอไม่สำเร็จ", 500);
  const { data: rep } = await sb.from("sale_reps").select("name, nickname").eq("rep_code", ctx.repCode).maybeSingle();
  const { data: dealer } = ctx.dealerCode ? await sb.from("dealers").select("name").eq("code", ctx.dealerCode).maybeSingle() : { data: null };
  const { data: created, error: cErr } = await sb
    .from("refund_requests")
    .insert({
      ...row,
      req_no: no as string,
      is_test: ctx.isTest,
      status: "pending_approval",
      requester_id: ctx.userId,
      rep_code: ctx.repCode,
      dealer_code: ctx.dealerCode,
      requester_unit: (dealer?.name as string | undefined) ?? null,
      approver_id: approver.id,
    })
    .select("id, req_no, is_test, status, round, refund_type, job_group, requester_id, rep_code, dealer_code, approver_id, finance_id, docs_received_at, parcel_tracking, cust_name, refund_amount")
    .single();
  if (cErr || !created) return bad(cErr?.message ?? "บันทึกไม่สำเร็จ", 500);
  const id = created.id as number;
  const rollback = async (msg: string) => {
    await sb.from("refund_requests").delete().eq("id", id);
    return bad(msg, 500);
  };
  const rows = [];
  for (const f of files) {
    const dest = `req/${id}/r1/${f.kind}/${f.path!.split("/").pop()}`;
    const { error: mErr } = await sb.storage.from(REFUND_BUCKET).move(f.path!, dest);
    if (mErr) return rollback(`ไฟล์ ${f.name ?? ""} อัปโหลดไม่สำเร็จ ลองแนบใหม่`);
    rows.push({ request_id: id, kind: f.kind, round: 1, path: dest, name: String(f.name ?? "file").slice(0, 200), size: Number(f.size) || null, mime: String(f.mime ?? "").slice(0, 100) || null, uploaded_by: ctx.userId });
  }
  const { error: fErr } = await sb.from("refund_files").insert(rows);
  if (fErr) return rollback(fErr.message);
  const name = rep?.name ? (rep.nickname ? `${rep.name} (${rep.nickname})` : (rep.name as string)) : await actorName(sb, ctx);
  await addRefundEvent(sb, id, ctx, name, "created", `ส่งคำขอ${TYPE_LABEL[row.refund_type as "wht"]} ฿${Number(row.refund_amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} · ผู้อนุมัติ ${approver.name}`);
  await notifyRefund(sb, created as unknown as RefundRow, "new");
  return NextResponse.json({ ok: true, id, reqNo: no });
}
