/* Sync ผลตรวจประเมินร้าน จาก Google Sheet (ผลจาก Jotform) -> store_eval_lines + store_eval_items
   -------------------------------------------------------------
   - โครงสร้างเดียวกับไฟล์ "แบบตรวจมาตรฐานการให้บริการ Housing Expert New 2025.xlsx" (235 คอลัมน์)
     กติกาเดียวกับ import-store-eval.mjs + import-eval-items.mjs
   - key = Submission ID (คอลัมน์ 234) ; เพิ่ม/แก้/ลบ เฉพาะที่เปลี่ยน (ไม่ล้างตาราง)
   - ข้อย่อย (store_eval_items) เขียนใหม่เฉพาะการตรวจที่เพิ่ม/แก้/ข้อย่อยเปลี่ยน
   - วันที่ในชีต = dd-mm-yyyy (รองรับ Excel serial / d/m/yyyy ด้วย)
   - กันพัง: ชีตมีแถวน้อยกว่า 90% ของฐานข้อมูล หรือจะลบเกิน 5% -> หยุด (ใช้ --force ถ้าตั้งใจ)

   ที่มา: env STORE_EVAL_GSHEET_CSV_URL (ลิงก์ export CSV) หรือ --url <ลิงก์>
   DRY RUN: node scripts/sync-store-eval-gsheet.mjs
   APPLY:   node scripts/sync-store-eval-gsheet.mjs --apply [--force]
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const argUrl = (() => { const i = process.argv.indexOf("--url"); return i >= 0 ? process.argv[i + 1] : null; })();
const SOURCE = "Google Sheet (Jotform)";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const CSV_URL = argUrl ?? env.STORE_EVAL_GSHEET_CSV_URL;
if (!CSV_URL) { console.error("ไม่พบลิงก์: ตั้ง STORE_EVAL_GSHEET_CSV_URL ใน .env หรือใช้ --url"); process.exit(1); }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ---------- helpers ---------- */
const str = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === "" ? null : s; };
const num = (v) => { if (v === undefined || v === null || String(v).trim() === "") return null; const n = Number(String(v).replace(/[,%\s]/g, "")); return Number.isFinite(n) ? n : null; };
function toDate(v) {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const n = Number(s);
  if (Number.isFinite(n) && n > 1000) { const dt = new Date(Math.round((n - 25569) * 86400 * 1000)); return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10); }
  return null;
}
const parseScore = (v) => { const m = String(v ?? "").match(/([\d.]+)\s*\/\s*([\d.]+)/); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; };
function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f.replace(/\r$/, "")); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function cleanLabel(h) {
  let s = String(h ?? "");
  const idx = s.indexOf(">>");
  if (idx >= 0) s = s.slice(idx + 2);
  return s.replace(/\s+/g, " ").trim().replace(/^\d+\.\s*/, "");
}

/* ---------- คอลัมน์ (เหมือนไฟล์ Excel เดิม) ---------- */
const C = { date: 0, inspector: 1, store: 3, totalNum: 142, pct: 168, result: 169, total: 176, s1: 177, s2: 178, s3: 179, s4: 180, s5: 181, s6: 182, subId: 234 };
const PHYSICAL = [
  { key: "s1_sign", cols: [34] },
  { key: "s2_booth", cols: [36, 37, 38, 39, 40, 41, 42] },
  { key: "s3_counter", cols: [50, 51, 52] },
];
const PEOPLE = [
  { key: "s4_staff", persons: { 1: [57, 58, 59], 2: [64, 65, 66], 3: [71, 72, 73] } },
  { key: "s5_estimate", persons: { 1: [80, 81, 82, 83, 84], 2: [101, 102, 103, 104, 105], 3: [122, 123, 124, 125, 126] } },
  { key: "s6_sales", persons: { 1: [86, 87, 88, 89, 90, 91, 92], 2: [107, 108, 109, 110, 111, 112, 113], 3: [128, 129, 130, 131, 132, 133, 134] } },
];

/* ---------- ดาวน์โหลด ---------- */
const res = await fetch(CSV_URL, { redirect: "follow" });
if (!res.ok) { console.error(`ดาวน์โหลด Google Sheet ไม่สำเร็จ: HTTP ${res.status}`); process.exit(1); }
const ctype = res.headers.get("content-type") ?? "";
const text = await res.text();
if (!/csv|text\/plain/i.test(ctype) || /^\s*<!doctype html/i.test(text)) {
  console.error("ได้หน้าเว็บแทน CSV — ชีตอาจไม่ได้เปิดสิทธิ์ให้ทุกคนที่มีลิงก์ดูได้ หรือลิงก์ไม่ใช่ export CSV"); process.exit(1);
}
const d = parseCsv(text);
const head = d[0] ?? [];
// ตรวจโครงสร้าง (ถ้าคอลัมน์เลื่อน = หยุด ไม่เขียนข้อมูลผิดช่อง)
const checks = [[C.subId, /Submission ID/i], [C.store, /ร้าน/], [C.result, /ผลการประเมิน/], [C.totalNum, /คะแนนรวมทุกข้อ/], [C.date, /วันที่/]];
for (const [i, re] of checks) {
  if (!re.test(String(head[i] ?? ""))) { console.error(`โครงสร้างชีตเปลี่ยน: คอลัมน์ ${i} = "${head[i] ?? ""}" (คาด ${re}) — ยกเลิก`); process.exit(1); }
}

/* ---------- dealers ---------- */
const dealerName = new Map();
{ const { data, error } = await sb.from("dealers").select("code,name"); if (error) { console.error("dealers:", error.message); process.exit(1); } data.forEach((x) => dealerName.set(String(x.code).trim(), x.name)); }

/* ---------- แปลงชีต -> lines + items ---------- */
const lines = new Map(); // subId -> row
const items = new Map(); // subId -> rows[]
let noCode = 0, noDate = 0, dupSub = 0, unknownDealer = 0;
for (let r = 1; r < d.length; r++) {
  const row = d[r];
  if (!row || row.length < 200) continue;
  const subId = str(row[C.subId]);
  if (!subId) continue;
  if (lines.has(subId)) { dupSub++; continue; }
  const storeTxt = String(row[C.store] ?? "").replace(/\r/g, "").trim();
  const cm = storeTxt.match(/(\d{6,8})/);
  if (!cm) { noCode++; continue; }
  const code = cm[1];
  const evalDate = toDate(row[C.date]);
  if (!evalDate) { noDate++; continue; }
  const period = evalDate.slice(0, 7);
  const parts = storeTxt.split("\n").map((s) => s.trim()).filter(Boolean);
  const region = parts.length > 1 ? parts[0] : null;
  const rawStoreName = (parts.length > 1 ? parts.slice(1).join(" ") : parts[0]).replace(/\s*\d{6,8}\s*$/, "").trim();
  if (!dealerName.has(code)) unknownDealer++;
  const [tScore, tMax] = parseScore(row[C.total]);
  const sc = [C.s1, C.s2, C.s3, C.s4, C.s5, C.s6].map((c) => parseScore(row[c]));
  const pctRaw = num(row[C.pct]);
  lines.set(subId, {
    submission_id: subId,
    period,
    eval_date: evalDate,
    dealer_code: code,
    dealer_name: dealerName.get(code) ?? rawStoreName ?? null,
    region,
    inspector: str(row[C.inspector]),
    result: str(row[C.result]),
    total_score: num(row[C.totalNum]) ?? tScore,
    max_score: tMax || 100,
    // ชีตส่ง "95%" ; ไฟล์ Excel เดิมเก็บ 0.95 -> แปลงให้เป็นสัดส่วนเหมือนเดิม
    pct: pctRaw == null ? (tMax ? tScore / tMax : 0) : pctRaw > 1 ? Math.round(pctRaw * 100) / 10000 : pctRaw,
    s1_sign: sc[0][0], s1_sign_max: sc[0][1],
    s2_booth: sc[1][0], s2_booth_max: sc[1][1],
    s3_counter: sc[2][0], s3_counter_max: sc[2][1],
    s4_staff: sc[3][0], s4_staff_max: sc[3][1],
    s5_estimate: sc[4][0], s5_estimate_max: sc[4][1],
    s6_sales: sc[5][0], s6_sales_max: sc[5][1],
    source_file: SOURCE,
  });
  const its = [];
  const push = (cat, c, i, staffNo) => {
    const v = row[c];
    if (v == null || String(v).trim() === "") return;
    its.push({ submission_id: subId, period, dealer_code: code, category_key: cat, item_no: i + 1, staff_no: staffNo, item_label: cleanLabel(head[c]), passed: !/ไม่ผ่าน/.test(String(v)) });
  };
  for (const cat of PHYSICAL) cat.cols.forEach((c, i) => push(cat.key, c, i, null));
  for (const cat of PEOPLE) for (const pn of [1, 2, 3]) {
    const cols = cat.persons[pn];
    if (!cols.some((c) => row[c] != null && String(row[c]).trim() !== "")) continue;
    cols.forEach((c, i) => push(cat.key, c, i, pn));
  }
  items.set(subId, its);
}
console.log(`ชีต: ${lines.size} การตรวจ | ข้ามซ้ำ ${dupSub} | ไม่มีรหัสร้าน ${noCode} | วันที่อ่านไม่ได้ ${noDate} | รหัสร้านไม่อยู่ในระบบ ${unknownDealer}`);

/* ---------- ฐานข้อมูล ---------- */
async function pageAll(table, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).order("id").range(from, from + 999);
    if (error) { console.error(`อ่าน ${table} ไม่สำเร็จ:`, error.message); process.exit(1); }
    out.push(...data); if (data.length < 1000) break;
  }
  return out;
}
const FIELDS = ["period", "eval_date", "dealer_code", "dealer_name", "region", "inspector", "result", "total_score", "max_score", "pct",
  "s1_sign", "s1_sign_max", "s2_booth", "s2_booth_max", "s3_counter", "s3_counter_max", "s4_staff", "s4_staff_max", "s5_estimate", "s5_estimate_max", "s6_sales", "s6_sales_max"];
const dbLines = await pageAll("store_eval_lines", ["submission_id", ...FIELDS].join(","));
const dbItems = await pageAll("store_eval_items", "submission_id,category_key,item_no,staff_no,passed,item_label");
const dbMap = new Map(dbLines.map((x) => [x.submission_id, x]));
const sig = (arr) => arr.map((x) => `${x.category_key}|${x.staff_no ?? ""}|${x.item_no}|${x.passed ? 1 : 0}|${x.item_label}`).sort().join("#");
const dbItemSig = new Map();
{ const g = new Map(); dbItems.forEach((x) => { const a = g.get(x.submission_id) ?? []; a.push(x); g.set(x.submission_id, a); }); g.forEach((a, k) => dbItemSig.set(k, sig(a))); }

const same = (a, b) => (a == null && b == null) || (typeof b === "number" || typeof a === "number" ? Math.abs(Number(a) - Number(b)) < 1e-6 : String(a) === String(b));
const toInsert = [], toUpdate = [], itemsRewrite = [];
for (const [id, row] of lines) {
  const cur = dbMap.get(id);
  if (!cur) { toInsert.push(row); itemsRewrite.push(id); continue; }
  const changed = FIELDS.filter((f) => !same(cur[f], row[f]));
  if (changed.length) toUpdate.push({ row, changed });
  if ((dbItemSig.get(id) ?? "") !== sig(items.get(id) ?? [])) itemsRewrite.push(id);
}
const toDelete = dbLines.filter((x) => !lines.has(x.submission_id));
const itemsRewriteSet = new Set(itemsRewrite);

console.log(`ฐานข้อมูล: ${dbLines.length} การตรวจ | ${dbItems.length} ข้อย่อย`);
console.log(`→ เพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length} | เขียนข้อย่อยใหม่ ${itemsRewriteSet.size} การตรวจ`);
toInsert.forEach((x) => console.log(`  + ${x.eval_date} | ${x.dealer_code} ${x.dealer_name ?? ""} | ${x.total_score} | ${x.result}`));
toUpdate.slice(0, 20).forEach(({ row, changed }) => console.log(`  ~ ${row.submission_id} ${row.dealer_code}: ${changed.map((f) => `${f} ${dbMap.get(row.submission_id)[f]} -> ${row[f]}`).join(", ")}`));
toDelete.forEach((x) => console.log(`  - ${x.eval_date} | ${x.dealer_code} | ${x.submission_id} (ไม่มีในชีตแล้ว)`));

if (dbLines.length && (lines.size < dbLines.length * 0.9 || toDelete.length > dbLines.length * 0.05) && !FORCE) {
  console.error("หยุด: ชีตมีข้อมูลน้อยกว่าฐานข้อมูลผิดปกติ — ตรวจชีตก่อน หรือใช้ --force ถ้าตั้งใจ");
  process.exit(2);
}
if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อ sync จริง"); process.exit(0); }

/* ---------- เขียน ---------- */
const upserts = [...toInsert, ...toUpdate.map((u) => u.row)];
for (let i = 0; i < upserts.length; i += 500) {
  const { error } = await sb.from("store_eval_lines").upsert(upserts.slice(i, i + 500), { onConflict: "submission_id" });
  if (error) { console.error("upsert ไม่สำเร็จ:", error.message); process.exit(1); }
}
const delIds = toDelete.map((x) => x.submission_id);
const clearItems = [...new Set([...itemsRewriteSet, ...delIds])];
for (let i = 0; i < clearItems.length; i += 200) {
  const { error } = await sb.from("store_eval_items").delete().in("submission_id", clearItems.slice(i, i + 200));
  if (error) { console.error("ลบข้อย่อยไม่สำเร็จ:", error.message); process.exit(1); }
}
const newItems = [...itemsRewriteSet].flatMap((id) => items.get(id) ?? []);
for (let i = 0; i < newItems.length; i += 1000) {
  const { error } = await sb.from("store_eval_items").insert(newItems.slice(i, i + 1000));
  if (error) { console.error("เพิ่มข้อย่อยไม่สำเร็จ:", error.message); process.exit(1); }
}
for (let i = 0; i < delIds.length; i += 200) {
  const { error } = await sb.from("store_eval_lines").delete().in("submission_id", delIds.slice(i, i + 200));
  if (error) { console.error("ลบการตรวจไม่สำเร็จ:", error.message); process.exit(1); }
}
const { count } = await sb.from("store_eval_lines").select("id", { count: "exact", head: true });
console.log(`\nDONE: เพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length} | ข้อย่อยเขียนใหม่ ${newItems.length} แถว | ทั้งตาราง ${count} การตรวจ`);
