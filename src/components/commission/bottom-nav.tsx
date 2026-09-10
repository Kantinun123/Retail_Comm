"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { doLogout } from "@/lib/commission/session";
import { cn } from "@/lib/utils";

type NavKey = "dashboard" | "analysis" | "points";

const ITEMS: { key: NavKey; href: string; icon: string; label: string }[] = [
  { key: "dashboard", href: "/app/dashboard", icon: "dashboard", label: "ภาพรวม" },
  { key: "analysis", href: "/app/analysis", icon: "insights", label: "การวิเคราะห์" },
  { key: "points", href: "/app/points", icon: "emoji_events", label: "แต้มกิจกรรม" },
];

export function BottomNav({ active }: { active: NavKey }) {
  const router = useRouter();

  function handleLogout() {
    doLogout();
    router.replace("/");
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur border-t border-slate-100 pb-safe z-30">
      <div className="grid grid-cols-4 h-16">
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-0.5 transition",
                isActive
                  ? "text-[#d32029]"
                  : "text-slate-400 hover:text-[#d32029]"
              )}
            >
              <Icon name={item.icon} className="text-2xl" fill={isActive} />
              <span
                className={cn(
                  "text-[10px]",
                  isActive ? "font-semibold" : "font-medium"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center space-y-0.5 text-slate-400 hover:text-error transition"
        >
          <Icon name="logout" className="text-2xl" />
          <span className="text-[10px] font-medium">ออกจากระบบ</span>
        </button>
      </div>
    </nav>
  );
}
