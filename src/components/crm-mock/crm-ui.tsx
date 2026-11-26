"use client";
import { useEffect } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { PARTY, leadSla, type Lead, type Party } from "./crm-mock-data";

export const glass = "rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_-12px_rgba(79,70,229,.18)]";
export const grad = "bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500";
export const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
export const labelCls = "mb-1 block text-[11px] font-semibold text-slate-500";
export const btnPrimary = `inline-flex items-center justify-center gap-1.5 rounded-xl ${grad} px-4 py-2.5 text-[13px] font-bold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0`;
export const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.99] disabled:opacity-40";

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const ch = name.replace(/^คุณ/, "").trim().charAt(0) || "?";
  const hue = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg,hsl(${hue} 70% 55%),hsl(${(hue + 40) % 360} 70% 45%))` }}>
      {ch}
    </span>
  );
}

export function SlaBadge({ lead }: { lead: Lead }) {
  const s = leadSla(lead);
  const cls = { ok: "bg-emerald-50 text-emerald-700", warn: "bg-amber-50 text-amber-700", breach: "bg-rose-50 text-rose-700", met: "bg-emerald-50 text-emerald-700", na: "bg-slate-100 text-slate-500" }[s.state];
  const icon = { ok: "timer", warn: "hourglass_top", breach: "alarm", met: "check_circle", na: "remove" }[s.state];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold", cls)}>
      <Icon name={icon} style={{ fontSize: 13 }} />
      {s.text}
    </span>
  );
}

export function PartyBadge({ party, className }: { party: Party; className?: string }) {
  const p = PARTY[party];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold", p.cls, className)}>
      <Icon name={p.icon} style={{ fontSize: 13 }} />
      {p.label}
    </span>
  );
}

/** หน้าเต็มพื้นที่ด้านขวาของเมนูซ้าย (เหมือนหน้าเปิด Opp) ; side = แผงข้าง ใช้กับแชตน้องเลขา */
export function Drawer({ open, onClose, title, subtitle, children, footer, wide, side }: { open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; side?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  /* หน้าเต็ม: ล็อกการเลื่อนของหน้าด้านหลัง ไม่ให้เห็นเคลื่อนไหวตอนเลื่อนในหน้านี้ */
  useEffect(() => {
    if (!open || side) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, side]);
  if (!side) {
    const w = wide ? "max-w-5xl" : "max-w-3xl";
    return (
      <div className={cn("fixed bottom-0 left-0 right-0 top-[29px] z-40 flex flex-col bg-[#f5f6fb] transition-opacity duration-200 lg:left-64", open ? "visible opacity-100" : "invisible opacity-0")} aria-hidden={!open}>
        <header className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <div className={cn("mx-auto flex items-center gap-3", w)}>
            <button onClick={onClose} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50">
              <Icon name="arrow_back" style={{ fontSize: 18 }} />กลับ
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-bold text-slate-900">{title}</h2>
              {subtitle && <div className="mt-0.5 truncate text-[12px] text-slate-500">{subtitle}</div>}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-5 md:px-8 lg:pb-10">
          <div className={cn("mx-auto space-y-4", w)}>{children}</div>
        </div>
        {footer && (
          <footer className="border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
            <div className={cn("mx-auto", w)}>{footer}</div>
          </footer>
        )}
      </div>
    );
  }
  return (
    <div className={cn("fixed inset-0 z-50 transition", open ? "visible" : "invisible")} aria-hidden={!open}>
      <div onClick={onClose} className={cn("absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-300", open ? "opacity-100" : "opacity-0")} />
      <aside className={cn("absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl transition-transform duration-300 ease-out", open ? "translate-x-0" : "translate-x-full")}>
        <header className="flex items-start gap-3 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-bold text-slate-900">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[12px] text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="ปิด">
            <Icon name="close" />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-slate-200 bg-white/90 px-5 py-3 backdrop-blur">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <span className="shrink-0 text-[12px] text-slate-500">{k}</span>
      <span className="min-w-0 break-words text-right text-[12.5px] font-medium text-slate-800">{v || "-"}</span>
    </div>
  );
}

export function Stat({ icon, label, value, sub, tone = "indigo", onClick }: { icon: string; label: string; value: React.ReactNode; sub?: string; tone?: "indigo" | "rose" | "emerald" | "amber"; onClick?: () => void }) {
  const t = { indigo: "from-indigo-500 to-violet-500", rose: "from-rose-500 to-orange-400", emerald: "from-emerald-500 to-teal-400", amber: "from-amber-500 to-yellow-400" }[tone];
  const inner = (
    <>
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", t)}>
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <div className="text-[22px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
        <div className="mt-1 truncate text-[11.5px] font-medium text-slate-500">{label}</div>
        {sub && <div className="truncate text-[10.5px] text-slate-400">{sub}</div>}
      </div>
      {onClick && <Icon name="chevron_right" className="ml-auto shrink-0 text-slate-300" />}
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className={cn(glass, "flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0")}>{inner}</button>
    : <div className={cn(glass, "flex items-center gap-3 p-4")}>{inner}</div>;
}

/** แถบบอกว่าหน้านี้ถูกกรองมาจากการ์ดตัวเลขในหน้าหลัก */
export function PresetBanner({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12px] text-indigo-800">
      <Icon name="filter_alt" style={{ fontSize: 17 }} />
      <span>กรองจากหน้าหลัก: <b>{label}</b></span>
      <button onClick={onClear} className="ml-auto rounded-lg bg-white px-2.5 py-1 font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100">ล้างตัวกรอง</button>
    </div>
  );
}