/* สร้างอัตโนมัติโดย scripts/gen-dicebear-styles.mjs — อย่าแก้ด้วยมือ
   รายการสไตล์ DiceBear ทั้งหมด (61 สไตล์) */
import adventurer from "@dicebear/styles/adventurer.json";
import adventurerNeutral from "@dicebear/styles/adventurer-neutral.json";
import avataaars from "@dicebear/styles/avataaars.json";
import avataaarsNeutral from "@dicebear/styles/avataaars-neutral.json";
import bigEars from "@dicebear/styles/big-ears.json";
import bigEarsNeutral from "@dicebear/styles/big-ears-neutral.json";
import bigSmile from "@dicebear/styles/big-smile.json";
import blobs from "@dicebear/styles/blobs.json";
import bottts from "@dicebear/styles/bottts.json";
import botttsNeutral from "@dicebear/styles/bottts-neutral.json";
import cameo from "@dicebear/styles/cameo.json";
import clay from "@dicebear/styles/clay.json";
import constellation from "@dicebear/styles/constellation.json";
import critters from "@dicebear/styles/critters.json";
import croodles from "@dicebear/styles/croodles.json";
import croodlesNeutral from "@dicebear/styles/croodles-neutral.json";
import cutouts from "@dicebear/styles/cutouts.json";
import disco from "@dicebear/styles/disco.json";
import dylan from "@dicebear/styles/dylan.json";
import funEmoji from "@dicebear/styles/fun-emoji.json";
import gaze from "@dicebear/styles/gaze.json";
import glass from "@dicebear/styles/glass.json";
import glyphs from "@dicebear/styles/glyphs.json";
import icons from "@dicebear/styles/icons.json";
import identicon from "@dicebear/styles/identicon.json";
import initialFace from "@dicebear/styles/initial-face.json";
import initials from "@dicebear/styles/initials.json";
import landscape from "@dicebear/styles/landscape.json";
import lineFace from "@dicebear/styles/line-face.json";
import loops from "@dicebear/styles/loops.json";
import lorelei from "@dicebear/styles/lorelei.json";
import loreleiNeutral from "@dicebear/styles/lorelei-neutral.json";
import marbles from "@dicebear/styles/marbles.json";
import micah from "@dicebear/styles/micah.json";
import miniavs from "@dicebear/styles/miniavs.json";
import moods from "@dicebear/styles/moods.json";
import notionists from "@dicebear/styles/notionists.json";
import notionistsNeutral from "@dicebear/styles/notionists-neutral.json";
import openPeeps from "@dicebear/styles/open-peeps.json";
import patchwork from "@dicebear/styles/patchwork.json";
import personas from "@dicebear/styles/personas.json";
import pixelArt from "@dicebear/styles/pixel-art.json";
import pixelArtNeutral from "@dicebear/styles/pixel-art-neutral.json";
import pixelbot from "@dicebear/styles/pixelbot.json";
import planets from "@dicebear/styles/planets.json";
import rings from "@dicebear/styles/rings.json";
import shadows from "@dicebear/styles/shadows.json";
import shapeGrid from "@dicebear/styles/shape-grid.json";
import shapes from "@dicebear/styles/shapes.json";
import slice from "@dicebear/styles/slice.json";
import sprouts from "@dicebear/styles/sprouts.json";
import squircles from "@dicebear/styles/squircles.json";
import stack from "@dicebear/styles/stack.json";
import stripes from "@dicebear/styles/stripes.json";
import thumbs from "@dicebear/styles/thumbs.json";
import toonHead from "@dicebear/styles/toon-head.json";
import triangles from "@dicebear/styles/triangles.json";
import voxelArt from "@dicebear/styles/voxel-art.json";
import voxelBot from "@dicebear/styles/voxel-bot.json";
import waves from "@dicebear/styles/waves.json";
import weave from "@dicebear/styles/weave.json";

export const DICEBEAR_STYLE_DEFS = {
  "adventurer": adventurer,
  "adventurer-neutral": adventurerNeutral,
  "avataaars": avataaars,
  "avataaars-neutral": avataaarsNeutral,
  "big-ears": bigEars,
  "big-ears-neutral": bigEarsNeutral,
  "big-smile": bigSmile,
  "blobs": blobs,
  "bottts": bottts,
  "bottts-neutral": botttsNeutral,
  "cameo": cameo,
  "clay": clay,
  "constellation": constellation,
  "critters": critters,
  "croodles": croodles,
  "croodles-neutral": croodlesNeutral,
  "cutouts": cutouts,
  "disco": disco,
  "dylan": dylan,
  "fun-emoji": funEmoji,
  "gaze": gaze,
  "glass": glass,
  "glyphs": glyphs,
  "icons": icons,
  "identicon": identicon,
  "initial-face": initialFace,
  "initials": initials,
  "landscape": landscape,
  "line-face": lineFace,
  "loops": loops,
  "lorelei": lorelei,
  "lorelei-neutral": loreleiNeutral,
  "marbles": marbles,
  "micah": micah,
  "miniavs": miniavs,
  "moods": moods,
  "notionists": notionists,
  "notionists-neutral": notionistsNeutral,
  "open-peeps": openPeeps,
  "patchwork": patchwork,
  "personas": personas,
  "pixel-art": pixelArt,
  "pixel-art-neutral": pixelArtNeutral,
  "pixelbot": pixelbot,
  "planets": planets,
  "rings": rings,
  "shadows": shadows,
  "shape-grid": shapeGrid,
  "shapes": shapes,
  "slice": slice,
  "sprouts": sprouts,
  "squircles": squircles,
  "stack": stack,
  "stripes": stripes,
  "thumbs": thumbs,
  "toon-head": toonHead,
  "triangles": triangles,
  "voxel-art": voxelArt,
  "voxel-bot": voxelBot,
  "waves": waves,
  "weave": weave,
} as const;

export type DiceBearStyle = keyof typeof DICEBEAR_STYLE_DEFS;

export interface DiceBearStyleInfo {
  id: DiceBearStyle;
  label: string;
  group: "character" | "pattern";
}

export const DICEBEAR_STYLES: DiceBearStyleInfo[] = [
  { id: "adventurer", label: "นักผจญภัย", group: "character" },
  { id: "adventurer-neutral", label: "นักผจญภัย (เรียบ)", group: "character" },
  { id: "avataaars", label: "อวตาร", group: "character" },
  { id: "avataaars-neutral", label: "อวตาร (เรียบ)", group: "character" },
  { id: "big-ears", label: "หูใหญ่", group: "character" },
  { id: "big-ears-neutral", label: "หูใหญ่ (เรียบ)", group: "character" },
  { id: "big-smile", label: "ยิ้มแฉ่ง", group: "character" },
  { id: "blobs", label: "หยดสี", group: "pattern" },
  { id: "bottts", label: "หุ่นยนต์", group: "character" },
  { id: "bottts-neutral", label: "หุ่นยนต์ (เรียบ)", group: "character" },
  { id: "cameo", label: "คาเมโอ", group: "character" },
  { id: "clay", label: "ดินปั้น", group: "character" },
  { id: "constellation", label: "กลุ่มดาว", group: "pattern" },
  { id: "critters", label: "สัตว์น้อย", group: "character" },
  { id: "croodles", label: "ครูเดิล", group: "character" },
  { id: "croodles-neutral", label: "ครูเดิล (เรียบ)", group: "character" },
  { id: "cutouts", label: "ตัดกระดาษ", group: "character" },
  { id: "disco", label: "ดิสโก้", group: "pattern" },
  { id: "dylan", label: "ดีแลน", group: "character" },
  { id: "fun-emoji", label: "อิโมจิ", group: "character" },
  { id: "gaze", label: "เกซ", group: "character" },
  { id: "glass", label: "กระจก", group: "pattern" },
  { id: "glyphs", label: "อักขระ", group: "pattern" },
  { id: "icons", label: "ไอคอน", group: "pattern" },
  { id: "identicon", label: "ไอเดนติคอน", group: "pattern" },
  { id: "initial-face", label: "หน้าอักษร", group: "character" },
  { id: "initials", label: "ตัวย่อ", group: "pattern" },
  { id: "landscape", label: "ทิวทัศน์", group: "pattern" },
  { id: "line-face", label: "เส้นหน้า", group: "character" },
  { id: "loops", label: "ลูป", group: "pattern" },
  { id: "lorelei", label: "ลอเรไล", group: "character" },
  { id: "lorelei-neutral", label: "ลอเรไล (เรียบ)", group: "character" },
  { id: "marbles", label: "หินอ่อน", group: "pattern" },
  { id: "micah", label: "ไมก้า", group: "character" },
  { id: "miniavs", label: "มินิ", group: "character" },
  { id: "moods", label: "อารมณ์", group: "pattern" },
  { id: "notionists", label: "โนชัน", group: "character" },
  { id: "notionists-neutral", label: "โนชัน (เรียบ)", group: "character" },
  { id: "open-peeps", label: "โอเพนพีพ", group: "character" },
  { id: "patchwork", label: "แพตช์เวิร์ก", group: "pattern" },
  { id: "personas", label: "เพอร์โซนา", group: "character" },
  { id: "pixel-art", label: "พิกเซล", group: "character" },
  { id: "pixel-art-neutral", label: "พิกเซล (เรียบ)", group: "character" },
  { id: "pixelbot", label: "พิกเซลบอท", group: "character" },
  { id: "planets", label: "ดาวเคราะห์", group: "pattern" },
  { id: "rings", label: "วงแหวน", group: "pattern" },
  { id: "shadows", label: "เงา", group: "pattern" },
  { id: "shape-grid", label: "ตารางรูป", group: "pattern" },
  { id: "shapes", label: "รูปทรง", group: "pattern" },
  { id: "slice", label: "สไลซ์", group: "pattern" },
  { id: "sprouts", label: "สเปราต์", group: "character" },
  { id: "squircles", label: "สเคอร์เคิล", group: "pattern" },
  { id: "stack", label: "สแตก", group: "pattern" },
  { id: "stripes", label: "ลายทาง", group: "pattern" },
  { id: "thumbs", label: "ธัมบ์", group: "character" },
  { id: "toon-head", label: "การ์ตูน", group: "character" },
  { id: "triangles", label: "สามเหลี่ยม", group: "pattern" },
  { id: "voxel-art", label: "วอกเซล", group: "character" },
  { id: "voxel-bot", label: "วอกเซลบอท", group: "character" },
  { id: "waves", label: "คลื่น", group: "pattern" },
  { id: "weave", label: "ถักทอ", group: "pattern" },
];
