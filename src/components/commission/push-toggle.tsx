"use client";

/* สวิตช์ "แจ้งเตือนบนมือถือ" (หน้า ฉัน) — เตือนตรวจประเมินร้าน / งานที่ค้าง */
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/commission/push-client";
import { cn } from "@/lib/utils";

const NOTE: Record<PushState, string> = {
  unsupported: "อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน",
  "needs-install": "iPhone: เพิ่มแอปไปยังหน้าจอโฮมก่อน แล้วเปิดจากไอคอน จึงเปิดการแจ้งเตือนได้",
  denied: "ปิดการแจ้งเตือนไว้ในการตั้งค่าเครื่อง — เปิดอนุญาตให้ Retail-COMM ในการตั้งค่าก่อน",
  off: "รับแจ้งเตือนเด้ง เช่น ร้านที่ยังไม่ได้ตรวจประเมินในเดือนนี้",
  on: "เปิดอยู่บนอุปกรณ์นี้",
};

export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPushState().then((s) => !cancelled && setState(s));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === null) return null;
  const canToggle = state === "on" || state === "off";

  async function toggle() {
    setBusy(true);
    setMsg(null);
    if (state === "on") {
      await disablePush();
      setState("off");
    } else {
      const r = await enablePush();
      if (r.ok) {
        setState("on");
        setMsg("ส่งข้อความทดสอบไปที่เครื่องนี้แล้ว");
      } else {
        setMsg(r.error ?? null);
        setState(await getPushState());
      }
    }
    setBusy(false);
  }

  return (
    <div className="mt-2 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon name="notifications_active" className="text-slate-500" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-800">แจ้งเตือนบนมือถือ</p>
          <p className="text-[11px] text-slate-500">{NOTE[state]}</p>
        </div>
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={state === "on"}
            aria-label="แจ้งเตือนบนมือถือ"
            disabled={busy}
            onClick={toggle}
            className={cn("relative w-12 h-7 rounded-full transition shrink-0 disabled:opacity-50", state === "on" ? "bg-emerald-500" : "bg-slate-300")}
          >
            <span className={cn("absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all", state === "on" ? "left-[22px]" : "left-0.5")} />
          </button>
        )}
      </div>
      {msg && <p className="text-[11px] text-slate-600 mt-1.5" role="status">{msg}</p>}
    </div>
  );
}
