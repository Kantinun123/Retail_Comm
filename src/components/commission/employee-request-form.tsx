"use client";

/* =============================================================
   แบบฟอร์มแจ้งเพิ่มพนักงานใหม่ (bottom sheet)
   - mode "submit": Coach / Area / หัวหน้า Area ส่งคำขอ (ใหม่ หรือแก้คำขอที่ยังรอ)
   - mode "admin" : Admin แก้ข้อมูลก่อนอนุมัติ -> คืนค่าให้หน้าที่เรียก (ไม่ยิง API เอง)
   ช่องเลือกร้าน = SearchableSelect (พิมพ์ค้นชื่อ/รหัสร้านได้) เฉพาะร้านที่ส่งเข้ามา
   ============================================================= */
import { useMemo, useRef, useState } from "react";
import { Icon } from "./icon";
import { SearchableSelect, type ComboOption } from "./searchable-select";
import {
  EDUCATION_OPTIONS,
  REQUEST_POSITIONS,
  validatePayload,
  type EmployeeRequestPayload,
  type RequestPosition,
} from "@/lib/commission/employee-request-shared";
import {
  checkDuplicates,
  createEmployeeRequest,
  updateEmployeeRequest,
  uploadRequestPhoto,
  type DupMatch,
} from "@/lib/commission/employee-request-store";
import { cn } from "@/lib/utils";

export interface StoreOpt {
  code: string;
  name: string;
  model: string | null;
  region: string | null;
  /** กลุ่ม Area (แสดงเป็นป้ายท้ายแถว) */
  group?: string | null;
}

type Form = {
  dealerCode: string;
  position: RequestPosition | "";
  name: string;
  nickname: string;
  phone: string;
  email: string;
  startDate: string;
  lineId: string;
  birthDate: string;
  level: "" | "B" | "S" | "A";
  education: string;
  major: string;
  notes: string;
};

const toForm = (dealerCode: string, p?: EmployeeRequestPayload | null): Form => ({
  dealerCode,
  position: p?.position ?? "",
  name: p?.name ?? "",
  nickname: p?.nickname ?? "",
  phone: p?.phone ?? "",
  email: p?.email ?? "",
  startDate: p?.startDate ?? "",
  lineId: p?.lineId ?? "",
  birthDate: p?.birthDate ?? "",
  level: p?.level ?? "",
  education: p?.education ?? "",
  major: p?.major ?? "",
  notes: p?.notes ?? "",
});

export function EmployeeRequestForm({
  mode,
  stores,
  initial,
  onClose,
  onDone,
}: {
  mode: "submit" | "admin";
  stores: StoreOpt[];
  /** id = แก้คำขอเดิม (submit) ; ไม่มี id = คำขอใหม่ (หรือส่งใหม่หลังไม่อนุมัติ) */
  initial?: { id?: number; dealerCode?: string | null; payload?: EmployeeRequestPayload | null; photoUrl?: string | null };
  onClose: () => void;
  onDone: (r: { dealerCode: string; payload: EmployeeRequestPayload; photoUrl: string | null }) => void;
}) {
  const only = stores.length === 1 ? stores[0].code : "";
  const [f, setF] = useState<Form>(() => toForm(initial?.dealerCode ?? only, initial?.payload));
  const [photo, setPhoto] = useState<string | null>(initial?.photoUrl ?? null);
  const [dupes, setDupes] = useState<DupMatch[]>([]);
  const [busy, setBusy] = useState<"save" | "photo" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  const options: ComboOption[] = useMemo(
    () =>
      stores.map((s) => ({
        value: s.code,
        label: s.name,
        sub: [s.code, s.model, s.region].filter(Boolean).join(" · "),
        tag: s.group ?? undefined,
      })),
    [stores]
  );

  async function runDupCheck(next: Partial<Form> = {}) {
    const x = { ...f, ...next };
    if (!x.name.trim() && !x.phone.trim() && !x.email.trim()) return setDupes([]);
    const r = await checkDuplicates({ name: x.name, phone: x.phone, email: x.email });
    if (r.ok) setDupes(r.matches);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setBusy("photo");
    setErr(null);
    const r = await uploadRequestPhoto(file);
    setBusy(null);
    if (r.ok) setPhoto(r.url);
    else setErr(r.error);
  }

  async function onSubmit() {
    setErr(null);
    if (!f.dealerCode) return setErr("กรุณาเลือกร้าน");
    const v = validatePayload({ ...f, level: f.level || null });
    if (!v.ok) return setErr(v.error);
    if (mode === "admin") return onDone({ dealerCode: f.dealerCode, payload: v.payload, photoUrl: photo });
    setBusy("save");
    const r = initial?.id
      ? await updateEmployeeRequest(initial.id, f.dealerCode, v.payload, photo)
      : await createEmployeeRequest(f.dealerCode, v.payload, photo);
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    onDone({ dealerCode: f.dealerCode, payload: v.payload, photoUrl: photo });
  }

  const input = "w-full bg-[#faf8f8] text-slate-900 text-[13.5px] rounded-xl px-3 py-2.5 border border-slate-200/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 focus:bg-white transition";
  const title = mode === "admin" ? "แก้ข้อมูลก่อนอนุมัติ" : initial?.id ? "แก้ไขคำขอ" : "แจ้งเพิ่มพนักงานใหม่";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="req-form-title">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md max-h-[94vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
          <h2 id="req-form-title" className="text-[15px] font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <Icon name="close" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <Field label="ร้าน" required>
            <SearchableSelect
              options={options}
              value={f.dealerCode || null}
              onChange={(v) => set({ dealerCode: v })}
              placeholder="เลือกร้าน"
              searchPlaceholder="พิมพ์ชื่อร้าน หรือรหัสร้าน…"
              emptyText="ไม่พบร้าน"
              icon="storefront"
            />
            {mode === "submit" && <p className="text-[10.5px] text-slate-400 mt-1">เลือกได้เฉพาะร้านที่ดูแลและเปิดใช้งาน</p>}
          </Field>

          <Field label="ตำแหน่ง" required>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="ตำแหน่ง">
              {REQUEST_POSITIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={f.position === p.key}
                  onClick={() => set({ position: p.key, level: p.key === "se" ? f.level : "" })}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-[12px] font-bold border transition",
                    f.position === p.key ? "bg-blue-700 text-white border-blue-700" : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="ชื่อ-นามสกุล" required htmlFor="rq-name">
            <input id="rq-name" value={f.name} onChange={(e) => set({ name: e.target.value })} onBlur={() => runDupCheck()} maxLength={100} className={input} />
          </Field>

          {dupes.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5" role="status">
              <p className="text-[12px] font-bold text-amber-900 flex items-center gap-1">
                <Icon name="warning" style={{ fontSize: 15 }} />
                อาจซ้ำกับพนักงานที่มีในระบบ
              </p>
              {dupes.map((d) => (
                <p key={d.repCode} className="text-[11px] text-amber-800 mt-0.5">
                  {d.repCode} {d.name} · {d.dealerName ?? "ไม่ระบุร้าน"} · {d.isActive ? "ทำงานอยู่" : "พักงาน"} ({d.reason.map((x) => (x === "name" ? "ชื่อ" : x === "phone" ? "เบอร์" : "อีเมล")).join("/")}ตรง)
                </p>
              ))}
              <p className="text-[10.5px] text-amber-700 mt-1">ถ้าเป็นคนเดิมที่กลับมาทำงาน แจ้งในหมายเหตุ ให้ Admin ย้ายร้าน/เปิดสถานะแทนการสร้างใหม่</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="ชื่อเล่น" htmlFor="rq-nick">
              <input id="rq-nick" value={f.nickname} onChange={(e) => set({ nickname: e.target.value })} maxLength={40} className={input} />
            </Field>
            <Field label="วันเข้างาน" required htmlFor="rq-start">
              <input id="rq-start" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} className={input} />
            </Field>
            <Field label="เบอร์โทร" required htmlFor="rq-phone">
              <input id="rq-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} onBlur={() => runDupCheck()} maxLength={20} className={input} />
            </Field>
            <Field label="Line ID" htmlFor="rq-line">
              <input id="rq-line" value={f.lineId} onChange={(e) => set({ lineId: e.target.value })} maxLength={50} autoCapitalize="none" spellCheck={false} className={input} />
            </Field>
          </div>

          <Field label="อีเมล" required htmlFor="rq-email">
            <input
              id="rq-email"
              type="email"
              inputMode="email"
              value={f.email}
              onChange={(e) => set({ email: e.target.value })}
              onBlur={() => runDupCheck()}
              maxLength={120}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="name@example.com"
              className={input}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="วันเกิด" htmlFor="rq-birth">
              <input id="rq-birth" type="date" value={f.birthDate} onChange={(e) => set({ birthDate: e.target.value })} className={input} />
            </Field>
            {f.position === "se" && (
              <Field label="ระดับ SE" htmlFor="rq-level">
                <select id="rq-level" value={f.level} onChange={(e) => set({ level: e.target.value as Form["level"] })} className={input}>
                  <option value="">ยังไม่ประเมิน</option>
                  <option value="B">B · Beginner</option>
                  <option value="S">S · Standard</option>
                  <option value="A">A · Advance</option>
                </select>
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="วุฒิการศึกษา" htmlFor="rq-edu">
              <select id="rq-edu" value={f.education} onChange={(e) => set({ education: e.target.value })} className={input}>
                <option value="">ไม่ระบุ</option>
                {EDUCATION_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="สาขาที่จบ" htmlFor="rq-major">
              <input id="rq-major" value={f.major} onChange={(e) => set({ major: e.target.value })} maxLength={100} placeholder="เช่น บริหารธุรกิจ" className={input} />
            </Field>
          </div>

          <Field label="รูปพนักงาน">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy !== null}
              className="w-full rounded-xl border border-dashed border-slate-300 bg-[#faf8f8] py-3 flex items-center justify-center gap-3 text-[12px] text-slate-600 disabled:opacity-50"
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <Icon name="photo_camera" />
              )}
              {busy === "photo" ? "กำลังอัปโหลด..." : photo ? "เปลี่ยนรูป" : "ถ่ายรูป / เลือกจากอัลบั้ม (ไม่บังคับ)"}
            </button>
          </Field>

          <Field label={mode === "admin" ? "หมายเหตุ" : "หมายเหตุถึง Admin"} htmlFor="rq-notes">
            <textarea id="rq-notes" value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} maxLength={500} placeholder="เช่น แทนคนที่ลาออก / ย้ายมาจากร้านอื่น" className={cn(input, "resize-none")} />
          </Field>

          {err && <p className="text-[12px] text-[#a11119] bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

          <button
            type="button"
            onClick={onSubmit}
            disabled={busy !== null}
            className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-bold text-[14px] hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {busy === "save" ? "กำลังส่ง..." : mode === "admin" ? "ใช้ข้อมูลนี้" : initial?.id ? "บันทึกการแก้ไข" : "ส่งให้ Admin อนุมัติ"}
          </button>
          <p className="text-center text-[10.5px] text-slate-400 pb-2">* = จำเป็น · รหัสพนักงาน SR#### ออกตอนอนุมัติ</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, htmlFor, children }: { label: string; required?: boolean; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[12px] font-bold text-slate-700 mb-1">
        {label}
        {required && <span className="text-[#d32029]"> *</span>}
      </label>
      {children}
    </div>
  );
}
