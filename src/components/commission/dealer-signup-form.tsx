"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { createClient } from "@/lib/supabase/client";

interface DealerOpt {
  code: string;
  name: string;
  province: string | null;
}

/** ร้านค้าสมัครใช้งานเอง: ยืนยันอีเมล -> รอ admin อนุมัติ */
export function DealerSignupForm() {
  const [dealers, setDealers] = useState<DealerOpt[]>([]);
  const [dealerCode, setDealerCode] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/public/dealers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setDealers(j.dealers))
      .catch(() => {});
  }, []);

  const selected = dealers.find((d) => d.code === dealerCode) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? dealers.filter((d) => d.name.toLowerCase().includes(q) || d.code.includes(q))
      : dealers;
    return list.slice(0, 50);
  }, [dealers, query]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!dealerCode) return setError("กรุณาเลือกร้านค้า");
    if (!fullName.trim()) return setError("กรุณากรอกชื่อ-นามสกุล");
    if (password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");

    setLoading(true);
    try {
      const sb = createClient();
      const { data, error: err } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            requested_dealer_code: dealerCode,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent("/auth/bridge")}`,
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      // กรณีเปิดให้ login ได้ทันทีโดยไม่ยืนยันอีเมล: ออกจาก session ไว้ก่อน (ยังไม่ได้รับอนุมัติ)
      if (data.session) await sb.auth.signOut();
      setDone(true);
    } catch {
      setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full bg-[#faf8f8] text-slate-900 text-[14px] rounded-xl px-3.5 py-2.5 border border-slate-200/80 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all";

  if (done) {
    return (
      <main className="w-full max-w-md mx-auto px-4 min-h-screen flex items-center">
        <div className="w-full text-center bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Icon name="mark_email_unread" className="text-3xl" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">ตรวจสอบอีเมลของคุณ</h1>
          <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
            เราส่งลิงก์ยืนยันไปที่ <b>{email}</b> กรุณากดลิงก์เพื่อยืนยันอีเมล
            จากนั้นรอผู้ดูแลระบบอนุมัติร้านของคุณ
          </p>
          <Link
            href="/"
            className="inline-block mt-5 px-4 py-2.5 rounded-xl bg-[#d32029] text-white text-[14px] font-semibold"
          >
            กลับหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col w-full max-w-md mx-auto px-4 pb-8 min-h-screen">
      <div className="flex items-center space-x-2.5 py-4 mb-2">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md ring-2 ring-red-500/20 overflow-hidden">
          <Image src="/logo.png" alt="SCG HOME" width={40} height={40} className="w-full h-full object-contain" />
        </div>
        <span className="font-bold text-[17px] text-[#d32029] tracking-tight">Retail-COMM</span>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-[#d32029] via-[#c01f27] to-[#7a0f12] p-4 mb-4 text-white shadow-lg shadow-[#d32029]/20">
        <h2 className="text-[17px] font-bold tracking-tight">สมัครใช้งานร้านค้า</h2>
        <p className="text-[12px] text-red-100/90 mt-1 font-light">
          กรอกข้อมูล ยืนยันอีเมล แล้วรอผู้ดูแลระบบอนุมัติ (1 บัญชีต่อ 1 ร้าน)
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col space-y-3.5">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col space-y-3.5">
          <div className="relative">
            <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">ร้านค้าตัวแทนจำหน่าย</span>
            <input
              type="text"
              value={open ? query : selected ? `${selected.name} · ${selected.code}` : query}
              onFocus={() => {
                setOpen(true);
                setQuery("");
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder="ค้นหาร้าน (ชื่อ / รหัส)"
              className={inputCls}
              autoComplete="off"
            />
            {open && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-30 max-h-64 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[12px] text-slate-400">ไม่พบร้านที่ค้นหา</p>
                ) : (
                  filtered.map((d) => (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => {
                        setDealerCode(d.code);
                        setOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 border-b border-slate-50 last:border-0 hover:bg-red-50/50"
                    >
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{d.name}</p>
                      <p className="text-[10px] text-slate-400">
                        รหัส {d.code}
                        {d.province ? ` · ${d.province}` : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">ชื่อ-นามสกุลผู้สมัคร</span>
            <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">เบอร์โทร</span>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
          </div>
          <div>
            <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">อีเมล</span>
            <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">รหัสผ่าน (อย่างน้อย 8 ตัว)</span>
            <div className="relative flex items-center">
              <input
                type={showPwd ? "text" : "password"}
                className={inputCls + " pr-11"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                aria-label="สลับการมองเห็นรหัสผ่าน"
                className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <Icon name={showPwd ? "visibility" : "visibility_off"} className="text-lg" />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[12px] text-[#a11119] bg-red-50 border border-red-200/60 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password || !dealerCode || !fullName}
          className="w-full h-12 rounded-2xl bg-[#d32029] text-white font-bold text-[15px] shadow-md shadow-[#d32029]/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {loading ? "กำลังส่งคำขอ..." : "ส่งคำขอสมัคร"}
        </button>
        <p className="text-center text-[12px] text-slate-500">
          มีบัญชีแล้ว?{" "}
          <Link href="/auth/email" className="font-bold text-[#d32029]">
            เข้าสู่ระบบ
          </Link>
        </p>
      </form>
    </main>
  );
}
