import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * อัปโหลดรูปของตัวเอง (หน้า "ฉัน") — Admin / หัวหน้า Area / Area / Coach
 * - POST multipart { file } (ย่อเป็น JPEG ที่เบราว์เซอร์แล้ว)
 * - area/coach/re  -> employee-photos/<rep_code>.jpg + sale_reps.photo_url
 * - admin/area_head -> employee-photos/profile-<user id>.jpg + profiles.photo_url
 */
const BUCKET = "employee-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const REP_ROLES = new Set(["area", "coach", "re"]);
const ALLOWED_ROLES = new Set(["admin", "area_head", "area", "coach", "re"]);

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
  if (!ALLOWED.has(file.type)) return NextResponse.json({ ok: false, error: "รองรับเฉพาะ JPG / PNG / WEBP" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "ไฟล์รูปใหญ่เกินไป (จำกัด 5MB)" }, { status: 400 });

  const isRep = REP_ROLES.has(ctx.role);
  if (isRep && !ctx.repCode) return NextResponse.json({ ok: false, error: "ไม่พบข้อมูลพนักงานของบัญชีนี้" }, { status: 400 });
  // path มาจาก session เท่านั้น (ผู้ใช้กำหนดเองไม่ได้)
  const path = isRep ? `${ctx.repCode}.jpg` : `profile-${ctx.userId}.jpg`;

  const sb = createServiceClient();
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`; // กันแคชรูปเก่า
  const { error } = isRep
    ? await sb.from("sale_reps").update({ photo_url: url }).eq("rep_code", ctx.repCode!)
    : await sb.from("profiles").update({ photo_url: url }).eq("id", ctx.userId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, url });
}
