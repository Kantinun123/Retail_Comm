import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { bangkokToday } from "@/lib/server/eval-tracking";

/**
 * เปิด/ปิดการตรวจประเมินรายร้าน (Admin เท่านั้น) — มีผลตั้งแต่เดือนปัจจุบัน (เวลาไทย) ; เดือนก่อนหน้าไม่เปลี่ยน
 * - GET  ?dealerCode=XXX -> สถานะเดือนนี้ + ประวัติ
 * - POST { dealerCode, required, reason? }
 *   เปลี่ยนซ้ำในเดือนเดียวกัน = ทับค่าของเดือนนั้น ; ถ้าค่าใหม่เท่ากับสถานะเดือนก่อน ลบแถวของเดือนนี้ทิ้ง (ไม่เก็บแถวที่ไม่มีผล)
 */
async function requireAdmin() {
  const ctx = await getAuthContext();
  if (!ctx) return { res: NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 }) };
  if (ctx.role !== "admin") return { res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { ctx };
}

export async function GET(req: NextRequest) {
  const a = await requireAdmin();
  if (a.res) return a.res;
  const code = req.nextUrl.searchParams.get("dealerCode")?.trim();
  if (!code) return NextResponse.json({ ok: false, error: "missing dealerCode" }, { status: 400 });
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
  const a = await requireAdmin();
  if (a.res) return a.res;
  let body: { dealerCode?: string; required?: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const code = String(body.dealerCode ?? "").trim();
  if (!code || typeof body.required !== "boolean") return NextResponse.json({ ok: false, error: "missing dealerCode / required" }, { status: 400 });
  const reason = body.required ? null : String(body.reason ?? "").trim().slice(0, 200) || null;
  const sb = createServiceClient();
  const { data: dealer } = await sb.from("dealers").select("code").eq("code", code).maybeSingle();
  if (!dealer) return NextResponse.json({ ok: false, error: "ไม่พบร้าน" }, { status: 404 });

  const period = bangkokToday().slice(0, 7);
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
        { dealer_code: code, effective_period: period, required: body.required, reason, changed_by: a.ctx.userId, changed_at: new Date().toISOString() },
        { onConflict: "dealer_code,effective_period" }
      );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, period, required: body.required, reason });
}
