"use client";

/* การ์ดแนะนำ "ติดตั้งเป็นแอปบนมือถือ" (PWA) — แสดงเฉพาะตอนเปิดผ่านเบราว์เซอร์ (ไม่แสดงเมื่อเปิดจากไอคอนแล้ว)
   - Android/Chrome: มีปุ่มติดตั้งตรง (beforeinstallprompt) ถ้าเบราว์เซอร์รองรับ
   - iPhone: ต้องกดเองใน Safari (ปุ่มแชร์ -> เพิ่มไปยังหน้าจอโฮม)
   - เปิดในแอป LINE/Facebook: แนะนำให้เปิดใน Safari/Chrome ก่อน (in-app browser ติดตั้งไม่ได้) */

import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "./icon";

type Platform = "standalone" | "ios" | "android" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const noopSubscribe = () => () => {};

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "standalone";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const detectInApp = () => /\bLine\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);

export function InstallAppHint() {
  // server snapshot = standalone -> ไม่ render ฝั่ง server (กัน hydration mismatch)
  const platform = useSyncExternalStore<Platform>(noopSubscribe, detectPlatform, () => "standalone");
  const inApp = useSyncExternalStore(noopSubscribe, detectInApp, () => false);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (platform === "standalone" || installed) return null;

  async function install() {
    if (!installEvt) return;
    await installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallEvt(null);
  }

  const showIos = platform === "ios" || platform === "other";
  const showAndroid = platform === "android" || platform === "other";

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-md p-3.5" aria-labelledby="install-hint-title">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-red-50 text-[#d32029]">
          <Icon name="install_mobile" className="text-xl" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 id="install-hint-title" className="text-[13px] font-bold text-slate-800">ติดตั้งเป็นแอปบนมือถือ</h3>
          <p className="text-[11px] text-slate-500">เปิดจากไอคอนบนหน้าจอ ไม่ต้อง login ใหม่ทุกครั้ง</p>
        </div>
        {installEvt ? (
          <button
            type="button"
            onClick={install}
            className="shrink-0 px-3 py-2 rounded-xl bg-[#d32029] text-white text-[12px] font-bold hover:-translate-y-0.5 transition-all"
          >
            ติดตั้งแอป
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="install-hint-steps"
            className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-[12px] font-bold"
          >
            {open ? "ซ่อน" : "วิธีติดตั้ง"}
          </button>
        )}
      </div>

      {open && !installEvt && (
        <div id="install-hint-steps" className="mt-3 space-y-2.5 text-[12px] text-slate-600 leading-relaxed">
          {inApp && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
              ตอนนี้เปิดอยู่ในแอป LINE/Facebook ซึ่งติดตั้งไม่ได้ — กดเมนู (⋯ หรือ ⋮) แล้วเลือก
              &quot;เปิดในเบราว์เซอร์&quot; ({platform === "ios" ? "Safari" : "Chrome"}) ก่อน
            </p>
          )}
          {showIos && (
            <div>
              <p className="font-bold text-slate-800">iPhone / iPad (Safari)</p>
              <ol className="list-decimal pl-5">
                <li>กดปุ่มแชร์ <Icon name="ios_share" className="text-sm align-middle" /> ด้านล่างจอ</li>
                <li>เลือก &quot;เพิ่มไปยังหน้าจอโฮม&quot; แล้วกด &quot;เพิ่ม&quot;</li>
              </ol>
            </div>
          )}
          {showAndroid && (
            <div>
              <p className="font-bold text-slate-800">Android (Chrome)</p>
              <ol className="list-decimal pl-5">
                <li>กดเมนู ⋮ มุมขวาบน</li>
                <li>เลือก &quot;ติดตั้งแอป&quot; หรือ &quot;เพิ่มลงในหน้าจอหลัก&quot;</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
