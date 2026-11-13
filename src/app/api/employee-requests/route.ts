import { NextRequest, NextResponse } from "next/server";
import { canAccessDealer, getAuthContext, type AuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { validatePayload } from "@/lib/commission/employee-request-shared";
import { findDupes, loadRepIndex } from "@/lib/server/employee-dupes";

/**
 * คำขอเพิ่มพนักงานใหม่
 * - GET  ?status=pending|approved|rejected|cancelled (ว่าง = ทั้งหมด)
 *     admin: ทุกคำขอ ; Area/Coach/หัวหน้า Area: คำขอของร้านในขอบเขต (ของคนอื่น = ดูอย่างเดียว)
 *   GET ?mode=dupes&name=&phone=&email= -> พนักงานที่อาจซ้ำ (ใช้ตอนกรอกแบบฟอร์ม)
 * - POST  { dealerCode, payload, photoUrl? }            -> ส่งคำขอ (Area/Coach/หัวหน้า Area)
 * - PATCH { id, action: 'update'|'cancel', dealerCode?, payload?, photoUrl? } -> แก้/ยกเลิกคำขอของตัวเองที่ยังรอ
 * การอนุมัติอยู่ที่ /api/admin/employee-requests
 */

const AREA_ROLES = new Set(["area", "coach", "re", "area_head"]);
const ROLE_LABEL: Record<string, string> = { area: "Area", coach: "Coach", re: "Coach", area_head: "หัวหน้า Area", admin: "Admin" };
const STATUSES = new Set(["pending", "approved", "rejected", "cancelled"]);

async function requesterName(sb: ReturnType<typeof createServiceClient>, ctx: AuthContext): Promise<string> {
  if (ctx.repCode) {
    const { data } = await sb.from("sale_reps").select("name, nickname").eq("rep_code", ctx.repCode).maybeSingle();
    if (data?.name) return data.nickname ? `${data.name} (${data.nickname})` : (data.name as string);
  }
  const { data } = await sb.from("profiles").select("full_name, nickname, email").eq("id", ctx.userId).maybeSingle();
  const n = (data?.full_name as string | null) ?? (data?.email as string | null) ?? "";
  return data?.nickname ? `${n} (${data.nickname})` : n;
}

/** ร้านต้องอยู่ในขอบเขตและยังเปิดใช้งาน */
async function checkStore(sb: ReturnType<typeof createServiceClient>, ctx: AuthContext, code: string) {
  if (!code || !canAccessDealer(ctx, code)) return "เลือกได้เฉพาะร้านที่ดูแล";
  const { data } = await sb.from("dealers").select("code, is_active").eq("code", code).maybeSingle();
  if (!data || data.is_active === false) return "ร้านนี้ปิดใช้งานแล้ว";
  return null;
}

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const isAdmin = ctx.role === "admin";
  if (!isAdmin && !AREA_ROLES.has(ctx.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const sb = createServiceClient();
  const sp = req.nextUrl.searchParams;

  if (sp.get("mode") === "dupes") {
    const name = (sp.get("name") ?? "").trim();
    if (!name && !sp.get("phone") && !sp.get("email")) return NextResponse.json({ ok: true, matches: [] });
    const idx = await loadRepIndex(sb);
    const matches = findDupes(idx, { name, phone: sp.get("phone"), email: sp.get("email") }).map((m) => ({
      ...m,
      // ร้านนอกขอบเขต: ไม่บอกชื่อร้าน
      dealerName: m.dealerCode && (isAdmin || canAccessDealer(ctx, m.dealerCode)) ? m.dealerName : m.dealerCode ? "ร้านอื่น" : null,
      dealerCode: m.dealerCode && (isAdmin || canAccessDealer(ctx, m.dealerCode)) ? m.dealerCode : null,
    }));
    return NextResponse.json({ ok: true, matches });
  }

  const status = sp.get("status");
  let q = sb
    .from("employee_requests")
    .select("id, status, dealer_code, payload, photo_url, requested_by, requester_name, requester_role, created_at, updated_at, reviewed_at, reject_reason, created_rep_code")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status && STATUSES.has(status)) q = q.eq("status", status);
  if (!isAdmin) {
    const scope = ctx.allowedDealerCodes === "all" ? null : ctx.allowedDealerCodes;
    if (scope) {
      if (!scope.length) return NextResponse.json({ ok: true, requests: [] });
      q = q.in("dealer_code", scope);
    }
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const codes = Array.from(new Set((data ?? []).map((r) => r.dealer_code as string)));
  const { data: dealers } = codes.length ? await sb.from("dealers").select("code, name").in("code", codes) : { data: [] as never[] };
  const dn = new Map((dealers ?? []).map((d) => [d.code as string, d.name as string]));
  const needDupes = (data ?? []).some((r) => r.status === "pending");
  const idx = needDupes ? await loadRepIndex(sb) : null;

  const requests = (data ?? []).map((r) => {
    const p = r.payload as { name: string; phone: string; email: string };
    return {
      id: r.id,
      status: r.status,
      dealerCode: r.dealer_code,
      dealerName: dn.get(r.dealer_code as string) ?? null,
      payload: r.payload,
      photoUrl: r.photo_url,
      requesterName: r.requester_name,
      requesterRole: r.requester_role,
      mine: r.requested_by === ctx.userId,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      reviewedAt: r.reviewed_at,
      rejectReason: r.reject_reason,
      createdRepCode: r.created_rep_code,
      duplicates: r.status === "pending" && idx ? findDupes(idx, p) : [],
    };
  });
  return NextResponse.json({ ok: true, requests });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!AREA_ROLES.has(ctx.role)) return NextResponse.json({ ok: false, error: "แจ้งได้เฉพาะ Area / Coach / หัวหน้า Area" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const sb = createServiceClient();
  const dealerCode = String(body.dealerCode ?? "").trim();
  const storeErr = await checkStore(sb, ctx, dealerCode);
  if (storeErr) return NextResponse.json({ ok: false, error: storeErr }, { status: 400 });
  const v = validatePayload(body.payload);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const { data, error } = await sb
    .from("employee_requests")
    .insert({
      dealer_code: dealerCode,
      payload: v.payload,
      photo_url: safePhoto(body.photoUrl),
      requested_by: ctx.userId,
      requester_name: await requesterName(sb, ctx),
      requester_role: ROLE_LABEL[ctx.role] ?? ctx.role,
      requester_rep: ctx.repCode,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const id = Number(body.id);
  const action = String(body.action ?? "");
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  const sb = createServiceClient();
  const { data: row } = await sb.from("employee_requests").select("id, status, requested_by, dealer_code").eq("id", id).maybeSingle();
  if (!row || row.requested_by !== ctx.userId) return NextResponse.json({ ok: false, error: "ไม่พบคำขอของคุณ" }, { status: 404 });
  if (row.status !== "pending") return NextResponse.json({ ok: false, error: "คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติแล้ว" }, { status: 409 });

  if (action === "cancel") {
    const { error } = await sb.from("employee_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === "update") {
    const dealerCode = String(body.dealerCode ?? row.dealer_code).trim();
    const storeErr = await checkStore(sb, ctx, dealerCode);
    if (storeErr) return NextResponse.json({ ok: false, error: storeErr }, { status: 400 });
    const v = validatePayload(body.payload);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    const patch: Record<string, unknown> = { dealer_code: dealerCode, payload: v.payload, updated_at: new Date().toISOString() };
    if ("photoUrl" in body) patch.photo_url = safePhoto(body.photoUrl);
    const { error } = await sb.from("employee_requests").update(patch).eq("id", id).eq("status", "pending");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });
}

/** รับเฉพาะรูปที่อัปโหลดผ่าน /api/employee-requests/photo (bucket ของเรา) */
function safePhoto(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return s.startsWith(`${base}/storage/v1/object/public/employee-photos/requests/`) ? s : null;
}
