import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { BOQ_BUCKET, canViewRequest } from "@/lib/server/boq";

/** เปิด/ดาวน์โหลดไฟล์แนบ BOQ: ตรวจสิทธิ์ตามคำขอ แล้ว redirect ไป signed URL (อายุ 5 นาที) */
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const download = url.searchParams.get("download") === "1";
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  const sb = createServiceClient();
  const { data: f } = await sb.from("boq_files").select("path, name, request_id").eq("id", id).maybeSingle();
  if (!f) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const { data: r } = await sb.from("boq_requests").select("rep_code, dealer_code, is_test").eq("id", f.request_id).maybeSingle();
  if (!r || !canViewRequest(ctx, r as { rep_code: string; dealer_code: string; is_test: boolean })) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await sb.storage
    .from(BOQ_BUCKET)
    .createSignedUrl(f.path as string, 300, download ? { download: f.name as string } : undefined);
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "sign failed" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl, 302);
}
