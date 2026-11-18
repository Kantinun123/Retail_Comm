import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { BOQ_BUCKET, boqRoleOf, safeFileName } from "@/lib/server/boq";

const MAX = 50 * 1024 * 1024;
const MIME_OK = /^(image\/(jpeg|png|webp|heic|heif)|application\/(pdf|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel|zip|x-zip-compressed|octet-stream|vnd\.sketchup\.skp))$/;

/**
 * ขอ URL อัปโหลดไฟล์ตรงเข้า Storage (ไฟล์ไม่ผ่าน Vercel -> ไม่ติดลิมิต 4.5MB)
 * POST { kind, name, size, mime, requestId? }
 * - ไม่มี requestId: ไฟล์แนบตอนสร้างคำขอ (photo/plan/old_design) ของพนักงานขาย -> tmp/<userId>/...
 * - มี requestId + kind boq/d3: ห้องแบบที่รับงานนั้น (สถานะกำลังทำ/ขอแก้ไข) -> req/<id>/<kind>/...
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { kind?: string; name?: string; size?: number; mime?: string; requestId?: number } | null;
  const kind = body?.kind ?? "";
  const name = String(body?.name ?? "").slice(0, 200);
  const size = Number(body?.size ?? 0);
  const mime = body?.mime || "application/octet-stream";
  if (!name || !(size > 0)) return NextResponse.json({ ok: false, error: "ไฟล์ไม่ถูกต้อง" }, { status: 400 });
  if (size > MAX) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกิน 50MB" }, { status: 400 });
  if (!MIME_OK.test(mime)) return NextResponse.json({ ok: false, error: "ชนิดไฟล์นี้อัปโหลดไม่ได้ (รูป, PDF, Excel, ZIP, SketchUp)" }, { status: 400 });

  const sb = createServiceClient();
  const role = boqRoleOf(ctx);
  let path: string;
  if (body?.requestId) {
    if (kind !== "boq" && kind !== "d3") return NextResponse.json({ ok: false, error: "bad kind" }, { status: 400 });
    const { data: r } = await sb.from("boq_requests").select("id, status, designer_id").eq("id", body.requestId).maybeSingle();
    if (!r || role !== "designer" || r.designer_id !== ctx.userId || !["working", "revise"].includes(r.status as string)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    path = `req/${r.id}/${kind}/${randomUUID()}-${safeFileName(name)}`;
  } else {
    if (!["photo", "plan", "old_design"].includes(kind)) return NextResponse.json({ ok: false, error: "bad kind" }, { status: 400 });
    if (role !== "sales") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    path = `tmp/${ctx.userId}/${randomUUID()}-${safeFileName(name)}`;
  }
  const { data, error } = await sb.storage.from(BOQ_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "upload url failed" }, { status: 500 });
  return NextResponse.json({ ok: true, path: data.path, token: data.token });
}
