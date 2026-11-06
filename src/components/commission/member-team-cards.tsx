"use client";

/* =============================================================
   หน้า "ฉัน": การ์ดข้อมูลพนักงาน / ข้อมูลร้าน (อ่านอย่างเดียว)
   - พนักงานขาย : ข้อมูลของตัวเอง + Area/Coach ที่ดูแลร้าน (เบอร์/อีเมลกดติดต่อได้)
   - ร้านค้า     : ข้อมูลร้าน + Area/Coach + รายชื่อพนักงานในร้าน
   ไม่แสดงวันเกิด/อายุ และเบอร์/อีเมลของพนักงานทั่วไป (เฉพาะ Area/Coach เท่านั้น)
   admin / Area-Coach ไม่แสดงการ์ดนี้
   ============================================================= */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { useSession } from "@/lib/commission/session";
import { useTeamData } from "@/lib/commission/team-data";
import {
  tenureFromStartDate,
  LEVEL_META,
  POSITION_LABEL,
  type Employee,
} from "@/lib/commission/employee-store";
import { cn } from "@/lib/utils";

/** ตัดทุกอย่างที่ไม่ใช่ตัวเลข/+ ออก เพื่อใช้ใน tel: */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function LevelBadge({ level }: { level: Employee["level"] }) {
  if (!level) return null;
  const meta = LEVEL_META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
        meta.className
      )}
    >
      {level} · {meta.label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0 text-[12px]">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-semibold text-slate-800 text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

function Unset() {
  return <span className="font-normal text-slate-300">ยังไม่ระบุ</span>;
}

function SupervisorRow({ emp }: { emp: Employee }) {
  const roleLabel =
    emp.roleInStore === "manager" || emp.position === "area_mng"
      ? POSITION_LABEL.area_mng
      : POSITION_LABEL.coach;
  const display = emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name;
  const phones = [emp.phone, emp.phone2].filter((p): p is string => !!p && !!p.trim());
  return (
    <li className="py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2.5">
        {emp.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={emp.photoUrl} alt={emp.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-red-50 text-[#a11119] flex items-center justify-center text-[13px] font-bold shrink-0">
            {emp.name.replace(/\s/g, "").slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-slate-900 truncate">{display}</p>
          <p className="text-[11px] text-slate-500">{roleLabel}</p>
        </div>
      </div>
      {(phones.length > 0 || emp.email) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-[50px]">
          {phones.map((p) => (
            <a
              key={p}
              href={telHref(p)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#16a34a] rounded-full px-3 py-1.5 active:scale-95 transition"
            >
              <Icon name="call" style={{ fontSize: 14 }} />
              โทร {p}
            </a>
          ))}
          {emp.email && (
            <a
              href={`mailto:${emp.email}`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#a11119] bg-red-50 border border-red-200/70 rounded-full px-3 py-1.5 active:scale-95 transition max-w-full"
            >
              <Icon name="mail" style={{ fontSize: 14 }} />
              <span className="truncate">{emp.email}</span>
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function SupervisorCard({ list, title }: { list: Employee[]; title: string }) {
  if (list.length === 0) return null;
  return (
    <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
      <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 mb-1">
        <Icon name="support_agent" className="text-lg text-[#d32029]" />
        {title}
      </h3>
      <ul>
        {list.map((e) => (
          <SupervisorRow key={e.repCode} emp={e} />
        ))}
      </ul>
    </section>
  );
}

export function MemberTeamCards() {
  const { session, ready } = useSession();
  const dealerCode =
    ready && session && !session.isAdmin && !session.isArea ? session.dealer.code : "";
  const isSales = !!session?.isSales;
  const empId = session?.empId ?? null;

  const [selected, setSelected] = useState<Employee | null>(null);
  const view = useTeamData(dealerCode);

  const { me, supervisors, staff } = useMemo(() => {
    const roster = (view?.roster ?? []).filter((e) => e.isActive);
    const sup = roster
      .filter((e) => e.isSupervisor)
      .sort((a, b) => (a.roleInStore === "manager" ? 0 : 1) - (b.roleInStore === "manager" ? 0 : 1));
    const team = roster
      .filter((e) => !e.isSupervisor)
      .sort((a, b) => {
        const rank = (e: Employee) => (e.level ? LEVEL_META[e.level].rank : 0);
        return rank(b) - rank(a) || a.name.localeCompare(b.name, "th");
      });
    return {
      me: empId ? team.find((e) => e.repCode === empId) ?? null : null,
      supervisors: sup,
      staff: team,
    };
  }, [view, empId]);

  if (!view) return null;
  const store = view.store;

  /* ---------- พนักงานขาย ---------- */
  if (isSales) {
    const tenure = me ? tenureFromStartDate(me.startDate) : null;
    return (
      <>
        {me && (
          <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 mb-1.5">
              <Icon name="badge" className="text-lg text-[#d32029]" />
              ข้อมูลพนักงาน
            </h3>
            {me.nickname && <Row label="ชื่อเล่น">{me.nickname}</Row>}
            <Row label="ตำแหน่ง">{me.position ? POSITION_LABEL[me.position] : "-"}</Row>
            {me.level && (
              <Row label="ระดับ">
                <LevelBadge level={me.level} />
              </Row>
            )}
            <Row label="วันเริ่มงาน">
              {me.startDate ? (
                new Date(me.startDate).toLocaleDateString("th-TH", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              ) : (
                <Unset />
              )}
            </Row>
            {tenure && <Row label="อายุงาน">{tenure}</Row>}
            <Row label="ร้านที่สังกัด">{store?.name ?? session?.dealer.name ?? "-"}</Row>
            <Row label="เบอร์โทร">
              {[me.phone, me.phone2].some((p) => p && p.trim()) ? (
                <span className="flex flex-col items-end gap-0.5">
                  {[me.phone, me.phone2]
                    .filter((p): p is string => !!p && !!p.trim())
                    .map((p) => (
                      <a key={p} href={telHref(p)} className="text-[#16a34a] hover:underline">
                        {p}
                      </a>
                    ))}
                </span>
              ) : (
                <Unset />
              )}
            </Row>
            <Row label="อีเมล">
              {me.email ? (
                <a href={`mailto:${me.email}`} className="text-[#a11119] hover:underline break-all">
                  {me.email}
                </a>
              ) : (
                <Unset />
              )}
            </Row>
            <Row label="ไลน์">{me.lineId ? me.lineId : <Unset />}</Row>
            <p className="text-[10.5px] text-slate-400 mt-2">
              ข้อมูลผิดหรือไม่ครบ แจ้งผู้ดูแลระบบเพื่อแก้ไข
            </p>
          </section>
        )}
        <SupervisorCard list={supervisors} title="หัวหน้าที่ดูแลร้านคุณ" />
      </>
    );
  }

  /* ---------- ร้านค้าตัวแทน ---------- */
  return (
    <>
      {store && (
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
              <Icon name="storefront" className="text-lg text-[#d32029]" />
              ข้อมูลร้าน
            </h3>
            <Link href={`/app/store/${store.code}`} className="text-[11px] font-bold text-[#d32029] inline-flex items-center">
              ดูทีมงานเต็ม
              <Icon name="chevron_right" style={{ fontSize: 16 }} />
            </Link>
          </div>
          {store.photoUrl && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 mb-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={store.photoUrl} alt={store.name} className="mx-auto max-h-56 w-auto max-w-full object-contain" />
            </div>
          )}
          {store.model && <Row label="Model">{store.model}</Row>}
          {store.region && <Row label="ภาค">{store.region}</Row>}
          {store.province && <Row label="จังหวัด">{store.province}</Row>}
        </section>
      )}

      <SupervisorCard list={supervisors} title="หัวหน้าที่ดูแลร้าน" />

      {staff.length > 0 && (
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 mb-1">
            <Icon name="groups" className="text-lg text-[#d32029]" />
            พนักงานในร้าน ({staff.length} คน)
          </h3>
          <ul>
            {staff.map((e) => {
              const tenure = tenureFromStartDate(e.startDate);
              const display = e.nickname ? `${e.name} (${e.nickname})` : e.name;
              return (
                <li key={e.repCode} className="border-b border-slate-50 last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    aria-label={`ดูรายละเอียด ${display}`}
                    className="w-full flex items-center gap-2.5 py-2 text-left hover:bg-slate-50 active:bg-slate-100 transition rounded-lg"
                  >
                    {e.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.photoUrl} alt={e.name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-red-50 text-[#a11119] flex items-center justify-center text-[12px] font-bold shrink-0">
                        {e.name.replace(/\s/g, "").slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold text-slate-900 truncate">{display}</p>
                      <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                        <span>{e.position ? POSITION_LABEL[e.position] : "-"}</span>
                        {tenure && <span>· อายุงาน {tenure}</span>}
                      </p>
                    </div>
                    <LevelBadge level={e.level} />
                    <Icon name="chevron_right" className="text-slate-300 text-lg shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-slate-400 mt-2">กดที่ชื่อเพื่อดูรายละเอียด · ต้องการแก้ไขข้อมูล แจ้งผู้ดูแลระบบ</p>
        </section>
      )}

      {selected && <EmployeeDetailSheet emp={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

/** รายละเอียดพนักงานในร้าน (อ่านอย่างเดียว) — ไม่แสดงวันเกิด/อายุ และหมายเหตุภายใน */
function EmployeeDetailSheet({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tenure = tenureFromStartDate(emp.startDate);
  const phones = [emp.phone, emp.phone2].filter((p): p is string => !!p && !!p.trim());
  const startText = emp.startDate
    ? new Date(emp.startDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`รายละเอียด ${emp.name}`}
        className="w-full max-w-md bg-white rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {emp.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emp.photoUrl} alt={emp.name} className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#a11119] flex items-center justify-center text-[18px] font-bold shrink-0">
              {emp.name.replace(/\s/g, "").slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold text-slate-900 leading-tight">{emp.name}</p>
            {emp.nickname && <p className="text-[12px] text-slate-500">ชื่อเล่น {emp.nickname}</p>}
            <div className="mt-1.5">
              <LevelBadge level={emp.level} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
          >
            <Icon name="close" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="mt-3">
          <Row label="รหัสพนักงาน">{emp.repCode}</Row>
          {emp.crCode && <Row label="รหัส CR">{emp.crCode}</Row>}
          <Row label="ตำแหน่ง">{emp.position ? POSITION_LABEL[emp.position] : "-"}</Row>
          {startText && <Row label="วันเริ่มงาน">{startText}</Row>}
          {tenure && <Row label="อายุงาน">{tenure}</Row>}
          {emp.lineId && <Row label="ไลน์">{emp.lineId}</Row>}
        </div>

        {(phones.length > 0 || emp.email) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {phones.map((p) => (
              <a
                key={p}
                href={telHref(p)}
                className="inline-flex items-center gap-1 text-[12px] font-bold text-white bg-[#16a34a] rounded-full px-3.5 py-2 active:scale-95 transition"
              >
                <Icon name="call" style={{ fontSize: 15 }} />
                โทร {p}
              </a>
            ))}
            {emp.email && (
              <a
                href={`mailto:${emp.email}`}
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[#a11119] bg-red-50 border border-red-200/70 rounded-full px-3.5 py-2 active:scale-95 transition max-w-full"
              >
                <Icon name="mail" style={{ fontSize: 15 }} />
                <span className="truncate">{emp.email}</span>
              </a>
            )}
          </div>
        )}
        {phones.length === 0 && !emp.email && !emp.lineId && (
          <p className="text-[12px] text-slate-400 mt-3">ยังไม่มีข้อมูลติดต่อของพนักงานคนนี้</p>
        )}

        {emp.skills.length > 0 && (
          <div className="mt-4">
            <p className="text-[12px] font-semibold text-slate-500 mb-1.5">ทักษะ</p>
            <div className="flex flex-wrap gap-1.5">
              {emp.skills.map((s) => (
                <span key={s} className="text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-full px-2.5 py-1">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10.5px] text-slate-400 mt-4">
          ข้อมูลผิดหรือไม่ตรงปัจจุบัน แจ้งผู้ดูแลระบบเพื่อแก้ไข
        </p>
      </div>
    </div>
  );
}
