"use client";

/* =============================================================
   แผงจัดการกิจกรรม (Event Check-in) — ฝั่ง admin ในหน้าฐานข้อมูล
   - ฟอร์มสร้างกิจกรรม: ชื่อ/รายละเอียด/เวลา/แต้ม/รหัส/Teams link
   - audience แบบ cascade 3 ชั้น: โมเดล → ร้าน (กรองตามโมเดล) → คน (กรองตามร้าน)
     เว้นว่างชั้นไหน = ไม่จำกัดชั้นนั้น; ว่างทั้งหมด = ทุกคน (AND)
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

function fmtPts(n: number): string {
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

interface Option {
  value: string;
  label: string;
}

/** รายการเลือกแบบ checkbox + ค้นหา + chips (ใช้ซ้ำ 3 ชั้น) */
function CascadePicker({
  title,
  hint,
  options,
  selected,
  onToggle,
  disabled,
}: {
  title: string;
  hint: string;
  options: Option[];
  selected: string[];
  onToggle: (v: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className={cn("rounded-lg bg-white border border-slate-200 p-2.5", disabled && "opacity-50")}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-slate-700">{title}</span>
        <span className="text-[10px] text-slate-400">
          {selected.length > 0 ? `เลือก ${selected.length}` : "ทั้งหมด"}
        </span>
      </div>
      <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>

      {!disabled && (
        <>
          {/* chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selected.map((v) => {
                const opt = options.find((o) => o.value === v);
                return (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 text-[10px] text-[#a11119] bg-[#fff0f0] border border-[#f1c0c2] px-2 py-0.5 rounded-full"
                  >
                    {opt?.label ?? v}
                    <button type="button" onClick={() => onToggle(v)}>
                      <Icon name="close" style={{ fontSize: 11 }} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <input
            className="w-full h-8 rounded-lg bg-slate-50 border border-slate-200 px-2.5 text-[12px] outline-none focus:border-[#d32029] mt-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`ค้นหา${title}...`}
          />
          <div className="mt-1.5 max-h-36 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
            {filtered.slice(0, 50).map((o) => {
              const checked = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onToggle(o.value)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-50"
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded flex items-center justify-center shrink-0",
                      checked ? "bg-[#d32029] text-white" : "border border-slate-300"
                    )}
                  >
                    {checked && <Icon name="check" style={{ fontSize: 11 }} />}
                  </span>
                  <span className="text-[12px] text-slate-700">{o.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-[11px] text-slate-400 px-2 py-2.5 text-center">ไม่พบรายการ</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function EventManagePanel({ createdBy }: { createdBy?: string }) {
  const ds = getDataset();

  // ฟอร์ม
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [points, setPoints] = useState("1");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");

  // audience cascade 3 ชั้น
  const [selModels, setSelModels] = useState<string[]>([]);
  const [selDealers, setSelDealers] = useState<string[]>([]);
  const [selEmployees, setSelEmployees] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);

  /* ---- ตัวเลือกแต่ละชั้น (กรองตามชั้นบน) ---- */
  const modelOptions = useMemo<Option[]>(() => {
    const set = new Set<string>();
    ds.dealers.forEach((d) => d.model && set.add(d.model));
    return Array.from(set).sort().map((m) => ({ value: m, label: m }));
  }, [ds.dealers]);

  // ร้าน: ถ้าเลือกโมเดล -> เฉพาะร้านในโมเดลนั้น; ไม่เลือก -> ทุกร้าน
  const dealerOptions = useMemo<Option[]>(() => {
    const inModel = (m: string) => selModels.length === 0 || selModels.includes(m);
    return ds.dealers
      .filter((d) => inModel(d.model))
      .map((d) => ({ value: d.code, label: `${d.name} (${d.code})` }));
  }, [ds.dealers, selModels]);

  // คน: ถ้าเลือกร้าน -> เฉพาะคนในร้านนั้น; ไม่งั้นจำกัดตามโมเดล (ร้านที่อยู่ในโมเดล)
  const employeeOptions = useMemo<Option[]>(() => {
    const dealersInModel = new Set(
      ds.dealers
        .filter((d) => selModels.length === 0 || selModels.includes(d.model))
        .map((d) => d.code)
    );
    return ds.salesTeam
      .filter((e) => {
        if (selDealers.length > 0) return e.dealerCode && selDealers.includes(e.dealerCode);
        if (selModels.length > 0) return e.dealerCode && dealersInModel.has(e.dealerCode);
        return true;
      })
      .map((e) => ({ value: e.id, label: `${e.name} (${e.id})` }));
  }, [ds.salesTeam, ds.dealers, selModels, selDealers]);

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

  function toggle(list: string[], setList: (v: string[]) => void, v: string) {
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  /** toggle โมเดล + ตัดร้าน/คนที่หลุดขอบเขตใหม่ออก (prune ชั้นล่าง) */
  function toggleModel(v: string) {
    const nextModels = selModels.includes(v)
      ? selModels.filter((x) => x !== v)
      : [...selModels, v];
    setSelModels(nextModels);

    // ร้านที่ยังอยู่ในขอบเขตโมเดลใหม่
    const dealersInModel = new Set(
      ds.dealers
        .filter((d) => nextModels.length === 0 || nextModels.includes(d.model))
        .map((d) => d.code)
    );
    const nextDealers = selDealers.filter((c) => dealersInModel.has(c));
    setSelDealers(nextDealers);

    // คนที่ยังอยู่ในขอบเขต (ตามร้านที่เหลือ หรือโมเดล)
    pruneEmployees(nextModels, nextDealers);
  }

  /** toggle ร้าน + ตัดคนที่หลุดออก */
  function toggleDealer(v: string) {
    const nextDealers = selDealers.includes(v)
      ? selDealers.filter((x) => x !== v)
      : [...selDealers, v];
    setSelDealers(nextDealers);
    pruneEmployees(selModels, nextDealers);
  }

  /** ตัดคนที่ไม่อยู่ในขอบเขตโมเดล/ร้านที่กำหนด */
  function pruneEmployees(models: string[], dealers: string[]) {
    const dealersInModel = new Set(
      ds.dealers
        .filter((d) => models.length === 0 || models.includes(d.model))
        .map((d) => d.code)
    );
    setSelEmployees((prev) =>
      prev.filter((empId) => {
        const emp = ds.salesTeam.find((e) => e.id === empId);
        if (!emp?.dealerCode) return false;
        if (dealers.length > 0) return dealers.includes(emp.dealerCode);
        if (models.length > 0) return dealersInModel.has(emp.dealerCode);
        return true;
      })
    );
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setCode("");
    setPoints("1");
    setStartsAt("");
    setEndsAt("");
    setMeetingUrl("");
    setSelModels([]);
    setSelDealers([]);
    setSelEmployees([]);
  }

  async function submit() {
    if (busy) return;
    setMsg(null);
    if (!title.trim() || !code.trim() || !startsAt || !endsAt) {
      setMsg("กรอกชื่อ รหัส และช่วงเวลาให้ครบ");
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
      audienceModels: selModels.length > 0 ? selModels : undefined,
      audienceDealers: selDealers.length > 0 ? selDealers : undefined,
      audienceEmployees: selEmployees.length > 0 ? selEmployees : undefined,
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

  /** สรุป audience ของกิจกรรมเป็นข้อความ */
  function audienceSummary(ev: AdminEvent): string {
    const parts: string[] = [];
    if (ev.audienceModels?.length) parts.push(`${ev.audienceModels.length} โมเดล`);
    if (ev.audienceDealers?.length) parts.push(`${ev.audienceDealers.length} ร้าน`);
    if (ev.audienceEmployees?.length) parts.push(`${ev.audienceEmployees.length} คน`);
    return parts.length === 0 ? "ทุกคน" : parts.join(" · ");
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

        {/* audience cascade 3 ชั้น */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <Icon name="group" style={{ fontSize: 14 }} className="text-slate-400" />
            กลุ่มผู้เห็นกิจกรรม (เลือกซ้อนลำดับชั้น)
          </label>
          <p className="text-[10px] text-slate-400 mt-0.5">
            เว้นว่างทุกชั้น = ทุกคน · เลือกชั้นบนเพื่อกรองชั้นล่าง
          </p>

          <div className="mt-2.5 space-y-2">
            {/* ชั้น 1: โมเดล */}
            <CascadePicker
              title="โมเดล"
              hint="เลือกโมเดลร้าน (เว้นว่าง = ทุกโมเดล)"
              options={modelOptions}
              selected={selModels}
              onToggle={toggleModel}
            />
            {/* ชั้น 2: ร้าน (กรองตามโมเดล) */}
            <div className="flex justify-center">
              <Icon name="south" style={{ fontSize: 16 }} className="text-slate-300" />
            </div>
            <CascadePicker
              title="ร้าน"
              hint={
                selModels.length > 0
                  ? "เฉพาะร้านในโมเดลที่เลือก (เว้นว่าง = ทุกร้านในโมเดล)"
                  : "เลือกร้าน (เว้นว่าง = ทุกร้าน)"
              }
              options={dealerOptions}
              selected={selDealers}
              onToggle={toggleDealer}
            />
            {/* ชั้น 3: คน (กรองตามร้าน) */}
            <div className="flex justify-center">
              <Icon name="south" style={{ fontSize: 16 }} className="text-slate-300" />
            </div>
            <CascadePicker
              title="รายคน"
              hint={
                selDealers.length > 0
                  ? "เฉพาะพนักงานในร้านที่เลือก (เว้นว่าง = ทุกคนในร้าน)"
                  : "เลือกพนักงาน (เว้นว่าง = ทุกคนในขอบเขตด้านบน)"
              }
              options={employeeOptions}
              selected={selEmployees}
              onToggle={(v) => toggle(selEmployees, setSelEmployees, v)}
            />
          </div>
        </div>

        {msg && <p className="text-[12px] font-semibold text-[#a11119]">{msg}</p>}

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
                    รหัส {ev.code} · +{fmtPts(ev.points)} แต้ม · {audienceSummary(ev)}
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
