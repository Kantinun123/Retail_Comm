"use client";

import Link from "next/link";
import { Icon } from "./icon";
import { NotificationBell } from "./notification-bell";
import { AREA_HOME, useSession } from "@/lib/commission/session";
import { cn } from "@/lib/utils";

type NavKey =
  | "home"
  | "areaHome"
  | "dashboard"
  | "staffIncentive"
  | "backMargin"
  | "commissionProduct"
  | "baIncentive"
  | "baProfitShare"
  | "lhsCommission"
  | "lhsPurchaseDiscount"
  | "storeEval"
  | "custSat"
  | "serviceSales"
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

/** เมนูหน้าหลัก (Hub) — ร้านค้าตัวแทน */
const HOME_ITEM = {
  key: "home" as NavKey,
  href: "/app/home",
  icon: "home",
  label: "หน้าหลัก",
};

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

/** เมนูค่าคอมฯ สินค้า (ฝั่งพนักงาน) — dealer + admin */
const COMMISSION_PRODUCT_ITEM = {
  key: "commissionProduct" as NavKey,
  href: "/app/commission-product",
  icon: "payments",
  label: "Product Commission",
};

/** เมนูค่าคอมฯ งานบริการ (BA Incentive Q-CHANG) — dealer + admin */
const BA_INCENTIVE_ITEM = {
  key: "baIncentive" as NavKey,
  href: "/app/ba-incentive",
  icon: "home_repair_service",
  label: "BA Commission",
};

/** เมนูผลประโยชน์ร้านค้า BA (Profit Share Q-CHANG) — dealer + admin */
const BA_PROFIT_SHARE_ITEM = {
  key: "baProfitShare" as NavKey,
  href: "/app/ba-profit-share",
  icon: "storefront",
  label: "Profit Share BA",
};

/** เมนูค่าคอมฯ LHS (ระบบ Rudy — Housing Expert) — dealer + admin */
const LHS_COMMISSION_ITEM = {
  key: "lhsCommission" as NavKey,
  href: "/app/lhs-commission",
  icon: "roofing",
  label: "LHS Commission",
};

/** เมนู LHS Purchase Discount (ส่วนลดซื้อ 7% Housing Expert) — admin */
const LHS_PURCHASE_DISCOUNT_ITEM = {
  key: "lhsPurchaseDiscount" as NavKey,
  href: "/app/lhs-purchase-discount",
  icon: "sell",
  label: "LHS Ch.Discount",
};

/** เมนูผลตรวจประเมินร้านค้า — dealer เข้าผ่าน hub card; admin เห็นในเมนู */
const STORE_EVAL_ITEM = {
  key: "storeEval" as NavKey,
  href: "/app/store-eval",
  icon: "fact_check",
  label: "ผลตรวจร้าน",
};

/** เมนูความพึงพอใจของลูกค้า — dealer เข้าผ่าน hub card; admin เห็นในเมนู */
const CUST_SAT_ITEM = {
  key: "custSat" as NavKey,
  href: "/app/cust-sat",
  icon: "sentiment_satisfied",
  label: "ความพึงพอใจ",
};

/** เมนูยอดขายงานบริการ — dealer เข้าผ่าน hub card; admin เห็นในเมนู */
const SERVICE_SALES_ITEM = {
  key: "serviceSales" as NavKey,
  href: "/app/service-sales",
  icon: "construction",
  label: "ยอดขายบริการ",
};

export function BottomNav({ active }: { active: NavKey }) {
  const { session } = useSession();

  // เมนูเพิ่ม (ผลประโยชน์พนักงานในร้าน + ฐานข้อมูล) โชว์ให้ร้านค้าตัวแทนและผู้ดูแลระบบ
  const isSales = !!session && session.isSales;
  const isAdmin = !!session && session.isAdmin;
  const isDealer = !!session && !session.isSales && !session.isAdmin;
  const baseItems = BASE_ITEMS.map((item) =>
    item.key === "dashboard"
      ? { ...item, label: dashboardLabel({ isSales, isAdmin }) }
      : item
  );

  // admin ที่กำลัง "ดูในมุมมอง" ให้เมนูล่างเป็นแบบ role ที่กำลังดู (เหมือนร้านค้า/พนักงานจริง)
  const adminViewMode = session?.adminViewMode ?? "admin";
  const inStoreView = isAdmin && adminViewMode === "store";
  const inStaffView = isAdmin && adminViewMode === "staff";

  let items: { key: NavKey; href: string; icon: string; label: string }[];
  if (session?.isArea) {
    // Area/Coach/หัวหน้า Area: รายชื่อร้านที่ดูแล + หน้าหลักของร้านที่เลือก (ถ้าเลือกแล้ว) + สอบถาม
    // หน้าหลัก = การ์ดเลือกเรื่อง ; กำลังดูร้าน/พนักงานอยู่ -> มีเมนูกลับไปหน้าข้อมูลนั้น
    items = [
      { key: "areaHome", href: AREA_HOME, icon: "home", label: "หน้าหลัก" },
      ...(session.areaViewRep
        ? [{ key: "home" as NavKey, href: "/app/home-staff", icon: "badge", label: "ข้อมูลพนักงาน" }]
        : session.areaViewDealer
          ? [{ ...HOME_ITEM, icon: "storefront", label: "ข้อมูลร้าน" }]
          : []),
      CHAT_ITEM,
    ];
  } else if (inStaffView) {
    // admin ดูมุมมองพนักงาน: หน้าหลักพนักงาน + สอบถาม
    items = [
      { key: "home", href: "/app/home-staff", icon: "home", label: "หน้าหลัก" },
      CHAT_ITEM,
    ];
  } else if (isDealer || inStoreView || isAdmin) {
    // ร้านค้าตัวแทน + admin (Hub ทุกร้าน / ดูมุมมองร้านค้า): หน้าหลัก + สอบถาม (+ กระดิ่ง + ฉัน)
    // เมนูจัดการของ admin (ฐานข้อมูล ฯลฯ) เข้าผ่านการ์ดในหน้าหลักแทน
    items = [HOME_ITEM, CHAT_ITEM];
  } else {
    // พนักงานขาย (sales): หน้าหลัก (Hub พนักงาน) + สอบถาม (+ กระดิ่ง + ฉัน)
    items = [
      { key: "home", href: "/app/home-staff", icon: "home", label: "หน้าหลัก" },
      CHAT_ITEM,
    ];
  }

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
