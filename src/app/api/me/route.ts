import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * ตัวตนของผู้ใช้ที่ login จริง (Microsoft / email) — ใช้ใน /auth/bridge
 * ตั้ง sessionStorage ฝั่ง client ให้ตรงกับ role + ขอบเขตร้านจากฐานข้อมูล
 * - 401: ไม่มี session จริง
 * - ok:false/pending: login แล้วแต่โปรไฟล์ยังรออนุมัติ
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    // แยกกรณี "login แล้วแต่ยังไม่อนุมัติ" ออกจาก "ไม่ได้ login"
    const { createClient } = await import("@/lib/supabase/server");
    const sb = await createClient();
    const { data } = await sb.auth.getUser();
    if (data.user && !data.user.is_anonymous) {
      return NextResponse.json({ ok: false, error: "pending" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let name: string | null = null;
  if (ctx.repCode) {
    const { data } = await createServiceClient()
      .from("sale_reps")
      .select("name")
      .eq("rep_code", ctx.repCode)
      .maybeSingle();
    name = (data?.name as string | undefined) ?? null;
  }

  return NextResponse.json({
    ok: true,
    me: {
      role: ctx.role,
      email: ctx.email,
      name,
      repCode: ctx.repCode,
      dealerCode: ctx.dealerCode,
      storeCodes: ctx.allowedDealerCodes === "all" ? null : ctx.allowedDealerCodes,
    },
  });
}
