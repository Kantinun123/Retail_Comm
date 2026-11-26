"use client";
/* ความสนใจของลูกค้า: สินค้า / บริการ เลือกได้หลายรายการ (กลุ่ม → รายการ) ใช้ทั้งฟอร์มเพิ่ม Lead และการทวนความต้องการ */
import { Icon } from "@/components/commission/icon";
import { cn } from "@/lib/utils";
import { BUY_LABEL, COLOR_OPTS, TILE_MODEL_OPTS, TILE_OPTS, catalogOf, cleanInterests, detailText, hasDetail, needsBuyMode, type BuyMode, type Interest, type InterestKind, type ProductDetail } from "./crm-mock-data";
import { inputCls } from "./crm-ui";

const META: Record<InterestKind, { title: string; icon: string; groupLabel: string; itemLabel: string; chip: string }> = {
  service: { title: "บริการ", icon: "handyman", groupLabel: "กลุ่มงานบริการ", itemLabel: "บริการ", chip: "bg-indigo-50 text-indigo-700" },
  product: { title: "สินค้า", icon: "inventory_2", groupLabel: "กลุ่มสินค้า", itemLabel: "สินค้า", chip: "bg-fuchsia-50 text-fuchsia-700" },
};

/* รายละเอียดสินค้าที่ใช้ภายใต้บริการ (ไม่บังคับ) : ตอนนี้มีรายการยี่ห้อ/รุ่น/สีเฉพาะกลุ่มงานหลังคา */
const DETAIL_GROUPS = ["งานหลังคา"];
const DETAIL_TYPES = ["กระเบื้องหลังคา", "เมทัลชีท", "อื่นๆ"];
function DetailBox({ d, onChange }: { d?: ProductDetail; onChange: (d: ProductDetail | undefined) => void }) {
  const cur = d ?? {};
  const set = (p: Partial<ProductDetail>) => { const n = { ...cur, ...p }; onChange(hasDetail(n) ? n : undefined); };
  const tile = cur.type === "กระเบื้องหลังคา";
  const sel = (v: string | undefined, opts: readonly string[], on: (v: string) => void, ph: string) => (
    <select value={v ?? ""} onChange={(e) => on(e.target.value)} className={cn(inputCls, "min-w-0")}>
      <option value="">{ph}</option>
      {opts.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
  const txt = (v: string | undefined, on: (v: string) => void, ph: string) => <input value={v ?? ""} onChange={(e) => on(e.target.value)} placeholder={ph} className={cn(inputCls, "min-w-0")} />;
  return (
    <details open={hasDetail(d)} className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2">
      <summary className="cursor-pointer text-[12px] font-semibold text-slate-600">
        ระบุสินค้าที่ใช้ (ไม่บังคับ){hasDetail(d) && <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">กรอกแล้ว</span>}
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sel(cur.type, DETAIL_TYPES, (v) => set({ type: v, brand: undefined, model: undefined, color: undefined }), "ชนิดสินค้า...")}
        {tile ? sel(cur.brand, TILE_OPTS, (v) => set({ brand: v }), "ยี่ห้อ...") : txt(cur.brand, (v) => set({ brand: v }), "ยี่ห้อ")}
        {tile ? sel(cur.model, TILE_MODEL_OPTS, (v) => set({ model: v }), "รุ่น...") : txt(cur.model, (v) => set({ model: v }), "รุ่น")}
        {tile ? sel(cur.color, COLOR_OPTS, (v) => set({ color: v }), "สี...") : txt(cur.color, (v) => set({ color: v }), "สี")}
      </div>
      <p className="mt-1.5 text-[10.5px] text-slate-400">ถามลูกค้าถ้าทราบ ค่าที่กรอกจะเติมลงใบเปิดงานให้ตอนเปิด Opp</p>
    </details>
  );
}

/* คำถามรูปแบบการซื้อ : แสดงเมื่อสนใจสินค้าและไม่มีบริการ */
function BuyQuestion({ value, onChange }: { value?: BuyMode; onChange: (v: BuyMode) => void }) {
  const opts: { k: BuyMode; icon: string; sub: string }[] = [
    { k: "product", icon: "storefront", sub: "ส่งให้ร้านทำใบเสนอราคา" },
    { k: "design", icon: "architecture", sub: "เปิด Opp ออกแบบพร้อมเสนอราคา" },
    { k: "unsure", icon: "help", sub: "สกรีนต่อ ถามความต้องการเพิ่ม" },
  ];
  return (
    <div className={cn("mt-3 rounded-xl border p-3", value ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50")}>
      <p className="mb-2 text-[12.5px] font-bold text-slate-800">ลูกค้าต้องการแบบไหน * <span className="font-normal text-slate-500">· ใช้เลือกเส้นทางของ Lead</span></p>
      <div className="grid gap-2 sm:grid-cols-3">
        {opts.map((o) => (
          <button key={o.k} type="button" onClick={() => onChange(o.k)} className={cn("flex items-start gap-2 rounded-xl border bg-white p-2.5 text-left transition", value === o.k ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200 hover:border-indigo-300")}>
            <Icon name={o.icon} className={value === o.k ? "text-indigo-600" : "text-slate-400"} />
            <span><b className="block text-[12px] text-slate-900">{BUY_LABEL[o.k]}</b><span className="text-[10.5px] text-slate-500">{o.sub}</span></span>
          </button>
        ))}
      </div>
      {!value && <p className="mt-2 text-[11px] font-semibold text-amber-700">กรุณาเลือก 1 ตัวเลือก</p>}
    </div>
  );
}

export function InterestEditor({ kind, value, onChange, buy, onBuy }: { kind: InterestKind; value: Interest[]; onChange: (v: Interest[]) => void; buy?: BuyMode; onBuy?: (v: BuyMode) => void }) {
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
          <div key={idx}>
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
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
          {kind === "service" && v.item && DETAIL_GROUPS.includes(v.group) && <DetailBox d={v.detail} onChange={(d) => patch(idx, { detail: d })} />}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...value, { kind, group: "", item: "" }])} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-emerald-700 hover:underline"><Icon name="add" style={{ fontSize: 17 }} />เพิ่มรายการ</button>
      {kind === "product" && onBuy && needsBuyMode(value) && mine.some((x) => x.v.group && x.v.item) && <BuyQuestion value={buy} onChange={onBuy} />}
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
          <Icon name={META[i.kind].icon} style={{ fontSize: 12 }} />{i.item}{hasDetail(i.detail) ? ` · ${detailText(i.detail)}` : ""}
        </span>
      ))}
      {max && c.length > max && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">+{c.length - max}</span>}
    </div>
  );
}
