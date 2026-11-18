import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { generateTempPassword } from "@/lib/supabase/temp-password";
import { emailToUsername } from "@/lib/commission/username";

/**
 * คำขอรีเซ็ตรหัสผ่าน — ร้านค้า (kind=dealer) + Area / Coach / หัวหน้า Area (kind=staff) (admin เท่านั้น ต้องมี session จริง)
 * - GET  -> รายการคำขอที่ค้างอยู่
 * - POST { requestId, action: 'reset' | 'dismiss' }
 *     reset  : ออกรหัสชั่วคราวใหม่ให้บัญชีร้านนั้น (must_change_password) แล้วปิดคำขอ
 *     dismiss: ปิดคำขอโดยไม่รีเซ็ต
 */

async function requireAdmin() {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false as const, status: 401, error: "unauthenticated" };
  if (ctx.role !== "admin") return { ok: false as const, status: 403, error: "forbidden" };
  return { ok: true as const, ctx };
}

export async function GET() {
  const adm = await requireAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: adm.status });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("password_reset_requests")
    .select("id, kind, dealer_code, profile_id, requested_login, contact_name, phone, note, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const codes = Array.from(new Set((data ?? []).map((r) => r.dealer_code as string)));
  const names = new Map<string, string>();
  const accounts = new Map<string, string>();
  if (codes.length) {
    const [{ data: ds }, { data: ps }] = await Promise.all([
      sb.from("dealers").select("code, name").in("code", codes),
      sb
        .from("profiles")
        .select("dealer_code, email")
        .in("dealer_code", codes)
        .eq("role", "dealer")
        .eq("is_test", false)
        .eq("status", "approved"),
    ]);
    (ds ?? []).forEach((d) => names.set(d.code as string, d.name as string));
    (ps ?? []).forEach((p) => accounts.set(p.dealer_code as string, p.email as string));
  }

  // คำขอของ Area / Coach: ชื่อ + บทบาทจากโปรไฟล์
  const pids = (data ?? []).filter((r) => r.kind === "staff" && r.profile_id).map((r) => r.profile_id as string);
  const staff = new Map<string, { email: string; full_name: string | null; role: string | null; status: string }>();
  if (pids.length) {
    const { data: ps } = await sb.from("profiles").select("id, email, full_name, role, status").in("id", pids);
    (ps ?? []).forEach((p) => staff.set(p.id as string, p as { email: string; full_name: string | null; role: string | null; status: string }));
  }

  const requests = (data ?? []).map((r) => {
    if (r.kind === "staff") {
      const p = staff.get(r.profile_id as string);
      const active = !!p && p.status === "approved";
      return {
        ...r,
        dealer_name: null,
        account_name: p?.full_name ?? null,
        account_role: p?.role ?? null,
        account_email: active ? emailToUsername(p!.email) : null,
      };
    }
    return {
      ...r,
      dealer_name: names.get(r.dealer_code as string) ?? null,
      account_name: null,
      account_role: "dealer",
      account_email: accounts.has(r.dealer_code as string) ? emailToUsername(accounts.get(r.dealer_code as string)) : null,
    };
  });
  return NextResponse.json({ ok: true, requests });
}

export async function POST(req: NextRequest) {
  const adm = await requireAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: adm.status });

  let body: { requestId?: number; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const requestId = Number(body.requestId);
  const action = String(body.action ?? "");
  if (!Number.isFinite(requestId)) return NextResponse.json({ ok: false, error: "missing requestId" }, { status: 400 });

  const sb = createServiceClient();
  const { data: reqRow } = await sb
    .from("password_reset_requests")
    .select("id, kind, dealer_code, profile_id, status")
    .eq("id", requestId)
    .single();
  if (!reqRow || reqRow.status !== "pending") {
    return NextResponse.json({ ok: false, error: "ไม่พบคำขอที่ค้างอยู่" }, { status: 404 });
  }

  const close = (status: "done" | "dismissed") =>
    sb
      .from("password_reset_requests")
      .update({ status, handled_by: adm.ctx.userId, handled_at: new Date().toISOString() })
      .eq("id", requestId);

  if (action === "dismiss") {
    await close("dismissed");
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    // ร้านค้า: บัญชีของร้าน ; Area/Coach: บัญชีตาม profile_id (ต้องยังเป็นกลุ่ม Area และใช้งานอยู่ — ไม่รีเซ็ต admin ผ่านทางนี้)
    const { data: prof } =
      reqRow.kind === "staff"
        ? await sb.from("profiles").select("id, email").eq("id", reqRow.profile_id).in("role", ["area", "coach", "re", "area_head", "sales"]).eq("status", "approved").maybeSingle()
        : await sb.from("profiles").select("id, email").eq("dealer_code", reqRow.dealer_code).eq("role", "dealer")
        .eq("is_test", false).eq("status", "approved").maybeSingle();
    if (!prof) {
      return NextResponse.json({ ok: false, error: reqRow.kind === "staff" ? "ไม่พบบัญชีที่ใช้งานอยู่" : "ร้านนี้ยังไม่มีบัญชีที่อนุมัติแล้ว" }, { status: 400 });
    }
    const tempPassword = generateTempPassword();
    const { error: uErr } = await sb.auth.admin.updateUserById(prof.id as string, { password: tempPassword });
    if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
    await sb.from("profiles").update({ must_change_password: true }).eq("id", prof.id);
    await close("done");
    return NextResponse.json({ ok: true, credentials: { email: emailToUsername(prof.email as string), tempPassword } });
  }

  return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });
}
