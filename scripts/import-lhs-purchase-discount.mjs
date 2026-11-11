/* นำเข้า LHS Purchase Discount -> lhs_purchase_discount_lines
   กรอง: Housing Expert + status(success/waiting approval) + mer_cat=Roof
   ยอดก่อน VAT = plan_amount_incl_vat / 1.07 ; ส่วนลด = ก่อน VAT * 0.07
   ร้าน: map rept_gp_shopgroup -> dealer (Master_Dealer)
   period: จาก project_close_date (YYYY-MM) ; ไม่มีวันปิด -> order_created_date (วันเปิด PO)
   ไฟล์ = PO ที่ปิดแล้วทั้งหมด (ยอดส่วนลดที่ร้านได้รับจริง) ; นับทั้ง success + waiting approval
   ต้นทาง: SharePoint (RSS System - PRD_CSD/win_contract_all.xlsx) sync อัตโนมัติผ่าน sync-runner (job lhs-discount)
   sync แบบ diff (ลายเซ็นทั้งแถว) ไม่ล้างตาราง ; กันพังถ้าแถว/ยอดลดเกิน 30%

   DRY RUN: node scripts/import-lhs-purchase-discount.mjs [--file <path>]
   APPLY:   node scripts/import-lhs-purchase-discount.mjs --apply [--file <path>] [--force]
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app";
const PDDIR = "commission-app/LHS Purchase Discount 2026";
const FILE = "win_contract_all.xlsx";
const SRC = "win_contract_all.xlsx";
const VAT = 1.07;
const RATE = 0.07;

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function parseCsv(text){const rows=[];let cur=[],f="",q=false;text=text.replace(/^\uFEFF/,"");for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else{if(c==='"')q=true;else if(c===","){cur.push(f);f="";}else if(c==="\n"){cur.push(f);rows.push(cur);cur=[];f="";}else if(c==="\r"){}else f+=c;}}if(f.length||cur.length){cur.push(f);rows.push(cur);}return rows;}
const str = (v) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };
const num = (v) => { if (v===undefined||v===null||v==="") return null; const n = Number(String(v).replace(/,/g,"")); return Number.isFinite(n)?n:null; };
const round2 = (n) => Math.round(n * 100) / 100;
const norm = (s) => String(s ?? "").replace(/\s+/g,"").replace(/[._]/g,"").toLowerCase().trim();
const serialToDate = (v) => {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) { const dt = new Date(Math.round((n - 25569) * 86400 * 1000)); if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0,10); }
  return null;
};

/* ---- map ร้าน -> dealer (Master_Dealer ทุกคอลัมน์ Dealer Name*) ---- */
const md = parseCsv(readFileSync(join(DIR,"Master_Dealer.csv"),"utf8"));
const mdh = md[0].map(c=>String(c).trim());
const iDCode = mdh.findIndex(h=>/^Dealer Code$/i.test(h));
const iDN = mdh.findIndex(h=>/^Dealer Name$/i.test(h));
const nameCols = mdh.map((h,i)=>(/name|ชื่อ/i.test(h)?i:-1)).filter(i=>i>=0);
const shopMap = new Map();
for(let r=1;r<md.length;r++){ const code=String(md[r][iDCode]??"").trim(); const nm=String(md[r][iDN]??"").trim(); for(const c of nameCols){ const v=norm(md[r][c]); if(v) shopMap.set(v,{code,name:nm}); } }
console.log(`shop->dealer map = ${shopMap.size} คีย์`);

/* ---- อ่าน win_contract ---- */
// --file <path> = อ่านจากไฟล์อื่น (เช่น SharePoint ที่ sync ลงเครื่อง) ; ไม่ใส่ = ไฟล์เดิมใน commission-app
const fileIdx = process.argv.indexOf("--file");
const SRC_PATH = fileIdx > -1 ? process.argv[fileIdx + 1] : join(PDDIR, FILE);
console.log(`ไฟล์: ${SRC_PATH}`);
const wb = XLSX.read(readFileSync(SRC_PATH), { type: "buffer" });
const d = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { header: 1, blankrows: false });
const H = {}; d[0].forEach((c,i)=>(H[String(c).trim()]=i));
const G = (row,k)=>row[H[k]];
const S = (row,k)=>String(row[H[k]]??"").trim();
const statusOk = (s)=>/^success$/i.test(s)||/waiting.?approval/i.test(s);

const rows=[]; let grandExcl=0, grandDisc=0, dealerHit=0, fallbackOrder=0; const perMonth=new Map();
for (let r=1;r<d.length;r++){
  const row=d[r]; if(!row||!row.some(c=>String(c??"").trim()!=="")) continue;
  if(!/housing expert/i.test(S(row,"rept_gp_shopmodel"))) continue;
  if(!statusOk(S(row,"bpm_ns_document_status_name"))) continue;
  if(S(row,"mer_cat")!=="Roof") continue;

  const incl = num(G(row,"plan_amount_incl_vat")) ?? 0;
  const excl = round2(incl / VAT);
  const disc = round2(excl * RATE);
  grandExcl += excl; grandDisc += disc;

  const closeDate = serialToDate(G(row,"project_close_date"));
  const orderDate = serialToDate(G(row,"order_created_date"));
  // เดือน = วันปิดงาน ; ไม่มีวันปิด -> ใช้วันเปิด PO (ผู้ใช้ยืนยัน: ทุกรายการในไฟล์คือ PO ที่ปิดแล้ว ต้องนับครบ)
  const period = closeDate ? closeDate.slice(0,7) : orderDate ? orderDate.slice(0,7) : null;
  if (!closeDate && orderDate) fallbackOrder++;

  const shop = str(S(row,"rept_gp_shopgroup"));
  const key = shop && shopMap.has(norm(shop)) ? norm(shop) : null;
  const dealer = key ? shopMap.get(key) : null;
  if(dealer) dealerHit++;

  rows.push({
    period,
    shop_group: shop,
    shop_model: str(S(row,"rept_gp_shopmodel")),
    dealer_code: dealer ? dealer.code : null,
    dealer_name: dealer ? dealer.name : null,
    region: str(S(row,"rept_sale_region_th")),
    site_number: str(S(row,"site_number")),
    project_number: str(S(row,"project_number")),
    order_number: str(S(row,"order_number")),
    project_name: str(S(row,"project_name")),
    solution_name: str(S(row,"solution_name_des")),
    sub_solution_name: str(S(row,"sub_solution_name_des")),
    mer_cat: str(S(row,"mer_cat")),
    sub_mer_cate: str(S(row,"sub_mer_cate")),
    service_type_name: str(S(row,"service_type_name")),
    doc_status: str(S(row,"bpm_ns_document_status_name")),
    customer_name: str(S(row,"company_name")),
    province_name: str(S(row,"province_name")),
    project_close_date: closeDate,
    order_created_date: orderDate,
    plan_amount_incl_vat: incl,
    sales_excl_vat: excl,
    discount_amount: disc,
    discount_rate: RATE,
    source_file: SRC,
  });
  const pm = perMonth.get(period ?? "?") ?? { rows:0, disc:0 };
  pm.rows++; pm.disc += disc; perMonth.set(period ?? "?", pm);
}

const f=(n)=>n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
console.log(`\n===== LHS Purchase Discount (HE + Roof + status ok) =====`);
console.log(`แถว ${rows.length} | ยอดก่อน VAT ${f(grandExcl)} | ส่วนลด 7% ${f(grandDisc)}`);
console.log(`ร้าน map เจอ ${dealerHit}/${rows.length} แถว | ไม่มีวันปิดงาน ใช้เดือนเปิด PO แทน ${fallbackOrder} แถว`);
console.log(`\nรายเดือน (ย่อ 12 ล่าสุด):`);
[...perMonth.keys()].filter(k=>k!=="?").sort().slice(-12).forEach(p=>{const v=perMonth.get(p);console.log(`  ${p}: ${v.rows} แถว | ส่วนลด ${f(v.disc)}`);});
if(perMonth.has("?")) console.log(`  (ไม่มีวันปิด): ${perMonth.get("?").rows} แถว | ส่วนลด ${f(perMonth.get("?").disc)}`);

/* ---- sync แบบ diff (ไม่ล้างตาราง) ----
   order_number/project_number ซ้ำได้ จึงใช้ "ลายเซ็นทั้งแถว" + จำนวนครั้ง (เหมือน import-service-sales) */
const SIG = ["period","shop_group","shop_model","dealer_code","dealer_name","region","site_number","project_number","order_number","project_name",
  "solution_name","sub_solution_name","mer_cat","sub_mer_cate","service_type_name","doc_status","customer_name","province_name",
  "project_close_date","order_created_date","plan_amount_incl_vat","sales_excl_vat","discount_amount"];
const MONEY = new Set(["plan_amount_incl_vat","sales_excl_vat","discount_amount"]);
const sigOf = (x) => SIG.map((k) => (MONEY.has(k) ? Number(x[k] ?? 0).toFixed(2) : x[k] ?? "")).join("\u0001");
const db = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("lhs_purchase_discount_lines").select(["id", ...SIG].join(",")).order("id").range(from, from + 999);
  if (error) { console.error("อ่านฐานข้อมูลไม่สำเร็จ:", error.message); process.exit(1); }
  db.push(...data); if (data.length < 1000) break;
}
const dbBySig = new Map();
db.forEach((x) => { const k = sigOf(x); const a = dbBySig.get(k) ?? []; a.push(x.id); dbBySig.set(k, a); });
const fileCount = new Map();
rows.forEach((x) => { const k = sigOf(x); fileCount.set(k, (fileCount.get(k) ?? 0) + 1); });
const toDeleteIds = [];
for (const [k, ids] of dbBySig) { const keep = fileCount.get(k) ?? 0; if (ids.length > keep) toDeleteIds.push(...ids.slice(keep)); }
const toInsert = [];
{ const used = new Map(); rows.forEach((x) => { const k = sigOf(x); const n = (used.get(k) ?? 0) + 1; used.set(k, n); if (n > (dbBySig.get(k)?.length ?? 0)) toInsert.push(x); }); }
const dbDisc = db.reduce((a, x) => a + Number(x.discount_amount), 0);
console.log(`\nฐานข้อมูล: ${db.length} แถว | ส่วนลด ${f(dbDisc)}  →  หลัง sync: ${rows.length} แถว | ส่วนลด ${f(grandDisc)} (ต่าง ${f(grandDisc - dbDisc)})`);
console.log(`→ เพิ่ม ${toInsert.length} | ลบ ${toDeleteIds.length}`);
{
  const per = (arr, val) => { const m = new Map(); arr.forEach((x) => m.set(x.period ?? "?", (m.get(x.period ?? "?") ?? 0) + val(x))); return m; };
  const a = per(db, (x) => Number(x.discount_amount)), b = per(rows, (x) => x.discount_amount);
  const diffs = [...new Set([...a.keys(), ...b.keys()])].sort().filter((k) => Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0)) > 0.005);
  console.log(`เดือนที่ยอดเปลี่ยน: ${diffs.length ? diffs.map((k) => `${k}: ${f(a.get(k) ?? 0)} → ${f(b.get(k) ?? 0)}`).join(" | ") : "ไม่มี"}`);
}
const FORCE = process.argv.includes("--force");
if (db.length && (rows.length < db.length * 0.7 || grandDisc < dbDisc * 0.7) && !FORCE) {
  console.error("หยุด: จำนวนแถว/ยอดส่วนลดลดลงเกิน 30% — ไฟล์อาจไม่ครบ ใช้ --force ถ้าตั้งใจ");
  process.exit(2);
}

if(!APPLY){ console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

for (let i = 0; i < toInsert.length; i += 500) {
  const { error } = await sb.from("lhs_purchase_discount_lines").insert(toInsert.slice(i, i + 500));
  if (error) { console.error("\ninsert:", error.message); process.exit(1); }
}
for (let i = 0; i < toDeleteIds.length; i += 500) {
  const { error } = await sb.from("lhs_purchase_discount_lines").delete().in("id", toDeleteIds.slice(i, i + 500));
  if (error) { console.error("\ndelete:", error.message); process.exit(1); }
}
console.log(`\nDONE: เพิ่ม ${toInsert.length} | ลบ ${toDeleteIds.length} | lhs_purchase_discount_lines=${rows.length}`);
