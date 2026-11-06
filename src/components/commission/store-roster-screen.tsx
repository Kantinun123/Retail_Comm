"use client";

/* =============================================================
   View B — Store Roster (ทีมงานรายร้าน) แบบการ์ดรูป (ภาพที่ 2)
   - admin: เลือกร้านจาก picker แล้วดูทีมงาน + หัวหน้า (area/coach)
   - dealer/sales: เห็นเฉพาะร้านตัวเอง
   - การ์ดพนักงาน: รูป · ชื่อ · ตำแหน่ง/level · วันเข้างาน · ป้าย "ใหม่"/skills · เบอร์/email
   ============================================================= */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { StorePicker } from "./store-picker";
import { EmployeeEditModal } from "./employee-edit-modal";
import { useSession, useHomeHref, doLogout } from "@/lib/commission/session";
import {
  ageFromBirthDate,
  fetchStores,
  fetchStoreRoster,
  isNewEmployee,
  tenureFromStartDate,
  LEVEL_META,
  POSITION_LABEL,
  POSITION_SHORT,
  type Employee,
  type LevelKey,
  type PositionKey,
  type StoreInfo,
} from "@/lib/commission/employee-store";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "–";
}

/** แปลงวันที่ ISO -> วันที่ไทย dd/mm/yyyy (พ.ศ.) */
function thaiDate(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

function modelAccent(model: string | null): string {
  if (!model) return "bg-slate-100 text-slate-600";
  if (model.includes("Housing")) return "bg-red-50 text-[#d32029]";
  if (model.includes("SCG")) return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

export function StoreRosterScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const homeHref = useHomeHref();

  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [roster, setRoster] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  // admin: พนักงานที่กำลังแก้ไขใน modal (undefined = ปิด, null = เพิ่มใหม่, Employee = แก้)
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);

  // ร้านที่ใช้แสดงผลตาม role: dealer/sales = ร้านตัวเอง ; admin = ร้านที่เลือก
  const scopedDealer = useMemo(() => {
    if (!session) return null;
    if (session.isAdmin) return selected;
    return session.dealer.code || null;
  }, [session, selected]);

  // โหลดรายชื่อร้าน (เฉพาะ admin ใช้ picker)
  useEffect(() => {
    if (!ready || !session) return;
    let cancelled = false;
    if (session.isAdmin) {
      fetchStores()
        .then((s) => {
          if (!cancelled) setStores(s);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [ready, session]);

  // โหลด roster เมื่อมีร้าน
  useEffect(() => {
    if (!ready || !session) return;
    if (!scopedDealer) {
      setRoster([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchStoreRoster(scopedDealer)
      .then((r) => {
        if (!cancelled) setRoster(r);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, session, scopedDealer]);

  // reload roster (ใช้หลังบันทึกจาก modal)
  function reloadRoster() {
    if (scopedDealer) fetchStoreRoster(scopedDealer).then(setRoster).catch(() => {});
  }

  if (!ready || !session) return null;

  const activeStore =
    stores.find((s) => s.code === scopedDealer) ??
    (scopedDealer && !session.isAdmin
      ? {
          code: session.dealer.code,
          name: session.dealer.name,
          model: session.dealer.model,
          region: session.dealer.region,
          province: session.dealer.province,
          branch: session.dealer.branch,
          tier: session.dealer.tier,
          logoUrl: null,
          isActive: true,
          empCount: roster.filter((r) => !r.isSupervisor).length,
        }
      : null);

  const supervisors = roster.filter((r) => r.isSupervisor);
  const allMembers = roster.filter((r) => !r.isSupervisor);
  const activeMembers = allMembers.filter((m) => m.isActive);
  const inactiveCount = allMembers.length - activeMembers.length;
  const members = showInactive ? allMembers : activeMembers;
  const hasSE = activeMembers.some((m) => m.position === "se");

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link
            href={homeHref}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">
            ทีมงานรายร้าน
          </span>
        </div>
        <button
          onClick={() => {
            doLogout();
            router.replace("/");
          }}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[#a11119] bg-white border border-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition"
        >
          <Icon name="logout" style={{ fontSize: 16 }} />
          ออกจากระบบ
        </button>
      </header>

      <div className="space-y-4 pb-4">
        {/* admin: ตัวเลือกร้าน (chip ภาค + model + ค้นหา) */}
        {session.isAdmin && (
          <StorePicker
            stores={stores}
            selected={selected}
            onSelect={setSelected}
          />
        )}

        {/* ยังไม่เลือกร้าน (admin) */}
        {session.isAdmin && !scopedDealer && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
              <Icon name="storefront" className="text-2xl" />
            </div>
            <p className="mt-2 text-[13px] text-slate-500">
              เลือกร้านค้าด้านบนเพื่อดูทีมงาน
            </p>
          </div>
        )}

        {/* ส่วนหัวร้าน + หัวหน้าที่ดูแล */}
        {activeStore && scopedDealer && (
          <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full",
                  modelAccent(activeStore.model)
                )}
              >
                <Icon name="verified" style={{ fontSize: 13 }} />
                {activeStore.model ?? "ร้านค้า"}
              </span>
              <p className="text-[17px] font-bold leading-tight mt-2">
                {activeStore.name}
              </p>
              <p className="text-[11.5px] text-red-100/90 mt-0.5">
                {activeStore.code} · {activeStore.province ?? activeStore.region ?? "–"}
              </p>
              <div className="mt-3 flex items-center gap-3 text-[11.5px]">
                <span className="inline-flex items-center gap-1 bg-white/10 border border-white/10 backdrop-blur-md px-2.5 py-1 rounded-full">
                  <Icon name="groups" style={{ fontSize: 14 }} />
                  {members.length} คนในร้าน
                </span>
                {!hasSE && (
                  <span className="inline-flex items-center gap-1 bg-white/15 border border-white/20 px-2.5 py-1 rounded-full font-semibold">
                    <Icon name="warning" style={{ fontSize: 14 }} />
                    ไม่มี SE
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* หัวหน้าที่ดูแลร้าน (area/coach) */}
        {scopedDealer && supervisors.length > 0 && (
          <section>
            <h3 className="text-[13px] font-bold text-slate-900 mb-2 flex items-center gap-1.5 px-1">
              <Icon name="supervisor_account" className="text-lg text-[#d32029]" />
              หัวหน้าที่ดูแลร้าน
            </h3>
            <div className="space-y-2">
              {supervisors.map((e) => (
                <SupervisorRow key={e.repCode} emp={e} />
              ))}
            </div>
          </section>
        )}

        {/* การ์ดพนักงานในร้าน */}
        {scopedDealer && (
          <section>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <Icon name="badge" className="text-lg text-[#d32029]" />
                พนักงานในร้าน
                <span className="text-[11px] font-semibold text-slate-400">
                  ({activeMembers.length} ทำงาน
                  {inactiveCount > 0 ? ` · ${inactiveCount} พักงาน` : ""})
                </span>
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
                    {showInactive ? "ซ่อนพักงาน" : "แสดงพักงาน"}
                  </button>
                )}
                {session.isAdmin && (
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
            {loading ? (
              <div className="py-10 text-center">
                <Icon name="progress_activity" className="animate-spin text-3xl text-[#d32029]" />
              </div>
            ) : members.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <Icon name="person_off" className="text-2xl" />
                </div>
                <p className="mt-2 text-[13px] text-slate-500">
                  ยังไม่มีพนักงานในร้านนี้
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {members.map((e) => (
                  <EmployeeCard
                    key={e.repCode}
                    emp={e}
                    onEdit={session.isAdmin ? () => setEditing(e) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <p className="text-[11px] text-slate-400 text-center">
          ป้าย B/S/A = ระดับพนักงาน (Beginner / Standard / Advance) · ป้าย
          &quot;ใหม่&quot; = เข้างานไม่เกิน 90 วัน
        </p>
      </div>

      {/* admin: modal แก้ไข/เพิ่มพนักงาน (จบในหน้าเดียว) */}
      {editing !== undefined && session.isAdmin && (
        <EmployeeEditModal
          employee={editing}
          stores={stores}
          defaultDealer={scopedDealer}
          onClose={() => setEditing(undefined)}
          onSaved={() => reloadRoster()}
        />
      )}

      <BottomNav active="database" />
    </>
  );
}

/* ---------- การ์ดพนักงาน ---------- */
function Avatar({
  emp,
  size = "md",
}: {
  emp: Employee;
  size?: "md" | "sm";
}) {
  const dim = size === "sm" ? "w-11 h-11 text-[13px]" : "w-16 h-16 text-[18px]";
  if (emp.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={emp.photoUrl}
        alt={emp.name}
        className={cn(
          "rounded-2xl object-cover border border-slate-200 shrink-0",
          dim
        )}
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
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border",
        m.className
      )}
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

function EmployeeCard({ emp, onEdit }: { emp: Employee; onEdit?: () => void }) {
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
              ปิดใช้งาน
            </span>
          )}
        </div>
        {emp.position && (
          <p className="text-[11px] text-slate-500 mt-0.5">
            {POSITION_LABEL[emp.position]}
          </p>
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
      </div>
    </div>
  );
}

function SupervisorRow({ emp }: { emp: Employee }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex items-center gap-3">
      <Avatar emp={emp} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-bold text-slate-900 truncate">
            {emp.name}
            {emp.nickname && (
              <span className="font-semibold text-slate-500"> ({emp.nickname})</span>
            )}
          </p>
          {emp.level && <LevelBadge level={emp.level} />}
        </div>
        <p className="text-[11px] text-slate-500">
          {emp.position ? POSITION_LABEL[emp.position] : emp.roleInStore ?? "หัวหน้า"}
        </p>
      </div>
      {emp.phone && (
        <a
          href={`tel:${emp.phone}`}
          className="w-9 h-9 rounded-full bg-red-50 text-[#d32029] flex items-center justify-center shrink-0 active:scale-95 transition"
        >
          <Icon name="call" style={{ fontSize: 18 }} />
        </a>
      )}
    </div>
  );
}
