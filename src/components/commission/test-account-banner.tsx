"use client";

/* แถบ "บัญชีทดสอบ" บนสุดทุกหน้า — บัญชีที่ผูกกับคนจริงเพื่อเช็คหน้าจอ (profiles.is_test)
   อ่านจาก /api/me ครั้งเดียวต่อการ login แล้วจำใน sessionStorage (ล้างตอน login/logout) */
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { TEST_ACCOUNT_KEY } from "@/lib/commission/session";

export function TestAccountBanner() {
  const [isTest, setIsTest] = useState(false);

  useEffect(() => {
    const cached = sessionStorage.getItem(TEST_ACCOUNT_KEY);
    if (cached !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- อ่านค่าจาก sessionStorage ครั้งเดียว (external store)
      setIsTest(cached === "1");
      return;
    }
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; me?: { isTest?: boolean } } | null) => {
        if (cancelled || !j?.ok) return;
        const v = !!j.me?.isTest;
        sessionStorage.setItem(TEST_ACCOUNT_KEY, v ? "1" : "0");
        setIsTest(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isTest) return null;
  return (
    <div className="mt-2 rounded-xl bg-amber-400 text-amber-950 text-[11.5px] font-bold px-3 py-1.5 flex items-center justify-center gap-1.5" role="status">
      <Icon name="science" style={{ fontSize: 15 }} />
      บัญชีทดสอบ · เห็นหน้าจอเหมือนคนจริงที่ผูกไว้ · แก้ข้อมูลส่วนตัวไม่ได้
    </div>
  );
}
