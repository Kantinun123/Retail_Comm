/* Sync แบบสอบถาม "สินค้าและร้าน" SCG Home จาก Google Sheet -> scghome_sat_lines
   -------------------------------------------------------------
   - ต้นทาง: env CUSTSAT_GSHEET_SCGHOME_CSV_URL (export CSV) หรือ --url ; Sheet เป็นต้นทางทั้งหมดของตารางนี้
   - คีย์: Case_no ; sync เพิ่ม / แก้ / ลบ
   - สาขา: ค่าแรกที่ไม่ว่างในคอลัมน์ที่หัวขึ้นต้น "สาขา " ; map ร้านแบบเดียวกับ cust_sat
   - ไม่เก็บ: ชื่อ-นามสกุล / เบอร์ / ช่วงเวลาติดต่อ / ชื่อพนักงานที่ลูกค้าระบุ / ตารางเทียบ SCG Home vs ร้านอื่น (ยังไม่ใช้)
   - กันพัง: จำนวนแถวลดลงเกิน 30% -> หยุด (--force ถ้าตั้งใจ)

   DRY RUN: node scripts/sync-scghome-sat-gsheet.mjs
   APPLY:   node scripts/sync-scghome-sat-gsheet.mjs --apply [--force]
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const SOURCE_FILE = "gsheet:CustSat SCG Home สินค้าและร้าน";
const MAX_DROP = 0.3;

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const urlIdx = process.argv.indexOf("--url");
const CSV_URL = urlIdx > -1 ? process.argv[urlIdx + 1] : env.CUSTSAT_GSHEET_SCGHOME_CSV_URL;
if (!CSV_URL) { console.error("ไม่พบลิงก์: ตั้ง CUSTSAT_GSHEET_SCGHOME_CSV_URL ใน .env หรือใส่ --url"); process.exit(1); }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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
function parseDate(v) {
  const m = String(v ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  let y = Number(m[3]); if (y > 2400) y -= 543;
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
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
const dealerNorm = dealers.map((d) => ({ code: d.code, n: norm(d.name), full: norm(String(d.name).replace(/[()]/g, " ")) }));
const dealerModel = new Map(dealers.map((d) => [d.code, d.model]));
const dealerName = new Map(dealers.map((d) => [d.code, d.name]));
/* ชื่อใน Sheet ที่ไม่ตรงชื่อร้านในระบบ -> รหัสร้าน
   - "บุญทวีโฮมเซ็นเตอร์" = ชื่อนิติบุคคลของ 5102653 เอสซีจีโฮม บุญถาวร (จันทบุรี) ตาม Master_Dealer.csv ; Sheet อยู่ใต้คอลัมน์ "สาขา จันทบุรี" */
const OVERRIDE = new Map([["บุญทวีโฮมเซ็นเตอร์", "5102653"]]);
function mapDealer(storeRaw) {
  const key = String(storeRaw ?? "").replace(/\s+/g, " ").trim();
  if (OVERRIDE.has(key)) return OVERRIDE.get(key);
  // ลองชื่อเต็มรวมวงเล็บก่อน (SCG Home หลายสาขาชื่อร้านแม่ซ้ำกัน ต่างกันที่วงเล็บ)
  const nf = norm(key.replace(/[()]/g, " "));
  let hit = dealerNorm.find((d) => d.full === nf) ?? dealerNorm.find((d) => nf.length >= 4 && d.full.includes(nf));
  if (!hit) {
    const ns = norm(key);
    const cands = dealerNorm.filter((d) => d.n === ns || (ns.length >= 4 && d.n.length >= 4 && (d.n.includes(ns) || ns.includes(d.n))));
    if (cands.length === 1) hit = cands[0];
  }
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
const col = (re) => head.findIndex((h) => re.test(h));
const C = {
  ts: 0,
  region: 1,
  product: col(/^กลุ่มสินค้าที่ท่านมาเลือกซื้อ/),
  reason: col(/^เหตุผลที่ท่านเลือกใช้บริการ/),
  usedOther: col(/^ท่านเคยใช้บริการ ร้านวัสดุก่อสร้าง/),
  otherStore: col(/^ร้านวัสดุก่อสร้างและอุปกรณ์บ้านครบวงจร ร้านอื่น$/),
  variety: col(/^ความหลากหลายของสินค้า/),
  quality: col(/^คุณภาพของสินค้า/),
  availability: col(/^มีสินค้าพร้อมส่งมอบ/),
  price: col(/^ราคาสินค้า/),
  promotion: col(/^โปรโมชั่นสินค้า/),
  display: col(/^การจัดแสดงสินค้า/),
  staff: col(/^ความกระตือรือร้นในการให้บริการของพนักงาน/),
  payment: col(/^ความสะดวก รวดเร็วในการชำระ/),
  delivery: col(/^การจัดส่งสินค้า/),
  overall: col(/^ความพึงพอใจโดยรวม/),
  revisit: col(/^หากมีโอกาสท่านจะกลับมาใช้บริการซ้ำ/),
  impress: col(/^สิ่งที่ท่านประทับใจ/),
  improve: col(/^สิ่งที่ท่านต้องการให้แก้ไข/),
  caseNo: col(/^Case_no$/i),
};
const missing = Object.entries(C).filter(([, i]) => i < 0).map(([k]) => k);
if (missing.length) { console.error(`ไม่พบคอลัมน์: ${missing.join(", ")} — โครงสร้างเปลี่ยน ยกเลิก`); process.exit(1); }
const storeCols = head.map((h, i) => (/^สาขา\s/.test(h) ? i : -1)).filter((i) => i >= 0);

const rows = [];
const seen = new Set();
let badDate = 0, noCase = 0, noStore = 0, dup = 0;
const miss = new Map();
const scoreVals = [];
for (const r of d.slice(1)) {
  const caseNo = str(r[C.caseNo]);
  if (!caseNo) { noCase++; continue; }
  if (seen.has(caseNo)) { dup++; continue; }
  const date = parseDate(r[C.ts]);
  if (!date) { badDate++; continue; }
  let store = null; for (const c of storeCols) { const v = str(r[c]); if (v) { store = v; break; } }
  if (!store) { noStore++; continue; }
  const dealer_code = mapDealer(store);
  if (!dealer_code) miss.set(store, (miss.get(store) ?? 0) + 1);
  const q = (k) => { const v = num(r[C[k]]); if (v != null) scoreVals.push(v); return v; };
  seen.add(caseNo);
  rows.push({
    case_no: caseNo, eval_date: date, period: date.slice(0, 7),
    dealer_code, store_name: store, region: str(r[C.region]),
    product_group: str(r[C.product]), reason: str(r[C.reason]),
    used_other: str(r[C.usedOther]), other_store: str(r[C.otherStore]),
    q_variety: q("variety"), q_quality: q("quality"), q_availability: q("availability"), q_price: q("price"),
    q_promotion: q("promotion"), q_display: q("display"), q_staff: q("staff"), q_payment: q("payment"),
    q_delivery: q("delivery"), overall: num(r[C.overall]), q_revisit: num(r[C.revisit]),
    impress_text: comment(r[C.impress]), improve_text: comment(r[C.improve]),
    source_file: SOURCE_FILE,
  });
}

/* ---- ฐานข้อมูล ---- */
const FIELDS = ["eval_date", "period", "dealer_code", "store_name", "region", "product_group", "reason", "used_other", "other_store",
  "q_variety", "q_quality", "q_availability", "q_price", "q_promotion", "q_display", "q_staff", "q_payment", "q_delivery",
  "overall", "q_revisit", "impress_text", "improve_text"];
const NUMF = new Set(FIELDS.filter((k) => k.startsWith("q_") || k === "overall"));
const db = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("scghome_sat_lines").select(["id", "case_no", ...FIELDS].join(",")).order("id").range(from, from + 999);
  if (error) { console.error("อ่านฐานข้อมูลไม่สำเร็จ:", error.message); process.exit(1); }
  db.push(...data); if (data.length < 1000) break;
}
const dbMap = new Map(db.map((x) => [x.case_no, x]));
const nv = (k, v) => (v === undefined || v === "" ? null : NUMF.has(k) && v != null ? Number(v) : v);
const toInsert = [], toUpdate = [];
for (const r of rows) {
  const cur = dbMap.get(r.case_no);
  if (!cur) { toInsert.push(r); continue; }
  const diff = FIELDS.filter((k) => nv(k, cur[k]) !== nv(k, r[k]));
  if (diff.length) toUpdate.push({ r, cur, diff });
}
const keys = new Set(rows.map((r) => r.case_no));
const toDelete = db.filter((x) => !keys.has(x.case_no));

/* ---- รายงาน ---- */
const byM = {}; rows.forEach((x) => (byM[x.period] = (byM[x.period] ?? 0) + 1));
const models = {}; rows.forEach((x) => { const m = dealerModel.get(x.dealer_code) ?? "ไม่ระบุร้าน"; models[m] = (models[m] ?? 0) + 1; });
const byStore = {}; rows.forEach((x) => { const k = x.dealer_code ? `${dealerName.get(x.dealer_code)} (${x.dealer_code})` : `ไม่ระบุร้าน: ${x.store_name}`; byStore[k] = (byStore[k] ?? 0) + 1; });
const ov = rows.map((x) => x.overall).filter((v) => v != null);
console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
console.log(`Sheet: ${d.length - 1} แถว | ใช้ได้ ${rows.length} | ไม่มี Case_no ${noCase} | Case_no ซ้ำ ${dup} | วันที่อ่านไม่ได้ ${badDate} | ไม่มีสาขา ${noStore}`);
console.log(`  ต่อเดือน: ${Object.keys(byM).sort().map((p) => `${p}:${byM[p]}`).join(" ")}`);
console.log(`  ต่อ Model: ${JSON.stringify(models)}`);
console.log(`  คะแนนรายข้อ: ต่ำสุด ${Math.min(...scoreVals)} สูงสุด ${Math.max(...scoreVals)} | ภาพรวม ต่ำสุด ${Math.min(...ov)} สูงสุด ${Math.max(...ov)} เฉลี่ย ${(ov.reduce((a, b) => a + b, 0) / (ov.length || 1)).toFixed(2)} (n=${ov.length})`);
console.log(`  ร้านที่ map ไม่ได้: ${miss.size ? [...miss.entries()].map(([s, n]) => `"${s}" x${n}`).join(", ") : "ไม่มี"}`);
console.log("  ต่อร้าน:"); Object.entries(byStore).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`    ${k}: ${n}`));
console.log(`\nฐานข้อมูล: ${db.length} แถว → เพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length}`);
toUpdate.slice(0, 10).forEach(({ r, cur, diff }) => console.log(`  แก้ ${r.case_no}: ${diff.map((k) => `${k}: ${cur[k] ?? "∅"} → ${r[k] ?? "∅"}`).join(" ; ")}`));

if (db.length && rows.length < db.length * (1 - MAX_DROP) && !FORCE) {
  console.error(`\nหยุด: จำนวนแถวลดลงเกิน ${MAX_DROP * 100}% (${db.length} → ${rows.length}) ใช้ --force ถ้าตั้งใจ`);
  process.exit(2);
}
if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อ sync จริง"); process.exit(0); }

const ups = [...toInsert, ...toUpdate.map((u) => u.r)];
for (let i = 0; i < ups.length; i += 500) {
  const { error } = await sb.from("scghome_sat_lines").upsert(ups.slice(i, i + 500), { onConflict: "case_no" });
  if (error) { console.error("upsert ไม่สำเร็จ:", error.message); process.exit(1); }
}
const delIds = toDelete.map((x) => x.id);
for (let i = 0; i < delIds.length; i += 500) {
  const { error } = await sb.from("scghome_sat_lines").delete().in("id", delIds.slice(i, i + 500));
  if (error) { console.error("ลบไม่สำเร็จ:", error.message); process.exit(1); }
}
const { count } = await sb.from("scghome_sat_lines").select("id", { count: "exact", head: true });
console.log(`\nDONE: เพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length} | ทั้งตาราง ${count} แถว`);
