"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import {
  getNotifications,
  initNotifications,
  markAllRead,
  clearNotifications,
  subscribeNotifications,
  unreadCount,
  notifIcon,
  type NotifItem,
} from "@/lib/commission/notifications";
import { useSession } from "@/lib/commission/session";
import { cn } from "@/lib/utils";

/** เวลาแบบย่อ "x นาทีที่แล้ว" / วันเวลา */
function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const d = new Date(ms);
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell({
  variant = "header",
}: {
  /** "header" = ปุ่มกลมใน header (dropdown เปิดลงล่าง)
   *  "nav" = ช่องใน bottom-nav (ไอคอน+label, dropdown เปิดขึ้นบน) */
  variant?: "header" | "nav";
}) {
  const isNav = variant === "nav";
  const { session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<NotifItem | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastSeenId = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // กลุ่มผู้รับของผู้ใช้ปัจจุบัน (admin / emp:<id> / dealer:<code>)
  const audiences: string[] = (() => {
    if (!session) return [];
    if (session.isAdmin) return ["admin"];
    if (session.isSales && session.empId) return [`emp:${session.empId}`];
    if (session.dealer?.code) return [`dealer:${session.dealer.code}`];
    return [];
  })();
  const audKey = audiences.join(",");

  // init + subscribe
  useEffect(() => {
    initNotifications();
    const myAud = audKey ? audKey.split(",") : [];
    const refresh = () => {
      const list = getNotifications(myAud);
      setItems(list);
      setUnread(unreadCount(myAud));
      // toast เมื่อมีรายการใหม่ (id บนสุดเปลี่ยน)
      const top = list[0];
      if (top && top.id !== lastSeenId.current) {
        // ข้ามการเด้ง toast ครั้งแรกที่โหลด (seed lastSeenId)
        if (lastSeenId.current !== null) {
          setToast(top);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 5000);
        }
        lastSeenId.current = top.id;
      }
    };
    // รีเซ็ต toast baseline เมื่อเปลี่ยน audience (เปลี่ยน role)
    lastSeenId.current = null;
    refresh();
    const unsub = subscribeNotifications(refresh);
    return () => {
      unsub();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [audKey]);

  // ปิด dropdown เมื่อคลิกนอกกล่อง
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    // เปิดแล้วถือว่าอ่านทั้งหมด (เฉพาะของผู้ใช้ปัจจุบัน)
    if (next && unread > 0) markAllRead(audiences);
  }

  /** กดที่แจ้งเตือน -> ไปปลายทาง (ถ้ามี) + ปิด dropdown/toast */
  function openNotif(n: NotifItem) {
    setOpen(false);
    setToast(null);
    markAllRead(audiences);
    if (!n.link) return;
    // หน้าฐานข้อมูลเปิดได้เฉพาะแอดมิน
    if (n.link.startsWith("/app/database") && !session?.isAdmin) return;
    router.push(n.link);
  }

  return (
    <>
      <div
        className={cn("relative", isNav ? "flex" : "shrink-0")}
        ref={panelRef}
      >
        {isNav ? (
          <button
            type="button"
            onClick={toggleOpen}
            aria-label="การแจ้งเตือน"
            className={cn(
              "relative flex flex-col items-center justify-center space-y-0.5 transition px-0.5 w-full",
              open ? "text-[#d32029]" : "text-slate-400 hover:text-[#d32029]"
            )}
          >
            <span className="relative">
              <Icon name="notifications" className="text-2xl" fill={unread > 0 || open} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#d32029] text-white text-[9px] font-bold flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            <span
              className={cn(
                "text-[10px] text-center leading-tight",
                open ? "font-semibold" : "font-medium"
              )}
            >
              แจ้งเตือน
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleOpen}
            aria-label="การแจ้งเตือน"
            className="relative w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#a11119] active:scale-95 transition"
          >
            <Icon name="notifications" className="text-xl" fill={unread > 0} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#d32029] text-white text-[9px] font-bold flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        )}

        {open && (
          <div
            className={cn(
              "absolute w-[290px] max-h-[380px] rounded-2xl bg-white border border-slate-100 shadow-xl z-50 overflow-hidden flex flex-col",
              isNav
                ? "bottom-full right-0 mb-2"
                : "right-0 mt-2"
            )}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100">
              <span className="text-[13px] font-bold text-slate-700">
                การแจ้งเตือน
              </span>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearNotifications()}
                  className="text-[11px] font-semibold text-slate-400 hover:text-[#a11119] transition"
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>

            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-3.5 py-8 text-center">
                  <Icon
                    name="notifications_off"
                    className="text-3xl text-slate-200"
                  />
                  <p className="text-[12px] text-slate-400 mt-1">
                    ยังไม่มีการแจ้งเตือน
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {items.map((n) => {
                    const clickable = !!n.link;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openNotif(n)}
                          disabled={!clickable}
                          className={cn(
                            "w-full text-left px-3.5 py-2.5 flex items-start space-x-2.5 transition",
                            !n.read && "bg-red-50/40",
                            clickable && "hover:bg-slate-50 cursor-pointer"
                          )}
                        >
                          <div className="w-8 h-8 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                            <Icon name={notifIcon(n)} className="text-lg" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold text-slate-700">
                              {n.title}
                            </p>
                            <p className="text-[11px] text-slate-500">{n.detail}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {timeAgo(n.time)}
                            </p>
                          </div>
                          {clickable && (
                            <Icon
                              name="chevron_right"
                              className="text-slate-300 text-lg shrink-0 self-center"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast เด้งเมื่อมีการอัปเดตใหม่ */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] w-[90%] max-w-[360px] animate-fade-up">
          <div className="rounded-2xl bg-white border border-slate-100 shadow-xl px-3.5 py-3 flex items-start space-x-2.5">
            <button
              type="button"
              onClick={() => openNotif(toast)}
              disabled={!toast.link}
              className={cn(
                "flex items-start space-x-2.5 min-w-0 flex-1 text-left",
                toast.link && "cursor-pointer"
              )}
            >
              <div className="w-8 h-8 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                <Icon name={notifIcon(toast)} className="text-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-slate-700">{toast.title}</p>
                <p className="text-[11px] text-slate-500">{toast.detail}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 text-slate-300 hover:text-slate-500"
            >
              <Icon name="close" style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
