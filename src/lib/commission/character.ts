/* =============================================================
   ตัวละครแต่งตัว (สไตล์ชิบิเต็มตัว) — config + ตัวเลือก + store
   เก็บใน localStorage คีย์เดียวกับโปรไฟล์ ("emp:<id>" / "dealer:<code>")
   ยังไม่ sync ข้ามอุปกรณ์ (ย้ายขึ้น Supabase profile ได้ภายหลัง)
   ============================================================= */

export type Gender = "male" | "female";

export interface CharacterConfig {
  gender: Gender;
  species: string;      // "human" | สายพันธุ์สัตว์ (cat/dog/...)
  furColor: string;     // สีขนสัตว์ (ใช้เมื่อ species != human)
  skin: string;         // สีผิว (human)
  // --- ใบหน้า ---
  faceShape: string;    // รูปทรงใบหน้า
  brows: string;        // คิ้ว
  eyes: string;         // ตา
  lashes: string;       // ขนตา ("none")
  nose: string;         // จมูก ("none")
  mouth: string;        // ปาก
  ears: string;         // หู
  // --- ผม/เสื้อผ้า ---
  hair: string;
  hairColor: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  shoes: string;
  shoesColor: string;
  // --- ของสวมใส่ ---
  hat: string;          // ("none")
  hatColor: string;
  accessory: string;    // ("none")
  bag: string;          // ("none")
  bgColor: string;
  // --- ชุดคอสตูม/ฮีโร่ (preset ทับเสื้อผ้าปกติ) ---
  costume: string;      // id ชุดฮีโร่ ("none" = แต่งเสื้อผ้าปกติ)
}

/* ---------------- ตัวเลือกแต่ละหมวด ---------------- */
export interface PartOption {
  id: string;
  label: string;
  /** ปลดล็อกด้วยแต้ม (0/undefined = ฟรี) */
  cost?: number;
}

export const SKIN_TONES = ["#ffe0bd", "#f1c9a5", "#e0ac86", "#c68642", "#8d5524", "#ffd9c0"];
export const HAIR_COLORS = ["#2b1d14", "#4a3526", "#5b3a29", "#8a5a2b", "#c9a227", "#1a1a1a", "#b5651d", "#d9d9d9", "#e05a8a", "#8e44ad"];
export const CLOTH_COLORS = ["#d32029", "#2980e8", "#3fae6a", "#f4a51c", "#8e44ad", "#2f3b4c", "#e05a8a", "#ffffff", "#2b2b2b", "#16a085"];
export const BG_COLORS = ["#ffe3e3", "#e3f0ff", "#e3ffe9", "#fff3dc", "#f0e3ff", "#eceff3", "#ffe8f3", "#e8fbff"];
export const FUR_COLORS = ["#f4a24a", "#cfa579", "#b5834e", "#f7f3f5", "#e07a3a", "#9a9a9a", "#2a2a2a", "#f4c84a", "#8a5a3a", "#6cbf4a", "#f7b5c8", "#b8926a"];

/* ---------------- สายพันธุ์ (human + 30 สัตว์ ฟรีหมด) ----------------
   species ตัวนี้บอก "หัว" ที่จะวาด — ลำตัว/เสื้อผ้า/ไอเทมใช้ร่วมกันทุกสายพันธุ์
   defColor = สีขนเริ่มต้นแนะนำของสายพันธุ์นั้น */
export interface SpeciesOption extends PartOption {
  defColor?: string;
}
export const SPECIES_OPTIONS: SpeciesOption[] = [
  // เอา "คน" (human) ออก — ใช้เฉพาะสัตว์ (renderer ยังรองรับ human ไว้เผื่อเปิดคืน)
  { id: "cat", label: "แมว", defColor: "#f4a24a" },
  { id: "dog", label: "หมา", defColor: "#cfa579" },
  { id: "bear", label: "หมี", defColor: "#b5834e" },
  { id: "rabbit", label: "กระต่าย", defColor: "#f7f3f5" },
  { id: "fox", label: "จิ้งจอก", defColor: "#e07a3a" },
  { id: "panda", label: "แพนด้า", defColor: "#ffffff" },
  { id: "tiger", label: "เสือ", defColor: "#f4c84a" },
  { id: "lion", label: "สิงโต", defColor: "#e8c088" },
  { id: "elephant", label: "ช้าง", defColor: "#9a9a9a" },
  { id: "pig", label: "หมู", defColor: "#f7b5c8" },
  { id: "sheep", label: "แกะ", defColor: "#f0ede8" },
  { id: "penguin", label: "เพนกวิน", defColor: "#3a3a3a" },
  { id: "bird", label: "นก", defColor: "#5ab0e8" },
  { id: "frog", label: "กบ", defColor: "#6cbf4a" },
  { id: "hamster", label: "แฮมสเตอร์", defColor: "#f2dcb8" },
  { id: "squirrel", label: "กระรอก", defColor: "#d0a060" },
  { id: "monkey", label: "ลิง", defColor: "#8a5a3a" },
  { id: "owl", label: "นกฮูก", defColor: "#b89060" },
  { id: "deer", label: "กวาง", defColor: "#b8926a" },
  { id: "zebra", label: "ม้าลาย", defColor: "#f0f0f0" },
  { id: "raccoon", label: "แรคคูน", defColor: "#b0b0b0" },
  { id: "koala", label: "โคอาลา", defColor: "#c8b0d8" },
  { id: "turtle", label: "เต่า", defColor: "#7ac868" },
  { id: "kangaroo", label: "จิงโจ้", defColor: "#d8a878" },
  { id: "giraffe", label: "ยีราฟ", defColor: "#e8d088" },
  { id: "dolphin", label: "โลมา", defColor: "#9ad0e8" },
  { id: "wolf", label: "หมาป่า", defColor: "#8a8a9a" },
  { id: "redpanda", label: "แพนด้าแดง", defColor: "#c86a3a" },
  { id: "parrot", label: "นกแก้ว", defColor: "#3a6a9a" },
  { id: "crocodile", label: "จระเข้", defColor: "#4a8a5a" },
];

/* ----- ใบหน้า ----- */
export const FACE_OPTIONS: PartOption[] = [
  { id: "round", label: "กลม" },
  { id: "oval", label: "รูปไข่" },
  { id: "square", label: "เหลี่ยม" },
  { id: "heart", label: "หัวใจ", cost: 60 },
];

export const BROW_OPTIONS: PartOption[] = [
  { id: "natural", label: "ธรรมชาติ" },
  { id: "thick", label: "หนา" },
  { id: "thin", label: "บาง" },
  { id: "worried", label: "กังวล" },
];

export const EYE_OPTIONS: PartOption[] = [
  { id: "round", label: "กลมโต" },
  { id: "sleepy", label: "ง่วง" },
  { id: "happy", label: "ยิ้ม" },
  { id: "wink", label: "ขยิบตา", cost: 40 },
  { id: "star", label: "ตาดาว", cost: 150 },
];

export const LASH_OPTIONS: PartOption[] = [
  { id: "none", label: "ไม่มี" },
  { id: "short", label: "สั้น" },
  { id: "long", label: "ยาว", cost: 50 },
];

export const NOSE_OPTIONS: PartOption[] = [
  { id: "none", label: "ไม่มี" },
  { id: "dot", label: "จุด" },
  { id: "line", label: "ขีด" },
  { id: "button", label: "กลม" },
];

export const MOUTH_OPTIONS: PartOption[] = [
  { id: "smile", label: "ยิ้ม" },
  { id: "grin", label: "ยิ้มกว้าง" },
  { id: "neutral", label: "เฉย" },
  { id: "open", label: "อ้า" },
  { id: "smirk", label: "ยิ้มมุมปาก", cost: 40 },
];

export const EAR_OPTIONS: PartOption[] = [
  { id: "normal", label: "ปกติ" },
  { id: "small", label: "เล็ก" },
  { id: "none", label: "ซ่อน (มีผมคลุม)" },
];

/* ----- ผม/เสื้อผ้า ----- */
export const HAIR_OPTIONS: PartOption[] = [
  { id: "short", label: "สั้น" },
  { id: "long", label: "ยาว" },
  { id: "curly", label: "หยิก" },
  { id: "bun", label: "มวยผม" },
  { id: "ponytail", label: "หางม้า", cost: 60 },
  { id: "spiky", label: "ตั้งแหลม", cost: 80 },
  { id: "bald", label: "ไม่มีผม" },
];

export const TOP_OPTIONS: PartOption[] = [
  { id: "tee", label: "เสื้อยืด" },
  { id: "jacket", label: "แจ็คเก็ต" },
  { id: "vest", label: "เสื้อกั๊ก" },
  { id: "hoodie", label: "ฮู้ดดี้" },
  { id: "polo", label: "โปโล", cost: 70 },
  { id: "suit", label: "สูท", cost: 200 },
];

export const BOTTOM_OPTIONS: PartOption[] = [
  { id: "pants", label: "กางเกงขายาว" },
  { id: "shorts", label: "ขาสั้น" },
  { id: "skirt", label: "กระโปรง" },
  { id: "cargo", label: "คาร์โก้", cost: 60 },
];

export const SHOES_OPTIONS: PartOption[] = [
  { id: "sneakers", label: "ผ้าใบ" },
  { id: "boots", label: "บูท" },
  { id: "sandals", label: "แตะ" },
];

export const HAT_OPTIONS: PartOption[] = [
  { id: "none", label: "ไม่ใส่" },
  { id: "cap", label: "แก๊ป" },
  { id: "beanie", label: "บีนนี่" },
  { id: "hardhat", label: "หมวกช่าง", cost: 120 },
  { id: "crown", label: "มงกุฎ", cost: 300 },
];

export const ACCESSORY_OPTIONS: PartOption[] = [
  { id: "none", label: "ไม่มี" },
  { id: "glasses", label: "แว่นตา" },
  { id: "sunglasses", label: "แว่นกันแดด", cost: 80 },
  { id: "mask", label: "แมสก์" },
  { id: "earring", label: "ต่างหู", cost: 50 },
];

export const BAG_OPTIONS: PartOption[] = [
  { id: "none", label: "ไม่มี" },
  { id: "backpack", label: "เป้" },
  { id: "sling", label: "กระเป๋าสะพาย", cost: 60 },
];

/* ---------------- ชุดคอสตูม/ฮีโร่ (original ไม่ติดลิขสิทธิ์) ----------------
   เป็น preset: วาดทับเสื้อผ้าปกติ (เสื้อ/กางเกง/รองเท้า) ด้วยชุดเฉพาะ
   emblem = สัญลักษณ์บนอก: star | bolt | shield | flame | moon | drop | leaf |
            diamond | heart | none
   cape   = สี cape (undefined = ไม่มีผ้าคลุม)
   mask   = รูปแบบหน้ากาก: eye (รอบตา) | full (เต็มหน้า) | visor (บังตา) | none
*/
export type Emblem = "star" | "bolt" | "shield" | "flame" | "moon" | "drop" | "leaf" | "diamond" | "heart" | "none";
export interface CostumeDef extends PartOption {
  suit: string;      // สีชุดหลัก
  accent: string;    // สีรอง (เข็มขัด/ขอบ/ถุงมือ-บูท)
  cape?: string;     // สีผ้าคลุม (ไม่มี = undefined)
  mask: "eye" | "full" | "visor" | "none";
  emblem: Emblem;
  emblemColor: string;
}

export const COSTUME_OPTIONS: CostumeDef[] = [
  { id: "none", label: "ไม่ใส่ (ชุดปกติ)", suit: "", accent: "", mask: "none", emblem: "none", emblemColor: "" },
  // --- ชุดเริ่มต้นราคาถูก ---
  { id: "crimson", label: "เพลิงแดง", cost: 200, suit: "#d32029", accent: "#f4c430", cape: "#8f1114", mask: "eye", emblem: "flame", emblemColor: "#f4c430" },
  { id: "azure", label: "สายฟ้าคราม", cost: 200, suit: "#2980e8", accent: "#f4d000", cape: "#1b3a78", mask: "eye", emblem: "bolt", emblemColor: "#f4d000" },
  { id: "verdant", label: "พิทักษ์ป่า", cost: 220, suit: "#2f9e52", accent: "#8a5a2b", mask: "eye", emblem: "leaf", emblemColor: "#eaffd0" },
  { id: "midnight", label: "อัศวินรัตติกาล", cost: 260, suit: "#2b2b3a", accent: "#8f9bb0", cape: "#14141f", mask: "full", emblem: "moon", emblemColor: "#cfd6e4" },
  { id: "solar", label: "สุริยะเทพ", cost: 260, suit: "#f4a51c", accent: "#d32029", cape: "#ffcf5c", mask: "eye", emblem: "star", emblemColor: "#fff3cf" },
  { id: "aqua", label: "เจ้าสมุทร", cost: 240, suit: "#16a0c0", accent: "#0a5a70", mask: "eye", emblem: "drop", emblemColor: "#d6f6ff" },
  { id: "violet", label: "เวทย์ม่วง", cost: 280, suit: "#8e44ad", accent: "#f4c430", cape: "#5e2d78", mask: "eye", emblem: "star", emblemColor: "#f4c430" },
  { id: "steelguard", label: "เกราะเหล็ก", cost: 300, suit: "#8f9bb0", accent: "#d32029", mask: "visor", emblem: "shield", emblemColor: "#d32029" },
  { id: "shadow", label: "นักรบเงา", cost: 300, suit: "#1f2430", accent: "#9b59b6", cape: "#121521", mask: "full", emblem: "none", emblemColor: "" },
  // --- ชุดระดับกลาง ---
  { id: "emberknight", label: "อัศวินเพลิง", cost: 340, suit: "#b0141c", accent: "#2b2b2b", cape: "#f4a51c", mask: "visor", emblem: "flame", emblemColor: "#ffd36e" },
  { id: "frost", label: "ราชาน้ำแข็ง", cost: 340, suit: "#bfe6ff", accent: "#2980e8", cape: "#8fcff0", mask: "eye", emblem: "diamond", emblemColor: "#2980e8" },
  { id: "jade", label: "มังกรหยก", cost: 360, suit: "#0f7a52", accent: "#f4c430", cape: "#0a5a3a", mask: "full", emblem: "shield", emblemColor: "#f4c430" },
  { id: "rose", label: "กุหลาบเพลิง", cost: 360, suit: "#e05a8a", accent: "#ffffff", cape: "#b83b68", mask: "eye", emblem: "heart", emblemColor: "#ffffff" },
  { id: "thunderlord", label: "เจ้าสายฟ้า", cost: 400, suit: "#3a3f8a", accent: "#f4d000", cape: "#23265e", mask: "visor", emblem: "bolt", emblemColor: "#ffe14d" },
  { id: "phoenix", label: "ฟีนิกซ์", cost: 420, suit: "#ff6a1a", accent: "#f4c430", cape: "#d12e00", mask: "eye", emblem: "flame", emblemColor: "#ffe14d" },
  // --- ชุดระดับสูง/หายาก ---
  { id: "cosmos", label: "เทพจักรวาล", cost: 500, suit: "#2a1a5e", accent: "#9b7bff", cape: "#16103a", mask: "full", emblem: "star", emblemColor: "#cfc0ff" },
  { id: "goldsentinel", label: "ผู้พิทักษ์ทองคำ", cost: 550, suit: "#e8b84b", accent: "#8a5a2b", cape: "#c99a2e", mask: "visor", emblem: "shield", emblemColor: "#5a3a12" },
  { id: "titan", label: "ไททันเหล็กกล้า", cost: 600, suit: "#5a6474", accent: "#f4a51c", cape: "#3a4250", mask: "full", emblem: "diamond", emblemColor: "#f4a51c" },
  { id: "celestial", label: "เทวาสวรรค์", cost: 700, suit: "#fff3d6", accent: "#f4c430", cape: "#ffe9a8", mask: "eye", emblem: "star", emblemColor: "#f4a51c" },
  { id: "dragonlord", label: "จ้าวมังกร", cost: 800, suit: "#7a0f12", accent: "#f4c430", cape: "#2b2b2b", mask: "full", emblem: "flame", emblemColor: "#ff6a1a" },
];

/* ---------------- ค่าเริ่มต้น ---------------- */
export function defaultCharacter(gender: Gender = "male"): CharacterConfig {
  return {
    gender,
    species: "cat",            // ค่าเริ่มต้นเป็นสัตว์ (ตัวแรก) — ไม่มี human แล้ว
    furColor: "#f4a24a",
    skin: SKIN_TONES[0],
    faceShape: "round",
    brows: "natural",
    eyes: "round",
    lashes: gender === "female" ? "short" : "none",
    nose: "dot",
    mouth: "smile",
    ears: "normal",
    hair: gender === "female" ? "long" : "short",
    hairColor: HAIR_COLORS[1],
    top: "tee",
    topColor: gender === "female" ? "#e05a8a" : "#2980e8",
    bottom: gender === "female" ? "skirt" : "pants",
    bottomColor: "#2f3b4c",
    shoes: "sneakers",
    shoesColor: "#ffffff",
    hat: "none",
    hatColor: "#d32029",
    accessory: "none",
    bag: "none",
    bgColor: BG_COLORS[0],
    costume: "none",
  };
}

/** รวมทุกหมวดที่มี cost เพื่อเช็คการปลดล็อก (field -> options) */
export const COST_PARTS: { field: keyof CharacterConfig; options: PartOption[] }[] = [
  { field: "faceShape", options: FACE_OPTIONS },
  { field: "eyes", options: EYE_OPTIONS },
  { field: "lashes", options: LASH_OPTIONS },
  { field: "mouth", options: MOUTH_OPTIONS },
  { field: "hair", options: HAIR_OPTIONS },
  { field: "top", options: TOP_OPTIONS },
  { field: "bottom", options: BOTTOM_OPTIONS },
  { field: "hat", options: HAT_OPTIONS },
  { field: "accessory", options: ACCESSORY_OPTIONS },
  { field: "bag", options: BAG_OPTIONS },
  { field: "costume", options: COSTUME_OPTIONS },
];

/** หา costume def จาก id */
export function costumeById(id: string): CostumeDef | undefined {
  return COSTUME_OPTIONS.find((c) => c.id === id);
}

/** หา species จาก id */
export function speciesById(id: string): SpeciesOption | undefined {
  return SPECIES_OPTIONS.find((s) => s.id === id);
}

/** ไอเทมถูกล็อกไหม = มี cost และแต้มไม่พอ */
export function isLocked(opt: PartOption, availablePoints: number): boolean {
  return !!opt.cost && availablePoints < opt.cost;
}

/* ---------------- store (localStorage) ---------------- */
const STORAGE_KEY = "cmCharacters";
type Store = Record<string, CharacterConfig>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? (p as Store) : {};
  } catch {
    return {};
  }
}
function writeStore(s: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
export function subscribeCharacter(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** อ่าน config ของคีย์ (merge กับ default กัน field ใหม่หาย)
 *  migrate: ถ้า config เดิมเป็น human (หรือยังไม่มี species) -> เปลี่ยนเป็นสัตว์ default */
export function getCharacter(key: string | null): CharacterConfig | null {
  if (!key) return null;
  const saved = readStore()[key];
  if (!saved) return defaultCharacter();
  const merged = { ...defaultCharacter(saved.gender), ...saved };
  if (!merged.species || merged.species === "human") {
    merged.species = "cat";
    merged.furColor = "#f4a24a";
  }
  return merged;
}

/** มี config ที่บันทึกไว้แล้วหรือยัง */
export function hasCharacter(key: string | null): boolean {
  if (!key) return false;
  return !!readStore()[key];
}

/** บันทึก config */
export function saveCharacter(key: string, config: CharacterConfig) {
  const store = readStore();
  store[key] = config;
  writeStore(store);
  emit();
}

/** สุ่ม config (คงเพศเดิม) — เลือกเฉพาะไอเทมที่ปลดล็อกแล้ว (ตาม availablePoints) */
export function randomCharacter(gender: Gender, availablePoints = Infinity): CharacterConfig {
  const pickUnlocked = (arr: PartOption[]): string => {
    const avail = arr.filter((o) => !isLocked(o, availablePoints));
    const list = avail.length ? avail : arr;
    return list[Math.floor(Math.random() * list.length)].id;
  };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const base = defaultCharacter(gender);
  const sp = pick(SPECIES_OPTIONS); // สุ่มสายพันธุ์สัตว์
  return {
    ...base,
    species: sp.id,
    furColor: sp.defColor ?? base.furColor,
    skin: pick(SKIN_TONES),
    faceShape: pickUnlocked(FACE_OPTIONS),
    brows: pickUnlocked(BROW_OPTIONS),
    eyes: pickUnlocked(EYE_OPTIONS),
    lashes: pickUnlocked(LASH_OPTIONS),
    nose: pickUnlocked(NOSE_OPTIONS),
    mouth: pickUnlocked(MOUTH_OPTIONS),
    ears: pickUnlocked(EAR_OPTIONS),
    hair: pickUnlocked(HAIR_OPTIONS),
    hairColor: pick(HAIR_COLORS),
    top: pickUnlocked(TOP_OPTIONS),
    topColor: pick(CLOTH_COLORS),
    bottom: pickUnlocked(BOTTOM_OPTIONS),
    bottomColor: pick(CLOTH_COLORS),
    shoes: pickUnlocked(SHOES_OPTIONS),
    shoesColor: pick(CLOTH_COLORS),
    hat: pickUnlocked(HAT_OPTIONS),
    hatColor: pick(CLOTH_COLORS),
    accessory: pickUnlocked(ACCESSORY_OPTIONS),
    bag: pickUnlocked(BAG_OPTIONS),
    bgColor: pick(BG_COLORS),
    costume: "none", // สุ่มไม่แจกชุดฮีโร่ (เป็นของปลดล็อกตั้งใจเลือก)
  };
}
