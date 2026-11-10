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
    // รายการแบบ (job) ของเดือนเดียว — ไม่มีข้อมูลลูกค้า (ไม่ได้เก็บไว้)
    const period = req.nextUrl.searchParams.get("period")?.trim() || null;
    if (req.nextUrl.searchParams.get("mode") === "jobs") {
      if (!period || !/^\d{4}-\d{2}$/.test(period)) {
        return NextResponse.json({ ok: false, error: "invalid period" }, { status: 400 });
      }
      const LIMIT = 1000;
      const sb = createServiceClient();
      let q = sb
        .from("design_intake_lines")
        .select(
          "opp_id, created_date, dealer_code, store_group_name, design_type, service_category, service_sub_solution, product_sub_solution, stage, reason, origin, sub_origin, rep_code, creator, expected_product, expected_service, rudy_id",
          { count: "exact" }
        )
        .eq("period", period)
        .not("design_type", "is", null)
        .order("created_date", { ascending: false })
        .order("opp_id", { ascending: false })
        .limit(LIMIT); // Supabase ตัดที่ 1,000 แถวอยู่แล้ว ใช้ count เพื่อรู้ว่าถูกตัดหรือไม่
      if (dealerCode) q = q.eq("dealer_code", dealerCode);
      if (repCode) q = q.eq("rep_code", repCode);
      const { data: jobs, error: jErr, count } = await q;
      if (jErr) return NextResponse.json({ ok: false, error: jErr.message }, { status: 500 });
      const rows = jobs ?? [];
      const truncated = (count ?? rows.length) > rows.length;
      const repCodes = [...new Set(rows.map((r) => r.rep_code).filter(Boolean))] as string[];
      const dealerCodes = [...new Set(rows.map((r) => r.dealer_code).filter(Boolean))] as string[];
      const [{ data: reps }, { data: ds }] = await Promise.all([
        repCodes.length
          ? sb.from("sale_reps").select("rep_code, name, nickname").in("rep_code", repCodes)
          : Promise.resolve({ data: [] as { rep_code: string; name: string; nickname: string | null }[] }),
        dealerCodes.length && !dealerCode
          ? sb.from("dealers").select("code, name").in("code", dealerCodes)
          : Promise.resolve({ data: [] as { code: string; name: string }[] }),
      ]);
      const repName = new Map((reps ?? []).map((r) => [r.rep_code, r.nickname ? `${r.name} (${r.nickname})` : r.name]));
      const dealerName = new Map((ds ?? []).map((d) => [d.code, d.name]));
      return NextResponse.json({
        ok: true,
        truncated,
        total: count ?? rows.length,
        jobs: rows.map((r) => ({
          ...r,
          rep_name: r.rep_code ? repName.get(r.rep_code) ?? null : null,
          dealer_name: r.dealer_code ? dealerName.get(r.dealer_code) ?? null : r.store_group_name,
          creator: r.rep_code ? null : r.creator, // แสดงชื่อผู้สร้างใน CRM เฉพาะกรณีจับคู่พนักงานไม่ได้
        })),
      });
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
