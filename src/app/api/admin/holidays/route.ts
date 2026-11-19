import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";

/** วันหยุดที่ไม่นับเป็นวันทำการ (SLA ห้องแบบ BOQ) — admin session จริงเท่านั้น
 *  GET  -> รายการวันหยุดตั้งแต่ปีที่แล้ว
 *  POST { action: "add", day: "YYYY-MM-DD", name } | { action: "remove", day } */
async function guard() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const from = `${new Date().getFullYear() - 1}-01-01`;
  const { data, error } = await createServiceClient().from("business_holidays").select("day, name").gte("day", from).order("day");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, holidays: data });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const b = (await req.json().catch(() => null)) as { action?: string; day?: string; name?: string } | null;
  const day = b?.day ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return NextResponse.json({ ok: false, error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  const sb = createServiceClient();
  if (b?.action === "add") {
    const name = (b.name ?? "").trim().slice(0, 100);
    if (!name) return NextResponse.json({ ok: false, error: "กรุณาใส่ชื่อวันหยุด" }, { status: 400 });
    const { error } = await sb.from("business_holidays").upsert({ day, name }, { onConflict: "day" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (b?.action === "remove") {
    const { error } = await sb.from("business_holidays").delete().eq("day", day);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
