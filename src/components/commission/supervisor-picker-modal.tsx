"use client";

/* =============================================================
   SupervisorPickerModal — เลือก Area Manager / Coach ของร้าน
   - role = manager -> รายชื่อ Area Manager ; role = coach -> รายชื่อ Coach
   - เลือกแล้วบันทึกทันที (แทนที่คนเดิมใน role นั้นของร้าน)
   ============================================================= */

import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import {
  fetchSupervisorOptions,
  setStoreSupervisor,
  type SupervisorOption,
  type SupervisorRole,
} from "@/lib/commission/employee-store";
import { cn } from "@/lib/utils";

export function SupervisorPickerModal({
  dealerCode,
  dealerName,
  role,
  currentRepCodes,
  onClose,
  onSaved,
}: {
  dealerCode: string;
  dealerName: string;
  role: SupervisorRole;
  /** rep_code ที่ผูกอยู่ตอนนี้ (ไฮไลต์ให้เห็น) */
  currentRepCodes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [options, setOptions] = useState<SupervisorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wantPosition = role === "manager" ? "area_mng" : "coach";
  const title = role === "manager" ? "เลือก Area Manager" : "เลือก RE / Coach";

  useEffect(() => {
    let cancelled = false;
    fetchSupervisorOptions()
      .then((o) => {
        if (!cancelled) setOptions(o);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => o.position === wantPosition)
      .filter(
        (o) =>
          !q ||
          o.name.toLowerCase().includes(q) ||
          (o.nickname ?? "").toLowerCase().includes(q)
      );
  }, [options, wantPosition, query]);

  async function pick(repCode: string) {
    setBusy(repCode);
    setError(null);
    const res = await setStoreSupervisor(dealerCode, role, repCode);
    setBusy(null);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      setError(res.error ?? "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-xl animate-fade-up">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-400 truncate">{dealerName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center active:scale-95 shrink-0"
          >
            <Icon name="close" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="relative">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              style={{ fontSize: 18 }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นชื่อ / ชื่อเล่น"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-[#d32029]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {loading ? (
            <div className="py-8 text-center">
              <Icon name="progress_activity" className="animate-spin text-2xl text-[#d32029]" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-6">ไม่พบรายชื่อ</p>
          ) : (
            filtered.map((o) => {
              const isCurrent = currentRepCodes.includes(o.repCode);
              return (
                <button
                  key={o.repCode}
                  onClick={() => pick(o.repCode)}
                  disabled={busy !== null}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl border flex items-center justify-between transition active:scale-[0.99] disabled:opacity-60",
                    isCurrent
                      ? "border-[#d32029] bg-red-50/50"
                      : "border-slate-100 hover:border-red-200"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-slate-800 truncate">
                      {o.name}
                      {o.nickname ? ` (${o.nickname})` : ""}
                    </span>
                    {isCurrent && (
                      <span className="block text-[10.5px] text-[#d32029]">
                        ผูกกับร้านนี้อยู่ตอนนี้
                      </span>
                    )}
                  </span>
                  {busy === o.repCode ? (
                    <Icon name="progress_activity" className="animate-spin text-[#d32029]" style={{ fontSize: 18 }} />
                  ) : isCurrent ? (
                    <Icon name="check_circle" className="text-[#d32029]" style={{ fontSize: 18 }} />
                  ) : null}
                </button>
              );
            })
          )}
          {error && (
            <p className="text-[12px] font-semibold rounded-lg px-3 py-2 bg-red-50 text-[#a11119] border border-red-200">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
