import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { bangkokToday } from "@/lib/server/eval-tracking";

/**
 * ติดตามกลุ่ม Line ลูกค้า (งาน ROOF SERVICE ของ LHS/Rudy · ร้าน HE + SCG Home) — นับต่อลูกค้า
 * GET ?period=YYYY-MM (ว่าง = เดือนปัจจุบัน)
 *   admin / หัวหน้า Area: ทุกร้าน ; Area / Coach: ร้านที่ดูแล
 * ข้อมูลคำนวณล่วงหน้าโดย scripts/import-line-groups.mjs (ตาราง line_tracking_jobs, batch ล่าสุด)
 */
const ROLES = new Set(["admin", "area_head", "area", "coach", "re"]);

type Row = {
  project_number: string; dealer_code: string; period: string; order_date: string | null; h5: string | null; sales_name: string | null; rep_code: string | null;
  amount: number | null; opp_ids: string | null; customer_id: string; customer_name: string | null; customer_type: string | null; province: string | null;
  customer_period: string; customer_dealer: string; job_status: string | null; customer_status: string | null; group_name: string | null;
  group_created: string | null; status_source: string | null; source_date: string | null;
};

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (!ROLES.has(ctx.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const period = req.nextUrl.searchParams.get("period") || bangkokToday().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ ok: false, error: "invalid period" }, { status: 400 });
  const scope = ctx.allowedDealerCodes === "all" || ctx.role === "area_head" ? null : ctx.allowedDealerCodes;

  const sb = createServiceClient();
  const { data: last } = await sb.from("line_tracking_jobs").select("batch, source_date").order("batch", { ascending: false }).limit(1).maybeSingle();
  if (!last) return NextResponse.json({ ok: true, period, months: [], sourceDate: null, totals: emptyTotals(), coaches: [], customers: [], me: { role: ctx.role, repCode: ctx.repCode } });

  // เดือนที่มีข้อมูล (ในขอบเขต)
  // PostgREST คืนได้ครั้งละ 1,000 แถว -> วนอ่าน
  const monthSet = new Set<string>();
  for (let from = 0; ; from += 1000) {
    let mq = sb.from("line_tracking_jobs").select("customer_period").eq("batch", last.batch).order("id").range(from, from + 999);
    if (scope) mq = mq.in("customer_dealer", scope.length ? scope : ["__none__"]);
    const { data: mr } = await mq;
    (mr ?? []).forEach((r) => monthSet.add(r.customer_period as string));
    if (!mr || mr.length < 1000) break;
  }
  const months = [...monthSet].sort();

  let q = sb.from("line_tracking_jobs").select("*").eq("batch", last.batch).eq("customer_period", period);
  if (scope) q = q.in("customer_dealer", scope.length ? scope : ["__none__"]);
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as Row[];

  // ร้าน / Coach / Area / เบอร์พนักงาน
  const codes = [...new Set(rows.map((r) => r.customer_dealer))];
  const repCodes = [...new Set(rows.map((r) => r.rep_code).filter((x): x is string => !!x))];
  const [{ data: dealers }, { data: asg }, { data: salesReps }] = await Promise.all([
    codes.length ? sb.from("dealers").select("code, name, model").in("code", codes) : Promise.resolve({ data: [] as { code: string; name: string; model: string }[] }),
    codes.length ? sb.from("rep_store_assignments").select("rep_code, dealer_code, role_in_store").in("dealer_code", codes).in("role_in_store", ["coach", "manager"]) : Promise.resolve({ data: [] as { rep_code: string; dealer_code: string; role_in_store: string }[] }),
    repCodes.length ? sb.from("sale_reps").select("rep_code, phone").in("rep_code", repCodes) : Promise.resolve({ data: [] as { rep_code: string; phone: string | null }[] }),
  ]);
  const dmap = new Map((dealers ?? []).map((d) => [d.code as string, d]));
  const coachOf = new Map<string, string>(), areaOf = new Map<string, string>();
  (asg ?? []).forEach((a) => {
    if (a.role_in_store === "coach" && !coachOf.has(a.dealer_code as string)) coachOf.set(a.dealer_code as string, a.rep_code as string);
    if (a.role_in_store === "manager" && !areaOf.has(a.dealer_code as string)) areaOf.set(a.dealer_code as string, a.rep_code as string);
  });
  const supCodes = [...new Set([...coachOf.values(), ...areaOf.values()])];
  const { data: sups } = supCodes.length ? await sb.from("sale_reps").select("rep_code, name, nickname, phone").in("rep_code", supCodes) : { data: [] as { rep_code: string; name: string; nickname: string | null; phone: string | null }[] };
  const supMap = new Map((sups ?? []).map((s) => [s.rep_code as string, s]));
  const phoneOf = new Map((salesReps ?? []).map((s) => [s.rep_code as string, (s.phone as string | null) ?? null]));

  // รวมต่อลูกค้า
  const byCust = new Map<string, Row[]>();
  rows.forEach((r) => byCust.set(r.customer_id, [...(byCust.get(r.customer_id) ?? []), r]));
  const RANK: Record<string, number> = { no_bot: 0, not_register: 1, none: 2, register: 3 };
  const customers = [...byCust.values()].map((js) => {
    js.sort((a, b) => String(a.order_date ?? "").localeCompare(String(b.order_date ?? "")));
    const first = js[0];
    const statusJob = js.find((j) => j.job_status === first.customer_status) ?? js.find((j) => j.group_name) ?? first;
    const d = dmap.get(first.customer_dealer);
    const coachRep = coachOf.get(first.customer_dealer) ?? null;
    const areaRep = areaOf.get(first.customer_dealer) ?? null;
    return {
      id: first.customer_id,
      name: first.customer_name ?? "(ไม่มีชื่อ)",
      type: first.customer_type,
      province: first.province,
      dealerCode: first.customer_dealer,
      dealerName: (d?.name as string | undefined) ?? first.customer_dealer,
      model: (d?.model as string | undefined) ?? null,
      coachRep,
      coachName: coachRep ? ((supMap.get(coachRep)?.nickname as string | null) || (supMap.get(coachRep)?.name as string | undefined) || coachRep) : null,
      areaName: areaRep ? ((supMap.get(areaRep)?.nickname as string | null) || (supMap.get(areaRep)?.name as string | undefined) || areaRep) : null,
      status: (first.customer_status ?? "none") as "register" | "not_register" | "no_bot" | "none",
      groupName: statusJob.group_name,
      groupCreated: statusJob.group_created,
      source: statusJob.status_source,
      salesName: first.sales_name,
      salesRep: first.rep_code,
      salesPhone: first.rep_code ? phoneOf.get(first.rep_code) ?? null : null,
      jobs: js.map((j) => ({ project: j.project_number, opps: j.opp_ids, h5: j.h5, orderDate: j.order_date, amount: j.amount === null ? null : Number(j.amount), status: (j.job_status ?? "none") as string, sales: j.sales_name })),
    };
  });
  customers.sort((a, b) => RANK[a.status] - RANK[b.status] || a.dealerName.localeCompare(b.dealerName, "th") || a.name.localeCompare(b.name, "th"));

  // ราย Coach
  const byCoach = new Map<string, typeof customers>();
  customers.forEach((c) => byCoach.set(c.coachRep ?? "none", [...(byCoach.get(c.coachRep ?? "none") ?? []), c]));
  const coaches = [...byCoach.entries()].map(([rep, list]) => {
    const s = rep !== "none" ? supMap.get(rep) : null;
    return {
      repCode: rep === "none" ? null : rep,
      name: (s?.name as string | undefined) ?? "ยังไม่มี Coach",
      nickname: (s?.nickname as string | null | undefined) ?? null,
      phone: (s?.phone as string | null | undefined) ?? null,
      stores: new Set(list.map((c) => c.dealerCode)).size,
      ...countsOf(list),
    };
  });
  coaches.sort((a, b) => a.register / Math.max(1, a.customers) - b.register / Math.max(1, b.customers) || b.customers - a.customers);

  return NextResponse.json({
    ok: true,
    period,
    months,
    sourceDate: last.source_date,
    updatedAt: last.batch,
    totals: { ...countsOf(customers), jobs: rows.length },
    coaches,
    customers,
    me: { role: ctx.role, repCode: ctx.repCode },
  });
}

function countsOf(list: { status: string }[]) {
  return {
    customers: list.length,
    register: list.filter((c) => c.status === "register").length,
    not_register: list.filter((c) => c.status === "not_register").length,
    no_bot: list.filter((c) => c.status === "no_bot").length,
    none: list.filter((c) => c.status === "none").length,
  };
}
function emptyTotals() {
  return { customers: 0, register: 0, not_register: 0, no_bot: 0, none: 0, jobs: 0 };
}
