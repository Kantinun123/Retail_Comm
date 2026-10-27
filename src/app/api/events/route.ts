import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

/**
 * Event check-in API (ฝั่งสมาชิก, server-authoritative)
 * - GET  /api/events?empId=...           -> กิจกรรมที่เห็นได้ตอนนี้ (visible_events RPC)
 * - POST /api/events { empId, eventId, code } -> เช็คอิน (perform_event_checkin RPC, service-role)
 *
 * ความปลอดภัย:
 * - perform_event_checkin เรียกผ่าน service-role เท่านั้น — client เขียน DB ตรงไม่ได้
 * - server ตรวจ audience/code/ช่วงเวลา/กันซ้ำทั้งหมด
 * - โหมด real auth: ตรวจ empId ตรงกับผู้ล็อกอิน
 */

/** โหมด real auth: ยืนยันว่า empId ที่อ้างตรงกับ profile ของผู้ล็อกอิน */
async function verifyIdentity(empId: string): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NEXT_PUBLIC_REAL_AUTH !== "1") return { ok: true };
  const sb = await createServerAuthClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthenticated" };
  const { data: profile } = await sb
    .from("profiles")
    .select("emp_id, status")
    .eq("id", auth.user.id)
    .single();
  if (!profile || profile.status !== "approved") return { ok: false, error: "profile not approved" };
  if (profile.emp_id !== empId) return { ok: false, error: "emp_id mismatch" };
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const empId = req.nextUrl.searchParams.get("empId")?.trim();
  if (!empId) {
    return NextResponse.json({ ok: false, error: "missing empId" }, { status: 400 });
  }
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.rpc("visible_events", { p_emp_id: empId });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { empId?: string; eventId?: number; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const empId = body.empId?.trim();
  const eventId = Number(body.eventId);
  const code = (body.code ?? "").trim();
  if (!empId || !eventId) {
    return NextResponse.json({ ok: false, error: "missing empId/eventId" }, { status: 400 });
  }

  const id = await verifyIdentity(empId);
  if (!id.ok) return NextResponse.json({ ok: false, error: id.error }, { status: 403 });

  try {
    const sb = createServiceClient();
    const { data, error } = await sb.rpc("perform_event_checkin", {
      p_emp_id: empId,
      p_event_id: eventId,
      p_code: code,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
