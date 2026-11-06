"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icon";
import { useSession } from "@/lib/commission/session";
import { setMustChangePassword } from "@/lib/commission/auth-login";

const MIN_LEN = 8;

/** เปลี่ยนรหัสผ่านของตัวเอง (บัญชีจริง) — ถ้าเป็นบัญชีที่ admin แจกให้ จะบังคับทำก่อนใช้งาน */
export function ChangePasswordScreen() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // อ่านแบบ lazy ตอน render ฝั่ง client เท่านั้น (ready = true แล้ว)
  const forced = ready && sessionStorage.getItem("mustChangePw") === "1";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pwd.length < MIN_LEN) return setError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_LEN} ตัวอักษร`);
    if (pwd !== confirm) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");

    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pwd }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบด้วยบัญชีจริง กรุณาเข้าสู่ระบบด้วยอีเมลใหม่");
        return;
      }
      if (!j.ok) {
        setError(j.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }
      setMustChangePassword(false);
      router.replace(session?.role === "sales" ? "/app/home-staff" : "/app/home");
    } catch {
      setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full bg-[#faf8f8] text-slate-900 text-[14px] rounded-xl pl-3.5 pr-11 py-2.5 border border-slate-200/80 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all";

  return (
    <div className="max-w-md mx-auto pb-24">
      <div className="flex items-center gap-2 py-4">
        {!forced && (
          <Link href="/app/home" aria-label="กลับ" className="p-2 -ml-2 rounded-xl hover:bg-slate-100">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
        )}
        <h1 className="text-[17px] font-bold text-slate-900">เปลี่ยนรหัสผ่าน</h1>
      </div>

      {forced && (
        <p className="mb-3 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
          บัญชีนี้ใช้รหัสผ่านชั่วคราวที่ผู้ดูแลระบบสร้างให้ กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน
        </p>
      )}

      <form onSubmit={onSubmit} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3.5">
        <div>
          <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">
            รหัสผ่านใหม่ (อย่างน้อย {MIN_LEN} ตัว)
          </span>
          <div className="relative flex items-center">
            <input
              type={show ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label="สลับการมองเห็นรหัสผ่าน"
              className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <Icon name={show ? "visibility" : "visibility_off"} className="text-lg" />
            </button>
          </div>
        </div>
        <div>
          <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">ยืนยันรหัสผ่านใหม่</span>
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={inputCls}
          />
        </div>
        {error && (
          <p className="text-[12px] text-[#a11119] bg-red-50 border border-red-200/60 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !pwd || !confirm}
          className="w-full h-12 rounded-2xl bg-[#d32029] text-white font-bold text-[15px] disabled:opacity-50"
        >
          {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
        </button>
      </form>
    </div>
  );
}
