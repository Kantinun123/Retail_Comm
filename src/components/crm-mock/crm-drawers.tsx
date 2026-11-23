"use client";
import { useState } from "react";
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { LEAD_STATUS, LOST_REASONS, NOW, agoText, dtTh, type Lead, type Task } from "./crm-mock-data";
import { Avatar, Drawer, Field, KV, SlaBadge, btnGhost, btnPrimary, glass, inputCls } from "./crm-ui";

/* ---------------- Lead ---------------- */
export function LeadDrawer({ lead, tasks, onClose, onPatch, onConvert, toast }: {
  lead: Lead | null; tasks: Task[]; onClose: () => void; onPatch: (id: string, p: Partial<Lead>) => void; onConvert: (l: Lead) => void; toast: (m: string) => void;
}) {
  return (
    <Drawer open={!!lead} onClose={onClose} title={lead?.name ?? ""} subtitle={lead ? `${lead.id} · ${lead.province}` : ""}>
      {lead && <LeadBody key={lead.id} lead={lead} task={tasks.find((t) => t.ref.id === lead.id)} onPatch={onPatch} onConvert={onConvert} toast={toast} />}
    </Drawer>
  );
}
function LeadBody({ lead, task, onPatch, onConvert, toast }: { lead: Lead; task?: Task; onPatch: (id: string, p: Partial<Lead>) => void; onConvert: (l: Lead) => void; toast: (m: string) => void }) {
  const [note, setNote] = useState(lead.note ?? "");
  const [checks, setChecks] = useState({ budget: false, area: false, ready: false });
  const [lost, setLost] = useState(false);
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const allOk = checks.budget && checks.area && checks.ready;
  const open = lead.status === "waiting" || lead.status === "contacting" || lead.status === "qualified";
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
        <KV k="SLA" v={<SlaBadge lead={lead} />} />
        {lead.interest && <KV k="ความต้องการ" v={lead.interest} />}
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
          {allOk && lead.status !== "qualified" && <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700"><Icon name="check_circle" style={{ fontSize: 16 }} />ผ่านครบทุกเงื่อนไข น้องเลขาแนะนำให้เปิด Ops ได้เลย</p>}
          {lost && (
            <Field label="เหตุผลที่ Loss">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
          )}
        </div>
      )}

      {open && (
        <div className="flex flex-wrap gap-2 pb-2">
          <button onClick={logContact} className={btnGhost}><Icon name="edit_note" style={{ fontSize: 18 }} />บันทึกการติดต่อ</button>
          {allOk && lead.status !== "qualified" && <button onClick={() => { onPatch(lead.id, { status: "qualified", note, firstContactAt: lead.firstContactAt ?? NOW.toISOString() }); toast("ผ่านการสกรีน รอเปิด Ops"); }} className={btnGhost}>ผ่านเงื่อนไข</button>}
          <button onClick={() => onConvert({ ...lead, note })} className={btnPrimary}><Icon name="rocket_launch" style={{ fontSize: 18 }} />เปิด Ops</button>
          {!lost ? <button onClick={() => setLost(true)} className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-rose-600 hover:bg-rose-50">Loss</button>
            : <button onClick={() => { onPatch(lead.id, { status: "lost", lostReason: reason, note, firstContactAt: lead.firstContactAt }); toast("บันทึก Loss แล้ว"); }} className="rounded-xl bg-rose-600 px-3.5 py-2.5 text-[13px] font-bold text-white">ยืนยัน Loss</button>}
        </div>
      )}
    </>
  );
}
