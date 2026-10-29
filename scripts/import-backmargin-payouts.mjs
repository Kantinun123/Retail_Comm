/* นำเข้ายอดจ่าย back margin จริง จากไฟล์สรุป data(22).xlsx -> back_margin_payouts
   -------------------------------------------------------------
   คอลัมน์ (header อยู่แถว 2 ของ sheet): Year | MonthName | Dealer No. | Dealer_name | Region | Rebate Amount | วันที่ทำจ่าย
   period = Year-MM (จาก MonthName)
   idempotent: ลบทั้งตารางก่อน insert ใหม่ (ไฟล์เดียวครบทุกเดือน)

   DRY RUN: node scripts/import-backmargin-payouts.mjs
   APPLY:   node scripts/import-backmargin-payouts.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app/back margin 2026";
const FILE = "data (22).xlsx";
const MONTH = { Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12" };

/* ---- env ---- */
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const str = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === "" ? null : s; };
const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
// วันที่ทำจ่าย: อาจเป็น DD/MM/YYYY หรือ Excel serial
function toDate(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return null;
}

/* ---- อ่านไฟล์ ---- */
const wb = XLSX.read(readFileSync(join(DIR, FILE)), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { header: 1, blankrows: false });
// หา header row (ที่มี "Dealer No.")
let hr = -1;
for (let i = 0; i < Math.min(5, rows.length); i++) {
  if ((rows[i] || []).some((c) => String(c).trim() === "Dealer No.")) { hr = i; break; }
}
if (hr < 0) { console.error("หา header (Dealer No.) ไม่เจอ"); process.exit(1); }
const H = {}; rows[hr].forEach((c, i) => (H[String(c).trim()] = i));

const recs = [];
const perMonth = new Map();
let skipped = 0;
for (let r = hr + 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || !row[H["Dealer No."]]) continue;
  const mon = MONTH[String(row[H["MonthName"]]).trim()];
  const year = str(row[H["Year"]]) ?? "2026";
  if (!mon) { skipped++; continue; }
  const period = `${year}-${mon}`;
  const rec = {
    period,
    dealer_code: String(row[H["Dealer No."]]).trim(),
    dealer_name: str(row[H["Dealer_name"]]),
    region: str(row[H["Region"]]),
    rebate_amount: num(row[H["Rebate Amount"]]),
    paid_date: toDate(row[H["วันที่ทำจ่าย"]]),
  };
  recs.push(rec);
  const p = perMonth.get(period) ?? { rows: 0, amt: 0 };
  p.rows++; p.amt += rec.rebate_amount; perMonth.set(period, p);
}

console.log(`${APPLY ? "APPLY" : "DRY RUN"} | อ่าน ${recs.length} แถว (ข้าม ${skipped})`);
console.log("\n=== ยอดจ่ายต่อเดือน ===");
let grand = 0;
[...perMonth.keys()].sort().forEach((p) => {
  console.log(`  ${p} | ร้าน ${perMonth.get(p).rows} | ยอดจ่าย ${perMonth.get(p).amt.toLocaleString(undefined,{maximumFractionDigits:2})}`);
  grand += perMonth.get(p).amt;
});
console.log(`  รวม: ${grand.toLocaleString(undefined,{maximumFractionDigits:2})}`);
// ตัวอย่าง paid_date
console.log("\nตัวอย่าง 3 แถว:");
recs.slice(0, 3).forEach((r) => console.log(`  ${r.period} | ${r.dealer_code} | ${r.rebate_amount} | จ่าย ${r.paid_date}`));

if (!APPLY) {
  console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง");
  process.exit(0);
}

/* ---- APPLY: ล้างตารางก่อน แล้ว insert (ไฟล์เดียวครบทุกเดือน) ---- */
const { error: delErr } = await sb.from("back_margin_payouts").delete().neq("id", 0);
if (delErr) { console.error("ลบข้อมูลเดิมล้มเหลว:", delErr.message); process.exit(1); }
const CHUNK = 500;
let done = 0;
for (let i = 0; i < recs.length; i += CHUNK) {
  const { error } = await sb.from("back_margin_payouts").upsert(recs.slice(i, i + CHUNK), { onConflict: "period,dealer_code" });
  if (error) { console.error("insert ล้มเหลว:", error.message); process.exit(1); }
  done += Math.min(CHUNK, recs.length - i);
}
console.log(`\nDONE back_margin_payouts upserted: ${done}`);
