/* นำเข้ายอดขายงานบริการ -> service_sales_lines
   -------------------------------------------------------------
   - ไฟล์: ยอดขายทั้งหมด/ยอดขายงานบริการ LHS_Rudy ร้านค้า/win_contract_all.xlsx
   - ยอด = plan_amount_incl_vat (รวม VAT) ใช้ทุกสถานะ (win ทั้งหมด)
   - ร้าน: map rept_gp_shopgroup -> Master_Dealer.csv (เหมือน LHS discount)
     * map ไม่เจอ => dealer_code = null (เก็บไว้ให้ admin เห็น "ไม่ระบุร้าน")
   - period: จาก project_close_date (YYYY-MM) ; ข้ามแถวที่ไม่มีวันปิด
   - 3 กลุ่มใหญ่: ROOF SERVICE / SMART SOLUTION / Qchang (ปัด OTHER ทิ้ง)
   - idempotent: ลบตารางแล้ว insert ใหม่

   DRY RUN: node scripts/import-service-sales.mjs
   APPLY:   node scripts/import-service-sales.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app/ยอดขายทั้งหมด/ยอดขายงานบริการ LHS_Rudy ร้านค้า";
const FILE = "win_contract_all.xlsx";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const str = (v) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };
const norm = (s) => String(s ?? "").replace(/\s+/g, "").replace(/[._]/g, "").toLowerCase().trim();
const serialToDate = (v) => {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) { const dt = new Date(Math.round((n - 25569) * 86400 * 1000)); if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10); }
  return null;
};

/* ---- Master_Dealer map (ชื่อร้าน normalize -> code) ---- */
function parseCsv(text){const rows=[];let cur=[],fl="",q=false;text=text.replace(/^\uFEFF/,"");for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){fl+='"';i++;}else q=false;}else fl+=c;}else{if(c==='"')q=true;else if(c===","){cur.push(fl);fl="";}else if(c==="\n"){cur.push(fl);rows.push(cur);cur=[];fl="";}else if(c==="\r"){}else fl+=c;}}if(fl.length||cur.length){cur.push(fl);rows.push(cur);}return rows;}
const md = parseCsv(readFileSync("commission-app/Master_Dealer.csv", "utf8"));
const mdh = md[0].map((c) => String(c).trim());
const iDCode = mdh.findIndex((h) => /^Dealer Code$/i.test(h));
const iDN = mdh.findIndex((h) => /^Dealer Name$/i.test(h));
const nameCols = mdh.map((h, i) => (/name|ชื่อ/i.test(h) ? i : -1)).filter((i) => i >= 0);
const shopMap = new Map();
for (let r = 1; r < md.length; r++) {
  const code = String(md[r][iDCode] ?? "").trim();
  const nm = String(md[r][iDN] ?? "").trim();
  for (const c of nameCols) { const v = norm(md[r][c]); if (v) shopMap.set(v, { code, name: nm }); }
}
console.log(`Master_Dealer map keys = ${shopMap.size}`);

/* ---- 3-group rollup ---- */
function groupOf(h3u, h5u) {
  if (h3u === "AIR SOLUTION" || h3u === "SOLAR ROOF" || h3u === "HOME AUTOMATION" || h3u === "CEILING & WALL PERFORMANCE") return "SMART SOLUTION";
  if (h3u === "HOME RENOVATION SYSTEM") return "Qchang";
  if (h5u === "ROOF REPAIR" || h5u === "REROOF" || h5u === "ROOF REPAINT" || h5u === "ROOF RENEW" || h5u === "TOP UP ROOF") return "Qchang";
  if (h3u === "ROOF SYSTEM" || h3u === "METAL ROOF") return "ROOF SERVICE";
  return null; // OTHER -> ปัดทิ้ง
}

/* ---- อ่านไฟล์ ---- */
// --file <path> = อ่านจากไฟล์อื่น (เช่น โฟลเดอร์ SharePoint ที่ sync ลงเครื่อง) ; ไม่ใส่ = ไฟล์เดิมใน commission-app
const fileIdx = process.argv.indexOf("--file");
const SRC = fileIdx > -1 ? process.argv[fileIdx + 1] : join(DIR, FILE);
console.log(`ไฟล์: ${SRC}`);
const wb = XLSX.read(readFileSync(SRC), { type: "buffer" });
const d = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { header: 1, blankrows: false, defval: null });
const H = {}; d[0].forEach((c, i) => (H[String(c).trim()] = i));
const S = (row, k) => String(row[H[k]] ?? "").trim();
const G = (row, k) => row[H[k]];

const rows = [];
let dealerHit = 0, skipNoGroup = 0, skipNoDate = 0;
const grp = new Map();
for (let r = 1; r < d.length; r++) {
  const row = d[r]; if (!row) continue;
  const closeDate = serialToDate(G(row, "project_close_date"));
  if (!closeDate) { skipNoDate++; continue; }       // ต้องมีวันปิด (ใช้จัดปี/เดือน)
  const h3 = S(row, "H3"), h4 = S(row, "H4"), h5 = S(row, "H5");
  const group3 = groupOf(h3.toUpperCase(), h5.toUpperCase());
  if (!group3) { skipNoGroup++; continue; }

  const amt = Number(G(row, "plan_amount_incl_vat") ?? 0) || 0;
  const shop = S(row, "rept_gp_shopgroup");
  const hit = shopMap.get(norm(shop));
  if (hit) dealerHit++;

  // sub_group: ROOF SERVICE/SMART SOLUTION ใช้ H4, Qchang ใช้ H5 (ละเอียดกว่า)
  const subGroup = group3 === "Qchang" ? (h5 || h4 || null) : (h4 || h3 || null);

  rows.push({
    period: closeDate.slice(0, 7),
    close_date: closeDate,
    dealer_code: hit ? hit.code : null,
    dealer_name: hit ? hit.name : null,
    shop_group: shop || null,
    region: str(S(row, "rept_sale_region_th")),
    group3,
    sub_group: subGroup,
    h3: h3 || null, h4: h4 || null, h5: h5 || null,
    solution_name: str(S(row, "solution_name_des")),
    sub_solution_name: str(S(row, "sub_solution_name_des")),
    project_name: str(S(row, "project_name")),        // ชื่อลูกค้า (ผู้ใช้ยืนยันให้แสดง)
    sales_name: str(S(row, "project_created_name_des")), // ชื่อพนักงานขาย
    project_number: str(S(row, "project_number")),
    province_name: str(S(row, "province_name")),
    amount_incl_vat: amt,
    source_file: FILE,
  });
  const gv = grp.get(group3) ?? { n: 0, amt: 0 }; gv.n++; gv.amt += amt; grp.set(group3, gv);
}

const f = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
console.log(`\nแถวที่นำเข้า = ${rows.length} | ข้าม(ไม่มีวันปิด) ${skipNoDate} | ข้าม(OTHER) ${skipNoGroup}`);
console.log(`map ร้านเจอ = ${dealerHit}/${rows.length} | ไม่ระบุร้าน = ${rows.length - dealerHit}`);
console.log("3-group:");
[...grp.entries()].sort((a, b) => b[1].amt - a[1].amt).forEach(([k, v]) => console.log(`  ${k}: ${v.n} แถว | ${f(v.amt)}`));

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

console.log("\nAPPLY: ล้าง service_sales_lines แล้ว insert...");
{ const { error } = await sb.from("service_sales_lines").delete().neq("id", 0); if (error) { console.error("delete:", error.message); process.exit(1); } }
const CHUNK = 1000; let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const { error } = await sb.from("service_sales_lines").insert(rows.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert:", error.message); process.exit(1); }
  done += Math.min(CHUNK, rows.length - i); process.stdout.write(`\r  insert ${done}/${rows.length}`);
}
console.log(`\nDONE service_sales_lines=${rows.length}`);
