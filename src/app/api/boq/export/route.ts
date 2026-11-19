import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { boqRoleOf } from "@/lib/server/boq";
import { loadScoped, parseFilters } from "@/lib/server/boq-summary";

const STATUS_TH: Record<string, string> = {
  waiting: "รอห้องแบบรับงาน", working: "ห้องแบบกำลังทำ", submitted: "ส่ง BOQ แล้ว รอตรวจ", revise: "ขอแก้ไข",
  boq_ok: "BOQ ผ่าน รอใบเสนอราคา", quoted: "เสนอราคาแล้ว รอผล", win: "Win", loss: "Loss", cancelled: "ยกเลิก",
};
const bkk = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ") : "");

/** ดาวน์โหลดรายการคำขอ BOQ เป็น Excel (ตัวกรองเดียวกับหน้าภาพรวม) — Marketing / admin / ร้าน / Area */
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (boqRoleOf(ctx) === "sales" || boqRoleOf(ctx) === "designer") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const sb = createServiceClient();
  const f = parseFilters(req.nextUrl.searchParams);
  const { rows, storeBy } = await loadScoped(sb, ctx, f);
  const ids = rows.map((r) => r.id);
  const [{ data: reps }, { data: designers }, { data: reasons }] = await Promise.all([
    sb.from("sale_reps").select("rep_code, name, nickname").in("rep_code", [...new Set(rows.map((r) => r.rep_code))].concat("-")),
    sb.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => r.designer_id).filter(Boolean) as string[])].concat("00000000-0000-0000-0000-000000000000")),
    sb.from("boq_loss_reasons").select("code, label"),
  ]);
  const { data: wreasons } = await sb.from("boq_win_reasons").select("code, label");
  const wName = new Map((wreasons ?? []).map((r) => [r.code as string, r.label as string]));
  const quotes: { request_id: number; quote_no: string; amount: number; created_at: string }[] = [];
  const points: { request_id: number; no: number; product_code: string; length: number | null; width: number | null; detail: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const part = ids.slice(i, i + 300);
    const [q, p] = await Promise.all([
      sb.from("boq_quotes").select("request_id, quote_no, amount, created_at").in("request_id", part),
      sb.from("boq_points").select("request_id, no, product_code, length, width, detail").in("request_id", part),
    ]);
    quotes.push(...((q.data ?? []) as typeof quotes));
    points.push(...((p.data ?? []) as typeof points));
  }
  const { data: prods } = await sb.from("boq_products").select("code, name, unit").in("code", [...new Set(points.map((p) => p.product_code))].concat("-"));
  const prodBy = new Map((prods ?? []).map((p) => [p.code as string, p]));
  const rName = new Map((reps ?? []).map((r) => [r.rep_code as string, (r.nickname ? `${r.name} (${r.nickname})` : r.name) as string]));
  const dName = new Map((designers ?? []).map((d) => [d.id as string, d.full_name as string]));
  const lName = new Map((reasons ?? []).map((r) => [r.code as string, r.label as string]));

  const reqSheet = rows.map((r) => {
    const s = storeBy.get(r.dealer_code);
    const q = quotes.filter((x) => x.request_id === r.id).sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
    return {
      "เลขที่": r.req_no,
      "สถานะ": STATUS_TH[r.status] ?? r.status,
      "วันที่ขอ": bkk(r.created_at),
      "กำหนดส่งห้องแบบ": bkk(r.due_at),
      "รหัสร้าน": r.dealer_code,
      "ร้าน": s?.name ?? "",
      "ประเภทร้าน": s?.model ?? "",
      "ภาค": s?.region ?? "",
      "พนักงานขาย": rName.get(r.rep_code) ?? r.rep_code,
      "ลูกค้า": r.customer_name,
      "เบอร์ลูกค้า": r.customer_phone ?? "",
      "จังหวัดหน้างาน": r.province ?? "",
      "ประเภทลูกค้า": r.customer_type,
      "ประเภทงาน": r.job_type,
      "ประเภทอาคาร": r.building_type,
      "ความต้องการ": r.need === "boq_3d" ? "BOQ + แบบ 3D" : "BOQ",
      "จำนวนจุด": points.filter((p) => p.request_id === r.id).length,
      "งบประมาณ": Number(r.budget),
      "ห้องแบบ": r.designer_id ? dName.get(r.designer_id) ?? "" : "",
      "รับงาน": bkk(r.claimed_at),
      "BOQ ผ่าน": bkk(r.boq_ok_at),
      "เวอร์ชันที่ใช้": r.approved_version ?? "",
      "เลขใบเสนอราคา": q?.quote_no ?? "",
      "ยอดเสนอราคา": q ? Number(q.amount) : "",
      "ยอดปิดจริง": r.final_amount == null ? "" : Number(r.final_amount),
      "เหตุผล Win": (r.win_reasons ?? []).map((c) => wName.get(c) ?? c).join(" ; "),
      "เหตุผล Loss": r.loss_reason ? lName.get(r.loss_reason) ?? r.loss_reason : "",
      "ความเห็น": r.result_note ?? "",
      "ปิดงาน": bkk(r.closed_at),
      "เลข Opportunity": r.op_no ?? "",
    };
  });
  const reqNo = new Map(rows.map((r) => [r.id, r.req_no]));
  const pointSheet = points
    .sort((a, b) => a.request_id - b.request_id || a.no - b.no)
    .map((p) => {
      const pr = prodBy.get(p.product_code);
      const qty = pr?.unit === "area" ? Number(p.width ?? 0) * Number(p.length ?? 0) : Number(p.length ?? 0);
      return { "เลขที่": reqNo.get(p.request_id) ?? "", "จุด": p.no, "รหัสสินค้า": p.product_code, "สินค้า": pr?.name ?? "", "กว้าง (ม.)": p.width ?? "", "ยาว (ม.)": p.length ?? "", "ปริมาณ": Math.round(qty * 100) / 100, "หน่วย": pr?.unit === "area" ? "ตร.ม." : "ม.", "รายละเอียด": p.detail ?? "" };
    });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reqSheet.length ? reqSheet : [{ "เลขที่": "ไม่มีข้อมูล" }]), "คำขอ BOQ");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pointSheet.length ? pointSheet : [{ "เลขที่": "ไม่มีข้อมูล" }]), "จุดที่ทำ BOQ");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const stamp = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="BOQ_DECAAR_${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
