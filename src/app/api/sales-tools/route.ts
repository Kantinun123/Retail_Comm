import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { REAL_AUTH } from "@/lib/supabase/api-scope";
import { loadSalesTools } from "@/lib/server/sales-tools";

/** บทบาทที่เห็นเครื่องมือช่วยขาย: Admin / Area / Coach / หัวหน้า Area / พนักงานขาย */
const ALLOWED = new Set(["admin", "area", "coach", "re", "area_head", "sales"]);

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx && REAL_AUTH) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx && !ALLOWED.has(ctx.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try {
    const { items, fetchedAt } = await loadSalesTools();
    return NextResponse.json({ ok: true, items, fetchedAt });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "โหลดไม่สำเร็จ" }, { status: 502 });
  }
}
