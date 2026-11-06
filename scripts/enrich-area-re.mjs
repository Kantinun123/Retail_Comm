/* =============================================================
   Enrich Area/Coach ที่ seed ไว้ ด้วยข้อมูลจาก Master_Member.csv
   - Area: col 23 (ชื่อ+เล่น), 24 (email), 25 (phone)
   - Coach: col 26 (ชื่อ+เล่น), 27 (email), 28 (phone)
   match: record ใน DB (ชื่ออาจเป็นชื่อต้นอย่างเดียว) กับ Master (ชื่อเต็ม)
     -> เทียบ "ชื่อเต็มใน Master ขึ้นต้นด้วย/เท่ากับ ชื่อใน DB" (คำแรกตรงกัน)
   อัปเดต: name(ชื่อเต็ม), nickname, email, phone — เติม/ทับให้ครบ (ของเดิมเป็นชื่อต้น/ว่าง)

   DRY RUN: node scripts/enrich-area-re.mjs
   APPLY:   node scripts/enrich-area-re.mjs --apply
   ============================================================= */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function parseCsv(text){const rows=[];let cur=[],f="",q=false;text=text.replace(/^\uFEFF/,"");for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else{if(c==='"')q=true;else if(c===","){cur.push(f);f="";}else if(c==="\n"){cur.push(f);rows.push(cur);cur=[];f="";}else if(c==="\r"){}else f+=c;}}if(f.length||cur.length){cur.push(f);rows.push(cur);}return rows;}

const str = (v) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };
function parseName(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { name: m[1].trim(), nick: m[2].trim() };
  return { name: s, nick: null };
}
const firstWord = (s) => String(s ?? "").trim().split(/\s+/)[0] ?? "";
const normFirst = (s) => firstWord(s).toLowerCase();

/* ---- อ่าน Master: รวบรวม Area + Coach ไม่ซ้ำ (key = ชื่อเต็ม) ---- */
const rows = parseCsv(readFileSync("commission-app/Master_Member.csv", "utf8"));
const COL = { area: 23, areaEmail: 24, areaPhone: 25, coach: 26, coachEmail: 27, coachPhone: 28 };

const master = new Map(); // normFirst(ชื่อ) -> { fullName, nick, email, phone, position }  (เก็บตัวที่ชื่อเต็มที่สุด)
function addMaster(nameCell, emailCell, phoneCell, position) {
  const { name, nick } = parseName(nameCell);
  if (!name || name === "-") return;
  const key = position + "|" + normFirst(name);
  const prev = master.get(key);
  // เก็บตัวที่ชื่อยาวกว่า (มีนามสกุล) + เติม field ที่มี
  const cand = {
    fullName: name,
    nick,
    email: str(emailCell),
    phone: str(phoneCell),
    position,
  };
  if (!prev || cand.fullName.length > prev.fullName.length) {
    master.set(key, { ...prev, ...cand, nick: cand.nick ?? prev?.nick ?? null });
  } else {
    // เติม email/phone/nick ถ้าตัวเดิมขาด
    prev.email = prev.email ?? cand.email;
    prev.phone = prev.phone ?? cand.phone;
    prev.nick = prev.nick ?? cand.nick;
  }
}
for (let r = 2; r < rows.length; r++) {
  const row = rows[r];
  if (!row) continue;
  addMaster(row[COL.area], row[COL.areaEmail], row[COL.areaPhone], "area_mng");
  addMaster(row[COL.coach], row[COL.coachEmail], row[COL.coachPhone], "coach");
}

/* ---- Area/Coach ใน DB ---- */
const { data: sup } = await sb
  .from("sale_reps")
  .select("rep_code, name, nickname, position, phone, email")
  .in("position", ["area_mng", "coach"]);

/* ---- จับคู่ + สร้าง patch ---- */
const patches = [];
const unmatched = [];
for (const s of sup) {
  const key = s.position + "|" + normFirst(s.name);
  const m = master.get(key);
  if (!m) { unmatched.push(`${s.position} ${s.name}`); continue; }
  const patch = {};
  // ชื่อเต็ม (ถ้า DB สั้นกว่า = ชื่อต้นอย่างเดียว -> อัปเป็นชื่อเต็ม)
  if (m.fullName && m.fullName.length > String(s.name).length) patch.name = m.fullName;
  if (m.nick && !s.nickname) patch.nickname = m.nick;
  if (m.email && !s.email) patch.email = m.email;
  if (m.phone && !s.phone) patch.phone = m.phone;
  if (Object.keys(patch).length) patches.push({ rep_code: s.rep_code, before: s.name, patch });
}

console.log("================ DRY RUN ================");
console.log(`Master: Area/Coach ไม่ซ้ำ ${master.size} | DB Area/Coach ${sup.length}`);
console.log(`จะอัปเดต ${patches.length} คน | match ไม่ได้ ${unmatched.length}`);
console.log("\nตัวอย่าง patch:");
patches.slice(0, 12).forEach((p) =>
  console.log(`  ${p.rep_code} "${p.before}" -> ${JSON.stringify(p.patch)}`)
);
if (unmatched.length) {
  console.log("\nmatch ไม่ได้:");
  unmatched.forEach((u) => console.log("  - " + u));
}

if (!APPLY) {
  console.log("\n(DRY RUN) เพิ่ม --apply เพื่อเขียน");
  process.exit(0);
}

console.log("\n================ APPLYING ================");
let done = 0;
for (const p of patches) {
  const { error } = await sb.from("sale_reps").update(p.patch).eq("rep_code", p.rep_code);
  if (error) { console.error(p.rep_code, error.message); continue; }
  done++;
  process.stdout.write(`\r  อัปเดต ${done}/${patches.length}`);
}
console.log(`\nDONE: อัปเดต ${done} คน`);
