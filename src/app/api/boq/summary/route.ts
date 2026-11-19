import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { buildSummary, parseFilters } from "@/lib/server/boq-summary";

/** ภาพรวม BOQ DECAAR ตามขอบเขตผู้ใช้ ; ?year=2026|all &month= &model= &region= &area= &dealer= */
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  try {
    const s = await buildSummary(createServiceClient(), ctx, parseFilters(req.nextUrl.searchParams));
    return NextResponse.json({ ok: true, ...s });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
