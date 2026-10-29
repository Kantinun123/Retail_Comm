"use client";

import Link from "next/link";
import { Icon } from "./icon";
import { NotificationBell } from "./notification-bell";
import { useSession } from "@/lib/commission/session";
import { cn } from "@/lib/utils";

type NavKey =
  | "dashboard"
  | "staffIncentive"
  | "backMargin"
  | "analysis"
  | "points"
  | "database"
  | "chat"
  | "member";

const BASE_ITEMS: { key: NavKey; href: string; icon: string; label: string }[] = [
  { key: "dashboard", href: "/app/dashboard", icon: "dashboard", label: "ภาพรวม" },
  // "การวิเคราะห์" ย้ายไปเป็นกล่องเปิด/ซ่อนในหน้าภาพรวมแล้ว (route /app/analysis ยังคงอยู่)
  { key: "points", href: "/app/points", icon: "emoji_events", label: "แต้มกิจกรรม" },
];

/** เมนูสอบถาม (แชท FAQ) — แสดงทุก role */
const CHAT_ITEM = {
  key: "chat" as NavKey,
  href: "/app/chat",
  icon: "chat",
  label: "สอบถาม",
};

/** เมนู "ฉัน" (หน้าสมาชิก/โปรไฟล์) — แสดงทุก role, อยู่ขวาสุด */
const MEMBER_ITEM = {
  key: "member" as NavKey,
  href: "/app/member",
  icon: "person",
  label: "ฉัน",
};

/** ป้ายเมนู "ภาพรวม" เปลี่ยนตาม role */
function dashboardLabel(opts: { isSales: boolean; isAdmin: boolean }): string {
  if (opts.isSales) return "ผลประโยชน์พนักงาน";
  if (opts.isAdmin) return "ภาพรวมทุกร้าน";
  return "ผลประโยชน์ร้านค้า";
}

/** เมนูเฉพาะ admin: ผลประโยชน์ของพนักงานในร้าน (ต่อจากภาพรวม) */
const STAFF_INCENTIVE_ITEM = {
  key: "staffIncentive" as NavKey,
  href: "/app/staff-incentive",
  icon: "groups",
  label: "ผลประโยชน์พนักงานในร้าน",
};

const DATABASE_ITEM = {
  key: "database" as NavKey,
  href: "/app/database",
  icon: "database",
  label: "ฐานข้อมูล",
};

/** เมนู back margin (ผลประโยชน์ร้านค้า rebate) — dealer + admin */
const BACK_MARGIN_ITEM = {
  key: "backMargin" as NavKey,
  href: "/app/back-margin",
  icon: "savings",
  label: "แบ็คมาร์จิน",
};

export function BottomNav({ active }: { active: NavKey }) {
  const { session } = useSession();

  // เมนูเพิ่ม (ผลประโยชน์พนักงานในร้าน + ฐานข้อมูล) โชว์ให้ร้านค้าตัวแทนและผู้ดูแลระบบ
  const isSales = !!session && session.isSales;
  const isAdmin = !!session && session.isAdmin;
  const showExtra = !!session && !session.isSales; // dealer หรือ admin
  const baseItems = BASE_ITEMS.map((item) =>
    item.key === "dashboard"
      ? { ...item, label: dashboardLabel({ isSales, isAdmin }) }
      : item
  );
  // dealer/admin: ภาพรวม -> ผลประโยชน์พนักงานในร้าน -> แต้มกิจกรรม [-> ฐานข้อมูล (เฉพาะ admin)] -> สอบถาม
  const items = showExtra
    ? [
        baseItems[0],
        STAFF_INCENTIVE_ITEM,
        BACK_MARGIN_ITEM, // ผลประโยชน์ร้านค้า rebate (dealer/admin)
        ...baseItems.slice(1),
        ...(isAdmin ? [DATABASE_ITEM] : []), // ฐานข้อมูลเฉพาะผู้ดูแลระบบ
        CHAT_ITEM,
      ]
    : [...baseItems, CHAT_ITEM];

  // คอลัมน์เมนู + กระดิ่งแจ้งเตือน + ปุ่ม "ฉัน"
  const cols = items.length + 2;
  const memberActive = active === "member";

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur border-t border-slate-100 pb-safe z-30">
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-0.5 transition px-0.5",
                isActive ? "text-[#d32029]" : "text-slate-400 hover:text-[#d32029]"
              )}
            >
              <Icon name={item.icon} className="text-2xl" fill={isActive} />
              <span
                className={cn(
                  "text-[10px] text-center leading-tight",
                  isActive ? "font-semibold" : "font-medium"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* กระดิ่งแจ้งเตือน (ย้ายมาด้านล่างเพื่อกดง่ายบนมือถือ) */}
        <NotificationBell variant="nav" />

        {/* ปุ่ม "ฉัน" -> หน้าสมาชิก */}
        <Link
          href={MEMBER_ITEM.href}
          className={cn(
            "flex flex-col items-center justify-center space-y-0.5 transition px-0.5",
            memberActive ? "text-[#d32029]" : "text-slate-400 hover:text-[#d32029]"
          )}
        >
          <Icon name={MEMBER_ITEM.icon} className="text-2xl" fill={memberActive} />
          <span
            className={cn(
              "text-[10px] text-center leading-tight",
              memberActive ? "font-semibold" : "font-medium"
            )}
          >
            {MEMBER_ITEM.label}
          </span>
        </Link>
      </div>
    </nav>
  );
}
