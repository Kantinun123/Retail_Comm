"use client";

/* =============================================================
   ห้องแต่งตัว (โมดอล) — หมวดใบหน้า + เสื้อผ้า + ของสวมใส่
   สลับชิ้นส่วน + สี + preview สด + ปลดล็อกด้วยแต้ม + บันทึก/สุ่ม
   ============================================================= */
import { useState } from "react";
import { Icon } from "./icon";
import { CharacterAvatar } from "./character-avatar";
import {
  type CharacterConfig,
  type Gender,
  type PartOption,
  FACE_OPTIONS,
  BROW_OPTIONS,
  EYE_OPTIONS,
  LASH_OPTIONS,
  NOSE_OPTIONS,
  MOUTH_OPTIONS,
  EAR_OPTIONS,
  HAIR_OPTIONS,
  TOP_OPTIONS,
  BOTTOM_OPTIONS,
  SHOES_OPTIONS,
  HAT_OPTIONS,
  ACCESSORY_OPTIONS,
  BAG_OPTIONS,
  COSTUME_OPTIONS,
  SPECIES_OPTIONS,
  SKIN_TONES,
  HAIR_COLORS,
  CLOTH_COLORS,
  BG_COLORS,
  FUR_COLORS,
  speciesById,
  randomCharacter,
  isLocked,
} from "@/lib/commission/character";

type Group = "species" | "face" | "hair" | "outfit" | "extra" | "costume";

interface Cat {
  key: string;
  label: string;
  group: Group;
  options: PartOption[];
  partField: keyof CharacterConfig;
  colorField?: keyof CharacterConfig;
  colors?: string[];
}

const CATEGORIES: Cat[] = [
  // สายพันธุ์
  { key: "species", label: "สายพันธุ์", group: "species", options: SPECIES_OPTIONS, partField: "species" },
  // ใบหน้า
  { key: "faceShape", label: "รูปหน้า", group: "face", options: FACE_OPTIONS, partField: "faceShape" },
  { key: "brows", label: "คิ้ว", group: "face", options: BROW_OPTIONS, partField: "brows" },
  { key: "eyes", label: "ตา", group: "face", options: EYE_OPTIONS, partField: "eyes" },
  { key: "lashes", label: "ขนตา", group: "face", options: LASH_OPTIONS, partField: "lashes" },
  { key: "nose", label: "จมูก", group: "face", options: NOSE_OPTIONS, partField: "nose" },
  { key: "mouth", label: "ปาก", group: "face", options: MOUTH_OPTIONS, partField: "mouth" },
  { key: "ears", label: "หู", group: "face", options: EAR_OPTIONS, partField: "ears" },
  // ผม
  { key: "hair", label: "ทรงผม", group: "hair", options: HAIR_OPTIONS, partField: "hair", colorField: "hairColor", colors: HAIR_COLORS },
  // เสื้อผ้า
  { key: "top", label: "เสื้อ", group: "outfit", options: TOP_OPTIONS, partField: "top", colorField: "topColor", colors: CLOTH_COLORS },
  { key: "bottom", label: "ท่อนล่าง", group: "outfit", options: BOTTOM_OPTIONS, partField: "bottom", colorField: "bottomColor", colors: CLOTH_COLORS },
  { key: "shoes", label: "รองเท้า", group: "outfit", options: SHOES_OPTIONS, partField: "shoes", colorField: "shoesColor", colors: CLOTH_COLORS },
  // ของสวมใส่
  { key: "hat", label: "หมวก", group: "extra", options: HAT_OPTIONS, partField: "hat", colorField: "hatColor", colors: CLOTH_COLORS },
  { key: "accessory", label: "ของประดับ", group: "extra", options: ACCESSORY_OPTIONS, partField: "accessory" },
  { key: "bag", label: "เป้", group: "extra", options: BAG_OPTIONS, partField: "bag" },
  // ชุดฮีโร่ (preset)
  { key: "costume", label: "ชุดฮีโร่", group: "costume", options: COSTUME_OPTIONS, partField: "costume" },
];

const GROUPS: { key: Group; label: string; icon: string }[] = [
  { key: "species", label: "สายพันธุ์", icon: "pets" },
  // ซ่อนกลุ่ม "ใบหน้า" และ "ผม" ไว้ก่อน (ตามคำขอ) — ใช้ตัวละคร+ใบหน้าตามดีไซน์เริ่มต้น
  // config/renderer ยังอยู่ครบ เปิดคืนได้โดย uncomment 2 บรรทัดนี้
  // { key: "face", label: "ใบหน้า", icon: "face" },
  // { key: "hair", label: "ผม", icon: "content_cut" },
  { key: "outfit", label: "เสื้อผ้า", icon: "checkroom" },
  { key: "extra", label: "ของสวมใส่", icon: "diamond" },
  { key: "costume", label: "ชุดฮีโร่", icon: "bolt" },
];

export function DressingRoom({
  initial,
  availablePoints = 0,
  onSave,
  onClose,
}: {
  initial: CharacterConfig;
  /** แต้มที่มี — ใช้เช็คปลดล็อกไอเทม cost>0 */
  availablePoints?: number;
  onSave: (c: CharacterConfig) => void;
  onClose: () => void;
}) {
  const [cfg, setCfg] = useState<CharacterConfig>(initial);
  const [group, setGroup] = useState<Group>("species");
  const [catKey, setCatKey] = useState<string>("species");
  const isAnimal = cfg.species !== "human";

  const cats = CATEGORIES.filter((x) => x.group === group);
  const active = CATEGORIES.find((x) => x.key === catKey) ?? cats[0];
  const set = (patch: Partial<CharacterConfig>) => setCfg((c) => ({ ...c, ...patch }));

  /** เลือกไอเทม — ถ้าเป็นสายพันธุ์ ให้ตั้งสีขนเริ่มต้นของสายพันธุ์นั้นด้วย */
  function selectOption(field: keyof CharacterConfig, id: string) {
    if (field === "species") {
      const sp = speciesById(id);
      setCfg((c) => ({ ...c, species: id, furColor: sp?.defColor ?? c.furColor }));
    } else {
      setCfg((c) => ({ ...c, [field]: id }));
    }
  }
  /** config สำหรับ thumbnail ของไอเทม (ถ้าเป็นสายพันธุ์ ใช้สีขนเริ่มต้นให้ดูถูก) */
  function thumbConfig(field: keyof CharacterConfig, id: string): CharacterConfig {
    if (field === "species") {
      const sp = speciesById(id);
      return { ...cfg, species: id, furColor: sp?.defColor ?? cfg.furColor };
    }
    return { ...cfg, [field]: id } as CharacterConfig;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[#f7f4f4] rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] overflow-hidden flex flex-col animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
          <p className="text-[15px] font-bold text-slate-800 flex items-center gap-1.5">
            <Icon name="checkroom" className="text-[#d32029]" /> ห้องแต่งตัว
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
              <Icon name="stars" style={{ fontSize: 14 }} /> {availablePoints.toLocaleString("th-TH")} แต้ม
            </span>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">
              <Icon name="close" />
            </button>
          </div>
        </div>

        {/* preview + gender + สีผิว/พื้นหลัง */}
        <div className="flex items-center gap-4 px-4 py-3 bg-gradient-to-br from-[#d32029] to-[#8f1114]">
          <div className="rounded-2xl bg-white/15 border border-white/20 p-1 shrink-0">
            <CharacterAvatar config={cfg} size={128} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex rounded-full bg-white/20 p-1 mb-2">
              {(["male", "female"] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => set({ gender: g })}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition ${cfg.gender === g ? "bg-white text-[#a11119]" : "text-white"}`}
                >
                  {g === "male" ? "ชาย" : "หญิง"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {isAnimal ? (
                <ColorRow label="สีขน" colors={FUR_COLORS} value={cfg.furColor} onPick={(v) => set({ furColor: v })} light />
              ) : (
                <ColorRow label="สีผิว" colors={SKIN_TONES} value={cfg.skin} onPick={(v) => set({ skin: v })} light />
              )}
              <ColorRow label="พื้นหลัง" colors={BG_COLORS} value={cfg.bgColor} onPick={(v) => set({ bgColor: v })} light />
            </div>
          </div>
        </div>

        {/* group tabs */}
        <div className="flex gap-1 px-3 pt-2 bg-white">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => {
                setGroup(g.key);
                setCatKey(CATEGORIES.find((c) => c.group === g.key)!.key);
              }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[11px] font-bold transition ${group === g.key ? "bg-red-50 text-[#a11119]" : "text-slate-400"}`}
            >
              <Icon name={g.icon} style={{ fontSize: 18 }} />
              {g.label}
            </button>
          ))}
        </div>

        {/* sub-category chips */}
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto bg-white border-b border-slate-100">
          {cats.map((x) => (
            <button
              key={x.key}
              onClick={() => setCatKey(x.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap transition ${active.key === x.key ? "bg-[#d32029] text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {x.label}
            </button>
          ))}
        </div>

        {/* items + colors */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-4 gap-2">
            {active.options.map((opt) => {
              const selected = cfg[active.partField] === opt.id;
              const locked = isLocked(opt, availablePoints);
              return (
                <button
                  key={opt.id}
                  disabled={locked}
                  onClick={() => selectOption(active.partField, opt.id)}
                  className={`relative rounded-xl bg-white border-2 p-1.5 flex flex-col items-center gap-1 transition ${
                    selected ? "border-[#d32029]" : "border-slate-200"
                  } ${locked ? "opacity-60" : "active:scale-95"}`}
                >
                  <div className="h-14 flex items-center justify-center overflow-hidden">
                    <CharacterAvatar config={thumbConfig(active.partField, opt.id)} size={64} showBg={false} />
                  </div>
                  <span className="text-[9px] text-slate-500 leading-tight text-center">{opt.label}</span>
                  {!!opt.cost && (
                    <span
                      className={`absolute -top-1.5 -right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                        locked ? "bg-slate-600 text-white" : "bg-amber-400 text-amber-900"
                      }`}
                    >
                      {locked && <Icon name="lock" style={{ fontSize: 9 }} />}
                      {opt.cost}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {active.colorField && active.colors && (
            <div className="mt-4">
              <p className="text-[11px] font-bold text-slate-500 mb-2">สี</p>
              <div className="flex flex-wrap gap-2">
                {active.colors.map((col) => {
                  const on = cfg[active.colorField!] === col;
                  return (
                    <button
                      key={col}
                      onClick={() => set({ [active.colorField!]: col } as Partial<CharacterConfig>)}
                      className={`w-8 h-8 rounded-full transition active:scale-90 ${on ? "ring-2 ring-offset-2 ring-[#231313]" : ""}`}
                      style={{ backgroundColor: col, border: col === "#ffffff" ? "1px solid #ddd" : "none" }}
                      aria-label={col}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex gap-2 px-4 py-3 bg-white border-t border-slate-100">
          <button
            onClick={() => setCfg(randomCharacter(cfg.gender, availablePoints))}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-bold active:scale-[0.98] transition"
          >
            🎲 สุ่ม
          </button>
          <button
            onClick={() => onSave(cfg)}
            className="flex-1 py-2.5 rounded-xl bg-[#d32029] text-white text-[13px] font-bold active:scale-[0.99] transition"
          >
            บันทึกตัวละคร
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorRow({
  label, colors, value, onPick, light,
}: {
  label: string; colors: string[]; value: string; onPick: (v: string) => void; light?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-semibold w-11 shrink-0 ${light ? "text-white/90" : "text-slate-500"}`}>{label}</span>
      <div className="flex gap-1 flex-wrap">
        {colors.map((col) => (
          <button
            key={col}
            onClick={() => onPick(col)}
            className={`w-5 h-5 rounded-full transition ${value === col ? "ring-2 ring-white" : ""}`}
            style={{ backgroundColor: col, border: col === "#ffffff" ? "1px solid #ddd" : "none" }}
            aria-label={col}
          />
        ))}
      </div>
    </div>
  );
}
