"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icon";
import { loginWithEmail } from "@/lib/commission/auth-login";

/** ฟอร์ม login จริง (email/password + Supabase Auth) — identity bridge ไป session เดิม */
export function RealLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginWithEmail(email.trim(), password);
      if (res.ok) {
        router.push("/app/dashboard");
        return;
      }
      if (res.status === "pending") {
        router.push("/auth/pending");
        return;
      }
      setError(res.error ?? "เข้าสู่ระบบไม่สำเร็จ");
    } catch {
      setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col relative w-full max-w-md mx-auto px-4 pb-8 min-h-screen">
      {/* Brand Header */}
      <div className="flex items-center space-x-2.5 py-4 mb-2">
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
          <span className="font-bold text-[17px] text-[#d32029] tracking-tight">
            Retail-COMM
          </span>
          <span className="text-[11px] font-semibold text-[#b21e1e] tracking-wider uppercase">
            Commission Portal
          </span>
        </div>
      </div>

      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-br from-[#d32029] via-[#c01f27] to-[#7a0f12] p-4 mb-4 text-white shadow-lg shadow-[#d32029]/20">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/20">
            <Icon name="payments" className="text-2xl" fill />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold tracking-tight">
              เข้าสู่ระบบ
            </h2>
            <p className="text-[12px] text-red-100/90 mt-1 leading-relaxed font-light">
              ใช้อีเมลและรหัสผ่านที่ได้รับอนุมัติ
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form className="flex flex-col space-y-3.5" onSubmit={handleSubmit}>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col space-y-3.5">
          <div>
            <span className="text-[13px] font-semibold text-slate-800 flex items-center space-x-1.5 mb-1.5">
              <Icon name="mail" className="text-base text-[#d32029]" />
              <span>อีเมล</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full bg-[#faf8f8] text-slate-900 text-[14px] rounded-xl px-3.5 py-2.5 border border-slate-200/80 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all"
            />
          </div>

          <div>
            <span className="text-[13px] font-semibold text-slate-800 flex items-center space-x-1.5 mb-1.5">
              <Icon name="lock" className="text-base text-[#d32029]" />
              <span>รหัสผ่าน</span>
            </span>
            <div className="relative flex items-center">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                autoComplete="current-password"
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
          </div>

          {error && (
            <p className="text-[12px] text-[#a11119] bg-red-50 border border-red-200/60 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full h-12 rounded-2xl bg-[#d32029] text-white font-bold text-[15px] shadow-md shadow-[#d32029]/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
