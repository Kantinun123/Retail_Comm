"use client";
/* ลูกค้า 360° + ความพึงพอใจ (CSAT) 2 รอบ + สิทธิพิเศษหลังปิดงาน (เดโม: เก็บใน CRM, ส่ง LINE OA เป็นการจำลอง) */
import { useMemo, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { CSAT_Q, NOW, RIGHT_TEMPLATES, addDays, baht, dateTh, dtTh, rightState, type ChatState, type Job, type Lead, type Right } from "./crm-mock-data";
import { FAMILY_URL, TimelineCard, type FamilyState } from "./crm-timeline";
import { Avatar, Drawer, btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";

type Patch = (id: string, fn: (j: Job) => Job) => void;
const nowIso = () => NOW.toISOString();
export const familyCode = (phone: string) => `SF-${phone.replace(/\D/g, "").slice(-7).padStart(7, "0")}`;

/* ---------------- CSAT ใน Drawer ของงาน ---------------- */
export function CsatCard({ job, onPatch, toast }: { job: Job; onPatch: Patch; toast: (m: string) => void }) {
  const rounds = [
    { k: "r1" as const, title: "รอบที่ 1 · หลังปิดขาย", unlocked: !!job.done.close, lock: "เปิดให้ประเมินเมื่อปิดขายแล้ว" },
    { k: "r2" as const, title: "รอบที่ 2 · หลังส่งมอบงาน", unlocked: !!job.done.handover, lock: "เปิดให้ประเมินเมื่อส่งมอบงานแล้ว" },
  ];
  const [score, setScore] = useState<Record<string, number>>({ r1: 5, r2: 5 });
  const send = (k: "r1" | "r2") => {
    onPatch(job.id, (j) => ({ ...j, csat: { ...j.csat, [k]: { sentAt: nowIso() } }, log: [...j.log, { at: nowIso(), text: `ส่งแบบประเมินความพึงพอใจ ${k === "r1" ? "รอบ 1" : "รอบ 2"} ทาง LINE OA (QR/ลิงก์)` }] }));
    toast("ส่งแบบประเมินทาง LINE OA แล้ว (จำลอง)");
  };
  const answer = (k: "r1" | "r2") => {
    const avg = score[k];
    const nps = Math.min(10, Math.round(avg * 2));
    onPatch(job.id, (j) => {
      const at = nowIso();
      const give = k === "r1" && !j.rights;
      const rights: Right[] | undefined = give ? RIGHT_TEMPLATES.map((t, i) => ({ id: `${j.id}-R${i + 1}`, name: t.name, expiresAt: addDays(at, t.days) })) : j.rights;
      return {
        ...j, rights, csat: { ...j.csat, [k]: { ...j.csat?.[k], done: { avg, nps, at, comment: avg >= 4 ? "ทีมงานให้คำแนะนำดี" : avg >= 3 ? "พอใช้ อยากให้ตอบเร็วกว่านี้" : "ติดต่อล่าช้า ไม่พอใจ" } } },
        log: [...j.log, { at, text: `ลูกค้าตอบแบบประเมิน ${k === "r1" ? "รอบ 1" : "รอบ 2"} ได้ ${avg.toFixed(1)}/5` }, ...(give ? [{ at, text: `มอบสิทธิพิเศษ ${RIGHT_TEMPLATES.length} รายการ` }] : [])],
      };
    });
    toast(k === "r1" ? "ลูกค้าตอบแล้ว และมอบสิทธิพิเศษให้ลูกค้า" : "ลูกค้าตอบแล้ว");
  };
  return (
    <div className={cn(glass, "p-4")}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="reviews" style={{ fontSize: 18 }} />ความพึงพอใจลูกค้า (CSAT)</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {rounds.map((r) => {
          const c = job.csat?.[r.k];
          const done = c?.done;
          return (
            <div key={r.k} className={cn("rounded-xl border p-3", done ? (done.avg < 3 ? "border-rose-200 bg-rose-50/60" : "border-emerald-200 bg-emerald-50/50") : "border-slate-200 bg-white/70")}>
              <div className="text-[12.5px] font-bold text-slate-800">{r.title}</div>
              {!r.unlocked ? <p className="mt-1 flex items-center gap-1 text-[11.5px] text-slate-400"><Icon name="lock" style={{ fontSize: 14 }} />{r.lock}</p>
                : done ? (
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-2"><span className="text-[20px] font-bold text-slate-900">{done.avg.toFixed(1)}</span><span className="text-yellow-400">{"★".repeat(Math.round(done.avg))}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">NPS {done.nps}</span></div>
                    {done.comment && <p className="text-[11.5px] italic text-slate-600">“{done.comment}”</p>}
                    <p className="text-[10.5px] text-slate-400">ตอบเมื่อ {dtTh(done.at)}</p>
                    {done.avg < 3 && <p className="text-[11.5px] font-semibold text-rose-600">คะแนนต่ำกว่า 3 แจ้ง Area / โค้ชให้ติดตามแล้ว</p>}
                  </div>
                ) : c?.sentAt ? (
                  <div className="mt-1 space-y-2">
                    <p className="text-[11.5px] text-slate-500">ส่งทาง LINE OA เมื่อ {dtTh(c.sentAt)} · รอลูกค้าตอบ</p>
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                      <span className="text-[11px] text-slate-500">จำลองลูกค้าตอบ</span>
                      <select value={score[r.k]} onChange={(e) => setScore({ ...score, [r.k]: Number(e.target.value) })} className={cn(inputCls, "w-auto !py-1.5 text-[12px]")}>{[5, 4.5, 4, 3, 2].map((s) => <option key={s} value={s}>{s.toFixed(1)}</option>)}</select>
                      <button onClick={() => answer(r.k)} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}>ส่งคำตอบ</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 space-y-2">
                    <ul className="list-disc pl-4 text-[11px] text-slate-500">{CSAT_Q[r.k].map((q) => <li key={q}>{q}</li>)}</ul>
                    <button onClick={() => send(r.k)} className={cn(btnGhost, "!px-3 !py-1.5 !text-[12px]")}><Icon name="qr_code_2" style={{ fontSize: 16 }} />ส่งแบบประเมิน (LINE OA)</button>
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- รายชื่อลูกค้า ---------------- */
interface Cust { phone: string; name: string; province: string; jobs: Job[] }
function groupCustomers(jobs: Job[], leads: Lead[]): Cust[] {
  const m = new Map<string, Cust>();
  for (const j of jobs) {
    const c = m.get(j.phone) ?? { phone: j.phone, name: j.customer, province: j.province, jobs: [] };
    c.jobs.push(j);
    m.set(j.phone, c);
  }
  /* ลูกค้าที่ยังมีแต่ Lead (ยังไม่เปิด Opp) ก็ค้นไทม์ไลน์ได้ */
  for (const l of leads) if (!m.has(l.phone)) m.set(l.phone, { phone: l.phone, name: l.name, province: l.province, jobs: [] });
  return [...m.values()];
}
const famText = (f?: { sentAt: string; registeredAt?: string }, phone = "") => (f?.registeredAt ? familyCode(phone) : f ? "ส่งลิงก์แล้ว" : "ยังไม่สมัคร");
const csatAvg = (c: Cust) => {
  const v = c.jobs.flatMap((j) => [j.csat?.r1?.done?.avg, j.csat?.r2?.done?.avg]).filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const activeRights = (c: Cust) => c.jobs.flatMap((j) => j.rights ?? []).filter((r) => rightState(r) === "ok" || rightState(r) === "soon").length;

export function CustomersView({ jobs, leads, family, openCustomer }: { jobs: Job[]; leads: Lead[]; family: FamilyState; openCustomer: (phone: string) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const rank = (c: Cust) => (c.jobs.some((j) => j.done.close) ? 1 : 0) * 2 + (activeRights(c) > 0 ? 1 : 0);
    return groupCustomers(jobs, leads).filter((c) => !q || `${c.name}${c.phone}${c.province}`.includes(q)).sort((a, b) => rank(b) - rank(a));
  }, [jobs, leads, q]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">ลูกค้า 360°</h1>
        <p className="text-[12.5px] text-slate-500">รวมทุก Opp, คะแนนความพึงพอใจ และสิทธิพิเศษของลูกค้าแต่ละคน ผูกด้วยเบอร์โทร · กดแถวเพื่อดูไทม์ไลน์ของลูกค้า</p>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ เบอร์ หรือจังหวัด" className={cn(inputCls, "max-w-md")} />
      <div className={cn(glass, "overflow-x-auto")}>
        <table className="w-full min-w-[760px] text-left text-[12.5px]">
          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500"><tr>{["ลูกค้า", "SCG Family", "Opp", "ยอดปิดขาย", "CSAT เฉลี่ย", "สิทธิพิเศษที่ใช้ได้"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((c) => {
              const avg = csatAvg(c);
              const rights = activeRights(c);
              const sum = c.jobs.filter((j) => j.done.close).reduce((a, j) => a + j.value, 0);
              return (
                <tr key={c.phone} onClick={() => openCustomer(c.phone)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={c.name} /><div><div className="font-semibold text-slate-900">{c.name}</div><div className="text-[11px] text-slate-400">{c.phone} · {c.province}</div></div></div></td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", family[c.phone]?.registeredAt ? "bg-rose-50 text-rose-700" : family[c.phone] ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-400")}>{famText(family[c.phone], c.phone)}</span></td>
                  <td className="px-4 py-3">{c.jobs.length}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{sum ? baht(sum) : "-"}</td>
                  <td className="px-4 py-3">{avg === null ? <span className="text-slate-300">-</span> : <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", avg >= 4 ? "bg-emerald-50 text-emerald-700" : avg >= 3 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>{avg.toFixed(1)}</span>}</td>
                  <td className="px-4 py-3">{rights ? <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700">{rights} รายการ</span> : <span className="text-slate-300">-</span>}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-slate-400">ไม่พบลูกค้า</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Customer 360 Drawer ---------------- */
const RIGHT_CLS = { ok: "bg-emerald-50 text-emerald-700", soon: "bg-amber-50 text-amber-700", used: "bg-sky-50 text-sky-700", expired: "bg-slate-100 text-slate-500" } as const;
const RIGHT_TXT = { ok: "ใช้ได้", soon: "ใกล้หมดอายุ", used: "ใช้แล้ว", expired: "หมดอายุ" } as const;

export function Customer360Drawer({ phone, jobs, leads, chat, family, onClose, openJob, openLead, onUseRight, onOpenChat, onSendFamily, onFamilyRegistered, toast }: {
  onOpenChat: (phone: string, job?: string) => void;
  phone: string | null; jobs: Job[]; leads: Lead[]; chat: ChatState; family: FamilyState; onClose: () => void; openJob: (id: string) => void; openLead: (id: string) => void; onUseRight: (j: Job, r: Right) => void;
  onSendFamily: (phone: string, name: string) => void; onFamilyRegistered: (phone: string) => void; toast: (m: string) => void;
}) {
  const mine = phone ? jobs.filter((j) => j.phone === phone) : [];
  const myLeads = phone ? leads.filter((l) => l.phone === phone) : [];
  const c = mine[0];
  const name = c?.customer ?? myLeads[0]?.name ?? "";
  const province = c?.province ?? myLeads[0]?.province ?? "";
  const rights = mine.flatMap((j) => (j.rights ?? []).map((r) => ({ r, j })));
  const avg = phone ? csatAvg({ phone, name, province, jobs: mine }) : null;
  const fam = phone ? family[phone] : undefined;
  return (
    <Drawer open={!!phone} onClose={onClose} wide title={name} subtitle={phone ? `${phone} · ${province}` : ""}>
      {phone && (c || myLeads.length > 0) && (
        <>
          <div className={cn(glass, "p-4")}>
            <div className={cn("flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[12px]", fam?.registeredAt ? "bg-rose-50" : "bg-indigo-50")}>
              <Icon name="badge" style={{ fontSize: 17 }} />
              <b className="text-slate-800">SCG Family</b>
              {fam?.registeredAt ? <span className="ml-auto font-bold text-rose-700">สมัครแล้ว · {familyCode(phone)}</span> : fam ? (
                <>
                  <span className="text-amber-700">ส่งลิงก์แล้ว {dateTh(fam.sentAt)} · รอลูกค้าสมัคร</span>
                  <button onClick={() => onFamilyRegistered(phone)} className={cn(btnGhost, "ml-auto !px-2.5 !py-1 !text-[11px]")}>จำลอง: ลูกค้าสมัครแล้ว</button>
                </>
              ) : <span className="text-slate-500">ยังไม่ได้สมัคร</span>}
            </div>
            {!fam?.registeredAt && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => onSendFamily(phone, name)} className={cn(btnPrimary, "!px-3 !py-1.5 !text-[12px]")}><Icon name="send" style={{ fontSize: 16 }} />{fam ? "ส่งลิงก์อีกครั้งทาง LINE" : "ส่งลิงก์สมัคร SCG Family ทาง LINE"}</button>
                <a href={FAMILY_URL} target="_blank" rel="noreferrer" className={cn(btnGhost, "!px-3 !py-1.5 !text-[12px]")}><Icon name="open_in_new" style={{ fontSize: 16 }} />เปิดหน้าสมัคร</a>
              </div>
            )}
            <button onClick={() => onOpenChat(phone)} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-[#06a047] hover:bg-emerald-50"><Icon name="chat" style={{ fontSize: 17 }} />เปิดแชท LINE OA</button>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[[String(mine.length), "Opp"], [baht(mine.filter((j) => j.done.close).reduce((a, j) => a + j.value, 0)), "ยอดปิดขาย"], [avg === null ? "-" : avg.toFixed(1), "CSAT เฉลี่ย"]].map(([a, b]) => (
                <div key={b} className="rounded-xl bg-white/70 p-2"><div className="text-[15px] font-bold text-slate-900">{a}</div><div className="text-[10.5px] text-slate-500">{b}</div></div>
              ))}
            </div>
          </div>
          <TimelineCard phone={phone} name={name} jobs={jobs} leads={leads} chat={chat} fam={fam} openJob={openJob} openLead={openLead} onCopy={(t) => { void navigator.clipboard?.writeText(t); toast("คัดลอกสรุปเคสแล้ว"); }} />
          {mine.length > 0 && (
            <div className={cn(glass, "p-4")}>
              <h3 className="mb-2 text-[13px] font-bold text-slate-900">Opp ทั้งหมดของลูกค้า</h3>
              {mine.map((j) => (
                <button key={j.id} onClick={() => openJob(j.id)} className="flex w-full flex-wrap items-center gap-3 border-b border-slate-100 py-2.5 text-left last:border-0 hover:bg-indigo-50/40">
                  <span className="text-[11px] text-slate-400">{j.opsId}</span>
                  <span className="text-[13px] font-semibold text-slate-800">{j.scope ?? "งานหลังคา"}</span>
                  <span className="text-[12px] text-slate-500">{j.value > 0 ? baht(j.value) : "ยังไม่ประเมิน"}</span>
                  <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold", j.done.handover ? "bg-emerald-100 text-emerald-800" : j.done.close ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700")}>{j.done.handover ? "ส่งมอบแล้ว" : j.done.close ? "ปิดขายแล้ว" : "กำลังดำเนินการ"}</span>
                </button>
              ))}
            </div>
          )}
          <div className={cn(glass, "p-4")}>
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="redeem" style={{ fontSize: 18 }} />สิทธิพิเศษของลูกค้า</h3>
            {rights.length === 0 ? <p className="text-[12px] text-slate-400">ยังไม่มีสิทธิ์ ระบบมอบให้หลังลูกค้าตอบแบบประเมินรอบ 1</p> : rights.map(({ r, j }) => {
              const st = rightState(r);
              return (
                <div key={r.id} className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/70 bg-white/70 p-2.5 last:mb-0">
                  <div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-slate-800">{r.name}</div><div className="text-[10.5px] text-slate-400">{r.usedAt ? `ใช้เมื่อ ${dateTh(r.usedAt)}` : `หมดอายุ ${dateTh(r.expiresAt)}`}</div></div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", RIGHT_CLS[st])}>{RIGHT_TXT[st]}</span>
                  {(st === "ok" || st === "soon") && <button onClick={() => onUseRight(j, r)} className={cn(btnPrimary, "!px-3 !py-1.5 !text-[11.5px]")}>ใช้สิทธิ → เปิด Opp</button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Drawer>
  );
}