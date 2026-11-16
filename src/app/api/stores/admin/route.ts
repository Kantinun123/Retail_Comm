import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerAuthClient } from "@/lib/supabase/server";
import { isStoreModel, modelFeatures } from "@/lib/commission/store-models";
import { bangkokToday } from "@/lib/server/eval-tracking";

/**
 * จัดการร้านค้า (admin)
 * - PATCH /api/stores/admin { code, isActive } -> เปิด/ปิดใช้งานร้าน (ไม่ลบจริง)
 *
 * เขียนผ่าน service-role ; โหมด real auth ตรวจ profiles.role = admin
 */

// มี session จริง -> ต้องเป็น admin เสมอ (เดิมข้ามการตรวจเมื่อไม่ได้ตั้ง REAL_AUTH ทำให้ Coach ที่ล็อกอินจริงเขียนได้บนเครื่อง dev)
// ไม่มี session: โหมด real auth = ปฏิเสธ ; โหมดเดโม = อนุญาต (พฤติกรรมเดิม)
async function verifyAdmin(): Promise<{ ok: boolean; error?: string }> {
  const sb = await createServerAuthClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user || auth.user.is_anonymous) {
    return process.env.NEXT_PUBLIC_REAL_AUTH === "1" ? { ok: false, error: "unauthenticated" } : { ok: true };
  }
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

/**
 * POST /api/stores/admin { code, name, model, region?, province?, branch?, taxId?, areaRep?, coachRep? }
 * -> เพิ่มร้านใหม่ (เปิดใช้งาน) + ผูก Area/Coach (ถ้าเลือก)
 *    โมเดลที่ยังไม่มีการตรวจประเมิน (GT/XP) -> ตั้ง "ไม่ต้องตรวจ" ตั้งแต่เดือนนี้ให้อัตโนมัติ
 */
export async function POST(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok) return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const str = (k: string, max = 200) => String(body[k] ?? "").trim().slice(0, max);
  const code = str("code", 20);
  const name = str("name");
  const model = str("model", 50);
  if (!/^\d{4,10}$/.test(code)) return NextResponse.json({ ok: false, error: "รหัสร้านต้องเป็นตัวเลข 4–10 หลัก" }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "กรุณาใส่ชื่อร้าน" }, { status: 400 });
  if (!isStoreModel(model)) return NextResponse.json({ ok: false, error: "โมเดลร้านไม่ถูกต้อง" }, { status: 400 });

  try {
    const sb = createServiceClient();
    const { data: exists } = await sb.from("dealers").select("code, name").eq("code", code).maybeSingle();
    if (exists) return NextResponse.json({ ok: false, error: `รหัสร้าน ${code} มีอยู่แล้ว (${exists.name})` }, { status: 409 });

    const { error } = await sb.from("dealers").insert({
      code,
      name,
      model,
      region: str("region", 50) || null,
      province: str("province", 50) || null,
      branch: str("branch", 100) || "สำนักงานใหญ่",
      tax_id: str("taxId", 20),
      tier: `${model} Partner`,
      is_active: true,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Area / Coach (ต้องเป็นตำแหน่งนั้นจริง)
    const want = [
      { rep: str("areaRep", 20), role: "manager", position: "area_mng" },
      { rep: str("coachRep", 20), role: "coach", position: "coach" },
    ].filter((x) => x.rep);
    const warnings: string[] = [];
    for (const w of want) {
      const { data: rep } = await sb.from("sale_reps").select("rep_code").eq("rep_code", w.rep).eq("position", w.position).maybeSingle();
      if (!rep) {
        warnings.push(`ไม่พบ ${w.role === "manager" ? "Area" : "Coach"} ${w.rep}`);
        continue;
      }
      const { error: aErr } = await sb.from("rep_store_assignments").insert({ rep_code: w.rep, dealer_code: code, role_in_store: w.role });
      if (aErr) warnings.push(aErr.message);
    }

    if (!modelFeatures(model).evalRequired) {
      const { error: rErr } = await sb.from("store_eval_requirements").insert({
        dealer_code: code,
        effective_period: bangkokToday().slice(0, 7),
        required: false,
        reason: `โมเดล ${model} ยังไม่มีการตรวจประเมิน`,
      });
      if (rErr) warnings.push(rErr.message);
    }
    return NextResponse.json({ ok: true, code, warnings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const adm = await verifyAdmin();
  if (!adm.ok)
    return NextResponse.json({ ok: false, error: adm.error }, { status: 403 });

  let body: { code?: string; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid body" },
      { status: 400 }
    );
  }

  const code = String(body.code ?? "").trim();
  if (!code)
    return NextResponse.json(
      { ok: false, error: "missing code" },
      { status: 400 }
    );

  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("dealers")
      .update({ is_active: body.isActive ?? false })
      .eq("code", code);
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    return NextResponse.json({ ok: true, code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
