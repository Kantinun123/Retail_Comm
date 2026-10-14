"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icon";
import {
  getDealers,
  employeesWithSalesForDealer,
} from "@/lib/commission/logic";
import { doLogin } from "@/lib/commission/session";
import type { Dealer, Role, TeamMember } from "@/lib/commission/types";
import { cn } from "@/lib/utils";

/* ---------- Searchable dropdown (combobox) ----------
   แสดงค่าที่เลือก กดแล้วเปิดช่องค้นหา + รายการที่กรองได้ */
interface ComboOption {
  value: string;
  label: string;
  sub?: string;
  tag?: string;
}
function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  icon = "search",
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  icon?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.sub ?? "").toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q)
      )
      .slice(0, 80);
  }, [options, query]);

  // ปิดเมื่อคลิกนอกกล่อง
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // โฟกัสช่องค้นหาเมื่อเปิด (เป็นการซิงก์กับ DOM จึงอยู่ใน effect ได้)
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next) setQuery(""); // เคลียร์คำค้นตอนเปิด
      return next;
    });
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full bg-[#faf8f8] text-left text-[14px] rounded-xl pl-3.5 pr-10 py-2.5 border border-slate-200/80 hover:border-red-200 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all relative"
      >
        {selected ? (
          <span className="block truncate text-slate-900">
            {selected.label}
            {selected.sub && (
              <span className="text-slate-400"> · {selected.sub}</span>
            )}
          </span>
        ) : (
          <span className="block truncate text-slate-400">{placeholder}</span>
        )}
        <Icon
          name={open ? "expand_less" : "expand_more"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-30 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative flex items-center">
              <Icon
                name={icon}
                className="absolute left-2.5 text-slate-400 text-base pointer-events-none"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#faf8f8] text-slate-800 text-[13px] rounded-lg pl-8 pr-3 py-2 border border-slate-200 focus:border-[#d32029] focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px] text-slate-400">
                {emptyText}
              </p>
            ) : (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b border-slate-50 last:border-0 flex items-center justify-between gap-2 transition",
                      active ? "bg-red-50" : "hover:bg-red-50/40"
                    )}
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-[13px] font-semibold truncate",
                          active ? "text-[#a11119]" : "text-slate-800"
                        )}
                      >
                        {o.label}
                      </p>
                      {o.sub && (
                        <p className="text-[10px] text-slate-400 truncate">
                          {o.sub}
                        </p>
                      )}
                    </div>
                    {o.tag && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 bg-slate-100 text-slate-600 border-slate-200">
                        {o.tag}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const dealers = useMemo(() => getDealers(), []);

  const [role, setRole] = useState<Role>("dealer");
  const [dealerCode, setDealerCode] = useState<string>(dealers[0]?.code ?? "");
  const [empId, setEmpId] = useState<string>("");
  const [password, setPassword] = useState("1234");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  const selectedDealer = useMemo<Dealer | null>(
    () => dealers.find((d) => d.code === dealerCode) ?? null,
    [dealers, dealerCode]
  );

  // พนักงานของร้านที่เลือก (จากรายการขายจริง)
  const dealerEmployees = useMemo<TeamMember[]>(
    () => employeesWithSalesForDealer(dealerCode),
    [dealerCode]
  );

  // พนักงานที่เลือกจริง = empId ที่ผู้ใช้เลือก ถ้ายังอยู่ในร้านนี้ ไม่งั้น default คนแรก
  // (คำนวณตอน render แทนการใช้ effect เพื่อเลี่ยง cascading render)
  const effectiveEmpId =
    empId && dealerEmployees.some((e) => e.id === empId)
      ? empId
      : dealerEmployees[0]?.id ?? "";

  const dealerOptions: ComboOption[] = useMemo(
    () =>
      dealers.map((d) => ({
        value: d.code,
        label: d.name,
        sub: "รหัส " + d.code,
        tag: d.model,
      })),
    [dealers]
  );

  const employeeOptions: ComboOption[] = useMemo(
    () =>
      dealerEmployees.map((e) => ({
        value: e.id,
        label: e.name,
        sub: e.id,
      })),
    [dealerEmployees]
  );

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // ผู้ดูแลระบบ: ไม่ต้องเลือกร้าน (เห็นทุกร้าน)
    if (role === "admin") {
      if (password !== "1234") {
        setError("รหัสผ่านไม่ถูกต้อง (เดโม: 1234)");
        return;
      }
      doLogin({ role: "admin" });
      router.push("/app/dashboard");
      return;
    }

    if (!selectedDealer) {
      setError("กรุณาเลือกร้านค้า");
      return;
    }

    if (role === "sales") {
      if (!effectiveEmpId) {
        setError("กรุณาเลือกพนักงานขายของร้านนี้");
        return;
      }
      if (password !== "1234") {
        setError("รหัสผ่านไม่ถูกต้อง (เดโม: 1234)");
        return;
      }
      doLogin({
        dealerCode: selectedDealer.code,
        role: "sales",
        empId: effectiveEmpId,
      });
      router.push("/app/dashboard");
      return;
    }

    // โหมดร้านค้าตัวแทน
    if (password !== "1234") {
      setError("รหัสผ่านไม่ถูกต้อง (เดโม: 1234)");
      return;
    }
    doLogin({ dealerCode: selectedDealer.code, role: "dealer" });
    router.push("/app/dashboard");
  }

  return (
    <main className="flex-1 flex flex-col relative w-full max-w-md mx-auto px-4 pb-8 min-h-screen">
      {/* Brand Header */}
      <div className="flex items-center justify-between py-3 mb-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md shadow-[#d32029]/20 ring-2 ring-red-500/20 overflow-hidden">
            <Image
              src="/logo.png"
              alt="SCG HOME"
              width={40}
              height={40}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-[17px] text-[#d32029] tracking-tight">
                Retail-COMM
              </span>
              <span className="text-xs text-slate-400 font-medium">|</span>
              <span className="font-bold text-[15px] text-[#231313] leading-none">
                ร้านค้าผู้แทนจำหน่าย
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#b21e1e] tracking-wider uppercase mt-0.5">
              Commission Portal
            </span>
          </div>
        </div>
        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-50 text-[#a11119] border border-red-200/70 text-[11px] font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#d32029] mr-1.5 animate-pulse" />
          <span>Retail-Security</span>
        </div>
      </div>

      {/* Welcome Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#d32029] via-[#c01f27] to-[#7a0f12] p-4 mb-4 text-white shadow-lg shadow-[#d32029]/20 animate-fade-up">
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start space-x-3 relative z-10">
          <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-md text-white ring-1 ring-white/20">
            <Icon name="payments" className="text-2xl" fill />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold text-white tracking-tight">
              ระบบดูค่าคอมมิชชั่นการขาย Solution
            </h2>
            <p className="text-[12px] text-red-100/90 mt-1 leading-relaxed font-light">
              สำหรับร้านค้าตัวแทนจำหน่ายและพนักงานขายในเครือ SCG Network
            </p>
          </div>
        </div>
        <div className="mt-3.5 pt-2.5 border-t border-red-600/60 flex items-center justify-between text-[11px] font-medium text-red-100/90">
          <span className="flex items-center space-x-1">
            <Icon name="event_available" className="text-sm text-red-300" />
            <span>รอบคำนวณล่าสุด: 10/2026</span>
          </span>
          <span className="bg-red-900/40 text-red-200 px-2.5 py-0.5 rounded-md font-semibold border border-red-400/20">
            ตัดรอบทุกวันที่ 20
          </span>
        </div>
      </div>

      {/* Role Selector */}
      <div className="mb-3">
        <p className="text-[12px] font-semibold text-slate-500 mb-2 px-1">
          เข้าสู่ระบบในฐานะ
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {(
            [
              {
                key: "dealer" as Role,
                icon: "storefront",
                title: "ร้านค้าตัวแทน",
                sub: "Dealer · ทั้งร้าน",
              },
              {
                key: "sales" as Role,
                icon: "badge",
                title: "พนักงานขาย",
                sub: "Sales · เฉพาะตน",
              },
              {
                key: "admin" as Role,
                icon: "admin_panel_settings",
                title: "ผู้ดูแลระบบ",
                sub: "Admin · ทุกร้าน",
              },
            ]
          ).map((r) => {
            const active = role === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setRole(r.key);
                  setError("");
                }}
                className={cn(
                  "flex flex-col items-center text-center gap-1.5 p-2.5 rounded-2xl border transition",
                  active
                    ? "bg-red-50 border-[#d32029] shadow-sm"
                    : "bg-white border-slate-200 hover:border-red-200"
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    active ? "bg-[#d32029] text-white" : "bg-red-50 text-[#d32029]"
                  )}
                >
                  <Icon name={r.icon} className="text-xl" />
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-[12px] font-bold leading-tight truncate">
                    {r.title}
                  </p>
                  <p className="text-[9px] text-slate-500 leading-tight truncate">
                    {r.sub}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Login Form */}
      <form className="flex flex-col space-y-3.5" onSubmit={handleLogin}>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col space-y-3.5">
          {/* ผู้ดูแลระบบ: ไม่ต้องเลือกร้าน */}
          {role === "admin" && (
            <div className="flex items-start space-x-2.5 rounded-xl bg-red-50/60 border border-red-200/60 p-3">
              <Icon
                name="admin_panel_settings"
                className="text-xl text-[#d32029] mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900">
                  เข้าสู่ระบบในฐานะผู้ดูแลระบบ
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  เห็นข้อมูลทุกร้านทุกพนักงาน และเลือกเจาะดูรายร้านได้ภายหลัง
                </p>
              </div>
            </div>
          )}

          {/* ร้านค้า — ค้นหาได้ (เฉพาะ dealer / sales) */}
          {role !== "admin" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold text-slate-800 flex items-center space-x-1.5">
                  <Icon name="storefront" className="text-base text-[#d32029]" />
                  <span>ร้านค้าตัวแทนจำหน่าย</span>
                </span>
                <span className="text-[11px] font-medium text-[#a11119] bg-red-50 border border-red-200/60 px-2 py-0.5 rounded-md">
                  SCG Partner
                </span>
              </div>
              <SearchableSelect
                options={dealerOptions}
                value={dealerCode}
                onChange={(v) => {
                  setDealerCode(v);
                  setError("");
                }}
                placeholder="เลือกร้านค้า"
                searchPlaceholder="ค้นหาร้าน (ชื่อ / รหัส)"
                emptyText="ไม่พบร้านที่ค้นหา"
              />
              {selectedDealer && (
                <p className="text-[11px] font-medium text-[#d32029] mt-1.5 flex items-center space-x-1">
                  <Icon name="verified" style={{ fontSize: 15 }} />
                  <span>
                    ชื่อผู้ใช้: {selectedDealer.name} · Model{" "}
                    {selectedDealer.model}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* พนักงาน — ค้นหาได้ (เฉพาะโหมดพนักงาน) */}
          {role === "sales" && (
            <div>
              <span className="text-[13px] font-semibold text-slate-800 flex items-center space-x-1.5 mb-1.5">
                <Icon name="person" className="text-base text-[#d32029]" />
                <span>ชื่อผู้ใช้ (พนักงานขายของร้านนี้)</span>
              </span>
              <SearchableSelect
                options={employeeOptions}
                value={effectiveEmpId}
                onChange={(v) => {
                  setEmpId(v);
                  setError("");
                }}
                placeholder={
                  employeeOptions.length
                    ? "เลือกพนักงานขาย"
                    : "— ไม่พบพนักงานของร้านนี้ —"
                }
                searchPlaceholder="ค้นหาพนักงาน (ชื่อ / รหัส)"
                emptyText="ไม่พบพนักงานที่ค้นหา"
                icon="person_search"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">
                แสดงเฉพาะพนักงานที่มีรายการขายในร้านที่เลือก (
                {employeeOptions.length} คน)
              </p>
            </div>
          )}

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-semibold text-slate-800 flex items-center space-x-1.5">
                <Icon name="lock" className="text-base text-[#d32029]" />
                <span>รหัสผ่าน / PIN</span>
              </span>
              <span className="text-[12px] font-semibold text-[#d32029]">
                ลืมรหัสผ่าน?
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="w-full bg-[#faf8f8] text-slate-900 text-[14px] rounded-xl pl-3.5 pr-11 py-2.5 border border-slate-200/80 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                aria-label="สลับการมองเห็นรหัสผ่าน"
                className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <Icon
                  name={showPwd ? "visibility" : "visibility_off"}
                  className="text-lg"
                />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {role === "sales" ? (
                <>
                  เดโม: เลือกร้านและพนักงาน แล้วใช้รหัสผ่าน <b>1234</b>
                </>
              ) : (
                <>
                  เดโม: เลือกร้านค้า แล้วใช้รหัสผ่าน <b>1234</b>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-white border border-red-100 rounded-2xl p-3 flex items-start space-x-2.5">
          <div className="p-1 rounded-lg bg-red-50 text-[#d32029] mt-0.5">
            <Icon name="shield" className="text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-slate-900">
              ความปลอดภัยข้อมูลทางการเงิน Retail-Corporate
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
              ระบบแสดงยอดขายและค่าคอมมิชชั่นตามสิทธิ์บัญชีร้านค้า
              ห้ามแชร์รหัสผ่านให้ผู้อื่น
            </p>
          </div>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#d32029] to-[#c01f27] hover:from-[#c01f27] hover:to-[#8f1114] text-white text-[15px] font-bold flex items-center justify-center space-x-2 shadow-lg shadow-[#d32029]/25 active:scale-[0.99] transition-all"
        >
          <Icon name="login" className="text-xl" />
          <span>เข้าสู่ระบบ (Log In)</span>
        </button>

        {error && (
          <p className="text-center text-[12px] text-error font-medium mt-1">
            {error}
          </p>
        )}
      </form>

      <div className="mt-auto pt-6 text-center text-[11px] text-slate-400">
        <p>Retail-Corporate Partner Core v4.2.1 · Kasikornbank &amp; SCG Network</p>
      </div>
    </main>
  );
}
