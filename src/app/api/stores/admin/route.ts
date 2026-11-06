import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

/**
 * จัดการร้านค้า (admin)
 * - PATCH /api/stores/admin { code, isActive } -> เปิด/ปิดใช้งานร้าน (ไม่ลบจริง)
 *
 * เขียนผ่าน service-role ; โหมด real auth ตรวจ profiles.role = admin
 */

async function verifyAdmin(): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NEXT_PUBLIC_REAL_AUTH !== "1") return { ok: true };
  const sb = await createServerAuthClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthenticated" };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, status")
    .eq("id", auth.user.id)
    .single();
  if (!profile || profile.status !== "approved" || profile.role !== "admin") {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true };
}

export async function PATCH(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok)
    return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let body: { code?: string; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid body" },
      { status: 400 }
    );
  }

  const code = String(body.code ?? "").trim();
  if (!code)
    return NextResponse.json(
      { ok: false, error: "missing code" },
      { status: 400 }
    );

  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("dealers")
      .update({ is_active: body.isActive ?? false })
      .eq("code", code);
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    return NextResponse.json({ ok: true, code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
