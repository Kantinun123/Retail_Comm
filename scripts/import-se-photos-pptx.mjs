/* นำรูปพนักงาน SE จากไฟล์ PowerPoint ("รายชื่อ SE ...pptx") ไป map กับ sale_reps แล้วอัปโหลด
   -------------------------------------------------------------
   - อ่านสไลด์: กล่องร้านค้า (ชื่อ-นามสกุล/ชื่อเล่น/เบอร์/อีเมล/วันเข้างาน) + รูปที่วางข้างกล่อง
     จับคู่รูปกับคนตามตำแหน่ง (คอลัมน์เดียวกัน เรียงบนลงล่าง) ; ถ้าจำนวนรูปไม่เท่าจำนวนคนในคอลัมน์ จะไม่เดา
   - จับคู่คนกับ sale_reps ด้วยชื่อ-นามสกุล (ตัดคำนำหน้า) ; ยืนยันร้านด้วยรหัสร้านในสไลด์ (ถ้ามี) หรือชื่อร้าน
   - ไม่เขียนทับรูปเดิม เว้นแต่ใส่ --overwrite ; ไม่แก้ข้อมูลอื่น (เบอร์/อีเมล/วันเข้างาน แสดงเทียบในรายงานเท่านั้น)
   DRY RUN: node scripts/import-se-photos-pptx.mjs "<ไฟล์.pptx>"
   APPLY:   node scripts/import-se-photos-pptx.mjs "<ไฟล์.pptx>" --apply [--overwrite]
*/
import { readFileSync, readdirSync, mkdtempSync, copyFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const PPTX = process.argv[2];
const APPLY = process.argv.includes("--apply");
const OVERWRITE = process.argv.includes("--overwrite");
// --preview <โฟลเดอร์>: เขียนรูปที่ย่อ/ครอปแล้วลงโฟลเดอร์ เพื่อเปิดดูก่อน apply
const INCLUDE_REVIEW = process.argv.includes("--include-review"); // อัปโหลดรายการ review ด้วย (ไม่แนะนำ)
const shIdx = process.argv.indexOf("--sheet"); // สร้างภาพรวมพร้อมชื่อให้ตรวจ
const SHEET = shIdx > -1 ? process.argv[shIdx + 1] : null;
const sheetItems = [];
const pvIdx = process.argv.indexOf("--preview");
const PREVIEW = pvIdx > -1 ? process.argv[pvIdx + 1] : null;
if (PREVIEW) mkdirSync(PREVIEW, { recursive: true });
if (!PPTX) {
  console.error("ระบุไฟล์ .pptx");
  process.exit(1);
}
const BUCKET = "employee-photos";
const MAX_DIM = 800;
const QUALITY = 85;

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---------- แตก pptx ---------- */
const work = mkdtempSync(join(tmpdir(), "se-pptx-"));
copyFileSync(PPTX, join(work, "deck.zip"));
execFileSync(
  "powershell",
  ["-NoProfile", "-Command", `$ProgressPreference='SilentlyContinue'; Expand-Archive -LiteralPath '${join(work, "deck.zip")}' -DestinationPath '${join(work, "x")}' -Force`],
  { stdio: "ignore" }
);
const root = join(work, "x");

/* ---------- อ่านสไลด์ ---------- */
const dec = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const NUMBERED = /^(\d+)\s*\.\s*(\S.*)$/;
const slideFiles = readdirSync(join(root, "ppt/slides"))
  .filter((f) => /^slide\d+\.xml$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

const cropByFile = new Map(); // ไฟล์รูป -> ส่วนที่ครอปบนสไลด์ (ใช้กับ OVERRIDE)
const people = []; // { slide, storeCode, storeHead, name, nick, start, phone, email, photo }
const problems = [];
for (const f of slideFiles) {
  const n = Number(f.match(/\d+/)[0]);
  const xml = readFileSync(join(root, "ppt/slides", f), "utf8");
  const rels = {};
  try {
    const r = readFileSync(join(root, "ppt/slides/_rels", f + ".rels"), "utf8");
    for (const m of r.matchAll(/<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) rels[m[1]] = m[2];
  } catch {}

  const stores = [];
  for (const m of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
    const b = m[1];
    const paras = [...b.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((p) =>
      [...p[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => dec(t[1])).join("").trim()
    );
    const firstNum = paras.findIndex((p) => NUMBERED.test(p) && !/\d{7}/.test(p));
    if (firstNum < 0) continue;
    if (!/วันที่เข้างาน|Tel\s*:/i.test(paras.join(" "))) continue;
    const head = paras.slice(0, firstNum).filter(Boolean).join(" ");
    const off = b.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const ext0 = b.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!off) continue;
    const ses = [];
    let cur = null;
    for (const p of paras.slice(firstNum)) {
      const nm = p.match(NUMBERED);
      if (nm) {
        let name = nm[2].replace(/\s*-\s*All\s*$/i, "").trim();
        let nick = null;
        const nk = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        if (nk) {
          name = nk[1].trim();
          nick = nk[2].trim();
        }
        cur = { name, nick, start: null, phone: null, email: null, photo: null };
        ses.push(cur);
        continue;
      }
      if (!cur) continue;
      let mm;
      if ((mm = p.match(/วันที่เข้างาน\s*:\s*(\d{2})-(\d{2})-(\d{4})/))) cur.start = `${mm[3]}-${mm[2]}-${mm[1]}`;
      else if ((mm = p.match(/Tel\s*:\s*(.+)$/i))) cur.phone = mm[1].trim();
      else if ((mm = p.match(/Email\s*:\s*(\S+)/i))) cur.email = mm[1].trim();
    }
    stores.push({ code: head.match(/(\d{7})/)?.[1] ?? null, head, x: +off[1], y: +off[2], h: +(ext0?.[2] ?? 0), ses });
  }
  if (!stores.length) continue;

  const pics = [];
  for (const m of xml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)) {
    const b = m[1];
    const emb = b.match(/r:embed="([^"]+)"/)?.[1];
    const off = b.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const ext = b.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!emb || !off || !ext) continue;
    // ส่วนที่ครอปบนสไลด์ (srcRect เป็นหน่วย 1/1000 เปอร์เซ็นต์ ถ้าไม่มีค่า = 0)
    const sr = b.match(/<a:srcRect([^/]*)\/>/)?.[1] ?? "";
    const crop = {};
    for (const k of ["l", "t", "r", "b"]) crop[k] = Number(sr.match(new RegExp(`${k}="(-?\\d+)"`))?.[1] ?? 0);
    pics.push({ file: (rels[emb] || "").replace("../", ""), x: +off[1], y: +off[2], w: +ext[1], h: +ext[2], crop });
  }
  const useCount = {};
  pics.forEach((p) => (useCount[p.file] = (useCount[p.file] || 0) + 1));
  pics.forEach((p) => cropByFile.set(p.file, p.crop));

  const cols = [];
  for (const s of [...stores].sort((a, b) => a.x - b.x)) {
    const last = cols[cols.length - 1];
    if (last && s.x - last.refX < 1500000) last.stores.push(s);
    else cols.push({ refX: s.x, stores: [s] });
  }
  for (const col of cols) {
    col.stores.sort((a, b) => a.y - b.y);
    const seList = col.stores.flatMap((st) => st.ses.map((se) => ({ st, se })));
    const colPhotos = pics
      .filter(
        (p) =>
          useCount[p.file] === 1 &&
          p.y > 500000 &&
          p.w >= 400000 &&
          Math.abs(p.x + p.w - col.refX) <= 500000 &&
          p.x < col.refX
      )
      .sort((a, b) => a.y - b.y);
    const mapped = seList.length === colPhotos.length;
    if (!mapped) {
      problems.push(
        `สไลด์ ${n}: คอลัมน์ x≈${col.refX} มีพนักงาน ${seList.length} คน แต่รูป ${colPhotos.length} รูป -> ไม่จับคู่รูป (${col.stores.map((s) => s.code ?? s.head.slice(0, 30)).join(", ")})`
      );
    }
    // ความมั่นใจ: ร้านต้องไม่ซ้อนทับกับร้านอื่นในคอลัมน์เดียวกัน และจำนวนรูปในแนวของร้านต้องเท่ากับจำนวนคน
    const conf = (st) => {
      const clean = col.stores.every(
        (o) => o === st || !(o.y < st.y + st.h && st.y < o.y + o.h)
      );
      const band = colPhotos.filter((p) => p.y >= st.y - 200000 && p.y <= st.y + st.h);
      return mapped && clean && band.length === st.ses.length ? "high" : "review";
    };
    seList.forEach((o, i) =>
      people.push({
        confidence: conf(o.st),
        slide: n,
        storeCode: o.st.code,
        storeHead: o.st.head,
        ...o.se,
        photo: mapped ? colPhotos[i].file : null,
        crop: mapped ? colPhotos[i].crop : null,
      })
    );
  }
}

/* ---------- ฐานข้อมูล ---------- */
const { data: reps, error: rErr } = await sb
  .from("sale_reps")
  .select("rep_code, name, nickname, dealer_code, position, photo_url, phone, email, start_date, is_active");
if (rErr) throw rErr;
const { data: dealers } = await sb.from("dealers").select("code, name");

const TITLES = /^(นางสาว|นาง|นาย|น\.ส\.|น\.ส|mr\.?|mrs\.?|miss|ms\.?)/i;
const norm = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim()
    .replace(TITLES, "")
    .toLowerCase()
    .replace(/[\s.\-_()]/g, "");
const bigrams = (s) => {
  const o = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    o.set(g, (o.get(g) ?? 0) + 1);
  }
  return o;
};
const dice = (a, b) => {
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  let inter = 0, sa = 0, sb2 = 0;
  for (const [, c] of A) sa += c;
  for (const [, c] of B) sb2 += c;
  for (const [g, c] of A) inter += Math.min(c, B.get(g) ?? 0);
  return sa + sb2 === 0 ? 0 : (2 * inter) / (sa + sb2);
};
const normStore = (s) => norm(s).replace(/วัตถุ/g, "วัสดุ");

const repN = reps.map((r) => ({ ...r, n: norm(r.name) }));
const dealerN = dealers.map((d) => ({ ...d, n: normStore(d.name) }));

function resolveStore(p) {
  if (p.storeCode) return p.storeCode;
  const n = normStore(p.storeHead.replace(/[:：].*$/, ""));
  let best = null;
  for (const d of dealerN) {
    const s = dice(n, d.n);
    if (!best || s > best.s) best = { d, s };
  }
  return best && best.s >= 0.8 ? best.d.code : null;
}

const plan = [];
const review = [];
const notFound = [];
for (const p of people) {
  const n = norm(p.name);
  const store = resolveStore(p);
  let cands = repN.filter((r) => r.n === n);
  let how = "ชื่อตรง";
  if (!cands.length) {
    const scored = repN.map((r) => ({ r, s: dice(n, r.n) })).sort((a, b) => b.s - a.s);
    if (scored[0] && scored[0].s >= 0.88 && (!scored[1] || scored[0].s - scored[1].s >= 0.05)) {
      cands = [scored[0].r];
      how = `ชื่อคล้าย ${(scored[0].s * 100).toFixed(0)}%`;
    }
  }
  if (!cands.length) {
    notFound.push(p);
    continue;
  }
  if (cands.length > 1 && store) {
    const same = cands.filter((r) => r.dealer_code === store);
    if (same.length) cands = same;
  }
  if (cands.length > 1) {
    review.push({ p, reason: `ชื่อซ้ำกัน ${cands.length} คน (${cands.map((r) => r.rep_code).join(", ")})` });
    continue;
  }
  const rep = cands[0];
  const sameStore = store ? rep.dealer_code === store : null;
  if (sameStore === false) {
    review.push({ p, rep, reason: `ร้านไม่ตรง: สไลด์ ${store} / ฐานข้อมูล ${rep.dealer_code}` });
    continue;
  }
  if (how !== "ชื่อตรง" && !sameStore) {
    review.push({ p, rep, reason: `${how} และยืนยันร้านไม่ได้` });
    continue;
  }
  plan.push({ p, rep, how, sameStore });
}

/* ---------- แก้ไขจากผู้ตรวจ (ตรวจด้วยตาจากภาพรวม 2026-11-06) ----------
   OVERRIDE: rep_code -> ไฟล์รูปใน pptx ที่ถูกต้อง (ตำแหน่งบนสไลด์วางสลับกัน)
   EXCLUDE : ไม่อัปโหลด (รูปไม่ตรงคน / ยังไม่แน่ใจ) */
const OVERRIDE = {
  SR0145: "media/image75.png", // ฉลอง (รูปต้นฉบับมีชื่อพิมพ์ใต้รูป)
  SR0146: "media/image74.png", // เสกสรร
  SR0153: "media/image70.png", // วสันต์
  SR0154: "media/image69.png", // ณัฐชัย
  SR0160: "media/image78.png", // อนุชา (สลับกับ SR0163)
  SR0163: "media/image84.png", // วรัชยา
  SR0132: "media/image63.png", // วนิดา (สลับกับ SR0134)
  SR0134: "media/image61.png", // ณัฐพงษ์
};
const EXCLUDE = new Set([
  "SR0115", // รูปไม่ใช่คนนี้ (ผู้ตรวจระบุ)
  "SR0149", // รูปใน pptx ไม่ตรงกับไฟล์ JPG ที่ตั้งชื่อไว้ รอยืนยัน
]);
for (const it of plan) {
  const f = OVERRIDE[it.rep.rep_code];
  if (f) {
    it.p.photo = f;
    it.p.crop = cropByFile.get(f) ?? null;
    it.p.confidence = "high"; // ยืนยันโดยผู้ตรวจ
    it.how = "แก้ไขโดยผู้ตรวจ";
  }
}

/* ---------- รูป ---------- */
async function prep(file, crop) {
  const input = readFileSync(join(root, "ppt", file));
  let img = sharp(input).rotate().flatten({ background: "#ffffff" });
  // ใช้ส่วนที่ครอปไว้บนสไลด์ (ถ้ามี) เพื่อได้ภาพหัว-ไหล่แบบที่เห็นในไฟล์
  if (crop && (crop.l || crop.t || crop.r || crop.b)) {
    const meta = await sharp(input).metadata();
    const W = meta.width, H = meta.height;
    const left = Math.max(0, Math.round((W * crop.l) / 100000));
    const top = Math.max(0, Math.round((H * crop.t) / 100000));
    const width = Math.max(1, W - left - Math.round((W * crop.r) / 100000));
    const height = Math.max(1, H - top - Math.round((H * crop.b) / 100000));
    img = sharp(await img.toBuffer()).extract({ left, top, width: Math.min(width, W - left), height: Math.min(height, H - top) });
  }
  const out = await img
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { before: input.length, buf: out.data, w: out.info.width, h: out.info.height };
}

console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
console.log(`พนักงานในสไลด์: ${people.length} | จับคู่ได้ชัด: ${plan.length} | ต้องตรวจ: ${review.length} | หาไม่พบ: ${notFound.length}`);
const used = new Map();
let ok = 0, failed = 0, skippedHasPhoto = 0, noPic = 0, reviewHeld = 0, excluded = 0;
for (const { p, rep, how, sameStore } of plan) {
  const tag = `${rep.rep_code} ${rep.name}${rep.nickname ? " (" + rep.nickname + ")" : ""}`;
  if (!p.photo) {
    noPic++;
    console.log(`  - ไม่มีรูปที่จับคู่ได้: ${tag} (สไลด์ ${p.slide})`);
    continue;
  }
  if (used.has(rep.rep_code)) {
    console.log(`  ! ซ้ำ: ${tag} ปรากฏหลายครั้ง (สไลด์ ${used.get(rep.rep_code)} และ ${p.slide}) ใช้รายการแรก`);
    continue;
  }
  used.set(rep.rep_code, p.slide);
  if (EXCLUDE.has(rep.rep_code)) {
    excluded++;
    console.log(`  x ไม่อัปโหลด (อยู่ในรายการ EXCLUDE): ${tag}`);
    continue;
  }
  const hasOld = !!rep.photo_url;
  if (hasOld && !OVERWRITE) {
    skippedHasPhoto++;
    console.log(`  = มีรูปอยู่แล้ว ข้าม: ${tag}`);
    continue;
  }
  let r;
  try {
    r = await prep(p.photo, p.crop);
    if (PREVIEW) writeFileSync(join(PREVIEW, `${rep.rep_code}.jpg`), r.buf);
    sheetItems.push({ rep, p, buf: r.buf });
  
  } catch (e) {
    failed++;
    console.log(`  ✗ ย่อรูปไม่ได้: ${tag} ${p.photo} — ${e.message}`);
    continue;
  }
  console.log(
    `  ${how.padEnd(10)} ${sameStore ? "ร้านตรง" : "ร้าน?  "} ${tag} ← ${p.photo} (${r.w}x${r.h}, ${(r.buf.length / 1024).toFixed(0)} KB)${rep.photo_url ? " [เขียนทับ]" : ""}`
  );
  if (p.confidence !== "high" && !INCLUDE_REVIEW) {
    reviewHeld++;
    console.log(`    -> ตำแหน่งรูปไม่ชัดเจน (ร้านซ้อนทับ/จำนวนไม่ตรง) ไม่อัปโหลด รอตรวจ`);
    continue;
  }
  if (!APPLY) continue;
  const path = `${rep.rep_code}.jpg`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, r.buf, { contentType: "image/jpeg", upsert: true });
  if (upErr) {
    failed++;
    console.log(`    ✗ อัปโหลดไม่สำเร็จ: ${upErr.message}`);
    continue;
  }
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const { error: dbErr } = await sb
    .from("sale_reps")
    .update({ photo_url: `${pub.publicUrl}?v=${Date.now()}` })
    .eq("rep_code", rep.rep_code);
  if (dbErr) {
    failed++;
    console.log(`    ✗ บันทึก photo_url ไม่สำเร็จ: ${dbErr.message}`);
    continue;
  }
  ok++;
}

if (review.length) {
  console.log("\n=== ต้องตรวจเอง (ไม่อัปโหลด) ===");
  for (const { p, rep, reason } of review)
    console.log(`  สไลด์ ${p.slide}: ${p.name}${p.nick ? " (" + p.nick + ")" : ""}${rep ? " -> " + rep.rep_code + " " + rep.name : ""} — ${reason}`);
}
if (notFound.length) {
  console.log("\n=== หาในฐานข้อมูลไม่พบ ===");
  for (const p of notFound)
    console.log(`  สไลด์ ${p.slide}: ${p.name}${p.nick ? " (" + p.nick + ")" : ""} | ${p.storeCode ?? p.storeHead.slice(0, 40)}`);
}
if (problems.length) {
  console.log("\n=== สไลด์ที่จับคู่รูปไม่ได้ (จำนวนรูป ≠ จำนวนคน) ===");
  problems.forEach((x) => console.log("  " + x));
}
if (SHEET && sheetItems.length) {
  // ภาพรวมพร้อมชื่อ เพื่อให้คนตรวจดูว่ารูปตรงกับชื่อ (กรอบเขียว = ตำแหน่งชัดเจน, แดง = ต้องตรวจ)
  const cols = 6, cw = 200, ch = 250, lh = 46, pad = 8;
  const rows = Math.ceil(sheetItems.length / cols);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const comps = [];
  for (let i = 0; i < sheetItems.length; i++) {
    const { rep, p, buf } = sheetItems[i];
    const x = (i % cols) * (cw + pad), y = Math.floor(i / cols) * (ch + lh + pad);
    const color = p.confidence === "high" ? "#16a34a" : "#dc2626";
    comps.push({ input: await sharp(buf).resize(cw, ch, { fit: "contain", background: "#f1f1f1" }).toBuffer(), left: x, top: y });
    const shop = p.storeHead.replace(/\s*[:：].*$/, "").slice(0, 26);
    comps.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${lh}"><rect width="${cw}" height="4" fill="${color}"/>` +
          `<text x="3" y="18" font-size="13" font-weight="bold" font-family="Tahoma, Arial">${esc(rep.rep_code)} ${esc(rep.name)}${rep.nickname ? " (" + esc(rep.nickname) + ")" : ""}</text>` +
          `<text x="3" y="36" font-size="11" fill="#555" font-family="Tahoma, Arial">${esc(shop)}</text></svg>`
      ),
      left: x,
      top: y + ch,
    });
  }
  await sharp({ create: { width: cols * (cw + pad), height: rows * (ch + lh + pad), channels: 3, background: "#ffffff" } })
    .composite(comps)
    .jpeg({ quality: 82 })
    .toFile(SHEET);
  console.log(`\nสร้างภาพตรวจ: ${SHEET} (${sheetItems.length} รูป)`);
}
console.log(`\nสรุป: อัปโหลด ${APPLY ? ok : "(dry-run)"} | ข้าม(มีรูปแล้ว) ${skippedHasPhoto} | ไม่มีรูป ${noPic} | รอตรวจ(ตำแหน่งไม่ชัด) ${reviewHeld} | ตัดออก ${excluded} | ล้มเหลว ${failed}`);
if (!APPLY) console.log("(DRY RUN) เพิ่ม --apply เพื่ออัปโหลดจริง");
rmSync(work, { recursive: true, force: true });
