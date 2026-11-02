/* นำเข้า LHS Purchase Discount -> lhs_purchase_discount_lines
   กรอง: Housing Expert + status(success/waiting approval) + mer_cat=Roof
   ยอดก่อน VAT = plan_amount_incl_vat / 1.07 ; ส่วนลด = ก่อน VAT * 0.07
   ร้าน: map rept_gp_shopgroup -> dealer (Master_Dealer)
   period: จาก project_close_date (YYYY-MM)

   DRY RUN: node scripts/import-lhs-purchase-discount.mjs
   APPLY:   node scripts/import-lhs-purchase-discount.mjs --apply
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
const wb = XLSX.read(readFileSync(join(PDDIR, FILE)), { type: "buffer" });
const d = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { header: 1, blankrows: false });
const H = {}; d[0].forEach((c,i)=>(H[String(c).trim()]=i));
const G = (row,k)=>row[H[k]];
const S = (row,k)=>String(row[H[k]]??"").trim();
const statusOk = (s)=>/^success$/i.test(s)||/waiting.?approval/i.test(s);

const rows=[]; let grandExcl=0, grandDisc=0, dealerHit=0; const perMonth=new Map();
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
  const period = closeDate ? closeDate.slice(0,7) : null;

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
    order_created_date: serialToDate(G(row,"order_created_date")),
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
console.log(`ร้าน map เจอ ${dealerHit}/${rows.length} แถว`);
console.log(`\nรายเดือน (ย่อ 12 ล่าสุด):`);
[...perMonth.keys()].filter(k=>k!=="?").sort().slice(-12).forEach(p=>{const v=perMonth.get(p);console.log(`  ${p}: ${v.rows} แถว | ส่วนลด ${f(v.disc)}`);});
if(perMonth.has("?")) console.log(`  (ไม่มีวันปิด): ${perMonth.get("?").rows} แถว | ส่วนลด ${f(perMonth.get("?").disc)}`);

if(!APPLY){ console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

console.log("\nAPPLY: ล้างตาราง lhs_purchase_discount_lines แล้ว insert...");
{ const {error}=await sb.from("lhs_purchase_discount_lines").delete().neq("id",0); if(error){console.error("delete:",error.message);process.exit(1);} }
const CHUNK=500; let done=0;
for(let i=0;i<rows.length;i+=CHUNK){ const {error}=await sb.from("lhs_purchase_discount_lines").insert(rows.slice(i,i+CHUNK)); if(error){console.error("\ninsert:",error.message);process.exit(1);} done+=Math.min(CHUNK,rows.length-i); process.stdout.write(`\r  insert ${done}/${rows.length}`); }
console.log(`\nDONE lines=${rows.length}`);
