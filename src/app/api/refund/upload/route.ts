import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { safeFileName } from "@/lib/server/boq";
import { DOC_KINDS, REFUND_BUCKET, refundRoleOf } from "@/lib/server/refund";
const MAX = 10 * 1024 * 1024;
const MIME_OK = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
/**
 * ขอ URL อัปโหลดไฟล์ตรงเข้า Storage (ไม่ผ่าน Vercel)
 * POST { kind, name, size, mime, requestId? }
 * - ไม่มี requestId: เอกสารตอนสร้างคำขอ (พนักงานขาย) -> tmp/<userId>/...
 * - มี requestId: เจ้าของคำขอแนบเอกสารใหม่ตอนแก้ (ตีกลับ / Finance แจ้งแก้) -> tmp/<userId>/... แล้วย้ายตอนบันทึก
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { kind?: string; name?: string; size?: number; mime?: string; requestId?: number } | null;
  const kind = b?.kind ?? "";
  const name = String(b?.name ?? "").slice(0, 200);
  const size = Number(b?.size ?? 0);
  const mime = b?.mime || "application/octet-stream";
  const revised = kind === "revised_receipt";
  if (!(DOC_KINDS as readonly string[]).includes(kind) && !revised) return NextResponse.json({ ok: false, error: "bad kind" }, { status: 400 });
  if (!name || !(size > 0)) return NextResponse.json({ ok: false, error: "ไฟล์ไม่ถูกต้อง" }, { status: 400 });
  if (size > MAX) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกิน 10MB" }, { status: 400 });
  if (!MIME_OK.test(mime)) return NextResponse.json({ ok: false, error: "แนบได้เฉพาะรูปภาพหรือ PDF" }, { status: 400 });
  const sb = createServiceClient();
  if (revised) {
    // บัญชีแนบใบเสร็จ / ใบกำกับภาษีฉบับแก้ไข ตอนบันทึกวันโอน (เฉพาะคืนภาษีหัก ณ ที่จ่าย)
    const { data: r } = b?.requestId ? await sb.from("refund_requests").select("status, refund_type, is_test").eq("id", b.requestId).maybeSingle() : { data: null };
    if (refundRoleOf(ctx) !== "accounting" || !r || r.status !== "pending_transfer" || r.refund_type !== "wht" || !!r.is_test !== ctx.isTest) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  } else if (refundRoleOf(ctx) !== "sales") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (!revised && b?.requestId) {
    const { data: r } = await sb.from("refund_requests").select("requester_id, status").eq("id", b.requestId).maybeSingle();
    if (!r || r.requester_id !== ctx.userId || !["returned", "finance_returned"].includes(r.status as string)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const path = `tmp/${ctx.userId}/${randomUUID()}-${safeFileName(name)}`;
  const { data, error } = await sb.storage.from(REFUND_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "upload url failed" }, { status: 500 });
  return NextResponse.json({ ok: true, path: data.path, token: data.token });
}