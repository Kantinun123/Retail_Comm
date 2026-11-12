import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { REAL_AUTH } from "@/lib/supabase/api-scope";
import { canAccessDealer, getAuthContext } from "@/lib/supabase/auth-context";

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
    // มี session จริง (Microsoft/email) -> บังคับขอบเขตร้านฝั่ง server ; ไม่มี (เดโม) -> พฤติกรรมเดิม
    const ctx = await getAuthContext();
    // โหมด login จริง: ไม่มี session = ปฏิเสธ (เดิมปล่อยผ่านแบบเดโม)
    if (!ctx && REAL_AUTH) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

    if (mode === "roster") {
      if (!dealerCode) {
        return NextResponse.json(
          { ok: false, error: "ต้องระบุ dealerCode" },
          { status: 400 }
        );
      }
      if (ctx && !canAccessDealer(ctx, dealerCode)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
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
    const stores =
      ctx && ctx.allowedDealerCodes !== "all"
        ? (data as { code: string }[]).filter((s) =>
            (ctx.allowedDealerCodes as string[]).includes(s.code)
          )
        : data;
    return NextResponse.json({ ok: true, stores });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
