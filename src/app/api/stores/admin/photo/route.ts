import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

/**
 * อัปโหลดรูปร้าน -> Supabase Storage (bucket: store-photos)
 * - POST /api/stores/admin/photo  (multipart: dealerCode, file)
 * - เขียนผ่าน service-role แล้วอัปเดต dealers.photo_url ; คืน public URL
 * - ฝั่งเบราว์เซอร์ย่อรูปเป็น JPEG ก่อนส่ง (ดู uploadStorePhoto) แต่ API รับ JPG/PNG/WEBP เผื่อเรียกตรง
 */

const BUCKET = "store-photos";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ALL_EXT = ["jpg", "png", "webp"];

async function verifyAdmin(): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NEXT_PUBLIC_REAL_AUTH !== "1") return { ok: true };
  const sb = await createServerAuthClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthenticated" };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, status")
    .eq("id", auth.user.id)
    .single();
  if (!profile || profile.status !== "approved" || profile.role !== "admin") {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid form data" }, { status: 400 });
  }

  const dealerCode = String(form.get("dealerCode") ?? "").trim();
  const file = form.get("file");
  if (!dealerCode)
    return NextResponse.json({ ok: false, error: "missing dealerCode" }, { status: 400 });
  // รหัสร้านเป็นตัวเลขล้วน ใช้เป็นชื่อไฟล์ — กัน path แปลกๆ
  if (!/^[0-9A-Za-z_-]+$/.test(dealerCode))
    return NextResponse.json({ ok: false, error: "รหัสร้านไม่ถูกต้อง" }, { status: 400 });
  if (!(file instanceof File))
    return NextResponse.json({ ok: false, error: "ไม่พบไฟล์รูป" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext)
    return NextResponse.json({ ok: false, error: "รองรับเฉพาะ JPG / PNG / WEBP" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ ok: false, error: "ไฟล์รูปใหญ่เกินไป (จำกัด 5MB)" }, { status: 400 });

  try {
    const sb = createServiceClient();

    // ต้องเป็นร้านที่มีอยู่จริง
    const { data: dealer, error: dErr } = await sb
      .from("dealers")
      .select("code")
      .eq("code", dealerCode)
      .maybeSingle();
    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
    if (!dealer) return NextResponse.json({ ok: false, error: "ไม่พบร้านนี้" }, { status: 404 });

    const path = `${dealerCode}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    // ลบไฟล์เก่าที่นามสกุลอื่นของร้านเดียวกัน (ไม่ให้ตกค้าง) — ล้มเหลวไม่เป็นไร
    const stale = ALL_EXT.filter((e) => e !== ext).map((e) => `${dealerCode}.${e}`);
    await sb.storage.from(BUCKET).remove(stale);

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`; // cache-bust: path เดิมแต่รูปใหม่ต้องแสดงทันที

    const { error: updErr } = await sb.from("dealers").update({ photo_url: url }).eq("code", dealerCode);
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
