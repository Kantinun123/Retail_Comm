import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";

/**
 * อัปโหลดรูปพนักงาน -> Supabase Storage (bucket: employee-photos)
 * - POST /api/employees/admin/photo  (multipart: repCode, file)
 * - เขียนผ่าน service-role (bypass RLS) แล้วอัปเดต sale_reps.photo_url
 * - คืน public URL
 */

const BUCKET = "employee-photos";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

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
  if (!adm.ok)
    return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid form data" },
      { status: 400 }
    );
  }

  const repCode = String(form.get("repCode") ?? "").trim();
  const file = form.get("file");
  if (!repCode)
    return NextResponse.json(
      { ok: false, error: "missing repCode" },
      { status: 400 }
    );
  if (!(file instanceof File))
    return NextResponse.json(
      { ok: false, error: "ไม่พบไฟล์รูป" },
      { status: 400 }
    );
  if (!ALLOWED.has(file.type))
    return NextResponse.json(
      { ok: false, error: "รองรับเฉพาะ JPG / PNG / WEBP / GIF" },
      { status: 400 }
    );
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { ok: false, error: "ไฟล์รูปใหญ่เกินไป (จำกัด 5MB)" },
      { status: 400 }
    );

  try {
    const sb = createServiceClient();
    const ext = EXT[file.type] || "jpg";
    // path คงที่ต่อ repCode -> อัปรูปใหม่ทับของเดิม (upsert)
    const path = `${repCode}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });
    if (upErr)
      return NextResponse.json(
        { ok: false, error: upErr.message },
        { status: 500 }
      );

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    // cache-bust เพื่อให้รูปใหม่แสดงทันทีแม้ path เดิม
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updErr } = await sb
      .from("sale_reps")
      .update({ photo_url: url })
      .eq("rep_code", repCode);
    if (updErr)
      return NextResponse.json(
        { ok: false, error: updErr.message },
        { status: 500 }
      );

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * ลบรูปพนักงาน
 * - DELETE /api/employees/admin/photo?repCode=SR0001
 * - ลบไฟล์ใน bucket (ทุกนามสกุลที่เป็นไปได้ของ repCode) แล้วตั้ง sale_reps.photo_url = null
 */
export async function DELETE(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok)
    return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  const repCode = req.nextUrl.searchParams.get("repCode")?.trim() ?? "";
  // รหัสพนักงานรูปแบบ SR#### เท่านั้น กันการลบไฟล์อื่นใน bucket
  if (!/^SR\d{3,6}$/.test(repCode))
    return NextResponse.json({ ok: false, error: "invalid repCode" }, { status: 400 });

  try {
    const sb = createServiceClient();
    const paths = Object.values(EXT).map((ext) => `${repCode}.${ext}`);
    const { error: rmErr } = await sb.storage.from(BUCKET).remove(paths);
    if (rmErr)
      return NextResponse.json({ ok: false, error: rmErr.message }, { status: 500 });

    const { error: updErr } = await sb
      .from("sale_reps")
      .update({ photo_url: null })
      .eq("rep_code", repCode);
    if (updErr)
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
