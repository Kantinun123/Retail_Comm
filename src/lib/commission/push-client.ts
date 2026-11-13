"use client";

/* แจ้งเตือนเด้งบนอุปกรณ์นี้ (Web Push)
   - Android/Chrome/desktop: ใช้ได้ทันที
   - iPhone/iPad: ต้อง "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดจากไอคอน (iOS 16.4 ขึ้นไป) */

// ตัดช่องว่าง/เครื่องหมายคำพูดที่อาจติดมาจากการวางค่าใน Vercel
const PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim().replace(/^["']|["']$/g, "").trim();

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
}

export async function getPushState(): Promise<PushState> {
  if (!PUBLIC_KEY || typeof window === "undefined") return "unsupported";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIOS() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? "on" : "off";
}

/** ขออนุญาต + ลงทะเบียน แล้วส่งข้อความทดสอบ */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, error: "ยังไม่ได้อนุญาตการแจ้งเตือน" };
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) }));
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), test: true }),
    });
    const j = await res.json().catch(() => null);
    return j?.ok ? { ok: true } : { ok: false, error: j?.error ?? "ลงทะเบียนไม่สำเร็จ" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "เปิดการแจ้งเตือนไม่สำเร็จ" };
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
