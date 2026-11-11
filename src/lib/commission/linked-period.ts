"use client";

/* =============================================================
   ช่วงเวลาที่ส่งต่อจากหน้าหลัก -> หน้ารายละเอียด ผ่าน URL
   - ?p=YYYY-MM  = โหมดเดือน (เดือนที่เลือกในหน้าหลัก)
   - ?y=YYYY     = โหมดสะสมปี
   ไม่มีพารามิเตอร์ = หน้าใช้ค่าเริ่มต้นของตัวเอง (เดือนที่ครบล่าสุด)
   ทุก page.tsx ห่อ screen ด้วย <Suspense> อยู่แล้ว จึงใช้ useSearchParams ได้ (cacheComponents)
   ============================================================= */
import { useSearchParams } from "next/navigation";
import type { HubView } from "./freshness-store";

export interface LinkedPeriod {
  mode: "month" | "year" | null;
  /** 'YYYY-MM' (โหมดเดือน) */
  period: string | null;
  /** 'YYYY' (ทั้งสองโหมด) */
  year: string | null;
}

/** ต่อ ?p= / ?y= ท้ายลิงก์ตามช่วงที่เลือกในหน้าหลัก */
export function withPeriod(href: string, view: HubView | null | undefined): string {
  if (!view) return href;
  const q = view.mode === "month" ? `p=${view.period}` : `y=${view.year}`;
  return href + (href.includes("?") ? "&" : "?") + q;
}

/** อ่านช่วงเวลาจาก URL (ค่าที่ไม่ถูกรูปแบบ = ไม่สนใจ) */
export function useLinkedPeriod(): LinkedPeriod {
  const sp = useSearchParams();
  const p = sp.get("p");
  const y = sp.get("y");
  if (p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return { mode: "month", period: p, year: p.slice(0, 4) };
  if (y && /^\d{4}$/.test(y)) return { mode: "year", period: null, year: y };
  return { mode: null, period: null, year: null };
}
