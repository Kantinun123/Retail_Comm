"use client";
/* แชทลูกค้าแบบ LINE OA (จำลอง): ห้องต่อลูกค้า ติดป้ายตามงาน (Lead/Opp) · โน้ตภายใน · เชิญทีม · น้องเลขาสรุปแชท
   ข้อความลูกค้าจำลองด้วยปุ่ม ไม่ได้เชื่อม LINE จริง */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  LEAD_STATUS, NOW, PARTY, TEAM_DIRECTORY, baht, chatRooms, cleanInterests, currentStep, dateTh, dtTh, dueLabel, dueOf, hoursSince, interestSummary,
  stepsOf, suggestTeam, unreadOf, waitingHours,
  type ChatMember, type ChatMsg, type ChatState, type ContactLog, type Interest, type Job, type Lead,
} from "./crm-mock-data";
import { ChatGuideCard, chatGuide, scriptsFor, useGuideOn } from "./crm-guide";
import { InterestChips } from "./crm-interests";
import { Avatar, btnGhost, btnPrimary, glass } from "./crm-ui";

const LINE = "bg-[#06c755] text-white";
export interface ChatSel { phone: string | null; job: string }
interface Props {
  st: ChatState; setSt: React.Dispatch<React.SetStateAction<ChatState>>; sel: ChatSel; setSel: (s: ChatSel) => void;
  leads: Lead[]; jobs: Job[]; me: string;
  onPatchLead: (id: string, p: Partial<Lead>) => void; onPatchJob: (id: string, fn: (j: Job) => Job) => void;
  openLead: (id: string) => void; openJob: (id: string) => void; openAccount: (phone: string) => void; toast: (m: string) => void;
}

/* ---------------- สรุปแชท (จำลองการดึงข้อมูลจากข้อความ) ---------------- */
interface SumRow { id: string; group: "interest" | "date" | "budget" | "concern" | "promise"; text: string; interest?: Interest; dateIso?: string }
const KW: [RegExp, Interest][] = [
  [/โรงจอดรถ/, { kind: "service", group: "บริการหลังการขาย", item: "สำรวจต่อเติมโรงจอดรถ" }],
  [/ทรัส|โครงหลังคา/, { kind: "service", group: "งานโครงสร้างหลังคา", item: "โครงทรัส" }],
  [/โซลาร์|solar/i, { kind: "service", group: "พลังงานแสงอาทิตย์", item: "Solar Roof" }],
  [/ฝ้า/, { kind: "service", group: "ฝ้า ผนัง และฉนวน", item: "ติดตั้งฝ้าเพดาน" }],
  [/รางน้ำ/, { kind: "product", group: "รางน้ำฝน", item: "รางน้ำฝน PVC" }],
  [/กระเบื้อง/, { kind: "product", group: "กระเบื้องหลังคา", item: "Excella" }],
];
const MONTHS: Record<string, string> = { "ม.ค.": "01", "ก.พ.": "02", "มี.ค.": "03", "เม.ย.": "04", "พ.ค.": "05", "มิ.ย.": "06", "ก.ค.": "07", "ส.ค.": "08", "ก.ย.": "09", "ต.ค.": "10", "พ.ย.": "11", "ธ.ค.": "12" };
function summarize(msgs: ChatMsg[]): SumRow[] {
  const rows: SumRow[] = [];
  const seen = new Set<string>();
  const add = (r: Omit<SumRow, "id">) => {
    const k = r.group + r.text;
    if (seen.has(k)) return;
    seen.add(k);
    rows.push({ ...r, id: "r" + rows.length });
  };
  for (const m of msgs) {
    const t = m.text ?? "";
    if (!t) continue;
    if (m.kind === "cust") {
      for (const [re, it] of KW) if (re.test(t)) add({ group: "interest", text: it.item, interest: it });
      const d = t.match(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/);
      if (d) {
        const pm = /บ่าย/.test(t);
        add({ group: "date", text: `สะดวกวันที่ ${d[1]} ${d[2]}${pm ? " ช่วงบ่าย" : /เช้า/.test(t) ? " ช่วงเช้า" : ""}`, dateIso: `2026-${MONTHS[d[2]]}-${d[1].padStart(2, "0")}T${pm ? "14" : "10"}:00:00+07:00` });
      }
      const b = t.match(/งบ(?:ประมาณ)?\s*([\d\-,]+\s*(?:แสน|หมื่น|ล้าน|บาท)?)/);
      if (b) add({ group: "budget", text: `งบประมาณ ${b[1].trim()}` });
      const c = t.match(/(?:กลัว|กังวล|เป็นห่วง|ห่วง)\S+/);
      if (c) add({ group: "concern", text: c[0] });
    } else if (m.kind === "se" && !m.internal) {
      const p = t.match(/(?:เดี๋ยว|จะ)(?:แจ้ง|ส่ง|โทร|ติดต่อ|นัด)[^\n]*/);
      if (p) add({ group: "promise", text: p[0] });
    }
  }
  return rows;
}
const GROUP_META: Record<SumRow["group"], { head: string; icon: string }> = {
  interest: { head: "ความต้องการที่พูดถึง", icon: "sell" }, date: { head: "วันนัด", icon: "event" }, budget: { head: "งบประมาณ", icon: "payments" },
  concern: { head: "ข้อกังวลของลูกค้า", icon: "psychology_alt" }, promise: { head: "สิ่งที่ทีมขายรับปากไว้", icon: "handshake" },
};

/* ---------------- ส่วนประกอบ ---------------- */
function JobChip({ id, on, onClick }: { id: string; on?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", on ? "bg-indigo-600 text-white" : id.startsWith("L-") ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700")}>{id}</button>;
}
function Bubble({ m, name, onUsePhoto }: { m: ChatMsg; name: string; onUsePhoto: (m: ChatMsg) => void }) {
  const mine = m.kind === "se";
  const team = m.kind === "team";
  return (
    <div className={cn("flex gap-2", mine || team ? "justify-end" : "justify-start")}>
      {!mine && !team && <Avatar name={name.replace("คุณ", "")} size={30} />}
      <div className={cn("max-w-[75%]", (mine || team) && "text-right")}>
        {(mine || team) && m.who && <div className="mb-0.5 text-[10.5px] text-slate-400">{m.who}{team && " · ทีมงาน"}</div>}
        <div className={cn("rounded-2xl px-3.5 py-2 text-left text-[12.5px] leading-relaxed", mine ? cn(LINE, "rounded-tr-sm") : team ? "rounded-tr-sm bg-cyan-600 text-white" : "rounded-tl-sm bg-white text-slate-800 shadow-sm")}>
          {m.img && <div className="mb-2 grid h-16 w-40 place-items-center rounded-xl bg-slate-200 text-slate-400"><Icon name="image" style={{ fontSize: 28 }} /></div>}
          {m.card && (
            <div className="mb-1 w-56 rounded-xl bg-white p-3 text-slate-800 shadow">
              <div className="mb-1 text-[12px] font-bold text-[#06a047]">{m.card.title}</div>
              {m.card.lines.map((l) => <div key={l} className="text-[11.5px] text-slate-600">{l}</div>)}
              {m.card.action && <div className="mt-2 rounded-lg bg-[#06c755] py-1.5 text-center text-[11.5px] font-bold text-white">{m.card.action}</div>}
            </div>
          )}
          {m.text}
        </div>
        {m.img && m.kind === "cust" && <button type="button" onClick={() => onUsePhoto(m)} className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-indigo-700 shadow-sm hover:bg-indigo-50"><Icon name="add_photo_alternate" style={{ fontSize: 14 }} />ใช้เป็นรูปหน้างานใน Opp</button>}
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400" style={{ justifyContent: mine || team ? "flex-end" : "flex-start" }}>{dtTh(m.at)}{m.job && <JobChip id={m.job} />}</div>
      </div>
    </div>
  );
}
function Sys({ m }: { m: ChatMsg }) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex max-w-[88%] flex-wrap items-center justify-center gap-1.5 rounded-full bg-slate-200/70 px-3 py-1 text-[11px] text-slate-600">
        <Icon name="bolt" style={{ fontSize: 14 }} />{m.text}<span className="text-slate-400">· {dtTh(m.at)}</span>{m.job && <JobChip id={m.job} />}
      </div>
    </div>
  );
}

function SummaryDialog({ rows, scope, onClose, onApply }: { rows: SumRow[]; scope: string; onClose: () => void; onApply: (picked: SumRow[]) => void }) {
  const [on, setOn] = useState<Set<string>>(() => new Set(rows.map((r) => r.id)));
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const groups = (Object.keys(GROUP_META) as SumRow["group"][]).filter((g) => rows.some((r) => r.group === g));
  return (
    <div className="fixed inset-0 z-[70] grid place-items-start justify-items-center overflow-y-auto bg-slate-900/40 px-4 py-10 backdrop-blur-[2px]">
      <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white"><Icon name="auto_awesome" /></span>น้องเลขาสรุปแชท<span className="ml-1 text-[11px] font-normal text-slate-400">{scope}</span></div>
        {rows.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-[12.5px] text-slate-500">ยังไม่พบข้อมูลที่สรุปได้จากข้อความของลูกค้า ลองให้ลูกค้าส่งรายละเอียดมาก่อน</p> : (
          <>
            <p className="mt-2 text-[12px] text-slate-500">ติ๊กรายการที่ถูกต้อง แล้วกดเติมเข้างาน ระบบไม่เติมเองจนกว่าทีมขายยืนยัน (ตัวอย่างนี้จับจากคำสำคัญ ของจริงใช้ AI)</p>
            <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g}>
                  <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700"><Icon name={GROUP_META[g].icon} style={{ fontSize: 16 }} />{GROUP_META[g].head}</div>
                  {rows.filter((r) => r.group === g).map((r) => (
                    <button type="button" key={r.id} onClick={() => toggle(r.id)} className="mb-1 flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-left text-[12.5px] text-slate-800 hover:bg-slate-100">
                      <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", on.has(r.id) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white")}>{on.has(r.id) && <Icon name="check" style={{ fontSize: 12 }} />}</span>
                      <span className="flex-1">{r.text}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-[11px] text-slate-400">เลือก {on.size} จาก {rows.length} รายการ</span>
          <button onClick={onClose} className={btnGhost}>{rows.length ? "ยกเลิก" : "ปิด"}</button>
          {rows.length > 0 && <button disabled={on.size === 0} onClick={() => onApply(rows.filter((r) => on.has(r.id)))} className={cn(btnPrimary, on.size === 0 && "opacity-50")}><Icon name="task_alt" style={{ fontSize: 18 }} />เติมเข้างานที่เลือก</button>}
        </div>
      </div>
    </div>
  );
}

function InviteDialog({ members, suggest, onClose, onInvite }: { members: ChatMember[]; suggest: string | null; onClose: () => void; onInvite: (nicks: string[], mode: "internal" | "customer") => void }) {
  const [pick, setPick] = useState<Set<string>>(() => new Set(suggest && !members.some((m) => m.nick === suggest) ? [suggest] : []));
  const [mode, setMode] = useState<"internal" | "customer">("internal");
  const toggle = (n: string) => setPick((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  return (
    <div className="fixed inset-0 z-[70] grid place-items-start justify-items-center overflow-y-auto bg-slate-900/40 px-4 py-10 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-indigo-700"><Icon name="person_add" /></span>เชิญทีมเข้าห้อง</div>
        <div className="mt-3 space-y-1.5">
          {TEAM_DIRECTORY.map((p) => {
            const inRoom = members.some((m) => m.nick === p.nick);
            const on = pick.has(p.nick);
            return (
              <button type="button" disabled={inRoom} key={p.nick} onClick={() => toggle(p.nick)} className={cn("flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left", on ? "border-indigo-300 bg-indigo-50/70" : "border-slate-200", inRoom && "opacity-50")}>
                <Avatar name={p.nick} size={30} />
                <div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-slate-800">{p.nick}</div><span className={cn("inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold", PARTY[p.party].cls)}>{p.role}</span>{p.nick === suggest && !inRoom && <span className="ml-1.5 text-[10.5px] font-semibold text-indigo-600">แนะนำ: ตรงกับขั้นตอนตอนนี้</span>}{inRoom && <span className="ml-1.5 text-[10.5px] text-slate-400">อยู่ในห้องแล้ว</span>}</div>
                <span className={cn("grid h-5 w-5 place-items-center rounded border", on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300")}>{on && <Icon name="check" style={{ fontSize: 14 }} />}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[11.5px] font-bold text-slate-700">เข้าห้องแบบไหน</div>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode("internal")} className={cn("rounded-xl border-2 p-3 text-left", mode === "internal" ? "border-amber-400 bg-amber-50" : "border-slate-200")}><div className="flex items-center gap-1 text-[12px] font-bold text-amber-900"><Icon name="visibility_off" style={{ fontSize: 16 }} />โน้ตภายใน</div><div className="mt-0.5 text-[11px] text-slate-600">ลูกค้าไม่เห็น (ค่าเริ่มต้น)</div></button>
          <button type="button" onClick={() => setMode("customer")} className={cn("rounded-xl border-2 p-3 text-left", mode === "customer" ? "border-emerald-400 bg-emerald-50" : "border-slate-200")}><div className="flex items-center gap-1 text-[12px] font-bold text-emerald-900"><Icon name="forum" style={{ fontSize: 16 }} />ห้องลูกค้า</div><div className="mt-0.5 text-[11px] text-slate-600">ลูกค้าเห็นชื่อและข้อความ</div></button>
        </div>
        {mode === "customer" && <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-[11.5px] text-rose-800"><Icon name="warning" style={{ fontSize: 16 }} />ทีมขายอนุญาตให้ลูกค้าเห็นชื่อและข้อความของคนที่เลือก กดเชิญเท่ากับยืนยัน</p>}
        <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className={btnGhost}>ยกเลิก</button><button disabled={pick.size === 0} onClick={() => onInvite([...pick], mode)} className={cn(btnPrimary, pick.size === 0 && "opacity-50")}>เชิญ {pick.size || ""} คน</button></div>
      </div>
    </div>
  );
}

/* ---------------- หน้าแชท ---------------- */
const CANNED = ["ขอบคุณค่ะ รอใบเสนอราคานะคะ", "สะดวกให้โทรช่วงเย็นค่ะ", "ขอเปลี่ยนสีกระเบื้องเป็นสีน้ำตาลได้ไหมคะ", "ส่งรูปเพิ่มให้ได้ไหมคะ"];
export function InboxView(p: Props) {
  const { st, setSt, sel, leads, jobs, me, toast } = p;
  const rooms = useMemo(() => chatRooms(st), [st]);
  const phone = sel.phone ?? rooms[0] ?? null;
  const [tab, setTab] = useState<"customer" | "internal">("customer");
  const [text, setText] = useState("");
  const [dlg, setDlg] = useState<null | "summary" | "invite">(null);
  const [filter, setFilter] = useState<"all" | "unread" | "wait">("all");
  const box = useRef<HTMLDivElement>(null);
  const guideOn = useGuideOn();

  const nameOf = (ph: string) => jobs.find((j) => j.phone === ph)?.customer ?? leads.find((l) => l.phone === ph)?.name ?? ph;
  const roomMsgs = useMemo(() => st.msgs.filter((m) => m.phone === phone), [st.msgs, phone]);
  const tags = useMemo(() => {
    const s = new Set<string>();
    leads.filter((l) => l.phone === phone).forEach((l) => s.add(l.id));
    jobs.filter((j) => j.phone === phone).forEach((j) => s.add(j.opsId));
    roomMsgs.forEach((m) => m.job && s.add(m.job));
    return [...s];
  }, [leads, jobs, roomMsgs, phone]);
  const lastTag = [...roomMsgs].reverse().find((m) => m.job)?.job ?? tags[0] ?? "";
  const ctxTag = sel.job && tags.includes(sel.job) ? sel.job : lastTag;
  const job = ctxTag.startsWith("OP-") ? jobs.find((j) => j.opsId === ctxTag) : undefined;
  const lead = ctxTag.startsWith("L-") ? leads.find((l) => l.id === ctxTag) : undefined;
  const visible = useMemo(
    () => roomMsgs.filter((m) => (tab === "internal" ? !!m.internal : !m.internal) && (!sel.job || !m.job || m.job === sel.job)).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    [roomMsgs, tab, sel.job],
  );
  const internalCount = roomMsgs.filter((m) => m.internal && m.kind !== "sys").length;
  const members = (phone && st.members[phone]) || [];

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [visible.length, phone, tab, sel.job]);

  const pick = (ph: string) => { p.setSel({ phone: ph, job: "" }); setSt((s) => ({ ...s, lastRead: { ...s.lastRead, [ph]: NOW.toISOString() } })); };
  const push = (m: Omit<ChatMsg, "id" | "at">) => setSt((s) => ({ ...s, msgs: [...s.msgs, { ...m, id: "m" + (s.msgs.length + 1), at: NOW.toISOString() }], lastRead: { ...s.lastRead, [m.phone]: NOW.toISOString() } }));
  const send = (t: string) => {
    if (!phone || !t.trim()) return;
    push({ phone, kind: "se", who: me, text: t.trim(), job: ctxTag || undefined, internal: tab === "internal" });
    setText("");
  };
  const simulate = () => {
    if (!phone) return;
    if (tab === "internal") {
      const m = members[members.length - 1];
      if (!m) { toast("ยังไม่มีทีมในห้อง กดเชิญทีมก่อน"); return; }
      push({ phone, kind: "team", who: m.nick, text: "รับทราบครับ เดี๋ยวตรวจสอบแล้วแจ้งกลับ", job: ctxTag || undefined, internal: true });
      return;
    }
    const n = roomMsgs.filter((m) => m.kind === "cust").length;
    push({ phone, kind: "cust", text: CANNED[n % CANNED.length], job: ctxTag || undefined });
  };
  const sendCard = () => {
    if (!phone) return;
    if (tab === "internal") { toast("การ์ดสถานะส่งได้เฉพาะแท็บ คุยกับลูกค้า"); return; }
    if (job) {
      const steps = stepsOf(job);
      const cur = currentStep(job);
      push({ phone, kind: "se", who: me, job: ctxTag, card: { title: `สถานะงาน ${job.opsId}`, lines: [cur ? `ขั้นตอนตอนนี้: ${cur.label}` : "งานเสร็จสมบูรณ์", cur ? `กำหนด ${dateTh(dueOf(job, cur))}` : "ส่งมอบและรับประกันแล้ว", `เสร็จแล้ว ${steps.filter((s) => job.done[s.key]).length}/${steps.length} ขั้น`] } });
    } else if (lead) {
      push({ phone, kind: "se", who: me, job: ctxTag, card: { title: `สถานะคำขอ ${lead.id}`, lines: [`สถานะ: ${LEAD_STATUS[lead.status].label}`, `สนใจ: ${interestSummary(lead.interests) || lead.product}`, lead.nextFollowAt ? `นัดติดตาม ${dtTh(lead.nextFollowAt)}` : "ทีมงานจะติดต่อกลับ"] } });
    } else toast("เลือกงานก่อนส่งการ์ดสถานะ");
  };
  const usePhoto = (m: ChatMsg) => {
    const j = jobs.find((x) => x.opsId === m.job);
    if (!j) { toast("ใช้เป็นรูปหน้างานได้เฉพาะงานที่เป็น Opp"); return; }
    p.onPatchJob(j.id, (x) => ({ ...x, lastTouchAt: NOW.toISOString(), log: [...x.log, { at: NOW.toISOString(), text: "แนบรูปหน้างานจากแชทลูกค้า" }] }));
    toast(`แนบรูปเข้า ${j.opsId} แล้ว`);
  };
  const invite = (nicks: string[], mode: "internal" | "customer") => {
    if (!phone) return;
    const add: ChatMember[] = nicks.map((n) => { const t = TEAM_DIRECTORY.find((x) => x.nick === n)!; return { nick: n, role: t.role, party: t.party, mode }; });
    setSt((s) => ({
      ...s,
      members: { ...s.members, [phone]: [...(s.members[phone] ?? []), ...add] },
      msgs: [...s.msgs, ...add.map((a, i) => ({ id: "m" + (s.msgs.length + 1 + i), phone, kind: "sys" as const, at: NOW.toISOString(), job: ctxTag || undefined, internal: mode === "internal", text: `${a.nick} (${a.role}) เข้าร่วม${mode === "internal" ? "โน้ตภายใน" : "ห้องลูกค้า"}` }))],
    }));
    setDlg(null);
    if (mode === "internal") setTab("internal");
    toast(`เชิญ ${nicks.join(", ")} แล้ว`);
  };
  const apply = (picked: SumRow[]) => {
    if (!phone) return;
    const ints = picked.filter((r) => r.interest).map((r) => r.interest!);
    const others = picked.filter((r) => !r.interest);
    const at = NOW.toISOString();
    const note = "สรุปจากแชท: " + others.map((r) => r.text).join(" · ");
    const target = lead ?? leads.find((l) => l.phone === phone && l.status !== "lost" && l.status !== "converted") ?? leads.find((l) => l.phone === phone);
    if (target) {
      const have = new Set(cleanInterests(target.interests).map((i) => i.group + "|" + i.item));
      const merged = [...cleanInterests(target.interests), ...ints.filter((i) => !have.has(i.group + "|" + i.item))];
      const date = picked.find((r) => r.dateIso)?.dateIso;
      const log: ContactLog[] = others.length ? [...(target.contacts ?? []), { id: `${target.id}-C${(target.contacts?.length ?? 0) + 1}`, at, by: me, channel: "LINE", outcome: "คุยได้", note, nextAt: date }] : (target.contacts ?? []);
      p.onPatchLead(target.id, { interests: merged, product: interestSummary(merged) || target.product, contacts: log, nextFollowAt: date ?? target.nextFollowAt, firstContactAt: target.firstContactAt ?? at });
    } else if (job) {
      p.onPatchJob(job.id, (x) => ({ ...x, scope: [x.scope, ...ints.map((i) => i.item)].filter(Boolean).join(", ") || x.scope, lastTouchAt: at, log: others.length ? [...x.log, { at, text: note }] : x.log }));
    }
    push({ phone, kind: "sys", job: ctxTag || undefined, internal: true, text: `เติมข้อมูลจากสรุปแชทเข้า ${target ? target.id : job?.opsId ?? ""} แล้ว ${picked.length} รายการ` });
    setDlg(null);
    toast(`เติมข้อมูลเข้า ${target ? target.id : job?.opsId ?? "งาน"} แล้ว ${picked.length} รายการ`);
  };

  const list = rooms.filter((ph) => filter === "all" || (filter === "unread" ? unreadOf(st, ph) > 0 : waitingHours(st, ph) > 0));
  const scripts = scriptsFor({ name: nameOf(phone ?? ""), items: interestSummary(lead?.interests) || (job?.scope ?? ""), province: (job ?? lead)?.province ?? "" });
  const cur = job ? currentStep(job) : null;
  const suggest = suggestTeam(job);
  const cg = guideOn && tab === "customer" ? chatGuide({ name: nameOf(phone ?? ""), lead, job }) : null;

  if (!phone) return <div className={cn(glass, "p-10 text-center text-[13px] text-slate-400")}>ยังไม่มีห้องแชท เปิดจากหน้า Lead หรือ Opp ด้วยปุ่ม &ldquo;เปิดแชท&rdquo;</div>;
  return (
    <>
      <div className="mb-3 lg:hidden">
        <select value={phone} onChange={(e) => pick(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px]">
          {rooms.map((ph) => <option key={ph} value={ph}>{nameOf(ph)}{unreadOf(st, ph) ? ` (${unreadOf(st, ph)})` : ""}</option>)}
        </select>
      </div>
      <div className={cn(glass, "grid h-[calc(100vh-170px)] min-h-[600px] overflow-hidden lg:grid-cols-[270px_1fr_290px]")}>
        {/* รายการห้อง */}
        <div className="hidden min-h-0 flex-col border-r border-slate-100 bg-white/70 lg:flex">
          <div className="border-b border-slate-100 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-slate-900"><span className={cn("grid h-6 w-6 place-items-center rounded-md", LINE)}><Icon name="chat" style={{ fontSize: 15 }} /></span>แชทลูกค้า (LINE OA)</div>
            <div className="flex gap-1.5">
              {([["all", `ทั้งหมด ${rooms.length}`], ["unread", `ยังไม่อ่าน ${rooms.filter((r) => unreadOf(st, r) > 0).length}`], ["wait", `รอตอบ ${rooms.filter((r) => waitingHours(st, r) > 0).length}`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-semibold", filter === k ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}>{l}</button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.map((ph) => {
              const ms = st.msgs.filter((m) => m.phone === ph && !m.internal && m.kind !== "sys");
              const last = ms[ms.length - 1];
              const u = unreadOf(st, ph);
              const w = waitingHours(st, ph);
              const jt = [...new Set(st.msgs.filter((m) => m.phone === ph && m.job).map((m) => m.job!))].slice(-2);
              return (
                <button key={ph} onClick={() => pick(ph)} className={cn("flex w-full gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left", ph === phone ? "bg-indigo-50/80" : "hover:bg-slate-50")}>
                  <Avatar name={nameOf(ph).replace("คุณ", "")} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1"><span className="truncate text-[12.5px] font-bold text-slate-900">{nameOf(ph)}</span>{last && <span className="ml-auto shrink-0 text-[10px] text-slate-400">{Math.round(hoursSince(last.at)) < 24 ? `${Math.max(1, Math.round(hoursSince(last.at)))} ชม.` : dateTh(last.at)}</span>}</div>
                    <div className="truncate text-[11.5px] text-slate-500">{last ? (last.kind === "se" ? "คุณ: " : "") + (last.text ?? "ส่งรูป") : "ยังไม่มีข้อความ"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {jt.map((j) => <span key={j} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", j.startsWith("L-") ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700")}>{j}</span>)}
                      {w >= 2 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">รอตอบ {w} ชม.</span>}
                      {u > 0 && <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{u}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
            {list.length === 0 && <div className="p-6 text-center text-[12px] text-slate-400">ไม่มีห้องในตัวกรองนี้</div>}
          </div>
        </div>

        {/* ข้อความ */}
        <div className={cn("flex min-h-0 flex-col", tab === "internal" ? "bg-amber-50/60" : "bg-[#e9edf5]")}>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2.5">
            <Avatar name={nameOf(phone).replace("คุณ", "")} size={34} />
            <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-bold text-slate-900">{nameOf(phone)}</div><div className="text-[11px] text-slate-500"><span className="font-semibold text-[#06c755]">LINE</span> · {phone}</div></div>
            <button onClick={simulate} className="rounded-xl border border-dashed border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50">{tab === "internal" ? "จำลองทีมตอบ" : "จำลองลูกค้าตอบ"}</button>
            <button onClick={() => setDlg("summary")} className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 px-3 py-1.5 text-[11.5px] font-bold text-white"><Icon name="auto_awesome" style={{ fontSize: 15 }} />น้องเลขาสรุปแชท</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-white/70 px-4 py-2">
            <span className="text-[11px] text-slate-400">ดูของงาน</span>
            <button onClick={() => p.setSel({ phone, job: "" })} className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", !sel.job ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}>ทั้งหมด</button>
            {tags.map((t) => <JobChip key={t} id={t} on={sel.job === t} onClick={() => p.setSel({ phone, job: t })} />)}
            <div className="ml-auto flex rounded-xl bg-slate-100 p-0.5 text-[11.5px] font-semibold">
              <button onClick={() => setTab("customer")} className={cn("rounded-lg px-3 py-1", tab === "customer" ? "bg-white text-emerald-700 shadow" : "text-slate-500")}>คุยกับลูกค้า</button>
              <button onClick={() => setTab("internal")} className={cn("rounded-lg px-3 py-1", tab === "internal" ? "bg-amber-400 text-amber-950 shadow" : "text-slate-500")}>โน้ตภายใน{internalCount > 0 && ` ${internalCount}`}</button>
            </div>
          </div>
          {tab === "internal" && <div className="flex items-center gap-1.5 bg-amber-100 px-4 py-1.5 text-[11.5px] font-semibold text-amber-900"><Icon name="visibility_off" style={{ fontSize: 15 }} />ลูกค้าไม่เห็นข้อความในแท็บนี้ · เฉพาะทีมที่ถูกเชิญ</div>}
          <div ref={box} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {visible.length === 0 && <div className="py-10 text-center text-[12px] text-slate-400">ยังไม่มีข้อความ{tab === "internal" ? "ในโน้ตภายใน เชิญทีมแล้วเริ่มคุยได้เลย" : ""}</div>}
            {visible.map((m) => (m.kind === "sys" ? <Sys key={m.id} m={m} /> : <Bubble key={m.id} m={m} name={nameOf(phone)} onUsePhoto={usePhoto} />))}
          </div>
          <div className="border-t border-slate-200 bg-white/90 p-3">
            {tab === "customer" && (cg ? <ChatGuideCard key={cg.stage} g={cg} onPick={setText} /> : <div className="mb-2 flex flex-wrap gap-1.5">{scripts.slice(0, 4).map((s) => <button key={s.key} onClick={() => setText(s.text)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-indigo-50">{s.when}</button>)}</div>)}
            <div className="flex items-center gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(text)} placeholder={tab === "internal" ? "พิมพ์โน้ตภายใน ใช้ @ เพื่อเรียกคนในทีม" : "พิมพ์ข้อความถึงลูกค้า"} className={cn("min-w-0 flex-1 rounded-full border px-4 py-2 text-[12.5px] outline-none", tab === "internal" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white")} />
              <button onClick={sendCard} className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-semibold text-slate-600 hover:bg-slate-50 md:inline-flex"><Icon name="view_timeline" style={{ fontSize: 16 }} />ส่งการ์ดสถานะงาน</button>
              <button onClick={() => send(text)} aria-label="ส่ง" className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-white", tab === "internal" ? "bg-amber-500" : "bg-[#06c755]")}><Icon name="send" style={{ fontSize: 18 }} /></button>
            </div>
          </div>
        </div>

        {/* แผงงาน */}
        <div className="hidden min-h-0 space-y-3 overflow-y-auto border-l border-slate-100 bg-white/70 p-3 lg:block">
          {job && (
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-3">
              <div className="flex flex-wrap items-center gap-1.5"><JobChip id={job.opsId} on /><span className="text-[11px] text-slate-500">{job.province}{job.scope ? ` · ${job.scope}` : ""}</span></div>
              {cur ? (
                <>
                  <div className="mt-2 text-[12px] font-bold text-slate-900">ขั้นต่อไป: {cur.label}</div>
                  <div className="text-[11px] text-slate-500">{PARTY[cur.owner].label} · {dueLabel(dueOf(job, cur))}</div>
                </>
              ) : <div className="mt-2 text-[12px] font-bold text-emerald-700">งานเสร็จสมบูรณ์</div>}
              <div className="mt-2 flex gap-0.5">{stepsOf(job).map((s) => <span key={s.key} className={cn("h-1.5 flex-1 rounded-full", job.done[s.key] ? "bg-emerald-500" : cur?.key === s.key ? "bg-indigo-500" : "bg-slate-200")} />)}</div>
              <div className="mt-1 text-[10.5px] text-slate-400">เสร็จ {stepsOf(job).filter((s) => job.done[s.key]).length} จาก {stepsOf(job).length} ขั้น</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-white p-2"><div className="text-[13px] font-bold text-slate-900">{job.value > 0 ? baht(job.value) : "-"}</div><div className="text-[10px] text-slate-500">มูลค่างาน</div></div><div className="rounded-xl bg-white p-2"><div className="text-[13px] font-bold text-emerald-700">{job.done.close ? "ปิดขายแล้ว" : job.done.deposit ? "มัดจำแล้ว" : "รอชำระ"}</div><div className="text-[10px] text-slate-500">การเงิน</div></div></div>
            </div>
          )}
          {lead && (
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-3">
              <div className="flex items-center gap-1.5"><JobChip id={lead.id} on /><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", LEAD_STATUS[lead.status].cls)}>{LEAD_STATUS[lead.status].label}</span></div>
              <div className="mt-2 text-[11.5px] font-bold text-slate-800">ความสนใจ</div>
              <div className="mt-1"><InterestChips list={lead.interests} fallback={lead.product} /></div>
              {lead.nextFollowAt && <div className="mt-2 text-[11px] font-semibold text-sky-700">นัดติดตาม {dtTh(lead.nextFollowAt)}</div>}
            </div>
          )}
          <div className={cn(glass, "p-3")}>
            <div className="mb-1.5 text-[11.5px] font-bold text-slate-800">คนในห้องนี้</div>
            <div className="flex items-center gap-2 py-1"><Avatar name={me} size={26} /><div className="min-w-0 flex-1"><div className="text-[11.5px] font-semibold text-slate-800">{me}</div><span className="inline-block rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">ทีมขาย (เจ้าของงาน)</span></div><span className="text-[10px] text-slate-400">ห้องลูกค้า</span></div>
            {members.map((m) => <div key={m.nick} className="flex items-center gap-2 py-1"><Avatar name={m.nick} size={26} /><div className="min-w-0 flex-1"><div className="text-[11.5px] font-semibold text-slate-800">{m.nick}</div><span className={cn("inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold", PARTY[m.party].cls)}>{m.role}</span></div><span className="text-[10px] text-slate-400">{m.mode === "internal" ? "ภายใน" : "ห้องลูกค้า"}</span></div>)}
            <button onClick={() => setDlg("invite")} className={cn(btnGhost, "mt-2 w-full !py-1.5 !text-[11.5px]")}><Icon name="person_add" style={{ fontSize: 16 }} />เชิญทีมเข้าห้อง{suggest && !members.some((m) => m.nick === suggest) && <span className="ml-1 rounded-full bg-indigo-600 px-1.5 text-[10px] text-white">แนะนำ</span>}</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => (job ? p.openJob(job.id) : lead && p.openLead(lead.id))} disabled={!job && !lead} className={cn(btnGhost, "flex-1 !px-2 !py-1.5 !text-[11.5px]")}>เปิดหน้า{job ? " Opp" : " Lead"}</button>
            <button onClick={() => p.openAccount(phone)} className={cn(btnGhost, "flex-1 !px-2 !py-1.5 !text-[11.5px]")}>ดู Account</button>
          </div>
        </div>
      </div>
      {dlg === "summary" && <SummaryDialog rows={summarize(roomMsgs.filter((m) => !m.internal && (!sel.job || m.job === sel.job)))} scope={sel.job ? sel.job : "ทุกงานของลูกค้า"} onClose={() => setDlg(null)} onApply={apply} />}
      {dlg === "invite" && <InviteDialog members={members} suggest={suggest} onClose={() => setDlg(null)} onInvite={invite} />}
    </>
  );
}
