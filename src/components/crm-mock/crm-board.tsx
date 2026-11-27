"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  COLS, baht, dueMoney, heldBy, instNet, isFinished, MODEL_LABEL, PARTY, SEGMENT_LABEL, WORK_LABEL, colOf, missingOf, valueText, currentStep, dateTh, dtTh, dueLabel, dueOf, lateWd, packetsOf,
  type Job, type Packet, type Party,
} from "./crm-mock-data";
import { Avatar, PartyBadge, PresetBanner, btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";
import { BoardFrame } from "./crm-overview";
import type { Ctx } from "./crm-views";

type Ball = "all" | "others" | "money" | "SE" | "KIM" | "SCM" | "ROOM" | "SURV" | "late";
const BALL_CHIPS: { k: Ball; label: string }[] = [
  { k: "all", label: "ทั้งหมด" }, { k: "SE", label: "รอเราทำ" }, { k: "others", label: "รอหน่วยงานอื่น" }, { k: "money", label: "รอเก็บเงิน" }, { k: "KIM", label: "รอ KIM" }, { k: "SCM", label: "รอ SCM" }, { k: "ROOM", label: "รอห้องแบบ" }, { k: "SURV", label: "รอทีมสำรวจ" }, { k: "late", label: "ช้ากว่าแผน" },
];
const WORK_SHORT = { roof: "มุงอย่างเดียว", truss: "ทรัส + มุง", ase: "อะเส + ทรัส + มุง", survey: "สำรวจ" } as const;

function stepInfo(j: Job) {
  const s = currentStep(j);
  if (!s) return null;
  const due = dueOf(j, s);
  return { s, due, late: lateWd(due) };
}

function ballOk(j: Job, k: Ball) {
  if (k === "all") return true;
  if (k === "money") return !j.cancelReason && !isFinished(j) && dueMoney(j) > 0;
  const i = stepInfo(j);
  if (!i) return false;
  if (k === "late") return i.late > 0;
  if (k === "others") return i.s.owner !== "SE";
  return i.s.owner === k;
}
const PRESET_BALL: Record<string, Ball> = { opp_mine: "SE", opp_others: "others", opp_money: "money" };

export function BoardView({ c }: { c: Ctx }) {
  const [mode, setMode] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [ball, setBall] = useState<Ball>(() => PRESET_BALL[c.preset?.key ?? ""] ?? "all");
  const jobs = useMemo(() => c.jobs.filter((j) => {
    if (q && !`${j.customer}${j.id}${j.opsId}${j.province}`.includes(q)) return false;
    return ballOk(j, ball);
  }), [c.jobs, q, ball]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">งานทั้งหมด (Opp)</h1>
          <p className="text-[12.5px] text-slate-500">ขั้นตอนและกำหนดเสร็จอิงตาม Project Timeline · การ์ดบอกว่าตอนนี้ &quot;บอลอยู่กับใคร&quot;</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          {!c.readOnly && <button onClick={() => c.newSurvey()} className={btnGhost}><Icon name="pin_drop" style={{ fontSize: 18 }} />เปิด Opp สำรวจ</button>}
          {!c.readOnly && <button onClick={c.newJob} className={btnPrimary}><Icon name="add" style={{ fontSize: 18 }} />เปิด Opp ใหม่</button>}
        </div>
      </div>

      {c.preset && PRESET_BALL[c.preset.key] && <PresetBanner label={c.preset.label} onClear={() => { c.setPreset(null); setBall("all"); }} />}
      <div className="flex flex-wrap gap-2">
        {BALL_CHIPS.map((ch) => {
          const n = c.jobs.filter((j) => ballOk(j, ch.k)).length;
          return (
            <button key={ch.k} onClick={() => setBall(ch.k)} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold transition", ball === ch.k ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300")}>
              {ch.label} <span className={ball === ch.k ? "text-white/70" : "text-slate-400"}>{n}</span>
            </button>
          );
        })}
      </div>

      {mode === "board" ? (
        <BoardFrame
          items={COLS.map((col) => { const list = jobs.filter((j) => colOf(j) === col.key); return { id: col.key, label: col.label, short: col.label, hint: col.hint, icon: col.icon, tone: col.tone, count: list.length, alert: list.some((j) => (stepInfo(j)?.late ?? 0) > 0) }; })}
          render={(id) => {
            const list = jobs.filter((j) => colOf(j) === id).sort((a, b) => (stepInfo(b)?.late ?? 0) - (stepInfo(a)?.late ?? 0));
            return (
              <>
                {list.map((j) => <JobCard key={j.id} j={j} onOpen={() => c.openJob(j.id)} />)}
                {list.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11px] text-slate-300">ไม่มีงาน</div>}
              </>
            );
          }}
        />      ) : (
        <div className={cn(glass, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[12.5px]">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>{["รหัสงาน", "ลูกค้า", "กลุ่ม / งาน", "มูลค่า", "ขั้นตอนปัจจุบัน", "รอ", "กำหนด"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const i = stepInfo(j);
                  return (
                    <tr key={j.id} onClick={() => c.openJob(j.id)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40">
                      <td className="px-4 py-3 font-semibold text-indigo-700">{j.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{j.customer}<div className="text-[11px] font-normal text-slate-400">{j.province}</div></td>
                      <td className="px-4 py-3 text-slate-600">{SEGMENT_LABEL[j.segment].split(" ")[0]}<div className="text-[11px] text-slate-400">{WORK_LABEL[j.work]}</div></td>
                      <td className="px-4 py-3 font-semibold">{valueText(j)}</td>
                      <td className="px-4 py-3 text-slate-700">{i ? i.s.label : j.cancelReason ? <span className="font-semibold text-rose-600">ยกเลิก · {j.cancelReason}</span> : <span className="font-semibold text-emerald-700">จบงาน</span>}</td>
                      <td className="px-4 py-3">{i && <PartyBadge party={i.s.owner} />}</td>
                      <td className={cn("px-4 py-3 text-[12px] font-medium", i && i.late > 0 ? "text-rose-600" : "text-slate-500")}>{i ? `${dateTh(i.due)} · ${dueLabel(i.due)}` : "-"}</td>
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

function JobCard({ j, onOpen }: { j: Job; onOpen: () => void }) {
  const i = stepInfo(j);
  const scmReady = j.scm.readyEta && i && (i.s.key === "deliver" || i.s.key === "install_plan");
  return (
    <article onClick={onOpen} className="cursor-pointer rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2">
        <Avatar name={j.customer} size={26} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-bold text-slate-900">{j.customer}</div>
          <div className="text-[10.5px] text-slate-400">{j.id}</div>
        </div>
        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold", j.segment === "hbd" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500")}>{j.segment === "hbd" ? "HBD" : "ทั่วไป"}</span>
      </div>
      <div className="mt-2 text-[11.5px] text-slate-600">{WORK_SHORT[j.work]} · {MODEL_LABEL[j.model]}</div>
      <div className="mt-1 text-[13px] font-bold text-indigo-700">{valueText(j)}</div>
      {i && (
        <div className={cn("mt-2 rounded-lg px-2 py-1.5", i.late > 0 ? "bg-rose-50" : "bg-slate-50")}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-semibold text-slate-700">{i.s.label}</span>
            <PartyBadge party={i.s.owner} />
          </div>
          <div className={cn("mt-0.5 text-[10.5px] font-medium", i.late > 0 ? "text-rose-600" : "text-slate-500")}>{dueLabel(i.due)} · {dateTh(i.due)}</div>
        </div>
      )}
      {j.intake && !j.cancelReason && missingOf(j.intake).any && <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10.5px] font-semibold text-amber-800"><Icon name="assignment_late" style={{ fontSize: 14 }} />ใบเปิดงานยังไม่ครบ</div>}
      {i?.s.key === "survey" && j.surveyAt && <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-cyan-50 px-2 py-1 text-[10.5px] font-semibold text-cyan-800"><Icon name="event" style={{ fontSize: 14 }} />นัดสำรวจ {dtTh(j.surveyAt)}</div>}
      {scmReady && <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10.5px] font-semibold text-amber-800"><Icon name="inventory_2" style={{ fontSize: 14 }} />สินค้าครบคาด {dateTh(j.scm.readyEta)}</div>}
    </article>
  );
}

/* ---------------- การเชื่อมข้อมูลกับแอปปลายทาง ---------------- */
type Dir = "all" | "out" | "in" | "waiting";
export function ExchangeView({ c }: { c: Ctx }) {
  const [party, setParty] = useState<Party | "all">("all");
  const [dir, setDir] = useState<Dir>("all");
  const all: Packet[] = useMemo(() => c.jobs.flatMap((j) => packetsOf(j)), [c.jobs]);
  const rows = all
    .filter((p) => (party === "all" || p.party === party) && (dir === "all" ? true : dir === "waiting" ? p.state === "waiting" : p.dir === dir))
    .sort((a, b) => +new Date(b.at ?? b.due ?? 0) - +new Date(a.at ?? a.due ?? 0));
  const parties: Party[] = ["KIM", "SCM", "ROOM", "SURV"];
  /* งานที่ถูกระงับเพราะรอลูกค้าชำระงวด : KIM/SCM ห้ามสั่ง ส่ง หรือติดตั้งจนกว่าจะปลดล็อก */
  const holds = c.jobs.flatMap((j) => { const s = currentStep(j); const it = s ? heldBy(j, s.key) : null; return s && it ? [{ j, s, it }] : []; });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">การเชื่อมข้อมูลกับหน่วยงาน</h1>
        <p className="text-[12.5px] text-slate-500">CRM จ่ายข้อมูลงานไปยังแอปของ KIM, SCM และห้องแบบ แล้วรับสถานะ/ไฟล์กลับเข้ามา (ตัวอย่างนี้จำลองการเชื่อมต่อ)</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {parties.map((p) => {
          const mine = all.filter((x) => x.party === p);
          const sent = mine.filter((x) => x.dir === "out").length;
          const got = mine.filter((x) => x.state === "received").length;
          const wait = mine.filter((x) => x.state === "waiting");
          const late = wait.filter((x) => lateWd(x.due!) > 0).length;
          return (
            <button key={p} onClick={() => setParty(party === p ? "all" : p)} className={cn(glass, "p-4 text-left transition hover:-translate-y-0.5", party === p && "ring-2 ring-indigo-400")}>
              <div className="flex items-center gap-2"><PartyBadge party={p} /><span className="text-[11px] text-slate-400">{PARTY[p].sub}</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[20px] font-bold text-slate-900">{sent}</div><div className="text-[10.5px] text-slate-500">ส่งออก</div></div>
                <div><div className="text-[20px] font-bold text-emerald-600">{got}</div><div className="text-[10.5px] text-slate-500">รับกลับแล้ว</div></div>
                <div><div className={cn("text-[20px] font-bold", late ? "text-rose-600" : "text-amber-600")}>{wait.length}</div><div className="text-[10.5px] text-slate-500">{late ? `รอ (ช้า ${late})` : "ยังรอ"}</div></div>
              </div>
            </button>
          );
        })}
      </div>
      {holds.length > 0 && (
        <div className={cn(glass, "space-y-2 border-rose-200 p-4")}>
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-rose-700"><Icon name="lock" className="!text-[18px]" />ระงับ: รอลูกค้าชำระเงิน ({holds.length} งาน)</h3>
          <p className="text-[11.5px] text-slate-500">KIM และ SCM ได้รับแจ้งแล้ว ยังสั่ง ส่ง หรือติดตั้งไม่ได้จนกว่าลูกค้าจะชำระงวดที่ถึงกำหนด</p>
          <ul className="space-y-1.5">
            {holds.map(({ j, s, it }) => (
              <li key={j.id}><button onClick={() => c.openJob(j.id)} className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-left text-[12px] hover:border-rose-300">
                <PartyBadge party={s.owner} /><span className="min-w-0 flex-1"><b className="block truncate text-slate-800">{j.customer} · {s.label}</b><span className="text-[10.5px] text-slate-500">{j.opsId} · รอชำระ {it.label.split(" · ")[0]} · ต้องชำระก่อน: {it.unlocks.join(", ")}</span></span>
                <b className="text-rose-700">{baht(instNet(j, it.no))}</b>
              </button></li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {([["all", "ทั้งหมด"], ["out", "ส่งออก"], ["in", "รับเข้า"], ["waiting", "ยังรอ"]] as [Dir, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setDir(k)} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold transition", dir === k ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300")}>{label}</button>
        ))}
      </div>
      <div className={cn(glass, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[12.5px]">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>{["เวลา / กำหนด", "ทิศทาง", "ข้อมูล", "งาน", "สถานะ"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} onClick={() => c.openJob(p.jobId)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40">
                  <td className="px-4 py-3 text-slate-500">{p.at ? dtTh(p.at) : `กำหนด ${dateTh(p.due)}`}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
                      {p.dir === "out" ? <>CRM <Icon name="arrow_forward" style={{ fontSize: 15 }} /> {PARTY[p.party].label}</> : <>{PARTY[p.party].label} <Icon name="arrow_forward" style={{ fontSize: 15 }} /> CRM</>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{p.title}</td>
                  <td className="px-4 py-3"><div className="font-medium text-slate-900">{p.customer}</div><div className="text-[11px] text-slate-400">{p.jobId}</div></td>
                  <td className="px-4 py-3">
                    {p.state === "sent" && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">ส่งแล้ว</span>}
                    {p.state === "received" && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">รับแล้ว</span>}
                    {p.state === "waiting" && <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", lateWd(p.due!) > 0 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700")}>รอ · {dueLabel(p.due!)}</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-slate-400">ไม่พบรายการ</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
