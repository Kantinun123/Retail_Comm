import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

/**
 * Daily check-in API (server-authoritative)
 * - GET  /api/checkin?empId=...  -> สถานะเช็คอิน (get_checkin_state RPC)
 * - POST /api/checkin { empId }  -> เช็คอินวันนี้ (perform_checkin RPC, service-role)
 *
 * ความปลอดภัย:
 * - perform_checkin เรียกผ่าน service-role (ข้าม RLS) เท่านั้น — client เขียน DB ตรงไม่ได้
 * - server คำนวณวัน/แต้ม/กันกดซ้ำเองทั้งหมด (client ส่งได้แค่ empId)
 * - โหมด real auth (NEXT_PUBLIC_REAL_AUTH=1): ตรวจว่า empId ตรงกับผู้ล็อกอินจริง
 *
 * NOTE: ไม่ใส่ `export const dynamic` — ไม่เข้ากับ cacheComponents (next.config)
 * route นี้อ่าน query/cookies อยู่แล้วจึงถูกถือเป็น dynamic โดยอัตโนมัติ
 */

/** โหมด real auth: ยืนยันว่า empId ที่อ้างตรงกับ profile ของผู้ล็อกอิน */
async function verifyIdentity(empId: string): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NEXT_PUBLIC_REAL_AUTH !== "1") {
    // โหมด demo: ไม่มี Supabase Auth identity จริง — ยอมรับ empId ที่ client อ้าง
    return { ok: true };
  }
  const sb = await createServerAuthClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthenticated" };
  const { data: profile } = await sb
    .from("profiles")
    .select("emp_id, role, status")
    .eq("id", auth.user.id)
    .single();
  if (!profile || profile.status !== "approved") {
    return { ok: false, error: "profile not approved" };
  }
  if (profile.emp_id !== empId) {
    return { ok: false, error: "emp_id mismatch" };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const empId = req.nextUrl.searchParams.get("empId")?.trim();
  if (!empId) {
    return NextResponse.json({ ok: false, error: "missing empId" }, { status: 400 });
  }
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.rpc("get_checkin_state", { p_emp_id: empId });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { empId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const empId = body.empId?.trim();
  if (!empId) {
    return NextResponse.json({ ok: false, error: "missing empId" }, { status: 400 });
  }

  const id = await verifyIdentity(empId);
  if (!id.ok) {
    return NextResponse.json({ ok: false, error: id.error }, { status: 403 });
  }

  try {
    const sb = createServiceClient();
    const { data, error } = await sb.rpc("perform_checkin", { p_emp_id: empId });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
