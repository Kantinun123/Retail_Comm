import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { BOQ_BUCKET, actorName, addEvent, boqRoleOf, dueAfterBusinessDays, loadHolidays, notifyBoq, slaDays } from "@/lib/server/boq";

/**
 * GET  /api/boq                -> รายการคำขอตามสิทธิ์ (พนักงาน = ของตัวเอง ; ห้องแบบ/Marketing/admin = ทุกร้าน ;
 *                                 ร้าน/Area = ร้านในขอบเขต) ; ?dealerCode= กรองร้าน (ทุกบทบาทที่เห็นหลายร้าน)
 * POST /api/boq                -> พนักงานขายสร้างคำขอ (ไฟล์แนบอัปโหลดผ่าน /api/boq/upload ไว้ก่อนแล้ว)
 */
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const sb = createServiceClient();
  const role = boqRoleOf(ctx);
  const dealerFilter = new URL(req.url).searchParams.get("dealerCode");

  let q = sb
    .from("boq_requests")
    .select(
      "id, req_no, status, customer_name, province, need, budget, created_at, due_at, claimed_at, boq_ok_at, closed_at, dealer_code, rep_code, designer_id, final_amount, loss_reason, boq_points(count), boq_versions(count), boq_quotes(quote_no, amount, created_at)"
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if (role !== "admin") q = q.eq("is_test", ctx.isTest);
  if (role === "sales") q = q.eq("rep_code", ctx.repCode ?? "-");
  else if (role === "viewer") {
    const allowed = ctx.allowedDealerCodes === "all" ? null : ctx.allowedDealerCodes;
    if (allowed) q = q.in("dealer_code", allowed.length ? allowed : ["-"]);
  }
  if (dealerFilter && role !== "sales") q = q.eq("dealer_code", dealerFilter);
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = data ?? [];
  const dealerCodes = [...new Set(rows.map((r) => r.dealer_code as string))];
  const repCodes = [...new Set(rows.map((r) => r.rep_code as string))];
  const designerIds = [...new Set(rows.map((r) => r.designer_id as string | null).filter(Boolean))] as string[];
  const [d, r, p] = await Promise.all([
    dealerCodes.length ? sb.from("dealers").select("code, name").in("code", dealerCodes) : Promise.resolve({ data: [] }),
    repCodes.length ? sb.from("sale_reps").select("rep_code, name, nickname").in("rep_code", repCodes) : Promise.resolve({ data: [] }),
    designerIds.length ? sb.from("profiles").select("id, full_name").in("id", designerIds) : Promise.resolve({ data: [] }),
  ]);
  const dn = new Map((d.data ?? []).map((x) => [x.code as string, x.name as string]));
  const rn = new Map((r.data ?? []).map((x) => [x.rep_code as string, (x.nickname ? `${x.name} (${x.nickname})` : x.name) as string]));
  const pn = new Map((p.data ?? []).map((x) => [x.id as string, x.full_name as string]));

  return NextResponse.json({
    ok: true,
    role,
    me: ctx.userId,
    // เปิดให้ทุกคน: ตั้ง BOQ_ENABLED=1 ใน Vercel ; ก่อนเปิด = เห็นเฉพาะบัญชีทดสอบ / admin / ห้องแบบ / Marketing
    enabled: process.env.BOQ_ENABLED === "1" || ctx.isTest || role !== "sales",
    items: rows.map((x) => {
      const quotes = ((x.boq_quotes as { quote_no: string; amount: number; created_at: string }[] | null) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
      return {
        id: x.id,
        reqNo: x.req_no,
        status: x.status,
        customerName: x.customer_name,
        province: x.province,
        need: x.need,
        budget: Number(x.budget),
        createdAt: x.created_at,
        dueAt: x.due_at,
        claimedAt: x.claimed_at,
        boqOkAt: x.boq_ok_at,
        closedAt: x.closed_at,
        dealerCode: x.dealer_code,
        dealerName: dn.get(x.dealer_code as string) ?? x.dealer_code,
        repCode: x.rep_code,
        repName: rn.get(x.rep_code as string) ?? x.rep_code,
        designerId: x.designer_id,
        designerName: x.designer_id ? pn.get(x.designer_id as string) ?? null : null,
        points: (x.boq_points as { count: number }[] | null)?.[0]?.count ?? 0,
        versions: (x.boq_versions as { count: number }[] | null)?.[0]?.count ?? 0,
        quoteAmount: quotes.length ? Number(quotes[quotes.length - 1].amount) : null,
        finalAmount: x.final_amount == null ? null : Number(x.final_amount),
        lossReason: x.loss_reason,
      };
    }),
  });
}

interface CreateBody {
  customerName?: string;
  customerPhone?: string;
  province?: string;
  customerType?: string;
  customerTypeOther?: string;
  jobType?: string;
  buildingType?: string;
  need?: string;
  budget?: number;
  wantDate?: string;
  note?: string;
  opNo?: string;
  recorderEmail?: string;
  points?: { productCode?: string; length?: number; width?: number; detail?: string }[];
  files?: { path?: string; name?: string; size?: number; mime?: string; kind?: string }[];
}

const CUST_TYPES = ["เจ้าของบ้าน", "ช่าง/ผรม.", "อื่นๆ"];
const JOB_TYPES = ["สร้างใหม่", "รีโนเวท"];
const BUILDING_TYPES = ["บ้านอยู่อาศัย", "อาคาร"];
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "sales" || !ctx.repCode || !ctx.dealerCode) return NextResponse.json({ ok: false, error: "เฉพาะพนักงานขายสร้างคำขอได้" }, { status: 403 });
  if (process.env.BOQ_ENABLED !== "1" && !ctx.isTest) return NextResponse.json({ ok: false, error: "ระบบขอ BOQ ยังไม่เปิดใช้งาน" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as CreateBody | null;
  if (!b) return bad("ข้อมูลไม่ถูกต้อง");

  const customerName = txt(b.customerName, 120);
  const customerType = txt(b.customerType, 30);
  const customerTypeOther = txt(b.customerTypeOther, 100);
  const jobType = txt(b.jobType, 30);
  const buildingType = txt(b.buildingType, 30);
  const need = b.need === "boq_3d" ? "boq_3d" : b.need === "boq" ? "boq" : "";
  const budget = Number(b.budget);
  if (!customerName) return bad("กรุณาใส่ชื่อลูกค้า");
  if (!CUST_TYPES.includes(customerType) || (customerType === "อื่นๆ" && !customerTypeOther)) return bad("กรุณาเลือกประเภทลูกค้า");
  if (!JOB_TYPES.includes(jobType)) return bad("กรุณาเลือกประเภทงาน");
  if (!BUILDING_TYPES.includes(buildingType)) return bad("กรุณาเลือกประเภทอาคาร");
  if (!need) return bad("กรุณาเลือกความต้องการของลูกค้า");
  if (!(budget > 0) || budget > 1e10) return bad("กรุณาใส่งบประมาณ");
  const wantDate = /^\d{4}-\d{2}-\d{2}$/.test(b.wantDate ?? "") ? b.wantDate! : null;

  const sb = createServiceClient();
  // จุดที่ทำ BOQ: สินค้าต้องมีอยู่ + ใส่ขนาดตามหน่วยของสินค้า
  const pts = (b.points ?? []).slice(0, 50);
  if (!pts.length) return bad("กรุณาเพิ่มจุดที่ต้องการทำ BOQ อย่างน้อย 1 จุด");
  const codes = [...new Set(pts.map((p) => txt(p.productCode, 30)))];
  const { data: prods } = await sb.from("boq_products").select("code, unit").in("code", codes).eq("is_active", true);
  const unitOf = new Map((prods ?? []).map((p) => [p.code as string, p.unit as string]));
  const points = [];
  for (const [i, p] of pts.entries()) {
    const code = txt(p.productCode, 30);
    const unit = unitOf.get(code);
    if (!unit) return bad(`จุดที่ ${i + 1}: กรุณาเลือกสินค้า`);
    const length = Number(p.length);
    const width = Number(p.width);
    if (!(length > 0) || length > 100000) return bad(`จุดที่ ${i + 1}: กรุณาใส่ความยาว`);
    if (unit === "area" && (!(width > 0) || width > 100000)) return bad(`จุดที่ ${i + 1}: กรุณาใส่ความกว้าง`);
    points.push({ no: i + 1, product_code: code, length, width: unit === "area" ? width : null, detail: txt(p.detail, 300) || null });
  }

  // ไฟล์แนบ: ต้องเป็นไฟล์ที่ผู้ใช้คนนี้อัปโหลดไว้ใน tmp/<userId>/
  const files = (b.files ?? []).slice(0, 40).filter((f) => ["photo", "plan", "old_design"].includes(f.kind ?? "") && typeof f.path === "string" && f.path.startsWith(`tmp/${ctx.userId}/`) && !f.path.includes(".."));
  if (!files.some((f) => f.kind === "photo")) return bad("กรุณาแนบรูปจุดที่ใช้สินค้า");
  if (!files.some((f) => f.kind === "plan")) return bad("กรุณาแนบแบบแปลนพื้นที่");

  // ผู้บันทึก: ชื่อ/อีเมลจากข้อมูลพนักงาน ; ยังไม่มีอีเมล -> ใช้ที่กรอกมาและจำไว้ใน sale_reps
  const { data: rep } = await sb.from("sale_reps").select("name, nickname, email").eq("rep_code", ctx.repCode).maybeSingle();
  let recorderEmail = (rep?.email as string | null)?.trim() || "";
  if (!recorderEmail) {
    const e = txt(b.recorderEmail, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return bad("กรุณาใส่ Email ผู้บันทึก");
    recorderEmail = e;
    await sb.from("sale_reps").update({ email: e }).eq("rep_code", ctx.repCode).or("email.is.null,email.eq.");
  }
  const recorderName = rep?.name ? (rep.nickname ? `${rep.name} (${rep.nickname})` : (rep.name as string)) : await actorName(sb, ctx);

  const { data: no, error: noErr } = await sb.rpc("boq_next_no");
  if (noErr || !no) return NextResponse.json({ ok: false, error: noErr?.message ?? "เลขที่คำขอไม่สำเร็จ" }, { status: 500 });
  const now = new Date();
  const due = dueAfterBusinessDays(now, slaDays(need), await loadHolidays(sb));
  const { data: created, error: cErr } = await sb
    .from("boq_requests")
    .insert({
      req_no: no as string,
      dealer_code: ctx.dealerCode,
      rep_code: ctx.repCode,
      created_by: ctx.userId,
      recorder_name: recorderName,
      recorder_email: recorderEmail,
      customer_name: customerName,
      customer_phone: txt(b.customerPhone, 30) || null,
      province: txt(b.province, 60) || null,
      customer_type: customerType,
      customer_type_other: customerType === "อื่นๆ" ? customerTypeOther : null,
      job_type: jobType,
      building_type: buildingType,
      need,
      budget,
      want_date: wantDate,
      note: txt(b.note, 1000) || null,
      op_no: txt(b.opNo, 40) || null,
      status: "waiting",
      due_at: due.toISOString(),
      is_test: ctx.isTest,
    })
    .select("id, req_no, customer_name, rep_code, designer_id")
    .single();
  if (cErr || !created) return NextResponse.json({ ok: false, error: cErr?.message ?? "บันทึกไม่สำเร็จ" }, { status: 500 });
  const id = created.id as number;

  const rollback = async (msg: string) => {
    await sb.from("boq_requests").delete().eq("id", id);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  };
  const { error: pErr } = await sb.from("boq_points").insert(points.map((p) => ({ ...p, request_id: id })));
  if (pErr) return rollback(pErr.message);

  // ย้ายไฟล์จาก tmp -> req/<id>/<kind>/ (ไฟล์ที่ไม่มีจริงจะย้ายไม่ได้ = ตรวจการอัปโหลดไปในตัว)
  const fileRows = [];
  for (const f of files) {
    const dest = `req/${id}/${f.kind}/${f.path!.split("/").pop()}`;
    const { error: mErr } = await sb.storage.from(BOQ_BUCKET).move(f.path!, dest);
    if (mErr) return rollback(`ไฟล์ ${f.name ?? ""} อัปโหลดไม่สำเร็จ ลองแนบใหม่`);
    fileRows.push({ request_id: id, kind: f.kind, path: dest, name: txt(f.name, 200) || "file", size: Number(f.size) || null, mime: txt(f.mime, 100) || null, uploaded_by: ctx.userId });
  }
  const { error: fErr } = await sb.from("boq_files").insert(fileRows);
  if (fErr) return rollback(fErr.message);

  await addEvent(sb, id, ctx, recorderName, "created", "ส่งคำขอ BOQ DECAAR — แจ้งเตือนห้องแบบแล้ว");
  await notifyBoq(sb, { id, req_no: created.req_no as string, customer_name: customerName, rep_code: ctx.repCode, designer_id: null, is_test: ctx.isTest }, "new");
  return NextResponse.json({ ok: true, id, reqNo: created.req_no });
}
