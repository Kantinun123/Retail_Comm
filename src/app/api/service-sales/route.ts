import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Service Sales API (ยอดขายงานบริการ — ฝั่งร้านค้า)
 * - GET /api/service-sales?dealerCode=XXX                          -> สรุปรวม + รายเดือน (ทุกปี)
 * - GET /api/service-sales?dealerCode=XXX&mode=groups&year=YYYY    -> 3 กลุ่มใหญ่ + หมวดย่อยของปีนั้น
 * - GET /api/service-sales?dealerCode=XXX&mode=months&year=YYYY    -> รายเดือน + 3 กลุ่มใต้แต่ละเดือน
 * - GET /api/service-sales?dealerCode=XXX&mode=jobs&period=YYYY-MM&group=... -> ราย job
 *
 * dealerCode ว่าง (admin ทุกร้าน) -> รวมยอด "ไม่ระบุร้าน" ด้วย
 */
export async function GET(req: NextRequest) {
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  const mode = req.nextUrl.searchParams.get("mode")?.trim() || null;
  const year = req.nextUrl.searchParams.get("year")?.trim() || null;
  const period = req.nextUrl.searchParams.get("period")?.trim() || null;
  const group = req.nextUrl.searchParams.get("group")?.trim() || null;
  try {
    const sb = createServiceClient();
    if (mode === "groups") {
      const { data, error } = await sb.rpc("service_sales_groups", {
        p_dealer: dealerCode,
        p_year: year,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    if (mode === "months") {
      const { data, error } = await sb.rpc("service_sales_month_groups", {
        p_dealer: dealerCode,
        p_year: year,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    if (mode === "jobs") {
      const { data, error } = await sb.rpc("service_sales_jobs", {
        p_dealer: dealerCode,
        p_period: period,
        p_group: group,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }
    const { data, error } = await sb.rpc("service_sales_summary", { p_dealer: dealerCode });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
