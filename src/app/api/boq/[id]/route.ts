import { NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { BIG_WIN, BOQ_BUCKET, LOSS_TO_BRAND, actorName, addEvent, boqRoleOf, canViewRequest, diffPoints, dueAfterBusinessDays, loadHolidays, notifyBoq, slaDays, validatePoints, type PointIn, type PointRow } from "@/lib/server/boq";

type Sb = ReturnType<typeof createServiceClient>;
type Params = { params: Promise<{ id: string }> };

const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

async function loadReq(sb: Sb, id: number) {
  const { data } = await sb.from("boq_requests").select("*").eq("id", id).maybeSingle();
  return data as Record<string, unknown> | null;
}

/** ปุ่มที่ผู้ใช้กดได้ในสถานะปัจจุบัน (หน้าจอใช้ซ่อน/แสดงปุ่ม ; POST ตรวจซ้ำ) */
function capsFor(ctx: AuthContext, r: Record<string, unknown>) {
  const role = boqRoleOf(ctx);
  const st = r.status as string;
  const mineSales = role === "sales" && r.rep_code === ctx.repCode;
  const mineDesigner = role === "designer" && r.designer_id === ctx.userId;
  return {
    claim: role === "designer" && st === "waiting",
    release: mineDesigner && (st === "working" || st === "revise"),
    submit: mineDesigner && (st === "working" || st === "revise"),
    review: mineSales && st === "submitted",
    edit: mineSales && st === "waiting",
    quote: mineSales && (st === "boq_ok" || st === "quoted"),
    result: mineSales && st === "quoted",
    cancel: mineSales && ["waiting", "working", "revise", "submitted"].includes(st),
  };
}

export async function GET(_req: Request, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const id = Number((await params).id);
  const sb = createServiceClient();
  const r = await loadReq(sb, id);
  if (!r) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (!canViewRequest(ctx, r as { rep_code: string; dealer_code: string; is_test: boolean })) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const [pts, files, vers, quotes, events, dealer, rep, designer, reasons] = await Promise.all([
    sb.from("boq_points").select("no, product_code, length, width, detail").eq("request_id", id).order("no"),
    sb.from("boq_files").select("id, kind, version, name, size, mime, created_at").eq("request_id", id).order("id"),
    sb.from("boq_versions").select("v, note, submitted_by, submitted_at").eq("request_id", id).order("v"),
    sb.from("boq_quotes").select("quote_no, amount, created_at").eq("request_id", id).order("created_at"),
    sb.from("boq_events").select("at, actor_name, kind, text, tone").eq("request_id", id).order("at"),
    sb.from("dealers").select("name").eq("code", r.dealer_code as string).maybeSingle(),
    sb.from("sale_reps").select("name, nickname, phone").eq("rep_code", r.rep_code as string).maybeSingle(),
    r.designer_id ? sb.from("profiles").select("full_name").eq("id", r.designer_id as string).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("boq_loss_reasons").select("code, label").order("sort"),
  ]);
  const codes = (pts.data ?? []).map((p) => p.product_code as string);
  const { data: prods } = codes.length ? await sb.from("boq_products").select("code, name, grp, sub, size, unit").in("code", codes) : { data: [] };
  const prodBy = new Map((prods ?? []).map((p) => [p.code as string, p]));
  const subIds = [...new Set((vers.data ?? []).map((v) => v.submitted_by as string))];
  const { data: subs } = subIds.length ? await sb.from("profiles").select("id, full_name").in("id", subIds) : { data: [] };
  const subName = new Map((subs ?? []).map((s) => [s.id as string, s.full_name as string]));

  return NextResponse.json({
    ok: true,
    role: boqRoleOf(ctx),
    caps: capsFor(ctx, r),
    lossReasons: reasons.data ?? [],
    item: {
      id: r.id,
      reqNo: r.req_no,
      status: r.status,
      dealerCode: r.dealer_code,
      dealerName: dealer.data?.name ?? r.dealer_code,
      repCode: r.rep_code,
      repName: rep.data?.name ? (rep.data.nickname ? `${rep.data.name} (${rep.data.nickname})` : rep.data.name) : r.recorder_name,
      repPhone: rep.data?.phone ?? null,
      recorderEmail: r.recorder_email,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      province: r.province,
      customerType: r.customer_type,
      customerTypeOther: r.customer_type_other,
      jobType: r.job_type,
      buildingType: r.building_type,
      need: r.need,
      budget: Number(r.budget),
      wantDate: r.want_date,
      note: r.note,
      opNo: r.op_no,
      createdAt: r.created_at,
      dueAt: r.due_at,
      claimedAt: r.claimed_at,
      designerId: r.designer_id,
      designerName: designer.data?.full_name ?? null,
      approvedVersion: r.approved_version,
      boqOkAt: r.boq_ok_at,
      finalAmount: r.final_amount == null ? null : Number(r.final_amount),
      lossReason: r.loss_reason,
      resultNote: r.result_note,
      closedAt: r.closed_at,
      points: (pts.data ?? []).map((p) => ({
        no: p.no,
        code: p.product_code,
        length: p.length == null ? null : Number(p.length),
        width: p.width == null ? null : Number(p.width),
        detail: p.detail,
        product: prodBy.get(p.product_code as string) ?? null,
      })),
      files: files.data ?? [],
      versions: (vers.data ?? []).map((v) => ({ v: v.v, note: v.note, at: v.submitted_at, by: subName.get(v.submitted_by as string) ?? null })),
      quotes: (quotes.data ?? []).map((q) => ({ no: q.quote_no, amount: Number(q.amount), at: q.created_at })),
      events: events.data ?? [],
    },
  });
}

interface ActionBody {
  action?: string;
  text?: string;
  version?: number;
  files?: { path?: string; name?: string; size?: number; mime?: string; kind?: string }[];
  quoteNo?: string;
  amount?: number;
  reason?: string;
  points?: PointIn[];
}

export async function POST(req: Request, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const id = Number((await params).id);
  const b = ((await req.json().catch(() => null)) ?? {}) as ActionBody;
  const sb = createServiceClient();
  const r = await loadReq(sb, id);
  if (!r) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (!canViewRequest(ctx, r as { rep_code: string; dealer_code: string; is_test: boolean })) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const caps = capsFor(ctx, r);
  const forbid = () => NextResponse.json({ ok: false, error: "ทำรายการนี้ไม่ได้ในสถานะปัจจุบัน" }, { status: 409 });
  const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });
  const name = await actorName(sb, ctx);
  const text = typeof b.text === "string" ? b.text.trim().slice(0, 1000) : "";
  const now = new Date().toISOString();
  const info = { id, req_no: r.req_no as string, customer_name: r.customer_name as string, rep_code: r.rep_code as string, designer_id: (r.designer_id as string | null) ?? null, is_test: !!r.is_test };

  /** เปลี่ยนสถานะแบบมีเงื่อนไข (กันกดพร้อมกัน) — คืน false ถ้าสถานะเปลี่ยนไปก่อนแล้ว */
  const move = async (from: string[], patch: Record<string, unknown>) => {
    const { data } = await sb.from("boq_requests").update({ ...patch, updated_at: now }).eq("id", id).in("status", from).select("id");
    return (data?.length ?? 0) > 0;
  };

  switch (b.action) {
    case "claim": {
      if (!caps.claim) return forbid();
      const { data } = await sb
        .from("boq_requests")
        .update({ status: "working", designer_id: ctx.userId, claimed_at: now, updated_at: now })
        .eq("id", id)
        .eq("status", "waiting")
        .is("designer_id", null)
        .select("id");
      if (!data?.length) return NextResponse.json({ ok: false, error: "มีห้องแบบคนอื่นรับงานนี้ไปแล้ว" }, { status: 409 });
      await addEvent(sb, id, ctx, name, "claimed", "รับงาน");
      await notifyBoq(sb, { ...info, designer_id: ctx.userId }, "claimed");
      break;
    }
    case "release": {
      if (!caps.release) return forbid();
      if (!(await move(["working", "revise"], { status: "waiting", designer_id: null, claimed_at: null }))) return forbid();
      await addEvent(sb, id, ctx, name, "released", `ปล่อยงานคืน ให้ห้องแบบคนอื่นรับต่อ${text ? `: ${text}` : ""}`, "warn");
      await notifyBoq(sb, { ...info, designer_id: null }, "released");
      break;
    }
    case "submit": {
      if (!caps.submit) return forbid();
      const prefix = `req/${id}/`;
      const files = (b.files ?? []).slice(0, 30).filter((f) => (f.kind === "boq" || f.kind === "d3") && typeof f.path === "string" && f.path.startsWith(prefix) && !f.path.includes(".."));
      if (!files.some((f) => f.kind === "boq")) return bad("กรุณาแนบไฟล์ BOQ");
      if (r.need === "boq_3d" && !files.some((f) => f.kind === "d3")) return bad("กรุณาแนบไฟล์แบบ 3D");
      for (const f of files) {
        const { error } = await sb.storage.from(BOQ_BUCKET).createSignedUrl(f.path!, 30);
        if (error) return bad(`ไฟล์ ${f.name ?? ""} อัปโหลดไม่สำเร็จ ลองแนบใหม่`);
      }
      const { data: last } = await sb.from("boq_versions").select("v").eq("request_id", id).order("v", { ascending: false }).limit(1);
      const v = ((last?.[0]?.v as number | undefined) ?? 0) + 1;
      if (!(await move(["working", "revise"], { status: "submitted" }))) return forbid();
      await sb.from("boq_versions").insert({ request_id: id, v, note: text || null, submitted_by: ctx.userId });
      await sb.from("boq_files").insert(
        files.map((f) => ({ request_id: id, kind: f.kind, version: v, path: f.path, name: String(f.name ?? "file").slice(0, 200), size: Number(f.size) || null, mime: f.mime ? String(f.mime).slice(0, 100) : null, uploaded_by: ctx.userId }))
      );
      await addEvent(sb, id, ctx, name, "submitted", `ส่ง BOQ${r.need === "boq_3d" ? " + แบบ 3D" : ""} v${v}${text ? ` — ${text}` : ""}`);
      await notifyBoq(sb, info, "submitted");
      break;
    }
    case "revise":
    case "edit": {
      // revise = แจ้งแก้หลังห้องแบบส่ง BOQ (ข้อความบังคับ + กำหนดส่งใหม่ตาม SLA เดิม)
      // edit   = พนักงานแก้คำขอเองก่อนห้องแบบรับงาน
      const isRevise = b.action === "revise";
      if (isRevise ? !caps.review : !caps.edit) return forbid();
      if (isRevise && !text) return bad("กรุณาใส่รายละเอียดที่ต้องแก้");
      // จุดที่ทำ BOQ (ถ้าส่งมา = แทนชุดเดิม ; เก็บชุดเดิมไว้ใน event)
      let changes: string[] = [];
      let snapshot: { before: PointRow[]; after: PointRow[] } | null = null;
      if (b.points) {
        const v = await validatePoints(sb, b.points);
        if (!v.ok) return bad(v.error);
        const { data: old } = await sb.from("boq_points").select("no, product_code, length, width, detail").eq("request_id", id).order("no");
        const before = ((old ?? []) as PointRow[]).map((p) => ({ ...p, length: Number(p.length), width: p.width == null ? null : Number(p.width) }));
        changes = await diffPoints(sb, before, v.points);
        if (changes.length) snapshot = { before, after: v.points };
      }
      // ไฟล์แนบ: ต้องอัปโหลดผ่าน /api/boq/upload (kind revise) ของคำขอนี้
      const prefix = `req/${id}/revise/`;
      const files = (b.files ?? []).slice(0, 30).filter((f) => f.kind === "revise" && typeof f.path === "string" && f.path.startsWith(prefix) && !f.path.includes(".."));
      for (const f of files) {
        const { error } = await sb.storage.from(BOQ_BUCKET).createSignedUrl(f.path!, 30);
        if (error) return bad(`ไฟล์ ${f.name ?? ""} อัปโหลดไม่สำเร็จ ลองแนบใหม่`);
      }
      if (!isRevise && !text && !changes.length && !files.length) return bad("ยังไม่มีอะไรเปลี่ยน");
      if (isRevise) {
        const due = dueAfterBusinessDays(new Date(), slaDays(r.need as string), await loadHolidays(sb));
        if (!(await move(["submitted"], { status: "revise", due_at: due.toISOString() }))) return forbid();
      } else if (!(await move(["waiting"], {}))) return forbid();
      if (snapshot) {
        await sb.from("boq_points").delete().eq("request_id", id);
        await sb.from("boq_points").insert(snapshot.after.map((p) => ({ ...p, request_id: id })));
      }
      const { data: last } = await sb.from("boq_versions").select("v").eq("request_id", id).order("v", { ascending: false }).limit(1);
      const round = isRevise ? ((last?.[0]?.v as number | undefined) ?? 0) : 0;
      if (files.length) {
        await sb.from("boq_files").insert(
          files.map((f) => ({ request_id: id, kind: "revise", version: round, path: f.path, name: String(f.name ?? "file").slice(0, 200), size: Number(f.size) || null, mime: f.mime ? String(f.mime).slice(0, 100) : null, uploaded_by: ctx.userId }))
        );
      }
      const lines = [
        isRevise ? `ขอแก้ไข: ${text}` : `แก้ไขคำขอ${text ? `: ${text}` : ""}`,
        ...changes,
        ...(files.length ? [`แนบไฟล์เพิ่ม ${files.length} ไฟล์`] : []),
      ];
      await addEvent(sb, id, ctx, name, isRevise ? "revise" : "edited", lines.join("\n"), "warn", { round, changes, files: files.map((f) => f.name), ...(snapshot ?? {}) });
      if (isRevise) await notifyBoq(sb, info, "revise");
      break;
    }
    case "approve": {
      if (!caps.review) return forbid();
      const v = Number(b.version);
      const { data: ver } = await sb.from("boq_versions").select("v").eq("request_id", id).eq("v", v).maybeSingle();
      if (!ver) return bad("กรุณาเลือกเวอร์ชัน BOQ");
      if (!(await move(["submitted"], { status: "boq_ok", approved_version: v, boq_ok_at: now }))) return forbid();
      await addEvent(sb, id, ctx, name, "approved", `BOQ ผ่าน (ใช้ v${v}) — ปิดงานห้องแบบ`, "ok");
      await notifyBoq(sb, info, "approved");
      break;
    }
    case "cancel": {
      if (!caps.cancel) return forbid();
      if (!(await move(["waiting", "working", "revise", "submitted"], { status: "cancelled", closed_at: now }))) return forbid();
      await addEvent(sb, id, ctx, name, "cancelled", `ยกเลิกคำขอ${text ? `: ${text}` : ""}`, "bad");
      await notifyBoq(sb, info, "cancelled");
      break;
    }
    case "quote": {
      if (!caps.quote) return forbid();
      const quoteNo = typeof b.quoteNo === "string" ? b.quoteNo.trim().slice(0, 60) : "";
      const amount = Number(b.amount);
      if (!quoteNo) return bad("กรุณาใส่เลขที่ใบเสนอราคา");
      if (!(amount > 0) || amount > 1e10) return bad("กรุณาใส่ยอดเสนอราคา");
      const again = r.status === "quoted";
      if (!(await move(["boq_ok", "quoted"], { status: "quoted" }))) return forbid();
      await sb.from("boq_quotes").insert({ request_id: id, quote_no: quoteNo, amount, created_by: ctx.userId });
      await addEvent(sb, id, ctx, name, "quoted", `${again ? "เสนอราคาใหม่" : "บันทึกใบเสนอราคา"} ${quoteNo} ยอด ${baht(amount)}`);
      break;
    }
    case "win": {
      if (!caps.result) return forbid();
      const amount = Number(b.amount);
      if (!(amount > 0) || amount > 1e10) return bad("กรุณาใส่ยอดปิดจริง");
      if (!(await move(["quoted"], { status: "win", final_amount: amount, closed_at: now, loss_reason: null, result_note: text || null }))) return forbid();
      await addEvent(sb, id, ctx, name, "win", `Win ยอดปิดจริง ${baht(amount)}`, "ok");
      if (amount >= BIG_WIN) await notifyBoq(sb, info, "win_big", `ยอดปิดจริง ${baht(amount)}`);
      break;
    }
    case "loss": {
      if (!caps.result) return forbid();
      const reason = typeof b.reason === "string" ? b.reason : "";
      const { data: lr } = await sb.from("boq_loss_reasons").select("code, label").eq("code", reason).maybeSingle();
      if (!lr) return bad("กรุณาเลือกเหตุผล");
      if (reason === "other" && !text) return bad("กรุณาระบุเหตุผล");
      if (!(await move(["quoted"], { status: "loss", loss_reason: reason, result_note: text || null, closed_at: now, final_amount: null }))) return forbid();
      await addEvent(sb, id, ctx, name, "loss", reason === "other" ? `Lost - ${text}` : `${lr.label}${text ? ` — ${text}` : ""}`, "bad");
      if (LOSS_TO_BRAND.includes(reason)) await notifyBoq(sb, info, "loss_brand", `${lr.label}${text ? ` (${text})` : ""}`);
      break;
    }
    default:
      return bad("unknown action");
  }
  return NextResponse.json({ ok: true });
}
