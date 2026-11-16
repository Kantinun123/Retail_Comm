"use client";

/* ฟอร์ม "เพิ่มร้านค้าใหม่" (Admin) — บันทึกแล้วไปหน้ารายละเอียดร้านต่อ (รูป / พนักงาน / ตรวจประเมิน) */
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { createStore, fetchSupervisorOptions, type SupervisorOption } from "@/lib/commission/employee-store";
import { MODEL_FEATURES, STORE_MODELS, type StoreModel } from "@/lib/commission/store-models";
import { cn } from "@/lib/utils";

const BENEFIT_LABEL: [keyof (typeof MODEL_FEATURES)[StoreModel], string][] = [
  ["backMargin", "Back Margin"],
  ["profitShareBa", "Profit Share BA"],
  ["lhsDiscount", "LHS Discount"],
];

export function StoreCreateModal({
  regions,
  existingCodes,
  onClose,
  onCreated,
}: {
  regions: string[];
  existingCodes: string[];
  onClose: () => void;
  onCreated: (code: string) => void;
}) {
  const [f, setF] = useState({ code: "", name: "", model: "" as StoreModel | "", region: "", province: "", branch: "", taxId: "", areaRep: "", coachRep: "" });
  const [sups, setSups] = useState<SupervisorOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSupervisorOptions().then((s) => !cancelled && setSups(s)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const codeOk = /^\d{4,10}$/.test(f.code.trim());
  const dup = codeOk && existingCodes.includes(f.code.trim());
  const canSave = codeOk && !dup && !!f.name.trim() && !!f.model && !busy;
  const feat = f.model ? MODEL_FEATURES[f.model] : null;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setErr(null);
    const r = await createStore({ ...f, code: f.code.trim(), name: f.name.trim(), model: f.model });
    setBusy(false);
    if (r.ok && r.code) onCreated(r.code);
    else setErr(r.error ?? "บันทึกไม่สำเร็จ");
  }

  const inp = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15";
  const lbl = "block text-[11px] font-semibold text-slate-600 mb-1";
  const areas = sups.filter((s) => s.position === "area_mng");
  const coaches = sups.filter((s) => s.position === "coach");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="new-store-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#f7f4f4] shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#f7f4f4]/95 backdrop-blur border-b border-slate-200">
          <h2 id="new-store-title" className="text-[15px] font-bold text-[#231313]">เพิ่มร้านค้าใหม่</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500">
            <Icon name="close" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className={lbl} htmlFor="ns-code">รหัสร้าน *</label>
            <input id="ns-code" inputMode="numeric" value={f.code} onChange={set("code")} placeholder="เช่น 5101234" className={inp} />
            {f.code && !codeOk && <p className="mt-1 text-[11px] text-[#a11119]">ตัวเลข 4–10 หลัก</p>}
            {dup && <p className="mt-1 text-[11px] text-[#a11119]">รหัสนี้มีอยู่แล้ว</p>}
          </div>
          <div>
            <label className={lbl} htmlFor="ns-name">ชื่อร้าน *</label>
            <input id="ns-name" value={f.name} onChange={set("name")} placeholder="เช่น บ.ตัวอย่างวัสดุก่อสร้าง จก." className={inp} />
          </div>
          <div>
            <span className={lbl}>โมเดล *</span>
            <div className="grid grid-cols-2 gap-1.5">
              {STORE_MODELS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={f.model === m}
                  onClick={() => setF((x) => ({ ...x, model: m }))}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-[12.5px] font-bold transition",
                    f.model === m ? "bg-[#d32029] text-white border-[#d32029]" : "bg-white text-slate-700 border-slate-200 hover:border-red-200"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            {feat && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                ผลประโยชน์ร้าน: {BENEFIT_LABEL.filter(([k]) => feat[k]).map(([, l]) => l).join(", ") || "ไม่มี"}
                {!feat.evalRequired && " · ยังไม่มีการตรวจประเมิน (ตั้งเป็น \"ไม่ต้องตรวจ\" ให้)"}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl} htmlFor="ns-region">ภาค</label>
              <input id="ns-region" list="ns-regions" value={f.region} onChange={set("region")} placeholder="เลือกหรือพิมพ์" className={inp} />
              <datalist id="ns-regions">
                {regions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={lbl} htmlFor="ns-prov">จังหวัด</label>
              <input id="ns-prov" value={f.province} onChange={set("province")} className={inp} />
            </div>
            <div>
              <label className={lbl} htmlFor="ns-branch">สาขา</label>
              <input id="ns-branch" value={f.branch} onChange={set("branch")} placeholder="สำนักงานใหญ่" className={inp} />
            </div>
            <div>
              <label className={lbl} htmlFor="ns-tax">เลขผู้เสียภาษี</label>
              <input id="ns-tax" inputMode="numeric" value={f.taxId} onChange={set("taxId")} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl} htmlFor="ns-area">Area Manager</label>
              <select id="ns-area" value={f.areaRep} onChange={set("areaRep")} className={inp}>
                <option value="">— ยังไม่กำหนด —</option>
                {areas.map((s) => (
                  <option key={s.repCode} value={s.repCode}>{s.nickname ? `${s.name} (${s.nickname})` : s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl} htmlFor="ns-coach">Coach</label>
              <select id="ns-coach" value={f.coachRep} onChange={set("coachRep")} className={inp}>
                <option value="">— ยังไม่กำหนด —</option>
                {coaches.map((s) => (
                  <option key={s.repCode} value={s.repCode}>{s.nickname ? `${s.name} (${s.nickname})` : s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {err && <p className="text-[12px] rounded-lg px-3 py-2 bg-red-50 text-[#a11119] border border-red-200" role="alert">{err}</p>}

          <button type="button" disabled={!canSave} onClick={save} className="w-full py-3 rounded-xl bg-[#d32029] text-white text-[14px] font-bold disabled:opacity-40 active:scale-[0.99] transition">
            {busy ? "กำลังบันทึก…" : "บันทึกร้าน"}
          </button>
          <p className="text-[10.5px] text-slate-400 text-center">บันทึกแล้วจะไปหน้ารายละเอียดร้าน เพิ่มรูป / พนักงาน / บัญชีร้านต่อได้</p>
        </div>
      </div>
    </div>
  );
}
