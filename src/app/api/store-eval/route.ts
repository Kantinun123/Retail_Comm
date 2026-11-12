import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveScope } from "@/lib/supabase/api-scope";

/**
 * Store Evaluation API (ผลตรวจประเมินร้านค้า — ฝั่งร้านค้า)
 * - GET /api/store-eval?dealerCode=XXX                 -> สรุปรายเดือน + ผลล่าสุด
 * - GET /api/store-eval?dealerCode=XXX&period=YYYY-MM   -> รายละเอียดการตรวจเดือนนั้น
 * - GET /api/store-eval?submission=XXX                  -> ข้อย่อยของการตรวจครั้งนั้น
 * - GET /api/store-eval?mode=fails&dealerCode=XXX       -> สรุปข้อที่ตกบ่อย
 */
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period")?.trim() || null;
  const submission = req.nextUrl.searchParams.get("submission")?.trim() || null;
  const mode = req.nextUrl.searchParams.get("mode")?.trim() || null;
  const sb = createServiceClient();

  // ข้อย่อยของการตรวจ: หาร้านของ submission ก่อน แล้วตรวจสิทธิ์ร้านนั้น
  let reqDealer = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  if (submission) {
    const { data: sub } = await sb.from("store_eval_lines").select("dealer_code").eq("submission_id", submission).limit(1).maybeSingle();
    if (!sub?.dealer_code) return NextResponse.json({ ok: true, items: [] });
    reqDealer = sub.dealer_code as string;
  }
  const scope = await resolveScope(reqDealer, null);
  if (!scope.ok) return scope.res;
  if (submission && scope.dealerCode && scope.dealerCode !== reqDealer) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const { dealerCode } = scope;

  try {
    if (submission) {
      const { data, error } = await sb.rpc("store_eval_items", { p_submission: submission });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    if (mode === "fails") {
      const { data, error } = await sb.rpc("store_eval_fail_summary", { p_dealer: dealerCode });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    if (period) {
      const { data, error } = await sb.rpc("store_eval_month_lines", {
        p_period: period,
        p_dealer: dealerCode,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    const { data, error } = await sb.rpc("store_eval_summary", { p_dealer: dealerCode });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
