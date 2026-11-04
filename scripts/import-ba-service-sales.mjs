/* นำเข้ายอดขายงานบริการ BA (รายวัน) -> ba_service_sales_lines
   -------------------------------------------------------------
   - ไฟล์: ยอดขายทั้งหมด/ยอดขายงานบริการ BA ร้านค้า/Pending B2C Offline.xlsx (sheet "raw data")
   - ยอด = gmv ; ใช้ sale_status = win ; รวมทั้ง type_of_job S (สำรวจ) และ I (ติดตั้ง)
   - dedupe: job_id ซ้ำ -> เก็บแถวที่ win_date ล่าสุด
   - ร้าน: 1) dealer_code ตรงในไฟล์ (ตรวจกับ dealers ใน Supabase)
           2) ไม่มี -> map store_name ผ่าน Master_Dealer.csv (Dealer Name_BA App_1..4)
           map ไม่เจอ => dealer_code = null (เก็บไว้ให้ admin เห็น "ไม่ระบุร้าน")
   - period: จาก win_date (YYYY-MM) ; ข้ามแถวที่ไม่มี win_date
   - 3 กลุ่มใหญ่ (group3) map จาก service_group
   - idempotent: ลบตารางแล้ว insert ใหม่

   DRY RUN: node scripts/import-ba-service-sales.mjs
   APPLY:   node scripts/import-ba-service-sales.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app/ยอดขายทั้งหมด/ยอดขายงานบริการ BA ร้านค้า";
const FILE = "Pending B2C Offline.xlsx";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const str = (v) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };
const serialToDate = (v) => {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) { const dt = new Date(Math.round((n - 25569) * 86400 * 1000)); if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10); }
  return null;
};

/* ---- Master_Dealer: BA App name -> dealer, + ชุด dealer code ที่มีจริง ---- */
function parseCsv(text){const rows=[];let cur=[],fl="",q=false;text=text.replace(/^\uFEFF/,"");for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){fl+='"';i++;}else q=false;}else fl+=c;}else{if(c==='"')q=true;else if(c===","){cur.push(fl);fl="";}else if(c==="\n"){cur.push(fl);rows.push(cur);cur=[];fl="";}else if(c==="\r"){}else fl+=c;}}if(fl.length||cur.length){cur.push(fl);rows.push(cur);}return rows;}
const md = parseCsv(readFileSync("commission-app/Master_Dealer.csv", "utf8"));
const mdh = md[0].map((c) => String(c).trim());
const iDCode = mdh.findIndex((h) => /^Dealer Code$/i.test(h));
const iDN = mdh.findIndex((h) => /^Dealer Name$/i.test(h));
const dBaCols = mdh.map((h, i) => (/^Dealer Name_BA App_\d/i.test(h) ? i : -1)).filter((i) => i >= 0);
const nameMap = new Map();
const masterCodeToName = new Map();
for (let r = 1; r < md.length; r++) {
  const code = String(md[r][iDCode] ?? "").trim();
  const nm = String(md[r][iDN] ?? "").trim();
  if (code) masterCodeToName.set(code, nm);
  for (const c of dBaCols) { const v = String(md[r][c] ?? "").trim(); if (v) nameMap.set(v, { code, name: nm }); }
}
console.log(`Master_Dealer: code->name ${masterCodeToName.size} | BA-app name map ${nameMap.size}`);

/* ---- รายชื่อ dealer code ที่มีจริงใน Supabase (ตรวจความถูกต้องของ dealer_code ในไฟล์) ---- */
const { data: dealerRows, error: dErr } = await sb.from("dealers").select("code,name");
if (dErr) { console.error("โหลด dealers ไม่สำเร็จ:", dErr.message); process.exit(1); }
const dealerSet = new Map(dealerRows.map((d) => [d.code, d.name]));
console.log(`Supabase dealers = ${dealerSet.size} ร้าน`);

/* ---- 3-group map จาก service_group ---- */
const GROUP3_MAP = {
  "Roofing B2C": "ROOF SERVICE",
  "Roof Truss B2C": "ROOF SERVICE",
  "Re-Roof": "ROOF SERVICE",
  "Metal Roof": "ROOF SERVICE",
  "Roof Repair": "ROOF SERVICE",
  "Roof Repaint": "ROOF SERVICE",
  "Solar Rooftop": "SMART SOLUTION",
  "Active Air Quality": "SMART SOLUTION",
  "Air system": "SMART SOLUTION",
  "AC Installation": "SMART SOLUTION",
  "AC Cleaning": "SMART SOLUTION",
  "AC Repair": "SMART SOLUTION",
  "Renovation": "Qchang",
  "Carport & Awning": "Qchang",
  "Gutter": "Qchang",
  "Gutter Repair": "Qchang",
  "Insulation": "Qchang",
  "Ceiling": "Qchang",
  "Flooring": "Qchang",
  "Concrete Flooring": "Qchang",
  "Landscape": "Qchang",
  "Door & Window": "Qchang",
  "Painting": "Qchang",
  "Bathroom Renovation": "Qchang",
  "Bathroom": "Qchang",
  "Kitchen Renovation": "Qchang",
  "Ceramic Tile": "Qchang",
  "Electrical Repair": "Qchang",
  "Plumbing": "Qchang",
  "Void Filling": "Qchang",
  "Building Film": "Qchang",
  "Water Heater": "Qchang",
  "Fencing": "Qchang",
  "Washer Cleaning": "Qchang",
  "Acoustic Solution": "SMART SOLUTION",
  "EZYBUILT": "Qchang",
  "Others": "Qchang",
};
function groupOf(svc) { return GROUP3_MAP[svc] ?? null; }

/* ---- อ่านไฟล์ ---- */
const wb = XLSX.read(readFileSync(join(DIR, FILE)), { type: "buffer" });
const d = XLSX.utils.sheet_to_json(wb.Sheets["raw data"], { header: 1, blankrows: false, defval: null });
const H = {}; d[0].forEach((c, i) => (H[String(c).trim()] = i));
const S = (row, k) => String(row[H[k]] ?? "").trim();
const G = (row, k) => row[H[k]];

const allRows = d.slice(1).filter((r) => r && r.some((x) => x != null && String(x).trim() !== ""));

/* dedupe by job_id: เก็บแถว win_date ล่าสุด */
const byId = new Map();
for (const row of allRows) {
  const jid = S(row, "job_id"); if (!jid) continue;
  const prev = byId.get(jid);
  if (!prev) { byId.set(jid, row); continue; }
  const wNew = Number(G(row, "win_date")) || 0, wOld = Number(G(prev, "win_date")) || 0;
  if (wNew > wOld) byId.set(jid, row);
}

const rows = [];
let skipNotWin = 0, skipNoDate = 0, skipNoGroup = 0, dealerDirect = 0, dealerByName = 0, dealerNone = 0;
const grp = new Map();
for (const row of byId.values()) {
  if (S(row, "sale_status") !== "win") { skipNotWin++; continue; }
  const winDate = serialToDate(G(row, "win_date"));
  if (!winDate) { skipNoDate++; continue; }
  const svc = S(row, "service_group");
  const group3 = groupOf(svc);
  if (!group3) { skipNoGroup++; continue; }

  const amt = Number(G(row, "gmv") ?? 0) || 0;
  const storeName = S(row, "store_name");
  let dealerCode = S(row, "dealer_code");
  let dealerName = null;

  if (dealerCode && dealerSet.has(dealerCode)) {
    dealerName = dealerSet.get(dealerCode);
    dealerDirect++;
  } else {
    const hit = storeName ? nameMap.get(storeName) : null;
    if (hit) { dealerCode = hit.code; dealerName = hit.name; dealerByName++; }
    else { dealerCode = null; dealerByName += 0; dealerNone++; }
  }

  rows.push({
    job_id: S(row, "job_id"),
    job_code: S(row, "job_code"),
    period: winDate.slice(0, 7),
    win_date: winDate,
    dealer_code: dealerCode,
    dealer_name: dealerName,
    store_name: storeName,
    channel_group: S(row, "channel_group"),
    service_group: svc,
    group3,
    type_of_job: S(row, "type_of_job").startsWith("S") ? "S" : S(row, "type_of_job").startsWith("I") ? "I" : null,
    shop_model: S(row, "shop_model"),
    region: S(row, "region"),
    product_name: S(row, "product_name"),
    amount: amt,
    source_file: FILE,
  });
  const gv = grp.get(group3) ?? { n: 0, amt: 0 }; gv.n++; gv.amt += amt; grp.set(group3, gv);
}

const f = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
console.log(`\nแถวดิบ = ${allRows.length} | distinct job_id = ${byId.size}`);
console.log(`นำเข้า = ${rows.length} | ข้าม(ไม่ win) ${skipNotWin} | ข้าม(ไม่มี win_date) ${skipNoDate} | ข้าม(group ไม่รู้จัก) ${skipNoGroup}`);
console.log(`map ร้าน: ตรงใน dealers ${dealerDirect} | ผ่านชื่อ BA App ${dealerByName} | ไม่ระบุร้าน ${dealerNone}`);
console.log("3-group:");
[...grp.entries()].sort((a, b) => b[1].amt - a[1].amt).forEach(([k, v]) => console.log(`  ${k}: ${v.n} แถว | ${f(v.amt)}`));
const grandTotal = rows.reduce((s, r) => s + r.amount, 0);
console.log(`ยอดรวม = ${f(grandTotal)}`);

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

console.log("\nAPPLY: ล้าง ba_service_sales_lines แล้ว insert...");
{ const { error } = await sb.from("ba_service_sales_lines").delete().neq("id", 0); if (error) { console.error("delete:", error.message); process.exit(1); } }
const CHUNK = 1000; let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const { error } = await sb.from("ba_service_sales_lines").insert(rows.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert:", error.message); process.exit(1); }
  done += Math.min(CHUNK, rows.length - i); process.stdout.write(`\r  insert ${done}/${rows.length}`);
}
console.log(`\nDONE ba_service_sales_lines=${rows.length}`);
