import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Store Evaluation API (ผลตรวจประเมินร้านค้า — ฝั่งร้านค้า)
 * - GET /api/store-eval?dealerCode=XXX                 -> สรุปรายเดือน + ผลล่าสุด
 * - GET /api/store-eval?dealerCode=XXX&period=YYYY-MM   -> รายละเอียดการตรวจเดือนนั้น
 */
export async function GET(req: NextRequest) {
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  const period = req.nextUrl.searchParams.get("period")?.trim() || null;
  try {
    const sb = createServiceClient();
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
