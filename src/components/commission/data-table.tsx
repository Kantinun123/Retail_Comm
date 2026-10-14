"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "./icon";

export interface TableColumn {
  key: string;
  label: string;
  /** ฟอร์แมตค่าที่จะแสดง (เช่น ตัวคั่นหลักพัน + ทศนิยม) */
  format?: (value: unknown) => string;
}

export interface TableDef {
  name: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  /** แถวสรุปท้ายตาราง: map ของ column key -> ข้อความที่จะแสดง (เช่น ผลรวม) */
  footer?: Record<string, string>;
}

/** ตัวคั่นหลักพัน + ทศนิยม 2 ตำแหน่ง (ใช้ร่วมกับไฟล์ที่ดาวน์โหลด) */
export function money2(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return value === undefined || value === null ? "" : String(value);
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ---------- Excel-like data table ----------
   - แถบเลื่อนแนวนอน "ด้านบน" หัวคอลัมน์ (proxy) sync กับตารางจริง
   - แถบเลื่อนแนวตั้ง + แนวนอน อยู่ในตัวตาราง (จำกัดความสูง) */
export function DataTable({ table }: { table: TableDef }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 50;
  const rows = showAll ? table.rows : table.rows.slice(0, LIMIT);

  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [innerWidth, setInnerWidth] = useState(0);
  const syncing = useRef<"top" | "body" | null>(null);

  // keep the top scrollbar's inner spacer as wide as the real table
  useLayoutEffect(() => {
    const measure = () => {
      if (tableRef.current) setInnerWidth(tableRef.current.scrollWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tableRef.current) ro.observe(tableRef.current);
    return () => ro.disconnect();
  }, [rows.length, table.columns.length]);

  const onTopScroll = useCallback(() => {
    if (syncing.current === "body") return;
    syncing.current = "top";
    if (bodyRef.current && topRef.current) {
      bodyRef.current.scrollLeft = topRef.current.scrollLeft;
    }
    requestAnimationFrame(() => (syncing.current = null));
  }, []);

  const onBodyScroll = useCallback(() => {
    if (syncing.current === "top") return;
    syncing.current = "body";
    if (topRef.current && bodyRef.current) {
      topRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
    requestAnimationFrame(() => (syncing.current = null));
  }, []);

  useEffect(() => {
    const top = topRef.current;
    const body = bodyRef.current;
    top?.addEventListener("scroll", onTopScroll, { passive: true });
    body?.addEventListener("scroll", onBodyScroll, { passive: true });
    return () => {
      top?.removeEventListener("scroll", onTopScroll);
      body?.removeEventListener("scroll", onBodyScroll);
    };
  }, [onTopScroll, onBodyScroll]);

  return (
    <div className="mt-3">
      <p className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
        <Icon name="table_view" style={{ fontSize: 14 }} className="text-[#d32029]" />
        {table.name}
        <span className="font-normal text-slate-400">
          ({table.rows.length} แถว)
        </span>
      </p>

      {/* top horizontal scrollbar (proxy) */}
      <div
        ref={topRef}
        className="cm-scroll overflow-x-auto overflow-y-hidden rounded-t-lg border border-b-0 border-slate-200 bg-[#faf3f3]"
      >
        <div style={{ width: innerWidth, height: 1 }} />
      </div>

      {/* table body: scrolls both directions */}
      <div
        ref={bodyRef}
        className="cm-scroll overflow-auto rounded-b-lg border border-slate-200 max-h-[360px]"
      >
        <table ref={tableRef} className="w-full border-collapse text-[11px] tnum">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#faf3f3]">
              <th className="sticky left-0 z-30 bg-[#faf3f3] border border-slate-200 px-2 py-1.5 text-slate-400 font-semibold text-center w-8">
                #
              </th>
              {table.columns.map((c) => (
                <th
                  key={c.key}
                  className="border border-slate-200 px-2 py-1.5 text-[#a11119] font-bold text-left whitespace-nowrap bg-[#faf3f3]"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.columns.length + 1}
                  className="border border-slate-200 px-2 py-3 text-center text-slate-400"
                >
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className={i % 2 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="sticky left-0 z-10 border border-slate-200 px-2 py-1 text-slate-400 text-center bg-inherit">
                    {i + 1}
                  </td>
                  {table.columns.map((c) => {
                    const v = row[c.key];
                    const display = c.format
                      ? c.format(v)
                      : v === undefined || v === null || v === ""
                        ? "—"
                        : String(v);
                    return (
                      <td
                        key={c.key}
                        className="border border-slate-200 px-2 py-1 text-slate-700 whitespace-nowrap"
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {table.footer && rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-[#faf3f3] font-bold text-[#a11119]">
                <td className="sticky left-0 z-30 bg-[#faf3f3] border border-slate-200 px-2 py-1.5 text-center">
                  Σ
                </td>
                {table.columns.map((c, idx) => (
                  <td
                    key={c.key}
                    className="border border-slate-200 px-2 py-1.5 whitespace-nowrap bg-[#faf3f3]"
                  >
                    {table.footer?.[c.key] ??
                      (idx === 0 ? "รวมทั้งหมด" : "")}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {table.rows.length > LIMIT && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="mt-1.5 text-[11px] font-semibold text-[#d32029] hover:underline"
        >
          {showAll ? "แสดงน้อยลง" : `แสดงทั้งหมด (${table.rows.length} แถว)`}
        </button>
      )}
    </div>
  );
}
