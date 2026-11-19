"use client";
/* การ์ด "งานที่ต้องทำ · ขอ BOQ สินค้า DECAAR" บนหน้าหลักพนักงานขาย (แสดงเมื่อระบบเปิดใช้) */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { fetchBoqList, type BoqListItem } from "@/lib/commission/boq-store";

function Chip({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={cn("rounded-xl px-1.5 py-2 text-center", tone)}>
      <p className="text-[17px] font-bold leading-none">{n}</p>
      <p className="text-[9.5px] mt-1 leading-tight">{label}</p>
    </div>
  );
}

export function BoqStaffCard() {
  const [items, setItems] = useState<BoqListItem[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let cancelled = false;
    fetchBoqList()
      .then((d) => {
        if (cancelled) return;
        setEnabled(d.enabled);
        setItems(d.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!enabled || !items) return null;

  const n = (s: string[]) => items.filter((j) => s.includes(j.status)).length;
  const info = n(["need_info"]);
  const review = n(["submitted"]);
  const quote = n(["boq_ok"]);
  const result = n(["quoted"]);
  const design = n(["waiting", "working", "revise"]);
  const todo = info + review + quote + result;
  const alerts = [
    ...items.filter((j) => j.status === "need_info").slice(0, 2).map((j) => ({ id: j.id, icon: "help", cls: "bg-rose-50 text-rose-800", text: `${j.customerName} — ห้องแบบขอข้อมูลเพิ่ม` })),
    ...items.filter((j) => j.status === "submitted").slice(0, 2).map((j) => ({ id: j.id, icon: "mark_email_unread", cls: "bg-violet-50/70 text-slate-700", text: `${j.customerName} — ห้องแบบส่ง BOQ แล้ว รอคุณตรวจ` })),
    ...items
      .filter((j) => j.status === "boq_ok" && j.boqOkAt && now - new Date(j.boqOkAt).getTime() >= 7 * 86400000)
      .slice(0, 2)
      .map((j) => ({ id: j.id, icon: "schedule", cls: "bg-amber-50 text-amber-800", text: `${j.customerName} — BOQ ผ่านเกิน 7 วัน ยังไม่ใส่ใบเสนอราคา` })),
  ].slice(0, 3);

  return (
    <section>
      <h3 className="text-[13px] font-bold text-[#8f1114] mb-2 flex items-center gap-1.5">
        <Icon name="task_alt" style={{ fontSize: 16 }} />
        งานที่ต้องทำ
      </h3>
      <div className="rounded-2xl bg-white border border-sky-200 shadow-sm overflow-hidden">
        <Link href="/app/boq" className="p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
            <Icon name="design_services" style={{ fontSize: 21 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-900">ขอ BOQ สินค้า DECAAR</p>
            <p className="text-[10px] text-slate-400">{todo ? `มี ${todo} งานรอคุณดำเนินการ` : items.length ? "ไม่มีงานรอคุณ" : "ยังไม่มีคำขอ"}</p>
          </div>
          <Icon name="chevron_right" className="text-slate-300" style={{ fontSize: 18 }} />
        </Link>
        {items.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5 px-3.5">
            <Chip n={review} label="รอฉันตรวจ" tone="bg-violet-50 text-violet-800" />
            <Chip n={quote} label="รอใบเสนอราคา" tone="bg-teal-50 text-teal-800" />
            <Chip n={result} label="รอผล Win/Loss" tone="bg-indigo-50 text-indigo-800" />
            <Chip n={design} label="ห้องแบบกำลังทำ" tone="bg-slate-50 text-slate-600" />
          </div>
        )}
        {alerts.length > 0 && (
          <div className="px-3.5 pt-2.5 space-y-1.5">
            {alerts.map((a) => (
              <Link key={`${a.id}-${a.icon}`} href={`/app/boq/${a.id}`} className={cn("rounded-xl px-3 py-2 text-[11.5px] flex items-center gap-2", a.cls)}>
                <Icon name={a.icon} style={{ fontSize: 16 }} />
                <span className="flex-1 truncate">{a.text}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="p-3.5">
          <Link href="/app/boq/new" className="w-full py-2.5 rounded-xl bg-[#d32029] text-white text-[13px] font-bold flex items-center justify-center gap-1.5">
            <Icon name="add_circle" style={{ fontSize: 18 }} /> ขอ BOQ DECAAR ใหม่
          </Link>
        </div>
      </div>
    </section>
  );
}
