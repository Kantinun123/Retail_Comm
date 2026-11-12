import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveScope } from "@/lib/supabase/api-scope";

/**
 * Customer Satisfaction API (ความพึงพอใจของลูกค้า — ฝั่งร้านค้า)
 * - GET /api/cust-sat?dealerCode=XXX                 -> สรุปรายเดือน + ภาพรวม
 * - GET /api/cust-sat?dealerCode=XXX&period=YYYY-MM              -> เฉลี่ยคะแนนย่อยของเดือนนั้น
 * - GET /api/cust-sat?dealerCode=XXX&period=YYYY-MM&mode=reviews -> รายรีวิว (ตัด PII)
 */
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period")?.trim() || null;
  const mode = req.nextUrl.searchParams.get("mode")?.trim() || null;
  const scope = await resolveScope(req.nextUrl.searchParams.get("dealerCode")?.trim() || null, null);
  if (!scope.ok) return scope.res;
  const { dealerCode } = scope;
  try {
    const sb = createServiceClient();
    if (period && mode === "reviews") {
      const { data, error } = await sb.rpc("cust_sat_reviews", {
        p_period: period,
        p_dealer: dealerCode,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    if (period) {
      const { data, error } = await sb.rpc("cust_sat_month_lines", {
        p_period: period,
        p_dealer: dealerCode,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    const { data, error } = await sb.rpc("cust_sat_summary", { p_dealer: dealerCode });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
