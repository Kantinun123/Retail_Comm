"use client";
/* เครื่องมือและความรู้ประกอบการขาย — รายการจาก Google Sheet (ทีมเจ้าของข้อมูลแก้ใน Sheet ได้เลย) */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { cn } from "@/lib/utils";
import { useHomeHref, useSession } from "@/lib/commission/session";
import { KIND_META, categoriesOf, fetchSalesTools, type SalesTool } from "@/lib/commission/sales-tools-store";

function ToolCard({ t }: { t: SalesTool }) {
  const meta = KIND_META[t.kind];
  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", t.url ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-400")}>
          <Icon name={meta.icon} style={{ fontSize: 21 }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-slate-900 leading-snug">{t.title}</p>
          <span className="inline-block mt-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5">{t.category}</span>
        </div>
        {t.url && <Icon name="open_in_new" className="text-slate-300 shrink-0" style={{ fontSize: 18 }} />}
      </div>
      {t.description.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11.5px] text-slate-600 list-disc pl-[3.75rem] pr-1">
          {t.description.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
      <div className="mt-2.5 pl-[3.25rem] flex flex-wrap items-center gap-2">
        <span className={cn("text-[11.5px] font-bold", t.url ? "text-teal-700" : "text-slate-400")}>{meta.label}</span>
        {t.note && <span className="text-[10.5px] text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">{t.note.replace(/\{\s*down\s*load\s*ก่อนใช้งาน\s*\}/i, "· ดาวน์โหลดก่อนใช้งาน")}</span>}
      </div>
    </>
  );
  const cls = "block rounded-2xl bg-white border border-slate-100 shadow-sm p-3.5 transition";
  return t.url ? (
    <a href={t.url} target="_blank" rel="noopener noreferrer" className={cn(cls, "hover:border-teal-300 hover:-translate-y-0.5 active:scale-[0.99]")}>{body}</a>
  ) : (
    <div className={cn(cls, "opacity-70")}>{body}</div>
  );
}

export function SalesToolsScreen() {
  const { session } = useSession();
  const homeHref = useHomeHref();
  const [items, setItems] = useState<SalesTool[] | null>(null);
  const [err, setErr] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetchSalesTools().then((x) => !cancelled && setItems(x)).catch((e) => !cancelled && setErr(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => { cancelled = true; };
  }, []);
  const cats = useMemo(() => categoriesOf(items ?? []), [items]);
  const kw = q.trim().toLowerCase();
  const list = (items ?? []).filter((t) => (!cat || t.category === cat) && (!kw || `${t.title} ${t.category} ${t.description.join(" ")}`.toLowerCase().includes(kw)));
  if (!session) return null;
  return (
    <>
      <header className="flex items-center gap-2.5 py-3 lg:py-5 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <Link href={homeHref} aria-label="กลับ" className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition shrink-0 lg:hidden">
          <Icon name="arrow_back" className="text-xl" />
        </Link>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-[15px] lg:text-[22px] text-[#231313] leading-tight truncate">เครื่องมือช่วยขาย</span>
          <span className="text-[11px] font-semibold text-[#b21e1e] truncate">ออกแบบ · ราคา · ข้อมูลสินค้า · ระยะเวลางาน</span>
        </div>
      </header>
      <div className="space-y-3 pb-24">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา เช่น Truss, ราคา, รางน้ำ" className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-[13px] outline-none focus:border-teal-400" />
        </div>
        {cats.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {[{ name: null as string | null, n: items?.length ?? 0 }, ...cats].map((c) => (
              <button key={c.name ?? "__all"} type="button" onClick={() => setCat(c.name)}
                className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition", cat === c.name ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-slate-200 text-slate-600")}>
                {c.name ?? "ทั้งหมด"} <span className="opacity-70">{c.n}</span>
              </button>
            ))}
          </div>
        )}
        {err && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">โหลดไม่สำเร็จ: {err}</p>}
        {!items && !err && <p className="text-center text-slate-400 text-[12px] py-10">กำลังโหลด...</p>}
        {items && list.length === 0 && <p className="text-center text-slate-400 text-[12px] py-10">ไม่พบรายการ</p>}
        <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3 lg:gap-3">
          {list.map((t, i) => <ToolCard key={`${t.no}-${i}`} t={t} />)}
        </div>
        <p className="text-[10.5px] text-slate-400 text-center pt-1">ลิงก์เปิดในหน้าต่างใหม่ · บางรายการต้องเข้าระบบ Google ของบริษัท</p>
      </div>
      <BottomNav active={session.isArea ? "areaHome" : "home"} />
    </>
  );
}

/** การ์ดหน้าหลัก (Admin / Area / Coach / พนักงานขาย) */
export function SalesToolsCard() {
  const [items, setItems] = useState<SalesTool[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchSalesTools().then((x) => !cancelled && setItems(x)).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const cats = categoriesOf(items ?? []).slice(0, 4);
  return (
    <Link href="/app/tools" className="block rounded-2xl bg-white border border-teal-100 shadow-sm p-3.5 hover:border-teal-300 hover:-translate-y-0.5 active:scale-[0.99] transition-all">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <Icon name="construction" className="text-2xl" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-bold text-slate-900">เครื่องมือช่วยขาย</p>
          <p className="text-[11px] text-slate-500">{items ? `${items.length} รายการ · ออกแบบ ราคา ข้อมูลสินค้า` : "ออกแบบ · ราคา · ข้อมูลสินค้า"}</p>
        </div>
        <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
      </div>
      {cats.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[3.75rem]">
          {cats.map((c) => <span key={c.name} className="rounded-full bg-teal-50 text-teal-800 text-[10.5px] font-semibold px-2 py-0.5">{c.name} {c.n}</span>)}
        </div>
      )}
    </Link>
  );
}
