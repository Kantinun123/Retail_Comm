"use client";

/* =============================================================
   EmployeeEditModal — ฟอร์มแก้ไข/เพิ่มพนักงาน (modal เต็มจอ)
   ใช้ร่วมกันทั้งหน้า employee-admin และ store-roster (admin)
   self-contained: จัดการ form state / save / อัปรูป / toggle / ย้ายร้าน เอง
   - employee = null -> เพิ่มใหม่ (ใช้ defaultDealer เป็นร้านเริ่มต้น)
   - onSaved(moved) -> พาเรนต์ refresh (moved = ย้ายร้าน)
   ============================================================= */

import { useRef, useState } from "react";
import { Icon } from "./icon";
import {
  ageFromBirthDate,
  tenureFromStartDate,
  saveEmployee,
  uploadEmployeePhoto,
  deleteEmployeePhoto,
  LEVEL_META,
  POSITION_LABEL,
  type Employee,
  type EmployeeInput,
  type LevelKey,
  type PositionKey,
  type StoreInfo,
} from "@/lib/commission/employee-store";
import { cn } from "@/lib/utils";

const POSITIONS: PositionKey[] = [
  "store_exec",
  "area_mng",
  "coach",
  "se",
  "sale_floor",
];
const LEVELS: LevelKey[] = ["B", "S", "A"];

type FormState = EmployeeInput & { skillsText: string };

function toForm(e: Employee | null, defaultDealer: string | null): FormState {
  if (!e) {
    return {
      name: "",
      nickname: "",
      dealerCode: defaultDealer,
      position: null,
      level: null,
      phone: "",
      phone2: "",
      email: "",
      lineId: "",
      birthDate: "",
      startDate: "",
      notes: "",
      photoUrl: null,
      isActive: true,
      skillsText: "",
    };
  }
  return {
    repCode: e.repCode,
    name: e.name,
    nickname: e.nickname ?? "",
    dealerCode: e.dealerCode,
    position: e.position,
    level: e.level,
    phone: e.phone ?? "",
    phone2: e.phone2 ?? "",
    email: e.email ?? "",
    lineId: e.lineId ?? "",
    birthDate: e.birthDate ?? "",
    startDate: e.startDate ?? "",
    notes: e.notes ?? "",
    photoUrl: e.photoUrl,
    isActive: e.isActive,
    skillsText: e.skills.join(", "),
  };
}

export function EmployeeEditModal({
  employee,
  stores,
  defaultDealer = null,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  stores: StoreInfo[];
  defaultDealer?: string | null;
  onClose: () => void;
  onSaved: (moved: boolean) => void;
}) {
  const originalDealer = employee?.dealerCode ?? null;
  const [form, setForm] = useState<FormState>(() =>
    toForm(employee, defaultDealer)
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  // Area/Coach เป็นหัวหน้า — ใช้ field ย่อ (ไม่ต้อง level/skills/วันเกิด/วันเข้างาน/ย้ายร้าน)
  const isSupervisorPos =
    form.position === "area_mng" || form.position === "coach";

  async function onPickPhoto(file: File) {
    if (!form.repCode) {
      setMsg({ type: "err", text: "บันทึกพนักงานก่อน แล้วค่อยอัปโหลดรูป" });
      return;
    }
    setMsg(null);
    const res = await uploadEmployeePhoto(form.repCode, file);
    if (res.ok && res.url) {
      patch({ photoUrl: res.url });
      setMsg({ type: "ok", text: "อัปโหลดรูปสำเร็จ" });
    } else {
      setMsg({ type: "err", text: res.error ?? "อัปโหลดรูปไม่สำเร็จ" });
    }
  }

  async function onRemovePhoto() {
    if (!form.repCode || !form.photoUrl) return;
    if (!window.confirm("ลบรูปของพนักงานคนนี้? รูปจะถูกลบออกจากระบบทันที")) return;
    setMsg(null);
    const res = await deleteEmployeePhoto(form.repCode);
    if (res.ok) {
      patch({ photoUrl: null });
      setMsg({ type: "ok", text: "ลบรูปแล้ว" });
    } else {
      setMsg({ type: "err", text: res.error ?? "ลบรูปไม่สำเร็จ" });
    }
  }

  async function onSave() {
    if (!form.name.trim()) {
      setMsg({ type: "err", text: "กรุณากรอกชื่อพนักงาน" });
      return;
    }
    setSaving(true);
    setMsg(null);
    const skills = form.skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const input: EmployeeInput = {
      repCode: form.repCode,
      name: form.name.trim(),
      nickname: form.nickname || null,
      // Area/Coach ผูกร้านผ่าน assignment ไม่ใช่ dealer_code -> ส่ง null
      dealerCode: isSupervisorPos ? null : form.dealerCode,
      position: form.position,
      level: form.level,
      phone: form.phone || null,
      phone2: form.phone2 || null,
      email: form.email || null,
      lineId: form.lineId || null,
      birthDate: form.birthDate || null,
      startDate: form.startDate || null,
      notes: form.notes || null,
      skills,
      isActive: form.isActive,
    };
    const moved = !!form.repCode && form.dealerCode !== originalDealer;
    const res = await saveEmployee(input);
    setSaving(false);
    if (res.ok) {
      // สร้างใหม่ -> เก็บ repCode เพื่ออัปรูปต่อได้ (ไม่ปิด modal)
      if (!form.repCode && res.repCode) {
        patch({ repCode: res.repCode });
        setMsg({ type: "ok", text: "บันทึกสำเร็จ — อัปโหลดรูปได้แล้ว" });
        onSaved(false);
        return;
      }
      onSaved(moved);
      onClose();
    } else {
      setMsg({ type: "err", text: res.error ?? "บันทึกไม่สำเร็จ" });
    }
  }

  const dealerChanged =
    !!form.repCode && form.dealerCode !== originalDealer;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-xl animate-fade-up">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
          <h3 className="text-[15px] font-bold text-slate-900">
            {form.repCode ? "แก้ไขพนักงาน" : "เพิ่มพนักงานใหม่"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center active:scale-95"
          >
            <Icon name="close" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* รูป */}
          <div className="flex items-center gap-3">
            {form.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.photoUrl}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Icon name="account_circle" className="text-3xl" />
              </div>
            )}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickPhoto(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#d32029] bg-red-50 border border-red-100 px-3 py-1.5 rounded-full active:scale-95"
              >
                <Icon name="photo_camera" style={{ fontSize: 16 }} />
                {form.photoUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
              </button>
              {form.photoUrl && form.repCode && (
                <button
                  onClick={onRemovePhoto}
                  className="ml-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:text-[#a11119] active:scale-95"
                >
                  <Icon name="delete" style={{ fontSize: 16 }} />
                  ลบรูป
                </button>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                {form.repCode ? "JPG/PNG ≤ 5MB" : "บันทึกก่อนจึงอัปรูปได้"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="ชื่อ-นามสกุล *">
              <input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="form-in"
              />
            </Field>
            <Field label="ชื่อเล่น">
              <input
                value={form.nickname ?? ""}
                onChange={(e) => patch({ nickname: e.target.value })}
                className="form-in"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="ตำแหน่ง">
              <select
                value={form.position ?? ""}
                onChange={(e) =>
                  patch({ position: (e.target.value || null) as PositionKey | null })
                }
                className="form-in"
              >
                <option value="">— ไม่ระบุ —</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {POSITION_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            {isSupervisorPos ? (
              <div />
            ) : (
              <Field label="ระดับ">
                <select
                  value={form.level ?? ""}
                  onChange={(e) =>
                    patch({ level: (e.target.value || null) as LevelKey | null })
                  }
                  className="form-in"
                >
                  <option value="">— ไม่ระบุ —</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l} · {LEVEL_META[l].label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="เบอร์โทร 1">
              <input
                value={form.phone ?? ""}
                onChange={(e) => patch({ phone: e.target.value })}
                className="form-in"
              />
            </Field>
            <Field label="เบอร์โทร 2">
              <input
                value={form.phone2 ?? ""}
                onChange={(e) => patch({ phone2: e.target.value })}
                className="form-in"
              />
            </Field>
          </div>

          <Field label="Line ID">
            <input
              value={form.lineId ?? ""}
              onChange={(e) => patch({ lineId: e.target.value })}
              className="form-in"
            />
          </Field>

          <Field label="Email">
            <input
              value={form.email ?? ""}
              onChange={(e) => patch({ email: e.target.value })}
              className="form-in"
            />
          </Field>

          {!isSupervisorPos && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="วันเกิด">
                <input
                  type="date"
                  value={form.birthDate ?? ""}
                  onChange={(e) => patch({ birthDate: e.target.value })}
                  className="form-in"
                />
                {ageFromBirthDate(form.birthDate ?? null) !== null && (
                  <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                    อายุ {ageFromBirthDate(form.birthDate ?? null)} ปี
                  </span>
                )}
              </Field>
              <Field label="วันเข้างาน">
                <input
                  type="date"
                  value={form.startDate ?? ""}
                  onChange={(e) => patch({ startDate: e.target.value })}
                  className="form-in"
                />
                {tenureFromStartDate(form.startDate ?? null) && (
                  <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                    อายุงาน {tenureFromStartDate(form.startDate ?? null)}
                  </span>
                )}
              </Field>
            </div>
          )}

          {!isSupervisorPos && (
            <Field label="ทักษะพิเศษ (คั่นด้วย ,)">
              <input
                value={form.skillsText}
                onChange={(e) => patch({ skillsText: e.target.value })}
                placeholder="Landscape Pro, Up to S"
                className="form-in"
              />
            </Field>
          )}

          <Field label="หมายเหตุ">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={2}
              className="form-in resize-none"
            />
          </Field>

          {/* ย้ายร้าน — เฉพาะพนักงานขาย (Area/Coach ผูกหลายร้านผ่าน assignment ไม่ใช่ที่นี่) */}
          {!isSupervisorPos && (
            <Field label="ร้านที่สังกัด (ย้ายร้าน)">
              <select
                value={form.dealerCode ?? ""}
                onChange={(e) => patch({ dealerCode: e.target.value || null })}
                className="form-in"
              >
                <option value="">— ไม่ระบุร้าน —</option>
                {stores.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              {dealerChanged && (
                <span className="text-[10.5px] text-amber-600 mt-0.5 block">
                  จะย้ายพนักงานไปร้านใหม่เมื่อกดบันทึก
                </span>
              )}
            </Field>
          )}
          {isSupervisorPos && (
            <p className="text-[10.5px] text-slate-400 flex items-center gap-1">
              <Icon name="info" style={{ fontSize: 13 }} />
              {form.position === "area_mng" ? "Area Manager" : "Coach / RE"}{" "}
              ดูแลหลายร้าน — กำหนดร้านที่ดูแลผ่านการ seed/assignment
            </p>
          )}

          {/* สถานะ */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-[12.5px] font-semibold text-slate-700">
                สถานะพนักงาน
              </p>
              <p className="text-[10.5px] text-slate-400">
                {form.isActive
                  ? "Active — ทำงานอยู่ แสดงในร้าน"
                  : "Non-active — พักงาน/ลาออก ซ่อนจากร้าน"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => patch({ isActive: !form.isActive })}
              className={cn(
                "relative w-14 h-7 rounded-full transition shrink-0",
                form.isActive ? "bg-emerald-500" : "bg-slate-300"
              )}
              aria-pressed={form.isActive}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all",
                  form.isActive ? "left-7" : "left-0.5"
                )}
              />
            </button>
          </div>

          {msg && (
            <p
              className={cn(
                "text-[12px] font-semibold rounded-lg px-3 py-2",
                msg.type === "ok"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-[#a11119] border border-red-200"
              )}
            >
              {msg.text}
            </p>
          )}

          <button
            onClick={onSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-[#d32029] text-white font-bold text-[13px] active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {saving ? (
              <Icon name="progress_activity" className="animate-spin" style={{ fontSize: 18 }} />
            ) : (
              <Icon name="save" style={{ fontSize: 18 }} />
            )}
            บันทึก
          </button>
        </div>
      </div>

      <style jsx global>{`
        .form-in {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.65rem;
          padding: 0.5rem 0.65rem;
          font-size: 13px;
          outline: none;
        }
        .form-in:focus {
          border-color: #d32029;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
