import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { validatePayload } from "@/lib/commission/employee-request-shared";

/**
 * Admin อนุมัติ / ไม่อนุมัติ คำขอเพิ่มพนักงาน (session จริงที่ role = admin เท่านั้น)
 * - POST { id, action: 'approve', payload?, dealerCode?, systemIds?: { netsuiteId, baAppId, diId } }
 *     -> จองคำขอ (pending -> approved) ก่อน แล้วสร้าง sale_reps (SR####) ; สร้างไม่สำเร็จ = คืนสถานะ pending
 * - POST { id, action: 'reject', reason }  (ต้องมีเหตุผล — ผู้แจ้งเห็น)
 */

type Sb = ReturnType<typeof createServiceClient>;

async function nextRepCode(sb: Sb): Promise<string> {
  const { data } = await sb.from("sale_reps").select("rep_code").like("rep_code", "SR%").order("rep_code", { ascending: false }).limit(1);
  const last = data?.[0]?.rep_code as string | undefined;
  const n = last ? parseInt(last.replace(/\D/g, ""), 10) || 0 : 0;
  return `SR${String(n + 1).padStart(4, "0")}`;
}

/** รับเฉพาะรูปใน bucket ของเรา (รูปแนบคำขอ / รูปพนักงานเดิม) */
function safePhoto(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return s.startsWith(`${base}/storage/v1/object/public/employee-photos/`) ? s : null;
}

const clean = (v: unknown, max: number) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const id = Number(body.id);
  const action = String(body.action ?? "");
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  const sb = createServiceClient();
  const { data: row } = await sb.from("employee_requests").select("id, status, dealer_code, payload, photo_url").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ ok: false, error: "ไม่พบคำขอ" }, { status: 404 });
  if (row.status !== "pending") return NextResponse.json({ ok: false, error: "คำขอนี้ดำเนินการไปแล้ว" }, { status: 409 });
  const now = new Date().toISOString();

  if (action === "reject") {
    const reason = clean(body.reason, 300);
    if (!reason) return NextResponse.json({ ok: false, error: "กรุณาใส่เหตุผลที่ไม่อนุมัติ" }, { status: 400 });
    const { data: upd, error } = await sb
      .from("employee_requests")
      .update({ status: "rejected", reject_reason: reason, reviewed_by: ctx.userId, reviewed_at: now, updated_at: now })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!upd?.length) return NextResponse.json({ ok: false, error: "คำขอนี้ดำเนินการไปแล้ว" }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (action !== "approve") return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });

  // admin แก้ข้อมูลก่อนอนุมัติได้ (ส่ง payload / dealerCode มาใหม่)
  const v = validatePayload(body.payload ?? row.payload);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const p = v.payload;
  const dealerCode = clean(body.dealerCode, 20) ?? (row.dealer_code as string);
  const { data: dealer } = await sb.from("dealers").select("code, name, model, is_active").eq("code", dealerCode).maybeSingle();
  if (!dealer) return NextResponse.json({ ok: false, error: "ไม่พบร้าน" }, { status: 400 });
  const ids = (body.systemIds ?? {}) as Record<string, unknown>;

  // จองคำขอก่อน กันกดอนุมัติซ้ำ / admin 2 คนกดพร้อมกัน
  const { data: claimed } = await sb
    .from("employee_requests")
    .update({ status: "approved", reviewed_by: ctx.userId, reviewed_at: now, updated_at: now, dealer_code: dealerCode, payload: p })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return NextResponse.json({ ok: false, error: "คำขอนี้ดำเนินการไปแล้ว" }, { status: 409 });

  const rep = {
    name: p.name,
    nickname: p.nickname,
    position: p.position === "other" ? null : p.position,
    level: p.level,
    phone: p.phone,
    email: p.email,
    line_id: p.lineId,
    birth_date: p.birthDate,
    start_date: p.startDate,
    education: p.education,
    major: p.major,
    notes: p.notes,
    photo_url: "photoUrl" in body ? safePhoto(body.photoUrl) : row.photo_url,
    dealer_code: dealer.code,
    dealer_name: dealer.name,
    dealer_model: dealer.model,
    status: "Active",
    is_active: true,
    skills: [] as string[],
    netsuite_id: clean(ids.netsuiteId, 40),
    ba_app_id_1: clean(ids.baAppId, 40),
    di_id: clean(ids.diId, 40),
  };

  // เลขรหัสอาจชนถ้ามีการสร้างพร้อมกัน -> ลองใหม่สูงสุด 3 ครั้ง
  let repCode: string | null = null;
  let lastErr = "";
  for (let i = 0; i < 3 && !repCode; i++) {
    const code = await nextRepCode(sb);
    const { error } = await sb.from("sale_reps").insert({ rep_code: code, ...rep });
    if (!error) repCode = code;
    else if (error.code !== "23505") {
      lastErr = error.message;
      break;
    } else lastErr = error.message;
  }
  if (!repCode) {
    await sb.from("employee_requests").update({ status: "pending", reviewed_by: null, reviewed_at: null, updated_at: now }).eq("id", id);
    return NextResponse.json({ ok: false, error: `สร้างพนักงานไม่สำเร็จ: ${lastErr}` }, { status: 500 });
  }
  await sb.from("employee_requests").update({ created_rep_code: repCode }).eq("id", id);
  return NextResponse.json({ ok: true, repCode });
}
