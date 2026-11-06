import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * ฐานข้อมูลพนักงาน + ร้านค้า (อ่าน)
 * - GET /api/employees?mode=stores               -> รายชื่อร้าน + จำนวนพนักงาน
 * - GET /api/employees?mode=roster&dealerCode=X  -> roster รายร้าน (พนักงาน + หัวหน้าที่ดูแล)
 *
 * อ่านผ่าน service-role (bypass RLS) — การ scope ตาม role ทำที่ชั้น UI/session
 * เหมือนฟีเจอร์ commission อื่น ๆ ในแอปนี้
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") || "stores";
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;

  try {
    const sb = createServiceClient();

    if (mode === "roster") {
      if (!dealerCode) {
        return NextResponse.json(
          { ok: false, error: "ต้องระบุ dealerCode" },
          { status: 400 }
        );
      }
      const { data, error } = await sb.rpc("store_roster", {
        p_dealer: dealerCode,
      });
      if (error)
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      return NextResponse.json({ ok: true, roster: data });
    }

    // mode = stores
    const { data, error } = await sb.rpc("store_list_with_counts");
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    return NextResponse.json({ ok: true, stores: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
