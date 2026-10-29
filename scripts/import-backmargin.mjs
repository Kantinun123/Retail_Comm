/* นำเข้า back margin รายบรรทัด (sheet DATA) จากไฟล์ Excel รายเดือน -> Supabase
   -------------------------------------------------------------
   - อ่านทุกไฟล์ใน commission-app/back margin 2026 ยกเว้นไฟล์ FEB&MAR รวม (ข้ามตาม decision)
   - หา sheet ที่ชื่อขึ้นต้น "DATA" ในแต่ละไฟล์
   - map คอลัมน์ -> back_margin_lines
   - idempotent ต่อ period: ลบข้อมูล period นั้นก่อน insert ใหม่

   DRY RUN (ค่าเริ่มต้น): node scripts/import-backmargin.mjs
     -> รายงานแถว/เดือน + ยอดรวม + ร้านที่ไม่ match dealers (ไม่เขียน DB)
   ลงจริง: node scripts/import-backmargin.mjs --apply
*/
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app/back margin 2026";

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
const num = (v) => {
  if (v === undefined || v === null || v === "" || v === "NULL") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const str = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" || s === "NULL" ? null : s;
};
// ReformatSalesDate 20260109 -> 2026-01-09
const toDate = (v) => {
  const s = String(v ?? "").trim();
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};
const periodOf = (y, mth) => {
  const yy = String(y ?? "").trim();
  const mm = String(mth ?? "").trim().padStart(2, "0");
  if (!/^\d{4}$/.test(yy) || !/^\d{2}$/.test(mm)) return null;
  return `${yy}-${mm}`;
};

/* ---- หา column index จาก header ---- */
function colMap(header) {
  const idx = {};
  header.forEach((h, i) => {
    idx[String(h).trim()] = i;
  });
  return idx;
}

/* ---- อ่าน dealers จาก Supabase (เช็ค match) ---- */
const { data: dealerRows, error: dErr } = await sb.from("dealers").select("code");
if (dErr) {
  console.error("โหลด dealers ล้มเหลว:", dErr.message);
  process.exit(1);
}
const knownDealers = new Set((dealerRows ?? []).map((d) => d.code));

/* ---- map รอบจ่าย (payout_period) จากชื่อไฟล์ ---- */
// FEB&MAR ย้อนหลัง -> จ่ายรอบ APR (2026-04) ตามที่ยืนยันกับผู้ทำข้อมูล
/* ---- รวบรวมไฟล์ที่จะนำเข้า ----
   โฟลเดอร์ตอนนี้เป็นเวอร์ชันที่ผู้ทำข้อมูลแก้แล้ว (Revise + Add เก็บตก)
   แต่ละไฟล์ SalesMonth เดือนเดียว -> ใช้ sales_period จากแถวตรง ๆ
   ข้าม: temp Excel (~$) และไฟล์ data(22) (สรุปยอดจ่าย คนละ format) */
const files = readdirSync(DIR).filter(
  (f) => f.endsWith(".xlsx") && !f.startsWith("~$") && !f.toLowerCase().startsWith("data (")
);

console.log(`${APPLY ? "APPLY" : "DRY RUN"} | ไฟล์ที่จะนำเข้า: ${files.length}`);
console.log("dealers ในระบบ:", knownDealers.size, "\n");

const unmatchedDealers = new Map(); // code -> name (ร้านที่ไม่มีใน dealers)
let grandRows = 0;
let grandBackMargin = 0;
const perPeriod = new Map(); // period -> {rows, backMargin, dealers:Set}
const allRows = []; // สะสมไว้ insert (เมื่อ --apply)

for (const f of files) {
  const wb = XLSX.read(readFileSync(join(DIR, f)), { type: "buffer" });
  const sheetName = wb.SheetNames.find((s) => s.trim().toUpperCase().startsWith("DATA"));
  if (!sheetName) {
    console.warn(`⚠️  ${f}: ไม่พบ sheet DATA — ข้าม`);
    continue;
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false });
  if (rows.length < 2) {
    console.warn(`⚠️  ${f}: sheet ${sheetName} ว่าง — ข้าม`);
    continue;
  }
  const c = colMap(rows[0]);

  // คอลัมน์ที่ต้องมี
  const required = ["DealerCode", "SalesYear", "SalesMonth", "Price_check"];
  const missing = required.filter((k) => c[k] === undefined);
  if (missing.length) {
    console.warn(`⚠️  ${f}: ขาดคอลัมน์ ${missing.join(",")} — ข้าม`);
    continue;
  }

  let fileRows = 0;
  let fileBM = 0;
  let skippedNotQualified = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // *** กรองเฉพาะ "เข้าเงื่อนไข" (ตาม business rule) ***
    const priceCheck = String(row[c["Price_check"]] ?? "").trim();
    if (priceCheck !== "เข้าเงื่อนไข") {
      skippedNotQualified++;
      continue;
    }

    const dealerCode = str(row[c["DealerCode"]]);
    const salesPeriod = periodOf(row[c["SalesYear"]], row[c["SalesMonth"]]);
    if (!dealerCode || !salesPeriod) continue; // ข้ามแถวที่ไม่มี key

    const bm = num(row[c["Total_back_margin [R]"]]) ?? 0;
    const rec = {
      sales_period: salesPeriod,
      payout_period: salesPeriod, // ไฟล์ Revise แยกเดือนขายสะอาด -> รอบ = เดือนขาย
      source_file: f,
      dealer_code: dealerCode,
      paid_dealer_code: str(row[c["Paid_DealerCode"]]),
      dealer_name: str(row[c["DealerName"]]),
      store_flag: str(row[c["StoreFlag"]]),
      region: str(row[c["Region"]]),
      province: str(row[c["Province"]]),
      doc_no: str(row[c["DocNo"]]),
      sales_date: toDate(row[c["ReformatSalesDate"]]),
      cust_name: str(row[c["CustName"]]),
      sale_code: str(row[c["SaleCode"]]),
      sale_name: str(row[c["SaleName"]]),
      item_code: str(row[c["ItemCode"]]),
      item_name: str(row[c["ItemName"]]),
      qty: num(row[c["Qty"]]),
      champ_net_amount: num(row[c["CHAMP_NetAmount"]]),
      back_margin_rate: num(row[c["BackMargin"]]),
      total_back_margin: bm,
      cost_center: str(row[c["CostCenter"]]),
      rf_product: str(row[c["RF_Product"]]),
    };
    allRows.push(rec);
    fileRows++;
    fileBM += bm;
    grandBackMargin += bm;

    if (!knownDealers.has(dealerCode)) {
      unmatchedDealers.set(dealerCode, rec.dealer_name ?? "");
    }
    const p = perPeriod.get(salesPeriod) ?? { rows: 0, backMargin: 0, dealers: new Set(), files: new Set() };
    p.rows++;
    p.backMargin += bm;
    p.dealers.add(dealerCode);
    p.files.add(f.slice(0, 16));
    perPeriod.set(salesPeriod, p);
  }
  grandRows += fileRows;

  // ---- validate กับ Summary sheet ----
  // Summary มี pivot หลายตารางเคียงกัน (รายร้าน + ราย cost center) แต่ละตาราง = ยอดเดียวกัน
  // -> ใช้ "คอลัมน์แรกคอลัมน์เดียว" เป็นตัวเทียบ (ไม่บวกซ้ำ)
  let summaryNote = "";
  const sumSheetName = wb.SheetNames.find((s) => s.trim().toUpperCase().startsWith("SUM"));
  if (sumSheetName) {
    const sumRows = XLSX.utils.sheet_to_json(wb.Sheets[sumSheetName], { header: 1, blankrows: false });
    let firstCol = null;
    for (let rr = 0; rr < sumRows.length && !firstCol; rr++) {
      for (let cc = 0; cc < (sumRows[rr] || []).length; cc++) {
        if (String(sumRows[rr][cc] ?? "").includes("Sum of Total_back_margin")) {
          firstCol = { rr, cc };
          break;
        }
      }
    }
    if (firstCol) {
      let summaryTotal = 0;
      for (let k = firstCol.rr + 1; k < sumRows.length; k++) {
        const v = Number(sumRows[k][firstCol.cc]);
        if (Number.isFinite(v)) summaryTotal += v;
      }
      const diff = Math.abs(summaryTotal - fileBM);
      const ok = diff < 1;
      summaryNote = `Summary=${summaryTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ok ? "✓ ตรง" : `✗ ต่าง ${diff.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}`;
    }
  }

  console.log(
    `  ${f}\n    sheet=${sheetName} | เข้าเงื่อนไข=${fileRows.toLocaleString()} แถว (กรองออก ${skippedNotQualified.toLocaleString()}) | back margin=${fileBM.toLocaleString(undefined, { maximumFractionDigits: 2 })} | ${summaryNote}`
  );
}

/* ---- รายงานสรุป ---- */
console.log("\n===== สรุปต่อเดือนขาย (sales_period) =====");
[...perPeriod.keys()].sort().forEach((p) => {
  const v = perPeriod.get(p);
  console.log(
    `  ${p} | แถว ${v.rows.toLocaleString()} | ร้าน ${v.dealers.size} | back margin ${v.backMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })} | ไฟล์: ${[...v.files].join(", ")}`
  );
});
console.log("\n===== รวมทั้งหมด =====");
console.log(`  แถวรวม: ${grandRows.toLocaleString()}`);
console.log(`  back margin รวม: ${grandBackMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
console.log(`  ร้านที่ไม่ match dealers ในระบบ: ${unmatchedDealers.size}`);
if (unmatchedDealers.size > 0) {
  console.log("  --- รายชื่อร้านไม่ match (code | name) ---");
  [...unmatchedDealers.entries()].slice(0, 50).forEach(([code, name]) =>
    console.log(`    ${code} | ${name}`)
  );
  if (unmatchedDealers.size > 50) console.log(`    ... และอีก ${unmatchedDealers.size - 50} ร้าน`);
}

if (!APPLY) {
  console.log("\n(DRY RUN) ยังไม่เขียน DB. เพิ่ม --apply เพื่อนำเข้าจริง");
  process.exit(0);
}

/* ---- APPLY: ลบ sales_period เดิมก่อน แล้ว insert ใหม่ (idempotent) ---- */
const periods = [...perPeriod.keys()];
console.log(`\nAPPLY: ลบข้อมูลเดิมของ ${periods.length} เดือน แล้วใส่ใหม่...`);
for (const p of periods) {
  const { error } = await sb.from("back_margin_lines").delete().eq("sales_period", p);
  if (error) {
    console.error(`ลบ sales_period ${p} ล้มเหลว:`, error.message);
    process.exit(1);
  }
}

const CHUNK = 500;
let done = 0;
for (let i = 0; i < allRows.length; i += CHUNK) {
  const chunk = allRows.slice(i, i + CHUNK);
  const { error } = await sb.from("back_margin_lines").insert(chunk);
  if (error) {
    console.error(`insert chunk ${i} ล้มเหลว:`, error.message);
    process.exit(1);
  }
  done += chunk.length;
  process.stdout.write(`\r  inserted ${done.toLocaleString()}/${allRows.length.toLocaleString()}`);
}
console.log(`\nDONE back_margin_lines inserted: ${done.toLocaleString()}`);
