import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { generateTempPassword } from "@/lib/supabase/temp-password";

/**
 * จัดการคำขอสมัครผู้ใช้ (admin เท่านั้น — ต้องมี session จริงที่ role=admin เสมอ)
 * - GET  /api/admin/users?status=pending|approved|rejected
 * - POST /api/admin/users { userId, action: 'approve'|'reject'|'revoke', dealerCode?, reason? }
 *   approve: ตั้ง role=dealer + dealer_code (1 บัญชีต่อร้าน) ; reject/revoke: status=rejected + เหตุผล
 */

async function requireAdmin() {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false as const, status: 401, error: "unauthenticated" };
  if (ctx.role !== "admin") return { ok: false as const, status: 403, error: "forbidden" };
  return { ok: true as const, ctx };
}

const STATUSES = new Set(["pending", "approved", "rejected"]);

export async function GET(req: NextRequest) {
  const adm = await requireAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: adm.status });

  const status = req.nextUrl.searchParams.get("status") || "pending";
  if (!STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("profiles")
    .select(
      "id, email, full_name, phone, status, role, dealer_code, requested_role, requested_dealer_code, reject_reason, created_at, approved_at"
    )
    .eq("status", status)
    .neq("role", "admin")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // ชื่อร้าน + ผู้ใช้ร้านเดิม (กรณีร้านนั้นมีบัญชีอยู่แล้ว)
  const codes = Array.from(
    new Set((data ?? []).flatMap((p) => [p.requested_dealer_code, p.dealer_code]).filter(Boolean))
  ) as string[];
  const names = new Map<string, string>();
  const existing = new Map<string, string>();
  if (codes.length) {
    const [{ data: ds }, { data: ex }] = await Promise.all([
      sb.from("dealers").select("code, name").in("code", codes),
      sb
        .from("profiles")
        .select("dealer_code, email")
        .in("dealer_code", codes)
        .eq("role", "dealer")
        .eq("status", "approved"),
    ]);
    (ds ?? []).forEach((d) => names.set(d.code as string, d.name as string));
    (ex ?? []).forEach((p) => existing.set(p.dealer_code as string, p.email as string));
  }

  const users = (data ?? []).map((p) => ({
    ...p,
    requested_dealer_name: p.requested_dealer_code ? names.get(p.requested_dealer_code) ?? null : null,
    dealer_name: p.dealer_code ? names.get(p.dealer_code) ?? null : null,
    existing_dealer_user: p.requested_dealer_code ? existing.get(p.requested_dealer_code) ?? null : null,
  }));
  return NextResponse.json({ ok: true, users });
}

export async function POST(req: NextRequest) {
  const adm = await requireAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: adm.status });

  let body: {
    userId?: string;
    action?: string;
    dealerCode?: string;
    reason?: string;
    email?: string;
    fullName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const userId = String(body.userId ?? "").trim();
  const action = String(body.action ?? "");

  const sb = createServiceClient();

  // สร้างบัญชีให้ร้าน (แจกบัญชี): สร้าง auth user + อนุมัติทันที + บังคับเปลี่ยนรหัสครั้งแรก
  if (action === "create") {
    const dealerCode = String(body.dealerCode ?? "").trim();
    if (!dealerCode) return NextResponse.json({ ok: false, error: "ต้องระบุร้าน" }, { status: 400 });
    const { data: dealer } = await sb.from("dealers").select("code").eq("code", dealerCode).maybeSingle();
    if (!dealer) return NextResponse.json({ ok: false, error: "ไม่พบร้านนี้" }, { status: 400 });

    const { data: taken } = await sb
      .from("profiles")
      .select("email")
      .eq("dealer_code", dealerCode)
      .eq("role", "dealer")
      .eq("status", "approved")
      .maybeSingle();
    if (taken) {
      return NextResponse.json(
        { ok: false, error: `ร้านนี้มีบัญชีอยู่แล้ว (${taken.email})` },
        { status: 409 }
      );
    }

    // ไม่มีอีเมลจริง -> ใช้อีเมลสมมติตามรหัสร้าน (รีเซ็ตรหัสทางอีเมลไม่ได้ ต้องให้ admin รีเซ็ต)
    const email = (String(body.email ?? "").trim() || `${dealerCode}@retail-comm.local`).toLowerCase();
    const tempPassword = generateTempPassword();
    const { data: created, error: cErr } = await sb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: String(body.fullName ?? "").trim() || null },
    });
    if (cErr || !created.user) {
      return NextResponse.json({ ok: false, error: cErr?.message ?? "สร้างบัญชีไม่สำเร็จ" }, { status: 400 });
    }
    const { error: pErr } = await sb
      .from("profiles")
      .update({
        role: "dealer",
        dealer_code: dealerCode,
        status: "approved",
        must_change_password: true,
        approved_by: adm.ctx.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", created.user.id);
    if (pErr) {
      // ย้อนกลับ ไม่ให้เหลือบัญชีค้างที่ไม่มีสิทธิ์
      await sb.auth.admin.deleteUser(created.user.id);
      return NextResponse.json(
        { ok: false, error: pErr.code === "23505" ? "ร้านนี้มีบัญชีอยู่แล้ว" : pErr.message },
        { status: pErr.code === "23505" ? 409 : 500 }
      );
    }
    return NextResponse.json({ ok: true, credentials: { email, tempPassword } });
  }

  if (!userId) return NextResponse.json({ ok: false, error: "missing userId" }, { status: 400 });
  const { data: target } = await sb
    .from("profiles")
    .select("id, role, status, requested_dealer_code")
    .eq("id", userId)
    .single();
  if (!target) return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้" }, { status: 404 });
  // กัน admin เผลอแก้บัญชี admin/Area/Coach ผ่านหน้านี้
  if (target.role && target.role !== "dealer") {
    return NextResponse.json({ ok: false, error: "แก้ไขบัญชีประเภทนี้ผ่านหน้านี้ไม่ได้" }, { status: 400 });
  }

  if (action === "approve") {
    const dealerCode = String(body.dealerCode ?? target.requested_dealer_code ?? "").trim();
    if (!dealerCode) return NextResponse.json({ ok: false, error: "ต้องระบุร้าน" }, { status: 400 });

    const { data: dealer } = await sb.from("dealers").select("code").eq("code", dealerCode).maybeSingle();
    if (!dealer) return NextResponse.json({ ok: false, error: "ไม่พบร้านนี้" }, { status: 400 });

    const { data: taken } = await sb
      .from("profiles")
      .select("email")
      .eq("dealer_code", dealerCode)
      .eq("role", "dealer")
      .eq("status", "approved")
      .neq("id", userId)
      .maybeSingle();
    if (taken) {
      return NextResponse.json(
        { ok: false, error: `ร้านนี้มีบัญชีอยู่แล้ว (${taken.email}) — ระงับบัญชีเดิมก่อน` },
        { status: 409 }
      );
    }

    const { error } = await sb
      .from("profiles")
      .update({
        role: "dealer",
        dealer_code: dealerCode,
        status: "approved",
        reject_reason: null,
        approved_by: adm.ctx.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) {
      const dup = error.code === "23505";
      return NextResponse.json(
        { ok: false, error: dup ? "ร้านนี้มีบัญชีอยู่แล้ว" : error.message },
        { status: dup ? 409 : 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    if (target.role !== "dealer" || target.status !== "approved") {
      return NextResponse.json({ ok: false, error: "รีเซ็ตได้เฉพาะบัญชีร้านค้าที่อนุมัติแล้ว" }, { status: 400 });
    }
    const tempPassword = generateTempPassword();
    const { error: uErr } = await sb.auth.admin.updateUserById(userId, { password: tempPassword });
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
    await sb.from("profiles").update({ must_change_password: true }).eq("id", userId);
    const { data: prof } = await sb.from("profiles").select("email").eq("id", userId).single();
    return NextResponse.json({ ok: true, credentials: { email: prof?.email ?? "", tempPassword } });
  }

  if (action === "reject" || action === "revoke") {
    const reason = String(body.reason ?? "").trim() || (action === "revoke" ? "ระงับการใช้งาน" : "ไม่ผ่านการอนุมัติ");
    const { error } = await sb
      .from("profiles")
      .update({
        status: "rejected",
        role: null,
        dealer_code: null,
        reject_reason: reason,
        approved_by: adm.ctx.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });
}
