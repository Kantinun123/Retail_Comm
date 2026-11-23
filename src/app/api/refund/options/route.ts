import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { areaApprovers, autoApprover, refundRoleOf } from "@/lib/server/refund";
/** ข้อมูลประกอบฟอร์ม: ผู้ขอ (จากบัญชี) + ผู้อนุมัติของแต่ละกลุ่มงาน + รายชื่อ Area ให้เลือก (กรณีหา Area ของร้านไม่เจอ) */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (refundRoleOf(ctx) !== "sales" || !ctx.repCode) return NextResponse.json({ ok: false, error: "เฉพาะพนักงานขาย" }, { status: 403 });
  const sb = createServiceClient();
  const [rep, dealer, roof, metal, smart, areas] = await Promise.all([
    sb.from("sale_reps").select("name, nickname, email, phone").eq("rep_code", ctx.repCode).maybeSingle(),
    ctx.dealerCode ? sb.from("dealers").select("name").eq("code", ctx.dealerCode).maybeSingle() : Promise.resolve({ data: null }),
    autoApprover(sb, ctx, "roof"),
    autoApprover(sb, ctx, "metal"),
    autoApprover(sb, ctx, "smart"),
    areaApprovers(sb, ctx.isTest),
  ]);
  return NextResponse.json({
    ok: true,
    requester: {
      name: rep.data?.name ? (rep.data.nickname ? `${rep.data.name} (${rep.data.nickname})` : (rep.data.name as string)) : ctx.email ?? "-",
      email: (rep.data?.email as string | null) ?? ctx.email,
      phone: (rep.data?.phone as string | null) ?? null,
      unit: (dealer.data?.name as string | undefined) ?? null,
      dealerCode: ctx.dealerCode,
    },
    approvers: { roof, metal, smart },
    areas,
    enabled: process.env.REFUND_ENABLED === "1" || ctx.isTest,
  });
}