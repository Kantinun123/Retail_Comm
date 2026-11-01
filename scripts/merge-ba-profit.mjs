/* รวมไฟล์ BA Profit Share_ร้านค้า (472 ไฟล์, 3 layout) -> ไฟล์ Excel เดียว
   schema เดียวกันทุกเดือน + period + source_file
   เงินที่ร้านได้ = profit_share_amount ; margin = ข้อมูลประกอบ
   OUTPUT: commission-app/BA_ProfitShare_รวม.xlsx
*/
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import * as XLSX from "xlsx";

const ROOT = "commission-app/BA Profit Share_ร้านค้า";
const OUT = "commission-app/BA_ProfitShare_รวม.xlsx";
const MON = { Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09" };

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (e.endsWith(".xlsx") && !e.startsWith("~$")) out.push(p);
  }
  return out;
}
function monthOf(path) {
  const m = path.match(/BA Profit Share_ร้านค้า[\\/]([A-Za-z]{3})[\\/]/);
  return m ? m[1] : null;
}
const num = (v) => { if (v === undefined || v === null || v === "") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const str = (v) => { const s = String(v ?? "").trim(); return s === "" ? "" : s; };
/* Excel serial -> YYYY-MM-DD (epoch 1899-12-30) */
const serialToDate = (v) => {
  if (v === undefined || v === null || v === "") return "";
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) {
    const dt = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : str(v);
};

/* unified field -> header ที่เป็นไปได้ (ครอบ 3 layout) */
const FIELD_ALIASES = {
  channel:        ["channel_name", "store_channel"],
  store_model:    ["store_model"],
  store_name:     ["store_name"],
  sale_order_no:  ["sale_order_no"],
  customer_name:  ["customer_name"],
  invoice_no:     ["invoice_no"],
  discount_code:  ["discount_code"],
  job_code:       ["job_code"],
  job_type:       ["job_type"],
  worktype_name:  ["worktype_name"],
  product_code:   ["product_code"],
  product_name:   ["product_name"],
  product_brand:  ["product_brand", "service_brand"],
  sku_code:       ["sku_code"],
  sku_name:       ["sku_name"],
  job_status:     ["job_status"],
  payment_date:   ["payment_date"],
  customer_accepted_date: ["customer_accepted_date"],
  actual_paid:    ["actual_paid"],
  jo_amount:      ["jo_amount"],
  margin:         ["margin"],
  profit_share_rate:   ["profit_share_rate"],
  profit_share_amount: ["profit_share_amount"],
  sale_model:     ["sale_model"],
  job_id:         ["job_id"],
  adj_shop_service_name: ["adj_shop_service_name"],
  shop_condition: ["shop_condition"],
  mou_type:       ["mou_type"],
  store_format:   ["store_format"],
};
const DATE_FIELDS = new Set(["payment_date", "customer_accepted_date"]);
const NUM_FIELDS = new Set(["actual_paid", "jo_amount", "margin", "profit_share_rate", "profit_share_amount"]);

/* ลำดับคอลัมน์ไฟล์ผลลัพธ์ */
const OUT_COLS = [
  "period", "channel", "store_model", "store_name", "sale_order_no",
  "customer_name", "invoice_no", "discount_code", "job_code", "job_type",
  "worktype_name", "product_code", "product_name", "product_brand",
  "sku_code", "sku_name", "job_status", "payment_date", "customer_accepted_date",
  "actual_paid", "jo_amount", "margin", "profit_share_rate", "profit_share_amount",
  "sale_model", "job_id", "adj_shop_service_name", "shop_condition", "mou_type",
  "store_format", "source_file",
];

const files = walk(ROOT);
const rows = [];
let totalPS = 0, totalMargin = 0;
const perMonth = new Map();

for (const f of files) {
  const monName = monthOf(f);
  const period = monName && MON[monName] ? `2026-${MON[monName]}` : "";
  const wb = XLSX.read(readFileSync(f), { type: "buffer" });
  const d = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
  if (!d.length) continue;
  const header = (d[0] || []).map((c) => String(c ?? "").trim());
  const H = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) { const i = header.indexOf(a); if (i >= 0) { H[field] = i; break; } }
  }
  for (let r = 1; r < d.length; r++) {
    const row = d[r] || [];
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue;
    // ตัดแถวสรุป: channel+store+job_code ว่างทั้งหมด = ยอดรวมของไฟล์ (มีแต่ profit_share_amount)
    const chVal = str(row[H.channel ?? -1]);
    const storeVal = str(row[H.store_name ?? -1]);
    const jobVal = str(row[H.job_code ?? -1]);
    if (!chVal && !storeVal && !jobVal) continue;
    const rec = { period, source_file: basename(f) };
    for (const field of Object.keys(FIELD_ALIASES)) {
      const idx = H[field];
      const raw = idx === undefined ? "" : row[idx];
      if (DATE_FIELDS.has(field)) rec[field] = serialToDate(raw);
      else if (NUM_FIELDS.has(field)) rec[field] = num(raw);
      else rec[field] = str(raw);
    }
    rows.push(rec);
    const ps = rec.profit_share_amount ?? 0, mg = rec.margin ?? 0;
    totalPS += ps; totalMargin += mg;
    const pm = perMonth.get(period) ?? { rows: 0, ps: 0 };
    pm.rows++; pm.ps += ps; perMonth.set(period, pm);
  }
}

/* เขียน Excel: 1 ชีท, number format ให้คอลัมน์เงิน + แถวรวมท้าย */
const MONEY_FMT = "#,##0.00";
const MONEY_COLS = ["actual_paid", "jo_amount", "margin", "profit_share_amount"];
const shaped = rows.map((r) => { const o = {}; OUT_COLS.forEach((c) => (o[c] = r[c] ?? "")); return o; });
const ws = XLSX.utils.json_to_sheet(shaped, { header: OUT_COLS });
MONEY_COLS.forEach((mc) => {
  const col = OUT_COLS.indexOf(mc);
  for (let i = 0; i < shaped.length; i++) {
    const cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: col })];
    if (cell && typeof cell.v === "number") { cell.t = "n"; cell.z = MONEY_FMT; }
  }
});
/* แถวรวม */
const totalRow = shaped.length + 1;
ws[XLSX.utils.encode_cell({ r: totalRow, c: 0 })] = { t: "s", v: "รวมทั้งหมด" };
MONEY_COLS.forEach((mc) => {
  const col = OUT_COLS.indexOf(mc);
  const sum = rows.reduce((a, r) => a + (r[mc] ?? 0), 0);
  ws[XLSX.utils.encode_cell({ r: totalRow, c: col })] = { t: "n", v: sum, z: MONEY_FMT };
});
ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRow, c: OUT_COLS.length - 1 } });

const out = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(out, ws, "BA Profit Share");
XLSX.writeFile(out, OUT);

console.log("===== รวมไฟล์ BA Profit Share (ร้านค้า) =====");
console.log(`ไฟล์ต้นทาง ${files.length} | แถวข้อมูล ${rows.length}`);
console.log(`profit_share_amount รวม = ${totalPS.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`);
console.log(`margin รวม              = ${totalMargin.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`);
console.log("\nต่อเดือน:");
[...perMonth.keys()].sort().forEach((p) => {
  const v = perMonth.get(p);
  console.log(`  ${p}: ${v.rows} แถว | profit_share ${v.ps.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`);
});
console.log(`\n✓ เขียนไฟล์: ${OUT}`);
