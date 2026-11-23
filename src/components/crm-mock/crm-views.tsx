"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  AFTER_STEPS, LEAD_STATUS, NOW, PRODUCTS, STAGES, TASK_ICON, agoText, atRisk, baht, depositOf, dtTh, hoursSince, isToday, leadSla, stageMeta,
  type Job, type Lead, type LeadStatus, type Stage, type Task,
} from "./crm-mock-data";
import { Avatar, SlaBadge, Stat, btnPrimary, glass, grad, inputCls } from "./crm-ui";

export interface Ctx {
  leads: Lead[]; jobs: Job[]; tasks: Task[];
  openLead: (id: string) => void; openJob: (id: string) => void; openTask: (t: Task) => void;
  newJob: () => void; ask: () => void; toast: (m: string) => void; moveJob: (id: string, to: Stage) => void;
}

/* ---------------- หน้าหลัก: ศูนย์เลขา ---------------- */
export function HomeView({ c }: { c: Ctx }) {
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const risk = atRisk(c.leads, c.jobs);
  const urgent = c.tasks.filter((t) => t.priority === 1).length;
  const waiting = c.leads.filter((l) => l.status === "waiting");
  const breach = waiting.filter((l) => leadSla(l).state === "breach").length;
  const active = c.jobs.filter((j) => !["done", "cancelled", "aftersale"].includes(j.stage));
  const toCollect = c.jobs.filter((j) => j.stage === "deposit" || j.stage === "collect");
  const collectAmt = toCollect.reduce((s, j) => s + (j.stage === "deposit" ? depositOf(j) : j.value - depositOf(j)), 0);
  const closed = c.jobs.filter((j) => j.stage === "aftersale" || j.stage === "done");
  const after = c.jobs.filter((j) => j.stage === "aftersale");
  const first = c.tasks[0];

  return (
    <div className="space-y-5">
      <section className={cn("relative overflow-hidden rounded-3xl p-6 text-white md:p-8", grad)}>
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-[12px] font-medium text-white/80">
              <Icon name="auto_awesome" style={{ fontSize: 16 }} /> น้องเลขา · {NOW.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })}
            </div>
            <h1 className="mt-2 text-[24px] font-bold leading-snug md:text-[28px]">
              สวัสดีค่ะ วันนี้มี {c.tasks.length} เรื่องที่ควรทำ
              {urgent > 0 && <span className="text-amber-200"> เร่งด่วน {urgent} เรื่อง</span>}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">
              {breach > 0 ? `มี Lead เกิน SLA ${breach} ราย ` : "ไม่มี Lead เกิน SLA "}
              {risk.jobs.length > 0 ? `และมีงานมูลค่ารวม ${baht(risk.value)} ที่เริ่มเงียบหาย ${risk.jobs.length} งาน ` : ""}
              เรียงลำดับให้แล้ว เริ่มจากข้อบนสุดได้เลยค่ะ
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {first && (
              <button onClick={() => c.openTask(first)} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-indigo-700 shadow-lg transition hover:-translate-y-0.5">
                <Icon name="play_arrow" fill /> เริ่มจากงานแรก
              </button>
            )}
            <button onClick={c.ask} className="inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-[13px] font-semibold backdrop-blur transition hover:bg-white/20">
              <Icon name="chat_bubble" /> ถามน้องเลขา
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon="person_search" label="Lead รอติดต่อ" value={waiting.length} sub={breach ? `เกิน SLA ${breach} ราย` : "ทันเวลาทั้งหมด"} tone={breach ? "rose" : "emerald"} />
        <Stat icon="work_history" label="งานระหว่างดำเนินการ" value={active.length} sub={`มูลค่า ${baht(active.reduce((s, j) => s + j.value, 0))}`} />
        <Stat icon="account_balance_wallet" label="รอเก็บเงิน" value={baht(collectAmt)} sub={`${toCollect.length} งาน (มัดจำ + ส่วนที่เหลือ)`} tone="amber" />
        <Stat icon="verified" label="ปิดขายแล้ว" value={closed.length} sub={`มูลค่า ${baht(closed.reduce((s, j) => s + j.value, 0))}`} tone="emerald" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className={cn(glass, "p-4 md:p-5")}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">งานที่ต้องทำวันนี้</h2>
            <span className="text-[11px] text-slate-400">เรียงตามความเร่งด่วนและมูลค่า</span>
          </div>
          <ul className="space-y-2">
            {c.tasks.slice(0, 8).map((t) => (
              <li key={t.id} className="rounded-2xl border border-slate-100 bg-white p-3 transition hover:border-indigo-200 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", t.priority === 1 ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600")}>
                    <Icon name={TASK_ICON[t.kind]} style={{ fontSize: 20 }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-bold text-slate-900">{t.title}</span>
                      {t.priority === 1 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">เร่งด่วน</span>}
                      {t.value ? <span className="text-[11px] font-semibold text-slate-400">{baht(t.value)}</span> : null}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{t.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => c.openTask(t)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-indigo-700">{t.action}</button>
                      {t.phone && <button onClick={() => c.toast(`กำลังโทร ${t.phone} (ตัวอย่าง)`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"><Icon name="call" style={{ fontSize: 15 }} />โทร</button>}
                      {t.draft && (
                        <button onClick={() => setOpenDraft(openDraft === t.id ? null : t.id)} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-violet-700">
                          <Icon name="auto_awesome" style={{ fontSize: 15 }} />ร่างข้อความ
                        </button>
                      )}
                    </div>
                    {openDraft === t.id && t.draft && (
                      <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                        <p className="text-[12.5px] leading-relaxed text-slate-700">{t.draft}</p>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => { void navigator.clipboard?.writeText(t.draft ?? ""); c.toast("คัดลอกข้อความแล้ว"); }} className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">คัดลอก</button>
                          <button onClick={() => { c.toast(`ส่งข้อความถึง ${t.who} แล้ว (ตัวอย่าง)`); setOpenDraft(null); }} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white">ส่งทาง LINE</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {c.tasks.length === 0 && <li className="py-10 text-center text-[13px] text-slate-400">วันนี้ไม่มีงานค้าง เยี่ยมมากค่ะ</li>}
          </ul>
        </section>

        <div className="space-y-5">
          <PipelineCard jobs={c.jobs} />
          <section className={cn(glass, "p-4 md:p-5")}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-slate-900">หลังปิดขาย ติดตามอยู่ {after.length} งาน</h2>
            </div>
            <ul className="space-y-3">
              {after.map((j) => {
                const done = AFTER_STEPS.filter((s) => j.after[s.key]).length;
                const next = AFTER_STEPS.find((s) => !j.after[s.key]);
                const eta = next ? j.afterEta[next.key] : undefined;
                const late = !!eta && new Date(eta).getTime() < NOW.getTime() && !isToday(eta);
                return (
                  <li key={j.id}>
                    <button onClick={() => c.openJob(j.id)} className="w-full text-left">
                      <div className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="truncate font-semibold text-slate-800">{j.customer}</span>
                        <span className={cn("shrink-0 text-[11px] font-semibold", late ? "text-rose-600" : "text-slate-500")}>{next ? `ถัดไป: ${next.label}${late ? " (เลยกำหนด)" : ""}` : "ครบแล้ว"}</span>
                      </div>
                      <div className="mt-1.5 flex gap-1">
                        {AFTER_STEPS.map((s, i) => <span key={s.key} className={cn("h-1.5 flex-1 rounded-full", i < done ? "bg-emerald-500" : i === done && late ? "bg-rose-400" : i === done ? "bg-indigo-300" : "bg-slate-200")} />)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function PipelineCard({ jobs }: { jobs: Job[] }) {
  const rows = STAGES.filter((s) => s.key !== "done").map((s) => ({ s, list: jobs.filter((j) => j.stage === s.key) }));
  const max = Math.max(1, ...rows.map((r) => r.list.reduce((a, j) => a + j.value, 0)));
  return (
    <section className={cn(glass, "p-4 md:p-5")}>
      <h2 className="mb-3 text-[15px] font-bold text-slate-900">มูลค่างานตามขั้นตอน</h2>
      <ul className="space-y-2.5">
        {rows.map(({ s, list }) => {
          const sum = list.reduce((a, j) => a + j.value, 0);
          return (
            <li key={s.key}>
              <div className="flex justify-between text-[11.5px]">
                <span className="font-medium text-slate-600">{s.label} <span className="text-slate-400">· {list.length}</span></span>
                <span className="font-semibold text-slate-800">{baht(sum)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full transition-all" style={{ width: `${(sum / max) * 100}%`, background: s.tone }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------- Leads ---------------- */
export function LeadsView({ c }: { c: Ctx }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState<LeadStatus | "all">("all");
  const [prod, setProd] = useState("");
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: c.leads.length };
    for (const l of c.leads) m[l.status] = (m[l.status] ?? 0) + 1;
    return m;
  }, [c.leads]);
  const rows = c.leads
    .filter((l) => (st === "all" || l.status === st) && (!prod || l.product === prod) && (!q || `${l.name}${l.phone}${l.id}${l.province}`.includes(q)))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const breach = c.leads.filter((l) => l.status === "waiting" && leadSla(l).state === "breach").length;
  const chips: { k: LeadStatus | "all"; label: string }[] = [{ k: "all", label: "ทั้งหมด" }, { k: "waiting", label: "รอติดต่อ" }, { k: "contacting", label: "กำลังสกรีน" }, { k: "qualified", label: "รอเปิด Ops" }, { k: "converted", label: "เปิด Ops แล้ว" }, { k: "lost", label: "Loss" }];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">ลูกค้ามุ่งหวัง (Leads)</h1>
          <p className="text-[12.5px] text-slate-500">Lead จากเว็บฟอร์มเข้ามาที่นี่อัตโนมัติ · เป้าติดต่อครั้งแรกภายใน 4 ชั่วโมง</p>
        </div>
        {breach > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-bold text-rose-700"><Icon name="alarm" style={{ fontSize: 16 }} />เกิน SLA {breach} ราย</span>}
      </div>
      <div className={cn(glass, "space-y-3 p-3 md:p-4")}>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ เบอร์ รหัส หรือจังหวัด" className={cn(inputCls, "pl-9")} />
          </div>
          <select value={prod} onChange={(e) => setProd(e.target.value)} className={cn(inputCls, "w-auto")}>
            <option value="">ทุก Solution</option>
            {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((ch) => (
            <button key={ch.k} onClick={() => setSt(ch.k)} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold transition", st === ch.k ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300")}>
              {ch.label} <span className={st === ch.k ? "text-white/70" : "text-slate-400"}>{counts[ch.k] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={cn(glass, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[12.5px]">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>{["ลูกค้า", "Solution", "ช่องทาง", "เข้ามาเมื่อ", "SLA ติดต่อครั้งแรก", "สถานะ", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} onClick={() => c.openLead(l.id)} className="cursor-pointer border-t border-slate-100 transition hover:bg-indigo-50/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={l.name} />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{l.name}</div>
                        <div className="text-[11px] text-slate-400">{l.id} · {l.province}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{l.product}</td>
                  <td className="px-4 py-3 text-slate-500">{l.channel}</td>
                  <td className="px-4 py-3 text-slate-500">{dtTh(l.createdAt)}<div className="text-[11px] text-slate-400">{agoText(l.createdAt)}</div></td>
                  <td className="px-4 py-3"><SlaBadge lead={l} /></td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", LEAD_STATUS[l.status].cls)}>{LEAD_STATUS[l.status].label}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); c.toast(`กำลังโทร ${l.phone} (ตัวอย่าง)`); }} className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100" aria-label="โทร"><Icon name="call" style={{ fontSize: 17 }} /></button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-slate-400">ไม่พบรายการ</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Board / List ---------------- */
function idleChip(j: Job) {
  if (["done", "cancelled", "aftersale"].includes(j.stage)) return null;
  const h = hoursSince(j.lastTouchAt);
  const cls = h > 72 ? "bg-rose-50 text-rose-700" : h > 48 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", cls)}>เงียบมา {Math.max(1, Math.round(h / 24))} วัน</span>;
}

export function BoardView({ c }: { c: Ctx }) {
  const [mode, setMode] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const jobs = c.jobs.filter((j) => !q || `${j.customer}${j.id}${j.opsId}${j.province}`.includes(q));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">งานทั้งหมด</h1>
          <p className="text-[12.5px] text-slate-500">ลากการ์ดเพื่อย้ายขั้นตอน · กดการ์ดเพื่อดูรายละเอียดและสถานะหลังปิดขาย</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / รหัสงาน" className={cn(inputCls, "w-52 pl-9")} />
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            {(["board", "list"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", mode === m ? "bg-indigo-600 text-white" : "text-slate-500")}>
                <Icon name={m === "board" ? "view_kanban" : "table_rows"} style={{ fontSize: 17 }} />{m === "board" ? "กระดาน" : "รายการ"}
              </button>
            ))}
          </div>
          <button onClick={c.newJob} className={btnPrimary}><Icon name="add" style={{ fontSize: 18 }} />สร้างงาน</button>
        </div>
      </div>

      {mode === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-8 md:px-8">
          <div className="flex min-w-max gap-3">
            {STAGES.map((s) => {
              const list = jobs.filter((j) => j.stage === s.key);
              return (
                <div key={s.key}
                  onDragOver={(e) => { e.preventDefault(); setOver(s.key); }} onDragLeave={() => setOver(null)}
                  onDrop={() => { if (dragId) c.moveJob(dragId, s.key); setDragId(null); setOver(null); }}
                  className={cn("w-[268px] shrink-0 rounded-2xl border p-2.5 transition", over === s.key ? "border-indigo-400 bg-indigo-50/70" : "border-white/70 bg-white/50")}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: s.tone }}><Icon name={s.icon} style={{ fontSize: 16 }} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-bold text-slate-800">{s.label}</div>
                      <div className="truncate text-[10.5px] text-slate-400">{s.hint}</div>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-sm">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((j) => (
                      <article key={j.id} draggable onDragStart={() => setDragId(j.id)} onDragEnd={() => { setDragId(null); setOver(null); }} onClick={() => c.openJob(j.id)}
                        className={cn("cursor-grab rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing", dragId === j.id && "opacity-40")}>
                        <div className="flex items-center gap-2">
                          <Avatar name={j.customer} size={26} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12.5px] font-bold text-slate-900">{j.customer}</div>
                            <div className="text-[10.5px] text-slate-400">{j.id}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-[11.5px] text-slate-600">{j.product} · {j.pkg.split("–")[1]?.trim() ?? j.pkg}</div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
                          <span className="text-[13px] font-bold text-indigo-700">{baht(j.value)}</span>
                          {idleChip(j)}
                        </div>
                        {j.stage === "survey" && j.surveyAt && <div className="mt-2 flex items-center gap-1 rounded-lg bg-cyan-50 px-2 py-1 text-[10.5px] font-semibold text-cyan-800"><Icon name="event" style={{ fontSize: 14 }} />สำรวจ {dtTh(j.surveyAt)}</div>}
                        {j.stage === "aftersale" && (() => { const n = AFTER_STEPS.find((a) => !j.after[a.key]); return n ? <div className="mt-2 flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10.5px] font-semibold text-emerald-800"><Icon name={n.icon} style={{ fontSize: 14 }} />ถัดไป: {n.label}</div> : null; })()}
                      </article>
                    ))}
                    {list.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11px] text-slate-300">วางการ์ดที่นี่</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={cn(glass, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[12.5px]">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>{["รหัสงาน", "ลูกค้า", "Package", "จังหวัด", "มูลค่า", "ผู้ดูแล", "ขั้นตอน"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const m = stageMeta(j.stage);
                  return (
                    <tr key={j.id} onClick={() => c.openJob(j.id)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40">
                      <td className="px-4 py-3 font-semibold text-indigo-700">{j.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{j.customer}</td>
                      <td className="px-4 py-3 text-slate-600">{j.pkg}</td>
                      <td className="px-4 py-3 text-slate-500">{j.province}</td>
                      <td className="px-4 py-3 font-semibold">{baht(j.value)}</td>
                      <td className="px-4 py-3 text-slate-500">{j.owner}</td>
                      <td className="px-4 py-3"><span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: m.tone }}>{m.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
