import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

/**
 * ฐานข้อมูลพนักงาน (admin เขียน)
 * - POST  /api/employees/admin  -> สร้างพนักงานใหม่ (gen SR####)
 * - PATCH /api/employees/admin  -> แก้ไข / ปิด-เปิดใช้งาน (ส่ง repCode + fields)
 *
 * ความปลอดภัย:
 * - เขียนผ่าน service-role เท่านั้น
 * - โหมด real auth: ตรวจ profiles.role = admin ; โหมด demo เชื่อ client (ไม่มี server identity)
 */

const POSITIONS = new Set([
  "store_exec",
  "area_mng",
  "coach",
  "se",
  "sale_floor",
]);
const LEVELS = new Set(["B", "S", "A"]);

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

/** map ฟิลด์จาก body (camel) -> คอลัมน์ DB (snake); คืน {} ถ้าไม่มีฟิลด์ไหนให้แก้ */
function buildRow(body: Record<string, unknown>, forUpdate: boolean) {
  const row: Record<string, unknown> = {};
  const setStr = (dbKey: string, bodyKey: string) => {
    if (bodyKey in body) {
      const v = body[bodyKey];
      row[dbKey] = v === "" || v === undefined ? null : v;
    }
  };

  if ("name" in body) row.name = String(body.name ?? "").trim();
  setStr("nickname", "nickname");
  if ("dealerCode" in body)
    row.dealer_code = body.dealerCode ? String(body.dealerCode) : null;
  if ("position" in body) {
    const p = body.position ? String(body.position) : null;
    row.position = p && POSITIONS.has(p) ? p : null;
  }
  // Area/Coach ผูกร้านผ่าน rep_store_assignments (หลายร้าน) ไม่ใช่ dealer_code เดียว
  // -> บังคับ dealer_code = null กันฟอร์มส่งค่าเก่ากลับมาทำให้ไปโผล่เป็น "พนักงานในร้าน"
  if (row.position === "area_mng" || row.position === "coach") {
    row.dealer_code = null;
  }
  if ("level" in body) {
    const l = body.level ? String(body.level) : null;
    row.level = l && LEVELS.has(l) ? l : null;
  }
  setStr("phone", "phone");
  setStr("phone2", "phone2");
  setStr("email", "email");
  setStr("line_id", "lineId");
  setStr("birth_date", "birthDate");
  setStr("start_date", "startDate");
  setStr("notes", "notes");
  setStr("photo_url", "photoUrl");
  if ("skills" in body) {
    row.skills = Array.isArray(body.skills)
      ? (body.skills as unknown[]).map(String).filter(Boolean)
      : [];
  }
  if ("isActive" in body) row.is_active = Boolean(body.isActive);

  // สร้างใหม่: ค่า default ที่จำเป็น
  if (!forUpdate) {
    if (row.is_active === undefined) row.is_active = true;
    if (row.skills === undefined) row.skills = [];
  }
  return row;
}

/** gen rep_code ถัดไป (SR####) จากค่าสูงสุดในตาราง */
async function nextRepCode(
  sb: ReturnType<typeof createServiceClient>
): Promise<string> {
  const { data } = await sb
    .from("sale_reps")
    .select("rep_code")
    .like("rep_code", "SR%")
    .order("rep_code", { ascending: false })
    .limit(1);
  const last = data?.[0]?.rep_code as string | undefined;
  const n = last ? parseInt(last.replace(/\D/g, ""), 10) || 0 : 0;
  return `SR${String(n + 1).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok)
    return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid body" },
      { status: 400 }
    );
  }

  const name = String(body.name ?? "").trim();
  if (!name)
    return NextResponse.json(
      { ok: false, error: "กรุณากรอกชื่อพนักงาน" },
      { status: 400 }
    );

  try {
    const sb = createServiceClient();
    const repCode = await nextRepCode(sb);
    const row = { rep_code: repCode, ...buildRow(body, false) };
    const { error } = await sb.from("sale_reps").insert(row);
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    return NextResponse.json({ ok: true, repCode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok)
    return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid body" },
      { status: 400 }
    );
  }

  const repCode = String(body.repCode ?? "").trim();
  if (!repCode)
    return NextResponse.json(
      { ok: false, error: "missing repCode" },
      { status: 400 }
    );

  const row = buildRow(body, true);
  if (Object.keys(row).length === 0)
    return NextResponse.json(
      { ok: false, error: "ไม่มีข้อมูลให้แก้ไข" },
      { status: 400 }
    );

  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("sale_reps")
      .update(row)
      .eq("rep_code", repCode);
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    return NextResponse.json({ ok: true, repCode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
