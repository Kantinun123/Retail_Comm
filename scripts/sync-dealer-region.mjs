/* เติม region (ภาค) + province (จังหวัด) ลงตาราง dealers จาก Master_Dealer.csv
   -------------------------------------------------------------
   - จับคู่ด้วย Dealer Code ; อัปเดตเฉพาะ region/province (ไม่แตะคอลัมน์อื่น)
   - รายงานร้านใน dealers ที่ไม่พบใน Master และกลับกัน

   DRY RUN: node scripts/sync-dealer-region.mjs
   APPLY:   node scripts/sync-dealer-region.mjs --apply
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function parseCsv(text) {
  const rows = []; let cur = [], f = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ",") { cur.push(f); f = ""; } else if (c === "\n") { cur.push(f); rows.push(cur); cur = []; f = ""; } else if (c === "\r") {} else f += c; }
  }
  if (f.length || cur.length) { cur.push(f); rows.push(cur); }
  return rows;
}
const cleanCode = (v) => String(v ?? "").trim().replace(/^0+/, "");

const md = parseCsv(readFileSync("commission-app/Master_Dealer.csv", "utf8"));
const h = md[0].map((x) => String(x).trim());
const iCode = h.indexOf("Dealer Code"), iRegion = h.indexOf("Dealer Region"), iProv = h.indexOf("Dealer Province");
const masterByCode = new Map();
for (let r = 1; r < md.length; r++) {
  const code = cleanCode(md[r][iCode]);
  if (!code) continue;
  masterByCode.set(code, {
    // รวม "อีสาน1"/"อีสาน2" เป็น "อีสาน" (ตามที่ผู้ใช้กำหนด) — ไม่แก้ไฟล์ CSV ต้นฉบับ
    region: (String(md[r][iRegion] ?? "").trim().replace(/^อีสาน\s*\d+$/, "อีสาน")) || null,
    province: String(md[r][iProv] ?? "").trim() || null,
  });
}
console.log(`Master_Dealer: ${masterByCode.size} ร้าน`);

const { data: dealers, error } = await sb.from("dealers").select("code,name,region,province");
if (error) { console.error("โหลด dealers ไม่สำเร็จ:", error.message); process.exit(1); }

const updates = []; const noMatch = [];
for (const d of dealers) {
  const m = masterByCode.get(d.code);
  if (!m) { noMatch.push(d.code); continue; }
  if (d.region !== m.region || d.province !== m.province) updates.push({ code: d.code, ...m });
}
const inDbCodes = new Set(dealers.map((d) => d.code));
const masterOnly = [...masterByCode.keys()].filter((c) => !inDbCodes.has(c));

console.log(`dealers ใน DB = ${dealers.length} | ต้องอัปเดต ${updates.length} | ไม่พบใน Master ${noMatch.length}`);
if (noMatch.length) console.log("  dealers ที่ไม่มีใน Master (ภาคจะว่าง):", noMatch.join(", "));
if (masterOnly.length) console.log(`  มีใน Master แต่ไม่มีใน dealers (${masterOnly.length}):`, masterOnly.join(", "));

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่ออัปเดตจริง"); process.exit(0); }

for (const u of updates) {
  const { error: e } = await sb.from("dealers").update({ region: u.region, province: u.province }).eq("code", u.code);
  if (e) { console.error(`update ${u.code}:`, e.message); process.exit(1); }
}
console.log(`DONE อัปเดต ${updates.length} ร้าน`);
