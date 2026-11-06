import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

/**
 * จัดการหัวหน้า (Area Manager / RE-Coach) ของร้าน — assignment แบบ 1 คนต่อ role ต่อร้าน
 * - GET   /api/stores/admin/supervisor                 -> รายชื่อ Area/Coach ทั้งหมด (dropdown)
 * - PATCH /api/stores/admin/supervisor { dealerCode, role, repCode }  -> ตั้ง (แทนที่คนเดิมใน role นั้น)
 * - PATCH /api/stores/admin/supervisor { dealerCode, role, repCode: null } -> เอาออก
 *   role: 'manager' (area) | 'coach'
 *
 * เขียนผ่าน service-role ; โหมด real auth ตรวจ admin
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

const ROLES = new Set(["manager", "coach"]);

export async function GET() {
  const adm = await verifyAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("sale_reps")
      .select("rep_code, name, nickname, position")
      .in("position", ["area_mng", "coach"])
      .eq("is_active", true)
      .order("position")
      .order("name");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, supervisors: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let body: { dealerCode?: string; role?: string; repCode?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const dealerCode = String(body.dealerCode ?? "").trim();
  const role = String(body.role ?? "").trim();
  const repCode = body.repCode ? String(body.repCode).trim() : null;

  if (!dealerCode) return NextResponse.json({ ok: false, error: "missing dealerCode" }, { status: 400 });
  if (!ROLES.has(role)) return NextResponse.json({ ok: false, error: "invalid role" }, { status: 400 });

  try {
    const sb = createServiceClient();

    if (repCode) {
      // ตั้งคนใหม่: "เพิ่มคนใหม่ก่อน" แล้วค่อยลบคนอื่นใน role เดียวกัน
      // (ถ้าเพิ่มไม่สำเร็จ ข้อมูลเดิมยังอยู่ครบ ร้านไม่เคยว่างระหว่างทาง)
      const { error: upErr } = await sb
        .from("rep_store_assignments")
        .upsert(
          { rep_code: repCode, dealer_code: dealerCode, role_in_store: role },
          { onConflict: "rep_code,dealer_code,role_in_store", ignoreDuplicates: true }
        );
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

      const { error: delErr } = await sb
        .from("rep_store_assignments")
        .delete()
        .eq("dealer_code", dealerCode)
        .eq("role_in_store", role)
        .neq("rep_code", repCode);
      if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    } else {
      // repCode = null -> เอาออก (ลบทุกคนใน role นี้ของร้าน)
      const { error: delErr } = await sb
        .from("rep_store_assignments")
        .delete()
        .eq("dealer_code", dealerCode)
        .eq("role_in_store", role);
      if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
