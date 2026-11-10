import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canAccessDealer, getAuthContext } from "@/lib/supabase/auth-context";

/**
 * แบบรับเข้า (Material / Solution) จาก CRM Opportunity
 * - GET /api/design-intake                    -> ทุกร้าน (admin) + แยกรายร้าน
 * - GET /api/design-intake?dealerCode=XXX     -> ร้านเดียว + แยกรายพนักงาน
 * - GET /api/design-intake?repCode=SR0001     -> เฉพาะพนักงานคนนั้น
 * - มี session จริง -> บังคับขอบเขตร้าน ; ไม่มี (เดโม) -> พฤติกรรมเดิมของแอป
 */
export async function GET(req: NextRequest) {
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  const repCode = req.nextUrl.searchParams.get("repCode")?.trim() || null;
  try {
    const ctx = await getAuthContext();
    if (ctx) {
      if (dealerCode && !canAccessDealer(ctx, dealerCode)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      if (!dealerCode && !repCode && ctx.allowedDealerCodes !== "all") {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
    }
    const { data, error } = await createServiceClient().rpc("design_intake_summary", {
      p_dealer: dealerCode,
      p_rep: repCode,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
