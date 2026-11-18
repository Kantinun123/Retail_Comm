import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";

/** รายการสินค้าที่เลือกได้ในฟอร์มขอ BOQ + เหตุผล Loss (ต้อง login จริง) */
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const line = new URL(req.url).searchParams.get("line") || "decaar";
  const sb = createServiceClient();
  const [p, l] = await Promise.all([
    sb.from("boq_products").select("code, name, grp, sub, size, unit").eq("line", line).eq("is_active", true).order("sort"),
    sb.from("boq_loss_reasons").select("code, label").eq("is_active", true).order("sort"),
  ]);
  if (p.error || l.error) return NextResponse.json({ ok: false, error: (p.error ?? l.error)?.message }, { status: 500 });
  // ผู้บันทึก (ข้อ 1-3 ของฟอร์ม): ร้าน + ชื่อ + อีเมลจากข้อมูลพนักงาน
  let recorder: { name: string; email: string | null; dealerCode: string; dealerName: string } | null = null;
  if (ctx.role === "sales" && ctx.repCode && ctx.dealerCode) {
    const [rep, dealer] = await Promise.all([
      sb.from("sale_reps").select("name, nickname, email").eq("rep_code", ctx.repCode).maybeSingle(),
      sb.from("dealers").select("name").eq("code", ctx.dealerCode).maybeSingle(),
    ]);
    recorder = {
      name: rep.data?.name ? (rep.data.nickname ? `${rep.data.name} (${rep.data.nickname})` : (rep.data.name as string)) : ctx.repCode,
      email: ((rep.data?.email as string | null) ?? "").trim() || null,
      dealerCode: ctx.dealerCode,
      dealerName: (dealer.data?.name as string | undefined) ?? ctx.dealerCode,
    };
  }
  return NextResponse.json({ ok: true, products: p.data, lossReasons: l.data, recorder });
}
