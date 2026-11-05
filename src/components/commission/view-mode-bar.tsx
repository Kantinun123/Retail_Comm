"use client";

/* =============================================================
   แถบมุมมองของ admin — "ดูในมุมมอง" ร้านค้า / พนักงาน
   - กรองร้าน: ประเภท (model) → ภาค (region) → เลือกร้าน
   - ระดับ: ทั้งร้าน (store view) | รายพนักงาน (staff view)
   - ปุ่มออกจากมุมมอง -> กลับ dashboard
   แสดงเฉพาะ admin เท่านั้น (เรียกจากหน้า home/home-staff/dashboard)
   ============================================================= */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { useSession, enterStoreView, enterStaffView, exitAdminView, setStoreFilter } from "@/lib/commission/session";
import { getDealers } from "@/lib/commission/logic";
import { fetchSaleReps, type SaleRep } from "@/lib/commission/sale-reps-store";

export function ViewModeBar() {
  const { session } = useSession();
  const router = useRouter();

  const dealers = getDealers();
  const [typeFilter, setTypeFilter] = useState<string>("");   // "" = ทั้งหมด | model
  const [regionFilter, setRegionFilter] = useState<string>(""); // "" = ทั้งหมด | region
  const [reps, setReps] = useState<SaleRep[]>([]);

  const viewMode = session?.adminViewMode ?? "admin";
  // ร้านที่แถบใช้: ถ้าอยู่ในมุมมองใช้ adminViewDealer, ไม่งั้นผูกกับ storeFilter (เลือกร้านที่เดียว)
  const viewDealer = session?.adminViewDealer ?? session?.storeFilter ?? null;
  const viewRep = session?.adminViewRep ?? null;

  // ตัวเลือกประเภท/ภาค จากข้อมูลร้านจริง
  const types = useMemo(
    () => [...new Set(dealers.map((d) => d.model).filter(Boolean))].sort(),
    [dealers]
  );
  const regions = useMemo(
    () => [...new Set(dealers.map((d) => d.region).filter((r): r is string => !!r))].sort(),
    [dealers]
  );

  // ร้านที่ผ่านตัวกรอง
  const filteredDealers = useMemo(
    () =>
      dealers.filter(
        (d) =>
          (!typeFilter || d.model === typeFilter) &&
          (!regionFilter || d.region === regionFilter)
      ),
    [dealers, typeFilter, regionFilter]
  );

  // โหลดพนักงานของร้านที่เลือก (ใช้ตอนโหมดรายพนักงาน)
  useEffect(() => {
    if (!viewDealer) { setReps([]); return; }
    let cancelled = false;
    fetchSaleReps(viewDealer).then((r) => { if (!cancelled) setReps(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [viewDealer]);

  if (!session?.isAdmin) return null;

  const selectCls =
    "appearance-none bg-white text-slate-900 text-[12px] font-semibold rounded-lg pl-3 pr-8 py-2 border border-slate-200 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15 transition truncate";

  function pickDealer(code: string) {
    // เลือกร้านจากแถบ = ตั้ง storeFilter ด้วย (ช่องเลือกร้านที่เดียว)
    setStoreFilter(code || null);
    if (!code) { exitAdminView(); return; }
    enterStoreView(code);
    router.push("/app/home");
  }

  function pickLevel(level: "store" | "staff") {
    if (!viewDealer) return;
    if (level === "store") {
      enterStoreView(viewDealer);
      router.push("/app/home");
    } else {
      const first = reps[0];
      if (!first) return;
      enterStaffView(viewDealer, first.repCode, first.name);
      router.push("/app/home-staff");
    }
  }

  function pickRep(repCode: string) {
    if (!viewDealer || !repCode) return;
    const rep = reps.find((r) => r.repCode === repCode);
    enterStaffView(viewDealer, repCode, rep?.name ?? null);
    router.push("/app/home-staff");
  }

  return (
    <div className="rounded-2xl bg-white border border-violet-200 shadow-sm p-3 mb-1">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">
          <Icon name="admin_panel_settings" style={{ fontSize: 14 }} />
          แถบมุมมอง (admin)
        </span>
        {viewMode !== "admin" && (
          <button
            type="button"
            onClick={() => { exitAdminView(); router.push("/app/home"); }}
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-[11px] font-bold text-[#b91c1c] active:scale-95 transition"
          >
            <Icon name="close" style={{ fontSize: 13 }} />
            ออกจากมุมมอง
          </button>
        )}
      </div>

      {/* ตัวกรอง: ประเภท → ภาค → ร้าน */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ประเภทร้าน</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls + " w-full"}>
            <option value="">ทั้งหมด</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Icon name="expand_more" className="pointer-events-none absolute right-2 bottom-2 text-slate-400" style={{ fontSize: 16 }} />
        </div>
        <div className="relative">
          <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ภาค</label>
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className={selectCls + " w-full"}>
            <option value="">ทั้งหมด</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <Icon name="expand_more" className="pointer-events-none absolute right-2 bottom-2 text-slate-400" style={{ fontSize: 16 }} />
        </div>
      </div>

      <div className="relative mt-2">
        <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">
          ร้าน ({filteredDealers.length} ร้าน)
        </label>
        <select value={viewDealer ?? ""} onChange={(e) => pickDealer(e.target.value)} className={selectCls + " w-full"}>
          <option value="">— เลือกร้านเพื่อเข้าดูมุมมอง —</option>
          {filteredDealers.map((d) => (
            <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
          ))}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute right-2 bottom-2 text-slate-400" style={{ fontSize: 16 }} />
      </div>

      {/* ระดับ + พนักงาน (เมื่อเลือกร้านแล้ว) */}
      {viewDealer && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => pickLevel("store")}
              className={"px-3 py-1.5 rounded-md text-[11px] font-bold transition " + (viewMode === "store" ? "bg-[#7c3aed] text-white" : "text-slate-600")}
            >
              🏪 ทั้งร้าน
            </button>
            <button
              type="button"
              onClick={() => pickLevel("staff")}
              disabled={reps.length === 0}
              className={"px-3 py-1.5 rounded-md text-[11px] font-bold transition disabled:opacity-40 " + (viewMode === "staff" ? "bg-[#7c3aed] text-white" : "text-slate-600")}
            >
              👤 รายพนักงาน
            </button>
          </div>

          {viewMode === "staff" && reps.length > 0 && (
            <div className="relative flex-1 min-w-[150px]">
              <select value={viewRep ?? ""} onChange={(e) => pickRep(e.target.value)} className={selectCls + " w-full"}>
                {reps.map((r) => (
                  <option key={r.repCode} value={r.repCode}>{r.name} ({r.crCode ?? r.repCode})</option>
                ))}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-2 top-2 text-slate-400" style={{ fontSize: 16 }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
