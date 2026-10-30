/* นำเข้า BA Incentive (พนักงานขายบริการ Q-CHANG) -> ba_incentive_lines
   -------------------------------------------------------------
   - อ่าน sheet "All" (6,250 แถว) จาก Incentive_Comission_2026_Consolidated.xlsx
   - นำเข้า "ทุกแถว" (ยอดดิบต้อง = ยอดสรุป total_incentive 1,729,598.06)
   - ร้าน: map channel_name -> dealer ผ่าน Master_Dealer.csv (Dealer Name_BA App_1..4)
           เติม dealer_code/dealer_name; null ถ้าไม่เจอ (แต่ยังเก็บ channel_name ดิบ)
   - พนักงาน: เก็บ emp_id/sale_rep_name ดิบเสมอ; emp_code(CR#) เติมผ่าน Master_Member.csv
              (Salesperson ID_BA App_1/2 -> User ID) null ถ้าไม่เจอ
   - win_date: join จาก Pending B2C Offline.xlsx sheet "raw data" (job_code -> win_date)
   - idempotent: ลบตารางก่อน insert

   DRY RUN: node scripts/import-ba-incentive.mjs
   APPLY:   node scripts/import-ba-incentive.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app";
const BADIR = "commission-app/BA Incentive_พนักงาน";
const BAFILE = "Incentive_Comission_2026_Consolidated.xlsx";
const WINFILE = "Pending B2C Offline.xlsx";

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
const str = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === "" || s === "NULL" ? null : s; };
const num = (v) => { if (v === undefined || v === null || v === "" || v === "NULL") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
/* Excel serial -> YYYY-MM-DD (epoch 1899-12-30) */
const serialToDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    // อาจเป็นสตริงวันที่ dd/mm/yyyy
    const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
  }
  const ms = Math.round((n - 25569) * 86400 * 1000); // 25569 = 1970-01-01 in excel serial
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
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

/* ---- 1) map channel_name -> dealer (Master_Dealer) ---- */
const md = parseCsv(readFileSync(join(DIR, "Master_Dealer.csv"), "utf8"));
const mdh = md[0].map((c) => String(c).trim());
const iDName = mdh.findIndex((h) => /^Dealer Name$/i.test(h));
const iDCode = mdh.findIndex((h) => /^Dealer Code$/i.test(h));
const dBaCols = mdh.map((h, i) => (/^Dealer Name_BA App_\d/i.test(h) ? i : -1)).filter((i) => i >= 0);
const chMap = new Map(); // channel_name -> {code, name}
for (let r = 1; r < md.length; r++) {
  const code = String(md[r][iDCode] ?? "").trim();
  const nm = String(md[r][iDName] ?? "").trim();
  for (const c of dBaCols) {
    const v = String(md[r][c] ?? "").trim();
    if (v) chMap.set(v, { code, name: nm });
  }
}
console.log(`channel->dealer map = ${chMap.size} ชื่อร้าน (จาก Master_Dealer)`);

/* ---- 2) map emp_id(BA) -> emp_code(CR) (Master_Member) ---- */
const mm = parseCsv(readFileSync(join(DIR, "Master_Member.csv"), "utf8"));
const mmh = mm[0].map((c) => String(c).trim());
const iUser = mmh.findIndex((h) => /^User ID$/i.test(h));
const baIdCols = mmh.map((h, i) => (/^Salesperson ID_BA App_\d/i.test(h) ? i : -1)).filter((i) => i >= 0);
const empMap = new Map(); // emp_id(BA) -> CR#
for (let r = 1; r < mm.length; r++) {
  const user = String(mm[r][iUser] ?? "").trim();
  if (!user) continue;
  for (const bc of baIdCols) {
    const v = String(mm[r][bc] ?? "").trim();
    if (v) empMap.set(v, user);
  }
}
console.log(`emp_id(BA)->CR map = ${empMap.size} รายการ (จาก Master_Member)`);

/* ---- 3) win_date map จาก Pending B2C Offline (job_code -> win_date) ---- */
const wwb = XLSX.read(readFileSync(join(BADIR, WINFILE)), { type: "buffer" });
const wsn = wwb.SheetNames.find((s) => /raw/i.test(s)) || "raw data";
const wrows = XLSX.utils.sheet_to_json(wwb.Sheets[wsn], { header: 1, blankrows: false });
const wjc = wrows[0].findIndex((c) => /^job_code$/i.test(String(c).trim()));
const wwd = wrows[0].findIndex((c) => /^win_date$/i.test(String(c).trim()));
const winMap = new Map();
for (let r = 1; r < wrows.length; r++) {
  const k = String(wrows[r][wjc] ?? "").trim();
  if (k && !winMap.has(k)) winMap.set(k, wrows[r][wwd]);
}
console.log(`win_date map = ${winMap.size} job_code (จาก ${WINFILE})`);

/* ---- 4) อ่าน BA "All" + สร้างแถว ---- */
const wb = XLSX.read(readFileSync(join(BADIR, BAFILE)), { type: "buffer" });
const d = XLSX.utils.sheet_to_json(wb.Sheets["All"], { header: 1, blankrows: false });
const H = {}; d[0].forEach((c, i) => (H[String(c).trim()] = i));
const G = (k) => H[k];

const rows = [];
let grandInc = 0, moneyDealer = 0, moneyEmp = 0;
let rowDealerHit = 0, rowEmpHit = 0, rowWinHit = 0;
const dealersMatched = new Set(), dealersMissed = new Set();
const empsMatched = new Set(), empsMissed = new Set();
const perMonth = new Map();

for (let r = 1; r < d.length; r++) {
  const row = d[r];
  if (!row || row.length === 0) continue;
  const year = num(row[G("Year")]) ?? 2026;
  const rmon = num(row[G("Report_Month")]);
  if (!rmon) continue;
  const period = `${year}-${String(rmon).padStart(2, "0")}`;

  const channel = str(row[G("channel_name")]);
  const dealer = channel && chMap.has(channel) ? chMap.get(channel) : null;
  const empId = str(row[G("emp_id")]);
  const empCode = empId && empMap.has(empId) ? empMap.get(empId) : null;
  const jobCode = str(row[G("job_code")]);
  const inc = num(row[G("total_incentive")]) ?? 0;

  if (dealer) { rowDealerHit++; moneyDealer += inc; if (channel) dealersMatched.add(channel); }
  else if (channel) dealersMissed.add(channel);
  if (empCode) { rowEmpHit++; moneyEmp += inc; if (empId) empsMatched.add(empId); }
  else if (empId) empsMissed.add(empId);
  const winDate = jobCode && winMap.has(jobCode) ? serialToDate(winMap.get(jobCode)) : null;
  if (winDate) rowWinHit++;

  rows.push({
    period,
    year,
    report_month: rmon,
    channel_name: channel,
    dealer_code: dealer ? dealer.code : null,
    dealer_name: dealer ? dealer.name : null,
    region: str(row[G("ภาค")]),
    province_name: str(row[G("province_name")]),
    emp_id: empId,
    sale_rep_name: str(row[G("sale_rep_name")]),
    emp_code: empCode,
    job_code: jobCode,
    job_type: str(row[G("job_type")]),
    worktype_name: str(row[G("worktype_name")]),
    product_code: str(row[G("product_code")]),
    product_name: str(row[G("product_name")]),
    service_group: str(row[G("service_group")]),
    service_port: str(row[G("service_port")]),
    service_brand: str(row[G("service_brand")]),
    sale_model: str(row[G("sale_model")]),
    customer_name: str(row[G("customer_name")]),
    invoice_date: serialToDate(row[G("invoice_date")]),
    customer_accepted_date: serialToDate(row[G("customer_accepted_date")]),
    win_date: winDate,
    date_payment: serialToDate(row[G("date_payment")]),
    invoice_net_amount: num(row[G("invoice_net_amount")]),
    gmv_service: num(row[G("gmv_service")]),
    base_incentive: num(row[G("base_incentive")]) ?? 0,
    topup_amount: num(row[G("topup_amount")]) ?? 0,
    total_incentive: inc,
    status_payment: str(row[G("Status_payment")]),
    source_file: str(row[G("source_file")]),
  });
  grandInc += inc;
  const p = perMonth.get(period) ?? { rows: 0, inc: 0 };
  p.rows++; p.inc += inc; perMonth.set(period, p);
}

/* ---- รายงาน ---- */
console.log("\n===== BA Incentive lines ต่อเดือน =====");
[...perMonth.keys()].sort().forEach((p) => {
  const v = perMonth.get(p);
  console.log(`  ${p} | ${v.rows} แถว | incentive ${v.inc.toFixed(2)}`);
});
console.log(`\n  รวมทั้งหมด = ${rows.length} แถว | total_incentive = ${grandInc.toFixed(2)}`);
console.log(`  เป้า (ไฟล์สรุป) = 1,729,598.06 | ต่าง ${(grandInc - 1729598.06).toFixed(2)} ${Math.abs(grandInc - 1729598.06) < 1 ? "✓ ตรง" : "✗ ไม่ตรง"}`);

const pctMoney = (m) => ((m / grandInc) * 100).toFixed(1);
console.log("\n===== การ map =====");
console.log(`  ร้าน (channel->dealer): ${rowDealerHit}/${rows.length} แถว | เงิน ${moneyDealer.toFixed(2)} (${pctMoney(moneyDealer)}%) | ร้านที่ map เจอ ${dealersMatched.size} / ไม่เจอ ${dealersMissed.size}`);
console.log(`  พนักงาน (emp->CR):      ${rowEmpHit}/${rows.length} แถว | เงิน ${moneyEmp.toFixed(2)} (${pctMoney(moneyEmp)}%) | emp map เจอ ${empsMatched.size} / ไม่เจอ ${empsMissed.size}`);
console.log(`  win_date (job_code):    ${rowWinHit}/${rows.length} แถว`);

if (!APPLY) {
  console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง");
  process.exit(0);
}

/* ---- APPLY ---- */
console.log("\nAPPLY: ล้างตาราง ba_incentive_lines แล้ว insert ใหม่...");
{ const { error } = await sb.from("ba_incentive_lines").delete().neq("id", 0); if (error) { console.error("delete ล้มเหลว:", error.message); process.exit(1); } }

const CHUNK = 500;
let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const { error } = await sb.from("ba_incentive_lines").insert(rows.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert ล้มเหลว:", error.message); process.exit(1); }
  done += Math.min(CHUNK, rows.length - i);
  process.stdout.write(`\r  insert ${done}/${rows.length}`);
}
console.log(`\nDONE lines=${rows.length}`);
