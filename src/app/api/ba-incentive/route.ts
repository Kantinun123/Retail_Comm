import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * BA Incentive API (ค่าคอมมิชชั่นงานบริการ Q-CHANG — ฝั่งพนักงานขายบริการ)
 * - GET /api/ba-incentive?dealerCode=XXX                 -> สรุปต่อเดือน
 * - GET /api/ba-incentive?dealerCode=XXX&period=YYYY-MM   -> รายบรรทัดเดือนนั้น (drill-down)
 * dealerCode ว่าง = ทุกร้าน (admin) — แสดงเฉพาะแถวที่ map ร้านเจอ
 */

export async function GET(req: NextRequest) {
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  const period = req.nextUrl.searchParams.get("period")?.trim() || null;

  try {
    const sb = createServiceClient();
    if (period) {
      const { data, error } = await sb.rpc("ba_incentive_month_lines", {
        p_period: period,
        p_dealer: dealerCode,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    const { data, error } = await sb.rpc("ba_incentive_summary", { p_dealer: dealerCode });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
