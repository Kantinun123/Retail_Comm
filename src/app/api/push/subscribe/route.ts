import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-context";
import { createServiceClient } from "@/lib/supabase/service";
import { pushToUser } from "@/lib/server/push";

/**
 * ลงทะเบียน / ยกเลิก แจ้งเตือนเด้งบนอุปกรณ์นี้ (ผู้ใช้ที่ login จริงเท่านั้น)
 * - POST   { subscription: { endpoint, keys: { p256dh, auth } }, test?: boolean }
 * - DELETE { endpoint }
 */
export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  let body: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; test?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const s = body.subscription;
  const endpoint = String(s?.endpoint ?? "");
  if (!/^https:\/\//.test(endpoint) || !s?.keys?.p256dh || !s.keys.auth) {
    return NextResponse.json({ ok: false, error: "invalid subscription" }, { status: 400 });
  }
  const sb = createServiceClient();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: ctx.userId,
      endpoint,
      p256dh: s.keys.p256dh,
      auth: s.keys.auth,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 200),
    },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  let sent = 0;
  if (body.test) {
    sent = await pushToUser(sb, ctx.userId, { title: "Retail-COMM", body: "เปิดการแจ้งเตือนเรียบร้อยแล้ว ✅", url: "/app/member", tag: "test" });
  }
  return NextResponse.json({ ok: true, sent });
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const sb = createServiceClient();
  await sb.from("push_subscriptions").delete().eq("user_id", ctx.userId).eq("endpoint", String(body.endpoint ?? ""));
  return NextResponse.json({ ok: true });
}
