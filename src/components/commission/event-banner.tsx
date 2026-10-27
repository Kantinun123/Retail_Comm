"use client";

/* =============================================================
   แบนเนอร์กิจกรรม (Event Check-in) — แสดงในหน้า "ฉัน" เฉพาะ sales
   - โหลดกิจกรรมที่เห็นได้จาก /api/events (visible_events)
   - ปุ่มเข้าห้องประชุม Teams (ถ้ามี meeting_url)
   - กรอกรหัส + เช็คอินรับแต้ม
   ============================================================= */
import { useCallback, useEffect, useState } from "react";
import { Icon } from "./icon";
import {
  fetchVisibleEvents,
  performEventCheckin,
  type VisibleEvent,
} from "@/lib/commission/event-store";
import { cn } from "@/lib/utils";

function fmtPts(n: number): string {
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function fmtTimeRange(startISO: string, endISO: string): string {
  try {
    const s = new Date(startISO);
    const e = new Date(endISO);
    const d = s.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    const t = (x: Date) =>
      x.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    return `${d} · ${t(s)} – ${t(e)} น.`;
  } catch {
    return "";
  }
}

/** การ์ดกิจกรรม 1 ใบ */
function EventCard({
  empId,
  event,
  onDone,
}: {
  empId: string;
  event: VisibleEvent;
  onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onCheckin() {
    if (busy || !code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await performEventCheckin(empId, event.id, code.trim());
      if (res.ok && !res.already) {
        setMsg(`เช็คอินสำเร็จ รับ +${fmtPts(res.points)} แต้ม 🎉`);
        onDone();
      } else if (res.already) {
        setMsg("คุณเช็คอินกิจกรรมนี้ไปแล้ว");
        onDone();
      } else {
        setMsg(res.error ?? "เช็คอินไม่สำเร็จ");
      }
    } catch {
      setMsg("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-[#d32029]/25 shadow-sm overflow-hidden">
      {/* ribbon */}
      <div className="bg-[#fff0f0] px-4 py-1.5 flex items-center justify-between">
        <span className="text-[12px] font-bold text-[#a11119]">📣 ประกาศกิจกรรม</span>
        {event.checkedIn ? (
          <span className="text-[10px] font-bold text-white bg-[#16a34a] px-2 py-0.5 rounded-full">
            เข้าร่วมแล้ว
          </span>
        ) : event.inWindow ? (
          <span className="text-[10px] font-bold text-white bg-[#16a34a] px-2 py-0.5 rounded-full">
            เปิดรับ
          </span>
        ) : (
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            ยังไม่เริ่ม
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-[15px] font-bold text-slate-900">{event.title}</p>
        <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1">
          <Icon name="schedule" style={{ fontSize: 14 }} />
          {fmtTimeRange(event.startsAt, event.endsAt)}
        </p>
        {event.description && (
          <p className="text-[12px] text-slate-500 mt-1">{event.description}</p>
        )}

        <span className="inline-flex items-center gap-1 mt-2 text-[12px] font-bold text-[#b45309] bg-[#fff7ed] px-2.5 py-1 rounded-full">
          🎁 รับ +{fmtPts(event.points)} แต้ม
        </span>

        {/* ปุ่มเข้าห้องประชุม Teams */}
        {event.meetingUrl && (
          <a
            href={event.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full py-2.5 rounded-xl bg-[#5b5fc7] hover:bg-[#4b4fa8] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.99] transition"
          >
            <Icon name="groups" style={{ fontSize: 18 }} />
            เข้าห้องประชุม Microsoft Teams
            <Icon name="open_in_new" style={{ fontSize: 14 }} />
          </a>
        )}

        {/* เช็คอิน */}
        {event.checkedIn ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
            <Icon name="check_circle" className="text-[#16a34a] text-xl" fill />
            <span className="text-[12px] font-semibold text-emerald-700">
              เข้าร่วมแล้ว · ได้รับ +{fmtPts(event.points)} แต้ม
            </span>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="กรอกรหัสกิจกรรม"
                disabled={!event.inWindow || busy}
                className="flex-1 h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-[13px] outline-none focus:border-[#d32029] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={onCheckin}
                disabled={!event.inWindow || busy || !code.trim()}
                className={cn(
                  "h-10 px-4 rounded-xl text-[13px] font-bold text-white flex items-center gap-1 transition active:scale-95",
                  !event.inWindow || busy || !code.trim()
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-[#d32029] hover:bg-[#b91c21]"
                )}
              >
                <Icon name="check" style={{ fontSize: 16 }} />
                เช็คอิน
              </button>
            </div>
            {!event.inWindow && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                ยังไม่ถึงเวลาเช็คอิน
              </p>
            )}
            {msg && (
              <p className="text-[11px] font-medium text-[#a11119] mt-1.5">{msg}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** แบนเนอร์รวม: โหลด visible events แล้ว render ทีละการ์ด */
export function EventBanner({ empId }: { empId: string }) {
  const [events, setEvents] = useState<VisibleEvent[]>([]);

  const load = useCallback(() => {
    fetchVisibleEvents(empId)
      .then(setEvents)
      .catch(() => {});
  }, [empId]);

  useEffect(() => {
    let cancelled = false;
    fetchVisibleEvents(empId)
      .then((ev) => {
        if (!cancelled) setEvents(ev);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [empId]);

  if (events.length === 0) return null;

  return (
    <div className="space-y-3">
      {events.map((ev) => (
        <EventCard key={ev.id} empId={empId} event={ev} onDone={load} />
      ))}
    </div>
  );
}
