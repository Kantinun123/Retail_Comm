"use client";

/* =============================================================
   Admin CRUD — จัดการพนักงาน (รายการ + toggle active + modal แก้ไข/เพิ่ม)
   เฉพาะ admin ; เลือกร้าน -> เห็นพนักงาน -> กดแก้ไข/เพิ่ม (modal กลาง)
   ใช้ EmployeeEditModal ร่วมกับหน้า store-roster
   ============================================================= */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { StorePicker } from "./store-picker";
import { EmployeeEditModal } from "./employee-edit-modal";
import { useSession, useHomeHref } from "@/lib/commission/session";
import {
  fetchStores,
  fetchStoreRoster,
  setEmployeeActive,
  POSITION_LABEL,
  type Employee,
  type StoreInfo,
} from "@/lib/commission/employee-store";
import { cn } from "@/lib/utils";

export function EmployeeAdminScreen() {
  const { session, ready } = useSession();
  const homeHref = useHomeHref();

  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [roster, setRoster] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  // modal: undefined = ปิด, null = เพิ่มใหม่, Employee = แก้ไข
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!ready || !session?.isAdmin) return;
    fetchStores()
      .then(setStores)
      .catch(() => {});
  }, [ready, session]);

  const loadRoster = useMemo(
    () => (dealer: string) => {
      setLoading(true);
      fetchStoreRoster(dealer)
        .then((r) => setRoster(r.filter((x) => !x.isSupervisor)))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    if (selected) loadRoster(selected);
    else setRoster([]);
  }, [selected, loadRoster]);

  if (!ready || !session) return null;

  if (!session.isAdmin) {
    return (
      <>
        <Header homeHref={homeHref} />
        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
            <Icon name="lock" className="text-3xl" />
          </div>
          <p className="mt-3 text-[15px] font-bold text-slate-900">
            เฉพาะผู้ดูแลระบบ (Admin)
          </p>
          <Link
            href="/app/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#d32029]"
          >
            <Icon name="arrow_back" className="text-lg" />
            กลับหน้าภาพรวม
          </Link>
        </div>
        <BottomNav active="database" />
      </>
    );
  }

  async function onToggleActive(e: Employee) {
    const res = await setEmployeeActive(e.repCode, !e.isActive);
    if (res.ok && selected) loadRoster(selected);
    else if (!res.ok) setMsg({ type: "err", text: res.error ?? "ทำรายการไม่สำเร็จ" });
  }

  const activeCount = roster.filter((e) => e.isActive).length;
  const inactiveCount = roster.length - activeCount;
  const visibleRoster = showInactive ? roster : roster.filter((e) => e.isActive);

  return (
    <>
      <Header homeHref={homeHref} />

      <div className="space-y-4 pb-4">
        {/* เลือกร้าน (chip ภาค + model + ค้นหา) */}
        <StorePicker
          stores={stores}
          selected={selected}
          onSelect={(code) => {
            setSelected(code);
            setMsg(null);
          }}
        />

        {/* รายชื่อพนักงาน + ปุ่มเพิ่ม */}
        {selected && (
          <section>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <Icon name="badge" className="text-lg text-[#d32029]" />
                พนักงานในร้าน
              </h3>
              <button
                onClick={() => {
                  setEditing(null);
                  setMsg(null);
                }}
                className="inline-flex items-center gap-1 text-[12px] font-bold text-white bg-[#d32029] px-3 py-1.5 rounded-full active:scale-95 transition"
              >
                <Icon name="add" style={{ fontSize: 16 }} />
                เพิ่มพนักงาน
              </button>
            </div>

            {/* ตัวนับสถานะ + ตัวกรอง */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ทำงาน {activeCount}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  พักงาน {inactiveCount}
                </span>
              </div>
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1 active:scale-95"
              >
                <Icon
                  name={showInactive ? "visibility" : "visibility_off"}
                  style={{ fontSize: 15 }}
                />
                {showInactive ? "แสดงทั้งหมด" : "เฉพาะทำงาน"}
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center">
                <Icon name="progress_activity" className="animate-spin text-2xl text-[#d32029]" />
              </div>
            ) : (
              <div className="space-y-1.5">
                {visibleRoster.map((e) => (
                  <div
                    key={e.repCode}
                    className={cn(
                      "bg-white rounded-xl border shadow-sm px-3 py-2 flex items-center gap-2.5",
                      e.isActive ? "border-slate-100" : "border-slate-200 opacity-60"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold text-slate-800 truncate">
                          {e.name}
                          {e.nickname ? ` (${e.nickname})` : ""}
                        </p>
                        <span
                          className={cn(
                            "text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border shrink-0",
                            e.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          )}
                        >
                          {e.isActive ? "Active" : "Non-active"}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-400">
                        {e.repCode}
                        {e.position ? ` · ${POSITION_LABEL[e.position]}` : ""}
                        {e.level ? ` · ${e.level}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditing(e);
                        setMsg(null);
                      }}
                      className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center active:scale-95 transition hover:text-[#d32029] shrink-0"
                      title="แก้ไข"
                    >
                      <Icon name="edit" style={{ fontSize: 17 }} />
                    </button>
                    <button
                      onClick={() => onToggleActive(e)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[11px] font-semibold active:scale-95 transition shrink-0",
                        e.isActive
                          ? "bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      )}
                      title={e.isActive ? "เปลี่ยนเป็นพักงาน" : "เปลี่ยนเป็นทำงาน"}
                    >
                      <Icon
                        name={e.isActive ? "toggle_on" : "toggle_off"}
                        style={{ fontSize: 17 }}
                      />
                      {e.isActive ? "พักงาน" : "ทำงาน"}
                    </button>
                  </div>
                ))}
                {visibleRoster.length === 0 && (
                  <p className="text-[12px] text-slate-400 text-center py-4">
                    {roster.length === 0
                      ? 'ยังไม่มีพนักงาน — กด "เพิ่มพนักงาน"'
                      : 'ไม่มีพนักงานที่ทำงานอยู่ (กด "แสดงทั้งหมด")'}
                  </p>
                )}
              </div>
            )}

            {msg && (
              <p
                className={cn(
                  "mt-2 text-[12px] font-semibold rounded-lg px-3 py-2",
                  msg.type === "ok"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-[#a11119] border border-red-200"
                )}
              >
                {msg.text}
              </p>
            )}
          </section>
        )}
      </div>

      {/* modal แก้ไข/เพิ่ม */}
      {editing !== undefined && (
        <EmployeeEditModal
          employee={editing}
          stores={stores}
          defaultDealer={selected}
          onClose={() => setEditing(undefined)}
          onSaved={(moved) => {
            if (selected) loadRoster(selected);
            if (moved) fetchStores().then(setStores).catch(() => {});
          }}
        />
      )}

      <BottomNav active="database" />
    </>
  );
}

function Header({ homeHref }: { homeHref: string }) {
  return (
    <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
      <div className="flex items-center space-x-2.5">
        <Link
          href={homeHref}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
        >
          <Icon name="arrow_back" className="text-xl" />
        </Link>
        <div className="flex flex-col">
          <span className="font-bold text-[15px] text-[#231313] leading-tight">
            จัดการพนักงาน
          </span>
          <span className="text-[11px] font-semibold text-[#b21e1e]">
            เฉพาะผู้ดูแลระบบ (Admin)
          </span>
        </div>
      </div>
      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#d32029]">
        <Icon name="manage_accounts" className="text-xl" />
      </div>
    </header>
  );
}
