import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MIN_PASSWORD_LENGTH } from "@/lib/supabase/temp-password";

/**
 * เปลี่ยนรหัสผ่านของตัวเอง (ต้องมี session จริง)
 * POST { newPassword } -> ตั้งรหัสใหม่ผ่าน service_role แล้วเคลียร์ must_change_password
 * (เคลียร์ฝั่ง server เฉพาะเมื่อเปลี่ยนรหัสสำเร็จจริง ผู้ใช้แก้ flag เองไม่ได้)
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user || user.is_anonymous) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: { newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const newPassword = String(body.newPassword ?? "");
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` },
      { status: 400 }
    );
  }

  const svc = createServiceClient();
  const { error } = await svc.auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  await svc.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
