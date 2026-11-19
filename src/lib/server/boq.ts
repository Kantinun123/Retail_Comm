/* BOQ สินค้า DECAAR — กติกากลางฝั่ง server (สิทธิ์, SLA วันทำการ, ชื่อผู้กระทำ, แจ้งเตือน) */
import type { AuthContext } from "@/lib/supabase/auth-context";
import { canAccessDealer } from "@/lib/supabase/auth-context";
import type { createServiceClient } from "@/lib/supabase/service";
import { pushToUser } from "@/lib/server/push";

type Sb = ReturnType<typeof createServiceClient>;

export const BOQ_BUCKET = "boq-files";
export const BOQ_STATUSES = ["waiting", "working", "submitted", "revise", "boq_ok", "quoted", "win", "loss", "cancelled"] as const;
export type BoqStatus = (typeof BOQ_STATUSES)[number];
export const FILE_KINDS = ["photo", "plan", "old_design", "boq", "d3"] as const;
export type BoqFileKind = (typeof FILE_KINDS)[number];

/** SLA ห้องแบบ (วันทำการ) นับจากเวลาที่พนักงานส่งคำขอ */
export const slaDays = (need: string) => (need === "boq_3d" ? 5 : 3);

/** บทบาทที่เปิดหน้า BOQ ได้ */
export function boqRoleOf(ctx: AuthContext): "sales" | "designer" | "marketing" | "admin" | "viewer" {
  if (ctx.role === "sales") return "sales";
  if (ctx.role === "designer") return "designer";
  if (ctx.role === "marketing") return "marketing";
  if (ctx.role === "admin") return "admin";
  return "viewer"; // ร้าน / Area / Coach / หัวหน้า Area = ดูตามขอบเขตร้าน
}

/** ผู้ใช้เห็นคำขอนี้ได้ไหม */
/** คำขอจากบัญชีทดสอบ เห็นเฉพาะบัญชีทดสอบ (และ admin) — กันห้องแบบทดสอบไปรับงานจริง / งานทดสอบปนในรายงาน */
export function canViewRequest(ctx: AuthContext, req: { rep_code: string; dealer_code: string; is_test?: boolean | null }): boolean {
  const r = boqRoleOf(ctx);
  if (r !== "admin" && !!req.is_test !== ctx.isTest) return false;
  if (r === "designer" || r === "marketing" || r === "admin") return true;
  if (r === "sales") return req.rep_code === ctx.repCode;
  return canAccessDealer(ctx, req.dealer_code);
}

/* ---------- วันทำการ (เวลาไทย) ---------- */
const bkkDate = (d: Date) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const addDay = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isWeekend = (ymd: string) => {
  const w = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return w === 0 || w === 6;
};

export async function loadHolidays(sb: Sb): Promise<Set<string>> {
  const from = addDay(bkkDate(new Date()), -60);
  const { data } = await sb.from("business_holidays").select("day").gte("day", from);
  return new Set((data ?? []).map((r) => String(r.day)));
}

/** ครบกำหนด = 17:00 ของวันทำการที่ n หลังวันที่ส่ง (ข้ามเสาร์-อาทิตย์ + วันหยุด) */
export function dueAfterBusinessDays(from: Date, n: number, holidays: Set<string>): Date {
  let d = bkkDate(from);
  let left = n;
  while (left > 0) {
    d = addDay(d, 1);
    if (!isWeekend(d) && !holidays.has(d)) left--;
  }
  return new Date(`${d}T17:00:00+07:00`);
}

/* ---------- ชื่อผู้ใช้ ---------- */
export async function actorName(sb: Sb, ctx: AuthContext): Promise<string> {
  if (ctx.repCode) {
    const { data } = await sb.from("sale_reps").select("name, nickname").eq("rep_code", ctx.repCode).maybeSingle();
    if (data?.name) return data.nickname ? `${data.name} (${data.nickname})` : (data.name as string);
  }
  const { data } = await sb.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle();
  return (data?.full_name as string | null) ?? ctx.email ?? "ผู้ใช้";
}

export async function addEvent(sb: Sb, requestId: number, ctx: AuthContext | null, name: string, kind: string, text: string, tone?: "warn" | "ok" | "bad") {
  await sb.from("boq_events").insert({ request_id: requestId, actor_id: ctx?.userId ?? null, actor_name: name, kind, text, tone: tone ?? null });
}

/* ---------- แจ้งเตือน ---------- */
const reqUrl = (id: number) => `/app/boq/${id}`;

/** ส่ง push ไม่ให้ทำ request หลักพัง */
async function safePush(sb: Sb, userIds: string[], title: string, body: string, url: string) {
  await Promise.all(userIds.map((u) => pushToUser(sb, u, { title, body, url, tag: url }).catch(() => 0)));
}

export async function designerIds(sb: Sb, isTest: boolean): Promise<string[]> {
  const { data } = await sb.from("profiles").select("id").eq("role", "designer").eq("status", "approved").eq("is_test", isTest);
  return (data ?? []).map((r) => r.id as string);
}

/** บัญชีพนักงานขายเจ้าของคำขอ (บัญชีทดสอบที่ผูกคนเดียวกันแยกกลุ่มด้วย is_test) */
export async function salesUserIds(sb: Sb, repCode: string, isTest: boolean): Promise<string[]> {
  const { data } = await sb.from("profiles").select("id").eq("role", "sales").eq("rep_code", repCode).eq("status", "approved").eq("is_test", isTest);
  return (data ?? []).map((r) => r.id as string);
}

export async function marketingIds(sb: Sb, isTest: boolean): Promise<string[]> {
  const { data } = await sb.from("profiles").select("id").eq("role", "marketing").eq("status", "approved").eq("is_test", isTest);
  return (data ?? []).map((r) => r.id as string);
}

/** Win ยอดใหญ่ -> แจ้ง Marketing (บาท) */
export const BIG_WIN = 300000;
/** Loss ที่เสียให้ยี่ห้ออื่น -> แจ้ง Marketing */
export const LOSS_TO_BRAND = ["price_other_brand", "stock_other_brand"];

export async function notifyBoq(
  sb: Sb,
  req: { id: number; req_no: string; customer_name: string; rep_code: string; designer_id: string | null; is_test: boolean },
  event: "new" | "claimed" | "submitted" | "revise" | "approved" | "released" | "cancelled" | "win_big" | "loss_brand",
  extra?: string
) {
  const who = `${req.req_no} · ${req.customer_name}`;
  const url = reqUrl(req.id);
  switch (event) {
    case "new":
    case "released":
      return safePush(sb, await designerIds(sb, req.is_test), event === "new" ? "คำขอ BOQ DECAAR ใหม่" : "มีงาน BOQ ถูกปล่อยคืน", `${who} — รอห้องแบบรับงาน`, url);
    case "claimed":
      return safePush(sb, await salesUserIds(sb, req.rep_code, req.is_test), "ห้องแบบรับงานแล้ว", who, url);
    case "submitted":
      return safePush(sb, await salesUserIds(sb, req.rep_code, req.is_test), "ห้องแบบส่ง BOQ แล้ว", `${who} — รอคุณตรวจ`, url);
    case "revise":
      return req.designer_id ? safePush(sb, [req.designer_id], "พนักงานขอแก้ไข BOQ", who, url) : undefined;
    case "approved":
      return req.designer_id ? safePush(sb, [req.designer_id], "BOQ ผ่านแล้ว · ปิดงานห้องแบบ", who, url) : undefined;
    case "cancelled":
      return req.designer_id ? safePush(sb, [req.designer_id], "คำขอ BOQ ถูกยกเลิก", who, url) : undefined;
    case "win_big":
      return safePush(sb, await marketingIds(sb, req.is_test), "Win ยอดใหญ่ · BOQ DECAAR", `${who} — ${extra ?? ""}`, url);
    case "loss_brand":
      return safePush(sb, await marketingIds(sb, req.is_test), "Loss ให้ยี่ห้ออื่น · BOQ DECAAR", `${who} — ${extra ?? ""}`, url);
  }
}

/** ชื่อไฟล์ที่ปลอดภัยสำหรับ path ใน Storage (คงนามสกุลไว้) */
export function safeFileName(name: string): string {
  const ext = (name.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? "").toLowerCase();
  // Storage key ใช้ ASCII เท่านั้น (ชื่อไทยเก็บใน boq_files.name แทน)
  const base = name.slice(0, name.length - ext.length).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "file";
  return `${base}${ext}`;
}
