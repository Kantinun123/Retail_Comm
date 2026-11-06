"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** ปุ่มเข้าสู่ระบบด้วยบัญชี Microsoft ของ SCG (Supabase Auth provider: azure)
 *  หลัง login กลับมาที่ /auth/callback -> /auth/bridge เพื่อตั้ง session ตาม role */
export function MicrosoftLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setError("");
    setLoading(true);
    const sb = createClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email",
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent("/auth/bridge")}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="w-full h-12 rounded-2xl bg-white border border-slate-300 text-slate-800 font-bold text-[14px] flex items-center justify-center gap-2.5 shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        {loading ? "กำลังไปยัง Microsoft..." : "เข้าสู่ระบบด้วยบัญชี Microsoft (SCG)"}
      </button>
      <p className="text-center text-[11px] text-slate-400 mt-1.5">
        สำหรับผู้ดูแลระบบ / Area / Coach
      </p>
      {error && (
        <p className="text-center text-[12px] text-[#a11119] mt-1">{error}</p>
      )}
    </div>
  );
}
