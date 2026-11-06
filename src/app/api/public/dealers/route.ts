import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/** รายชื่อร้านที่เปิดใช้งาน (เฉพาะรหัส/ชื่อ/จังหวัด) สำหรับหน้าสมัครร้านค้า — ไม่ต้อง login */
export async function GET() {
  try {
    const { data, error } = await createServiceClient()
      .from("dealers")
      .select("code, name, province, is_active")
      .order("name");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const dealers = (data ?? [])
      .filter((d) => d.is_active !== false)
      .map((d) => ({ code: d.code as string, name: d.name as string, province: (d.province as string | null) ?? null }));
    return NextResponse.json({ ok: true, dealers });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "server error" }, { status: 500 });
  }
}
