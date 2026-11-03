/* นำเข้าข้อย่อยผลตรวจ (ผ่าน/ไม่ผ่าน) -> store_eval_items
   -------------------------------------------------------------
   - 6 หมวด map ตาม store_eval_lines (s1..s6), ใช้ People = คนที่ 1
   - label = ข้อความหลัง ">>" (ตัดหัวหมวด)
   - submission_id เชื่อมกับ store_eval_lines
   - idempotent: ลบตารางแล้ว insert ใหม่

   DRY RUN: node scripts/import-eval-items.mjs
   APPLY:   node scripts/import-eval-items.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app/ผลตรวจประเมินร้าน";
const FILE = "แบบตรวจมาตรฐานการให้บริการ Housing Expert New 2025.xlsx";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const serialToDate = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 1000) return null;
  const dt = new Date(Math.round((n - 25569) * 86400 * 1000));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
};

/* dealer map: ดึง code จากคอลัมน์ [3] เหมือน import หลัก */
function codeFromStore(txt) {
  const m = String(txt ?? "").match(/(\d{6,8})/);
  return m ? m[1] : null;
}
/* ตัดหัวหมวดออกจาก header: เอาเฉพาะหลัง ">>" และลบเลขข้อนำหน้า */
function cleanLabel(h) {
  let s = String(h ?? "");
  const idx = s.indexOf(">>");
  if (idx >= 0) s = s.slice(idx + 2);
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^\d+\.\s*/, ""); // ตัด "3." นำหน้า
  return s;
}

/* หมวด Physical (ร้าน) — staff_no = null */
const PHYSICAL = [
  { key: "s1_sign", cols: [34] },
  { key: "s2_booth", cols: [36, 37, 38, 39, 40, 41, 42] },
  { key: "s3_counter", cols: [50, 51, 52] },
];
/* หมวด People — เก็บทุกคนที่ประเมิน (P1/P2/P3), ข้ามคนที่ไม่มีข้อมูล */
const PEOPLE = [
  {
    key: "s4_staff",
    persons: { 1: [57, 58, 59], 2: [64, 65, 66], 3: [71, 72, 73] },
  },
  {
    key: "s5_estimate",
    persons: { 1: [80, 81, 82, 83, 84], 2: [101, 102, 103, 104, 105], 3: [122, 123, 124, 125, 126] },
  },
  {
    key: "s6_sales",
    persons: { 1: [86, 87, 88, 89, 90, 91, 92], 2: [107, 108, 109, 110, 111, 112, 113], 3: [128, 129, 130, 131, 132, 133, 134] },
  },
];

const wb = XLSX.read(readFileSync(join(DIR, FILE)), { type: "buffer" });
const d = XLSX.utils.sheet_to_json(wb.Sheets["Form responses"], { header: 1, blankrows: false, defval: null });
const head = d[0];

const C_DATE = 0, C_STORE = 3, C_SUBID = 234;
const rows = [];
let failCount = 0;
const seenSub = new Set();

for (let r = 1; r < d.length; r++) {
  const row = d[r]; if (!row) continue;
  const subId = String(row[C_SUBID] ?? "").trim();
  if (!subId || seenSub.has(subId)) continue;
  seenSub.add(subId);
  const date = serialToDate(row[C_DATE]);
  const period = date ? date.slice(0, 7) : null;
  const code = codeFromStore(row[C_STORE]);
  if (!period) continue;

  // Physical (ร้าน) — staff_no = null
  for (const cat of PHYSICAL) {
    cat.cols.forEach((c, i) => {
      const v = row[c];
      if (v == null || String(v).trim() === "") return;
      const passed = !/ไม่ผ่าน/.test(String(v));
      if (!passed) failCount++;
      rows.push({
        submission_id: subId, period, dealer_code: code,
        category_key: cat.key, item_no: i + 1, staff_no: null,
        item_label: cleanLabel(head[c]), passed,
      });
    });
  }
  // People — เก็บทุกคนที่มีข้อมูล (P1/P2/P3)
  for (const cat of PEOPLE) {
    for (const pn of [1, 2, 3]) {
      const cols = cat.persons[pn];
      // ข้ามคนที่ไม่ได้ประเมิน (ทุกคอลัมน์ว่าง)
      const answered = cols.some((c) => row[c] != null && String(row[c]).trim() !== "");
      if (!answered) continue;
      cols.forEach((c, i) => {
        const v = row[c];
        if (v == null || String(v).trim() === "") return;
        const passed = !/ไม่ผ่าน/.test(String(v));
        if (!passed) failCount++;
        rows.push({
          submission_id: subId, period, dealer_code: code,
          category_key: cat.key, item_no: i + 1, staff_no: pn,
          item_label: cleanLabel(head[c]), passed,
        });
      });
    }
  }
}

console.log(`\nข้อย่อยทั้งหมด = ${rows.length} | ไม่ผ่าน = ${failCount} | การตรวจ ${seenSub.size} ครั้ง`);
// ตัวอย่าง label ต่อหมวด
for (const cat of [...PHYSICAL, ...PEOPLE]) {
  const nItems = rows.filter((x) => x.category_key === cat.key).length;
  const sample = rows.find((x) => x.category_key === cat.key);
  console.log(`  ${cat.key}: ${nItems} แถว | ตย. "${sample ? sample.item_label.slice(0, 50) : "-"}"`);
}

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

console.log("\nAPPLY: ล้าง store_eval_items แล้ว insert...");
{ const { error } = await sb.from("store_eval_items").delete().neq("id", 0); if (error) { console.error("delete:", error.message); process.exit(1); } }
const CHUNK = 1000; let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const { error } = await sb.from("store_eval_items").insert(rows.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert:", error.message); process.exit(1); }
  done += Math.min(CHUNK, rows.length - i); process.stdout.write(`\r  insert ${done}/${rows.length}`);
}
console.log(`\nDONE store_eval_items=${rows.length}`);
