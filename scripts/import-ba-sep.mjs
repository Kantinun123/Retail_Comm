/* นำเข้า BA Incentive เดือน Sep 2026 (period 2026-09) -> ba_incentive_lines
   -------------------------------------------------------------
   - อ่านไฟล์ย่อยรายร้าน I-SEP26_*.xlsx (sheet "Sheet1") ในโฟลเดอร์ Sep/<drive-download>
   - APPEND ONLY: ลบเฉพาะ period 2026-09 ก่อน insert (idempotent) ไม่แตะเดือนอื่น
   - map: channel_name/store_name -> dealer (Master_Dealer), emp_id(BA) -> CR (Master_Member),
          emp_id -> rep_code (sale_reps.ba_app_id_1/2), win_date (Pending B2C Offline)
   - คอลัมน์ไฟล์ย่อยต่างจาก consolidated: ไม่มี date_payment/ภาค; status_payment <- payment_condition

   DRY RUN: node scripts/import-ba-sep.mjs
   APPLY:   node scripts/import-ba-sep.mjs --apply
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app";
const BADIR = "commission-app/BA Incentive_พนักงาน";
const WINFILE = "Pending B2C Offline.xlsx";
const PERIOD = "2026-09";
const YEAR = 2026, RMON = 9;

/* ---- env ---- */
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ---- helpers ---- */
const str = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === "" || s === "NULL" ? null : s; };
const num = (v) => { if (v === undefined || v === null || v === "" || v === "NULL") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
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
function parseCsv(text) {
  const rows = []; let cur = [], f = "", q = false; text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ",") { cur.push(f); f = ""; } else if (c === "\n") { cur.push(f); rows.push(cur); cur = []; f = ""; } else if (c === "\r") {} else f += c; } }
  if (f.length || cur.length) { cur.push(f); rows.push(cur); }
  return rows;
}
const norm = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase().trim();

/* ---- 1) channel/store -> dealer (Master_Dealer) ---- */
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
console.log(`channel->dealer map = ${chMap.size}`);

/* ---- 2) emp_id(BA) -> CR (Master_Member) ---- */
const mm = parseCsv(readFileSync(join(DIR, "Master_Member.csv"), "utf8"));
const mmh = mm[0].map((c) => String(c).trim());
const iUser = mmh.findIndex((h) => /^User ID$/i.test(h));
const baIdCols = mmh.map((h, i) => (/^Salesperson ID_BA App_\d/i.test(h) ? i : -1)).filter((i) => i >= 0);
const empMap = new Map();
for (let r = 1; r < mm.length; r++) { const user = String(mm[r][iUser] ?? "").trim(); if (!user) continue;
  for (const bc of baIdCols) { const v = String(mm[r][bc] ?? "").trim(); if (v) empMap.set(v, user); } }
console.log(`emp_id(BA)->CR map = ${empMap.size}`);

/* ---- 3) win_date (Pending B2C Offline) ---- */
const wwb = XLSX.read(readFileSync(join(BADIR, WINFILE)), { type: "buffer" });
const wsn = wwb.SheetNames.find((s) => /raw/i.test(s)) || "raw data";
const wrows = XLSX.utils.sheet_to_json(wwb.Sheets[wsn], { header: 1, blankrows: false });
const wjc = wrows[0].findIndex((c) => /^job_code$/i.test(String(c).trim()));
const wwd = wrows[0].findIndex((c) => /^win_date$/i.test(String(c).trim()));
const winMap = new Map();
for (let r = 1; r < wrows.length; r++) { const k = String(wrows[r][wjc] ?? "").trim(); if (k && !winMap.has(k)) winMap.set(k, wrows[r][wwd]); }
console.log(`win_date map = ${winMap.size}`);

/* ---- 4) emp_id -> rep_code (sale_reps) ---- */
const byBA = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("sale_reps").select("rep_code,ba_app_id_1,ba_app_id_2").range(from, from + 999);
  if (error) { console.error("sale_reps:", error.message); process.exit(1); }
  for (const r of data) { if (r.ba_app_id_1) byBA.set(String(r.ba_app_id_1).trim(), r.rep_code); if (r.ba_app_id_2) byBA.set(String(r.ba_app_id_2).trim(), r.rep_code); }
  if (data.length < 1000) break;
}
console.log(`emp_id->rep_code map = ${byBA.size}`);

/* ---- 5) อ่านไฟล์ย่อย Sep ---- */
const base = join(BADIR, "Sep");
const sepDir = join(base, readdirSync(base).find((d) => statSync(join(base, d)).isDirectory()));
const files = readdirSync(sepDir).filter((x) => x.endsWith(".xlsx"));

const rows = [];
let grandInc = 0, rowDealerHit = 0, rowEmpHit = 0, rowRepHit = 0, rowWinHit = 0;
const dealersMissed = new Set(), empsMissed = new Set();

for (const file of files) {
  const wb = XLSX.read(readFileSync(join(sepDir, file)), { type: "buffer" });
  const d = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { header: 1, blankrows: false });
  if (!d.length) continue;
  const H = {}; d[0].forEach((c, i) => (H[String(c).trim()] = i));
  const G = (k) => H[k];
  for (let r = 1; r < d.length; r++) {
    const row = d[r]; if (!row) continue;
    const jobCode = str(row[G("job_code")]); if (!jobCode) continue; // ข้าม subtotal/blank

    const channel = str(row[G("channel_name")]);
    const storeNm = str(row[G("store_name")]);
    const dealer = (channel && chMap.get(channel)) || (storeNm && chMap.get(storeNm)) || null;
    const empId = str(row[G("emp_id")]);
    const empCode = empId && empMap.has(empId) ? empMap.get(empId) : null;
    const repCode = empId && byBA.has(empId) ? byBA.get(empId) : null;
    const inc = num(row[G("total_incentive")]) ?? 0;
    const winDate = jobCode && winMap.has(jobCode) ? serialToDate(winMap.get(jobCode)) : null;

    if (dealer) rowDealerHit++; else if (channel) dealersMissed.add(channel);
    if (empCode) rowEmpHit++; else if (empId) empsMissed.add(empId);
    if (repCode) rowRepHit++;
    if (winDate) rowWinHit++;

    rows.push({
      period: PERIOD, year: YEAR, report_month: RMON,
      channel_name: channel,
      dealer_code: dealer ? dealer.code : null,
      dealer_name: dealer ? dealer.name : null,
      region: null,
      province_name: str(row[G("province_name")]),
      emp_id: empId,
      sale_rep_name: str(row[G("sale_rep_name")]),
      emp_code: empCode,
      rep_code: repCode,
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
      date_payment: null, // ไฟล์ย่อยไม่มีคอลัมน์ date_payment
      invoice_net_amount: num(row[G("invoice_net_amount")]),
      gmv_service: num(row[G("gmv_service")]),
      base_incentive: num(row[G("base_incentive")]) ?? 0,
      topup_amount: num(row[G("topup_amount")]) ?? 0,
      total_incentive: inc,
      status_payment: str(row[G("payment_condition")]),
      source_file: file,
    });
    grandInc += inc;
  }
}

console.log(`\n===== Sep (${PERIOD}) =====`);
console.log(`  ${rows.length} แถว | total_incentive ${grandInc.toFixed(2)}`);
console.log(`  map dealer ${rowDealerHit}/${rows.length} | emp_code(CR) ${rowEmpHit}/${rows.length} | rep_code ${rowRepHit}/${rows.length} | win_date ${rowWinHit}/${rows.length}`);
console.log(`  ร้านที่ map ไม่เจอ: ${dealersMissed.size}`, [...dealersMissed].slice(0, 10));
console.log(`  emp ที่ไม่มี CR: ${empsMissed.size}`);

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

/* ---- APPLY: ลบเฉพาะ period 2026-09 แล้ว insert ---- */
console.log(`\nAPPLY: ลบ period ${PERIOD} เดิม (ถ้ามี) แล้ว insert...`);
{ const { error, count } = await sb.from("ba_incentive_lines").delete({ count: "exact" }).eq("period", PERIOD); if (error) { console.error("delete:", error.message); process.exit(1); } console.log(`  ลบเดิม ${count ?? 0} แถว`); }
const CHUNK = 500; let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const { error } = await sb.from("ba_incentive_lines").insert(rows.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert:", error.message); process.exit(1); }
  done += Math.min(CHUNK, rows.length - i); process.stdout.write(`\r  insert ${done}/${rows.length}`);
}
console.log(`\nDONE Sep lines=${rows.length}`);
