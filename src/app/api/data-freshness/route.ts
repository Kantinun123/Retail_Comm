import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * ความสดของข้อมูลแต่ละแหล่ง: วันที่ล่าสุดในข้อมูล + เวลา sync สำเร็จล่าสุด + เดือนล่าสุดของไฟล์รายเดือน
 * ไม่มีข้อมูลธุรกิจ/ส่วนบุคคล (มีแค่วันที่) จึงให้ทุกบทบาทอ่านได้
 */
export async function GET() {
  const { data, error } = await createServiceClient().rpc("data_freshness");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
