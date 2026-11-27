"use client";
/* กรอบหน้าแอป: ทุกหน้ากว้างแบบมือถือ (max-w-md) เหมือนเดิม
   ยกเว้นหน้าที่ใช้บนโน้ตบุ๊กบ่อย (isWidePath) -> จอตั้งแต่ lg (1024px) ขยายได้ถึง 1280px + เมนูซ้าย */
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DesktopSidebar } from "./desktop-sidebar";

/** หน้าที่รองรับจอกว้าง (เพิ่มทีละหน้าเมื่อปรับ layout แล้ว) */
export const WIDE_PREFIXES = ["/app/boq", "/app/refund", "/app/tools"];
export const isWidePath = (p: string | null) => !!p && WIDE_PREFIXES.some((w) => p === w || p.startsWith(w + "/"));

export function AppMain({ children }: { children: React.ReactNode }) {
  const wide = isWidePath(usePathname());
  if (!wide) {
    return <main className="flex-1 flex flex-col relative w-full max-w-md mx-auto px-4 pb-28">{children}</main>;
  }
  return (
    <div className="flex-1 flex flex-col w-full lg:pl-60">
      <DesktopSidebar />
      <main className={cn("flex-1 flex flex-col relative w-full max-w-md mx-auto px-4 pb-28", "lg:max-w-[1280px] lg:px-8 lg:pb-10")}>{children}</main>
    </div>
  );
}
