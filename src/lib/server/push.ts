import webpush from "web-push";
import type { createServiceClient } from "@/lib/supabase/service";

/* ส่งแจ้งเตือนเด้งบนมือถือ (Web Push) ให้ผู้ใช้ — อุปกรณ์ที่หมดอายุ (404/410) ลบทิ้งอัตโนมัติ */

type Sb = ReturnType<typeof createServiceClient>;

let configured = false;
export function pushConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** ส่งให้ทุกอุปกรณ์ของผู้ใช้ ; คืนจำนวนอุปกรณ์ที่ส่งสำเร็จ */
export async function pushToUser(sb: Sb, userId: string, msg: PushMessage): Promise<number> {
  if (!pushConfigured()) return 0;
  const { data: subs } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
        JSON.stringify(msg),
        { TTL: 12 * 3600 }
      );
      sent++;
      await sb.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return sent;
}
