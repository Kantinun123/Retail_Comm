/* นำเข้า LHS Commission (ผลประโยชน์พนักงาน Housing Expert, ระบบ Rudy) -> lhs_commission_lines
   -------------------------------------------------------------
   - อ่าน summaryData_HousingExpert_2026 (1).xlsx ชีต "summarry_HEcommission"
     (ไฟล์ใหม่ที่อัปเดตต่อจาก CSV เดิม : ข้อมูลสะสม ส.ค.-ต.ค. ครอบคลุมของเดิมทั้งหมด)
   - ข้ามแถวว่าง (placeholder พ.ย./ธ.ค. ที่มีแต่ Year/Month ไม่มี order_number)
   - ร้าน: ใช้คอลัมน์ "Dealer Code" ในไฟล์ก่อน (ตัด 0 นำหน้า) ; ไม่มี -> map shop_name/shop_group ผ่าน Master_Dealer
   - payment = จ่ายจริง (commission - wh_tax)
   - *** ลบเฉพาะแถวของไฟล์ Housing Expert (CSV เดิม + xlsx นี้) ***
     ไม่แตะแถว SCG Home ที่ append จาก import-lhs-scghome.mjs
   - หลัง apply ต้องรัน: node scripts/backfill-rep-code.mjs  (เติม rep_code ใหม่)

   DRY RUN: node scripts/import-lhs-commission.mjs
   APPLY:   node scripts/import-lhs-commission.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app";
const HE_DIR = "commission-app/LHS Commission 2026 พนักงาน/Housing Expert";
const NEW_FILE = "summaryData_HousingExpert_2026 (1).xlsx";
const OLD_FILE = "summaryData_HousingExpert_2026(summarry_HEcommission).csv";
const SHEET = "summarry_HEcommission";
const FILE = join(HE_DIR, NEW_FILE);
const SRC = NEW_FILE;
/* ชุด source_file ของ Housing Expert ที่อนุญาตให้ลบ/แทนที่ (ไม่รวม SCG Home) */
const HE_SOURCES = [OLD_FILE, NEW_FILE];

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function parseCsv(text) {
  const rows = []; let cur = [], f = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { f+='"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ",") { cur.push(f); f=""; } else if (c === "\n") { cur.push(f); rows.push(cur); cur=[]; f=""; } else if (c === "\r") {} else f += c; }
  }
  if (f.length || cur.length) { cur.push(f); rows.push(cur); }
  return rows;
}
const str = (v) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };
const num = (v) => { if (v === undefined || v === null || v === "") return null; const n = Number(String(v).replace(/,/g, "").trim()); return Number.isFinite(n) ? n : null; };
const norm = (s) => String(s ?? "").replace(/\s+/g, "").replace(/[._]/g, "").toLowerCase().trim();
/* วันที่: Excel serial (xlsx) หรือ d/m/yyyy (csv เดิม, ค.ศ.) -> YYYY-MM-DD */
const toDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (typeof v === "number" || (Number.isFinite(n) && n > 20000 && !/[\/-]/.test(String(v)))) {
    const dt = new Date(Math.round((n - 25569) * 86400 * 1000));
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
};
/* "0005100071" -> "5100071" */
const cleanCode = (v) => { const s = String(v ?? "").trim().replace(/^0+/, ""); return s === "" ? null : s; };

/* ---- map shop -> dealer (Master_Dealer ทุกคอลัมน์ Dealer Name*) + code->name ---- */
const md = parseCsv(readFileSync(join(DIR, "Master_Dealer.csv"), "utf8"));
const mdh = md[0].map((c) => String(c).trim());
const iDName = mdh.findIndex((h) => /^Dealer Name$/i.test(h));
const iDCode = mdh.findIndex((h) => /^Dealer Code$/i.test(h));
const nameCols = mdh.map((h, i) => (/name|ชื่อ/i.test(h) ? i : -1)).filter((i) => i >= 0);
const shopMap = new Map();
const codeToName = new Map();
for (let r = 1; r < md.length; r++) {
  const code = String(md[r][iDCode] ?? "").trim();
  const nm = String(md[r][iDName] ?? "").trim();
  if (code) codeToName.set(code, nm);
  for (const c of nameCols) { const v = norm(md[r][c]); if (v) shopMap.set(v, { code, name: nm }); }
}
console.log(`shop->dealer map = ${shopMap.size} คีย์ | code->name ${codeToName.size}`);

/* ---- dealers ใน Supabase (ชื่อ + ยืนยันว่ารหัสมีจริง) ---- */
const { data: dealerRows, error: dErr } = await sb.from("dealers").select("code,name");
if (dErr) { console.error("โหลด dealers ไม่สำเร็จ:", dErr.message); process.exit(1); }
const dealerNameByCode = new Map(dealerRows.map((x) => [x.code, x.name]));

/* ---- อ่าน LHS xlsx ---- */
const wb = XLSX.read(readFileSync(FILE), { type: "buffer" });
const d = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, blankrows: false, defval: null });
const header = d[0].map((c) => String(c ?? "").replace(/\s+/g, " ").trim());
const nf = (name) => header.findIndex((h) => h === name);
const H = {
  year: nf("Year"), month: nf("Month"),
  soDate: nf("So_Created_Date"), status: nf("Status"), bpm: nf("bpm_so_status"),
  tracking: nf("Project Tracking"), order: nf("order_number"), company: nf("Company"),
  dept: nf("Department: Name"), subsol: nf("sub_solution_name_des"),
  custId: nf("Customer_ID"), custName: nf("Customer_name"),
  shopModel: nf("rept_gp_shopmodel"), region: nf("rept_sale_region_th"),
  dealerCode: nf("Dealer Code"),
  shop: nf("shop_name"), shopGroup: nf("rept_gp_shopgroup"), project: nf("Project Name"),
  projCreated: nf("project_created_name"),
  commission: header.findIndex((h) => h.toLowerCase() === "commission"),
  approve: nf("อนุมัติ/ไม่อนุมัติ"),
  vendorName: header.findIndex((h) => /Vendor Name/i.test(h)),
  vendorCode: header.findIndex((h) => /Vendor Code/i.test(h)),
  payProcess: header.findIndex((h) => /วันที่ทำจ่าย/.test(h)),
  transfer: header.findIndex((h) => /โอนเงินเข้าบัญชี/.test(h)),
  payNo: nf("Payment_Number"),
  wht: header.findIndex((h) => /w\/h tax/i.test(h)),
  payment: header.findIndex((h) => h.toLowerCase() === "payment"),
  soAmount: header.findIndex((h) => /so_amount/i.test(h)),
};
const missingCols = Object.entries(H).filter(([, v]) => v < 0).map(([k]) => k);
if (missingCols.length) { console.error("ไม่พบคอลัมน์:", missingCols.join(", ")); process.exit(1); }

const rows = [];
let grandComm = 0, grandSo = 0, grandPay = 0;
let skippedBlank = 0, byCode = 0, byName = 0, unmapped = 0, codeNameMismatch = 0, unknownCode = 0, commDealer = 0;
const perMonth = new Map();

for (let r = 1; r < d.length; r++) {
  const row = d[r]; if (!row || !row.some((c)=>String(c??"").trim()!=="")) continue;
  const year = num(row[H.year]) ?? 2026;
  const mon = num(row[H.month]);
  if (!mon) continue;
  /* แถว placeholder (มีแต่ Year/Month) ไม่มี order_number -> ข้าม */
  if (!str(row[H.order])) { skippedBlank++; continue; }
  const period = `${year}-${String(mon).padStart(2,"0")}`;

  const shop = str(row[H.shop]);
  const group = str(row[H.shopGroup]);
  /* 1) Dealer Code ในไฟล์  2) ชื่อร้านผ่าน Master_Dealer */
  const fileCode = cleanCode(row[H.dealerCode]);
  const nameKey = shop && shopMap.has(norm(shop)) ? norm(shop) : (group && shopMap.has(norm(group)) ? norm(group) : null);
  const byNameHit = nameKey ? shopMap.get(nameKey) : null;
  let dealer = null;
  if (fileCode && dealerNameByCode.has(fileCode)) {
    dealer = { code: fileCode, name: dealerNameByCode.get(fileCode) };
    byCode++;
    if (byNameHit && byNameHit.code !== fileCode) codeNameMismatch++;
  } else if (byNameHit) {
    dealer = byNameHit; byName++;
    if (fileCode) unknownCode++;
  } else { unmapped++; if (fileCode) unknownCode++; }

  const so = num(row[H.soAmount]) ?? 0;
  const comm = num(row[H.commission]) ?? 0;
  const wht = num(row[H.wht]) ?? 0;
  const pay = num(row[H.payment]) ?? 0;
  grandSo += so; grandComm += comm; grandPay += pay;
  if (dealer) commDealer += comm;

  rows.push({
    period,
    shop_name: shop,
    shop_group: group,
    shop_model: str(row[H.shopModel]),
    region: str(row[H.region]),
    dealer_code: dealer ? dealer.code : null,
    dealer_name: dealer ? dealer.name : null,
    vendor_name: str(row[H.vendorName]),
    vendor_code: str(row[H.vendorCode]),
    project_created_name: str(row[H.projCreated]),
    so_created_date: toDate(row[H.soDate]),
    status: str(row[H.status]),
    bpm_so_status: str(row[H.bpm]),
    project_tracking: str(row[H.tracking]),
    order_number: str(row[H.order]),
    company: str(row[H.company]),
    department_name: str(row[H.dept]),
    sub_solution_name: str(row[H.subsol]),
    customer_id: str(row[H.custId]),
    customer_name: str(row[H.custName]),
    project_name: str(row[H.project]),
    approve_status: str(row[H.approve]),
    pay_process_date: toDate(row[H.payProcess]),
    transfer_date: toDate(row[H.transfer]),
    payment_number: str(row[H.payNo]),
    so_amount: so,
    commission: comm,
    wh_tax: wht,
    payment: pay,
    source_file: SRC,
  });

  const pm = perMonth.get(period) ?? { rows: 0, comm: 0, pay: 0 };
  pm.rows++; pm.comm += comm; pm.pay += pay; perMonth.set(period, pm);
}

const f = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
console.log("\n===== LHS Commission (Housing Expert) ต่อเดือน =====");
[...perMonth.keys()].sort().forEach((p) => { const v = perMonth.get(p); console.log(`  ${p} | ${v.rows} แถว | commission ${f(v.comm)} | payment ${f(v.pay)}`); });
console.log(`\n  รวม = ${rows.length} แถว | so_amount ${f(grandSo)} | commission ${f(grandComm)} | payment ${f(grandPay)}`);
console.log(`  ข้ามแถวว่าง (placeholder) = ${skippedBlank}`);
console.log(`  ยอดเดิมที่ต้องคงเดิม: ส.ค. 64,835.72 + ก.ย. 137,810.48 = 202,646.20`);
const oldPart = (perMonth.get("2026-08")?.comm ?? 0) + (perMonth.get("2026-09")?.comm ?? 0);
console.log(`  ยอด ส.ค.+ก.ย. ในไฟล์ใหม่ = ${f(oldPart)} | ต่างจากเดิม ${(oldPart - 202646.20).toFixed(2)} ${Math.abs(oldPart - 202646.20) < 1 ? "✓" : "✗"}`);
console.log(`  ร้าน: ตาม Dealer Code ในไฟล์ ${byCode} | ตามชื่อร้าน ${byName} | map ไม่ได้ ${unmapped} | รหัสในไฟล์ที่ไม่พบใน dealers ${unknownCode}`);
console.log(`  Dealer Code vs ชื่อร้าน ขัดแย้งกัน ${codeNameMismatch} แถว | commission ที่ map ร้านได้ ${f(commDealer)} (${((commDealer/grandComm)*100||0).toFixed(1)}%)`);

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

console.log(`\nAPPLY: ลบเฉพาะแถว Housing Expert (source_file = ${HE_SOURCES.join(" | ")}) แล้ว insert ใหม่ — ไม่แตะ SCG Home`);
{ const { error } = await sb.from("lhs_commission_lines").delete().in("source_file", HE_SOURCES); if (error) { console.error("delete ล้มเหลว:", error.message); process.exit(1); } }
const CHUNK = 500; let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const { error } = await sb.from("lhs_commission_lines").insert(rows.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert ล้มเหลว:", error.message); process.exit(1); }
  done += Math.min(CHUNK, rows.length - i); process.stdout.write(`\r  insert ${done}/${rows.length}`);
}
console.log(`\nDONE lines=${rows.length}`);
console.log("*** อย่าลืมรัน: node scripts/backfill-rep-code.mjs เพื่อเติม rep_code ***");
