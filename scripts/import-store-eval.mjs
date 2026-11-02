/* นำเข้าผลตรวจประเมินร้าน -> store_eval_lines
   -------------------------------------------------------------
   - อ่าน sheet "Form responses" (792 แถว) จากไฟล์แบบตรวจฯ
   - map dealer_code (เลข 6-8 หลักท้ายคอลัมน์ [3]) -> ชื่อร้านจริงจากตาราง dealers
   - period = เดือนของวันที่ตรวจ (YYYY-MM)
   - 6 หมวดคะแนน parse จาก "x / y คะแนน"
   - idempotent: ลบตารางแล้ว insert ใหม่ (มาจากไฟล์เดียว), กันซ้ำด้วย submission_id

   DRY RUN: node scripts/import-store-eval.mjs
   APPLY:   node scripts/import-store-eval.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app/ผลตรวจประเมินร้าน";
const FILE = "แบบตรวจมาตรฐานการให้บริการ Housing Expert New 2025.xlsx";

/* ---- env ---- */
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ---- helpers ---- */
const str = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === "" ? null : s; };
const num = (v) => { if (v === undefined || v === null || v === "") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const serialToDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
  }
  const dt = new Date(Math.round((n - 25569) * 86400 * 1000));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
};
/* parse "x / y คะแนน" -> [x, y] */
const parseScore = (v) => {
  const s = String(v ?? "");
  const m = s.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
};

/* ---- dealer map (code -> ชื่อจริง) จาก DB ---- */
const dealerName = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("dealers").select("code,name").range(from, from + 999);
  if (error) { console.error("dealers:", error.message); process.exit(1); }
  for (const d of data) dealerName.set(String(d.code).trim(), d.name);
  if (data.length < 1000) break;
}
console.log(`dealers = ${dealerName.size}`);

/* ---- อ่านไฟล์ ---- */
const wb = XLSX.read(readFileSync(join(DIR, FILE)), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Form responses"], { header: 1, blankrows: false, defval: null });

const C = { date: 0, inspector: 1, store: 3, totalNum: 142, pct: 168, result: 169,
  total: 176, s1: 177, s2: 178, s3: 179, s4: 180, s5: 181, s6: 182, subId: 234 };

const out = [];
const seen = new Set();
let dupSub = 0, noCode = 0, noDealer = 0;
const months = new Map();

for (let r = 1; r < rows.length; r++) {
  const row = rows[r]; if (!row) continue;
  const storeTxt = String(row[C.store] ?? "").replace(/\r/g, "").trim();
  if (!storeTxt) continue;
  const cm = storeTxt.match(/(\d{6,8})/);
  if (!cm) { noCode++; continue; }
  const code = cm[1];
  // ภาค = บรรทัดแรก, ชื่อร้าน = ส่วนที่เหลือ (ตัด code ออก)
  const parts = storeTxt.split("\n").map((s) => s.trim()).filter(Boolean);
  const region = parts.length > 1 ? parts[0] : null;
  const rawStoreName = (parts.length > 1 ? parts.slice(1).join(" ") : parts[0]).replace(/\s*\d{6,8}\s*$/, "").trim();

  const subId = str(row[C.subId]);
  if (subId && seen.has(subId)) { dupSub++; continue; }
  if (subId) seen.add(subId);

  const evalDate = serialToDate(row[C.date]);
  const period = evalDate ? evalDate.slice(0, 7) : null;
  if (!dealerName.has(code)) noDealer++;

  const [tScore, tMax] = parseScore(row[C.total]);
  const [a1, a1m] = parseScore(row[C.s1]);
  const [a2, a2m] = parseScore(row[C.s2]);
  const [a3, a3m] = parseScore(row[C.s3]);
  const [a4, a4m] = parseScore(row[C.s4]);
  const [a5, a5m] = parseScore(row[C.s5]);
  const [a6, a6m] = parseScore(row[C.s6]);

  out.push({
    period: period ?? "unknown",
    eval_date: evalDate,
    dealer_code: code,
    dealer_name: dealerName.get(code) ?? rawStoreName ?? null,
    region,
    inspector: str(row[C.inspector]),
    result: str(row[C.result]),
    total_score: num(row[C.totalNum]) ?? tScore,
    max_score: tMax || 100,
    pct: num(row[C.pct]) ?? (tMax ? tScore / tMax : 0),
    s1_sign: a1, s1_sign_max: a1m,
    s2_booth: a2, s2_booth_max: a2m,
    s3_counter: a3, s3_counter_max: a3m,
    s4_staff: a4, s4_staff_max: a4m,
    s5_estimate: a5, s5_estimate_max: a5m,
    s6_sales: a6, s6_sales_max: a6m,
    submission_id: subId,
    source_file: FILE,
  });
  if (period) months.set(period, (months.get(period) ?? 0) + 1);
}

console.log(`\nแถวพร้อม insert = ${out.length} | ข้ามซ้ำ submission = ${dupSub} | ไม่มี code = ${noCode} | code ไม่พบใน dealers = ${noDealer}`);
console.log("ต่อเดือน:");
[...months.keys()].sort().forEach((p) => console.log(`  ${p}: ${months.get(p)}`));
const pass = out.filter((o) => o.result === "ผ่าน").length;
console.log(`ผล: ผ่าน ${pass} | ไม่ผ่าน ${out.length - pass}`);

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

console.log("\nAPPLY: ล้างตาราง store_eval_lines แล้ว insert ใหม่...");
{ const { error } = await sb.from("store_eval_lines").delete().neq("id", 0); if (error) { console.error("delete:", error.message); process.exit(1); } }
const CHUNK = 500; let done = 0;
for (let i = 0; i < out.length; i += CHUNK) {
  const { error } = await sb.from("store_eval_lines").insert(out.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert:", error.message); process.exit(1); }
  done += Math.min(CHUNK, out.length - i); process.stdout.write(`\r  insert ${done}/${out.length}`);
}
console.log(`\nDONE store_eval_lines=${out.length}`);
