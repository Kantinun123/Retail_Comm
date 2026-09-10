"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "./icon";
import {
  DEALERS,
  SALES_TEAM,
  dealerByCode,
} from "@/lib/commission/logic";
import { doLogin } from "@/lib/commission/session";
import type { Role } from "@/lib/commission/types";
import { cn } from "@/lib/utils";

const MODEL_TAG: Record<string, { cls: string; icon: string }> = {
  "SCG Home": { cls: "bg-red-50 text-[#a11119] border-red-200", icon: "home" },
  "Housing Expert": {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: "engineering",
  },
  GT: { cls: "bg-sky-50 text-sky-700 border-sky-200", icon: "store" },
};

export function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("dealer");
  const [dealerCode, setDealerCode] = useState(DEALERS[0].code);
  const [dealerMenuOpen, setDealerMenuOpen] = useState(false);
  const [empId, setEmpId] = useState(SALES_TEAM[0].id);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("1234");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  const dealer = useMemo(() => dealerByCode(dealerCode), [dealerCode]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!dealerByCode(dealerCode)) {
      setError("ไม่พบรหัสร้านค้านี้ในระบบ");
      return;
    }
    if (role === "sales") {
      if (!empId) {
        setError("กรุณาเลือกพนักงานขาย");
        return;
      }
      if (password !== "1234") {
        setError("รหัสผ่านไม่ถูกต้อง");
        return;
      }
      doLogin({ dealerCode, role: "sales", empId });
      router.push("/app/dashboard");
      return;
    }
    if (username.trim() === "admin" && password === "1234") {
      doLogin({ dealerCode, role: "dealer" });
      router.push("/app/dashboard");
    } else {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
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
            <span>รอบคำนวณล่าสุด: 12/2025</span>
          </span>
          <span className="bg-red-900/40 text-red-200 px-2.5 py-0.5 rounded-md font-semibold border border-red-400/20">
            ตัดรอบทุกวันที่ 25
          </span>
        </div>
      </div>

      {/* Role Selector */}
      <div className="mb-3">
        <p className="text-[12px] font-semibold text-slate-500 mb-2 px-1">
          เข้าสู่ระบบในฐานะ
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              {
                key: "dealer" as Role,
                icon: "storefront",
                title: "ร้านค้าตัวแทน",
                sub: "Dealer · เห็นทั้งร้าน",
              },
              {
                key: "sales" as Role,
                icon: "badge",
                title: "พนักงานขาย",
                sub: "Salesperson · เฉพาะตน",
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
                  "flex items-center space-x-2.5 p-3 rounded-2xl border transition text-left",
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
                <div className="min-w-0">
                  <p className="text-[13px] font-bold leading-tight truncate">
                    {r.title}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight truncate">
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
          {/* Dealer ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-semibold text-slate-800 flex items-center space-x-1.5">
                <Icon name="storefront" className="text-base text-[#d32029]" />
                <span>รหัสร้านค้าตัวแทน (Dealer ID)</span>
              </span>
              <span className="text-[11px] font-medium text-[#a11119] bg-red-50 border border-red-200/60 px-2 py-0.5 rounded-md">
                SCG Partner
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                readOnly
                value={dealerCode}
                onClick={() => setDealerMenuOpen((o) => !o)}
                className="w-full bg-[#faf8f8] text-slate-900 text-[14px] rounded-xl pl-3.5 pr-10 py-2.5 border border-slate-200/80 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setDealerMenuOpen((o) => !o)}
                className="absolute right-2 p-1 text-slate-400"
              >
                <Icon
                  name={dealerMenuOpen ? "expand_less" : "expand_more"}
                  className="text-lg"
                />
              </button>
              {dealerMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-30 overflow-hidden">
                  {DEALERS.map((d) => {
                    const t = MODEL_TAG[d.model] ?? {
                      cls: "bg-slate-100 text-slate-600 border-slate-200",
                      icon: "storefront",
                    };
                    return (
                      <button
                        key={d.code}
                        type="button"
                        onClick={() => {
                          setDealerCode(d.code);
                          setDealerMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-red-50/40 border-b border-slate-50 last:border-0 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 truncate">
                            {d.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {d.code} · {d.branch}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0",
                            t.cls
                          )}
                        >
                          <Icon
                            name={t.icon}
                            style={{ fontSize: 13 }}
                            className="mr-0.5"
                          />
                          {d.model}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {dealer && (
              <p className="text-[11px] font-medium text-[#d32029] mt-1.5 flex items-center space-x-1">
                <Icon name="verified" style={{ fontSize: 15 }} />
                <span>
                  {dealer.name} ({dealer.branch}) · Model {dealer.model}
                </span>
              </p>
            )}
          </div>

          {/* Salesperson picker */}
          {role === "sales" && (
            <div>
              <span className="text-[13px] font-semibold text-slate-800 flex items-center space-x-1.5 mb-1.5">
                <Icon name="person" className="text-base text-[#d32029]" />
                <span>เลือกพนักงานขาย</span>
              </span>
              <div className="relative flex items-center">
                <select
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  className="w-full bg-[#faf8f8] text-slate-900 text-[14px] rounded-xl pl-3.5 pr-10 py-2.5 border border-slate-200/80 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all appearance-none"
                >
                  {SALES_TEAM.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} · {e.role} ({e.id})
                    </option>
                  ))}
                </select>
                <Icon
                  name="expand_more"
                  className="absolute right-3 text-slate-400 text-lg pointer-events-none"
                />
              </div>
            </div>
          )}

          {/* Username (dealer mode) */}
          {role === "dealer" && (
            <div>
              <span className="text-[13px] font-semibold text-slate-800 flex items-center space-x-1.5 mb-1.5">
                <Icon name="badge" className="text-base text-[#d32029]" />
                <span>ชื่อผู้ใช้ / เบอร์โทรลงทะเบียน</span>
              </span>
              <div className="relative flex items-center">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin หรือ 08X-XXX-XXXX"
                  className="w-full bg-[#faf8f8] text-slate-900 text-[14px] rounded-xl pl-3.5 pr-10 py-2.5 border border-slate-200/80 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all"
                />
                <Icon
                  name="contact_phone"
                  className="absolute right-3 text-slate-400 text-lg pointer-events-none"
                />
              </div>
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
                  เดโม: เลือกพนักงาน แล้วใช้รหัสผ่าน <b>1234</b>
                </>
              ) : (
                <>
                  เดโม: ผู้ใช้ <b>admin</b> รหัสผ่าน <b>1234</b>
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
