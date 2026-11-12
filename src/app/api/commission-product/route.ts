import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveScope } from "@/lib/supabase/api-scope";

/**
 * Commission Product API (ฝั่งพนักงาน/vendor, server-authoritative)
 * - GET /api/commission-product?dealerCode=XXX             -> สรุปต่อเดือน
 * - GET /api/commission-product?dealerCode=XXX&period=YYYY-MM -> รายบรรทัดเดือนนั้น (drill-down)
 * dealerCode ว่าง = ทุกร้าน (admin)
 */

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period")?.trim() || null;
  const scope = await resolveScope(
    req.nextUrl.searchParams.get("dealerCode")?.trim() || null,
    req.nextUrl.searchParams.get("repCode")?.trim() || null,
    { perRep: true }
  );
  if (!scope.ok) return scope.res;
  const { dealerCode, repCode } = scope;

  try {
    const sb = createServiceClient();
    if (period) {
      const { data, error } = await sb.rpc("commission_product_month_lines", {
        p_period: period,
        p_dealer: dealerCode,
        p_rep: repCode,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    const { data, error } = await sb.rpc("commission_product_summary", { p_dealer: dealerCode, p_rep: repCode });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
