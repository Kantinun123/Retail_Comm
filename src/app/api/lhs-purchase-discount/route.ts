import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * LHS Purchase Discount API (ส่วนลดซื้อ 7% Housing Expert — Roof, ฝั่งร้านค้า)
 * - GET /api/lhs-purchase-discount?dealerCode=XXX                 -> สรุปต่อเดือน
 * - GET /api/lhs-purchase-discount?dealerCode=XXX&period=YYYY-MM   -> รายบรรทัด
 */
export async function GET(req: NextRequest) {
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  const period = req.nextUrl.searchParams.get("period")?.trim() || null;
  try {
    const sb = createServiceClient();
    if (period) {
      const { data, error } = await sb.rpc("lhs_purchase_discount_month_lines", {
        p_period: period,
        p_dealer: dealerCode,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    const { data, error } = await sb.rpc("lhs_purchase_discount_summary", { p_dealer: dealerCode });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
