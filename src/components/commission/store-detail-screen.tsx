"use client";

/* =============================================================
   หน้ารายละเอียดร้าน — จุดเดียวที่จัดการร้านและทีมงานของร้านนั้น
   - ข้อมูลร้าน + สวิตช์เปิด/ปิดร้าน
   - Area Manager / RE-Coach : เปลี่ยน / เอาออก
   - พนักงานขาย : เพิ่ม / แก้ไข / พักงาน-ทำงาน (+ แสดงคนที่พักงาน)
   สิทธิ์แก้ไขอ่านจาก getStoreTeamCaps() ; ร้านค้า/พนักงานเห็นเฉพาะร้านตัวเอง แบบดูอย่างเดียว
   ============================================================= */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { EmployeeEditModal } from "./employee-edit-modal";
import { SupervisorPickerModal } from "./supervisor-picker-modal";
import { useSession, useHomeHref } from "@/lib/commission/session";
import { getStoreTeamCaps } from "@/lib/commission/permissions";
import {
  ageFromBirthDate,
  tenureFromStartDate,
  isNewEmployee,
  fetchStores,
  fetchStoreRoster,
  setEmployeeActive,
  setStoreActive,
  setStoreSupervisor,
  uploadStorePhoto,
  LEVEL_META,
  POSITION_LABEL,
  POSITION_SHORT,
  type Employee,
  type LevelKey,
  type PositionKey,
  type StoreInfo,
  type SupervisorRole,
} from "@/lib/commission/employee-store";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "–";
}
function thaiDate(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function modelAccent(model: string | null): string {
  if (!model) return "bg-slate-100 text-slate-600";
  if (model.includes("Housing")) return "bg-red-50 text-[#d32029]";
  if (model.includes("SCG")) return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

export function StoreDetailScreen({ code }: { code: string }) {
  const { session, ready } = useSession();
  const router = useRouter();
  const homeHref = useHomeHref();
  const caps = getStoreTeamCaps(session);

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [roster, setRoster] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // modal แก้ไขพนักงาน: undefined = ปิด, null = เพิ่มใหม่, Employee = แก้
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);
  // modal เลือก Area/Coach
  const [picking, setPicking] = useState<SupervisorRole | null>(null);
  // รูปร้าน: กำลังอัปโหลด / เปิดดูเต็มจอ
  const [photoBusy, setPhotoBusy] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  // ร้านค้า/พนักงาน เห็นได้เฉพาะร้านตัวเอง -> ถ้าเปิดร้านอื่น พาไปร้านตัวเอง
  const ownCode = session?.dealer.code || null;
  const blocked = !!session && !caps.canViewAllStores && !!ownCode && ownCode !== code;
  useEffect(() => {
    if (ready && blocked && ownCode) router.replace(`/app/store/${ownCode}`);
  }, [ready, blocked, ownCode, router]);

  const reload = useCallback(() => {
    fetchStoreRoster(code).then(setRoster).catch(() => {});
  }, [code]);

  useEffect(() => {
    if (!ready || !session || blocked) return;
    let cancelled = false;
    Promise.all([fetchStores(), fetchStoreRoster(code)])
      .then(([ss, r]) => {
        if (cancelled) return;
        setStores(ss);
        setStore(ss.find((s) => s.code === code) ?? null);
        setRoster(r);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, session, code, blocked]);

  const supervisors = useMemo(() => roster.filter((r) => r.isSupervisor), [roster]);
  const areas = supervisors.filter((r) => r.position === "area_mng");
  const coaches = supervisors.filter((r) => r.position === "coach");
  const allMembers = useMemo(() => roster.filter((r) => !r.isSupervisor), [roster]);
  const activeMembers = allMembers.filter((r) => r.isActive);
  const inactiveCount = allMembers.length - activeMembers.length;
  const members = showInactive ? allMembers : activeMembers;

  if (!ready || !session || blocked) return null;

  const backHref = caps.canViewAllStores ? "/app/stores" : homeHref;

  async function onToggleStore() {
    if (!store) return;
    setBusy("store");
    setMsg(null);
    const res = await setStoreActive(store.code, !store.isActive);
    setBusy(null);
    if (res.ok) setStore({ ...store, isActive: !store.isActive });
    else setMsg(res.error ?? "เปลี่ยนสถานะร้านไม่สำเร็จ");
  }

  async function onPickStorePhoto(file: File) {
    if (!store) return;
    setPhotoBusy(true);
    setMsg(null);
    const res = await uploadStorePhoto(store.code, file);
    setPhotoBusy(false);
    if (res.ok && res.url) setStore({ ...store, photoUrl: res.url });
    else setMsg(res.error ?? "อัปโหลดรูปร้านไม่สำเร็จ");
  }

  async function onToggleEmployee(e: Employee) {
    setBusy(e.repCode);
    setMsg(null);
    const res = await setEmployeeActive(e.repCode, !e.isActive);
    setBusy(null);
    if (res.ok) reload();
    else setMsg(res.error ?? "เปลี่ยนสถานะพนักงานไม่สำเร็จ");
  }

  async function onRemoveSupervisor(role: SupervisorRole) {
    const label = role === "manager" ? "Area Manager" : "RE / Coach";
    if (!window.confirm(`เอา ${label} ออกจากร้านนี้?`)) return;
    setBusy(role);
    setMsg(null);
    const res = await setStoreSupervisor(code, role, null);
    setBusy(null);
    if (res.ok) reload();
    else setMsg(res.error ?? `เอา ${label} ออกไม่สำเร็จ`);
  }

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link
            href={backHref}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">รายละเอียดร้าน</span>
        </div>
      </header>

      {loading ? (
        <div className="py-16 text-center">
          <Icon name="progress_activity" className="animate-spin text-3xl text-[#d32029]" />
        </div>
      ) : !store ? (
        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <p className="text-[13px] text-slate-500">ไม่พบร้าน {code}</p>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {/* ข้อมูลร้าน */}
          <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full",
                    modelAccent(store.model)
                  )}
                >
                  <Icon name="verified" style={{ fontSize: 13 }} />
                  {store.model ?? "ร้านค้า"}
                </span>
                {caps.canToggleStore ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10.5px] text-red-100/90">
                      {store.isActive ? "ร้านเปิดใช้งาน" : "ร้านปิด/ยกเลิก"}
                    </span>
                    <button
                      onClick={onToggleStore}
                      disabled={busy === "store"}
                      className={cn(
                        "relative w-11 h-6 rounded-full transition disabled:opacity-50",
                        store.isActive ? "bg-emerald-400" : "bg-slate-400/70"
                      )}
                      aria-pressed={store.isActive}
                      title={store.isActive ? "ปิดใช้งานร้าน" : "เปิดใช้งานร้าน"}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                          store.isActive ? "left-[22px]" : "left-0.5"
                        )}
                      />
                    </button>
                  </div>
                ) : (
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                      store.isActive
                        ? "bg-white/15 text-white border-white/25"
                        : "bg-slate-700/40 text-slate-200 border-white/20"
                    )}
                  >
                    {store.isActive ? "เปิดใช้งาน" : "ปิด/ยกเลิก"}
                  </span>
                )}
              </div>
              <p className="text-[18px] font-bold leading-tight mt-2">{store.name}</p>
              <p className="text-[11.5px] text-red-100/90 mt-0.5">
                {store.code} · {store.province ?? store.region ?? "–"}
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11.5px]">
                <span className="inline-flex items-center gap-1 bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-1 rounded-full">
                  <Icon name="groups" style={{ fontSize: 14 }} />
                  {activeMembers.length} คนในร้าน
                </span>
                {store.region && (
                  <span className="inline-flex items-center gap-1 bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-1 rounded-full">
                    <Icon name="map" style={{ fontSize: 14 }} />
                    {store.region}
                  </span>
                )}
              </div>
            </div>
          </section>

          {msg && (
            <p className="text-[12px] font-semibold rounded-lg px-3 py-2 bg-red-50 text-[#a11119] border border-red-200">
              {msg}
            </p>
          )}

          {/* รูปร้าน — แสดงทั้งใบไม่ตัด (รูปมีทั้งแนวตั้ง/แนวนอน) กดขยายเต็มจอได้ */}
          {(store.photoUrl || caps.canEditStore) && (
            <section>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                  <Icon name="photo_camera" className="text-lg text-[#d32029]" />
                  รูปร้าน
                </h3>
                {caps.canEditStore && store.photoUrl && (
                  <button
                    onClick={() => photoInput.current?.click()}
                    disabled={photoBusy}
                    className="text-[11px] font-bold text-[#d32029] bg-red-50 border border-red-100 px-2.5 py-1 rounded-full active:scale-95 transition disabled:opacity-50"
                  >
                    {photoBusy ? "กำลังอัปโหลด…" : "เปลี่ยนรูป"}
                  </button>
                )}
              </div>
              {store.photoUrl ? (
                <button
                  onClick={() => setLightbox(true)}
                  className="block w-full rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-100 active:scale-[0.99] transition"
                  title="กดเพื่อขยาย"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={store.photoUrl}
                    alt={store.name}
                    className="mx-auto max-h-80 w-auto max-w-full object-contain"
                  />
                </button>
              ) : (
                <button
                  onClick={() => photoInput.current?.click()}
                  disabled={photoBusy}
                  className="w-full rounded-2xl border-2 border-dashed border-slate-200 bg-white py-8 text-center active:scale-[0.99] transition disabled:opacity-50"
                >
                  <Icon name="add_a_photo" className="text-3xl text-slate-300" />
                  <p className="mt-1 text-[12px] font-semibold text-slate-500">
                    {photoBusy ? "กำลังอัปโหลด…" : "เพิ่มรูปร้าน"}
                  </p>
                  <p className="text-[10.5px] text-slate-400">ย่อรูปให้อัตโนมัติก่อนอัปโหลด</p>
                </button>
              )}
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickStorePhoto(f);
                  e.target.value = "";
                }}
              />
            </section>
          )}

          {/* Area Manager */}
          <SupervisorSection
            title="Area Manager"
            icon="supervisor_account"
            people={areas}
            emptyText="ยังไม่ระบุ Area Manager"
            canManage={caps.canManageSupervisors}
            canEditPerson={caps.canEditEmployee}
            busy={busy === "manager"}
            onPick={() => setPicking("manager")}
            onRemove={() => onRemoveSupervisor("manager")}
            onEditPerson={setEditing}
          />

          {/* RE / Coach */}
          <SupervisorSection
            title="RE / Coach"
            icon="sports"
            people={coaches}
            emptyText="ยังไม่ระบุ RE / Coach"
            canManage={caps.canManageSupervisors}
            canEditPerson={caps.canEditEmployee}
            busy={busy === "coach"}
            onPick={() => setPicking("coach")}
            onRemove={() => onRemoveSupervisor("coach")}
            onEditPerson={setEditing}
          />

          {/* พนักงานขาย */}
          <section>
            <div className="flex items-center justify-between mb-2 px-1 gap-2">
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <Icon name="badge" className="text-lg text-[#d32029]" />
                พนักงานขาย ({activeMembers.length})
              </h3>
              <div className="flex items-center gap-2">
                {inactiveCount > 0 && (
                  <button
                    onClick={() => setShowInactive((v) => !v)}
                    className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1 active:scale-95"
                  >
                    <Icon
                      name={showInactive ? "visibility_off" : "visibility"}
                      style={{ fontSize: 15 }}
                    />
                    {showInactive ? "ซ่อนพักงาน" : `แสดงพักงาน (${inactiveCount})`}
                  </button>
                )}
                {caps.canEditEmployee && (
                  <button
                    onClick={() => setEditing(null)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#d32029] px-2.5 py-1.5 rounded-full active:scale-95 transition"
                  >
                    <Icon name="add" style={{ fontSize: 15 }} />
                    เพิ่ม
                  </button>
                )}
              </div>
            </div>
            {members.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
                <p className="text-[13px] text-slate-500">ยังไม่มีพนักงานขายในร้านนี้</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {members.map((e) => (
                  <StaffCard
                    key={e.repCode}
                    emp={e}
                    busy={busy === e.repCode}
                    onEdit={caps.canEditEmployee ? () => setEditing(e) : undefined}
                    onToggle={caps.canEditEmployee ? () => onToggleEmployee(e) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ดูรูปร้านเต็มจอ */}
      {lightbox && store?.photoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-95"
            aria-label="ปิด"
          >
            <Icon name="close" style={{ fontSize: 22 }} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={store.photoUrl}
            alt={store.name}
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        </div>
      )}

      {/* modal แก้ไข/เพิ่มพนักงาน */}
      {editing !== undefined && caps.canEditEmployee && store && (
        <EmployeeEditModal
          employee={editing}
          stores={stores}
          defaultDealer={code}
          onClose={() => setEditing(undefined)}
          onSaved={() => reload()}
        />
      )}

      {/* modal เลือก Area / Coach */}
      {picking && caps.canManageSupervisors && store && (
        <SupervisorPickerModal
          dealerCode={code}
          dealerName={store.name}
          role={picking}
          currentRepCodes={(picking === "manager" ? areas : coaches).map((p) => p.repCode)}
          onClose={() => setPicking(null)}
          onSaved={() => reload()}
        />
      )}

      <BottomNav active="database" />
    </>
  );
}

/* ---------- section หัวหน้า (Area/Coach) ---------- */
function SupervisorSection({
  title,
  icon,
  people,
  emptyText,
  canManage,
  canEditPerson,
  busy,
  onPick,
  onRemove,
  onEditPerson,
}: {
  title: string;
  icon: string;
  people: Employee[];
  emptyText: string;
  canManage: boolean;
  canEditPerson: boolean;
  busy: boolean;
  onPick: () => void;
  onRemove: () => void;
  onEditPerson: (e: Employee) => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1 gap-2">
        <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
          <Icon name={icon} className="text-lg text-[#d32029]" />
          {title}
        </h3>
        {canManage && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onPick}
              disabled={busy}
              className="text-[11px] font-bold text-[#d32029] bg-red-50 border border-red-100 px-2.5 py-1 rounded-full active:scale-95 transition disabled:opacity-50"
            >
              {people.length === 0 ? "+ เลือก" : "เปลี่ยน"}
            </button>
            {people.length > 0 && (
              <button
                onClick={onRemove}
                disabled={busy}
                className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full active:scale-95 transition disabled:opacity-50"
              >
                เอาออก
              </button>
            )}
          </div>
        )}
      </div>
      {people.length === 0 ? (
        <p className="text-[12px] text-slate-400 px-1">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {people.length > 1 && (
            <p className="text-[10.5px] text-amber-600 px-1">
              มี {people.length} คนในตำแหน่งนี้ — กด &quot;เปลี่ยน&quot; เพื่อเลือกให้เหลือคนเดียว
            </p>
          )}
          {people.map((e) => (
            <div
              key={e.repCode}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex items-center gap-3"
            >
              <Avatar emp={e} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-900 truncate">
                  {e.name}
                  {e.nickname && (
                    <span className="font-semibold text-slate-500"> ({e.nickname})</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">
                  {e.position ? POSITION_LABEL[e.position] : title}
                  {e.phone ? ` · ${e.phone}` : ""}
                </p>
              </div>
              {e.phone && (
                <a
                  href={`tel:${e.phone}`}
                  className="w-8 h-8 rounded-full bg-red-50 text-[#d32029] flex items-center justify-center shrink-0 active:scale-95 transition"
                >
                  <Icon name="call" style={{ fontSize: 16 }} />
                </a>
              )}
              {canEditPerson && (
                <button
                  onClick={() => onEditPerson(e)}
                  className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center active:scale-95 transition hover:text-[#d32029] shrink-0"
                  title="แก้ไขข้อมูลบุคคล"
                >
                  <Icon name="edit" style={{ fontSize: 16 }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- การ์ดพนักงานขาย ---------- */
function StaffCard({
  emp,
  busy,
  onEdit,
  onToggle,
}: {
  emp: Employee;
  busy: boolean;
  onEdit?: () => void;
  onToggle?: () => void;
}) {
  const isNew = isNewEmployee(emp.startDate);
  const age = ageFromBirthDate(emp.birthDate);
  const tenure = tenureFromStartDate(emp.startDate);
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border shadow-sm p-3.5 flex gap-3 relative",
        emp.isActive ? "border-slate-100" : "border-slate-200 opacity-60"
      )}
    >
      {onEdit && (
        <button
          onClick={onEdit}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center active:scale-95 transition hover:text-[#d32029]"
          title="แก้ไข"
        >
          <Icon name="edit" style={{ fontSize: 16 }} />
        </button>
      )}
      <Avatar emp={emp} />
      <div className={cn("min-w-0 flex-1", onEdit && "pr-9")}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[14px] font-bold text-slate-900 leading-tight">
            {emp.name}
            {emp.nickname && (
              <span className="font-semibold text-slate-500"> ({emp.nickname})</span>
            )}
          </p>
          {emp.level && <LevelBadge level={emp.level} />}
          {emp.position && <PositionBadge position={emp.position} />}
          {isNew && (
            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              ใหม่
            </span>
          )}
          {!emp.isActive && (
            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
              พักงาน
            </span>
          )}
        </div>
        {emp.position && (
          <p className="text-[11px] text-slate-500 mt-0.5">{POSITION_LABEL[emp.position]}</p>
        )}
        <div className="mt-1.5 space-y-0.5 text-[11.5px] text-slate-600">
          <p className="flex items-center gap-1.5">
            <Icon name="event_available" style={{ fontSize: 14 }} className="text-slate-400" />
            เข้างาน {thaiDate(emp.startDate)}
            {tenure ? ` · อายุงาน ${tenure}` : ""}
          </p>
          {emp.birthDate && (
            <p className="flex items-center gap-1.5">
              <Icon name="cake" style={{ fontSize: 14 }} className="text-slate-400" />
              เกิด {thaiDate(emp.birthDate)}
              {age !== null ? ` · อายุ ${age} ปี` : ""}
            </p>
          )}
          {emp.phone && (
            <p className="flex items-center gap-1.5">
              <Icon name="call" style={{ fontSize: 14 }} className="text-slate-400" />
              {emp.phone}
              {emp.phone2 ? ` , ${emp.phone2}` : ""}
            </p>
          )}
          {emp.email && (
            <p className="flex items-center gap-1.5 truncate">
              <Icon name="mail" style={{ fontSize: 14 }} className="text-slate-400" />
              <span className="truncate">{emp.email}</span>
            </p>
          )}
        </div>
        {emp.skills.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {emp.skills.map((s) => (
              <span
                key={s}
                className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100"
              >
                {s}
              </span>
            ))}
          </div>
        )}
        {emp.notes && (
          <p className="mt-1.5 text-[10.5px] text-amber-700 bg-amber-50/60 border border-amber-100 rounded-lg px-2 py-1 leading-snug">
            {emp.notes}
          </p>
        )}
        {onToggle && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={onToggle}
              disabled={busy}
              className={cn(
                "inline-flex items-center gap-1 px-3 h-7 rounded-full text-[11px] font-semibold active:scale-95 transition disabled:opacity-50",
                emp.isActive
                  ? "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-700"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              )}
            >
              <Icon
                name={emp.isActive ? "toggle_on" : "toggle_off"}
                style={{ fontSize: 16 }}
              />
              {emp.isActive ? "พักงาน" : "กลับมาทำงาน"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ emp, size = "md" }: { emp: Employee; size?: "md" | "sm" }) {
  const dim = size === "sm" ? "w-11 h-11 text-[13px]" : "w-16 h-16 text-[18px]";
  if (emp.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={emp.photoUrl}
        alt={emp.name}
        className={cn("rounded-2xl object-cover border border-slate-200 shrink-0", dim)}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-2xl bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white font-bold flex items-center justify-center shrink-0",
        dim
      )}
    >
      {initials(emp.name)}
    </div>
  );
}

function LevelBadge({ level }: { level: LevelKey }) {
  const m = LEVEL_META[level];
  return (
    <span
      className={cn("inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md border", m.className)}
      title={`${level} = ${m.label}`}
    >
      {level}
    </span>
  );
}

function PositionBadge({ position }: { position: PositionKey }) {
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#faf1f1] text-[#a11119] border border-red-100">
      {POSITION_SHORT[position]}
    </span>
  );
}
