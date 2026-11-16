"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DealerOpt {
  code: string;
  name: string;
}

/** ส่งคำขอรีเซ็ตรหัสผ่านถึงผู้ดูแลระบบ (ไม่ต้อง login) — ร้านค้า หรือ Area / Coach / หัวหน้า Area */
export function ForgotPasswordForm() {
  const [kind, setKind] = useState<"dealer" | "staff">("dealer");
  const [login, setLogin] = useState("");
  const [dealers, setDealers] = useState<DealerOpt[]>([]);
  const [dealerCode, setDealerCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/public/dealers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setDealers(j.dealers))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/public/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "staff" ? { kind, login, contactName: name, phone, note } : { dealerCode, contactName: name, phone, note }),
      });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) {
        setError(j.error ?? "ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
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
          <h1 className="text-lg font-bold text-slate-900">ส่งคำขอแล้ว</h1>
          <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
            ผู้ดูแลระบบจะตรวจสอบและติดต่อกลับตามเบอร์ที่แจ้งไว้ พร้อมรหัสผ่านชั่วคราวสำหรับเข้าใช้งาน
          </p>
          <Link
            href="/auth/email"
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
        <h2 className="text-[17px] font-bold tracking-tight">ขอรีเซ็ตรหัสผ่าน</h2>
        <p className="text-[12px] text-red-100/90 mt-1 font-light">
          {kind === "staff" ? "แจ้งอีเมลที่ใช้เข้าระบบและเบอร์ติดต่อ" : "แจ้งร้านและเบอร์ติดต่อ"} ผู้ดูแลระบบจะติดต่อกลับเพื่อยืนยันตัวตน
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col space-y-3.5">
        <div className="grid grid-cols-2 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-100" role="tablist" aria-label="ประเภทบัญชี">
          {([
            ["dealer", "ร้านค้า"],
            ["staff", "Area / Coach"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => { setKind(k); setError(""); }}
              className={"py-2 rounded-xl text-[13px] font-bold transition " + (kind === k ? "bg-[#d32029] text-white" : "text-slate-600 hover:bg-slate-50")}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col space-y-3.5">
          {kind === "dealer" ? (
            <div>
              <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">ร้านค้า</span>
              <select value={dealerCode} onChange={(e) => setDealerCode(e.target.value)} className={inputCls}>
                <option value="">เลือกร้าน</option>
                {dealers.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">อีเมลที่ใช้เข้าระบบ</span>
              <input className={inputCls} value={login} maxLength={120} onChange={(e) => setLogin(e.target.value)} placeholder="เช่น name@scg.com" inputMode="email" autoComplete="username" />
              <p className="text-[11px] text-slate-400 mt-1">สำหรับ Area, Coach และหัวหน้า Area</p>
            </div>
          )}
          <div>
            <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">ชื่อผู้ติดต่อ</span>
            <input className={inputCls} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">เบอร์โทรที่ติดต่อกลับได้</span>
            <input className={inputCls} value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
          </div>
          <div>
            <span className="text-[13px] font-semibold text-slate-800 block mb-1.5">หมายเหตุ (ไม่บังคับ)</span>
            <textarea className={inputCls} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && (
            <p className="text-[12px] text-[#a11119] bg-red-50 border border-red-200/60 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || (kind === "dealer" ? !dealerCode : !login.trim()) || !name.trim() || !phone.trim()}
          className="w-full h-12 rounded-2xl bg-[#d32029] text-white font-bold text-[15px] shadow-md shadow-[#d32029]/20 disabled:opacity-50"
        >
          {loading ? "กำลังส่งคำขอ..." : "ส่งคำขอรีเซ็ตรหัสผ่าน"}
        </button>
        <p className="text-center text-[12px] text-slate-500">
          <Link href="/auth/email" className="font-bold text-[#d32029]">
            กลับหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </form>
    </main>
  );
}
