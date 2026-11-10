"use client";

/* หน้าต่างอัปโหลด BA Commission รายเดือน: เลือกไฟล์ -> ตรวจข้อมูล (preview) -> ยืนยันบันทึก (แทนที่ทั้งเดือน) */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

interface PreviewFile { name: string; kind: "store" | "consolidated" | null; status: "ok" | "warn" | "error"; messages: string[]; rows: number; amount: number }
interface Preview {
  period: string;
  files: PreviewFile[];
  before: { rows: number; amount: number };
  prev: { period: string; rows: number; amount: number };
  after: { rows: number; amount: number; stores: number; unmappedRows: number; people: number; repMatched: number; winDate: number };
  changes: { dealerCode: string; dealerName: string; before: number; after: number }[];
  warnings: string[];
}

const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const monthFull = (p: string) => { const [y, m] = p.split("-").map(Number); return `${TH_MONTH[m - 1]} ${y + 543}`; };
const baht = (v: number) => "฿" + v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MON: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const guessPeriod = (names: string[]) => {
  const ps = names.map((n) => n.match(/I-([A-Z]{3})(\d{2})_/i)).filter(Boolean).map((m) => `20${m![2]}-${String(MON[m![1].toUpperCase()] ?? 0).padStart(2, "0")}`);
  const uniq = [...new Set(ps)].filter((p) => !p.endsWith("-00"));
  return uniq.length === 1 ? uniq[0] : null;
};
const MAX_BYTES = 4 * 1024 * 1024;

export function BaUploadModal({ initialPeriod, onClose, onApplied }: { initialPeriod: string; onClose: () => void; onApplied: () => void }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<"select" | "checking" | "preview" | "saving" | "done">("select");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = step === "checking" || step === "saving";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const periods = (() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < 14; i++) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
    }
    if (!out.includes(initialPeriod)) out.push(initialPeriod);
    return out;
  })();

  const addFiles = (list: FileList | File[]) => {
    const add = [...list].filter((f) => /\.xlsx?$/i.test(f.name));
    const merged = [...files];
    add.forEach((f) => { if (!merged.some((x) => x.name === f.name)) merged.push(f); });
    setFiles(merged);
    setPreview(null);
    setError(null);
    setStep("select");
    const g = guessPeriod(merged.map((f) => f.name));
    if (g) setPeriod(g);
  };
  const totalBytes = files.reduce((a, f) => a + f.size, 0);

  async function send(mode: "preview" | "apply") {
    setError(null);
    setStep(mode === "preview" ? "checking" : "saving");
    const fd = new FormData();
    fd.set("period", period);
    fd.set("mode", mode);
    files.forEach((f) => fd.append("files", f, f.name));
    try {
      const res = await fetch("/api/admin/uploads/ba-commission", { method: "POST", body: fd });
      const raw = (await res.json()) as { ok?: boolean; error?: string; preview?: Preview };
      if (!res.ok || !raw.ok) {
        setError(raw.error ?? `ผิดพลาด (HTTP ${res.status})`);
        setStep(mode === "preview" ? "select" : "preview");
        return;
      }
      setPreview(raw.preview ?? null);
      setStep(mode === "preview" ? "preview" : "done");
    } catch (e) {
      setError(String(e));
      setStep(mode === "preview" ? "select" : "preview");
    }
  }

  const fileOk = preview?.files.filter((f) => f.status === "ok").length ?? 0;
  const fileWarn = preview?.files.filter((f) => f.status === "warn").length ?? 0;
  const fileErr = preview?.files.filter((f) => f.status === "error").length ?? 0;
  const shownFiles = preview ? (showAll ? preview.files : [...preview.files].sort((a, b) => (a.status === "ok" ? 1 : 0) - (b.status === "ok" ? 1 : 0)).slice(0, 6)) : [];
  const delta = preview && preview.prev.amount ? ((preview.after.amount - preview.prev.amount) / preview.prev.amount) * 100 : null;
  const stepNo = step === "select" || step === "checking" ? 1 : step === "done" ? 3 : 2;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="อัปโหลด BA Commission" className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-slate-900">อัปโหลดข้อมูลรายเดือน</h3>
            <button type="button" onClick={onClose} disabled={busy} aria-label="ปิด" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 disabled:opacity-40">
              <Icon name="close" style={{ fontSize: 18 }} />
            </button>
          </div>
          <ol className="flex items-center gap-2 mt-2.5 text-[11px] font-bold">
            {["เลือกไฟล์", "ตรวจข้อมูล", "บันทึก"].map((t, i) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", i + 1 < stepNo ? "bg-emerald-500 text-white" : i + 1 === stepNo ? "bg-[#d32029] text-white" : "bg-slate-200 text-slate-500")}>
                  {i + 1 < stepNo ? "✓" : i + 1}
                </span>
                <span className={i + 1 === stepNo ? "text-slate-900" : "text-slate-400"}>{t}</span>
                {i < 2 && <span className="w-4 h-px bg-slate-300" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </div>

        <div className="p-5 space-y-3.5">
          {step === "done" && preview ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-[15px] font-bold text-emerald-800 flex items-center gap-1.5">
                <Icon name="check_circle" style={{ fontSize: 20 }} /> บันทึกแล้ว {preview.after.rows.toLocaleString("th-TH")} แถว
              </p>
              <p className="text-[12px] text-emerald-700 mt-1.5 leading-relaxed">
                BA Commission {monthFull(preview.period)} · {baht(preview.after.amount)} · แทนที่ข้อมูลเดิม {preview.before.rows.toLocaleString("th-TH")} แถว
                <br />หน้า BA Commission ของร้าน/พนักงานเห็นยอดใหม่ทันที · เก็บไฟล์ต้นฉบับไว้แล้ว
              </p>
              <button type="button" onClick={onApplied} className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-[13px] font-bold text-white active:scale-[0.99]">
                เสร็จสิ้น
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                  <p className="text-[10px] text-slate-500">แหล่งข้อมูล</p>
                  <p className="text-[13px] font-bold text-slate-900">BA Commission</p>
                </div>
                <label className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 block">
                  <span className="text-[10px] text-slate-500 block">เดือน</span>
                  <select
                    value={period}
                    disabled={busy}
                    onChange={(e) => { setPeriod(e.target.value); setPreview(null); setStep("select"); }}
                    className="w-full bg-transparent text-[13px] font-bold text-slate-900 focus:outline-none"
                  >
                    {periods.map((p) => <option key={p} value={p}>{monthFull(p)}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-[10.5px] text-slate-400 -mt-1.5">รองรับไฟล์แยกรายร้าน (I-OCT26_*.xlsx) หลายไฟล์ หรือไฟล์รวมทุกร้าน (sheet &quot;All&quot; ใช้เฉพาะแถวของเดือนที่เลือก) · ระบบเดาเดือนจากชื่อไฟล์ให้</p>

              {/* เลือกไฟล์ */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) addFiles(e.dataTransfer.files); }}
                className={cn("rounded-2xl border-2 border-dashed p-4 text-center transition", drag ? "border-[#d32029] bg-red-50/50" : "border-slate-200 bg-white")}
              >
                <Icon name="upload_file" className="text-3xl text-[#d32029]" />
                <p className="text-[12.5px] font-semibold text-slate-700 mt-1">ลากไฟล์ Excel มาวาง หรือ</p>
                <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="mt-1.5 rounded-full bg-[#fee2e2] px-3.5 py-1.5 text-[12px] font-bold text-[#c3161c] disabled:opacity-50">
                  เลือกไฟล์ (หลายไฟล์ได้)
                </button>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                {files.length > 0 && (
                  <p className={cn("text-[11px] mt-2", totalBytes > MAX_BYTES ? "text-rose-600 font-bold" : "text-slate-500")}>
                    {files.length} ไฟล์ · {(totalBytes / 1048576).toFixed(2)} MB{totalBytes > MAX_BYTES ? " — เกิน 4 MB" : ""}
                    <button type="button" disabled={busy} onClick={() => { setFiles([]); setPreview(null); setStep("select"); }} className="ml-2 underline text-slate-400">ล้าง</button>
                  </p>
                )}
              </div>

              {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700">{error}</div>}

              {/* ผลตรวจ */}
              {preview && (
                <>
                  <section className="rounded-2xl border border-slate-200 p-3.5">
                    <p className="text-[12.5px] font-bold text-slate-900">
                      ตรวจแล้ว: ใช้ได้ {fileOk}{fileWarn ? ` · เตือน ${fileWarn}` : ""}{fileErr ? ` · ข้าม ${fileErr}` : ""}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {shownFiles.map((f) => (
                        <li key={f.name} className="text-[11px]">
                          <div className="flex items-start gap-1.5">
                            <span className={cn("font-bold shrink-0", f.status === "ok" ? "text-emerald-600" : f.status === "warn" ? "text-amber-600" : "text-rose-600")}>
                              {f.status === "ok" ? "✓" : f.status === "warn" ? "⚠" : "✗"}
                            </span>
                            <span className="flex-1 min-w-0 truncate text-slate-700">{f.name}</span>
                            <span className="shrink-0 text-slate-400">{f.rows} แถว</span>
                          </div>
                          {f.messages.map((m) => <p key={m} className={cn("pl-4 text-[10.5px]", f.status === "error" ? "text-rose-600" : "text-amber-700")}>{m}</p>)}
                        </li>
                      ))}
                    </ul>
                    {preview.files.length > 6 && (
                      <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1.5 text-[11px] font-bold text-[#c3161c]">
                        {showAll ? "ย่อ" : `ดูทั้งหมด ${preview.files.length} ไฟล์`}
                      </button>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-3.5 text-[12px]">
                    <p className="text-[12.5px] font-bold text-slate-900 mb-2">ผลถ้าบันทึก: แทนที่ข้อมูล {monthFull(preview.period)} ทั้งเดือน</p>
                    <dl className="space-y-1.5">
                      <div className="flex justify-between"><dt className="text-slate-500">ข้อมูลเดิมในเดือนนี้</dt><dd className="tnum font-semibold">{preview.before.rows.toLocaleString("th-TH")} แถว · {baht(preview.before.amount)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">ข้อมูลใหม่</dt><dd className="tnum font-bold text-slate-900">{preview.after.rows.toLocaleString("th-TH")} แถว · {baht(preview.after.amount)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">เทียบเดือนก่อน ({monthFull(preview.prev.period)})</dt>
                        <dd className={cn("tnum font-bold", delta == null ? "text-slate-400" : delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {delta == null ? "-" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}%`}
                        </dd>
                      </div>
                      <div className="flex justify-between"><dt className="text-slate-500">ร้าน / พนักงาน</dt><dd className="tnum font-semibold">{preview.after.stores} ร้าน · {preview.after.people} คน</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">ไม่ระบุร้าน</dt><dd className="tnum font-semibold">{preview.after.unmappedRows.toLocaleString("th-TH")} แถว</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">ผูกพนักงานในระบบได้</dt><dd className="tnum font-semibold">{preview.after.repMatched.toLocaleString("th-TH")} / {preview.after.rows.toLocaleString("th-TH")} แถว</dd></div>
                    </dl>
                    {preview.changes.length > 0 && (
                      <div className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[10.5px] font-bold text-slate-500 mb-1">ร้านที่ยอดเปลี่ยนมากที่สุด ({preview.before.rows ? "เทียบข้อมูลเดิม" : "เทียบเดือนก่อน"})</p>
                        {preview.changes.map((c) => (
                          <p key={c.dealerCode} className="text-[10.5px] text-slate-600 flex justify-between gap-2">
                            <span className="truncate">{c.dealerName}</span>
                            <span className={cn("tnum shrink-0 font-semibold", c.after >= c.before ? "text-emerald-600" : "text-rose-600")}>
                              {baht(c.before)} → {baht(c.after)}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </section>

                  {preview.warnings.map((w) => (
                    <div key={w} className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] font-semibold text-rose-700 flex gap-1.5">
                      <Icon name="warning" style={{ fontSize: 16 }} /> {w}
                    </div>
                  ))}
                </>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button type="button" onClick={onClose} disabled={busy} className="rounded-2xl bg-slate-100 py-3 text-[13px] font-bold text-slate-600 disabled:opacity-50">
                  ยกเลิก
                </button>
                {step === "preview" && preview ? (
                  <button
                    type="button"
                    onClick={() => send("apply")}
                    disabled={!preview.after.rows}
                    className="rounded-2xl bg-[#d32029] py-3 text-[13px] font-bold text-white shadow-sm shadow-[#d32029]/25 disabled:opacity-50 hover:-translate-y-0.5 active:scale-[0.99] transition-all"
                  >
                    ยืนยันบันทึก
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => send("preview")}
                    disabled={!files.length || busy || totalBytes > MAX_BYTES}
                    className="rounded-2xl bg-slate-900 py-3 text-[13px] font-bold text-white disabled:opacity-40 hover:-translate-y-0.5 active:scale-[0.99] transition-all"
                  >
                    {step === "checking" ? "กำลังตรวจ…" : "ตรวจข้อมูล"}
                  </button>
                )}
              </div>
              {step === "saving" && <p className="text-[11px] text-slate-500 text-center">กำลังบันทึก… อย่าปิดหน้าต่าง</p>}
              <p className="text-[10.5px] text-slate-400 text-center">ยังไม่มีการเขียนข้อมูลจนกว่าจะกดยืนยัน · การบันทึกทำในครั้งเดียว ถ้าผิดพลาดข้อมูลเดิมไม่เปลี่ยน</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
