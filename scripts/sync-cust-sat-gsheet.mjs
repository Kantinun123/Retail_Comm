/* Sync ความพึงพอใจลูกค้า (แบบสอบถามงานบริการ — ทั้ง Housing Expert และ SCG Home) จาก Google Sheet -> cust_sat_lines
   -------------------------------------------------------------
   - ต้นทาง: env CUSTSAT_GSHEET_SERVICE_CSV_URL (ลิงก์ export CSV) หรือ --url
   - Sheet เป็นต้นทางของคำตอบตั้งแต่ CUTOFF (1 ต.ค. 2026) เท่านั้น
     ก่อนหน้านั้นมาจากไฟล์ xlsx sheet DATA (import-cust-sat.mjs) — ไม่ถูกแตะ
   - คีย์: source_key = "<YYYY-MM-DD>T<HH:MM:SS>|<สาขา>" (Sheet ไม่มีรหัสคำตอบ)
   - sync: เพิ่ม / แก้ / ลบ เฉพาะแถวที่ eval_date >= CUTOFF ; ไม่ดึงชื่อ/เบอร์ลูกค้า
   - คอลัมน์ (ลำดับเดียวกับ DATA): [0]เวลา [1]เขต [3]สาขา [4]วัตถุประสงค์ [5]สินค้า [6]ต้อนรับ [7]แนะนำ
     [8]แจ้งขั้นตอน [9]ตรงเวลา [10]ใช้บริการถอดแบบ [11]ถอดแบบ [12]ภาพรวม [13]แนะนำต่อ [14]ประทับใจ [15]ปรับปรุง
   - กันพัง: จำนวนแถวในช่วงลดลงเกิน 30% -> หยุด (ใช้ --force ถ้าตั้งใจ)

   DRY RUN: node scripts/sync-cust-sat-gsheet.mjs
   APPLY:   node scripts/sync-cust-sat-gsheet.mjs --apply [--force]
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const CUTOFF = "2026-10-01";
const SOURCE_FILE = "gsheet:CustSat บริการ";
const SOURCE_SHEET = "GSHEET_SERVICE";
const MAX_DROP = 0.3;

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const urlIdx = process.argv.indexOf("--url");
const CSV_URL = urlIdx > -1 ? process.argv[urlIdx + 1] : env.CUSTSAT_GSHEET_SERVICE_CSV_URL;
if (!CSV_URL) { console.error("ไม่พบลิงก์: ตั้ง CUSTSAT_GSHEET_SERVICE_CSV_URL ใน .env หรือใส่ --url"); process.exit(1); }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ---- helpers (เหมือน import-cust-sat.mjs) ---- */
const SHEET_ERR = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)$/i;
const str = (v) => { const s = String(v ?? "").trim(); return s === "" || SHEET_ERR.test(s) ? null : s; };
const comment = (v) => { const s = str(v); if (!s) return null; if (/^(ไม่มี|ไม่ม|-| no|none|n\/a)\.?$/i.test(s)) return null; return s; };
const num = (v) => { const s = str(v); if (s == null) return null; const n = Number(s.replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
function parseCsv(text) {
  const rows = []; let cur = [], f = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { cur.push(f); f = ""; }
    else if (c === "\n") { cur.push(f); rows.push(cur); cur = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f.length || cur.length) { cur.push(f); rows.push(cur); }
  return rows;
}
/** "1/10/2026, 8:42:28" (d/m/yyyy) -> { date: "2026-10-01", time: "08:42:28" } */
function parseTs(v) {
  const m = String(v ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  let y = Number(m[3]); if (y > 2400) y -= 543;
  const date = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const time = `${m[4].padStart(2, "0")}:${m[5]}:${m[6] ?? "00"}`;
  return { date, time };
}
function norm(s) {
  let x = String(s ?? "").trim();
  x = x.replace(/\(.*?\)/g, " ");
  x = x.replace(/บจก\.?|บริษัท|หจก\.?|ห้างหุ้นส่วนจำกัด|บ\.|จก\.?|จำกัด/g, " ");
  x = x.replace(/เอสซีจี\s*โฮม|เอสซีจีโฮม|scg\s*home/gi, " ");
  return x.replace(/\s+/g, "").toLowerCase();
}
const { data: dealers, error: dErr } = await sb.from("dealers").select("code,name,model");
if (dErr) { console.error("โหลด dealers ไม่สำเร็จ:", dErr.message); process.exit(1); }
const dealerNorm = dealers.map((d) => ({ code: d.code, n: norm(d.name) }));
const dealerModel = new Map(dealers.map((d) => [d.code, d.model]));
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

/* ---- อ่าน Sheet ---- */
const res = await fetch(CSV_URL, { redirect: "follow" });
if (!res.ok) { console.error(`ดาวน์โหลดไม่สำเร็จ: HTTP ${res.status}`); process.exit(1); }
const text = await res.text();
if (!/csv|text\/plain/i.test(res.headers.get("content-type") ?? "") || /^\s*<!doctype html/i.test(text)) {
  console.error("ได้หน้าเว็บแทน CSV (อาจถูกจำกัดสิทธิ์/ต้องล็อกอิน) — ยกเลิก"); process.exit(1);
}
const d = parseCsv(text).filter((r) => r.some((x) => String(x ?? "").trim() !== ""));
const head = d[0].map((h) => String(h).replace(/\s+/g, " ").trim());
const EXPECT = { 0: "ประทับเวลา", 3: "สาขา", 12: "ความพึงพอใจโดยรวม", 13: "แนะนำบุคคลอื่น" };
for (const [i, w] of Object.entries(EXPECT)) {
  if (!head[i] || !head[i].includes(w)) { console.error(`คอลัมน์ [${i}] ไม่ใช่ "${w}" (ได้ "${head[i] ?? ""}") — โครงสร้างเปลี่ยน ยกเลิก`); process.exit(1); }
}

const rows = [];
const seenKey = new Map();
let badTs = 0, noStore = 0, before = 0, dupKey = 0;
const miss = new Map();
for (const r of d.slice(1)) {
  const ts = parseTs(r[0]);
  if (!ts) { badTs++; continue; }
  if (ts.date < CUTOFF) { before++; continue; }
  const store = str(r[3]);
  if (!store) { noStore++; continue; }
  const key = `${ts.date}T${ts.time}|${store.replace(/\s+/g, " ")}`;
  if (seenKey.has(key)) { dupKey++; continue; }
  const dealer_code = mapDealer(store);
  if (!dealer_code) miss.set(store, (miss.get(store) ?? 0) + 1);
  const overall = num(r[12]);
  const row = {
    source_key: key,
    period: ts.date.slice(0, 7), eval_date: ts.date,
    dealer_code, dealer_name: store,
    region: str(r[1]), purpose: str(r[4]), product: str(r[5]),
    overall, pct: overall != null ? overall / 10 : null,
    q_welcome: num(r[6]), q_recommend: num(r[7]), q_inform: num(r[8]),
    q_ontime: num(r[9]), use_estimate: str(r[10]), q_estimate: num(r[11]), q_refer: num(r[13]),
    impress_text: comment(r[14]), improve_text: comment(r[15]),
    source_sheet: SOURCE_SHEET, source_file: SOURCE_FILE,
  };
  seenKey.set(key, row);
  rows.push(row);
}

/* ---- ฐานข้อมูล: แถวในช่วงที่ Sheet เป็นเจ้าของ ---- */
const FIELDS = ["period", "eval_date", "dealer_code", "dealer_name", "region", "purpose", "product", "overall", "pct",
  "q_welcome", "q_recommend", "q_inform", "q_ontime", "use_estimate", "q_estimate", "q_refer", "impress_text", "improve_text"];
const db = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("cust_sat_lines").select(["id", "source_key", "source_file", ...FIELDS].join(","))
    .gte("eval_date", CUTOFF).order("id").range(from, from + 999);
  if (error) { console.error("อ่านฐานข้อมูลไม่สำเร็จ:", error.message); process.exit(1); }
  db.push(...data); if (data.length < 1000) break;
}
const dbByKey = new Map(db.filter((x) => x.source_key).map((x) => [x.source_key, x]));
const legacy = db.filter((x) => !x.source_key); // แถวจาก xlsx DATA ในช่วงที่ Sheet เป็นเจ้าของ -> จะถูกแทน

/* ตรวจความตรงของการ map คอลัมน์: เทียบแถว legacy (DATA) กับ Sheet ด้วย วันที่+สาขา แล้วดูคะแนน */
let cmp = 0, sameScore = 0;
{
  const pool = new Map();
  for (const x of legacy) { const k = `${x.eval_date}|${String(x.dealer_name ?? "").replace(/\s+/g, " ").trim()}`; (pool.get(k) ?? pool.set(k, []).get(k)).push(x); }
  for (const r of rows) {
    const list = pool.get(`${r.eval_date}|${r.dealer_name.replace(/\s+/g, " ")}`);
    if (!list || !list.length) continue;
    const i = list.findIndex((x) => Number(x.overall) === Number(r.overall) && Number(x.q_welcome) === Number(r.q_welcome) && Number(x.q_refer) === Number(r.q_refer));
    cmp++; if (i >= 0) { sameScore++; list.splice(i, 1); } else list.shift();
  }
}

const norm2 = (k, v) => (v === undefined || v === "" ? null : ["overall", "pct", "q_welcome", "q_recommend", "q_inform", "q_ontime", "q_estimate", "q_refer"].includes(k) && v != null ? Number(v) : v);
const toInsert = [], toUpdate = [];
for (const r of rows) {
  const cur = dbByKey.get(r.source_key);
  if (!cur) { toInsert.push(r); continue; }
  const diff = FIELDS.filter((k) => norm2(k, cur[k]) !== norm2(k, r[k]));
  if (diff.length) toUpdate.push({ r, cur, diff });
}
const keys = new Set(rows.map((r) => r.source_key));
const toDelete = [...legacy, ...db.filter((x) => x.source_key && !keys.has(x.source_key))];

/* ---- รายงาน ---- */
const byM = (list) => { const m = {}; list.forEach((x) => (m[x.period] = (m[x.period] ?? 0) + 1)); return Object.keys(m).sort().map((p) => `${p}:${m[p]}`).join(" "); };
const modelCount = (list) => { const m = {}; list.forEach((x) => { const k = dealerModel.get(x.dealer_code) ?? "ไม่ระบุร้าน"; m[k] = (m[k] ?? 0) + 1; }); return JSON.stringify(m); };
const scored = rows.filter((r) => r.overall != null).map((r) => r.overall);
console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
console.log(`Sheet: ${d.length - 1} แถว | ก่อน ${CUTOFF} ${before} (ไม่ใช้) | ใช้ได้ ${rows.length} | เวลาอ่านไม่ได้ ${badTs} | ไม่มีสาขา ${noStore} | คีย์ซ้ำ ${dupKey}`);
console.log(`  ต่อเดือน: ${byM(rows)} | ต่อ Model: ${modelCount(rows)}`);
console.log(`  คะแนนภาพรวม: ต่ำสุด ${Math.min(...scored)} สูงสุด ${Math.max(...scored)} เฉลี่ย ${(scored.reduce((a, b) => a + b, 0) / (scored.length || 1)).toFixed(2)} (n=${scored.length})`);
console.log(`  ร้านที่ map ไม่ได้: ${miss.size ? [...miss.entries()].map(([s, n]) => `"${s}" x${n}`).join(", ") : "ไม่มี"}`);
console.log(`ตรวจการ map คอลัมน์ (เทียบกับข้อมูลเดิมจาก DATA): ${cmp} คู่ | คะแนนตรงกัน ${sameScore}`);
console.log(`\nฐานข้อมูลช่วง >= ${CUTOFF}: ${db.length} แถว (จาก DATA เดิม ${legacy.length} | จาก Sheet ${db.length - legacy.length})`);
console.log(`เพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length} (แทนแถวเดิมจาก DATA ${legacy.length})`);
if (toUpdate.length) toUpdate.slice(0, 15).forEach(({ r, cur, diff }) => console.log(`  แก้ ${r.source_key}: ${diff.map((k) => `${k}: ${cur[k] ?? "∅"} → ${r[k] ?? "∅"}`).join(" ; ")}`));
const extraDel = toDelete.length - legacy.length;
if (extraDel) console.log(`  ลบเพราะหายจาก Sheet: ${extraDel}`);

if (db.length && rows.length < db.length * (1 - MAX_DROP) && !FORCE) {
  console.error(`\nหยุด: จำนวนแถวในช่วงลดลงเกิน ${MAX_DROP * 100}% (${db.length} → ${rows.length}) — ไฟล์อาจไม่ครบ ใช้ --force ถ้าตั้งใจ`);
  process.exit(2);
}
if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อ sync จริง"); process.exit(0); }

/* ---- เขียน: upsert ก่อน แล้วค่อยลบ ---- */
const ups = [...toInsert, ...toUpdate.map((u) => u.r)];
for (let i = 0; i < ups.length; i += 500) {
  const { error } = await sb.from("cust_sat_lines").upsert(ups.slice(i, i + 500), { onConflict: "source_key" });
  if (error) { console.error("upsert ไม่สำเร็จ:", error.message); process.exit(1); }
}
const delIds = toDelete.map((x) => x.id);
for (let i = 0; i < delIds.length; i += 500) {
  const { error } = await sb.from("cust_sat_lines").delete().in("id", delIds.slice(i, i + 500));
  if (error) { console.error("ลบไม่สำเร็จ:", error.message); process.exit(1); }
}
const { count } = await sb.from("cust_sat_lines").select("id", { count: "exact", head: true });
console.log(`\nDONE: เพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length} | ทั้งตาราง ${count} แถว`);
