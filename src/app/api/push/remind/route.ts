import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { bangkokToday, buildTracking, daysInMonth } from "@/lib/server/eval-tracking";
import { pushConfigured, pushToUser } from "@/lib/server/push";
import { thaiMonth } from "@/lib/server/thai-month";

/** Admin กด "ส่งเตือนตอนนี้" ให้ Coach คนหนึ่ง — POST { repCode } */
export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  if (ctx.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่าแจ้งเตือนบนเซิร์ฟเวอร์ (VAPID)" }, { status: 503 });
  let body: { repCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const repCode = String(body.repCode ?? "").trim();
  if (!repCode) return NextResponse.json({ ok: false, error: "missing repCode" }, { status: 400 });

  const sb = createServiceClient();
  const today = bangkokToday();
  const period = today.slice(0, 7);
  const t = await buildTracking(sb, period, null);
  const c = t.coaches.find((x) => x.repCode === repCode);
  if (!c) return NextResponse.json({ ok: false, error: "ไม่พบ Coach" }, { status: 404 });
  const missing = c.total - c.done;
  const { data: users } = await sb.from("profiles").select("id").eq("rep_code", repCode).eq("status", "approved");
  if (!users?.length) return NextResponse.json({ ok: false, error: "Coach คนนี้ยังไม่มีบัญชีในแอป" }, { status: 400 });
  let sent = 0;
  for (const u of users) {
    sent += await pushToUser(sb, u.id as string, {
      title: `ตรวจประเมินร้าน ${thaiMonth(period)}`,
      body: missing > 0 ? `ยังเหลือ ${missing} จาก ${c.total} ร้าน · เหลือเวลา ${daysInMonth(period) - Number(today.slice(8))} วัน` : "ตรวจครบทุกร้านแล้ว ขอบคุณครับ",
      url: "/app/eval-tracking",
      tag: "eval-coach",
    });
  }
  if (!sent) return NextResponse.json({ ok: false, error: "Coach ยังไม่ได้เปิดการแจ้งเตือนบนมือถือ (ส่งไม่ถึง)" }, { status: 400 });
  return NextResponse.json({ ok: true, sent });
}
