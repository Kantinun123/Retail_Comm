"use client";
/* ความสนใจของลูกค้า: สินค้า / บริการ เลือกได้หลายรายการ (กลุ่ม → รายการ) ใช้ทั้งฟอร์มเพิ่ม Lead และการทวนความต้องการ */
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { catalogOf, cleanInterests, type Interest, type InterestKind } from "./crm-mock-data";
import { inputCls } from "./crm-ui";

const META: Record<InterestKind, { title: string; icon: string; groupLabel: string; itemLabel: string; chip: string }> = {
  service: { title: "บริการ", icon: "handyman", groupLabel: "กลุ่มงานบริการ", itemLabel: "บริการ", chip: "bg-indigo-50 text-indigo-700" },
  product: { title: "สินค้า", icon: "inventory_2", groupLabel: "กลุ่มสินค้า", itemLabel: "สินค้า", chip: "bg-fuchsia-50 text-fuchsia-700" },
};

export function InterestEditor({ kind, value, onChange }: { kind: InterestKind; value: Interest[]; onChange: (v: Interest[]) => void }) {
  const m = META[kind];
  const cat = catalogOf(kind);
  const mine = value.map((v, idx) => ({ v, idx })).filter((x) => x.v.kind === kind);
  const patch = (idx: number, p: Partial<Interest>) => onChange(value.map((v, i) => (i === idx ? { ...v, ...p } : v)));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-[14px] font-bold text-slate-900"><Icon name={m.icon} style={{ fontSize: 18 }} />{m.title}</h3>
      {mine.length === 0 && <p className="mb-2 text-[12px] text-slate-400">ยังไม่ได้เลือก{m.title} กดเพิ่มรายการได้เลย</p>}
      <div className="space-y-2">
        {mine.map(({ v, idx }) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <select value={v.group} onChange={(e) => patch(idx, { group: e.target.value, item: "" })} className={cn(inputCls, "min-w-0")} aria-label={m.groupLabel}>
              <option value="">{m.groupLabel}...</option>
              {Object.keys(cat).map((g) => <option key={g}>{g}</option>)}
            </select>
            <select value={v.item} disabled={!v.group} onChange={(e) => patch(idx, { item: e.target.value })} className={cn(inputCls, "min-w-0 disabled:opacity-50")} aria-label={m.itemLabel}>
              <option value="">{m.itemLabel}...</option>
              {(cat[v.group] ?? []).map((it) => <option key={it}>{it}</option>)}
            </select>
            <button type="button" onClick={() => onChange(value.filter((_, i) => i !== idx))} className="grid h-9 w-9 place-items-center rounded-full text-rose-500 hover:bg-rose-50" aria-label="ลบรายการ"><Icon name="delete" style={{ fontSize: 19 }} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...value, { kind, group: "", item: "" }])} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-emerald-700 hover:underline"><Icon name="add" style={{ fontSize: 17 }} />เพิ่มรายการ</button>
    </div>
  );
}

/** ป้ายความสนใจ (แสดงอย่างเดียว) ; max = จำนวนสูงสุดที่แสดง ที่เหลือรวมเป็น +n */
export function InterestChips({ list, max, fallback }: { list?: Interest[]; max?: number; fallback?: string }) {
  const c = cleanInterests(list);
  if (c.length === 0) return fallback ? <span className="text-[11.5px] text-slate-500">{fallback}</span> : null;
  const shown = max ? c.slice(0, max) : c;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((i, k) => (
        <span key={k} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", META[i.kind].chip)}>
          <Icon name={META[i.kind].icon} style={{ fontSize: 12 }} />{i.item}
        </span>
      ))}
      {max && c.length > max && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">+{c.length - max}</span>}
    </div>
  );
}
