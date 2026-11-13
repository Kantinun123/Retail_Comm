import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * อัปโหลดรูปพนักงานแนบคำขอ (ก่อนอนุมัติ) -> employee-photos/requests/<uuid>.jpg
 * - Area / Coach / หัวหน้า Area / Admin ; ย่อเป็น JPEG ที่เบราว์เซอร์แล้ว
 * - ชื่อไฟล์สุ่มฝั่ง server (ผู้ใช้กำหนด path เองไม่ได้)
 */
const ALLOWED_ROLES = new Set(["admin", "area", "coach", "re", "area_head"]);
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!ALLOWED_ROLES.has(ctx.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "ไม่พบไฟล์รูป" }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ ok: false, error: "รองรับเฉพาะ JPG / PNG / WEBP" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ ok: false, error: "ไฟล์รูปใหญ่เกินไป (จำกัด 5MB)" }, { status: 400 });

  const sb = createServiceClient();
  const path = `requests/${randomUUID()}.jpg`;
  const { error } = await sb.storage
    .from("employee-photos")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const { data } = sb.storage.from("employee-photos").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
