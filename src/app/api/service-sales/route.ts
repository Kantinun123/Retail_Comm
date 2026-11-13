import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { REAL_AUTH } from "@/lib/supabase/api-scope";
import { canAccessDealer, getAuthContext, repDealerIfAllowed } from "@/lib/supabase/auth-context";

/**
 * Service Sales API (ยอดขายงานบริการ)
 * รวม 2 แหล่งข้อมูล: 'rudy' (LHS/Rudy win_contract) + 'ba' (BA ร้านค้า รายวัน) ผ่าน view service_sales_union
 * ไม่ส่ง source = รวมทั้งสองแหล่ง ; repCode = เฉพาะงานของพนักงานคนนั้น
 *
 * - GET ?dealerCode=XXX                                   -> สรุปรวม + รายเดือน (ทุกปี)
 * - GET ?mode=groups&year=YYYY                            -> 3 กลุ่มใหญ่ + หมวดย่อยของปีนั้น
 * - GET ?mode=months&year=YYYY                            -> รายเดือน + 3 กลุ่ม (+หมวดย่อย) ใต้แต่ละเดือน
 * - GET ?mode=breakdown&year=YYYY                         -> รายพนักงาน (ร้านเดียว) / รายร้าน (ทุกร้าน)
 * - GET ?mode=jobs&period=YYYY-MM | year=YYYY [&group&sub&sales&unassigned=1&order=date&offset&limit] -> ราย job
 * - GET ?mode=sources&year=YYYY                           -> ยอดแยกตามแหล่ง (rudy/ba)
 *
 * dealerCode ว่าง (admin ทุกร้าน) -> รวมยอด "ไม่ระบุร้าน" ด้วย
 * มี session จริง: พนักงาน (sales) ถูกบังคับให้เห็นเฉพาะ repCode ของตัวเอง ; ร้านเห็นเฉพาะร้านตัวเอง
 * ไม่มี session (เดโม) -> ใช้ค่าจาก query ตามพฤติกรรมเดิมของแอป
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const get = (k: string) => sp.get(k)?.trim() || null;
  let dealerCode = get("dealerCode");
  let repCode = get("repCode");
  let sales = get("sales");
  const mode = get("mode");
  const year = get("year");
  const period = get("period");
  const group = get("group");
  const sub = get("sub");
  const srcRaw = get("source");
  const source = srcRaw === "rudy" || srcRaw === "ba" ? srcRaw : null;
  const unassigned = sp.get("unassigned") === "1";
  const order = get("order") === "date" ? "date" : "amount";
  const offset = Math.max(0, Number(sp.get("offset") ?? 0) || 0);
  const limit = Math.min(1000, Math.max(1, Number(sp.get("limit") ?? 300) || 300));
  if (year && !/^\d{4}$/.test(year)) return NextResponse.json({ ok: false, error: "invalid year" }, { status: 400 });
  if (period && !/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ ok: false, error: "invalid period" }, { status: 400 });

  try {
    const ctx = await getAuthContext();
    // โหมด login จริง: ไม่มี session = ปฏิเสธ (เดิมปล่อยผ่านแบบเดโม)
    if (!ctx && REAL_AUTH) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    if (ctx) {
      if (ctx.role === "sales") {
        // พนักงานเห็นเฉพาะงานที่ตัวเองขาย (เหมือนผลประโยชน์อื่น)
        if (!ctx.repCode) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        repCode = ctx.repCode;
        dealerCode = null;
        sales = null;
      } else if (repCode && ctx.allowedDealerCodes !== "all") {
        // ร้าน / Area / Coach ดูพนักงานรายคน: ต้องเป็นพนักงานในร้านที่เข้าถึงได้ -> เห็นงานทั้งหมดของคนนั้น
        if (!(await repDealerIfAllowed(ctx, repCode, dealerCode))) {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
        dealerCode = null;
        sales = null;
      } else {
        if (dealerCode && !canAccessDealer(ctx, dealerCode)) {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
        if (!dealerCode && ctx.allowedDealerCodes !== "all") {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
      }
    }

    const sb = createServiceClient();
    const call = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await sb.rpc(fn, args);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json(data);
    };

    if (mode === "sources") return call("service_sales_sources", { p_dealer: dealerCode, p_year: year, p_rep: repCode });
    if (mode === "groups") return call("service_sales_groups", { p_dealer: dealerCode, p_year: year, p_source: source, p_rep: repCode });
    if (mode === "months") return call("service_sales_month_groups", { p_dealer: dealerCode, p_year: year, p_source: source, p_rep: repCode });
    if (mode === "breakdown") {
      // รายพนักงานไม่มีความหมายในมุมมองพนักงานคนเดียว
      if (repCode) return NextResponse.json({ ok: true, people: [], stores: [] });
      return call("service_sales_breakdown", { p_dealer: dealerCode, p_year: year, p_source: source });
    }
    if (mode === "jobs") {
      if (!period && !year) return NextResponse.json({ ok: false, error: "period or year required" }, { status: 400 });
      if (sales && !dealerCode) return NextResponse.json({ ok: false, error: "sales requires dealerCode" }, { status: 400 });
      return call("service_sales_jobs", {
        p_dealer: dealerCode,
        p_period: period,
        p_group: group,
        p_source: source,
        p_year: period ? null : year,
        p_sub_group: sub,
        p_rep: repCode,
        p_sales: sales,
        p_unassigned: unassigned,
        p_order: order,
        p_limit: limit,
        p_offset: offset,
      });
    }
    return call("service_sales_summary", { p_dealer: dealerCode, p_source: source, p_rep: repCode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
