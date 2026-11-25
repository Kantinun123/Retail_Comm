/* นำเข้า Commission Product (ฝั่งพนักงาน/vendor) -> commission_product_lines + commission_product_payouts
   -------------------------------------------------------------
   - อ่านทุกไฟล์ DATA sheet ใน Product DI 2026 (ยกเว้น Detail Commission)
   - *** ไม่กรอง Price_check *** (commission จ่ายทุกแถว)
   - gross = Total_commission [R] ; net = gross * 0.97 (หัก 3%)
   - ยอดอ้างอิง = Detail Commission.xlsx ชีต commission_productbystaff (ผู้ใช้ยืนยัน 25 พ.ย. 69)
       ไม่นับ: สินค้าบริษัท เอสซีจี ลีฟวิง แอนด์ เฮาส์ซิง โซลูชัน (LHS) + ร้านที่ไม่มีในชีตของเดือนนั้น (ยอดไม่ถึง ฿100)
       ยอดต่อเดือนต้องตรงชีต ไม่งั้นหยุด (exit 2)
   - payouts (period/paid_date) สร้างจากชีตเดียวกัน ; "อยู่ระหว่างดำเนินการ" = ยังไม่จ่าย
   - idempotent: ลบทั้ง 2 ตารางก่อน insert
   - --period YYYY-MM[,YYYY-MM]: นำเข้าเฉพาะเดือนที่ระบุ (ลบ/เพิ่มเฉพาะเดือนนั้น, ไม่แตะ payouts และเดือนอื่น)
   - หลัง apply ต้องรัน node scripts/backfill-rep-code.mjs --apply (เติม rep_code ให้หน้าพนักงานรายคน)

   DRY RUN: node scripts/import-commission-product.mjs [--period 2026-09]
   APPLY:   node scripts/import-commission-product.mjs --apply [--period 2026-09]
*/
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const pIdx = process.argv.indexOf("--period");
const PERIODS = pIdx > 0 ? new Set(String(process.argv[pIdx + 1] ?? "").split(",").map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}$/.test(s))) : null;
if (PERIODS && !PERIODS.size) { console.error("--period ต้องเป็น YYYY-MM"); process.exit(1); }
const DIR = "commission-app/Product DI 2026";
const DETAIL = "Detail Commission.xlsx";
const STAFF_SHEET = "commission_productbystaff";

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

/* ---- 0) ยอดอ้างอิง: Detail Commission ชีต commission_productbystaff (ร้าน × พนักงาน × เดือน + วันที่ทำจ่าย) ---- */
const serialToIso = (v) => (typeof v === "number" ? new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) : null);
const ref = new Map(); // period -> { gross, dealers:Set, paid: Map<date, gross> }
{
  const wbD = XLSX.read(readFileSync(join(DIR, DETAIL)), { type: "buffer" });
  const ws = wbD.Sheets[STAFF_SHEET];
  if (!ws) { console.error(`ไม่พบชีต ${STAFF_SHEET} ใน ${DETAIL}`); process.exit(1); }
  const t = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  const hh = t[0].map((c) => String(c).trim());
  const c = { dealer: hh.indexOf("Dealer Code"), amt: hh.indexOf("Commission"), pull: hh.indexOf("วันที่ดึงข้อมูล"), paid: hh.indexOf("วันที่ทำจ่าย") };
  if (Object.values(c).some((i) => i < 0)) { console.error(`ชีต ${STAFF_SHEET} ขาดคอลัมน์ (ต้องมี Dealer Code / Commission / วันที่ดึงข้อมูล / วันที่ทำจ่าย)`); process.exit(1); }
  for (const r of t.slice(1)) {
    const pull = serialToIso(r[c.pull]);
    if (!pull) continue;
    const p = pull.slice(0, 7);
    const x = ref.get(p) ?? { gross: 0, dealers: new Set(), paid: new Map() };
    const g = num(r[c.amt]) ?? 0;
    x.gross += g;
    x.dealers.add(String(r[c.dealer] ?? "").trim());
    const pd = serialToIso(r[c.paid]); // "อยู่ระหว่างดำเนินการ" = ยังไม่มีวันจ่าย
    if (pd) x.paid.set(pd, (x.paid.get(pd) ?? 0) + g);
    ref.set(p, x);
  }
}
/** แถวที่ไม่นับ (ตามยอดโอนจริง):
 *  - สินค้าบริษัท LHS (จ่ายผ่าน LHS Commission แล้ว)
 *  - ร้านที่ไม่มีในชีตอ้างอิงของเดือนนั้น = ยอดทั้งร้านไม่ถึง ฿100 ไม่โอน (ผู้ใช้: เดือนอื่นเอาออกเหมือนกัน) */
const EXCL_COMPANY = /ลีฟวิง แอนด์ เฮาส์ซิง/;
const skipped = new Map(); // period -> { lhs, below100 }

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
    if (PERIODS && !PERIODS.has(period)) continue;
    const gross = num(row[G("Total_commission [R]")]) ?? 0;
    const sk = skipped.get(period) ?? { lhs: 0, below100: 0, below100Dealers: new Set() };
    if (EXCL_COMPANY.test(String(row[G("Company")] ?? ""))) { sk.lhs += gross; skipped.set(period, sk); continue; }
    const rp = ref.get(period);
    if (rp && !rp.dealers.has(dealerCode)) { sk.below100 += gross; sk.below100Dealers.add(dealerCode); skipped.set(period, sk); continue; }
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

/* ---- 2) payouts จากชีตอ้างอิง (period × วันที่ทำจ่าย ; ยังไม่มีวันจ่าย = ไม่สร้าง -> แอปแสดงรอจ่าย) ---- */
const linePeriods = new Set(rows.map((r) => r.period));
const payouts = [];
for (const [p, x] of ref) {
  if (!linePeriods.has(p)) continue; // เดือนที่ไม่มีรายการในแอป (เช่น ปี 2025) ไม่สร้าง
  for (const [d, g] of x.paid) {
    const gr = Math.round(g * 100) / 100;
    payouts.push({ period: p, paid_date: d, commission_gross: gr, wht_3pct: Math.round(gr * 3) / 100, commission_net: Math.round(gr * 97) / 100 });
  }
}

/* ---- รายงาน: เทียบยอดต่อเดือนกับชีตอ้างอิง ---- */
console.log(`\n===== ต่อเดือน: นำเข้า vs ${STAFF_SHEET} =====`);
let bad = 0;
[...perMonth.keys()].sort().forEach((p) => {
  const v = perMonth.get(p), r = ref.get(p), s = skipped.get(p);
  const ok = r ? Math.abs(v.gross - r.gross) < 0.05 : null;
  if (ok === false) bad++;
  const sk = s ? ` | ตัด LHS ${s.lhs.toFixed(2)} · ไม่ถึง 100 ${s.below100.toFixed(2)} (${s.below100Dealers.size} ร้าน)` : "";
  const paid = r ? [...r.paid.keys()].join(",") || "ยังไม่จ่าย" : "-";
  console.log(`  ${p} | ${v.rows} แถว | ร้าน ${v.dealers.size} | gross ${v.gross.toFixed(2)} | อ้างอิง ${r ? r.gross.toFixed(2) : "ไม่มี"} ${ok === null ? "?" : ok ? "✓" : "✗"} | จ่าย ${paid}${sk}`);
});
console.log(`  รวม gross = ${grandGross.toFixed(2)} | payouts ${payouts.length} แถว`);
if (bad) console.log(`\n⚠️  ${bad} เดือนยอดไม่ตรงชีตอ้างอิง — ตรวจก่อน apply`);

if (!APPLY) {
  console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง");
  process.exit(0);
}
if (bad) { console.error("หยุด: ยอดไม่ตรงชีตอ้างอิง"); process.exit(2); }

/* ---- APPLY ---- */
const scope = PERIODS ? [...PERIODS] : null;
if (scope) {
  const missing = scope.filter((p) => !linePeriods.has(p));
  if (missing.length) { console.error(`ไม่พบข้อมูลเดือน ${missing.join(", ")} ในไฟล์ — ไม่นำเข้า`); process.exit(1); }
}
console.log(`\nAPPLY: แทนที่ ${scope ? `เดือน ${scope.join(", ")}` : "ทุกเดือน"} (${rows.length} แถว) — เพิ่มใหม่ก่อนแล้วค่อยลบของเดิม`);
const { data: maxRow } = await sb.from("commission_product_lines").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
const maxBefore = maxRow?.id ?? 0;
const scoped = (q) => (scope ? q.in("period", scope) : q);
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from("commission_product_lines").insert(rows.slice(i, i + 500));
  if (error) {
    await scoped(sb.from("commission_product_lines").delete().gt("id", maxBefore)); // ย้อนแถวใหม่ ของเดิมยังอยู่
    console.error("\nlines insert ล้มเหลว:", error.message); process.exit(1);
  }
  process.stdout.write(`\r  lines ${Math.min(i + 500, rows.length)}/${rows.length}`);
}
const { error: dErr } = await scoped(sb.from("commission_product_lines").delete().lte("id", maxBefore));
if (dErr) { console.error("\nลบแถวเดิมไม่สำเร็จ:", dErr.message); process.exit(1); }
const { error: pdErr } = await scoped(sb.from("commission_product_payouts").delete().neq("id", 0));
if (pdErr) { console.error("\nลบ payouts เดิมไม่สำเร็จ:", pdErr.message); process.exit(1); }
const pay = scope ? payouts.filter((x) => scope.includes(x.period)) : payouts;
if (pay.length) {
  const { error: pErr } = await sb.from("commission_product_payouts").insert(pay);
  if (pErr) { console.error("\npayouts insert ล้มเหลว:", pErr.message); process.exit(1); }
}
console.log(`\nDONE lines=${rows.length} payouts=${pay.length} — ต่อด้วย node scripts/backfill-rep-code.mjs`);