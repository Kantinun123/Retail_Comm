/* ภาพรวม BOQ DECAAR (funnel / สินค้า / เหตุผล Loss / SLA ห้องแบบ / อันดับร้าน) + ตัวกรอง
   ใช้ร่วมกันระหว่าง /api/boq/summary และ /api/boq/export — ขอบเขตตามบทบาทเหมือน /api/boq */
import type { AuthContext } from "@/lib/supabase/auth-context";
import type { createServiceClient } from "@/lib/supabase/service";
import { boqRoleOf } from "@/lib/server/boq";

type Sb = ReturnType<typeof createServiceClient>;

export interface BoqFilters {
  year: number | null;
  month: number | null; // 1-12
  model: string | null;
  region: string | null;
  area: string | null; // rep_code ของ Area Manager
  dealer: string | null;
}

export function parseFilters(sp: URLSearchParams): BoqFilters {
  const n = (k: string) => {
    const v = Number(sp.get(k));
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const s = (k: string) => sp.get(k)?.trim() || null;
  const yearRaw = sp.get("year");
  return {
    year: yearRaw === "all" ? null : (n("year") ?? new Date().getFullYear()),
    month: n("month"),
    model: s("model"),
    region: s("region"),
    area: s("area"),
    dealer: s("dealer"),
  };
}

export interface ScopedRow {
  id: number;
  req_no: string;
  status: string;
  dealer_code: string;
  rep_code: string;
  designer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  province: string | null;
  customer_type: string;
  job_type: string;
  building_type: string;
  need: string;
  budget: number;
  created_at: string;
  due_at: string;
  claimed_at: string | null;
  boq_ok_at: string | null;
  closed_at: string | null;
  final_amount: number | null;
  loss_reason: string | null;
  win_reasons: string[] | null;
  result_note: string | null;
  approved_version: number | null;
  op_no: string | null;
}

export interface StoreMeta { code: string; name: string; model: string | null; region: string | null; area: string | null }

/** โหลดคำขอในขอบเขตของผู้ใช้ + ตัวกรอง ; คืน null = ไม่มีสิทธิ์ */
export async function loadScoped(sb: Sb, ctx: AuthContext, f: BoqFilters) {
  const role = boqRoleOf(ctx);
  let q = sb
    .from("boq_requests")
    .select("id, req_no, status, dealer_code, rep_code, designer_id, customer_name, customer_phone, province, customer_type, job_type, building_type, need, budget, created_at, due_at, claimed_at, boq_ok_at, closed_at, final_amount, loss_reason, win_reasons, result_note, approved_version, op_no")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (role !== "admin") q = q.eq("is_test", ctx.isTest);
  if (role === "sales") q = q.eq("rep_code", ctx.repCode ?? "-");
  if (role === "viewer" && ctx.allowedDealerCodes !== "all") q = q.in("dealer_code", ctx.allowedDealerCodes.length ? ctx.allowedDealerCodes : ["-"]);
  if (f.year) {
    const from = f.month ? `${f.year}-${String(f.month).padStart(2, "0")}-01` : `${f.year}-01-01`;
    const toY = f.month ? (f.month === 12 ? f.year + 1 : f.year) : f.year + 1;
    const toM = f.month ? (f.month === 12 ? 1 : f.month + 1) : 1;
    q = q.gte("created_at", `${from}T00:00:00+07:00`).lt("created_at", `${toY}-${String(toM).padStart(2, "0")}-01T00:00:00+07:00`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ScopedRow[];

  // ข้อมูลร้าน + Area (สำหรับตัวกรอง/อันดับ)
  const codes = [...new Set(rows.map((r) => r.dealer_code))];
  const multi = role !== "sales";
  const allowed = ctx.allowedDealerCodes === "all" ? null : ctx.allowedDealerCodes;
  let dq = sb.from("dealers").select("code, name, model, region").eq("is_active", true);
  if (role === "viewer" && allowed) dq = dq.in("code", allowed.length ? allowed : ["-"]);
  if (role === "sales") dq = dq.in("code", codes.length ? codes : ["-"]);
  const [{ data: dealers }, { data: assigns }, { data: areaReps }] = await Promise.all([
    dq,
    sb.from("rep_store_assignments").select("rep_code, dealer_code, role_in_store").eq("role_in_store", "manager"),
    sb.from("sale_reps").select("rep_code, name, nickname").eq("position", "area_mng").eq("is_active", true),
  ]);
  const areaOf = new Map<string, string>();
  (assigns ?? []).forEach((a) => areaOf.set(a.dealer_code as string, a.rep_code as string));
  const stores: StoreMeta[] = (dealers ?? []).map((d) => ({ code: d.code as string, name: d.name as string, model: (d.model as string | null) ?? null, region: (d.region as string | null) ?? null, area: areaOf.get(d.code as string) ?? null }));
  // ร้านที่ปิดแล้วแต่มีคำขอเก่า
  const known = new Set(stores.map((s) => s.code));
  const missing = codes.filter((c) => !known.has(c));
  if (missing.length) {
    const { data: extra } = await sb.from("dealers").select("code, name, model, region").in("code", missing);
    (extra ?? []).forEach((d) => stores.push({ code: d.code as string, name: d.name as string, model: (d.model as string | null) ?? null, region: (d.region as string | null) ?? null, area: areaOf.get(d.code as string) ?? null }));
  }
  const storeBy = new Map(stores.map((s) => [s.code, s]));

  const filtered = rows.filter((r) => {
    const s = storeBy.get(r.dealer_code);
    if (f.dealer && r.dealer_code !== f.dealer) return false;
    if (f.model && s?.model !== f.model) return false;
    if (f.region && s?.region !== f.region) return false;
    if (f.area && s?.area !== f.area) return false;
    return true;
  });
  const usedAreas = new Set(stores.map((s) => s.area).filter(Boolean) as string[]);
  const areas = (areaReps ?? [])
    .filter((a) => usedAreas.has(a.rep_code as string))
    .map((a) => ({ code: a.rep_code as string, name: (a.nickname ? `${a.name} (${a.nickname})` : a.name) as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
  return { role, rows: filtered, stores, storeBy, areas, multi };
}

const DAY = 86400000;

export async function buildSummary(sb: Sb, ctx: AuthContext, f: BoqFilters) {
  const { role, rows, stores, storeBy, areas, multi } = await loadScoped(sb, ctx, f);
  const ids = rows.map((r) => r.id);
  const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  const points: { request_id: number; product_code: string }[] = [];
  const quotes: { request_id: number; amount: number; created_at: string }[] = [];
  const versions: { request_id: number; v: number; submitted_at: string }[] = [];
  for (const part of chunk(ids, 300)) {
    const [p, q, v] = await Promise.all([
      sb.from("boq_points").select("request_id, product_code").in("request_id", part),
      sb.from("boq_quotes").select("request_id, amount, created_at").in("request_id", part),
      sb.from("boq_versions").select("request_id, v, submitted_at").in("request_id", part),
    ]);
    points.push(...((p.data ?? []) as typeof points));
    quotes.push(...((q.data ?? []) as typeof quotes));
    versions.push(...((v.data ?? []) as typeof versions));
  }
  const now = Date.now();
  const status: Record<string, number> = {};
  rows.forEach((r) => (status[r.status] = (status[r.status] ?? 0) + 1));
  const live = rows.filter((r) => r.status !== "cancelled");
  const quotedIds = new Set(quotes.map((q) => q.request_id));
  const lastQuote = new Map<number, number>();
  [...quotes].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((q) => lastQuote.set(q.request_id, Number(q.amount)));
  const wins = live.filter((r) => r.status === "win");
  const losses = live.filter((r) => r.status === "loss");
  const winDays = wins.filter((r) => r.closed_at).map((r) => (new Date(r.closed_at!).getTime() - new Date(r.created_at).getTime()) / DAY);

  // สินค้าที่ถูกขอ (นับจุด) + จำนวนคำขอที่ Win
  const winSet = new Set(wins.map((r) => r.id));
  const prodN = new Map<string, { n: number; win: number }>();
  points.forEach((p) => {
    const e = prodN.get(p.product_code) ?? { n: 0, win: 0 };
    e.n++;
    if (winSet.has(p.request_id)) e.win++;
    prodN.set(p.product_code, e);
  });
  const topCodes = [...prodN.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10);
  const { data: prodNames } = topCodes.length ? await sb.from("boq_products").select("code, name").in("code", topCodes.map(([c]) => c)) : { data: [] };
  const pName = new Map((prodNames ?? []).map((p) => [p.code as string, p.name as string]));

  // เหตุผล Loss
  const { data: reasons } = await sb.from("boq_loss_reasons").select("code, label").order("sort");
  const lossN = new Map<string, number>();
  losses.forEach((r) => lossN.set(r.loss_reason ?? "other", (lossN.get(r.loss_reason ?? "other") ?? 0) + 1));
  // เหตุผล Win (เลือกได้หลายข้อ ; งานเก่าที่ไม่มีเหตุผล = ไม่ระบุ)
  const { data: wreasons } = await sb.from("boq_win_reasons").select("code, label").order("sort");
  const winN = new Map<string, number>();
  wins.forEach((r) => (r.win_reasons?.length ? r.win_reasons : ["__none"]).forEach((c) => winN.set(c, (winN.get(c) ?? 0) + 1)));

  // SLA ห้องแบบ: ส่ง v1 ทันกำหนดไหม
  const firstSubmit = new Map<number, string>();
  versions.filter((v) => v.v === 1).forEach((v) => firstSubmit.set(v.request_id, v.submitted_at));
  const designerIds = [...new Set(rows.map((r) => r.designer_id).filter(Boolean) as string[])];
  const { data: dprof } = designerIds.length ? await sb.from("profiles").select("id, full_name").in("id", designerIds) : { data: [] };
  const dName = new Map((dprof ?? []).map((p) => [p.id as string, p.full_name as string]));
  const revisions = new Map<number, number>();
  versions.forEach((v) => revisions.set(v.request_id, Math.max(revisions.get(v.request_id) ?? 0, v.v)));
  const designers = designerIds.map((id) => {
    const mine = rows.filter((r) => r.designer_id === id);
    const done = mine.filter((r) => firstSubmit.has(r.id));
    const onTime = done.filter((r) => new Date(firstSubmit.get(r.id)!).getTime() <= new Date(r.due_at).getTime()).length;
    const active = mine.filter((r) => ["working", "revise"].includes(r.status)).length;
    const avgRounds = done.length ? done.reduce((s, r) => s + (revisions.get(r.id) ?? 1), 0) / done.length : null;
    return { id, name: dName.get(id) ?? "-", done: done.length, onTime, pct: done.length ? Math.round((onTime / done.length) * 100) : null, active, avgRounds };
  }).sort((a, b) => b.done - a.done);

  // เรื่องที่ต้องตาม
  const overdue = rows.filter((r) => ["waiting", "working", "revise"].includes(r.status) && new Date(r.due_at).getTime() < now);
  const staleOk = rows.filter((r) => r.status === "boq_ok" && r.boq_ok_at && now - new Date(r.boq_ok_at).getTime() > 7 * DAY);
  const staleQuote = rows.filter((r) => {
    if (r.status !== "quoted") return false;
    const q = quotes.filter((x) => x.request_id === r.id).map((x) => x.created_at).sort()[0];
    return !!q && now - new Date(q).getTime() > 30 * DAY;
  });
  const names = (list: ScopedRow[]) => [...new Set(list.map((r) => storeBy.get(r.dealer_code)?.name ?? r.dealer_code))].slice(0, 3);

  // อันดับร้าน / พนักงาน
  const group = (key: (r: ScopedRow) => string) => {
    const m = new Map<string, { req: number; quoted: number; win: number; final: number }>();
    live.forEach((r) => {
      const k = key(r);
      const e = m.get(k) ?? { req: 0, quoted: 0, win: 0, final: 0 };
      e.req++;
      if (quotedIds.has(r.id)) e.quoted++;
      if (r.status === "win") {
        e.win++;
        e.final += Number(r.final_amount ?? 0);
      }
      m.set(k, e);
    });
    return m;
  };
  const byStore = [...group((r) => r.dealer_code).entries()].map(([code, v]) => ({ code, name: storeBy.get(code)?.name ?? code, ...v })).sort((a, b) => b.req - a.req);
  const repCodes = [...new Set(live.map((r) => r.rep_code))];
  const { data: reps } = repCodes.length ? await sb.from("sale_reps").select("rep_code, name, nickname").in("rep_code", repCodes) : { data: [] };
  const rName = new Map((reps ?? []).map((r) => [r.rep_code as string, (r.nickname ? `${r.name} (${r.nickname})` : r.name) as string]));
  const byRep = [...group((r) => r.rep_code).entries()].map(([code, v]) => ({ code, name: rName.get(code) ?? code, ...v })).sort((a, b) => b.req - a.req);

  const closed = wins.length + losses.length;
  return {
    role,
    enabled: process.env.BOQ_ENABLED === "1" || ctx.isTest || role !== "sales",
    filters: f,
    options: multi
      ? {
          models: [...new Set(stores.map((s) => s.model).filter(Boolean) as string[])].sort(),
          regions: [...new Set(stores.map((s) => s.region).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "th")),
          areas,
          stores: stores.map((s) => ({ code: s.code, name: s.name, model: s.model, region: s.region, area: s.area })).sort((a, b) => a.name.localeCompare(b.name, "th")),
        }
      : null,
    status,
    funnel: { requested: live.length, quoted: live.filter((r) => quotedIds.has(r.id)).length, win: wins.length, loss: losses.length },
    winRate: closed ? Math.round((wins.length / closed) * 100) : null,
    quoteTotal: [...lastQuote.entries()].filter(([id]) => live.some((r) => r.id === id)).reduce((s, [, a]) => s + a, 0),
    finalTotal: wins.reduce((s, r) => s + Number(r.final_amount ?? 0), 0),
    avgDaysToWin: winDays.length ? Math.round(winDays.reduce((a, b) => a + b, 0) / winDays.length) : null,
    products: topCodes.map(([code, v]) => ({ code, name: pName.get(code) ?? code, ...v })),
    lossReasons: (reasons ?? []).map((r) => ({ code: r.code as string, label: r.label as string, n: lossN.get(r.code as string) ?? 0 })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n),
    winReasons: [
      ...(wreasons ?? []).map((r) => ({ code: r.code as string, label: r.label as string, n: winN.get(r.code as string) ?? 0 })),
      { code: "__none", label: "ไม่ระบุ", n: winN.get("__none") ?? 0 },
    ].filter((r) => r.n > 0).sort((a, b) => b.n - a.n),
    designers,
    attention: {
      overdue: { n: overdue.length, stores: names(overdue) },
      staleOk: { n: staleOk.length, stores: names(staleOk) },
      staleQuote: { n: staleQuote.length, stores: names(staleQuote) },
      unclaimed: rows.filter((r) => r.status === "waiting").length,
    },
    stores: byStore.slice(0, 50),
    reps: byRep.slice(0, 50),
  };
}

export type BoqSummary = Awaited<ReturnType<typeof buildSummary>>;
