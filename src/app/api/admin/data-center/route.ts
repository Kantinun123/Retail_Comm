import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/supabase/auth-context";

/**
 * ศูนย์ข้อมูล — สถานะ sync รายวัน + ความครบรายเดือน + ประวัติอัปโหลด
 * admin session จริงเท่านั้น (ไม่มีโหมดเดโม เพราะเป็นข้อมูลการดูแลระบบ)
 *
 * data_center_summary() อ่านหลายตารางใหญ่ — ครั้งแรกที่ข้อมูลไม่อยู่ใน cache ของ DB ใช้ได้ถึง ~10s
 * เกิน statement_timeout 8s ของ PostgREST -> อ่านจาก data_center_cache (pg_cron คำนวณทุก 5 นาที)
 * ?live=1 (ปุ่มโหลดใหม่) = ลองคำนวณสด ถ้าเกินเวลา/พัง ใช้ค่าที่เก็บไว้แทน
 */
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const sb = createServiceClient();

  if (req.nextUrl.searchParams.get("live") === "1") {
    const { data, error } = await sb.rpc("data_center_summary");
    if (!error && data) return NextResponse.json({ ...(data as object), cachedAt: null });
  }
  const { data: cache, error } = await sb.from("data_center_cache").select("payload, refreshed_at").eq("id", 1).maybeSingle();
  if (cache?.payload) return NextResponse.json({ ...(cache.payload as object), cachedAt: cache.refreshed_at });

  // ยังไม่มี cache (เช่น pg_cron ยังไม่รันครั้งแรก) -> คำนวณสด
  const live = await sb.rpc("data_center_summary");
  if (live.error) return NextResponse.json({ ok: false, error: live.error.message ?? error?.message }, { status: 500 });
  return NextResponse.json({ ...(live.data as object), cachedAt: null });
}
