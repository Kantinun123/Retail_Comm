import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * หน้า "ฉัน" ของ Admin / หัวหน้า Area / Area / Coach
 * - GET   -> ข้อมูลของฉัน + ผังทีม (เฉพาะขอบเขตของตัวเอง)
 *     admin      : me + รายชื่อทีมผู้ดูแลระบบ
 *     area_head  : me + ร้านทั้งหมดที่มี Area ดูแล (Area -> Coach -> ร้าน -> พนักงาน)
 *     area/coach : me + หัวหน้า Area + ร้านที่ดูแล (+ Area/Coach ของร้านนั้น + พนักงานในร้าน)
 * - PATCH { nickname?, phone?, phone2?, lineId? } -> แก้ข้อมูลของตัวเองเท่านั้น
 *     area/coach/re -> sale_reps (แถวของ rep_code ตัวเอง) ; admin/area_head -> profiles (แถวของตัวเอง)
 * ร้านค้า / พนักงานขาย ไม่ใช้ route นี้ (403)
 */

const REP_ROLES = new Set(["area", "coach", "re"]);
const ALLOWED_ROLES = new Set(["admin", "area_head", "area", "coach", "re"]);
const REP_FIELDS = "rep_code, name, nickname, position, level, photo_url, phone, phone2, email, line_id, start_date, dealer_code";
const PROFILE_FIELDS = "id, email, full_name, nickname, job_title, photo_url, phone, line_id";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  nickname: string | null;
  job_title: string | null;
  photo_url: string | null;
  phone: string | null;
  line_id: string | null;
};

/** profiles -> รูปแบบเดียวกับคนในผัง */
const fromProfile = (p: ProfileRow) => ({
  id: p.id,
  name: p.full_name ?? p.email ?? "",
  nickname: p.nickname,
  title: p.job_title,
  photoUrl: p.photo_url,
  phone: p.phone,
  email: p.email,
  lineId: p.line_id,
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!ALLOWED_ROLES.has(ctx.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const sb = createServiceClient();

  // ---- ข้อมูลของฉัน ----
  const { data: myProfile } = await sb.from("profiles").select(PROFILE_FIELDS).eq("id", ctx.userId).single();
  let me: Record<string, unknown> = { kind: ctx.role, ...fromProfile(myProfile as ProfileRow), repCode: null, editable: "profile" };
  if (REP_ROLES.has(ctx.role) && ctx.repCode) {
    const { data: rep } = await sb.from("sale_reps").select(REP_FIELDS).eq("rep_code", ctx.repCode).maybeSingle();
    if (rep) {
      me = {
        kind: ctx.role,
        id: ctx.userId,
        repCode: rep.rep_code,
        name: rep.name,
        nickname: rep.nickname,
        title: null,
        photoUrl: rep.photo_url,
        phone: rep.phone,
        phone2: rep.phone2,
        // อีเมลที่ใช้เข้าระบบ (ชื่อผู้ใช้) มาก่อน
        email: myProfile?.email ?? rep.email,
        lineId: rep.line_id,
        editable: "rep",
      };
    }
  }

  // ---- admin: ทีมผู้ดูแลระบบ ----
  if (ctx.role === "admin") {
    const { data: admins } = await sb
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("role", "admin")
      .eq("status", "approved")
      .order("full_name");
    return NextResponse.json({
      ok: true,
      me,
      admins: (admins ?? []).filter((a) => a.id !== ctx.userId).map((a) => fromProfile(a as ProfileRow)),
    });
  }

  // ---- กลุ่ม Area: หัวหน้า Area + ผังร้านในขอบเขต ----
  const { data: heads } = await sb
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("role", "area_head")
    .eq("status", "approved")
    .order("full_name");

  const scope = ctx.allowedDealerCodes === "all" ? null : ctx.allowedDealerCodes;
  if (scope && scope.length === 0) {
    return NextResponse.json({ ok: true, me, heads: (heads ?? []).map((h) => fromProfile(h as ProfileRow)), stores: [], assignments: [], people: [] });
  }

  let dq = sb.from("dealers").select("code, name, model, region").eq("is_active", true).order("name");
  if (scope) dq = dq.in("code", scope);
  const { data: dealers, error: dErr } = await dq;
  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
  const codes = (dealers ?? []).map((d) => d.code as string);
  if (codes.length === 0) {
    return NextResponse.json({ ok: true, me, heads: (heads ?? []).map((h) => fromProfile(h as ProfileRow)), stores: [], assignments: [], people: [] });
  }

  const [{ data: asg, error: aErr }, { data: staff, error: sErr }] = await Promise.all([
    sb.from("rep_store_assignments").select("rep_code, dealer_code, role_in_store").in("dealer_code", codes),
    sb.from("sale_reps").select(REP_FIELDS).eq("is_active", true).in("dealer_code", codes),
  ]);
  if (aErr || sErr) return NextResponse.json({ ok: false, error: (aErr ?? sErr)!.message }, { status: 500 });

  // Area / Coach ที่ผูกกับร้าน (ไม่มี dealer_code ของตัวเอง)
  const supCodes = Array.from(new Set((asg ?? []).map((a) => a.rep_code as string)));
  const { data: sups } = supCodes.length
    ? await sb.from("sale_reps").select(REP_FIELDS).eq("is_active", true).in("rep_code", supCodes)
    : { data: [] as never[] };

  const toPerson = (r: Record<string, unknown>) => ({
    repCode: r.rep_code,
    name: r.name,
    nickname: r.nickname,
    position: r.position,
    level: r.level,
    photoUrl: r.photo_url,
    phone: r.phone,
    email: r.email,
    lineId: r.line_id,
    startDate: r.start_date,
    dealerCode: r.dealer_code,
  });
  const activeSup = new Set((sups ?? []).map((s) => s.rep_code as string));

  return NextResponse.json({
    ok: true,
    me,
    heads: (heads ?? []).filter((h) => h.id !== ctx.userId).map((h) => fromProfile(h as ProfileRow)),
    stores: dealers,
    assignments: (asg ?? []).filter((a) => activeSup.has(a.rep_code as string)).map((a) => ({ repCode: a.rep_code, dealerCode: a.dealer_code, role: a.role_in_store })),
    people: [...(sups ?? []), ...(staff ?? [])].map((r) => toPerson(r as Record<string, unknown>)),
  });
}

/** ตัดช่องว่าง + จำกัดความยาว ; ว่าง = null ; undefined = ไม่แก้ช่องนี้ */
function clean(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!ALLOWED_ROLES.has(ctx.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const nickname = clean(body.nickname, 40);
  const phone = clean(body.phone, 20);
  const phone2 = clean(body.phone2, 20);
  const lineId = clean(body.lineId, 50);
  const badPhone = [phone, phone2].some((p) => p && !/^[0-9+\-\s()]{6,20}$/.test(p));
  if (badPhone) return NextResponse.json({ ok: false, error: "เบอร์โทรใช้ได้เฉพาะตัวเลข เว้นวรรค + - ( )" }, { status: 400 });

  const sb = createServiceClient();
  // ช่องที่แก้ได้ถูกกำหนดตายตัว — ชื่อ / อีเมล / ตำแหน่ง / ร้าน / สิทธิ์ แก้ผ่านหน้านี้ไม่ได้
  if (REP_ROLES.has(ctx.role)) {
    if (!ctx.repCode) return NextResponse.json({ ok: false, error: "ไม่พบข้อมูลพนักงานของบัญชีนี้" }, { status: 400 });
    const patch: Record<string, string | null> = {};
    if (nickname !== undefined) patch.nickname = nickname;
    if (phone !== undefined) patch.phone = phone;
    if (phone2 !== undefined) patch.phone2 = phone2;
    if (lineId !== undefined) patch.line_id = lineId;
    if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
    const { error } = await sb.from("sale_reps").update(patch).eq("rep_code", ctx.repCode);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, string | null> = {};
  if (nickname !== undefined) patch.nickname = nickname;
  if (phone !== undefined) patch.phone = phone;
  if (lineId !== undefined) patch.line_id = lineId;
  if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
  const { error } = await sb.from("profiles").update(patch).eq("id", ctx.userId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
