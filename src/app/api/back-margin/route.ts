import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Back margin API (ฝั่งร้านค้า, server-authoritative)
 * - GET /api/back-margin?dealerCode=XXX            -> สรุปต่อเดือน (back_margin_summary)
 * - GET /api/back-margin?dealerCode=XXX&period=YYYY-MM -> รายบรรทัดของเดือนนั้น (drill-down)
 *
 * dealerCode ว่าง = ทุกร้าน (admin ดูรวม)
 * ใช้ service-role + filter dealer_code ฝั่ง server (ไม่พึ่ง RLS/anon bridge)
 */

export async function GET(req: NextRequest) {
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  const period = req.nextUrl.searchParams.get("period")?.trim() || null;

  try {
    const sb = createServiceClient();
    if (period) {
      const { data, error } = await sb.rpc("back_margin_month_lines", {
        p_period: period,
        p_dealer: dealerCode,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    const { data, error } = await sb.rpc("back_margin_summary", { p_dealer: dealerCode });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
