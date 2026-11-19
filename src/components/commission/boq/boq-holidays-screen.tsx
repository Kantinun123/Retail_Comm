"use client";
/* admin: วันหยุดที่ไม่นับเป็นวันทำการของ SLA ห้องแบบ (เสาร์-อาทิตย์ไม่นับอยู่แล้ว) */
import { useEffect, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import { dateTh } from "@/lib/commission/boq-store";
import { BoqHeader, btn, card, inputCls, labelCls } from "./boq-shared";

type Holiday = { day: string; name: string };
const WD = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export function BoqHolidaysScreen() {
  const { session, ready } = useSession();
  const [list, setList] = useState<Holiday[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [day, setDay] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/holidays", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok: boolean; holidays?: Holiday[]; error?: string }) => {
        if (cancelled) return;
        if (j.ok) setList(j.holidays ?? []);
        else setError(j.error === "unauthenticated" ? "ต้องเข้าระบบด้วยบัญชี admin จริง" : j.error ?? "โหลดไม่สำเร็จ");
      })
      .catch(() => !cancelled && setError("โหลดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const send = async (body: Record<string, string>) => {
    setSaving(true);
    setError("");
    const r = await fetch("/api/admin/holidays", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!j.ok) return setError(j.error ?? "บันทึกไม่สำเร็จ");
    setDay("");
    setName("");
    setReload((n) => n + 1);
  };

  if (!ready || !session) return null;
  if (!session.isAdmin) return <p className="text-[12px] text-slate-500 py-8 text-center">เฉพาะผู้ดูแลระบบ</p>;
  const years = [...new Set((list ?? []).map((h) => h.day.slice(0, 4)))];

  return (
    <>
      <BoqHeader title="วันหยุด (SLA ห้องแบบ)" back="/app/boq" />
      <div className="space-y-3 pb-6">
        <p className="text-[11px] text-slate-500 px-1">วันในรายการนี้และเสาร์-อาทิตย์ไม่นับเป็นวันทำการ เมื่อคำนวณกำหนดส่ง BOQ (3 / 5 วันทำการ) ของคำขอใหม่</p>
        <section className={cn(card, "p-4 space-y-2")}>
          <h3 className="text-[13px] font-bold text-slate-800">เพิ่มวันหยุด</h3>
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <div>
              <label className={labelCls}>วันที่</label>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ชื่อวันหยุด</label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="เช่น วันหยุดบริษัท" className={inputCls} />
            </div>
          </div>
          <button type="button" disabled={saving || !day || !name.trim()} onClick={() => send({ action: "add", day, name })} className={cn(btn, "w-full bg-[#d32029] text-white")}>เพิ่ม</button>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </section>
        {!list && !error && <p className="text-center text-[12px] text-slate-400 py-6">กำลังโหลด...</p>}
        {years.map((y) => (
          <section key={y} className={cn(card, "p-4")}>
            <h3 className="text-[13px] font-bold text-slate-800 mb-1">ปี {Number(y) + 543}</h3>
            <ul className="divide-y divide-slate-100">
              {(list ?? []).filter((h) => h.day.startsWith(y)).map((h) => {
                const wd = new Date(`${h.day}T00:00:00`).getDay();
                return (
                  <li key={h.day} className="flex items-center gap-2 py-2">
                    <span className={cn("w-24 shrink-0 text-[12px] font-semibold", wd === 0 || wd === 6 ? "text-slate-400" : "text-slate-800")}>
                      {WD[wd]} {dateTh(`${h.day}T00:00:00`)}
                    </span>
                    <span className="flex-1 text-[12px] text-slate-600">{h.name}</span>
                    <button type="button" disabled={saving} onClick={() => send({ action: "remove", day: h.day })} className="text-slate-400 hover:text-red-600" aria-label="ลบ">
                      <Icon name="delete" style={{ fontSize: 18 }} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
