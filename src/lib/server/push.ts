import webpush from "web-push";
import type { createServiceClient } from "@/lib/supabase/service";

/* ส่งแจ้งเตือนเด้งบนมือถือ (Web Push) ให้ผู้ใช้ — อุปกรณ์ที่หมดอายุ (404/410) ลบทิ้งอัตโนมัติ */

type Sb = ReturnType<typeof createServiceClient>;

let configured = false;
/** เหตุผลที่ตั้งค่า push ไม่ได้ (ข้อความจาก web-push ไม่มีค่าคีย์) — ใช้แสดงใน cron dry-run */
export let pushConfigError: string | null = null;

// ค่าที่วางใน Vercel อาจติดช่องว่าง/ขึ้นบรรทัด/เครื่องหมายคำพูดมา -> ตัดออกก่อนใช้
const envClean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();

export function pushConfigured(): boolean {
  if (configured) return true;
  const pub = envClean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const priv = envClean(process.env.VAPID_PRIVATE_KEY);
  if (!pub || !priv) {
    pushConfigError = `missing ${!pub ? "NEXT_PUBLIC_VAPID_PUBLIC_KEY" : ""}${!pub && !priv ? " + " : ""}${!priv ? "VAPID_PRIVATE_KEY" : ""}`;
    return false;
  }
  try {
    // subject ต้องเป็น mailto: หรือ https: — ถ้าใส่มาแค่อีเมล เติม mailto: ให้
    const subjRaw = envClean(process.env.VAPID_SUBJECT) || "mailto:admin@example.com";
    const subject = /^(mailto:|https:)/i.test(subjRaw) ? subjRaw : subjRaw.includes("@") ? `mailto:${subjRaw}` : subjRaw;
    webpush.setVapidDetails(subject, pub, priv);
  } catch (e) {
    // คีย์/subject ผิดรูปแบบ: ไม่ให้ทั้ง route พัง (500) แค่ถือว่ายังส่งไม่ได้
    pushConfigError = e instanceof Error ? e.message : "invalid VAPID config";
    return false;
  }
  pushConfigError = null;
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
