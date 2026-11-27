"use client";
/* เครื่องมือและความรู้ประกอบการขาย (client) — ข้อมูลจาก /api/sales-tools (Google Sheet) */
export interface SalesTool {
  no: number | null;
  title: string;
  description: string[];
  url: string | null;
  kind: "web" | "sheet" | "file" | "video" | "none";
  category: string;
  note: string | null;
}
export const KIND_META: Record<SalesTool["kind"], { icon: string; label: string }> = {
  web: { icon: "calculate", label: "เปิดเครื่องมือ" },
  sheet: { icon: "table_view", label: "เปิดไฟล์ Excel" },
  file: { icon: "download", label: "ดาวน์โหลดไฟล์" },
  video: { icon: "play_circle", label: "ดูวิดีโอ" },
  none: { icon: "link_off", label: "ยังไม่มีลิงก์" },
};
let cache: SalesTool[] | null = null;
export async function fetchSalesTools(): Promise<SalesTool[]> {
  if (cache) return cache;
  const res = await fetch("/api/sales-tools", { cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: SalesTool[]; error?: string };
  if (!res.ok || !j.ok) throw new Error(j.error ?? `โหลดไม่สำเร็จ (${res.status})`);
  cache = j.items ?? [];
  return cache;
}
/** หมวด เรียงตามจำนวนรายการมาก -> น้อย */
export function categoriesOf(items: SalesTool[]): { name: string; n: number }[] {
  const m = new Map<string, number>();
  items.forEach((t) => m.set(t.category, (m.get(t.category) ?? 0) + 1));
  return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
