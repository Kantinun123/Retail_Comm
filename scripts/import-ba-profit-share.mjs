/* นำเข้า BA Profit Share (ร้านค้า) -> ba_profit_share_lines
   -------------------------------------------------------------
   - อ่านไฟล์รวม commission-app/BA_ProfitShare_รวม.xlsx (4,704 แถว)
   - นำเข้า "ทุกแถว" (ยอดดิบต้อง = 7,632,277.82)
   - ร้าน: map channel_name/store_name -> dealer ผ่าน Master_Dealer (Dealer Name_BA App_1..4)
           เติม dealer_code/dealer_name; null ถ้าไม่เจอ (แต่ยังเก็บ channel_name/store_name ดิบ)
   - profit_share_amount = ยอดที่ร้านได้จริง; margin = ข้อมูลประกอบ
   - idempotent: ลบตารางก่อน insert

   DRY RUN: node scripts/import-ba-profit-share.mjs
   APPLY:   node scripts/import-ba-profit-share.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app";
const MERGED = "commission-app/BA_ProfitShare_รวม.xlsx";

/* ---- env ---- */
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---- helpers ---- */
const str = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === "" ? null : s; };
const num = (v) => { if (v === undefined || v === null || v === "") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const serialToDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) {
    const dt = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  return null;
};

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

/* ---- 1) map channel/store_name -> dealer (Master_Dealer) ---- */
const md = parseCsv(readFileSync(join(DIR, "Master_Dealer.csv"), "utf8"));
const mdh = md[0].map((c) => String(c).trim());
const iDName = mdh.findIndex((h) => /^Dealer Name$/i.test(h));
const iDCode = mdh.findIndex((h) => /^Dealer Code$/i.test(h));
const dBaCols = mdh.map((h, i) => (/^Dealer Name_BA App_\d/i.test(h) ? i : -1)).filter((i) => i >= 0);
const chMap = new Map();
for (let r = 1; r < md.length; r++) {
  const code = String(md[r][iDCode] ?? "").trim();
  const nm = String(md[r][iDName] ?? "").trim();
  for (const c of dBaCols) { const v = String(md[r][c] ?? "").trim(); if (v) chMap.set(v, { code, name: nm }); }
}
console.log(`channel/store->dealer map = ${chMap.size} ชื่อร้าน (จาก Master_Dealer)`);

/* ---- 2) อ่านไฟล์รวม + สร้างแถว ---- */
const wb = XLSX.read(readFileSync(MERGED), { type: "buffer" });
const d = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
const H = {}; d[0].forEach((c, i) => (H[String(c).trim()] = i));
const G = (k) => H[k];

const rows = [];
let grandPS = 0, grandMargin = 0;
let rowDealerHit = 0, moneyDealer = 0;
const perMonth = new Map();

for (let r = 1; r < d.length; r++) {
  const row = d[r];
  if (!row || row.length === 0) continue;
  if (String(row[0] ?? "").includes("รวม")) continue; // แถวรวมท้ายไฟล์

  const channel = str(row[G("channel")]);
  const storeName = str(row[G("store_name")]);
  // map: ลอง channel ก่อน แล้ว fallback store_name
  const dealerKey = channel && chMap.has(channel) ? channel : (storeName && chMap.has(storeName) ? storeName : null);
  const dealer = dealerKey ? chMap.get(dealerKey) : null;

  const ps = num(row[G("profit_share_amount")]) ?? 0;
  const mg = num(row[G("margin")]) ?? 0;
  grandPS += ps; grandMargin += mg;
  if (dealer) { rowDealerHit++; moneyDealer += ps; }

  rows.push({
    period: str(row[G("period")]),
    channel_name: channel,
    store_name: storeName,
    store_model: str(row[G("store_model")]),
    dealer_code: dealer ? dealer.code : null,
    dealer_name: dealer ? dealer.name : null,
    sale_order_no: str(row[G("sale_order_no")]),
    customer_name: str(row[G("customer_name")]),
    invoice_no: str(row[G("invoice_no")]),
    discount_code: str(row[G("discount_code")]),
    job_code: str(row[G("job_code")]),
    job_type: str(row[G("job_type")]),
    worktype_name: str(row[G("worktype_name")]),
    product_code: str(row[G("product_code")]),
    product_name: str(row[G("product_name")]),
    product_brand: str(row[G("product_brand")]),
    sku_code: str(row[G("sku_code")]),
    sku_name: str(row[G("sku_name")]),
    job_status: str(row[G("job_status")]),
    payment_date: serialToDate(row[G("payment_date")]),
    customer_accepted_date: serialToDate(row[G("customer_accepted_date")]),
    actual_paid: num(row[G("actual_paid")]),
    jo_amount: num(row[G("jo_amount")]),
    margin: num(row[G("margin")]),
    profit_share_rate: num(row[G("profit_share_rate")]),
    profit_share_amount: ps,
    sale_model: str(row[G("sale_model")]),
    job_id: str(row[G("job_id")]),
    adj_shop_service_name: str(row[G("adj_shop_service_name")]),
    shop_condition: str(row[G("shop_condition")]),
    mou_type: str(row[G("mou_type")]),
    store_format: str(row[G("store_format")]),
    source_file: str(row[G("source_file")]),
  });

  const p = str(row[G("period")]) ?? "?";
  const pm = perMonth.get(p) ?? { rows: 0, ps: 0 };
  pm.rows++; pm.ps += ps; perMonth.set(p, pm);
}

/* ---- รายงาน ---- */
console.log("\n===== BA Profit Share lines ต่อเดือน =====");
[...perMonth.keys()].sort().forEach((p) => {
  const v = perMonth.get(p);
  console.log(`  ${p} | ${v.rows} แถว | profit_share ${v.ps.toFixed(2)}`);
});
const f = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => ((n / grandPS) * 100).toFixed(1);
console.log(`\n  รวมทั้งหมด = ${rows.length} แถว | profit_share = ${f(grandPS)} | margin = ${f(grandMargin)}`);
console.log(`  เป้า = 7,632,277.82 | ต่าง ${(grandPS - 7632277.82).toFixed(2)} ${Math.abs(grandPS - 7632277.82) < 1 ? "✓ ตรง" : "✗"}`);
console.log(`\n  ร้าน (channel/store->dealer): ${rowDealerHit}/${rows.length} แถว | เงิน ${f(moneyDealer)} (${pct(moneyDealer)}%)`);

if (!APPLY) {
  console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง");
  process.exit(0);
}

/* ---- APPLY ---- */
console.log("\nAPPLY: ล้างตาราง ba_profit_share_lines แล้ว insert ใหม่...");
{ const { error } = await sb.from("ba_profit_share_lines").delete().neq("id", 0); if (error) { console.error("delete ล้มเหลว:", error.message); process.exit(1); } }

const CHUNK = 500;
let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const { error } = await sb.from("ba_profit_share_lines").insert(rows.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert ล้มเหลว:", error.message); process.exit(1); }
  done += Math.min(CHUNK, rows.length - i);
  process.stdout.write(`\r  insert ${done}/${rows.length}`);
}
console.log(`\nDONE lines=${rows.length}`);
