import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * รายชื่อพนักงานขาย (sale_reps) สำหรับ login พนักงาน
 * - GET /api/sale-reps?dealerCode=XXX -> พนักงานในร้านนั้น (rep_code, cr_code, name)
 */
export async function GET(req: NextRequest) {
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  const repCode = req.nextUrl.searchParams.get("repCode")?.trim() || null;
  try {
    const sb = createServiceClient();
    let q = sb.from("sale_reps").select("rep_code, cr_code, name, dealer_code, dealer_name, dealer_model").order("name");
    if (repCode) q = q.eq("rep_code", repCode);
    else if (dealerCode) q = q.eq("dealer_code", dealerCode);
    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reps: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
