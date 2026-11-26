"use client";
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import {
  CONTACT_CHANNELS, CONTACT_OUTCOMES, DEALER_LOST, DEALER_STEP, DEALER_STORES, LEAD_STATUS, LOST_REASONS, MAX_CONTACT_TRIES, NOW,
  agoText, cleanInterests, dtTh, interestSummary, interestText, slaHoursOf, suggestRoute, trailingMisses,
  type ContactLog, type Interest, type Lead, type Task,
} from "./crm-mock-data";
import { InterestChips, InterestEditor } from "./crm-interests";
import { NextBanner, Stepper, Tip, leadGuide, leadScripts, scrollToId, useGuideOn } from "./crm-guide";
import { Avatar, Drawer, Field, KV, SlaBadge, btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";

/* ---------------- Lead ---------------- */
export function LeadDrawer({ lead, tasks, onClose, onPatch, onConvert, onConvertSurvey, isDealerView, me, toast }: {
  lead: Lead | null; tasks: Task[]; onClose: () => void; onPatch: (id: string, p: Partial<Lead>) => void; onConvert: (l: Lead) => void; onConvertSurvey: (l: Lead) => void; isDealerView?: boolean; me: string; toast: (m: string) => void;
}) {
  return (
    <Drawer open={!!lead} onClose={onClose} wide title={lead?.name ?? ""} subtitle={lead ? `${lead.id} · ${lead.province}` : ""}>
      {lead && <LeadBody key={lead.id} lead={lead} task={tasks.find((t) => t.ref.id === lead.id)} onPatch={onPatch} onConvert={onConvert} onConvertSurvey={onConvertSurvey} isDealerView={isDealerView} me={me} toast={toast} />}
    </Drawer>
  );
}

const OUTCOME_CLS: Record<ContactLog["outcome"], string> = {
  "คุยได้": "bg-emerald-50 text-emerald-700", "ไม่รับสาย": "bg-rose-50 text-rose-700", "นัดหมาย": "bg-sky-50 text-sky-700", "ขอเวลาคิด": "bg-amber-50 text-amber-700", "ปฏิเสธ": "bg-slate-200 text-slate-700",
};
const CHANNEL_ICON: Record<ContactLog["channel"], string> = { "โทร": "call", "LINE": "chat", "เข้าร้าน": "storefront", "อื่นๆ": "more_horiz" };

function LeadBody({ lead, task, onPatch, onConvert, onConvertSurvey, isDealerView, me, toast }: {
  lead: Lead; task?: Task; onPatch: (id: string, p: Partial<Lead>) => void; onConvert: (l: Lead) => void; onConvertSurvey: (l: Lead) => void; isDealerView?: boolean; me: string; toast: (m: string) => void;
}) {
  const [checks, setChecks] = useState({ budget: false, area: false, ready: false });
  const [lost, setLost] = useState(false);
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [store, setStore] = useState(DEALER_STORES[0]);
  const [amount, setAmount] = useState("");
  const [dReason, setDReason] = useState(DEALER_LOST[0]);
  const [dAmount, setDAmount] = useState("");
  /* ทวนความต้องการ */
  const [editing, setEditing] = useState(cleanInterests(lead.interests).length === 0);
  const [draft, setDraft] = useState<Interest[]>(lead.interests ?? []);
  /* บันทึกการติดต่อ */
  const [cChannel, setCChannel] = useState<ContactLog["channel"]>("โทร");
  const [cOutcome, setCOutcome] = useState<ContactLog["outcome"]>("คุยได้");
  const [cNote, setCNote] = useState("");
  const [cNext, setCNext] = useState("");
  const guide = useGuideOn();
  const [skipped, setSkipped] = useState<number[]>([]);
  const [warn, setWarn] = useState<null | "opp" | "survey">(null);

  const allOk = checks.budget && checks.area && checks.ready;
  const open = lead.status === "waiting" || lead.status === "contacting" || lead.status === "qualified";
  const misses = trailingMisses(lead.contacts);
  const saved = cleanInterests(lead.interests);
  const draftClean = cleanInterests(draft);
  const changed = JSON.stringify(draftClean) !== JSON.stringify(saved);
  const route = suggestRoute(editing ? draftClean : saved);
  const g = guide && open ? leadGuide(lead, { allOk, skipped }) : null;
  const doConvert = (k: "opp" | "survey") => (k === "opp" ? onConvert({ ...lead, interest: interestText(lead) }) : onConvertSurvey({ ...lead, interest: interestText(lead) }));
  const tryConvert = (k: "opp" | "survey") => (guide && !lead.reviewed ? setWarn(k) : doConvert(k));
  const onGuideCta = (t: string) => {
    if (t === "opp") tryConvert("opp");
    else if (t.startsWith("id:")) scrollToId(t.slice(3));
  };

  const saveReview = () => {
    const at = NOW.toISOString();
    const edited = changed || !!lead.reviewed?.edited;
    onPatch(lead.id, {
      interests: draftClean, product: interestSummary(draftClean) || lead.product,
      reviewed: { at, by: me, edited, original: edited ? lead.reviewed?.original ?? saved : undefined },
    });
    setEditing(false);
    toast(changed ? "บันทึกการทวนความต้องการ (แก้ไขจากที่ลูกค้าเลือก)" : "ยืนยันความต้องการตามที่ลูกค้าเลือกแล้ว");
  };

  const addContact = (e: { channel: ContactLog["channel"]; outcome: ContactLog["outcome"]; note: string; nextAt?: string }) => {
    const at = NOW.toISOString();
    const entry: ContactLog = { id: `${lead.id}-C${(lead.contacts?.length ?? 0) + 1}`, at, by: me, ...e };
    const contacts = [...(lead.contacts ?? []), entry];
    const m = trailingMisses(contacts);
    const lose = m >= MAX_CONTACT_TRIES;
    onPatch(lead.id, {
      contacts, tries: m, firstContactAt: lead.firstContactAt ?? at, nextFollowAt: entry.nextAt,
      status: lose ? "lost" : lead.status === "waiting" ? "contacting" : lead.status,
      lostReason: lose ? `ไม่รับสายครบ ${MAX_CONTACT_TRIES} ครั้ง` : lead.lostReason,
    });
    toast(lose ? `ไม่รับสายครบ ${MAX_CONTACT_TRIES} ครั้ง ปิดเป็น Loss` : e.outcome === "ไม่รับสาย" ? `บันทึกไม่รับสาย ครั้งที่ ${m}/${MAX_CONTACT_TRIES}` : "บันทึกการติดต่อแล้ว");
  };
  const submitContact = () => {
    if (!cNote.trim()) { toast("ใส่สรุปสิ่งที่คุยกับลูกค้าก่อนบันทึก"); return; }
    addContact({ channel: cChannel, outcome: cOutcome, note: cNote.trim(), nextAt: cNext ? new Date(`${cNext}:00+07:00`).toISOString() : undefined });
    setCNote(""); setCNext(""); setCOutcome("คุยได้");
  };

  const timeline = [...(lead.contacts ?? [])].reverse();

  return (
    <>
      {g && (
        <div className="space-y-4">
          <Stepper at={g.at} />
          <NextBanner b={g.banner} scripts={leadScripts(lead)} onCta={onGuideCta} onSkip={() => setSkipped([...skipped, g.at])} toast={toast} />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className={cn(glass, "flex items-center gap-3 p-4")}>
            <Avatar name={lead.name} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-slate-900">{lead.name}</div>
              <div className="text-[12px] text-slate-500">{lead.phone}</div>
            </div>
            <button onClick={() => toast(`กำลังโทร ${lead.phone} (ตัวอย่าง) แล้วอย่าลืมบันทึกการติดต่อ`)} className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><Icon name="call" /></button>
          </div>

          {task && (
            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
              <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-violet-700"><Icon name="auto_awesome" style={{ fontSize: 16 }} />น้องเลขาแนะนำ</div>
              <p className="text-[12.5px] text-slate-700">{task.reason}</p>
              {task.draft && <p className="mt-2 rounded-xl bg-white/80 p-3 text-[12px] leading-relaxed text-slate-600">{task.draft}</p>}
            </div>
          )}

          <div className={cn(glass, "p-4")}>
            <KV k="สถานะ" v={<span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", LEAD_STATUS[lead.status].cls)}>{LEAD_STATUS[lead.status].label}</span>} />
            <KV k="ช่องทาง" v={lead.channel} />
            <KV k="เข้ามาเมื่อ" v={`${dtTh(lead.createdAt)} (${agoText(lead.createdAt)})`} />
            <KV k="ติดต่อครั้งแรก" v={lead.firstContactAt ? dtTh(lead.firstContactAt) : "ยังไม่ติดต่อ"} />
            <KV k="SLA" v={<span className="flex items-center justify-end gap-2"><span className="text-[11px] text-slate-400">เป้า {slaHoursOf(lead.channel)} ชม.</span><SlaBadge lead={lead} /></span>} />
            {lead.nextFollowAt && open && <KV k="นัดติดตามถัดไป" v={<span className="font-semibold text-sky-700">{dtTh(lead.nextFollowAt)}</span>} />}
            {lead.interest && <KV k="หมายเหตุความต้องการ" v={lead.interest} />}
            {lead.dealerStore && <KV k="ร้านที่รับ" v={lead.dealerStore} />}
            {lead.dealerStep && <KV k="สถานะที่ร้านแจ้ง" v={<span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", DEALER_STEP[lead.dealerStep].cls)}>{DEALER_STEP[lead.dealerStep].label}</span>} />}
            {lead.dealerAmount !== undefined && <KV k="ยอดใบเสนอราคาร้าน" v={`฿${lead.dealerAmount.toLocaleString("en-US")}`} />}
            {lead.lostReason && <KV k="เหตุผล Loss" v={lead.lostReason} />}
          </div>

          {/* ความสนใจ + ทวนความต้องการ */}
          <div id="lead-interest" className={cn(glass, "space-y-3 p-4", g && g.at === 2 && "ring-2 ring-indigo-400 ring-offset-2")}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-bold text-slate-900">ความสนใจของลูกค้า</h3>
              {lead.source === "customer" && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-semibold text-sky-700"><Icon name="language" style={{ fontSize: 12 }} />ลูกค้าเลือกเอง (เว็บ)</span>}
              {lead.source === "staff" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">พนักงานคีย์</span>}
              {lead.reviewed
                ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700"><Icon name="task_alt" style={{ fontSize: 12 }} />ทวนแล้ว · {lead.reviewed.by} · {dtTh(lead.reviewed.at)}</span>
                : open && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">ยังไม่ได้ทวนความต้องการ</span>}
            </div>
            {!editing ? (
              <>
                <InterestChips list={saved} fallback="ยังไม่มีข้อมูลความสนใจ" />
                {lead.reviewed?.edited && lead.reviewed.original && lead.reviewed.original.length > 0 && (
                  <div className="rounded-xl bg-amber-50/70 p-2.5">
                    <div className="mb-1 text-[11px] font-semibold text-amber-800">ลูกค้าเลือกไว้เดิม (ก่อนทีมขายแก้ไขหลังทวน)</div>
                    <InterestChips list={lead.reviewed.original} />
                  </div>
                )}
                {open && (
                  <div className="flex flex-wrap gap-2">
                    {!lead.reviewed && saved.length > 0 && <button onClick={saveReview} className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />ยืนยันตามที่ลูกค้าเลือก</button>}
                    <button onClick={() => { setDraft(lead.interests ?? []); setEditing(true); }} className={btnGhost}><Icon name="edit" style={{ fontSize: 18 }} />{saved.length ? "แก้ไขรายการ" : "เพิ่มความสนใจ"}</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-[12px] text-slate-500">ทวนกับลูกค้าแล้วปรับรายการให้ตรงกับที่ลูกค้าต้องการจริง</p>
                <InterestEditor kind="service" value={draft} onChange={setDraft} />
                <InterestEditor kind="product" value={draft} onChange={setDraft} />
                <div className="flex flex-wrap gap-2">
                  <button onClick={saveReview} className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />{changed ? "บันทึกและยืนยันความต้องการ" : "ยืนยันความต้องการ"}</button>
                  {saved.length > 0 && <button onClick={() => { setDraft(lead.interests ?? []); setEditing(false); }} className={btnGhost}>ยกเลิก</button>}
                </div>
              </>
            )}
            {open && route !== "none" && (
              <p className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px]", route === "solution" ? "bg-indigo-50 text-indigo-800" : "bg-fuchsia-50 text-fuchsia-800")}>
                <Icon name="alt_route" style={{ fontSize: 16 }} />{route === "solution" ? "ระบบแนะนำ: เปิด Opp (มีงานบริการ)" : "ระบบแนะนำ: ส่งให้ร้านทำใบเสนอราคา (สินค้าอย่างเดียว) ถ้าลูกค้าต้องการแบบ ให้เปิด Opp"}
              </p>
            )}
          </div>

          {open && (
            <div id="lead-screen" className={cn(glass, "space-y-3 p-4", g && g.at === 3 && "ring-2 ring-indigo-400 ring-offset-2")}>
              <h3 className="text-[13px] font-bold text-slate-900">สกรีน Lead</h3>
              {([["budget", "งบประมาณตรงกับที่รับงาน"], ["area", "หน้างานอยู่ในพื้นที่บริการ"], ["ready", "ลูกค้าพร้อมให้ทีมเข้าสำรวจ/ออกแบบ"]] as const).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-slate-700">
                  <input type="checkbox" checked={checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} className="h-4 w-4 accent-indigo-600" />{label}
                </label>
              ))}
              <Tip>ติ๊กหลังคุยกับลูกค้าแล้วเท่านั้น ผ่านครบ 3 ข้อระบบจะแนะนำให้เปิด Opp</Tip>
              {allOk && lead.status !== "qualified" && <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700"><Icon name="check_circle" style={{ fontSize: 16 }} />ผ่านครบทุกเงื่อนไข น้องเลขาแนะนำให้เปิด Opp ได้เลย</p>}
              {lost && (
                <Field label="เหตุผลที่ Loss">
                  <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
                </Field>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {isDealerView && lead.status === "dealer" && (
            <div className="space-y-3 rounded-2xl border border-fuchsia-300 bg-fuchsia-50/60 p-4">
              <h3 className="text-[13px] font-bold text-fuchsia-800">ตอบกลับ SE (มุมมองร้านค้า)</h3>
              {lead.dealerStep === "sent" && (
                <button onClick={() => { onPatch(lead.id, { dealerStep: "accepted" }); toast("รับ Lead แล้ว SE รับทราบ"); }} className={btnPrimary}><Icon name="check_circle" style={{ fontSize: 18 }} />รับ Lead</button>
              )}
              {(lead.dealerStep === "sent" || lead.dealerStep === "accepted") && (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={dAmount} onChange={(e) => setDAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="ยอดใบเสนอราคา" className={cn(inputCls, "w-44")} />
                  <button disabled={!dAmount} onClick={() => { onPatch(lead.id, { dealerStep: "quoted", dealerAmount: Number(dAmount) }); toast("เสนอราคาแล้ว SE รับทราบ"); }} className={cn(btnGhost, !dAmount && "opacity-50")}>ส่งใบเสนอราคา</button>
                </div>
              )}
              {lead.dealerStep === "quoted" && (
                <button onClick={() => { onPatch(lead.id, { dealerStep: "won" }); toast("ปิดขายแล้ว Lead = Won"); }} className={btnPrimary}><Icon name="verified" style={{ fontSize: 18 }} />ปิดขาย (Win)</button>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select value={dReason} onChange={(e) => setDReason(e.target.value)} className={cn(inputCls, "w-auto max-w-full")}>{DEALER_LOST.map((r) => <option key={r}>{r}</option>)}</select>
                <button onClick={() => { onPatch(lead.id, { status: "lost", dealerStep: "lost", lostReason: `Lost - ${dReason}` }); toast("แจ้ง Loss แล้ว"); }} className="rounded-xl bg-rose-600 px-3.5 py-2.5 text-[13px] font-bold text-white">แจ้ง Loss</button>
              </div>
            </div>
          )}

          {/* บันทึกการติดต่อ */}
          <div id="lead-contact" className={cn(glass, "space-y-3 p-4", g && g.at === 1 && "ring-2 ring-indigo-400 ring-offset-2")}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-bold text-slate-900">บันทึกการติดต่อ</h3>
              <span className="text-[11px] text-slate-400">{lead.contacts?.length ?? 0} ครั้ง</span>
              {misses > 0 && open && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-700">ไม่รับสายติดกัน {misses}/{MAX_CONTACT_TRIES}</span>}
            </div>
            {open && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white/80 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="ช่องทางที่ติดต่อ"><select value={cChannel} onChange={(e) => setCChannel(e.target.value as ContactLog["channel"])} className={inputCls}>{CONTACT_CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <Field label="ผลการติดต่อ"><select value={cOutcome} onChange={(e) => setCOutcome(e.target.value as ContactLog["outcome"])} className={inputCls}>{CONTACT_OUTCOMES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                </div>
                <Field label="สรุปสิ่งที่คุย"><textarea value={cNote} onChange={(e) => setCNote(e.target.value)} rows={3} className={inputCls} placeholder="เช่น ลูกค้าอยากเปลี่ยนกระเบื้องเป็นสีเทา ขอเทียบราคา" /></Field>
                <Tip>เขียนให้เพื่อนร่วมทีมอ่านแล้วรู้เรื่อง: ลูกค้าต้องการอะไร ติดอะไรอยู่ และจะทำอะไรต่อ</Tip>
                <Field label="นัดติดตามครั้งต่อไป (ถ้ามี)"><input type="datetime-local" value={cNext} onChange={(e) => setCNext(e.target.value)} className={inputCls} /></Field>
                <Tip>ลูกค้าบอกว่า &ldquo;ขอคิดก่อน&rdquo; ให้ตั้งวันนัดติดตามเสมอ ระบบจะนับในแถบ นัดติดตามวันนี้</Tip>
                <div className="flex flex-wrap gap-2">
                  <button onClick={submitContact} className={btnPrimary}><Icon name="edit_note" style={{ fontSize: 18 }} />บันทึกการติดต่อ</button>
                  <button onClick={() => addContact({ channel: "โทร", outcome: "ไม่รับสาย", note: "โทรแล้วไม่รับสาย" })} className={btnGhost}><Icon name="phone_missed" style={{ fontSize: 18 }} />โทรแล้วไม่รับสาย</button>
                </div>
              </div>
            )}
            <ol>
              {timeline.map((c, i) => (
                <li key={c.id} className="relative flex gap-3 pb-4">
                  <span className="absolute left-[15px] top-8 h-[calc(100%-18px)] w-0.5 bg-slate-200" />
                  <span className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full", c.outcome === "ไม่รับสาย" ? "bg-rose-100 text-rose-600" : "bg-sky-100 text-sky-700")}><Icon name={CHANNEL_ICON[c.channel]} style={{ fontSize: 17 }} /></span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-slate-900">{c.channel}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", OUTCOME_CLS[c.outcome])}>{c.outcome}</span>
                      <span className="text-[11px] text-slate-400">{dtTh(c.at)} · {c.by}</span>
                      {i === 0 && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">ล่าสุด</span>}
                    </div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600">{c.note}</div>
                    {c.nextAt && <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700"><Icon name="event" style={{ fontSize: 14 }} />นัดติดตาม {dtTh(c.nextAt)}</div>}
                  </div>
                </li>
              ))}
              <li className="relative flex gap-3">
                <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"><Icon name="campaign" style={{ fontSize: 17 }} /></span>
                <div className="pt-1 text-[12px] text-slate-600"><span className="font-semibold text-slate-800">Lead เข้ามาทาง {lead.channel}</span> <span className="text-[11px] text-slate-400">{dtTh(lead.createdAt)}</span></div>
              </li>
            </ol>
          </div>

          {open && (
            <div id="lead-dealer" className={cn(glass, "space-y-3 p-4", g && g.at === 4 && suggestRoute(saved) === "product" && "ring-2 ring-indigo-400 ring-offset-2")}>
              <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="storefront" style={{ fontSize: 18 }} />ลูกค้าสนใจเฉพาะสินค้า ไม่ต้องการแบบ</h3>
              <p className="text-[12px] text-slate-500">ส่งให้ร้านทำใบเสนอราคาในระบบร้าน แล้วร้านจะส่งสถานะและผล Win / Loss กลับมาที่นี่</p>
              <div className="flex flex-wrap gap-2">
                <select value={store} onChange={(e) => setStore(e.target.value)} className={cn(inputCls, "w-auto")}>{DEALER_STORES.map((s) => <option key={s}>{s}</option>)}</select>
                <button onClick={() => { onPatch(lead.id, { status: "dealer", dealerStep: "sent", dealerStore: store, sentAt: NOW.toISOString(), firstContactAt: lead.firstContactAt ?? NOW.toISOString() }); toast(`ส่งให้ ${store} แล้ว`); }} className={btnGhost}><Icon name="send" style={{ fontSize: 18 }} />ส่งให้ร้าน</button>
              </div>
            </div>
          )}

          {lead.status === "dealer" && lead.dealerStep && lead.dealerStep !== "won" && !isDealerView && (
            <div className="space-y-3 rounded-2xl border border-dashed border-fuchsia-300 bg-fuchsia-50/50 p-4">
              <h3 className="text-[13px] font-bold text-fuchsia-800">จำลองร้านตอบกลับ (เดโม)</h3>
              <p className="text-[12px] text-slate-500">ของจริงข้อมูลนี้ส่งมาจากระบบร้านค้าเอง ตอนนี้กดจำลองเพื่อดูการเปลี่ยนสถานะ</p>
              <div className="flex flex-wrap items-center gap-2">
                {lead.dealerStep === "sent" && <button onClick={() => { onPatch(lead.id, { dealerStep: "accepted" }); toast("ร้านรับ Lead แล้ว"); }} className={btnGhost}>ร้านรับแล้ว</button>}
                {(lead.dealerStep === "sent" || lead.dealerStep === "accepted") && (
                  <>
                    <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="ยอดใบเสนอราคา" className={cn(inputCls, "w-40")} />
                    <button disabled={!amount} onClick={() => { onPatch(lead.id, { dealerStep: "quoted", dealerAmount: Number(amount) }); toast("ร้านเสนอราคาแล้ว"); }} className={cn(btnGhost, !amount && "opacity-50")}>ร้านเสนอราคา</button>
                  </>
                )}
                {lead.dealerStep === "quoted" && <button onClick={() => { onPatch(lead.id, { dealerStep: "won" }); toast("ร้านปิดขายแล้ว Lead = Won"); }} className={btnPrimary}>ร้านปิดขาย (Win)</button>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={dReason} onChange={(e) => setDReason(e.target.value)} className={cn(inputCls, "w-auto max-w-full")}>{DEALER_LOST.map((r) => <option key={r}>{r}</option>)}</select>
                <button onClick={() => { onPatch(lead.id, { status: "lost", dealerStep: "lost", lostReason: `Lost - ${dReason}` }); toast("ร้านแจ้ง Loss แล้ว"); }} className="rounded-xl bg-rose-600 px-3.5 py-2.5 text-[13px] font-bold text-white">ร้านแจ้ง Loss</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {open && !isDealerView && (
        <div className="flex flex-wrap gap-2 pb-2">
          {allOk && lead.status !== "qualified" && <button onClick={() => { onPatch(lead.id, { status: "qualified", firstContactAt: lead.firstContactAt ?? NOW.toISOString() }); toast("ผ่านการสกรีน รอเปิด Opp"); }} className={btnGhost}>ผ่านเงื่อนไข</button>}
          <button onClick={() => tryConvert("opp")} className={btnPrimary}><Icon name="rocket_launch" style={{ fontSize: 18 }} />เปิด Opp (มีแบบ)</button>
          <button onClick={() => tryConvert("survey")} className={btnGhost}><Icon name="pin_drop" style={{ fontSize: 18 }} />เปิด Opp สำรวจ</button>
          {!lost ? <button onClick={() => setLost(true)} className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-rose-600 hover:bg-rose-50">Loss</button>
            : <button onClick={() => { onPatch(lead.id, { status: "lost", lostReason: reason, firstContactAt: lead.firstContactAt }); toast("บันทึก Loss แล้ว"); }} className="rounded-xl bg-rose-600 px-3.5 py-2.5 text-[13px] font-bold text-white">ยืนยัน Loss</button>}
        </div>
      )}

      {warn && (
        <div className="fixed inset-0 z-[70] grid place-items-start bg-slate-900/40 px-4 pt-32 backdrop-blur-[2px]">
          <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-700"><Icon name="warning" /></span>ยังไม่ได้ทวนความต้องการ</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">
              {saved.length
                ? "เปิด Opp ตอนนี้ ใบเปิดงานจะใช้รายการที่ลูกค้าเลือกไว้เดิม ถ้าไม่ตรงกับที่ลูกค้าต้องการ ทีมห้องแบบและทีมสำรวจอาจเตรียมงานผิด"
                : "ยังไม่ได้เลือกความสนใจของลูกค้า ทีมถัดไปจะไม่รู้ว่าลูกค้าต้องการอะไร ควรถามลูกค้าแล้วเลือกรายการก่อน"}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button onClick={() => { const k = warn; setWarn(null); doConvert(k); }} className={btnGhost}>{warn === "opp" ? "เปิด Opp เลย" : "เปิด Opp สำรวจเลย"}</button>
              <button onClick={() => { setWarn(null); scrollToId("lead-interest"); }} className={btnPrimary}><Icon name="task_alt" style={{ fontSize: 18 }} />ไปทวนความต้องการก่อน</button>
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-400">เตือนเฉพาะตอนเปิดตัวช่วยแนะนำ ข้ามได้เสมอ</p>
          </div>
        </div>
      )}
    </>
  );
}
