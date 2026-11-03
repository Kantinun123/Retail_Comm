/* นำเข้า Cust Sat (ความพึงพอใจลูกค้า) -> cust_sat_lines
   -------------------------------------------------------------
   - ไฟล์ A: "Cus Sat - Housing Expert & SCG HOME.xlsx"
   - ใช้เฉพาะ sheet "DATA" เท่านั้น ("Cus Sat - New" เป็น subset ที่รวมอยู่ใน DATA แล้ว)
   - ชื่อสาขา: DATA กระจาย col 24-67 (เอาค่าแรกที่ไม่ว่าง)
   - map ชื่อสาขา -> dealer_code (normalize + override 3 ร้าน)
   - overall 0-10 -> pct = overall/10
   - idempotent: ลบตารางแล้ว insert ใหม่ (มาจากไฟล์เดียว)

   DRY RUN: node scripts/import-cust-sat.mjs
   APPLY:   node scripts/import-cust-sat.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app/Cus sat";
const FILE = "Cus Sat - Housing Expert & SCG HOME.xlsx";

/* ---- env ---- */
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ---- helpers ---- */
const str = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === "" ? null : s; };
/* คอมเมนต์: คืน null ถ้าว่าง/ไม่มีสาระ ("ไม่มี", "-", "ไม่ม") */
const comment = (v) => { const s = str(v); if (!s) return null; if (/^(ไม่มี|ไม่ม|-| no|none|n\/a)\.?$/i.test(s)) return null; return s; };
const num = (v) => { if (v === undefined || v === null || v === "") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const serialToDate = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 1000) return null;
  const dt = new Date(Math.round((n - 25569) * 86400 * 1000));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
};
function norm(s) {
  let x = String(s ?? "").trim();
  x = x.replace(/\(.*?\)/g, " ");
  x = x.replace(/บจก\.?|บริษัท|หจก\.?|ห้างหุ้นส่วนจำกัด|บ\.|จก\.?|จำกัด/g, " ");
  x = x.replace(/เอสซีจี\s*โฮม|เอสซีจีโฮม|scg\s*home/gi, " ");
  x = x.replace(/\s+/g, "").toLowerCase();
  return x;
}

/* ---- dealer map (normalize name -> code) + override ---- */
const { data: dealers } = await sb.from("dealers").select("code,name");
const dealerNorm = dealers.map((d) => ({ code: d.code, n: norm(d.name) }));
const OVERRIDE = new Map([
  ["ทรีเค โฮมเบส", "5101733"],
  ["ต.แสงอุปกรณ์โฮมมาร์ท", "5100129"],
  ["สหะชัยรีเทล (บ้านนา)", "5100974"],
]);
function mapDealer(storeRaw) {
  const key = String(storeRaw ?? "").replace(/\s+/g, " ").trim();
  if (OVERRIDE.has(key)) return OVERRIDE.get(key);
  const ns = norm(key);
  let hit = dealerNorm.find((d) => d.n === ns);
  if (!hit && ns.length >= 4) hit = dealerNorm.find((d) => d.n.length >= 4 && (d.n.includes(ns) || ns.includes(d.n)));
  return hit ? hit.code : null;
}

const wb = XLSX.read(readFileSync(join(DIR, FILE)), { type: "buffer" });

const rows = [];
const months = new Map();
let mapped = 0, unmapped = 0;
const missStores = new Map();

/* ---------- sheet DATA ---------- */
{
  const d = XLSX.utils.sheet_to_json(wb.Sheets["DATA"], { header: 1, blankrows: false, defval: null });
  // คอลัมน์ชื่อสาขา = ทุกคอลัมน์ที่ header ขึ้นต้น "สาขา " (24..67)
  const head = d[0];
  const storeCols = [];
  head.forEach((h, i) => { if (/^สาขา\s/.test(String(h ?? "").trim())) storeCols.push(i); });
  for (let r = 1; r < d.length; r++) {
    const row = d[r]; if (!row) continue;
    const date = serialToDate(row[0]);
    if (!date) continue;
    // ชื่อสาขา = ค่าแรกที่ไม่ว่างในกลุ่ม storeCols
    let store = null;
    for (const c of storeCols) { const v = str(row[c]); if (v) { store = v; break; } }
    if (!store) continue;
    const overall = num(row[16]);
    rows.push({
      period: date.slice(0, 7), eval_date: date,
      dealer_code: mapDealer(store), dealer_name: store,
      region: str(row[1]), purpose: str(row[8]), product: str(row[9]),
      overall, pct: overall != null ? overall / 10 : null,
      q_welcome: num(row[10]), q_recommend: num(row[11]), q_inform: num(row[12]),
      q_ontime: num(row[13]), q_estimate: num(row[15]), q_refer: num(row[17]),
      use_estimate: str(row[14]), impress_text: comment(row[18]), improve_text: comment(row[19]),
      source_sheet: "DATA", source_file: FILE,
    });
  }
}

for (const r of rows) {
  if (r.dealer_code) mapped++; else { unmapped++; missStores.set(r.dealer_name, (missStores.get(r.dealer_name) ?? 0) + 1); }
  if (r.period) months.set(r.period, (months.get(r.period) ?? 0) + 1);
}
const scored = rows.filter((r) => r.overall != null);
const avg = scored.reduce((s, r) => s + r.overall, 0) / (scored.length || 1);
const nImprove = rows.filter((r) => r.improve_text).length;
const nImpress = rows.filter((r) => r.impress_text).length;
console.log(`มีคอมเมนต์ปรับปรุง = ${nImprove} | ประทับใจ = ${nImpress}`);

console.log(`\nแถวทั้งหมด = ${rows.length} | map dealer เจอ ${mapped} / ไม่เจอ ${unmapped}`);
console.log(`overall เฉลี่ย = ${avg.toFixed(3)} (${(avg * 10).toFixed(1)}%) | n=${scored.length}`);
console.log("ต่อเดือน:");
[...months.keys()].sort().forEach((p) => console.log(`  ${p}: ${months.get(p)}`));
console.log(`ร้านที่ map ไม่เจอ (distinct ${missStores.size}):`);
[...missStores.entries()].sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`  "${s}" x${n}`));

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

console.log("\nAPPLY: ล้างตาราง cust_sat_lines แล้ว insert ใหม่...");
{ const { error } = await sb.from("cust_sat_lines").delete().neq("id", 0); if (error) { console.error("delete:", error.message); process.exit(1); } }
const CHUNK = 500; let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const { error } = await sb.from("cust_sat_lines").insert(rows.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert:", error.message); process.exit(1); }
  done += Math.min(CHUNK, rows.length - i); process.stdout.write(`\r  insert ${done}/${rows.length}`);
}
console.log(`\nDONE cust_sat_lines=${rows.length}`);
