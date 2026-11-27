"use client";
/* เป้าและจังหวะรายวัน: ทุกบทบาทใช้หน้าตาเดียวกัน ต่างกันที่ขอบเขต (พนักงาน / ร้าน / Area / โค้ช)
   ตัวเลขเป้าและยอดเป็นตัวอย่าง ภายหลังต่อกับข้อมูลเป้าและยอดจริงของแอปหลัก (sales_targets) */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { NOW, SE_ROSTER, baht, currentStep, dtTh, dueMoney, dueOf, isFinished, lateWd, leadSla, seOfNick, type Job, type Lead, type Nudge } from "./crm-mock-data";
import type { Role } from "./crm-report";
import { btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";
import type { Ctx } from "./crm-views";

type Mode = "sales" | "intake";
const GROUPS = [{ k: "ROOF SERVICE", short: "Roof", tone: "#6366f1" }, { k: "Qchang", short: "Qchang", tone: "#d97706" }, { k: "SMART SOLUTION", short: "Smart", tone: "#0891b2" }];
const GSHARE = [0.6, 0.2, 0.2];
/* ตัวอย่างเป้า/ยอดเดือนนี้ต่อพนักงาน (sales = บาท, intake = จำนวนแบบรับเข้า) */
const TARGETS: Record<string, { sales: number; salesAct: number; intake: number; intakeAct: number; mix: [number, number, number] }> = {
  "ฝน": { sales: 1_200_000, salesAct: 1_090_000, intake: 16, intakeAct: 12, mix: [0.6, 0.22, 0.18] },
  "นุ้ย": { sales: 900_000, salesAct: 840_000, intake: 12, intakeAct: 11, mix: [0.55, 0.25, 0.2] },
  "บอส": { sales: 1_000_000, salesAct: 540_000, intake: 14, intakeAct: 7, mix: [0.7, 0.1, 0.2] },
  "มิ้น": { sales: 1_100_000, salesAct: 760_000, intake: 15, intakeAct: 11, mix: [0.5, 0.2, 0.3] },
  "โอ": { sales: 800_000, salesAct: 905_000, intake: 10, intakeAct: 10, mix: [0.65, 0.2, 0.15] },
  "แนน": { sales: 1_300_000, salesAct: 1_020_000, intake: 18, intakeAct: 15, mix: [0.45, 0.25, 0.3] },
};

/* ---------- วันทำการของเดือนนี้ (จันทร์-ศุกร์) ---------- */
const Y = NOW.getFullYear();
const M = NOW.getMonth();
function workdays(upTo?: number) {
  const last = upTo ?? new Date(Y, M + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) { const w = new Date(Y, M, d).getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
const WD_ALL = workdays();
const WD_DONE = workdays(NOW.getDate());
const WD_LEFT = WD_ALL - WD_DONE;
const MONTH_TH = NOW.toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

/* ---------- การคำนวณจังหวะ ---------- */
type Status = "hit" | "ahead" | "near" | "behind" | "critical";
const STATUS: Record<Status, { label: string; cls: string; bar: string }> = {
  hit: { label: "ถึงเป้าแล้ว", cls: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  ahead: { label: "ทันเป้า", cls: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" },
  near: { label: "เกือบทัน", cls: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  behind: { label: "ตามหลัง", cls: "bg-orange-100 text-orange-700", bar: "bg-orange-500" },
  critical: { label: "ต้องช่วย", cls: "bg-rose-100 text-rose-700", bar: "bg-rose-500" },
};
interface Pace { t: number; a: number; exp: number; ratio: number; pct: number; need: number; reqDay: number; curDay: number; proj: number; projPct: number; st: Status }
function paceOf(a: number, t: number): Pace {
  const exp = (t * WD_DONE) / WD_ALL;
  const ratio = exp > 0 ? a / exp : 1;
  const need = Math.max(0, t - a);
  const curDay = WD_DONE > 0 ? a / WD_DONE : 0;
  const proj = curDay * WD_ALL;
  const st: Status = a >= t ? "hit" : ratio >= 1 ? "ahead" : ratio >= 0.9 ? "near" : ratio >= 0.7 ? "behind" : "critical";
  return { t, a, exp, ratio, pct: t > 0 ? Math.round((a / t) * 100) : 0, need, reqDay: WD_LEFT > 0 ? need / WD_LEFT : need, curDay, proj, projPct: t > 0 ? Math.round((proj / t) * 100) : 0, st };
}
const num1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const fmt = (m: Mode, v: number) => (m === "sales" ? baht(Math.round(v)) : `${num1(Math.round(v * 10) / 10)} แบบ`);
const fmtDay = (m: Mode, v: number) => (m === "sales" ? `${baht(Math.round(v / 1000) * 1000)}/วัน` : `${(Math.round(v * 10) / 10).toFixed(1)} แบบ/วัน`);
function paceText(m: Mode, p: Pace): string {
  const what = m === "sales" ? "ยอดขาย" : "แบบรับเข้า";
  if (p.st === "hit") return `ถึงเป้า${what}แล้ว เกินเป้า ${fmt(m, p.a - p.t)} ลองตั้งเป้ายืดที่ ${fmt(m, p.t * 1.1)}`;
  if (p.st === "ahead") return `ทันเป้า ถ้าจังหวะนี้ต่อไป สิ้นเดือนจะได้ ${p.projPct}% ของเป้า`;
  return `ยังขาด ${fmt(m, p.need)} ใน ${WD_LEFT} วันทำการ ต้องทำเฉลี่ย ${fmtDay(m, p.reqDay)} (ตอนนี้ ${fmtDay(m, p.curDay)}) ถ้าจังหวะเดิม สิ้นเดือนจะได้ ${p.projPct}%`;
}

/* ---------- ตัวตนที่แสดง (พนักงาน / ร้าน / รวม) ---------- */
interface Ent { key: string; name: string; sub: string; nick?: string; t: number; a: number; g: { t: number; a: number }[] }
function seEnt(nick: string, m: Mode): Ent {
  const se = seOfNick(nick);
  const d = TARGETS[nick] ?? { sales: 0, salesAct: 0, intake: 0, intakeAct: 0, mix: [0.6, 0.2, 0.2] as [number, number, number] };
  return {
    key: nick, name: se?.nick ?? nick, sub: se?.store ?? "", nick, t: m === "sales" ? d.sales : d.intake, a: m === "sales" ? d.salesAct : d.intakeAct,
    g: m === "sales" ? GROUPS.map((_, i) => ({ t: d.sales * GSHARE[i], a: d.salesAct * d.mix[i] })) : [],
  };
}
function sumEnt(key: string, name: string, sub: string, list: Ent[], m: Mode): Ent {
  return {
    key, name, sub, t: list.reduce((s, e) => s + e.t, 0), a: list.reduce((s, e) => s + e.a, 0),
    g: m === "sales" ? GROUPS.map((_, i) => ({ t: list.reduce((s, e) => s + (e.g[i]?.t ?? 0), 0), a: list.reduce((s, e) => s + (e.g[i]?.a ?? 0), 0) })) : [],
  };
}

/* ---------- งานค้างของพนักงาน ---------- */
interface Backlog { leads: Lead[]; jobs: Job[]; money: number }
function backlogOf(nick: string, leads: Lead[], jobs: Job[]): Backlog {
  const ls = leads.filter((l) => l.owner === nick && l.status === "waiting" && leadSla(l).state === "breach");
  const js = jobs.filter((j) => j.owner === nick && !j.cancelReason && !isFinished(j)).filter((j) => { const s = currentStep(j); return !!s && s.owner === "SE" && lateWd(dueOf(j, s)) > 0; });
  return { leads: ls, jobs: js, money: js.reduce((a, j) => a + dueMoney(j), 0) };
}
const backlogText = (b: Backlog) => [b.leads.length ? `Lead เกิน SLA ${b.leads.length} ราย` : "", b.jobs.length ? `งานเลยแผน ${b.jobs.length} งาน` : "", b.money > 0 ? `ยอดรอเก็บ ${baht(b.money)}` : ""].filter(Boolean);

/* ---------- ชิ้นส่วนแสดงผล ---------- */
function Bar({ p, tall }: { p: Pace; tall?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden rounded-full bg-slate-100", tall ? "h-3" : "h-2")}>
      <div className={cn("h-full rounded-full", STATUS[p.st].bar)} style={{ width: `${Math.min(100, p.pct)}%` }} />
      <span className="absolute top-0 h-full w-0.5 bg-slate-700/60" style={{ left: `${Math.min(100, (p.exp / (p.t || 1)) * 100)}%` }} title="จังหวะที่ควรเป็นวันนี้" />
    </div>
  );
}
const Chip = ({ st }: { st: Status }) => <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS[st].cls)}>{STATUS[st].label}</span>;

function ModeSwitch({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-[12px] font-bold">
      {([["sales", "ยอดขาย"], ["intake", "แบบรับเข้า"]] as const).map(([k, l]) => (
        <button key={k} onClick={() => setMode(k)} className={cn("rounded-lg px-3 py-1.5 transition", mode === k ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-indigo-600")}>{l}</button>
      ))}
    </div>
  );
}

function Hero({ e, mode, title }: { e: Ent; mode: Mode; title: string }) {
  const p = paceOf(e.a, e.t);
  const pos = p.st === "hit" || p.st === "ahead";
  return (
    <div className={cn("rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/20", pos ? "bg-gradient-to-br from-emerald-600 to-teal-500" : p.st === "near" ? "bg-gradient-to-br from-amber-500 to-orange-500" : p.st === "behind" ? "bg-gradient-to-br from-orange-600 to-rose-500" : "bg-gradient-to-br from-rose-600 to-fuchsia-600")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-white/85">{title} · {MONTH_TH}</p>
          <p className="text-[32px] font-bold leading-tight tracking-tight">{fmt(mode, p.a)}</p>
          <p className="text-[12.5px] text-white/90">เป้า {fmt(mode, p.t)} · ควรได้ ณ วันนี้ {fmt(mode, p.exp)}</p>
        </div>
        <div className="text-right"><p className="text-[40px] font-bold leading-none">{p.pct}%</p><span className="mt-1 inline-flex rounded-full bg-white/25 px-2.5 py-0.5 text-[11.5px] font-bold">{STATUS[p.st].label}</span></div>
      </div>
      <div className="mt-4 relative h-3 overflow-hidden rounded-full bg-white/25">
        <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, p.pct)}%` }} />
        <span className="absolute top-0 h-3 w-0.5 bg-amber-300" style={{ left: `${Math.min(100, (p.exp / (p.t || 1)) * 100)}%` }} />
      </div>
      <div className="mt-3 grid gap-2 text-[12px] sm:grid-cols-3">
        <div className="rounded-xl bg-white/15 px-3 py-2">เหลือ <b>{WD_LEFT} วันทำการ</b> (ผ่านมา {WD_DONE} จาก {WD_ALL})</div>
        <div className="rounded-xl bg-white/15 px-3 py-2">ต้องทำเฉลี่ย <b>{p.st === "hit" ? "-" : fmtDay(mode, p.reqDay)}</b> · ตอนนี้ <b>{fmtDay(mode, p.curDay)}</b></div>
        <div className="rounded-xl bg-white/15 px-3 py-2">ถ้าจังหวะเดิม สิ้นเดือน <b>{p.projPct}%</b></div>
      </div>
      <p className="mt-3 rounded-xl bg-black/15 px-3 py-2 text-[12.5px] font-semibold">{paceText(mode, p)}</p>
    </div>
  );
}

function GroupBars({ e }: { e: Ent }) {
  return (
    <div className={cn(glass, "p-4")}>
      <h3 className="mb-2 text-[13px] font-bold text-slate-900">แยกตามกลุ่ม Solution</h3>
      <div className="space-y-2.5">
        {e.g.map((g, i) => {
          const p = paceOf(g.a, g.t);
          return (
            <div key={GROUPS[i].k}>
              <div className="mb-1 flex items-center justify-between text-[12px]"><b className="text-slate-800">{GROUPS[i].k}</b><span className="text-slate-500">{baht(Math.round(g.a))} / {baht(Math.round(g.t))} · {p.pct}% <Chip st={p.st} /></span></div>
              <Bar p={p} />
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10.5px] text-slate-400">เส้นดำคือจังหวะที่ควรเป็นวันนี้ · เป้าแต่ละกลุ่มแบ่งตามสัดส่วนตัวอย่าง 60/20/20</p>
    </div>
  );
}

/* ---------- หน้าต่างเตือนงานค้าง (ผู้จัดการ -> พนักงาน) ---------- */
function NudgeModal({ nick, byLabel, b, mode, onClose, onSend }: { nick: string; byLabel: string; b: Backlog; mode: Mode; onClose: () => void; onSend: (text: string) => void }) {
  const parts = backlogText(b);
  const t = paceOf(seEnt(nick, mode).a, seEnt(nick, mode).t);
  const [text, setText] = useState(() => `สวัสดีค่ะ คุณ${nick} (${byLabel}) ขอเตือนงานค้างวันนี้: ${parts.length ? parts.join(" · ") : `ไม่มีงานเลยกำหนด แต่${mode === "sales" ? "ยอดขาย" : "แบบรับเข้า"}ยังตามหลังเป้า (${t.pct}%)`} รบกวนเคลียร์ภายในวันนี้ และแจ้งผลในแชทได้เลยนะคะ`);
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-600"><Icon name="notifications_active" /></span><div><p className="text-[14px] font-bold text-slate-900">เตือนงานค้างถึง {nick}</p><p className="text-[11px] text-slate-400">ส่งได้วันละครั้งต่อคน · ข้อความไปแสดงในหน้าเป้าและจังหวะของพนักงาน</p></div></div>
        <div className="flex flex-wrap gap-1.5">{(parts.length ? parts : ["ไม่มีงานเลยกำหนด"]).map((p) => <span key={p} className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">{p}</span>)}</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className={cn(inputCls, "resize-none")} />
        <div className="flex justify-end gap-2"><button onClick={onClose} className={btnGhost}>ยกเลิก</button><button onClick={() => onSend(text)} disabled={!text.trim()} className={btnPrimary}><Icon name="send" style={{ fontSize: 18 }} />ส่งเตือน</button></div>
      </div>
    </div>,
    document.body,
  );
}

function NudgeBadge({ nudges, nick }: { nudges: Nudge[]; nick: string }) {
  const n = nudges.filter((x) => x.se === nick).slice(-1)[0];
  if (!n) return null;
  return <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", n.readAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{n.readAt ? "เตือนแล้ว · รับทราบแล้ว" : "เตือนแล้ว · รอรับทราบ"}</span>;
}

/* ---------- ของพนักงาน: กล่องเตือนจากผู้จัดการ ---------- */
function NudgeInbox({ c }: { c: Ctx }) {
  const mine = c.nudges.filter((n) => n.se === c.me).slice().reverse();
  if (!mine.length) return null;
  return (
    <div className="space-y-2">
      {mine.map((n) => (
        <div key={n.id} className={cn("rounded-2xl border p-3.5 text-[12.5px]", n.readAt ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50")}>
          <p className="flex items-center gap-1.5 font-bold text-slate-900"><Icon name="notifications_active" className={cn("!text-[18px]", n.readAt ? "text-slate-400" : "text-amber-600")} />{n.by} เตือนงานค้าง <span className="font-normal text-slate-400">{dtTh(n.at)}</span></p>
          <p className="mt-1 leading-relaxed text-slate-700">{n.text}</p>
          {!n.readAt && <button onClick={() => c.readNudge(n.id)} className={cn(btnPrimary, "mt-2 !px-3 !py-1.5 !text-[12px]")}>รับทราบ</button>}
        </div>
      ))}
    </div>
  );
}

/* ---------- การ์ดย่อยบนหน้าหลักของพนักงาน ---------- */
export function PaceMini({ c }: { c: Ctx }) {
  const unread = c.nudges.filter((n) => n.se === c.me && !n.readAt).length;
  return (
    <button onClick={() => c.go("pace")} className={cn(glass, "block w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md")}>
      <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="speed" className="!text-[18px] text-indigo-600" />เป้าและจังหวะเดือนนี้</h3><span className="flex items-center gap-2 text-[11px] font-semibold text-indigo-600">{unread > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">มีเตือนจากผู้จัดการ {unread}</span>}ดูทั้งหมด<Icon name="chevron_right" className="!text-[16px]" /></span></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["sales", "intake"] as const).map((m) => {
          const e = seEnt(c.me, m);
          const p = paceOf(e.a, e.t);
          return (
            <div key={m}>
              <div className="mb-1 flex items-center justify-between text-[12px]"><b className="text-slate-800">{m === "sales" ? "ยอดขาย" : "แบบรับเข้า"} {fmt(m, e.a)} / {fmt(m, e.t)}</b><Chip st={p.st} /></div>
              <Bar p={p} />
              <p className="mt-1 text-[11px] text-slate-500">{p.st === "hit" ? "ถึงเป้าแล้ว" : p.st === "ahead" ? `สิ้นเดือนคาดได้ ${p.projPct}%` : `ต้องทำเฉลี่ย ${fmtDay(m, p.reqDay)} ใน ${WD_LEFT} วันที่เหลือ`}</p>
            </div>
          );
        })}
      </div>
    </button>
  );
}
export const unreadNudges = (nudges: Nudge[], nick: string) => nudges.filter((n) => n.se === nick && !n.readAt).length;

/* ---------- หน้าหลัก ---------- */
const ROLE_NAME: Record<Role, string> = { se: "พนักงานขาย", coach: "โค้ช", area: "Area", dealer: "ร้านค้า" };
export function PaceView({ c, role, stores }: { c: Ctx; role: Role; stores: string[] }) {
  const [mode, setMode] = useState<Mode>("sales");
  const [open, setOpen] = useState<string[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const isSe = role === "se";
  const seList = SE_ROSTER.filter((s) => stores.includes(s.store));
  const seEnts = seList.map((s) => seEnt(s.nick, mode));
  const storeNames = [...new Set(seList.map((s) => s.store))];
  const storeEnts = storeNames.map((s) => sumEnt(s, s, `${seList.filter((x) => x.store === s).length} คน`, seEnts.filter((e) => seOfNick(e.nick ?? "")?.store === s), mode));
  const rank = (a: Ent[]) => [...a].sort((x, y) => paceOf(x.a, x.t).ratio - paceOf(y.a, y.t).ratio);
  const scopeEnt = isSe ? seEnt(c.me, mode) : sumEnt("all", "ภาพรวม", "", seEnts, mode);
  const scopeTitle = isSe ? `ของฉัน (${c.me})` : role === "dealer" ? "ภาพรวมร้านของฉัน" : role === "coach" ? "ภาพรวมร้านที่โค้ชดูแล" : "ภาพรวมทุกร้านในพื้นที่";
  const rows = role === "dealer" ? rank(seEnts) : rank(storeEnts);
  const help = rank(seEnts).filter((e) => { const s = paceOf(e.a, e.t).st; return s === "critical" || s === "behind"; }).slice(0, 3);
  const nudgeOf = (nick: string) => c.nudges.some((n) => n.se === nick);

  const seCells = (e: Ent, indent: boolean) => {
    const p = paceOf(e.a, e.t);
    const b = backlogOf(e.nick ?? "", c.leads, c.jobs);
    const parts = backlogText(b);
    const nudged = nudgeOf(e.nick ?? "");
    return (
      <tr key={e.key} className={cn("border-t border-slate-100", indent && "bg-slate-50/60")}>
        <td className={cn("py-2 pr-2 font-semibold text-slate-800", indent && "pl-6")}>{e.name}<span className="ml-1 text-[10.5px] font-normal text-slate-400">{e.sub}</span></td>
        {rowCells(e, p, mode)}
        <td className="pr-2 text-[11px] text-slate-600">{parts.length ? parts.join(" · ") : <span className="text-slate-300">-</span>}</td>
        <td className="py-1.5 text-right">
          {nudged ? <NudgeBadge nudges={c.nudges} nick={e.nick ?? ""} /> : (
            <button onClick={() => setTarget(e.nick ?? "")} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"><Icon name="notifications_active" className="!text-[14px]" />เตือน</button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">เป้าและจังหวะ</h1>
          <p className="text-[12.5px] text-slate-500">{ROLE_NAME[role]} · {MONTH_TH} · เหลือ {WD_LEFT} วันทำการ · ตัวเลขเป้าและยอดเป็นตัวอย่าง (ภายหลังต่อกับข้อมูลเป้าจริง)</p>
        </div>
        <ModeSwitch mode={mode} setMode={setMode} />
      </div>

      {isSe && <NudgeInbox c={c} />}
      <Hero e={scopeEnt} mode={mode} title={scopeTitle} />

      {isSe ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {mode === "sales" && <GroupBars e={scopeEnt} />}
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 text-[13px] font-bold text-slate-900">สิ่งที่ช่วยให้ทันเป้า</h3>
            {(() => {
              const b = backlogOf(c.me, c.leads, c.jobs);
              const items = [
                ...b.leads.map((l) => ({ id: l.id, label: `${l.name} · Lead เกิน SLA`, sub: `${l.channel} · ${l.province}`, run: () => c.openLead(l.id) })),
                ...b.jobs.map((j) => { const s = currentStep(j)!; return { id: j.id, label: `${j.customer} · ${s.label}`, sub: `เลยแผน ${lateWd(dueOf(j, s))} วันทำการ${dueMoney(j) > 0 ? ` · ต้องเก็บ ${baht(dueMoney(j))}` : ""}`, run: () => c.openJob(j.id) }; }),
              ];
              return items.length ? (
                <ul className="space-y-1.5">{items.slice(0, 6).map((it) => <li key={it.id}><button onClick={it.run} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-indigo-300"><span className="min-w-0 flex-1"><b className="block truncate text-[12px] text-slate-800">{it.label}</b><span className="text-[10.5px] text-slate-500">{it.sub}</span></span><Icon name="chevron_right" className="text-slate-300" /></button></li>)}</ul>
              ) : <p className="rounded-xl bg-emerald-50 p-3 text-[12px] font-semibold text-emerald-700">ไม่มีงานค้างเลยกำหนด เก็บจังหวะนี้ไว้ได้เลยค่ะ</p>;
            })()}
            <p className="mt-2 text-[10.5px] text-slate-400">เคลียร์งานค้างก่อน แล้วเพิ่ม Lead/แบบรับเข้าให้ถึงจังหวะรายวันที่ต้องทำ</p>
          </div>
        </div>
      ) : (
        <>
          {help.length > 0 && (
            <div className={cn(glass, "p-4")}>
              <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="flag" className="!text-[18px] text-rose-500" />ต้องช่วยก่อน</h3>
              <div className="grid gap-2 md:grid-cols-3">
                {help.map((e) => {
                  const p = paceOf(e.a, e.t);
                  return (
                    <div key={e.key} className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-[12px]">
                      <div className="flex items-center justify-between"><b className="text-slate-900">{e.name} <span className="font-normal text-slate-400">{e.sub}</span></b><Chip st={p.st} /></div>
                      <p className="mt-1 text-slate-600">{p.pct}% ของเป้า · ต้องทำเฉลี่ย {fmtDay(mode, p.reqDay)}</p>
                      {nudgeOf(e.nick ?? "") ? <div className="mt-2"><NudgeBadge nudges={c.nudges} nick={e.nick ?? ""} /></div> : <button onClick={() => setTarget(e.nick ?? "")} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white"><Icon name="notifications_active" className="!text-[14px]" />เตือนงานค้าง</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className={cn(glass, "overflow-x-auto p-4")}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-slate-900">{role === "dealer" ? "รายพนักงาน" : "รายร้าน (กดเพื่อดูรายพนักงาน)"}</h3><span className="text-[10.5px] text-slate-400">เรียงจากตามหลังมากสุดก่อน</span></div>
            <table className="w-full min-w-[860px] text-left text-[12px]">
              <thead className="text-[11px] text-slate-400">
                <tr><th className="pb-2 font-semibold">{role === "dealer" ? "พนักงาน" : "ร้าน"}</th><th className="pb-2 font-semibold">ยอดทำได้ / เป้า</th><th className="pb-2 font-semibold">% เป้า</th><th className="pb-2 font-semibold">จังหวะ</th><th className="pb-2 font-semibold">ต้องทำ/วัน</th>{mode === "sales" && <th className="pb-2 font-semibold">กลุ่ม Solution (% ของเป้ากลุ่ม)</th>}<th className="pb-2 font-semibold">งานค้าง</th><th /></tr>
              </thead>
              <tbody>
                {role === "dealer"
                  ? rows.map((e) => seCells(e, false))
                  : rows.flatMap((s) => {
                      const p = paceOf(s.a, s.t);
                      const isOpen = open.includes(s.key);
                      const kids = rank(seEnts.filter((e) => seOfNick(e.nick ?? "")?.store === s.key));
                      const b = kids.map((k) => backlogOf(k.nick ?? "", c.leads, c.jobs));
                      const tot = backlogText({ leads: b.flatMap((x) => x.leads), jobs: b.flatMap((x) => x.jobs), money: b.reduce((a, x) => a + x.money, 0) });
                      return [
                        <tr key={s.key} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40" onClick={() => setOpen((o) => (o.includes(s.key) ? o.filter((x) => x !== s.key) : [...o, s.key]))}>
                          <td className="py-2 pr-2 font-semibold text-slate-800"><Icon name={isOpen ? "expand_more" : "chevron_right"} className="!text-[16px] align-middle text-slate-400" /> {s.name}<span className="ml-1 text-[10.5px] font-normal text-slate-400">{s.sub}</span></td>
                          {rowCells(s, p, mode)}
                          <td className="pr-2 text-[11px] text-slate-600">{tot.length ? tot.join(" · ") : <span className="text-slate-300">-</span>}</td>
                          <td />
                        </tr>,
                        ...(isOpen ? kids.map((k) => seCells(k, true)) : []),
                      ];
                    })}
              </tbody>
            </table>
            <p className="mt-2 text-[10.5px] text-slate-400">จังหวะ = เทียบยอดที่ทำได้กับที่ควรได้ ณ วันนี้ (ทันเป้า ≥100% · เกือบทัน 90-99% · ตามหลัง 70-89% · ต้องช่วย &lt;70%) · งานค้าง = Lead เกิน SLA, งานเลยแผนที่ทีมขายต้องทำ, ยอดรอเก็บ</p>
          </div>
        </>
      )}
      {target && <NudgeModal nick={target} byLabel={ROLE_NAME[role]} b={backlogOf(target, c.leads, c.jobs)} mode={mode} onClose={() => setTarget(null)} onSend={(text) => { c.sendNudge({ se: target, by: ROLE_NAME[role], text }); setTarget(null); c.toast(`ส่งเตือนถึง ${target} แล้ว`); }} />}
    </div>
  );
}

function rowCells(e: Ent, p: Pace, mode: Mode) {
  return (
    <>
      <td className="pr-2"><div className="font-semibold text-slate-800">{fmt(mode, e.a)} <span className="font-normal text-slate-400">/ {fmt(mode, e.t)}</span></div><div className="mt-1 w-32"><Bar p={p} /></div></td>
      <td className="pr-2 font-bold text-slate-800">{p.pct}%</td>
      <td className="pr-2"><Chip st={p.st} /></td>
      <td className="pr-2 text-slate-700">{p.st === "hit" ? <span className="text-emerald-600">ถึงแล้ว</span> : fmtDay(mode, p.reqDay)}</td>
      {mode === "sales" && (
        <td className="pr-2">
          <div className="flex gap-1">
            {e.g.map((g, i) => { const gp = paceOf(g.a, g.t); return <span key={GROUPS[i].k} title={GROUPS[i].k} className={cn("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold", STATUS[gp.st].cls)}>{GROUPS[i].short} {gp.pct}%</span>; })}
          </div>
        </td>
      )}
    </>
  );
}
