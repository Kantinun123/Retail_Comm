"use client";

/* =============================================================
   Dropdown ค้นหาได้ (combobox) — ใช้ร่วมหลายหน้า
   แสดงค่าที่เลือก กดแล้วเปิดช่องค้นหา + รายการที่กรองได้ (พิมพ์ค้นได้)
   ============================================================= */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  sub?: string;
  tag?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  icon = "search",
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  icon?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.sub ?? "").toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q)
      )
      .slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next) setQuery("");
      return next;
    });
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full bg-[#faf8f8] text-left text-[14px] rounded-xl pl-3.5 pr-10 py-2.5 border border-slate-200/80 hover:border-red-200 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 focus:bg-white transition-all relative"
      >
        {selected ? (
          <span className="block truncate text-slate-900">
            {selected.label}
            {selected.sub && <span className="text-slate-400"> · {selected.sub}</span>}
          </span>
        ) : (
          <span className="block truncate text-slate-400">{placeholder}</span>
        )}
        <Icon
          name={open ? "expand_less" : "expand_more"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-30 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative flex items-center">
              <Icon name={icon} className="absolute left-2.5 text-slate-400 text-base pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#faf8f8] text-slate-800 text-[13px] rounded-lg pl-8 pr-3 py-2 border border-slate-200 focus:border-[#d32029] focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px] text-slate-400">{emptyText}</p>
            ) : (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b border-slate-50 last:border-0 flex items-center justify-between gap-2 transition",
                      active ? "bg-red-50" : "hover:bg-red-50/40"
                    )}
                  >
                    <div className="min-w-0">
                      <p className={cn("text-[13px] font-semibold truncate", active ? "text-[#a11119]" : "text-slate-800")}>
                        {o.label}
                      </p>
                      {o.sub && <p className="text-[10px] text-slate-400 truncate">{o.sub}</p>}
                    </div>
                    {o.tag && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 bg-slate-100 text-slate-600 border-slate-200">
                        {o.tag}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
