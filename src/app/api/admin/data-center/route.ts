import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/supabase/auth-context";

/**
 * ศูนย์ข้อมูล — สถานะ sync รายวัน + ความครบรายเดือน + ประวัติอัปโหลด
 * admin session จริงเท่านั้น (ไม่มีโหมดเดโม เพราะเป็นข้อมูลการดูแลระบบ)
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { data, error } = await createServiceClient().rpc("data_center_summary");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
