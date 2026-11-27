"use client";
/* กรอบหน้าแอปตามขนาดจอ (ทุกหน้า)
   - มือถือ (< 768px)     : กว้างแบบมือถือ (max-w-md) + เมนูล่าง — เหมือนเดิม
   - แท็บเล็ต (768–1023px) : เนื้อหากว้างขึ้น (max-w-2xl) + เมนูล่าง
   - โน้ตบุ๊ก (≥ 1024px)  : เมนูซ้าย (DesktopSidebar) แทนเมนูล่าง ; เนื้อหา max-w-3xl
     หน้าที่จัด layout จอกว้างแล้ว (isWidePath) ขยายได้ถึง 1280px */
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DesktopSidebar } from "./desktop-sidebar";
/** หน้าที่จัด layout จอกว้างแล้ว (เพิ่มทีละหน้าเมื่อปรับ layout แล้ว) */
export const WIDE_PREFIXES = ["/app/boq", "/app/refund", "/app/tools"];
export const isWidePath = (p: string | null) => !!p && WIDE_PREFIXES.some((w) => p === w || p.startsWith(w + "/"));
export function AppMain({ children }: { children: React.ReactNode }) {
  const wide = isWidePath(usePathname());
  return (
    <div className="flex-1 flex flex-col w-full lg:pl-60">
      <DesktopSidebar />
      <main
        className={cn(
          "flex-1 flex flex-col relative w-full max-w-md mx-auto px-4 pb-28",
          "md:max-w-2xl md:px-6",
          wide ? "lg:max-w-[1280px] lg:px-8 lg:pb-10" : "lg:max-w-3xl lg:px-8 lg:pb-10"
        )}
      >
        {children}
      </main>
    </div>
  );
}
