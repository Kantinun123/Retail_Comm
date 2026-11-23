"use client";
/* เมนูด้านซ้ายบนจอกว้าง (lg ขึ้นไป) สำหรับหน้าที่รองรับจอกว้าง — มือถือยังใช้เมนูล่าง (BottomNav) เหมือนเดิม
   แสดงเฉพาะเมนูที่บทบาทนั้นเข้าได้ (ห้องแบบ / Marketing ถูก AppGuard จำกัดไว้ที่หน้า BOQ) */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";
import { doLogout, useHomeHref, useSession } from "@/lib/commission/session";

type Item = { href: string; icon: string; label: string; match?: (p: string) => boolean };
const ROLE_LABEL: Record<string, string> = { designer: "ห้องแบบ", marketing: "Marketing", admin: "ผู้ดูแลระบบ", sales: "พนักงานขาย", area: "Area / Coach", dealer: "ร้านค้า" };

export function DesktopSidebar() {
  const { session } = useSession();
  const home = useHomeHref();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  if (!session) return null;
  const team = session.role === "designer" || session.role === "marketing";

  const items: Item[] = [];
  if (session.role !== "designer") items.push({ href: home, icon: "home", label: "หน้าหลัก", match: (p) => p === home && home !== "/app/boq/overview" });
  if (session.role !== "sales" && session.role !== "designer") {
    items.push({ href: "/app/boq/overview", icon: "insights", label: "ภาพรวม BOQ", match: (p) => p === "/app/boq/overview" });
  }
  items.push({
    href: "/app/boq",
    icon: "architecture",
    label: session.role === "sales" ? "คำขอ BOQ ของฉัน" : session.role === "designer" ? "งานห้องแบบ" : "รายการงาน BOQ",
    match: (p) => (p === "/app/boq" || p.startsWith("/app/boq/")) && p !== "/app/boq/overview" && p !== "/app/boq/new",
  });
  if (session.isSales) items.push({ href: "/app/boq/new", icon: "add_circle", label: "ขอ BOQ ใหม่", match: (p) => p === "/app/boq/new" });
  if (session.isAdmin) items.push({ href: "/app/boq/holidays", icon: "event_busy", label: "วันหยุด (SLA)", match: (p) => p === "/app/boq/holidays" });
  if (!team) items.push({ href: "/app/chat", icon: "chat", label: "สอบถาม" });
  items.push({ href: "/app/member", icon: "person", label: "ฉัน" });

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-white border-r border-slate-200 z-30">
      <div className="px-5 py-5 border-b border-slate-100">
        <p className="text-[15px] font-bold text-[#d32029]">Retail Comm</p>
        {(() => {
          const who = session.repName || session.areaName || session.me?.name || (session.role === "dealer" ? session.dealer?.name : null);
          return who ? <p className="text-[11.5px] text-slate-600 mt-0.5 truncate">{who}</p> : null;
        })()}
        <p className="text-[10.5px] text-slate-400">{ROLE_LABEL[session.role] ?? session.role}</p>
      </div>
      <nav className="p-3 space-y-1 overflow-y-auto">
        {items.map((it) => {
          const active = it.match ? it.match(pathname) : pathname === it.href;
          return (
            <Link key={it.href + it.label} href={it.href} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition", active ? "bg-red-50 text-[#d32029]" : "text-slate-600 hover:bg-slate-50")}>
              <Icon name={it.icon} style={{ fontSize: 20 }} fill={active} />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => { doLogout(); router.replace("/"); }}
        className="mt-auto m-3 flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-500 hover:bg-slate-50"
      >
        <Icon name="logout" style={{ fontSize: 20 }} />
        ออกจากระบบ
      </button>
    </aside>
  );
}
