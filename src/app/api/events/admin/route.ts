import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

/**
 * Event admin API — สร้าง/รายการ/ปิด กิจกรรม (ฝั่ง admin)
 * - GET  /api/events/admin           -> รายการกิจกรรมทั้งหมด + จำนวนเช็คอิน
 * - POST /api/events/admin           -> สร้างกิจกรรมใหม่
 * - PATCH /api/events/admin { id, active:false } -> ปิดกิจกรรม
 *
 * ความปลอดภัย:
 * - เขียนผ่าน service-role เท่านั้น
 * - โหมด real auth: ตรวจ profiles.role = admin (โหมด demo เชื่อ client เพราะไม่มี server identity)
 * - meeting_url: รับเฉพาะ https ของ domain Teams (allowlist)
 */

const TEAMS_HOSTS = new Set(["teams.microsoft.com", "teams.live.com"]);

/** validate ลิงก์ Teams: ต้อง https + host อยู่ใน allowlist; คืน null ถ้าว่าง, throw ถ้าผิด */
function validateMeetingUrl(raw: unknown): string | null {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const s = String(raw).trim();
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error("ลิงก์ประชุมไม่ถูกต้อง");
  }
  if (u.protocol !== "https:") throw new Error("ลิงก์ประชุมต้องเป็น https");
  if (!TEAMS_HOSTS.has(u.hostname)) throw new Error("รองรับเฉพาะลิงก์ Microsoft Teams");
  return u.toString();
}

/** โหมด real auth: ต้องเป็น admin ที่ approved */
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

export async function GET() {
  const adm = await verifyAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });
  try {
    const sb = createServiceClient();
    const { data: events, error } = await sb
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // นับเช็คอินต่อกิจกรรม
    const { data: counts } = await sb.from("event_checkins").select("event_id");
    const countMap = new Map<number, number>();
    (counts ?? []).forEach((r: { event_id: number }) => {
      countMap.set(r.event_id, (countMap.get(r.event_id) ?? 0) + 1);
    });
    const withCount = (events ?? []).map((e: { id: number }) => ({
      ...e,
      checkin_count: countMap.get(e.id) ?? 0,
    }));
    return NextResponse.json({ ok: true, events: withCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const code = String(body.code ?? "").trim();
  const points = Number(body.points);
  const startsAt = String(body.startsAt ?? "").trim();
  const endsAt = String(body.endsAt ?? "").trim();
  const audienceMode = String(body.audienceMode ?? "all").trim();
  const audienceValues = Array.isArray(body.audienceValues)
    ? (body.audienceValues as unknown[]).map(String)
    : null;

  if (!title || !code || !startsAt || !endsAt) {
    return NextResponse.json({ ok: false, error: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (!Number.isFinite(points) || points < 0) {
    return NextResponse.json({ ok: false, error: "แต้มไม่ถูกต้อง" }, { status: 400 });
  }
  if (!["all", "dealers", "models", "employees"].includes(audienceMode)) {
    return NextResponse.json({ ok: false, error: "โหมด audience ไม่ถูกต้อง" }, { status: 400 });
  }
  if (audienceMode !== "all" && (!audienceValues || audienceValues.length === 0)) {
    return NextResponse.json({ ok: false, error: "เลือกกลุ่มเป้าหมายอย่างน้อย 1 รายการ" }, { status: 400 });
  }

  let meetingUrl: string | null;
  try {
    meetingUrl = validateMeetingUrl(body.meetingUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ลิงก์ประชุมไม่ถูกต้อง";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("events")
      .insert({
        title,
        description: String(body.description ?? ""),
        code,
        points,
        starts_at: startsAt,
        ends_at: endsAt,
        meeting_url: meetingUrl,
        audience_mode: audienceMode,
        audience_values: audienceMode === "all" ? null : audienceValues,
        created_by: String(body.createdBy ?? ""),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, event: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let body: { id?: number; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });

  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("events")
      .update({ active: body.active ?? false })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
