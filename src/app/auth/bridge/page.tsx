"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doLogin } from "@/lib/commission/session";
import { isAreaRole, setMustChangePassword } from "@/lib/commission/auth-login";

interface Me {
  role: string;
  name: string | null;
  storeCodes: string[] | null;
  dealerCode: string | null;
  mustChangePassword?: boolean;
}

/** หลัง login ด้วย Microsoft: อ่านตัวตนจริงจาก /api/me แล้วตั้ง session (identity bridge) */
export default function AuthBridgePage() {
  const router = useRouter();
  const [message, setMessage] = useState("กำลังตรวจสอบสิทธิ์...");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 403) {
          router.replace("/auth/pending");
          return;
        }
        const json = (await res.json()) as { ok: boolean; me?: Me };
        if (!json.ok || !json.me) {
          setMessage("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
          setTimeout(() => router.replace("/"), 1500);
          return;
        }
        const { role, name, storeCodes } = json.me;
        if (role === "admin") {
          doLogin({ role: "admin" });
          router.replace("/app/home");
        } else if (isAreaRole(role)) {
          doLogin({ role: "area", areaStores: storeCodes ?? [], areaName: name ?? undefined, areaKind: role });
          setMustChangePassword(!!json.me.mustChangePassword);
          router.replace(json.me.mustChangePassword ? "/app/change-password" : "/app/stores");
        } else if (role === "dealer" && json.me.dealerCode) {
          doLogin({ role: "dealer", dealerCode: json.me.dealerCode });
          setMustChangePassword(!!json.me.mustChangePassword);
          router.replace(json.me.mustChangePassword ? "/app/change-password" : "/app/home");
        } else {
          // sales ยังใช้ล็อกอินเดโมในรอบนี้
          setMessage("บัญชีประเภทนี้ยังไม่เปิดให้ใช้ Microsoft login");
          setTimeout(() => router.replace("/"), 2000);
        }
      } catch {
        if (!cancelled) setMessage("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-svh flex items-center justify-center text-slate-500 text-sm">
      {message}
    </div>
  );
}
