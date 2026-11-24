"use client";
/* สรุปจำนวนหัวข้อตามสถานะ: ผ่านแล้ว / ยังไม่ทำ / สอบใหม่ (+ กำลังทำ เมื่อมี) — ใช้ทั้งหน้าแรก (เล็ก) และหน้ารายการข้อสอบ (ใหญ่) */
import { cn } from "@/lib/utils";
import type { TopicStatus } from "@/lib/commission/exam-store";

const META: { key: TopicStatus; label: string; box: string; pill: string }[] = [
  { key: "passed", label: "ผ่านแล้ว", box: "bg-emerald-50 text-emerald-800", pill: "bg-emerald-50 text-emerald-700" },
  { key: "todo", label: "ยังไม่ทำ", box: "bg-slate-100 text-slate-700", pill: "bg-slate-100 text-slate-600" },
  { key: "failed", label: "สอบใหม่", box: "bg-rose-100 text-rose-700", pill: "bg-rose-100 text-rose-700" },
  { key: "in_progress", label: "กำลังทำ", box: "bg-amber-50 text-amber-800", pill: "bg-amber-50 text-amber-700" },
];

export function countTopics(topics: { status: TopicStatus }[]): Record<TopicStatus, number> {
  const c: Record<TopicStatus, number> = { passed: 0, todo: 0, failed: 0, in_progress: 0 };
  for (const t of topics) c[t.status]++;
  return c;
}

/** size "md" = กล่องตัวเลขใหญ่ (หน้ารายการ) ; "sm" = ชิปเล็กในบรรทัดเดียว (การ์ดหน้าแรก) ; "กำลังทำ" แสดงเมื่อมีเท่านั้น */
export function ExamCounts({ topics, size = "md" }: { topics: { status: TopicStatus }[]; size?: "md" | "sm" }) {
  const c = countTopics(topics);
  const items = META.filter((m) => m.key !== "in_progress" || c.in_progress > 0);
  if (size === "sm") {
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {items.map((m) => (
          <span key={m.key} className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap", m.pill, c[m.key] === 0 && "opacity-50")}>
            {m.label} {c[m.key]}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("mt-3 grid gap-2", items.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
      {items.map((m) => (
        <div key={m.key} className={cn("rounded-xl px-1.5 py-2 text-center", m.box, c[m.key] === 0 && "opacity-60")}>
          <p className="text-[20px] font-bold leading-none">{c[m.key]}</p>
          <p className="text-[10.5px] mt-1 leading-tight font-semibold">{m.label}</p>
        </div>
      ))}
    </div>
  );
}
