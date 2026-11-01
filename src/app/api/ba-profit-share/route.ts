import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * BA Profit Share API (ผลประโยชน์ร้านค้าจากระบบ BA Q-CHANG)
 * - GET /api/ba-profit-share?dealerCode=XXX                 -> สรุปต่อเดือน
 * - GET /api/ba-profit-share?dealerCode=XXX&period=YYYY-MM   -> รายบรรทัดเดือนนั้น
 * แสดงเฉพาะแถวที่ map ร้านเจอ (dealer_code is not null)
 */

export async function GET(req: NextRequest) {
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  const period = req.nextUrl.searchParams.get("period")?.trim() || null;

  try {
    const sb = createServiceClient();
    if (period) {
      const { data, error } = await sb.rpc("ba_profit_share_month_lines", {
        p_period: period,
        p_dealer: dealerCode,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    const { data, error } = await sb.rpc("ba_profit_share_summary", { p_dealer: dealerCode });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
