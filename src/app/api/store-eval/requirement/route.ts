import { NextRequest, NextResponse } from "next/server";
import { canAccessDealer, getAuthContext, type AuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { bangkokToday } from "@/lib/server/eval-tracking";

/**
 * เปิด/ปิดการตรวจประเมินรายร้าน — มีผลตั้งแต่เดือนปัจจุบัน (เวลาไทย) ; เดือนก่อนหน้าไม่เปลี่ยน
 * - GET  ?dealerCode=XXX -> สถานะเดือนนี้ + ประวัติ
 * - POST { dealerCode, required, reason? }
 *   เปลี่ยนซ้ำในเดือนเดียวกัน = ทับค่าของเดือนนั้น ; ถ้าค่าใหม่เท่ากับสถานะเดือนก่อน ลบแถวของเดือนนี้ทิ้ง (ไม่เก็บแถวที่ไม่มีผล)
 *
 * สิทธิ์: Admin = ทุกร้าน ; หัวหน้า Area / Area / Coach = เฉพาะร้านที่ดูแล (allowedDealerCodes)
 * - ปิดการตรวจ (required=false) ต้องระบุสาเหตุเสมอ (อย่างน้อย 3 ตัวอักษร)
 * - Area / Coach ปิดร้านที่ "ตรวจแล้วในเดือนนี้" ไม่ได้ (ไม่มีเหตุผลต้องปิด) ; Admin ทำได้
 * - Area / Coach เปิดคืนร้านที่ Admin เป็นผู้ปิดไม่ได้ (เป็นการตัดสินใจของ Admin)
 * บันทึกผู้เปลี่ยนใน changed_by / changed_at (ใช้แสดง "ปิดโดย ..." ในหน้าติดตาม)
 */
const ROLES = new Set(["admin", "area_head", "area", "coach", "re"]);
type Guard = { res: NextResponse } | { ctx: AuthContext; res?: undefined };

async function guard(code: string | null): Promise<Guard> {
  const ctx = await getAuthContext();
  if (!ctx) return { res: NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 }) };
  if (!ROLES.has(ctx.role)) return { res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  if (code && !canAccessDealer(ctx, code)) return { res: NextResponse.json({ ok: false, error: "ร้านนี้ไม่อยู่ในขอบเขตที่คุณดูแล" }, { status: 403 }) };
  return { ctx };
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("dealerCode")?.trim();
  if (!code) return NextResponse.json({ ok: false, error: "missing dealerCode" }, { status: 400 });
  const a = await guard(code);
  if (a.res) return a.res;
  const period = bangkokToday().slice(0, 7);
  const { data, error } = await createServiceClient()
    .from("store_eval_requirements")
    .select("effective_period, required, reason, changed_at")
    .eq("dealer_code", code)
    .order("effective_period", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const cur = (data ?? []).find((r) => (r.effective_period as string) <= period);
  return NextResponse.json({
    ok: true,
    period,
    required: cur ? cur.required === true : true,
    reason: cur && !cur.required ? (cur.reason as string | null) : null,
    since: cur ? (cur.effective_period as string) : null,
    history: data ?? [],
  });
}

export async function POST(req: NextRequest) {
  let body: { dealerCode?: string; required?: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const code = String(body.dealerCode ?? "").trim();
  if (!code || typeof body.required !== "boolean") return NextResponse.json({ ok: false, error: "missing dealerCode / required" }, { status: 400 });
  const a = await guard(code);
  if (a.res) return a.res;
  const { ctx } = a;
  const isAdmin = ctx.role === "admin";

  const reason = body.required ? null : String(body.reason ?? "").trim().slice(0, 200) || null;
  if (!body.required && (!reason || reason.length < 3)) return NextResponse.json({ ok: false, error: "ระบุสาเหตุที่ไม่ตรวจ" }, { status: 400 });

  const sb = createServiceClient();
  const { data: dealer } = await sb.from("dealers").select("code").eq("code", code).maybeSingle();
  if (!dealer) return NextResponse.json({ ok: false, error: "ไม่พบร้าน" }, { status: 404 });

  const period = bangkokToday().slice(0, 7);

  if (!isAdmin && !body.required) {
    const { count } = await sb.from("store_eval_lines").select("submission_id", { count: "exact", head: true }).eq("dealer_code", code).eq("period", period);
    if ((count ?? 0) > 0) return NextResponse.json({ ok: false, error: "ร้านนี้ตรวจแล้วในเดือนนี้ ไม่ต้องปิดการตรวจ" }, { status: 409 });
  }
  if (!isAdmin && body.required) {
    // เปิดคืนได้ ยกเว้นร้านที่ Admin เป็นผู้ปิด
    const { data: cur } = await sb
      .from("store_eval_requirements")
      .select("required, changed_by")
      .eq("dealer_code", code)
      .lte("effective_period", period)
      .order("effective_period", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cur && cur.required === false && cur.changed_by) {
      const { data: who } = await sb.from("profiles").select("role").eq("id", cur.changed_by as string).maybeSingle();
      if (who?.role === "admin") return NextResponse.json({ ok: false, error: "Admin เป็นผู้ปิดการตรวจร้านนี้ ต้องให้ Admin เป็นผู้เปิด" }, { status: 403 });
    }
  }

  // สถานะที่มีผลก่อนเดือนนี้
  const { data: prev } = await sb
    .from("store_eval_requirements")
    .select("required")
    .eq("dealer_code", code)
    .lt("effective_period", period)
    .order("effective_period", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevRequired = prev ? prev.required === true : true;

  if (prevRequired === body.required) {
    // กลับเป็นค่าเดิมของเดือนก่อน -> ไม่ต้องมีแถวของเดือนนี้
    const { error } = await sb.from("store_eval_requirements").delete().eq("dealer_code", code).eq("effective_period", period);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    const { error } = await sb
      .from("store_eval_requirements")
      .upsert(
        { dealer_code: code, effective_period: period, required: body.required, reason, changed_by: ctx.userId, changed_at: new Date().toISOString() },
        { onConflict: "dealer_code,effective_period" }
      );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, period, required: body.required, reason });
}
