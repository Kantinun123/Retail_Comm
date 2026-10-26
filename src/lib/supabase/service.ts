import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client ด้วย service-role key — **ฝั่ง server เท่านั้น**
 * ข้าม RLS ทั้งหมด ใช้สำหรับ route handler / server action ที่ต้อง
 * เขียนข้อมูลแบบ authoritative (เช่น perform_checkin)
 *
 * - SUPABASE_SERVICE_ROLE_KEY ต้องไม่มี prefix NEXT_PUBLIC_ (ห้ามหลุดฝั่ง client)
 * - throw ถ้าถูกเรียกฝั่ง client โดยพลาด (service key จะไม่อยู่ใน browser env)
 */
export function createServiceClient() {
  if (typeof window !== "undefined") {
    throw new Error("createServiceClient must only be called on the server");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase service-role config (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
