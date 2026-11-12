import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { REAL_AUTH } from "@/lib/supabase/api-scope";
import { canAccessDealer, getAuthContext } from "@/lib/supabase/auth-context";

/**
 * ยอดขายสินค้า (DI = Housing Expert, Odoo = SCG Home) — สรุปรายเดือน × กลุ่มสินค้า × พนักงาน
 * - GET /api/product-sales                          -> ทุกร้าน (admin) + แยกรายร้าน + ไม่ระบุร้าน
 * - GET /api/product-sales?source=di|odoo           -> เฉพาะแหล่ง (แท็บของ admin)
 * - GET /api/product-sales?dealerCode=XXX           -> ร้านเดียว + แยกรายพนักงาน
 * - GET /api/product-sales?dealerCode=XXX&salesperson=ชื่อ -> พนักงานขายในไฟล์ที่ไม่ได้อยู่ในระบบ
 * - GET /api/product-sales?repCode=SR0001           -> เฉพาะยอดที่พนักงานคนนั้นขาย
 * - มี session จริง: พนักงาน (sales) ถูกบังคับให้เห็นเฉพาะ repCode ของตัวเอง ; ร้านเห็นเฉพาะร้านตัวเอง
 *   ไม่มี session (เดโม) -> พฤติกรรมเดิมของแอป
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  let dealerCode = sp.get("dealerCode")?.trim() || null;
  let repCode = sp.get("repCode")?.trim() || null;
  let salesperson = sp.get("salesperson")?.trim() || null;
  const sourceRaw = sp.get("source")?.trim() || null;
  const source = sourceRaw === "di" || sourceRaw === "odoo" ? sourceRaw : null;
  if (salesperson && !dealerCode) {
    return NextResponse.json({ ok: false, error: "salesperson requires dealerCode" }, { status: 400 });
  }
  try {
    const ctx = await getAuthContext();
    // โหมด login จริง: ไม่มี session = ปฏิเสธ (เดิมปล่อยผ่านแบบเดโม)
    if (!ctx && REAL_AUTH) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    if (ctx) {
      if (ctx.role === "sales") {
        // พนักงานเห็นเฉพาะยอดที่ตัวเองขาย (เหมือนผลประโยชน์อื่น)
        if (!ctx.repCode) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        repCode = ctx.repCode;
        dealerCode = null;
        salesperson = null;
      } else {
        if (dealerCode && !canAccessDealer(ctx, dealerCode)) {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
        if (!dealerCode && ctx.allowedDealerCodes !== "all") {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
      }
    }

    const { data, error } = await createServiceClient().rpc("product_sales_summary", {
      p_source: source,
      p_dealer: dealerCode,
      p_rep: repCode,
      p_salesperson: salesperson,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    // lite=1 (การ์ดหน้าหลัก): ส่งเฉพาะยอดรายเดือน ลดขนาดข้อมูล
    if (sp.get("lite") === "1" && data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      return NextResponse.json({ ok: d.ok, sources: d.sources, months: d.months, updated_at: d.updated_at, latest_date: d.latest_date });
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
