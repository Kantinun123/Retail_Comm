import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { actorName, dueAfterBusinessDays, loadHolidays } from "@/lib/server/boq";
import {
  DOC_KINDS, FINANCE_CHECKS, REFUND_BUCKET, SLA, TYPE_LABEL, addRefundEvent, autoApprover, canSeeBank, canViewRefund, isCentralSales, notifyRefund, refundCaps, refundRoleOf, requiredDocs, typedRequesterName, validateRefund, validateRequester,
  type RefundInput, type RefundRow,
} from "@/lib/server/refund";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const mask = (s: string) => (s.length > 4 ? `xxx-x-x${s.slice(-4)}` : s);
type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const sb = createServiceClient();
  const { data } = await sb.from("refund_requests").select("*").eq("id", id).maybeSingle();
  return { sb, r: data as (RefundRow & Record<string, unknown>) | null };
}

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getAuthContext();
  if (!ctx) return bad("unauthenticated", 401);
  const id = Number((await params).id);
  const { sb, r } = await load(id);
  if (!r || !canViewRefund(ctx, r)) return bad("forbidden", 403);
  const [files, events] = await Promise.all([
    sb.from("refund_files").select("id, kind, round, name, size, mime, created_at").eq("request_id", id).order("created_at"),
    sb.from("refund_events").select("at, actor_name, kind, text, tone, data").eq("request_id", id).order("at"),
  ]);
  const ids = [r.requester_id, r.approver_id, r.finance_id].filter(Boolean) as string[];
  const { data: ppl } = await sb.from("profiles").select("id, full_name, phone").in("id", ids);
  const person = (pid: string | null) => {
    const p = (ppl ?? []).find((x) => x.id === pid);
    return p ? { id: pid, name: (p.full_name as string | null) ?? "-", phone: (p.phone as string | null) ?? null } : null;
  };
  const { data: rep } = r.rep_code ? await sb.from("sale_reps").select("name, nickname, phone, email").eq("rep_code", r.rep_code).maybeSingle() : { data: null };
  const { data: dealer } = r.dealer_code ? await sb.from("dealers").select("name").eq("code", r.dealer_code).maybeSingle() : { data: null };
  const showBank = canSeeBank(ctx, r);
  const role = refundRoleOf(ctx);
  return NextResponse.json({
    ok: true,
    role,
    me: ctx.userId,
    caps: refundCaps(ctx, r),
    item: {
      ...r,
      bank_account_no: showBank ? r.bank_account_no : mask(String(r.bank_account_no ?? "")),
      requester: typedRequesterName(r)
        ? { id: r.requester_id, name: typedRequesterName(r)!, phone: (r.requester_phone as string | null) ?? null, email: (r.requester_email as string | null) ?? null }
        : { ...(person(r.requester_id) ?? { id: r.requester_id, name: "-", phone: null }), name: rep?.name ? (rep.nickname ? `${rep.name} (${rep.nickname})` : rep.name) : person(r.requester_id)?.name ?? "-", phone: (rep?.phone as string | null) ?? person(r.requester_id)?.phone ?? null, email: (rep?.email as string | null) ?? null },
      dealer_name: (dealer?.name as string | undefined) ?? null,
      approver: person(r.approver_id),
      finance: person(r.finance_id),
      required_docs: requiredDocs(r.refund_type, r.cust_type as "company"),
      files: files.data ?? [],
      events: events.data ?? [],
    },
  });
}

type ActionBody = { action?: string; text?: string; carrier?: string; tracking?: string; items?: string[]; transferDate?: string; data?: RefundInput; files?: { kind?: string; path?: string; name?: string; size?: number; mime?: string }[] };

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getAuthContext();
  if (!ctx) return bad("unauthenticated", 401);
  const id = Number((await params).id);
  const { sb, r } = await load(id);
  if (!r || !canViewRefund(ctx, r)) return bad("forbidden", 403);
  const b = (await req.json().catch(() => null)) as ActionBody | null;
  if (!b?.action) return bad("ข้อมูลไม่ถูกต้อง");
  const caps = refundCaps(ctx, r);
  const text = typeof b.text === "string" ? b.text.trim().slice(0, 1000) : "";
  // บัญชีส่วนกลาง: ใช้ชื่อที่ผู้ขอกรอกไว้ในคำขอเป็นชื่อในประวัติ
  const name = r.requester_id === ctx.userId && typedRequesterName(r) ? typedRequesterName(r)! : await actorName(sb, ctx);
  const forbid = () => bad("ทำรายการนี้ไม่ได้ในสถานะปัจจุบัน", 403);
  // อัปเดตแบบมีเงื่อนไขสถานะเดิม (กันกดซ้ำ / สองคนกดพร้อมกัน)
  const update = async (patch: Record<string, unknown>, fromStatus: string[]) => {
    const { data, error } = await sb.from("refund_requests").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).in("status", fromStatus).select("id");
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  };
  const fresh = async () => ((await load(id)).r ?? r) as RefundRow;

  try {
    switch (b.action) {
      case "approve": {
        if (!caps.approve) return forbid();
        // กลับจาก Finance แจ้งแก้ -> Finance คนเดิมตรวจต่อ ; ครั้งแรก -> รอ Finance รับงาน
        const back = !!r.finance_id;
        const due = dueAfterBusinessDays(new Date(), SLA.finance, await loadHolidays(sb)).toISOString();
        if (!(await update({ status: back ? "finance_working" : "pending_finance", approved_at: new Date().toISOString(), due_at: due }, ["pending_approval"]))) return forbid();
        await addRefundEvent(sb, id, ctx, name, "approved", (r.round > 1 ? `อนุมัติใหม่ (รอบที่ ${r.round})` : "อนุมัติ") + (back ? " · ส่งกลับให้ Finance คนเดิมตรวจต่อ" : "") + (text ? ` · ${text}` : ""), "ok");
        await notifyRefund(sb, await fresh(), "approved");
        break;
      }
      case "return":
      case "reject": {
        if (!caps.approve) return forbid();
        if (!text) return bad(b.action === "return" ? "กรุณาใส่สิ่งที่ต้องแก้" : "กรุณาใส่เหตุผลที่ไม่อนุมัติ");
        const isReturn = b.action === "return";
        if (!(await update(isReturn ? { status: "returned" } : { status: "rejected", closed_at: new Date().toISOString() }, ["pending_approval"]))) return forbid();
        await addRefundEvent(sb, id, ctx, name, b.action, `${isReturn ? "ตีกลับให้แก้" : "ไม่อนุมัติ (ปิดคำขอ)"}: ${text}`, isReturn ? "warn" : "bad");
        await notifyRefund(sb, r, isReturn ? "returned" : "rejected", text);
        break;
      }
      case "resubmit": {
        if (!caps.edit) return forbid();
        const v = validateRefund(b.data ?? {});
        if (!v.ok) return bad(v.error);
        const rq = isCentralSales(ctx) ? validateRequester(b.data?.requester) : null;
        if (rq && !rq.ok) return bad(rq.error);
        const fromFinance = r.status === "finance_returned";
        const round = fromFinance ? r.round + 1 : r.round;
        // ผู้อนุมัติ: คนเดิม เว้นแต่เปลี่ยนกลุ่มงาน (metal/smart -> ตามตาราง ; roof -> Area ของร้าน หรือคนเดิม)
        let approverId = r.approver_id;
        if (v.row.job_group !== r.job_group) {
          const a = await autoApprover(sb, ctx, v.row.job_group as "roof");
          approverId = a?.id ?? (v.row.job_group === "roof" ? r.approver_id : null);
          if (!approverId) return bad("ยังไม่ได้ตั้งผู้อนุมัติของกลุ่มงานนี้");
        }
        // เอกสารใหม่: tmp/<userId>/ -> req/<id>/r<round>/<kind>/
        const files = (b.files ?? []).slice(0, 30).filter((f) => (DOC_KINDS as readonly string[]).includes(f.kind ?? "") && typeof f.path === "string" && f.path.startsWith(`tmp/${ctx.userId}/`) && !f.path.includes(".."));
        const { data: old } = await sb.from("refund_files").select("kind").eq("request_id", id);
        const have = new Set([...(old ?? []).map((x) => x.kind as string), ...files.map((f) => f.kind as string)]);
        const missing = requiredDocs(v.row.refund_type as "wht", v.row.cust_type as "company").filter((k) => !have.has(k));
        if (missing.length) return bad(`กรุณาแนบเอกสารให้ครบ (ขาด ${missing.length} รายการ)`);
        const rows = [];
        for (const f of files) {
          const dest = `req/${id}/r${round}/${f.kind}/${f.path!.split("/").pop()}`;
          const { error: mErr } = await sb.storage.from(REFUND_BUCKET).move(f.path!, dest);
          if (mErr) return bad(`ไฟล์ ${f.name ?? ""} อัปโหลดไม่สำเร็จ ลองแนบใหม่`, 500);
          rows.push({ request_id: id, kind: f.kind, round, path: dest, name: String(f.name ?? "file").slice(0, 200), size: Number(f.size) || null, mime: String(f.mime ?? "").slice(0, 100) || null, uploaded_by: ctx.userId });
        }
        if (rows.length) {
          const { error: fErr } = await sb.from("refund_files").insert(rows);
          if (fErr) return bad(fErr.message, 500);
        }
        if (!(await update({ ...v.row, ...(rq?.ok ? rq.row : {}), approver_id: approverId, round, status: "pending_approval", approved_at: null, due_at: null }, ["returned", "finance_returned"]))) return forbid();
        await addRefundEvent(sb, id, ctx, name, "resubmitted",
          `${fromFinance ? `แก้ไขตามที่ Finance แจ้งแล้ว ส่งให้ผู้อนุมัติอีกครั้ง (รอบที่ ${round})` : "แก้ไขแล้ว ส่งขออนุมัติอีกครั้ง"}${rows.length ? ` · แนบเอกสารใหม่ ${rows.length} ไฟล์` : ""}${text ? ` · ${text}` : ""}`);
        await notifyRefund(sb, await fresh(), "resubmitted");
        break;
      }
      case "parcel": {
        if (!caps.parcel) return forbid();
        const carrier = String(b.carrier ?? "").trim().slice(0, 60);
        const tracking = String(b.tracking ?? "").trim().toUpperCase().slice(0, 60);
        if (!carrier || tracking.length < 4) return bad("กรุณาใส่ขนส่งและเลขพัสดุ");
        const { error } = await sb.from("refund_requests").update({ parcel_carrier: carrier, parcel_tracking: tracking, parcel_sent_at: new Date().toISOString(), docs_received_at: null, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) return bad(error.message, 500);
        const by = r.customer_sends_direct ? "ลูกค้าส่งเอกสารตรงให้บัญชี" : r.parcel_tracking ? "ส่งเอกสารตัวจริงใหม่" : "ส่งเอกสารตัวจริง";
        await addRefundEvent(sb, id, ctx, name, "parcel", `${by} ${carrier} ${tracking}`);
        await notifyRefund(sb, r, "parcel", `${carrier} ${tracking}`);
        break;
      }
      /* ---------- Finance ---------- */
      case "claim": {
        if (!caps.claim) return forbid();
        // รับงานแบบ atomic: คนแรกที่กดได้งาน
        const { data, error } = await sb.from("refund_requests")
          .update({ status: "finance_working", finance_id: ctx.userId, finance_claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", id).eq("status", "pending_finance").is("finance_id", null).select("id");
        if (error) return bad(error.message, 500);
        if (!(data ?? []).length) return bad("มี Finance คนอื่นรับงานนี้แล้ว", 409);
        await addRefundEvent(sb, id, ctx, name, "claimed", "รับงาน (Finance)");
        await notifyRefund(sb, await fresh(), "claimed");
        break;
      }
      case "release": {
        if (!caps.financeAct) return forbid();
        if (!(await update({ status: "pending_finance", finance_id: null, finance_claimed_at: null }, ["finance_working"]))) return forbid();
        await addRefundEvent(sb, id, ctx, name, "released", `คืนงาน (ให้ Finance คนอื่นรับ)${text ? ` · ${text}` : ""}`);
        await notifyRefund(sb, r, "released");
        break;
      }
      case "finance_pass": {
        if (!caps.financeAct) return forbid();
        const due = dueAfterBusinessDays(new Date(), SLA.accounting, await loadHolidays(sb)).toISOString();
        if (!(await update({ status: "pending_transfer", finance_done_at: new Date().toISOString(), finance_note: text || null, due_at: due }, ["finance_working"]))) return forbid();
        await addRefundEvent(sb, id, ctx, name, "finance_pass", `ตรวจแล้ว เอกสารครบ · ดำเนินการในระบบแล้ว${text ? ` · ${text}` : ""}`, "ok");
        await notifyRefund(sb, await fresh(), "finance_pass");
        break;
      }
      case "finance_return": {
        if (!caps.financeAct) return forbid();
        if (!text) return bad("กรุณาอธิบายสิ่งที่ต้องแก้");
        const allowed = new Set<string>([...DOC_KINDS, ...Object.keys(FINANCE_CHECKS)]);
        const items = [...new Set((b.items ?? []).filter((k) => allowed.has(k)))].slice(0, 20);
        // ระหว่างรอทีมขายแก้ ไม่นับ SLA ของ Finance (due_at = null) ; finance_id คงไว้ งานกลับมาที่คนเดิม
        if (!(await update({ status: "finance_returned", finance_issue: { items, text, at: new Date().toISOString() }, due_at: null }, ["finance_working"]))) return forbid();
        await addRefundEvent(sb, id, ctx, name, "finance_return", `แจ้งกลับให้แก้ไข: ${text}`, "warn", { items });
        await notifyRefund(sb, r, "finance_return", text);
        break;
      }
      /* ---------- บัญชี ---------- */
      case "docs_received": {
        if (!caps.receiveDocs) return forbid();
        const { error } = await sb.from("refund_requests").update({ docs_received_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).is("docs_received_at", null);
        if (error) return bad(error.message, 500);
        await addRefundEvent(sb, id, ctx, name, "docs_received", `ได้รับเอกสารตัวจริงแล้ว${text ? ` · ${text}` : ""}`, "ok");
        await notifyRefund(sb, r, "docs_received");
        break;
      }
      case "transfer": {
        if (!caps.transfer) return forbid();
        const day = String(b.transferDate ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return bad("กรุณาใส่วันที่โอนเงิน");
        // ใบเสร็จ / ใบกำกับภาษีฉบับแก้ไข (เฉพาะคืนภาษีหัก ณ ที่จ่าย, ไม่บังคับ)
        const files = r.refund_type === "wht" ? (b.files ?? []).slice(0, 5).filter((f) => f.kind === "revised_receipt" && typeof f.path === "string" && f.path.startsWith(`tmp/${ctx.userId}/`) && !f.path.includes("..")) : [];
        const rows = [];
        for (const f of files) {
          const dest = `req/${id}/r${r.round}/revised_receipt/${f.path!.split("/").pop()}`;
          const { error: mErr } = await sb.storage.from(REFUND_BUCKET).move(f.path!, dest);
          if (mErr) return bad(`ไฟล์ ${f.name ?? ""} อัปโหลดไม่สำเร็จ ลองแนบใหม่`, 500);
          rows.push({ request_id: id, kind: "revised_receipt", round: r.round, path: dest, name: String(f.name ?? "file").slice(0, 200), size: Number(f.size) || null, mime: String(f.mime ?? "").slice(0, 100) || null, uploaded_by: ctx.userId });
        }
        if (rows.length) {
          const { error: fErr } = await sb.from("refund_files").insert(rows);
          if (fErr) return bad(fErr.message, 500);
        }
        if (!(await update({ status: "transferred", transfer_date: day, due_at: null }, ["pending_transfer"]))) return forbid();
        const th = new Date(`${day}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
        await addRefundEvent(sb, id, ctx, name, "transferred", `โอนเงินคืนแล้ว วันที่ ${th}${rows.length ? " · แนบใบเสร็จ / ใบกำกับภาษีฉบับแก้ไข" : ""}${text ? ` · ${text}` : ""}`, "ok");
        await notifyRefund(sb, r, "transferred", th);
        break;
      }
      case "inform": {
        if (!caps.inform) return forbid();
        const now = new Date().toISOString();
        if (!(await update({ status: "closed", customer_informed_at: now, closed_at: now }, ["transferred"]))) return forbid();
        await addRefundEvent(sb, id, ctx, name, "closed", `แจ้งวันโอนให้ลูกค้าแล้ว · ปิดงาน${text ? ` · ${text}` : ""}`, "ok");
        break;
      }
      case "cancel": {
        if (!caps.cancel) return forbid();
        if (!(await update({ status: "cancelled", closed_at: new Date().toISOString() }, ["pending_approval", "returned", "finance_returned"]))) return forbid();
        await addRefundEvent(sb, id, ctx, name, "cancelled", `ยกเลิกคำขอ${text ? `: ${text}` : ""}`, "bad");
        await notifyRefund(sb, r, "cancelled");
        break;
      }
      default:
        return bad("action ไม่ถูกต้อง");
    }
  } catch (e) {
    return bad(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ", 500);
  }
  return NextResponse.json({ ok: true, label: TYPE_LABEL[r.refund_type] });
}
