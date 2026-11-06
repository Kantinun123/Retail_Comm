"use client";

/* =============================================================
   StorePicker — ตัวเลือกร้านค้าแบบกรองลำดับชั้น
   chip ภาค + chip model + ช่องค้นหา (ทำงานแบบ AND)
   ใช้ร่วมกันทั้งหน้า store-roster และ employee-admin
   ============================================================= */

import { useMemo, useState } from "react";
import { Icon } from "./icon";
import type { StoreInfo } from "@/lib/commission/employee-store";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export function StorePicker({
  stores,
  selected,
  onSelect,
}: {
  stores: StoreInfo[];
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>(ALL);
  const [model, setModel] = useState<string>(ALL);

  // แสดงเฉพาะร้านที่เปิดใช้งาน (ร้านปิด/ยกเลิก จัดการที่หน้า "จัดการร้านค้า")
  const activeStores = useMemo(() => stores.filter((s) => s.isActive), [stores]);

  // Model นับจากทั้งหมด ; ภาคนับจากร้านที่ผ่านตัวกรอง Model แล้ว (ไหลลื่น: เลือก Model ก่อน -> ภาคกรองตาม)
  const models = useMemo(() => countBy(activeStores, (s) => s.model), [activeStores]);
  const regions = useMemo(
    () =>
      countBy(
        model === ALL ? activeStores : activeStores.filter((s) => (s.model ?? "") === model),
        (s) => s.region
      ),
    [activeStores, model]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeStores.filter((s) => {
      if (region !== ALL && (s.region ?? "") !== region) return false;
      if (model !== ALL && (s.model ?? "") !== model) return false;
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !s.code.includes(q)
      )
        return false;
      return true;
    });
  }, [activeStores, region, model, query]);

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
      <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
        <Icon name="storefront" style={{ fontSize: 16 }} className="text-[#d32029]" />
        เลือกร้านค้า
      </label>

      {/* ช่องค้นหา */}
      <div className="mt-2 relative">
        <Icon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          style={{ fontSize: 18 }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นชื่อร้าน / รหัส"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-[#d32029]"
        />
      </div>

      {/* chip model (เลือกก่อน) */}
      <ChipRow
        label="Model"
        items={models}
        value={model}
        onChange={(v) => {
          setModel(v);
          setRegion(ALL); // เปลี่ยน Model -> รีเซ็ตภาค (กันเลือกภาคที่ไม่มีใน model ใหม่)
        }}
        total={activeStores.length}
      />

      {/* chip ภาค (กรองตาม Model ที่เลือก) */}
      <ChipRow
        label="ภาค"
        items={regions}
        value={region}
        onChange={setRegion}
        total={model === ALL ? activeStores.length : regions.reduce((a, r) => a + r.count, 0)}
      />

      {/* ผลลัพธ์ */}
      <div className="mt-2 flex items-center justify-between px-0.5">
        <span className="text-[10.5px] text-slate-400">
          พบ {filtered.length} ร้าน
        </span>
        {(region !== ALL || model !== ALL || query) && (
          <button
            onClick={() => {
              setRegion(ALL);
              setModel(ALL);
              setQuery("");
            }}
            className="text-[10.5px] font-semibold text-[#d32029] inline-flex items-center gap-0.5 active:scale-95"
          >
            <Icon name="close" style={{ fontSize: 13 }} />
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className="mt-1.5 max-h-60 overflow-y-auto space-y-1">
        {filtered.map((s) => (
          <button
            key={s.code}
            onClick={() => onSelect(s.code)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between transition active:scale-[0.99]",
              selected === s.code
                ? "border-[#d32029] bg-red-50/50"
                : "border-slate-100 hover:border-red-200"
            )}
          >
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-slate-800 truncate">
                {s.name}
              </p>
              <p className="text-[10.5px] text-slate-400">
                {s.code} · {s.region ?? "–"} · {s.model ?? "–"}
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-500 tnum shrink-0 ml-2">
              {s.empCount} คน
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-[12px] text-slate-400 text-center py-3">
            ไม่พบร้านที่ตรงกับตัวกรอง
          </p>
        )}
      </div>
    </section>
  );
}

/* ---------- chip row ---------- */
function ChipRow({
  label,
  items,
  value,
  onChange,
  total,
}: {
  label: string;
  items: { key: string; count: number }[];
  value: string;
  onChange: (v: string) => void;
  total: number;
}) {
  return (
    <div className="mt-2.5">
      <p className="text-[10.5px] font-semibold text-slate-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <Chip
          active={value === ALL}
          onClick={() => onChange(ALL)}
          label="ทั้งหมด"
          count={total}
        />
        {items.map((it) => (
          <Chip
            key={it.key}
            active={value === it.key}
            onClick={() => onChange(it.key)}
            label={it.key}
            count={it.count}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 text-[11.5px] font-semibold px-2.5 py-1 rounded-full border transition active:scale-95 whitespace-nowrap",
        active
          ? "bg-[#d32029] text-white border-[#d32029]"
          : "bg-white text-slate-600 border-slate-200 hover:border-red-200"
      )}
    >
      {label}
      <span className={cn("ml-1 tnum", active ? "text-red-100" : "text-slate-400")}>
        {count}
      </span>
    </button>
  );
}

/* ---------- helper: นับจำนวนตาม key (ข้ามค่าว่าง), เรียงมาก→น้อย ---------- */
function countBy(
  stores: StoreInfo[],
  get: (s: StoreInfo) => string | null
): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of stores) {
    const k = (get(s) ?? "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}
