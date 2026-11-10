"use client";

/* รายการแบบรับเข้า (job) ของเดือนที่เลือก — กรองตามประเภท/สถานะ/ค้นหา ; ไม่มีข้อมูลลูกค้า */

import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { fetchDesignIntakeJobs, type DiJob } from "@/lib/commission/design-intake-store";
import { cn } from "@/lib/utils";

const STAGE: Record<string, { label: string; cls: string }> = {
  Won: { label: "ปิดการขายได้", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Opp>0": { label: "กำลังดำเนินการ", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  "Opp 0": { label: "ยังไม่มีมูลค่า", cls: "bg-slate-50 text-slate-600 border-slate-200" },
  Lost: { label: "ไม่สำเร็จ", cls: "bg-red-50 text-[#b91c1c] border-red-200" },
  Canceled: { label: "ยกเลิก", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};
type TypeFilter = "all" | "material" | "solution";
type StageFilter = "all" | "Won" | "open" | "Lost" | "Canceled";
const STAGE_FILTERS: { key: StageFilter; label: string; match: (s: string | null) => boolean }[] = [
  { key: "all", label: "ทุกสถานะ", match: () => true },
  { key: "Won", label: "ปิดการขายได้", match: (s) => s === "Won" },
  { key: "open", label: "กำลังดำเนินการ", match: (s) => s === "Opp>0" || s === "Opp 0" },
  { key: "Lost", label: "ไม่สำเร็จ", match: (s) => s === "Lost" },
  { key: "Canceled", label: "ยกเลิก", match: (s) => s === "Canceled" },
];
const fmtDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
const baht = (v: number) => `฿${v.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

export function DesignIntakeJobsModal({
  period,
  title,
  dealerCode,
  repCode,
  showStore,
  initialType = "all",
  onClose,
}: {
  period: string;
  title: string;
  dealerCode: string | null;
  repCode: string | null;
  /** แสดงชื่อร้านในแต่ละรายการ (admin ดูทุกร้าน) */
  showStore: boolean;
  initialType?: TypeFilter;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ jobs: DiJob[]; truncated: boolean; total: number } | null | undefined>(undefined);
  const [type, setType] = useState<TypeFilter>(initialType);
  const [stage, setStage] = useState<StageFilter>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchDesignIntakeJobs({ period, dealerCode, repCode })
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [period, dealerCode, repCode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const jobs = useMemo(() => data?.jobs ?? [], [data]);
  const stageMatch = STAGE_FILTERS.find((f) => f.key === stage)!.match;
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (type !== "all" && j.designType !== type) return false;
      if (!stageMatch(j.stage)) return false;
      if (!term) return true;
      return [j.oppId, j.rudyId, j.serviceSub, j.productSub, j.repName, j.creator, j.dealerName]
        .some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [jobs, type, stageMatch, q]);
  const count = (t: TypeFilter) => jobs.filter((j) => (t === "all" || j.designType === t) && stageMatch(j.stage)).length;
  const countStage = (f: (typeof STAGE_FILTERS)[number]) => jobs.filter((j) => (type === "all" || j.designType === type) && f.match(j.stage)).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`รายการแบบรับเข้า ${title}`}
        className="w-full max-w-md bg-[#f7f4f4] rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-3 bg-white rounded-t-3xl border-b border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[16px] font-bold text-slate-900">รายการแบบรับเข้า · {title}</p>
              <p className="text-[11px] text-slate-500">
                {data === undefined ? "กำลังโหลด…" : `${filtered.length.toLocaleString()} จาก ${jobs.length.toLocaleString()} แบบ`}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="ปิด" className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <Icon name="close" style={{ fontSize: 18 }} />
            </button>
          </div>

          <div className="flex gap-1.5 mt-3" role="group" aria-label="ประเภทแบบ">
            {(["all", "material", "solution"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11.5px] font-bold border transition",
                  type === t ? "bg-[#d32029] text-white border-[#d32029]" : "bg-white text-slate-600 border-slate-200"
                )}
              >
                {t === "all" ? "ทั้งหมด" : t === "material" ? "Material" : "Solution"} {count(t)}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar" role="group" aria-label="สถานะ">
            {STAGE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStage(f.key)}
                aria-pressed={stage === f.key}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap transition",
                  stage === f.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
                )}
              >
                {f.label} {countStage(f)}
              </button>
            ))}
          </div>
          <div className="relative mt-2">
            <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหา เลขเอกสาร / งาน / สินค้า / พนักงาน"
              aria-label="ค้นหารายการแบบ"
              className="w-full bg-[#faf8f8] text-[12.5px] rounded-xl pl-8 pr-3 py-2 border border-slate-200 focus:border-[#d32029] focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-y-auto px-3 py-3 space-y-2">
          {data === undefined ? (
            <div className="py-10 text-center text-slate-300">
              <Icon name="progress_activity" className="animate-spin text-3xl" />
            </div>
          ) : data === null ? (
            <p className="py-10 text-center text-[13px] text-slate-500">โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้ง</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-500">ไม่มีรายการตามเงื่อนไขที่เลือก</p>
          ) : (
            filtered.map((j) => {
              const st = STAGE[j.stage ?? ""] ?? { label: j.stage ?? "-", cls: "bg-slate-50 text-slate-600 border-slate-200" };
              const value = j.designType === "material" ? j.expectedProduct : j.expectedService || j.expectedProduct;
              return (
                <article key={j.oppId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[10.5px] font-bold px-2 py-0.5 rounded-full",
                        j.designType === "material" ? "bg-[#1e5a7a]/10 text-[#1e5a7a]" : "bg-[#4fb0b3]/15 text-[#2b8a8d]"
                      )}
                    >
                      {j.designType === "material" ? "Material" : "Solution"}
                    </span>
                    <span className={cn("text-[10.5px] font-semibold px-2 py-0.5 rounded-full border", st.cls)}>{st.label}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-slate-900 mt-1.5 leading-snug">{j.serviceSub ?? j.serviceCategory ?? "-"}</p>
                  {j.productSub && <p className="text-[11.5px] text-slate-500">สินค้า: {j.productSub}</p>}
                  {showStore && j.dealerName && <p className="text-[11.5px] text-slate-500 truncate">ร้าน: {j.dealerName}</p>}
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span>วันที่รับ: <b className="text-slate-700 font-semibold">{fmtDate(j.createdDate)}</b></span>
                    <span className="text-right">ประมาณการ: <b className="tnum text-slate-700 font-semibold">{value > 0 ? baht(value) : "-"}</b></span>
                    <span className="truncate">พนักงาน: <b className="text-slate-700 font-semibold">{j.repName ?? j.creator ?? "ไม่ระบุ"}</b></span>
                    <span className="text-right truncate">ช่องทาง: {j.subOrigin ?? j.origin ?? "-"}</span>
                  </div>
                  {j.reason && <p className="text-[11px] text-slate-500 mt-1">เหตุผล: {j.reason}</p>}
                  <p className="text-[10px] text-slate-400 mt-1.5 tnum">
                    {j.oppId}
                    {j.rudyId ? ` · ${j.rudyId}` : ""}
                  </p>
                </article>
              );
            })
          )}
          {data?.truncated && (
            <p className="text-center text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              แสดง {jobs.length.toLocaleString()} รายการล่าสุดจากทั้งหมด {data.total.toLocaleString()} แบบ · เลือกร้านเพื่อดูครบทุกรายการ
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
