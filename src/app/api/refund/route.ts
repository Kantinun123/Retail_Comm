import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
/** ขอคืนเงินลูกค้า — เฟส 1: บอกบทบาท + สถานะการเปิดใช้ (REFUND_ENABLED=1 ใน Vercel) ; รายการคำขอมาในเฟส 2 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const team = ["finance", "accounting", "refund_approver"].includes(ctx.role);
  const role = team ? ctx.role : ctx.role === "sales" ? "sales" : ctx.role === "admin" ? "admin" : ["area", "coach", "re", "area_head"].includes(ctx.role) ? "area" : "viewer";
  return NextResponse.json({ ok: true, role, enabled: process.env.REFUND_ENABLED === "1" || ctx.isTest, items: [] });
}