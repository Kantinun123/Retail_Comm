import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveScope } from "@/lib/supabase/api-scope";

/**
 * รายชื่อพนักงานขาย (sale_reps) สำหรับ login พนักงาน
 * - GET /api/sale-reps?dealerCode=XXX -> พนักงานในร้านนั้น (rep_code, cr_code, name)
 */
export async function GET(req: NextRequest) {
  const reqRep = req.nextUrl.searchParams.get("repCode")?.trim() || null;
  // โหมด real auth: ต้อง login + เห็นเฉพาะพนักงานในร้านที่เข้าถึงได้ (โหมดเดโมใช้ตอนเลือกพนักงานก่อน login)
  const scope = await resolveScope(req.nextUrl.searchParams.get("dealerCode")?.trim() || null, null);
  if (!scope.ok) return scope.res;
  const { ctx, dealerCode } = scope;
  // พนักงาน (sales) ดูได้เฉพาะตัวเอง ; ผู้ใช้อื่นที่ไม่ใช่ admin ค้นด้วย repCode ได้เฉพาะในร้านของตัวเอง (กรองด้วย dealerCode ด้านล่าง)
  const repCode = ctx?.role === "sales" ? ctx.repCode : reqRep;
  try {
    const sb = createServiceClient();
    let q = sb.from("sale_reps").select("rep_code, cr_code, name, dealer_code, dealer_name, dealer_model").order("name");
    if (repCode) q = q.eq("rep_code", repCode);
    // จำกัดในร้านที่ scope กำหนด — ยกเว้น admin/เดโม ที่ค้นด้วย repCode (ข้ามร้านได้)
    const unrestricted = !ctx || ctx.allowedDealerCodes === "all";
    if (dealerCode && !(repCode && unrestricted)) q = q.eq("dealer_code", dealerCode);
    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reps: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
