"use client";

/* ศูนย์ข้อมูล > กลุ่ม Line ลูกค้า: ไฟล์ในระบบ + อัปโหลดไฟล์รายสัปดาห์ (ตรวจก่อนบันทึก) + คำนวณใหม่ */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

interface Counts { customers: number; register: number; not_register: number; no_bot: number; none: number }
interface Current extends Counts { computedAt: string; sourceDate: string | null; jobs: number }
interface FileInfo { name: string; rows: number; register: number; not_register: number; no_bot: number; uploadedAt: string; uploadedBy: string | null; latestGroup: string | null }
interface PreviewFile { name: string; status: "ok" | "warn" | "error"; messages: string[]; rows: number; replaces: boolean }
interface Preview { files: PreviewFile[]; before: Current | null; after: Counts & { jobs: number; sourceDate: string | null; missingCustomer: number } }

const MAX_BYTES = 4 * 1024 * 1024;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-");
const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");
const pct = (c: Counts) => (c.customers ? Math.round((c.register / c.customers) * 100) : 0);

async function post(body: FormData | object) {
  const res = await fetch("/api/admin/uploads/line-groups", body instanceof FormData ? { method: "POST", body } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => null);
  return j?.ok ? { ok: true as const, ...j } : { ok: false as const, error: (j?.error as string) ?? `ผิดพลาด (${res.status})` };
}

export function LineGroupsTab() {
  const [data, setData] = useState<{ v: number; files: FileInfo[]; current: Current | null; rudySyncedAt: string | null; error: string | null } | null>(null);
  const [version, setVersion] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<"select" | "checking" | "preview" | "saving">("select");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/uploads/line-groups", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => !cancelled && setData(j.ok ? { v: version, files: j.files, current: j.current, rudySyncedAt: j.rudySyncedAt, error: null } : { v: version, files: [], current: null, rudySyncedAt: null, error: j.error }))
      .catch((e) => !cancelled && setData({ v: version, files: [], current: null, rudySyncedAt: null, error: String(e) }));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const merged = [...files];
    [...list].filter((f) => /\.xlsx$/i.test(f.name)).forEach((f) => !merged.some((x) => x.name === f.name) && merged.push(f));
    setFiles(merged);
    setPreview(null);
    setStep("select");
    setMsg(null);
  };
  const total = files.reduce((s, f) => s + f.size, 0);

  async function send(mode: "preview" | "apply") {
    setMsg(null);
    setStep(mode === "preview" ? "checking" : "saving");
    const fd = new FormData();
    fd.set("mode", mode);
    files.forEach((f) => fd.append("files", f, f.name));
    const r = await post(fd);
    if (!r.ok) {
      setMsg({ type: "err", text: r.error });
      setStep(preview ? "preview" : "select");
      return;
    }
    if (mode === "preview") {
      setPreview(r.preview as Preview);
      setStep("preview");
    } else {
      setMsg({ type: "ok", text: `บันทึกแล้ว · ลูกค้า ${r.preview.after.customers} ราย ลงทะเบียน ${r.preview.after.register} (${pct(r.preview.after)}%)` });
      setFiles([]);
      setPreview(null);
      setStep("select");
      setVersion((v) => v + 1);
    }
  }

  async function action(kind: "remove" | "recompute", file?: string) {
    if (kind === "remove" && !window.confirm(`ลบไฟล์ "${file}" ออกจากระบบ แล้วคำนวณใหม่?`)) return;
    setBusy(file ?? kind);
    setMsg(null);
    const r = await post({ action: kind, file });
    setBusy(null);
    if (!r.ok) return setMsg({ type: "err", text: r.error });
    setMsg({ type: "ok", text: `${kind === "remove" ? `ลบ ${file} แล้ว` : "คำนวณใหม่แล้ว"} · ลูกค้า ${r.summary.customers} ราย ลงทะเบียน ${r.summary.register}` });
    setVersion((v) => v + 1);
  }

  const loading = !data || data.v !== version;
  const cur = data?.current ?? null;
  const working = step === "checking" || step === "saving";

  return (
    <div className="space-y-3">
      {msg && (
        <p className={cn("text-[12px] rounded-lg px-3 py-2 border", msg.type === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-[#a11119] border-red-200")} role="status">
          {msg.text}
        </p>
      )}

      {/* สรุปปัจจุบัน */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
            <Icon name="forum" style={{ fontSize: 17 }} className="text-emerald-600" />
            ติดตามกลุ่ม Line ลูกค้า
          </p>
          <Link href="/app/line-groups" className="text-[11.5px] font-bold text-blue-700 inline-flex items-center">
            เปิดหน้า <Icon name="chevron_right" style={{ fontSize: 16 }} />
          </Link>
        </div>
        {loading ? (
          <p className="text-[12px] text-slate-400 mt-2">กำลังโหลด…</p>
        ) : data?.error ? (
          <p className="text-[12px] text-[#a11119] mt-2">{data.error}</p>
        ) : cur ? (
          <>
            <p className="mt-1.5 text-[12px] text-slate-700">
              ลูกค้า <b className="tnum">{cur.customers}</b> ราย ({cur.jobs} งาน) · ลงทะเบียน <b className="tnum text-emerald-700">{cur.register}</b> ({pct(cur)}%) · ยังไม่ลงทะเบียน {cur.not_register} · ไม่ Add Bot {cur.no_bot} · ไม่มีข้อมูล {cur.none}
            </p>
            <p className="text-[10.5px] text-slate-400 mt-1">
              คำนวณล่าสุด {fmt(cur.computedAt)} · กลุ่ม Line ล่าสุด {fmtDate(cur.sourceDate)} · ลูกค้างาน Rudy {fmt(data?.rudySyncedAt ?? null)}
            </p>
          </>
        ) : (
          <p className="text-[12px] text-slate-500 mt-2">ยังไม่มีข้อมูล</p>
        )}
        <button type="button" disabled={busy === "recompute" || loading} onClick={() => action("recompute")} className="mt-2.5 w-full py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-700 flex items-center justify-center gap-1 disabled:opacity-50">
          <Icon name="refresh" style={{ fontSize: 16 }} />
          {busy === "recompute" ? "กำลังคำนวณ…" : "คำนวณใหม่ (ใช้ไฟล์ที่มีอยู่)"}
        </button>
        <p className="text-[10px] text-slate-400 mt-1">ระบบคำนวณใหม่อัตโนมัติเมื่อไฟล์ LHS/Rudy เปลี่ยน · กดเองได้ถ้าต้องการผลทันที</p>
      </section>

      {/* อัปโหลด */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-2.5">
        <p className="text-[13px] font-bold text-slate-900">อัปโหลดไฟล์กลุ่ม Line (รายสัปดาห์)</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          รองรับไฟล์ที่มีคอลัมน์ <b>group_name + job_number</b> (เช่น group_register.xlsx, ชีต &ldquo;ลงทะเบียนกลุ่ม&rdquo;) และ <b>Job + Add Bot + Register</b> (ชีต Data) · ชื่อไฟล์เดิม = แทนที่ของเดิม · ไฟล์ group_not_register ไม่มีเลขงานจึงใช้ไม่ได้
        </p>
        <input ref={inputRef} type="file" accept=".xlsx" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <button type="button" disabled={working} onClick={() => inputRef.current?.click()} className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-[12.5px] font-bold text-slate-600 flex items-center justify-center gap-1.5 hover:border-[#d32029] disabled:opacity-50">
          <Icon name="upload_file" style={{ fontSize: 18 }} />
          เลือกไฟล์ .xlsx
        </button>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f) => {
              const p = preview?.files.find((x) => x.name === f.name);
              return (
                <li key={f.name} className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                  <div className="flex items-center gap-2 text-[11.5px]">
                    <Icon name={p?.status === "error" ? "error" : p?.status === "warn" ? "warning" : p ? "check_circle" : "description"} style={{ fontSize: 15 }} className={p?.status === "error" ? "text-[#a11119]" : p?.status === "warn" ? "text-amber-600" : p ? "text-emerald-600" : "text-slate-400"} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{f.name}</span>
                    <span className="shrink-0 text-slate-500">{p ? `${p.rows} แถว${p.replaces ? " · แทนที่ของเดิม" : ""}` : `${(f.size / 1024).toFixed(0)} KB`}</span>
                    {!working && (
                      <button type="button" aria-label="เอาออก" onClick={() => { setFiles(files.filter((x) => x.name !== f.name)); setPreview(null); setStep("select"); }} className="text-slate-400 hover:text-[#a11119]">
                        <Icon name="close" style={{ fontSize: 15 }} />
                      </button>
                    )}
                  </div>
                  {p && p.messages.length > 0 && <p className="mt-0.5 text-[10.5px] text-slate-500">{p.messages.join(" · ")}</p>}
                </li>
              );
            })}
          </ul>
        )}
        {total > MAX_BYTES && <p className="text-[11px] text-[#a11119]">ไฟล์รวมเกิน 4 MB — อัปโหลดทีละไฟล์</p>}

        {preview && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-[11.5px] text-blue-950 space-y-0.5">
            <p className="font-bold">ผลถ้าบันทึก</p>
            <p>
              ลูกค้า {preview.before?.customers ?? 0} → <b>{preview.after.customers}</b> ราย · ลงทะเบียน {preview.before?.register ?? 0} → <b>{preview.after.register}</b> ({pct(preview.after)}%)
            </p>
            <p>ยังไม่ลงทะเบียน {preview.after.not_register} · ไม่ Add Bot {preview.after.no_bot} · ไม่มีข้อมูล {preview.after.none} · กลุ่ม Line ล่าสุด {fmtDate(preview.after.sourceDate)}</p>
            {preview.after.missingCustomer > 0 && <p className="text-amber-700">⚠ {preview.after.missingCustomer} งานยังไม่มีชื่อลูกค้า (รอ sync ไฟล์ LHS/Rudy รอบถัดไป)</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!files.length || working || total > MAX_BYTES} onClick={() => send("preview")} className="py-2.5 rounded-xl border border-slate-200 text-[12.5px] font-bold text-slate-700 disabled:opacity-40">
            {step === "checking" ? "กำลังตรวจ…" : "ตรวจไฟล์"}
          </button>
          <button
            type="button"
            disabled={!preview || working || !preview.files.some((x) => x.status !== "error")}
            onClick={() => send("apply")}
            className="py-2.5 rounded-xl bg-[#d32029] text-white text-[12.5px] font-bold disabled:opacity-40"
          >
            {step === "saving" ? "กำลังบันทึก…" : "ยืนยันบันทึก"}
          </button>
        </div>
      </section>

      {/* ไฟล์ในระบบ */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
        <p className="text-[13px] font-bold text-slate-900 mb-2">ไฟล์ในระบบ ({data?.files.length ?? 0})</p>
        {(data?.files ?? []).length === 0 ? (
          <p className="text-[12px] text-slate-400">ยังไม่มีไฟล์</p>
        ) : (
          <ul className="space-y-1.5">
            {data!.files.map((f) => (
              <li key={f.name} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-slate-800 break-all">{f.name}</p>
                    <p className="text-[10.5px] text-slate-500">
                      {f.rows} แถว · ลงทะเบียน {f.register} · ไม่ลงทะเบียน {f.not_register} · ไม่ Add Bot {f.no_bot} · กลุ่มล่าสุด {fmtDate(f.latestGroup)}
                    </p>
                    <p className="text-[10px] text-slate-400">อัปโหลด {fmt(f.uploadedAt)} · {f.uploadedBy ?? "-"}</p>
                  </div>
                  <button type="button" aria-label={`ลบ ${f.name}`} disabled={busy === f.name} onClick={() => action("remove", f.name)} className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-[#a11119] disabled:opacity-40">
                    <Icon name={busy === f.name ? "progress_activity" : "delete"} style={{ fontSize: 16 }} className={busy === f.name ? "animate-spin" : ""} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
