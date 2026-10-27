import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

/**
 * GET /api/events/admin/checkins?eventId=...
 * รายชื่อคนที่เช็คอินของกิจกรรม (admin เท่านั้น)
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

export async function GET(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "missing eventId" }, { status: 400 });
  }

  try {
    const sb = createServiceClient();
    const { data, error } = await sb.rpc("event_checkin_list", { p_event_id: eventId });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
