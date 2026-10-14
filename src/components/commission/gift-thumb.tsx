"use client";

/* =============================================================
   รูปของรางวัล (thumbnail) — แสดง imageUrl ถ้ามี, ไม่มีใช้ไอคอน
   ใช้ร่วมกันทั้งหน้ากดแลก / ประวัติสมาชิก / ประวัติแอดมิน
   ============================================================= */
import Image from "next/image";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

export function GiftThumb({
  imageUrl,
  icon,
  name,
  size = 44,
  className,
}: {
  imageUrl?: string;
  icon: string;
  name: string;
  /** ขนาดกล่อง (px) */
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-amber-50 text-amber-600",
        className
      )}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          width={size}
          height={size}
          unoptimized
          className="w-full h-full object-cover"
        />
      ) : (
        <Icon name={icon} className="text-xl" />
      )}
    </div>
  );
}
