import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/supabase/auth-context";

/** จำนวนงานที่รอ admin ดำเนินการ (ตัวเลขบนการ์ด/กระดิ่ง) — admin session จริงเท่านั้น */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const sb = createServiceClient();
  const [signups, resets, employees] = await Promise.all([
    sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .not("requested_dealer_code", "is", null),
    sb
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    sb
      .from("employee_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  if (signups.error || resets.error || employees.error) {
    return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, signups: signups.count ?? 0, resets: resets.count ?? 0, employees: employees.count ?? 0 });
}
