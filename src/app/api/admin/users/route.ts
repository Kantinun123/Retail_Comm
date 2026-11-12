import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { generateTempPassword } from "@/lib/supabase/temp-password";
import { emailToUsername, isValidStoreUsername, usernameToEmail } from "@/lib/commission/username";

/**
 * จัดการบัญชีผู้ใช้ (admin เท่านั้น — ต้องมี session จริงที่ role=admin เสมอ)
 * - GET  /api/admin/users?status=pending|approved|rejected  (ทุก role ยกเว้น admin)
 * - POST /api/admin/users { userId, action, dealerCode?, reason?, username? }
 *   create : สร้างบัญชีร้าน (username แบบเข้ม <รหัสร้าน><a-z 4 ตัว> หรืออีเมลจริง)
 *   approve: ตั้ง role=dealer + dealer_code (1 บัญชีต่อร้าน) ; reject/revoke: status=rejected + เหตุผล
 *   reset  : ออกรหัสชั่วคราวใหม่ — ร้านค้า และ Area / Coach
 */

/** role ที่เป็น Area Manager / Coach — admin รีเซ็ตรหัส / ระงับได้ แต่ไม่ผ่าน flow อนุมัติร้าน */
const AREA_ROLES = new Set(["area", "coach", "re", "area_head"]);

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
      "id, email, full_name, phone, status, role, rep_code, dealer_code, requested_role, requested_dealer_code, reject_reason, created_at, approved_at"
    )
    .eq("status", status)
    // role = null (pending/rejected) ต้องรวมด้วย — neq อย่างเดียวจะตัดแถว null ทิ้ง
    .or("role.is.null,role.neq.admin")
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
    username: emailToUsername(p.email),
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
    username?: string;
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

    // ชื่อผู้ใช้แบบเข้ม: <รหัสร้าน><a-z 4 ตัว> -> <username>@retail-comm.local ; หรือใส่อีเมลจริงก็ได้
    const rawUser = String(body.username ?? body.email ?? "").trim().toLowerCase();
    if (!rawUser) return NextResponse.json({ ok: false, error: "ต้องระบุชื่อผู้ใช้" }, { status: 400 });
    if (!rawUser.includes("@") && !isValidStoreUsername(rawUser, dealerCode)) {
      return NextResponse.json(
        { ok: false, error: `ชื่อผู้ใช้ต้องเป็น ${dealerCode} + ตัวอักษรอังกฤษพิมพ์เล็ก 4 ตัว (เช่น ${dealerCode}abcd)` },
        { status: 400 }
      );
    }
    const email = usernameToEmail(rawUser);
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
    return NextResponse.json({ ok: true, credentials: { email: emailToUsername(email), tempPassword } });
  }

  if (!userId) return NextResponse.json({ ok: false, error: "missing userId" }, { status: 400 });
  const { data: target } = await sb
    .from("profiles")
    .select("id, role, status, requested_dealer_code")
    .eq("id", userId)
    .single();
  if (!target) return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้" }, { status: 404 });
  // บัญชี admin / sales แก้ผ่านหน้านี้ไม่ได้ ; Area/Coach ทำได้แค่รีเซ็ตรหัส / ระงับ
  const isArea = AREA_ROLES.has(target.role ?? "");
  if (target.role && target.role !== "dealer" && !isArea) {
    return NextResponse.json({ ok: false, error: "แก้ไขบัญชีประเภทนี้ผ่านหน้านี้ไม่ได้" }, { status: 400 });
  }
  if (isArea && action !== "reset" && action !== "revoke") {
    return NextResponse.json({ ok: false, error: "บัญชี Area / Coach รีเซ็ตรหัสหรือระงับได้เท่านั้น" }, { status: 400 });
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
    if ((target.role !== "dealer" && !isArea) || target.status !== "approved") {
      return NextResponse.json({ ok: false, error: "รีเซ็ตได้เฉพาะบัญชีร้านค้า / Area / Coach ที่อนุมัติแล้ว" }, { status: 400 });
    }
    const tempPassword = generateTempPassword();
    const { error: uErr } = await sb.auth.admin.updateUserById(userId, { password: tempPassword });
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
    await sb.from("profiles").update({ must_change_password: true }).eq("id", userId);
    const { data: prof } = await sb.from("profiles").select("email").eq("id", userId).single();
    return NextResponse.json({ ok: true, credentials: { email: emailToUsername(prof?.email), tempPassword } });
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
