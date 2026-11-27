"use client";
/* เมนูด้านซ้ายบนโน้ตบุ๊ก (lg ขึ้นไป) — ทุกหน้า ทุกบทบาท ; มือถือ/แท็บเล็ตยังใช้เมนูล่าง (BottomNav)
   เมนูหลักเหมือนเมนูล่าง (หน้าหลัก / สอบถาม / แจ้งเตือน / ฉัน) + ทางลัดไปหน้าที่บทบาทนั้นใช้บ่อย
   (ห้องแบบ / Marketing / ทีมคืนเงิน ถูก AppGuard จำกัดหน้าอยู่แล้ว จึงเห็นเฉพาะเมนูของตัวเอง) */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./icon";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import { AREA_HOME, doLogout, useHomeHref, useSession } from "@/lib/commission/session";
import { isRefundTeamRole } from "@/lib/commission/types";

type Item = { href: string; icon: string; label: string; match?: (p: string) => boolean };
type Group = { title?: string; items: Item[] };
const ROLE_LABEL: Record<string, string> = { designer: "ห้องแบบ", marketing: "Marketing", finance: "Finance", accounting: "บัญชี", refund_approver: "ผู้อนุมัติคืนเงิน", sales_central: "พนักงานขายส่วนกลาง", admin: "ผู้ดูแลระบบ", sales: "พนักงานขาย", area: "Area / Coach", dealer: "ร้านค้า" };
const under = (base: string) => (p: string) => p === base || p.startsWith(base + "/");

export function DesktopSidebar() {
  const { session } = useSession();
  const home = useHomeHref();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  if (!session) return null;
  const refundTeam = isRefundTeamRole(session.role);
  const boqTeam = session.role === "designer" || session.role === "marketing";
  const isDealer = !session.isSales && !session.isAdmin && !session.isArea && !refundTeam && !boqTeam;

  const groups: Group[] = [];
  if (refundTeam) {
    groups.push({ items: [{ href: "/app/refund", icon: "currency_exchange", label: "คำขอคืนเงิน", match: under("/app/refund") }] });
  } else if (boqTeam) {
    const g: Item[] = [];
    if (session.role === "marketing") g.push({ href: "/app/boq/overview", icon: "insights", label: "ภาพรวม BOQ", match: (p) => p === "/app/boq/overview" });
    g.push({ href: "/app/boq", icon: "architecture", label: session.role === "designer" ? "งานห้องแบบ" : "รายการงาน BOQ", match: (p) => under("/app/boq")(p) && p !== "/app/boq/overview" });
    groups.push({ items: g });
  } else {
    // หน้าหลัก + หน้าข้อมูลที่กำลังดู (Area เลือกร้าน/พนักงาน)
    const main: Item[] = [];
    if (session.isArea) {
      main.push({ href: AREA_HOME, icon: "home", label: "หน้าหลัก", match: (p) => p === AREA_HOME });
      if (session.areaViewRep) main.push({ href: "/app/home-staff", icon: "badge", label: "ข้อมูลพนักงาน", match: (p) => p === "/app/home-staff" });
      else if (session.areaViewDealer) main.push({ href: "/app/home", icon: "storefront", label: "ข้อมูลร้าน", match: (p) => p === "/app/home" });
    } else {
      main.push({ href: home, icon: "home", label: "หน้าหลัก", match: (p) => p === home });
    }
    groups.push({ items: main });

    // ทางลัดตามบทบาท (เหมือนการ์ดในหน้าหลัก)
    const work: Item[] = [];
    if (session.isArea) {
      work.push({ href: "/app/stores", icon: "groups", label: "ร้านที่ดูแลและทีมงาน", match: (p) => under("/app/stores")(p) || under("/app/store")(p) });
      work.push({ href: "/app/eval-tracking", icon: "fact_check", label: "ติดตามการตรวจร้าน", match: under("/app/eval-tracking") });
      work.push({ href: "/app/line-groups", icon: "forum", label: "ติดตามกลุ่ม Line", match: under("/app/line-groups") });
      work.push({ href: "/app/employee-requests", icon: "person_add", label: "แจ้งเพิ่มพนักงานใหม่", match: under("/app/employee-requests") });
    }
    if (session.isAdmin) {
      work.push({ href: "/app/stores", icon: "groups", label: "ร้านค้าและทีมงาน", match: (p) => under("/app/stores")(p) || under("/app/store")(p) });
      work.push({ href: "/app/eval-tracking", icon: "fact_check", label: "ติดตามการตรวจร้าน", match: under("/app/eval-tracking") });
      work.push({ href: "/app/line-groups", icon: "forum", label: "ติดตามกลุ่ม Line", match: under("/app/line-groups") });
    }
    if (session.isSales || session.isAdmin || session.isArea) {
      work.push({ href: "/app/boq", icon: "architecture", label: session.isSales ? "คำขอ BOQ ของฉัน" : "รายการงาน BOQ", match: (p) => under("/app/boq")(p) && p !== "/app/boq/overview" && p !== "/app/boq/holidays" });
      if (!session.isSales) work.push({ href: "/app/boq/overview", icon: "insights", label: "ภาพรวม BOQ", match: (p) => p === "/app/boq/overview" });
      work.push({ href: "/app/refund", icon: "currency_exchange", label: session.isSales ? "ขอคืนเงินลูกค้า" : "คำขอคืนเงิน", match: under("/app/refund") });
      work.push({ href: "/app/tools", icon: "construction", label: "เครื่องมือช่วยขาย", match: under("/app/tools") });
    }
    if (work.length) groups.push({ title: "งาน", items: work });

    if (session.isAdmin) {
      groups.push({
        title: "จัดการระบบ",
        items: [
          { href: "/app/data-center", icon: "cloud_sync", label: "ศูนย์ข้อมูล", match: under("/app/data-center") },
          { href: "/app/admin-users", icon: "manage_accounts", label: "บัญชีผู้ใช้", match: under("/app/admin-users") },
          { href: "/app/employee-requests", icon: "person_add", label: "คำขอเพิ่มพนักงาน", match: under("/app/employee-requests") },
          { href: "/app/redemptions", icon: "redeem", label: "อนุมัติแลกของรางวัล", match: under("/app/redemptions") },
          { href: "/app/boq/holidays", icon: "event_busy", label: "วันหยุด (SLA)", match: (p) => p === "/app/boq/holidays" },
        ],
      });
    }
    if (isDealer || session.isSales || session.isAdmin || session.isArea) groups.push({ items: [{ href: "/app/chat", icon: "chat", label: "สอบถาม", match: under("/app/chat") }] });
  }
  const who = session.repName || session.areaName || session.me?.name || (session.role === "dealer" ? session.dealer?.name : null);
  const link = (it: Item) => {
    const active = it.match ? it.match(pathname) : pathname === it.href;
    return (
      <Link key={it.href + it.label} href={it.href} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition", active ? "bg-red-50 text-[#d32029]" : "text-slate-600 hover:bg-slate-50")}>
        <Icon name={it.icon} style={{ fontSize: 20 }} fill={active} />
        <span className="truncate">{it.label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-white border-r border-slate-200 z-30">
      <div className="px-5 py-5 border-b border-slate-100">
        <p className="text-[15px] font-bold text-[#d32029]">Retail Comm</p>
        {who && <p className="text-[11.5px] text-slate-600 mt-0.5 truncate">{who}</p>}
        <p className="text-[10.5px] text-slate-400">{ROLE_LABEL[session.role] ?? session.role}</p>
      </div>
      <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
        {groups.map((g, i) => (
          <div key={i} className="space-y-1">
            {g.title && <p className="px-3 pt-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">{g.title}</p>}
            {g.items.map(link)}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-100 space-y-1">
        <NotificationBell variant="sidebar" />
        {link({ href: "/app/member", icon: "person", label: "ฉัน", match: under("/app/member") })}
        <button
          type="button"
          onClick={() => { doLogout(); router.replace("/"); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-500 hover:bg-slate-50"
        >
          <Icon name="logout" style={{ fontSize: 20 }} />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
