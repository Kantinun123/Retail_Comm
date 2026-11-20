"use client";
/* ชิ้นส่วน UI ที่ใช้ร่วมกันในหน้า BOQ DECAAR */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { doLogout, useSession } from "@/lib/commission/session";
import { STATUS_META, STEPS, uploadBoqFile, type BoqFileKind, type BoqStatus, type UploadedFile } from "@/lib/commission/boq-store";

export const card = "rounded-2xl bg-white border border-slate-200 shadow-sm";
export const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#d32029] focus:ring-2 focus:ring-red-100";
export const labelCls = "block text-[11px] font-semibold text-slate-600 mb-1";
export const btn = "rounded-xl px-4 py-2.5 text-[13px] font-bold active:scale-[0.99] transition disabled:opacity-40";

export function StatusPill({ status, className }: { status: BoqStatus; className?: string }) {
  const m = STATUS_META[status];
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", m.cls, className)}>{m.label}</span>;
}

export function Chips({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "px-3 py-2 rounded-xl border text-[12px] font-medium transition",
            value === o.key ? "border-[#d32029] bg-red-50 text-[#b0141c]" : "border-slate-200 bg-white text-slate-600"
          )}
        >
          {value === o.key && <Icon name="check" className="mr-1 align-[-3px]" style={{ fontSize: 15 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** invalid = กรอบแดง + ข้อความ "กรุณากรอก…" (ใช้หลังกดส่งแล้วยังขาดข้อมูล) ; data-invalid ไว้เลื่อนไปจุดแรกที่ขาด */
export function Section({ no, title, children, hint, invalid, invalidText }: { no?: string; title: string; children: React.ReactNode; hint?: string; invalid?: boolean; invalidText?: string }) {
  return (
    <section data-invalid={invalid ? "1" : undefined} className={cn(card, "p-4 space-y-3 transition-colors", invalid && "border-red-400 ring-2 ring-red-100")}>
      <div>
        <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
          {no && <span className="min-w-6 h-6 px-1 rounded-full bg-[#d32029] text-white text-[11px] grid place-items-center">{no}</span>}
          {title}
        </h2>
        {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
        {invalid && <p className="text-[11px] font-semibold text-red-600 mt-1">{invalidText ?? "กรุณากรอกข้อมูลในส่วนนี้"}</p>}
      </div>
      {children}
    </section>
  );
}
/** class เพิ่มให้ช่อง input ที่ขาดข้อมูล */
export const badCls = "border-red-400 bg-red-50/40 ring-2 ring-red-100";

export function Stepper({ status }: { status: BoqStatus }) {
  const done = status === "win" || status === "loss";
  const idx = STEPS.findIndex((s) => s.match.includes(status));
  if (status === "cancelled") return <p className="text-[12px] text-slate-500">คำขอนี้ถูกยกเลิกแล้ว</p>;
  return (
    <div className="flex items-start">
      {STEPS.map((s, i) => {
        const passed = i < idx || done;
        const active = i === idx && !done;
        return (
          <div key={s.label} className="flex-1 flex flex-col items-center relative">
            {i > 0 && <span className={cn("absolute top-3 right-1/2 w-full h-0.5", i <= idx ? "bg-[#d32029]" : "bg-slate-200")} />}
            <span
              className={cn(
                "relative z-10 w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold",
                passed ? "bg-[#d32029] text-white" : active ? "bg-white border-2 border-[#d32029] text-[#d32029]" : "bg-slate-200 text-slate-500"
              )}
            >
              {passed ? <Icon name="check" style={{ fontSize: 14 }} /> : i + 1}
            </span>
            <span className={cn("text-[9px] mt-1 text-center leading-tight", active ? "text-[#d32029] font-bold" : "text-slate-500")}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** เลือกไฟล์ + อัปโหลดทันที (แสดงสถานะรายไฟล์) */
export function FileUploader({
  kind,
  requestId,
  label,
  hint,
  accept,
  files,
  onChange,
  onBusy,
}: {
  kind: BoqFileKind;
  requestId?: number;
  label: string;
  hint: string;
  accept: string;
  files: UploadedFile[];
  onChange: (f: UploadedFile[]) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const pick = async (list: FileList | null) => {
    const arr = Array.from(list ?? []);
    if (!arr.length) return;
    setErr("");
    setBusy((n) => n + arr.length);
    onBusy?.(true);
    const added: UploadedFile[] = [];
    for (const f of arr) {
      try {
        added.push(await uploadBoqFile(f, kind, requestId));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    onBusy?.(false);
    onChange([...files, ...added]);
  };
  return (
    <div>
      <label className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-5 cursor-pointer hover:border-[#d32029]">
        <Icon name={busy ? "progress_activity" : "upload_file"} className={cn("text-slate-400", busy && "animate-spin")} style={{ fontSize: 28 }} />
        <span className="text-[12px] font-semibold text-slate-600">{busy ? `กำลังอัปโหลด ${busy} ไฟล์...` : label}</span>
        <span className="text-[10px] text-slate-400">{hint}</span>
        <input type="file" multiple accept={accept} className="hidden" disabled={busy > 0} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
      </label>
      {err && <p className="text-[11px] text-red-600 mt-1.5">{err}</p>}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={f.path} className="flex items-center gap-2 text-[12px] text-slate-700 bg-white rounded-lg border border-slate-200 px-3 py-1.5">
              <Icon name={f.mime === "application/pdf" ? "picture_as_pdf" : f.mime.startsWith("image/") ? "image" : "description"} className="text-emerald-600" style={{ fontSize: 16 }} />
              <span className="flex-1 truncate">{f.name}</span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600" aria-label="ลบไฟล์">
                <Icon name="close" style={{ fontSize: 16 }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** หัวหน้าจอ BOQ (มีปุ่มกลับ หรือปุ่มออกจากระบบสำหรับห้องแบบ/Marketing) */
export function BoqHeader({ title, sub, back }: { title: string; sub?: string; back?: string }) {
  const router = useRouter();
  const { session } = useSession();
  const teamOnly = session?.role === "designer" || session?.role === "marketing";
  return (
    <header className="flex items-center justify-between gap-2 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
      <div className="flex items-center gap-2 min-w-0">
        {back && (
          <Link href={back} className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="กลับ">
            <Icon name="arrow_back" style={{ fontSize: 18 }} />
          </Link>
        )}
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 leading-tight">BOQ สินค้า DECAAR</p>
          <h1 className="font-bold text-[16px] text-[#231313] leading-tight truncate">{title}</h1>
          {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
        </div>
      </div>
      {teamOnly && !back && (
        <button
          type="button"
          onClick={() => { doLogout(); router.replace("/"); }}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full shrink-0"
        >
          <Icon name="logout" style={{ fontSize: 16 }} />
          ออกจากระบบ
        </button>
      )}
    </header>
  );
}

export function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-[12px] py-1">
      <span className="text-slate-500 shrink-0">{k}</span>
      <span className="text-slate-800 font-medium text-right break-words min-w-0">{v}</span>
    </div>
  );
}
