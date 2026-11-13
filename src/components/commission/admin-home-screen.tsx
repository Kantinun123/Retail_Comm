"use client";

/* =============================================================
   หน้าแรกผู้ดูแลระบบ (admin) — การ์ดเลือกเรื่องที่จะดู (launcher)
   - ไม่ดึงตัวเลขใด ๆ ในหน้าแรก (เบาสุด)
   - ดูข้อมูล: มุมมองร้านค้า / มุมมองพนักงาน -> เปิด picker ในหน้าเดียวกัน (พิมพ์ค้นร้านได้)
   - จัดการระบบ: ฐานข้อมูล / อนุมัติแลกของรางวัล -> ไปหน้าเดิม
   ============================================================= */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { ProfileCard } from "./profile-card";
import { doLogout, useSession, enterStoreView, enterStaffView } from "@/lib/commission/session";
import { getDealers } from "@/lib/commission/logic";
import { useAdminPending } from "@/lib/commission/admin-pending";
import { fetchSaleReps, type SaleRep } from "@/lib/commission/sale-reps-store";
import { SearchableSelect, type ComboOption } from "./searchable-select";

type PickerMode = null | "store" | "staff";

export function AdminHomeScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const dealers = getDealers();
  const pending = useAdminPending(!!session?.isAdmin);

  const [picker, setPicker] = useState<PickerMode>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("");
  const [dealerCode, setDealerCode] = useState<string>("");
  const [repCode, setRepCode] = useState<string>("");
  const [reps, setReps] = useState<SaleRep[]>([]);
  const [repsLoading, setRepsLoading] = useState(false);

  // role อื่นไม่ควรมาหน้านี้
  useEffect(() => {
    if (ready && session && !session.isAdmin) {
      router.replace(session.isSales ? "/app/home-staff" : "/app/home");
    }
  }, [ready, session, router]);

  // โหลดพนักงานเมื่ออยู่โหมด staff + เลือกร้านแล้ว
  useEffect(() => {
    if (picker !== "staff" || !dealerCode) { setReps([]); return; }
    let cancelled = false;
    setRepsLoading(true);
    fetchSaleReps(dealerCode)
      .then((r) => { if (!cancelled) { setReps(r); setRepCode(r[0]?.repCode ?? ""); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRepsLoading(false); });
    return () => { cancelled = true; };
  }, [picker, dealerCode]);

  const types = useMemo(() => [...new Set(dealers.map((d) => d.model).filter(Boolean))].sort(), [dealers]);
  const regions = useMemo(
    () => [...new Set(dealers.map((d) => d.region).filter((r): r is string => !!r))].sort(),
    [dealers]
  );
  const dealerOptions: ComboOption[] = useMemo(
    () =>
      dealers
        .filter((d) => (!typeFilter || d.model === typeFilter) && (!regionFilter || d.region === regionFilter))
        .map((d) => ({ value: d.code, label: d.name, sub: "รหัส " + d.code + (d.region ? " · " + d.region : ""), tag: d.model })),
    [dealers, typeFilter, regionFilter]
  );
  const repOptions: ComboOption[] = useMemo(
    () => reps.map((r) => ({ value: r.repCode, label: r.name, sub: r.crCode ?? r.repCode })),
    [reps]
  );

  if (!ready || !session) return null;
  if (!session.isAdmin) return null;

  function openPicker(mode: Exclude<PickerMode, null>) {
    setPicker(mode);
    setDealerCode("");
    setRepCode("");
    setTypeFilter("");
    setRegionFilter("");
  }

  function confirmStore() {
    if (!dealerCode) return;
    enterStoreView(dealerCode);
    router.push("/app/home");
  }
  function confirmStaff() {
    if (!dealerCode || !repCode) return;
    const rep = reps.find((r) => r.repCode === repCode);
    enterStaffView(dealerCode, repCode, rep?.name ?? null);
    router.push("/app/home-staff");
  }

  const selCls = "w-full appearance-none bg-white text-slate-900 text-[13px] font-semibold rounded-xl pl-3 pr-9 py-2.5 border border-slate-200 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15 transition";

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <span className="font-bold text-[16px] text-[#231313]">หน้าหลัก</span>
        <button
          onClick={() => { doLogout(); router.replace("/"); }}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[#a11119] bg-white border border-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition"
        >
          <Icon name="logout" style={{ fontSize: 16 }} />
          ออกจากระบบ
        </button>
      </header>

      <div className="space-y-5 pb-4">
        <ProfileCard />

        <p className="text-[13.5px] font-bold text-[#231313] px-1">เลือกเรื่องที่ต้องการดู</p>

        {/* กลุ่ม: ดูข้อมูล */}
        <section>
          <h3 className="text-[12px] font-bold text-[#8f1114] mb-2 px-1">ดูข้อมูล</h3>
          <div className="space-y-2.5">
            {/* การ์ด มุมมองร้านค้า */}
            <div className="rounded-2xl border border-red-100 bg-white shadow-sm">
              <button type="button" onClick={() => openPicker(picker === "store" ? null as never : "store")} className="w-full p-3.5 flex items-center gap-3 active:scale-[0.99] transition">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                  <Icon name="storefront" className="text-2xl" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[14.5px] font-bold text-slate-900">ดูผลประโยชน์ มุมมองร้านค้า</p>
                  <p className="text-[11px] text-slate-500">เห็นหน้าแบบเดียวกับร้านค้า · เลือกร้านก่อน</p>
                </div>
                <Icon name={picker === "store" ? "expand_less" : "chevron_right"} className="text-slate-300 text-xl shrink-0" />
              </button>
              {picker === "store" && (
                <div className="border-t border-slate-100 p-3 space-y-2.5 bg-slate-50/50">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ประเภทร้าน</label>
                      <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setDealerCode(""); }} className={selCls}>
                        <option value="">ทั้งหมด</option>
                        {types.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <Icon name="expand_more" className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400" style={{ fontSize: 16 }} />
                    </div>
                    <div className="relative">
                      <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ภาค</label>
                      <select value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); setDealerCode(""); }} className={selCls}>
                        <option value="">ทั้งหมด</option>
                        {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <Icon name="expand_more" className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400" style={{ fontSize: 16 }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ร้าน ({dealerOptions.length}) — พิมพ์ค้นได้</label>
                    <SearchableSelect
                      options={dealerOptions}
                      value={dealerCode || null}
                      onChange={setDealerCode}
                      placeholder="เลือกหรือพิมพ์ค้นหาร้าน"
                      searchPlaceholder="พิมพ์ชื่อร้าน / รหัส"
                      emptyText="ไม่พบร้านที่ค้นหา"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!dealerCode}
                    onClick={confirmStore}
                    className="w-full py-2.5 rounded-xl bg-[#d32029] text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.99] transition"
                  >
                    เข้าดูมุมมองร้านค้า
                  </button>
                </div>
              )}
            </div>

            {/* การ์ด มุมมองพนักงาน */}
            <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
              <button type="button" onClick={() => openPicker(picker === "staff" ? null as never : "staff")} className="w-full p-3.5 flex items-center gap-3 active:scale-[0.99] transition">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <Icon name="badge" className="text-2xl" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[14.5px] font-bold text-slate-900">ดูผลประโยชน์ มุมมองพนักงาน</p>
                  <p className="text-[11px] text-slate-500">เห็นหน้าแบบเดียวกับพนักงาน · เลือกร้าน + คน</p>
                </div>
                <Icon name={picker === "staff" ? "expand_less" : "chevron_right"} className="text-slate-300 text-xl shrink-0" />
              </button>
              {picker === "staff" && (
                <div className="border-t border-slate-100 p-3 space-y-2.5 bg-slate-50/50">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ประเภทร้าน</label>
                      <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setDealerCode(""); }} className={selCls}>
                        <option value="">ทั้งหมด</option>
                        {types.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <Icon name="expand_more" className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400" style={{ fontSize: 16 }} />
                    </div>
                    <div className="relative">
                      <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ภาค</label>
                      <select value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); setDealerCode(""); }} className={selCls}>
                        <option value="">ทั้งหมด</option>
                        {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <Icon name="expand_more" className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400" style={{ fontSize: 16 }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ร้าน ({dealerOptions.length}) — พิมพ์ค้นได้</label>
                    <SearchableSelect
                      options={dealerOptions}
                      value={dealerCode || null}
                      onChange={(v) => { setDealerCode(v); setRepCode(""); }}
                      placeholder="เลือกหรือพิมพ์ค้นหาร้าน"
                      searchPlaceholder="พิมพ์ชื่อร้าน / รหัส"
                      emptyText="ไม่พบร้านที่ค้นหา"
                    />
                  </div>
                  {dealerCode && (
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">พนักงานในร้าน — พิมพ์ค้นได้</label>
                      {repsLoading ? (
                        <p className="text-[12px] text-slate-400 py-2 text-center">กำลังโหลดรายชื่อ...</p>
                      ) : reps.length === 0 ? (
                        <p className="text-[12px] text-slate-400 py-2 text-center">ร้านนี้ไม่มีพนักงานในระบบ</p>
                      ) : (
                        <SearchableSelect
                          options={repOptions}
                          value={repCode || null}
                          onChange={setRepCode}
                          placeholder="เลือกหรือพิมพ์ค้นหาพนักงาน"
                          searchPlaceholder="พิมพ์ชื่อพนักงาน"
                          emptyText="ไม่พบพนักงานที่ค้นหา"
                        />
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!dealerCode || !repCode}
                    onClick={confirmStaff}
                    className="w-full py-2.5 rounded-xl bg-sky-600 text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.99] transition"
                  >
                    เข้าดูมุมมองพนักงาน
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* กลุ่ม: จัดการระบบ */}
        <section>
          <h3 className="text-[12px] font-bold text-[#5b21b6] mb-2 px-1">จัดการระบบ</h3>
          <div className="space-y-2.5">
            <Link href="/app/data-center" className="rounded-2xl border border-violet-100 bg-white shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] hover:border-violet-300 hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#7c3aed] flex items-center justify-center shrink-0">
                <Icon name="cloud_sync" className="text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold text-slate-900">ศูนย์ข้อมูล</p>
                <p className="text-[11px] text-slate-500">สถานะ sync รายวัน · ความครบรายเดือน · อัปโหลดไฟล์</p>
              </div>
              <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
            </Link>

            <Link href="/app/database" className="rounded-2xl border border-violet-100 bg-white shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] hover:border-violet-300 transition">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#7c3aed] flex items-center justify-center shrink-0">
                <Icon name="database" className="text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold text-slate-900">ฐานข้อมูล</p>
                <p className="text-[11px] text-slate-500">ดู/จัดการข้อมูลทุกตารางในระบบ</p>
              </div>
              <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
            </Link>

            <Link href="/app/stores" className="rounded-2xl border border-violet-100 bg-white shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] hover:border-violet-300 transition">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#7c3aed] flex items-center justify-center shrink-0">
                <Icon name="groups" className="text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold text-slate-900">ร้านค้าและทีมงาน</p>
                <p className="text-[11px] text-slate-500">ร้าน · Area/Coach · พนักงาน จัดการครบที่เดียว</p>
              </div>
              <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
            </Link>

            <Link href="/app/employee-requests" className="rounded-2xl border border-violet-100 bg-white shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] hover:border-violet-300 transition">
              <div className="relative w-12 h-12 rounded-2xl bg-violet-50 text-[#7c3aed] flex items-center justify-center shrink-0">
                <Icon name="person_add" className="text-2xl" />
                {pending.employees > 0 && (
                  <span
                    aria-label={`รออนุมัติ ${pending.employees} รายการ`}
                    className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-[#d32029] text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white"
                  >
                    {pending.employees > 99 ? "99+" : pending.employees}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold text-slate-900">คำขอเพิ่มพนักงาน</p>
                <p className="text-[11px] text-slate-500">
                  {pending.employees > 0 ? `รออนุมัติ ${pending.employees} รายการ` : "ตรวจ / แก้ / อนุมัติ ก่อนเข้าฐานข้อมูลพนักงาน"}
                </p>
              </div>
              <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
            </Link>

            <Link href="/app/admin-users" className="rounded-2xl border border-violet-100 bg-white shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] hover:border-violet-300 transition">
              <div className="relative w-12 h-12 rounded-2xl bg-violet-50 text-[#7c3aed] flex items-center justify-center shrink-0">
                <Icon name="how_to_reg" className="text-2xl" />
                {pending.accounts > 0 && (
                  <span
                    aria-label={`รอดำเนินการ ${pending.accounts} รายการ`}
                    className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-[#d32029] text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white"
                  >
                    {pending.accounts > 99 ? "99+" : pending.accounts}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold text-slate-900">อนุมัติผู้ใช้ร้านค้า</p>
                <p className="text-[11px] text-slate-500">
                  {pending.accounts > 0
                    ? `รอดำเนินการ: สมัครใหม่ ${pending.signups} · ขอรีเซ็ตรหัส ${pending.resets}`
                    : "คำขอสมัครของร้านค้า · อนุมัติ / ปฏิเสธ / ระงับ"}
                </p>
              </div>
              <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
            </Link>

            <Link href="/app/redemptions" className="rounded-2xl border border-violet-100 bg-white shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] hover:border-violet-300 transition">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-[#7c3aed] flex items-center justify-center shrink-0">
                <Icon name="redeem" className="text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-bold text-slate-900">อนุมัติแลกของรางวัล</p>
                <p className="text-[11px] text-slate-500">ตรวจและอนุมัติคำขอแลกแต้ม</p>
              </div>
              <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
            </Link>
          </div>
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          เลือกการ์ดเพื่อเข้าดูข้อมูล · หน้าแรกไม่โหลดข้อมูลหนักเพื่อให้เปิดไว
        </p>
      </div>

      <BottomNav active="home" />
    </>
  );
}
