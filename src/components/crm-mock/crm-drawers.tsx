"use client";
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { DEALER_LOST, DEALER_STEP, DEALER_STORES, LEAD_STATUS, LOST_REASONS, MAX_CONTACT_TRIES, NOW, agoText, dtTh, slaHoursOf, type Lead, type Task } from "./crm-mock-data";
import { Avatar, Drawer, Field, KV, SlaBadge, btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";

/* ---------------- Lead ---------------- */
export function LeadDrawer({ lead, tasks, onClose, onPatch, onConvert, onConvertSurvey, toast }: {
  lead: Lead | null; tasks: Task[]; onClose: () => void; onPatch: (id: string, p: Partial<Lead>) => void; onConvert: (l: Lead) => void; onConvertSurvey: (l: Lead) => void; toast: (m: string) => void;
}) {
  return (
    <Drawer open={!!lead} onClose={onClose} title={lead?.name ?? ""} subtitle={lead ? `${lead.id} · ${lead.province}` : ""}>
      {lead && <LeadBody key={lead.id} lead={lead} task={tasks.find((t) => t.ref.id === lead.id)} onPatch={onPatch} onConvert={onConvert} onConvertSurvey={onConvertSurvey} toast={toast} />}
    </Drawer>
  );
}
function LeadBody({ lead, task, onPatch, onConvert, onConvertSurvey, toast }: { lead: Lead; task?: Task; onPatch: (id: string, p: Partial<Lead>) => void; onConvert: (l: Lead) => void; onConvertSurvey: (l: Lead) => void; toast: (m: string) => void }) {
  const [note, setNote] = useState(lead.note ?? "");
  const [checks, setChecks] = useState({ budget: false, area: false, ready: false });
  const [lost, setLost] = useState(false);
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [store, setStore] = useState(DEALER_STORES[0]);
  const [amount, setAmount] = useState("");
  const [dReason, setDReason] = useState(DEALER_LOST[0]);
  const allOk = checks.budget && checks.area && checks.ready;
  const open = lead.status === "waiting" || lead.status === "contacting" || lead.status === "qualified";
  const tries = lead.tries ?? 0;
  const failContact = () => {
    const n = tries + 1;
    const lose = n >= MAX_CONTACT_TRIES;
    onPatch(lead.id, {
      tries: n, firstContactAt: lead.firstContactAt ?? NOW.toISOString(), note,
      status: lose ? "lost" : lead.status === "waiting" ? "contacting" : lead.status,
      lostReason: lose ? `ติดต่อไม่ได้ครบ ${MAX_CONTACT_TRIES} ครั้ง` : lead.lostReason,
    });
    toast(lose ? `ติดต่อไม่ได้ครบ ${MAX_CONTACT_TRIES} ครั้ง ปิดเป็น Loss` : `บันทึกติดต่อไม่ได้ครั้งที่ ${n}/${MAX_CONTACT_TRIES}`);
  };
  const logContact = () => {
    onPatch(lead.id, { firstContactAt: lead.firstContactAt ?? NOW.toISOString(), status: lead.status === "waiting" ? "contacting" : lead.status, note });
    toast("บันทึกการติดต่อแล้ว");
  };
  return (
    <>
      <div className={cn(glass, "flex items-center gap-3 p-4")}>
        <Avatar name={lead.name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-900">{lead.name}</div>
          <div className="text-[12px] text-slate-500">{lead.phone}</div>
        </div>
        <button onClick={() => toast(`กำลังโทร ${lead.phone} (ตัวอย่าง)`)} className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><Icon name="call" /></button>
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
        <KV k="สนใจ" v={lead.product} />
        <KV k="ช่องทาง" v={lead.channel} />
        <KV k="เข้ามาเมื่อ" v={`${dtTh(lead.createdAt)} (${agoText(lead.createdAt)})`} />
        <KV k="ติดต่อครั้งแรก" v={lead.firstContactAt ? dtTh(lead.firstContactAt) : "ยังไม่ติดต่อ"} />
        <KV k="SLA" v={<span className="flex items-center justify-end gap-2"><span className="text-[11px] text-slate-400">เป้า {slaHoursOf(lead.channel)} ชม.</span><SlaBadge lead={lead} /></span>} />
        {lead.interest && <KV k="ความต้องการ" v={lead.interest} />}
        {lead.dealerStore && <KV k="ร้านที่รับ" v={lead.dealerStore} />}
        {lead.dealerStep && <KV k="สถานะที่ร้านแจ้ง" v={<span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", DEALER_STEP[lead.dealerStep].cls)}>{DEALER_STEP[lead.dealerStep].label}</span>} />}
        {lead.dealerAmount !== undefined && <KV k="ยอดใบเสนอราคาร้าน" v={`฿${lead.dealerAmount.toLocaleString("en-US")}`} />}
        {lead.lostReason && <KV k="เหตุผล Loss" v={lead.lostReason} />}
      </div>

      {open && (
        <div className={cn(glass, "space-y-3 p-4")}>
          <h3 className="text-[13px] font-bold text-slate-900">สกรีน Lead</h3>
          {([["budget", "งบประมาณตรงกับที่รับงาน"], ["area", "หน้างานอยู่ในพื้นที่บริการ"], ["ready", "ลูกค้าพร้อมให้ทีมเข้าสำรวจ/ออกแบบ"]] as const).map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-slate-700">
              <input type="checkbox" checked={checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} className="h-4 w-4 accent-indigo-600" />{label}
            </label>
          ))}
          <Field label="บันทึกการคุย"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputCls} placeholder="สรุปสิ่งที่คุยกับลูกค้า" /></Field>
          {allOk && lead.status !== "qualified" && <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700"><Icon name="check_circle" style={{ fontSize: 16 }} />ผ่านครบทุกเงื่อนไข น้องเลขาแนะนำให้เปิด Opp ได้เลย</p>}
          {lost && (
            <Field label="เหตุผลที่ Loss">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
          )}
        </div>
      )}

      {open && (
        <div className={cn(glass, "space-y-3 p-4")}>
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900"><Icon name="storefront" style={{ fontSize: 18 }} />ลูกค้าสนใจเฉพาะสินค้า ไม่ต้องการแบบ</h3>
          <p className="text-[12px] text-slate-500">ส่งให้ร้านทำใบเสนอราคาในระบบร้าน แล้วร้านจะส่งสถานะและผล Win / Loss กลับมาที่นี่</p>
          <div className="flex flex-wrap gap-2">
            <select value={store} onChange={(e) => setStore(e.target.value)} className={cn(inputCls, "w-auto")}>{DEALER_STORES.map((s) => <option key={s}>{s}</option>)}</select>
            <button onClick={() => { onPatch(lead.id, { status: "dealer", dealerStep: "sent", dealerStore: store, sentAt: NOW.toISOString(), note, firstContactAt: lead.firstContactAt ?? NOW.toISOString() }); toast(`ส่งให้ ${store} แล้ว`); }} className={btnGhost}><Icon name="send" style={{ fontSize: 18 }} />ส่งให้ร้าน</button>
          </div>
        </div>
      )}

      {lead.status === "dealer" && lead.dealerStep && lead.dealerStep !== "won" && (
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

      {open && (
        <div className="flex flex-wrap gap-2 pb-2">
          <button onClick={failContact} className={btnGhost}><Icon name="phone_missed" style={{ fontSize: 18 }} />ติดต่อไม่ได้ ({tries}/{MAX_CONTACT_TRIES})</button>
          <button onClick={logContact} className={btnGhost}><Icon name="edit_note" style={{ fontSize: 18 }} />บันทึกการติดต่อ</button>
          {allOk && lead.status !== "qualified" && <button onClick={() => { onPatch(lead.id, { status: "qualified", note, firstContactAt: lead.firstContactAt ?? NOW.toISOString() }); toast("ผ่านการสกรีน รอเปิด Opp"); }} className={btnGhost}>ผ่านเงื่อนไข</button>}
          <button onClick={() => onConvert({ ...lead, note })} className={btnPrimary}><Icon name="rocket_launch" style={{ fontSize: 18 }} />เปิด Opp (มีแบบ)</button>
          <button onClick={() => onConvertSurvey({ ...lead, note })} className={btnGhost}><Icon name="pin_drop" style={{ fontSize: 18 }} />เปิด Opp สำรวจ</button>
          {!lost ? <button onClick={() => setLost(true)} className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-rose-600 hover:bg-rose-50">Loss</button>
            : <button onClick={() => { onPatch(lead.id, { status: "lost", lostReason: reason, note, firstContactAt: lead.firstContactAt }); toast("บันทึก Loss แล้ว"); }} className="rounded-xl bg-rose-600 px-3.5 py-2.5 text-[13px] font-bold text-white">ยืนยัน Loss</button>}
        </div>
      )}
    </>
  );
}
