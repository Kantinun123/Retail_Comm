/* =============================================================
   นำเข้ารูปร้านค้า: commission-app/รูปร้านค้าและพนักงาน/ร้านค้า/<ภาค>/<ชื่อร้าน>.jpg
   -> ย่อ (ด้านยาวสุด 1600px, JPEG q85, หมุนตาม EXIF) -> Storage bucket "store-photos" -> dealers.photo_url

   จับคู่ไฟล์กับร้านด้วย "ชื่อ" (ไม่มีรหัสร้านในชื่อไฟล์):
     - ตรงเป๊ะหลัง normalize (ตัดช่องว่าง/จุด/วงเล็บ, วัตถุ->วัสดุ) หรือคล้ายมาก (>=90% และห่างอันดับสอง >=5%)
     - ข้อยกเว้นที่ผู้ใช้ยืนยันแล้ว อยู่ใน MANUAL ด้านล่าง
     - ที่เหลือ "ข้าม" และรายงาน (ไม่เดา)
   idempotent: path = <รหัสร้าน>.jpg (upsert) รันซ้ำได้

   DRY RUN: node scripts/import-store-photos.mjs
   APPLY:   node scripts/import-store-photos.mjs --apply
   ============================================================= */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app/รูปร้านค้าและพนักงาน/ร้านค้า";
const BUCKET = "store-photos";
const MAX_DIM = 1600;
const QUALITY = 85;

/** จับคู่ที่ผู้ใช้ยืนยันเอง: ชื่อไฟล์ (ไม่รวมนามสกุล) -> รหัสร้าน */
const MANUAL = {
  "บ.อุดมชัยสมุทรสงครามซิเมนต์ จก.": "5100119",
};

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function norm(s) {
  return String(s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/วัตถุ/g, "วัสดุ")
    .replace(/[\s.\-_()（）[\]]/g, "");
}
function bigrams(s) {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}
function dice(a, b) {
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  let inter = 0, sa = 0, sb2 = 0;
  for (const [, n] of A) sa += n;
  for (const [, n] of B) sb2 += n;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
  return sa + sb2 === 0 ? 0 : (2 * inter) / (sa + sb2);
}
const mb = (n) => (n / 1048576).toFixed(2) + " MB";

/* ---------- ไฟล์ ---------- */
const files = [];
for (const sub of readdirSync(DIR)) {
  const p = join(DIR, sub);
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p))
      if (/\.(jpe?g|png|webp)$/i.test(f)) files.push({ folder: sub, file: f, path: join(p, f) });
  } else if (/\.(jpe?g|png|webp)$/i.test(sub)) {
    files.push({ folder: "", file: sub, path: p });
  }
}

/* ---------- dealers ---------- */
const { data: dealers, error } = await sb.from("dealers").select("code, name, region, photo_url");
if (error) { console.error(error.message); process.exit(1); }
const byCode = new Map(dealers.map((d) => [d.code, d]));
const dn = dealers.map((d) => ({ ...d, n: norm(d.name) }));

/* ---------- จับคู่ ---------- */
const plan = [];     // { f, dealer, how, score }
const skipped = [];  // { f, reason }
const claimed = new Map(); // code -> file ที่จองแล้ว
for (const f of files) {
  const stem = basename(f.file, extname(f.file));
  let dealer = null, how = "", score = 0;

  if (MANUAL[stem]) {
    dealer = byCode.get(MANUAL[stem]);
    how = "manual (ผู้ใช้ยืนยัน)";
    score = 1;
    if (!dealer) { skipped.push({ f, reason: `MANUAL ชี้รหัส ${MANUAL[stem]} ที่ไม่มีใน dealers` }); continue; }
  } else {
    const n = norm(stem);
    let best = null, second = null;
    for (const d of dn) {
      const s = dice(n, d.n);
      if (!best || s > best.s) { second = best; best = { d, s }; }
      else if (!second || s > second.s) second = { d, s };
    }
    const gap = best && second ? best.s - second.s : 1;
    if (best && (best.s === 1 || (best.s >= 0.9 && gap >= 0.05))) {
      dealer = best.d; score = best.s; how = best.s === 1 ? "ชื่อตรง" : `ชื่อคล้าย ${(best.s * 100).toFixed(0)}%`;
    } else {
      skipped.push({ f, reason: `ไม่มั่นใจ (ใกล้สุด ${best ? (best.s * 100).toFixed(0) + "% " + best.d.code : "-"})` });
      continue;
    }
  }
  if (claimed.has(dealer.code)) {
    skipped.push({ f, reason: `ซ้ำกับไฟล์ ${claimed.get(dealer.code)} (ร้าน ${dealer.code})` });
    continue;
  }
  claimed.set(dealer.code, f.file);
  plan.push({ f, dealer, how, score });
}

/* ---------- ย่อรูป (ทำในหน่วยความจำทั้ง dry-run และ apply เพื่อรายงานขนาดจริง) ---------- */
async function resize(path) {
  const input = readFileSync(path);
  const out = await sharp(input)
    .rotate() // หมุนตาม EXIF
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { before: input.length, buf: out.data, w: out.info.width, h: out.info.height };
}

console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
console.log(`ไฟล์: ${files.length} | จะอัปโหลด: ${plan.length} | ข้าม: ${skipped.length}`);

let totalBefore = 0, totalAfter = 0, ok = 0, failed = 0;
for (const p of plan) {
  let r;
  try {
    r = await resize(p.f.path);
  } catch (e) {
    failed++;
    console.log(`  ✗ ย่อรูปไม่ได้: ${p.f.file} — ${e.message}`);
    continue;
  }
  totalBefore += r.before;
  totalAfter += r.buf.length;
  const tag = `${p.dealer.code} ${p.dealer.name}`;
  const hadPhoto = p.dealer.photo_url ? " [มีรูปอยู่แล้ว จะเขียนทับ]" : "";
  console.log(`  ${p.how.padEnd(22)} ${tag}  ←  ${p.f.folder}/${p.f.file}  (${mb(r.before)} → ${mb(r.buf.length)}, ${r.w}x${r.h})${hadPhoto}`);

  if (!APPLY) continue;

  const path = `${p.dealer.code}.jpg`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, r.buf, { contentType: "image/jpeg", upsert: true });
  if (upErr) { failed++; console.log(`    ✗ อัปโหลดไม่สำเร็จ: ${upErr.message}`); continue; }
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  const { error: dbErr } = await sb.from("dealers").update({ photo_url: url }).eq("code", p.dealer.code);
  if (dbErr) { failed++; console.log(`    ✗ บันทึก photo_url ไม่สำเร็จ: ${dbErr.message}`); continue; }
  ok++;
}

console.log(`\nขนาดรวม: ${mb(totalBefore)} → ${mb(totalAfter)}`);
if (skipped.length) {
  console.log("\n=== ข้าม (ไม่อัปโหลด) ===");
  for (const s of skipped) console.log(`  ${s.f.folder}/${s.f.file} — ${s.reason}`);
}
const withPlan = new Set(plan.map((p) => p.dealer.code));
const noPhoto = dealers.filter((d) => !withPlan.has(d.code) && !d.photo_url);
console.log(`\n=== ร้านที่จะยังไม่มีรูปหลังนำเข้า: ${noPhoto.length} ===`);
for (const d of noPhoto) console.log(`  ${d.code} ${d.name} (${d.region ?? "ไม่มีภาค"})`);

if (APPLY) console.log(`\nDONE: สำเร็จ ${ok} | ล้มเหลว ${failed}`);
else console.log("\n(DRY RUN) เพิ่ม --apply เพื่ออัปโหลดจริง");
