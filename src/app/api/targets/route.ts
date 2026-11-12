import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { REAL_AUTH } from "@/lib/supabase/api-scope";
import { canAccessDealer, getAuthContext } from "@/lib/supabase/auth-context";

/**
 * Targets API — เป้า (TG) / ทำได้ (ACT) / ปีก่อน (LY) รายเดือนของปีที่เลือก
 * - GET ?kind=service_sales|design_intake&year=YYYY[&dealerCode=XXX]
 *   dealerCode ว่าง = ทุกร้าน HE / SCG Home ที่ยังเป็นตัวแทน (admin) + แยกรายร้าน
 * เป้าเป็นรายร้าน: พนักงาน (sales) ไม่มีเป้ารายคน -> คืน has_target = false
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const get = (k: string) => sp.get(k)?.trim() || null;
  const kind = get("kind");
  let dealerCode = get("dealerCode");
  const year = get("year");
  if (kind !== "service_sales" && kind !== "design_intake" && kind !== "product_sales") return NextResponse.json({ ok: false, error: "invalid kind" }, { status: 400 });
  if (year && !/^\d{4}$/.test(year)) return NextResponse.json({ ok: false, error: "invalid year" }, { status: 400 });

  try {
    const ctx = await getAuthContext();
    // โหมด login จริง: ไม่มี session = ปฏิเสธ (เดิมปล่อยผ่านแบบเดโม)
    if (!ctx && REAL_AUTH) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    if (ctx) {
      if (ctx.role === "sales") return NextResponse.json({ ok: true, kind, year, has_target: false, months: [], stores: [] });
      if (dealerCode && !canAccessDealer(ctx, dealerCode)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      if (!dealerCode && ctx.allowedDealerCodes !== "all") {
        // area / ร้านหลายสาขา: ต้องระบุร้าน
        if (Array.isArray(ctx.allowedDealerCodes) && ctx.allowedDealerCodes.length === 1) dealerCode = ctx.allowedDealerCodes[0];
        else return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
    }
    const { data, error } = await createServiceClient().rpc("sales_targets_compare", { p_kind: kind, p_dealer: dealerCode, p_year: year });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
