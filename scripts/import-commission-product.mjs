/* นำเข้า Commission Product (ฝั่งพนักงาน/vendor) -> commission_product_lines + commission_product_payouts
   -------------------------------------------------------------
   - อ่านทุกไฟล์ DATA sheet ใน Product DI 2026 (ยกเว้น Detail Commission)
   - *** ไม่กรอง Price_check *** (commission จ่ายทุกแถว)
   - gross = Total_commission [R] ; net = gross * 0.97 (หัก 3%)
   - Detail Commission.xlsx -> commission_product_payouts (period/paid_date/gross/wht/net)
   - idempotent: ลบทั้ง 2 ตารางก่อน insert

   DRY RUN: node scripts/import-commission-product.mjs
   APPLY:   node scripts/import-commission-product.mjs --apply
*/
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app/Product DI 2026";
const DETAIL = "Detail Commission.xlsx";
const MONTH = { Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09" };

/* ---- env ---- */
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const str = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === "" || s === "NULL" ? null : s; };
const num = (v) => { if (v === undefined || v === null || v === "" || v === "NULL") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const toDate = (v) => { const s = String(v ?? "").trim(); return /^\d{8}$/.test(s) ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : null; };
const toDateDMY = (v) => { const s = String(v ?? "").trim(); const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : null; };

/* ---- 1) อ่าน DATA ทุกไฟล์ (ไม่กรอง Price_check) ---- */
const files = readdirSync(DIR).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$") && f !== DETAIL);
const rows = [];
const perMonth = new Map();
let grandGross = 0;

for (const f of files) {
  const wb = XLSX.read(readFileSync(join(DIR, f)), { type: "buffer" });
  const sn = wb.SheetNames.find((s) => /^data/i.test(s.trim()));
  if (!sn) { console.warn(`⚠️  ${f}: ไม่มี DATA sheet — ข้าม`); continue; }
  const d = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false });
  const h = {}; d[0].forEach((c, i) => (h[String(c).trim()] = i));
  const G = (k) => h[k];
  if (G("Total_commission [R]") === undefined || G("SalesMonth") === undefined) {
    console.warn(`⚠️  ${f}: ขาดคอลัมน์หลัก — ข้าม`); continue;
  }
  let fileRows = 0, fileGross = 0;
  for (let r = 1; r < d.length; r++) {
    const row = d[r];
    if (!row || row.length === 0) continue;
    const dealerCode = str(row[G("DealerCode")]);
    const period = `${row[G("SalesYear")] ?? 2026}-${String(row[G("SalesMonth")] ?? "").padStart(2,"0")}`;
    if (!dealerCode || !/^\d{4}-\d{2}$/.test(period)) continue;
    const gross = num(row[G("Total_commission [R]")]) ?? 0;
    const rec = {
      period,
      dealer_code: dealerCode,
      dealer_name: str(row[G("DealerName")]),
      paid_dealer_code: str(row[G("Paid_DealerCode")]),
      region: str(row[G("Region")]),
      province: str(row[G("Province")]),
      vendor_code: str(row[G("Vendor Code")]),
      vendor_name: str(row[G("Vendor Name")]),
      vendor_tax_id: str(row[G("เลขผู้เสียภาษี")]),
      sale_code: str(row[G("SaleCode")]),
      sale_name: str(row[G("SaleName")]),
      doc_no: str(row[G("DocNo")]),
      sales_date: toDate(row[G("ReformatSalesDate")]),
      cust_name: str(row[G("CustName")]),
      item_code: str(row[G("ItemCode")]),
      item_name: str(row[G("ItemName")]),
      qty: num(row[G("Qty")]),
      net_amount: num(row[G("CHAMP_NetAmount")]),
      commission_rate: num(row[G("CommissionRate")]),
      commission_gross: gross,
      commission_net: Math.round(gross * 0.97 * 10000) / 10000,
      price_check: str(row[G("Price_check")]),
      gbu: str(row[G("GBU")]),
      product_group: str(row[G("HPB Product Group")]),
      cost_center: str(row[G("CostCenter")]),
      company: str(row[G("Company")]),
      source_file: f,
    };
    rows.push(rec);
    fileRows++; fileGross += gross; grandGross += gross;
    const p = perMonth.get(period) ?? { rows: 0, gross: 0, vendors: new Set(), dealers: new Set() };
    p.rows++; p.gross += gross;
    if (rec.vendor_code) p.vendors.add(rec.vendor_code);
    p.dealers.add(dealerCode);
    perMonth.set(period, p);
  }
  console.log(`  ${f}\n    DATA=${sn} | ${fileRows} แถว | gross=${fileGross.toFixed(2)}`);
}

/* ---- 2) อ่าน Detail Commission ---- */
const dc = XLSX.read(readFileSync(join(DIR, DETAIL)), { type: "buffer" });
const dcRows = XLSX.utils.sheet_to_json(dc.Sheets["Export"], { header: 1, blankrows: false });
const dcHdr = (dcRows[0] || []).map((c) => String(c).trim());
const ci = {
  mon: dcHdr.indexOf("MonthName"),
  paid: dcHdr.indexOf("วันที่ทำจ่าย"),
  gross: dcHdr.indexOf("Total_commission [R]"),
  wht: dcHdr.indexOf("หัก 3%"),
  net: dcHdr.indexOf("ยอดจ่ายจริง"),
};
const payouts = [];
let payGross = 0, payNet = 0;
for (let r = 1; r < dcRows.length; r++) {
  const row = dcRows[r];
  const mon = MONTH[String(row[ci.mon] ?? "").trim()];
  if (!mon) continue;
  const g = num(row[ci.gross]) ?? 0, w = num(row[ci.wht]) ?? 0, n = num(row[ci.net]) ?? 0;
  payouts.push({ period: `2026-${mon}`, paid_date: toDateDMY(row[ci.paid]), commission_gross: g, wht_3pct: w, commission_net: n });
  payGross += g; payNet += n;
}

/* ---- รายงาน ---- */
console.log("\n===== DATA lines ต่อเดือน (ไม่กรอง Price_check) =====");
[...perMonth.keys()].sort().forEach((p) => {
  const v = perMonth.get(p);
  console.log(`  ${p} | ${v.rows} แถว | vendor ${v.vendors.size} | ร้าน ${v.dealers.size} | gross ${v.gross.toFixed(2)}`);
});
console.log(`  รวม lines gross = ${grandGross.toFixed(2)}`);

console.log("\n===== Detail Commission (payouts) =====");
console.log(`  รวม gross = ${payGross.toFixed(2)} | net (จ่ายจริง) = ${payNet.toFixed(2)}`);
console.log(`\n  เทียบ: lines gross ${grandGross.toFixed(2)} vs Detail gross ${payGross.toFixed(2)} | ต่าง ${(grandGross-payGross).toFixed(2)} ${Math.abs(grandGross-payGross)<2?"✓ ตรง":"✗"}`);

if (!APPLY) {
  console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง");
  process.exit(0);
}

/* ---- APPLY ---- */
console.log("\nAPPLY: ล้าง 2 ตารางแล้ว insert ใหม่...");
await sb.from("commission_product_lines").delete().neq("id", 0);
await sb.from("commission_product_payouts").delete().neq("id", 0);

const CHUNK = 500;
let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const { error } = await sb.from("commission_product_lines").insert(rows.slice(i, i + CHUNK));
  if (error) { console.error("lines insert ล้มเหลว:", error.message); process.exit(1); }
  done += Math.min(CHUNK, rows.length - i);
  process.stdout.write(`\r  lines ${done}/${rows.length}`);
}
const { error: pErr } = await sb.from("commission_product_payouts").upsert(payouts, { onConflict: "period,paid_date" });
if (pErr) { console.error("\npayouts insert ล้มเหลว:", pErr.message); process.exit(1); }
console.log(`\nDONE lines=${rows.length} payouts=${payouts.length}`);
