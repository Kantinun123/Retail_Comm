"use client";

/* =============================================================
   แผงจัดการกิจกรรม (Event Check-in) — ฝั่ง admin ในหน้าฐานข้อมูล
   - ฟอร์มสร้างกิจกรรม: ชื่อ/รายละเอียด/เวลา/แต้ม/รหัส/Teams link/audience (4 โหมด)
   - รายการกิจกรรม + จำนวนเช็คอิน + ปุ่มปิด
   ============================================================= */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { getDataset } from "@/lib/commission/dataset";
import {
  fetchAdminEvents,
  createEvent,
  closeEvent,
  type AdminEvent,
  type NewEventInput,
} from "@/lib/commission/event-store";
import { cn } from "@/lib/utils";

type AudienceMode = "all" | "dealers" | "models" | "employees";

const MODE_LABELS: Record<AudienceMode, string> = {
  all: "ทั้งหมด",
  dealers: "ตามร้าน",
  models: "ตามโมเดล",
  employees: "รายคน",
};

function fmtPts(n: number): string {
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

export function EventManagePanel({ createdBy }: { createdBy?: string }) {
  const ds = getDataset();

  // ตัวเลือก audience จาก dataset
  const dealerOptions = useMemo(
    () => ds.dealers.map((d) => ({ value: d.code, label: `${d.name} (${d.code})` })),
    [ds.dealers]
  );
  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    ds.dealers.forEach((d) => d.model && set.add(d.model));
    return Array.from(set).sort().map((m) => ({ value: m, label: m }));
  }, [ds.dealers]);
  const employeeOptions = useMemo(
    () =>
      ds.salesTeam
        .filter((e) => e.role === "พนักงานขาย" || true)
        .map((e) => ({ value: e.id, label: `${e.name} (${e.id})` })),
    [ds.salesTeam]
  );

  // ฟอร์ม
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [points, setPoints] = useState("1");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [audienceValues, setAudienceValues] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // รายการกิจกรรม
  const [events, setEvents] = useState<AdminEvent[]>([]);

  const loadEvents = useCallback(() => {
    fetchAdminEvents()
      .then(setEvents)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminEvents()
      .then((ev) => {
        if (!cancelled) setEvents(ev);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const currentOptions =
    audienceMode === "dealers"
      ? dealerOptions
      : audienceMode === "models"
        ? modelOptions
        : audienceMode === "employees"
          ? employeeOptions
          : [];

  const filteredOptions = currentOptions.filter((o) =>
    o.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  function toggleValue(v: string) {
    setAudienceValues((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  function changeMode(m: AudienceMode) {
    setAudienceMode(m);
    setAudienceValues([]);
    setSearch("");
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setCode("");
    setPoints("1");
    setStartsAt("");
    setEndsAt("");
    setMeetingUrl("");
    setAudienceMode("all");
    setAudienceValues([]);
    setSearch("");
  }

  async function submit() {
    if (busy) return;
    setMsg(null);
    // validate เบื้องต้นฝั่ง client (server validate ซ้ำ)
    if (!title.trim() || !code.trim() || !startsAt || !endsAt) {
      setMsg("กรอกชื่อ รหัส และช่วงเวลาให้ครบ");
      return;
    }
    if (audienceMode !== "all" && audienceValues.length === 0) {
      setMsg("เลือกกลุ่มเป้าหมายอย่างน้อย 1 รายการ");
      return;
    }
    const input: NewEventInput = {
      title: title.trim(),
      description: description.trim(),
      code: code.trim(),
      points: Number(points) || 0,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      meetingUrl: meetingUrl.trim() || undefined,
      audienceMode,
      audienceValues: audienceMode === "all" ? undefined : audienceValues,
      createdBy,
    };
    setBusy(true);
    try {
      const res = await createEvent(input);
      if (res.ok) {
        setMsg("สร้างกิจกรรมสำเร็จ");
        resetForm();
        loadEvents();
      } else {
        setMsg(res.error ?? "สร้างไม่สำเร็จ");
      }
    } catch {
      setMsg("เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 3500);
    }
  }

  async function onClose(id: number) {
    const res = await closeEvent(id);
    if (res.ok) loadEvents();
  }

  const inputCls =
    "w-full h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-[13px] outline-none focus:border-[#d32029]";

  return (
    <section className="mt-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
        <Icon name="campaign" className="text-lg text-[#d32029]" />
        จัดการกิจกรรม (เช็คอินรับแต้ม)
      </h3>
      <p className="text-[11px] text-slate-400 mt-0.5">
        ประกาศกิจกรรม → พนักงานขายเห็นแบนเนอร์ในหน้า &quot;ฉัน&quot; และกรอกรหัสเพื่อรับแต้ม
      </p>

      {/* ฟอร์มสร้าง */}
      <div className="mt-3 space-y-2.5">
        <div>
          <label className="text-[11px] font-semibold text-slate-600">ชื่อกิจกรรม</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="อบรม Solar Roof รุ่น 2" />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-600">รายละเอียด (ไม่บังคับ)</label>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="รายละเอียดกิจกรรม / สถานที่" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-600">เริ่มเช็คอิน</label>
            <input type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600">สิ้นสุดเช็คอิน</label>
            <input type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-600">แต้มที่ได้</label>
            <input type="number" step="0.1" min="0" className={inputCls} value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600">รหัสกิจกรรม</label>
            <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="SOLAR2026" />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-600">🔗 ลิงก์ประชุม MS Teams (ไม่บังคับ)</label>
          <input className={inputCls} value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://teams.microsoft.com/l/meetup-join/..." />
          <p className="text-[10px] text-slate-400 mt-1">รองรับเฉพาะ https ของ teams.microsoft.com / teams.live.com</p>
        </div>

        {/* audience */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <Icon name="group" style={{ fontSize: 14 }} className="text-slate-400" />
            กลุ่มผู้เห็นกิจกรรม
          </label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(Object.keys(MODE_LABELS) as AudienceMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => changeMode(m)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12px] font-semibold transition active:scale-95",
                  audienceMode === m
                    ? "bg-[#d32029] text-white"
                    : "bg-white border border-slate-200 text-slate-600"
                )}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {audienceMode !== "all" && (
            <div className="mt-2.5">
              {/* chips ที่เลือก */}
              {audienceValues.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {audienceValues.map((v) => {
                    const opt = currentOptions.find((o) => o.value === v);
                    return (
                      <span
                        key={v}
                        className="inline-flex items-center gap-1 text-[11px] text-[#a11119] bg-[#fff0f0] border border-[#f1c0c2] px-2 py-1 rounded-full"
                      >
                        {opt?.label ?? v}
                        <button type="button" onClick={() => toggleValue(v)}>
                          <Icon name="close" style={{ fontSize: 12 }} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <input
                className={inputCls}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`ค้นหา${MODE_LABELS[audienceMode]}...`}
              />
              <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                {filteredOptions.slice(0, 50).map((o) => {
                  const checked = audienceValues.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleValue(o.value)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50"
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded flex items-center justify-center shrink-0",
                          checked ? "bg-[#d32029] text-white" : "border border-slate-300"
                        )}
                      >
                        {checked && <Icon name="check" style={{ fontSize: 12 }} />}
                      </span>
                      <span className="text-[12px] text-slate-700">{o.label}</span>
                    </button>
                  );
                })}
                {filteredOptions.length === 0 && (
                  <p className="text-[11px] text-slate-400 px-2.5 py-3 text-center">ไม่พบรายการ</p>
                )}
              </div>
            </div>
          )}
        </div>

        {msg && (
          <p className="text-[12px] font-semibold text-[#a11119]">{msg}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d32029] to-[#8f1114] text-white text-[14px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.99] transition disabled:opacity-50"
        >
          <Icon name="add_circle" style={{ fontSize: 18 }} />
          {busy ? "กำลังบันทึก..." : "บันทึกและเปิดกิจกรรม"}
        </button>
      </div>

      {/* รายการกิจกรรม */}
      {events.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-[12px] font-bold text-slate-600 mb-2">กิจกรรมทั้งหมด</p>
          <div className="space-y-2">
            {events.map((ev) => (
              <div
                key={ev.id}
                className={cn(
                  "rounded-xl border p-3 flex items-start gap-2",
                  ev.active ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-70"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{ev.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    รหัส {ev.code} · +{fmtPts(ev.points)} แต้ม ·{" "}
                    {ev.audienceMode === "all"
                      ? "ทุกคน"
                      : `${MODE_LABELS[ev.audienceMode]} ${ev.audienceValues?.length ?? 0} รายการ`}
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-bold text-[#16a34a] bg-emerald-50 px-2 py-0.5 rounded-full">
                    เช็คอินแล้ว {ev.checkinCount}
                  </span>
                  {ev.meetingUrl && (
                    <span className="inline-block ml-1.5 mt-1 text-[10px] font-semibold text-[#5b5fc7] bg-[#eef0fb] px-2 py-0.5 rounded-full">
                      Teams
                    </span>
                  )}
                </div>
                {ev.active && (
                  <button
                    type="button"
                    onClick={() => onClose(ev.id)}
                    className="shrink-0 text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-red-200 active:scale-95 transition"
                  >
                    ปิด
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
