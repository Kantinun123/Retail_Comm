/* =============================================================
   Avatar style store — เก็บสไตล์ DiceBear ที่ผู้ใช้เลือก (ต่อ pKey)
   เก็บใน localStorage "emp:<id>" / "dealer:<code>"
   ยังไม่ sync ข้ามอุปกรณ์ (ย้ายขึ้น Supabase profile ได้ภายหลัง)
   ============================================================= */

export interface AvatarStyleConfig {
  styleId: string; // id สไตล์ DiceBear (เช่น "adventurer")
  seed: string;    // seed (ปกติ = empId/dealerCode เพื่อ avatar ประจำตัว)
}

export const DEFAULT_STYLE = "adventurer";

const STORAGE_KEY = "cmAvatarStyle";
type Store = Record<string, AvatarStyleConfig>;

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
export function subscribeAvatarStyle(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** อ่าน config ของคีย์ (คืน null ถ้ายังไม่เลือก — ให้ fallback ที่ผู้เรียก) */
export function getAvatarStyle(key: string | null): AvatarStyleConfig | null {
  if (!key) return null;
  return readStore()[key] ?? null;
}

/** บันทึกสไตล์ที่เลือก */
export function saveAvatarStyle(key: string, config: AvatarStyleConfig) {
  const store = readStore();
  store[key] = config;
  writeStore(store);
  emit();
}
