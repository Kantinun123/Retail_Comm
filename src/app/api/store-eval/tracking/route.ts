import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { bangkokToday, buildTracking, totalsOf } from "@/lib/server/eval-tracking";

/**
 * ติดตามการตรวจประเมินร้านรายเดือน
 * - GET ?period=YYYY-MM (ว่าง = เดือนปัจจุบัน)
 *     admin / หัวหน้า Area: ทุกร้าน ; Area: ร้านที่ดูแล ; Coach: ร้านของตัวเอง
 * - PATCH { submissionId } (admin): เลือกครั้งที่นับเป็นคะแนนของเดือน เมื่อร้านตรวจซ้ำ
 */
const ROLES = new Set(["admin", "area_head", "area", "coach", "re"]);

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!ROLES.has(ctx.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams.get("period") ?? bangkokToday().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(p)) return NextResponse.json({ ok: false, error: "invalid period" }, { status: 400 });
  const scope = ctx.allowedDealerCodes === "all" || ctx.role === "area_head" ? null : ctx.allowedDealerCodes;
  try {
    const t = await buildTracking(createServiceClient(), p, scope);
    // Coach: เห็นเฉพาะกลุ่มของตัวเอง (ร้านที่ผูกกับ Coach คนอื่นในร้านร่วม ไม่แสดง)
    if ((ctx.role === "coach" || ctx.role === "re") && ctx.repCode) {
      t.coaches = t.coaches.filter((c) => c.repCode === ctx.repCode);
      t.totals = totalsOf(t.coaches.flatMap((c) => c.stores));
    }
    return NextResponse.json({ ok: true, ...t, me: { role: ctx.role, repCode: ctx.repCode } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  let body: { submissionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const sid = String(body.submissionId ?? "").trim();
  if (!sid) return NextResponse.json({ ok: false, error: "missing submissionId" }, { status: 400 });
  const sb = createServiceClient();
  const { data: row } = await sb.from("store_eval_lines").select("submission_id, dealer_code, period").eq("submission_id", sid).maybeSingle();
  if (!row?.dealer_code) return NextResponse.json({ ok: false, error: "ไม่พบผลการตรวจ" }, { status: 404 });
  // ครั้งอื่นของร้านเดียวกันในเดือนเดียวกัน = ไม่นับ ; ครั้งที่เลือก = นับ
  const { error: e1 } = await sb.from("store_eval_lines").update({ is_primary: false }).eq("dealer_code", row.dealer_code).eq("period", row.period).neq("submission_id", sid);
  const { error: e2 } = await sb.from("store_eval_lines").update({ is_primary: true }).eq("submission_id", sid);
  if (e1 || e2) return NextResponse.json({ ok: false, error: (e1 ?? e2)!.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
