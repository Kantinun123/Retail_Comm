/* นำเข้า LHS Commission SCG Home -> lhs_commission_lines (APPEND ต่อจาก Housing Expert)
   - sheet "สรุปรายการจ่าย" (header R1, data R2+), 20 แถว
   - commission = Commission_พนักงานร้าน ; payment = commission*0.97 ; wh_tax = commission*0.03
   - so_amount = TH Subtotal Amount Exc Vat
   - ร้าน: map Dealer Name -> dealer ผ่าน Master_Dealer
   - transfer_date = DUE_DATE (join SO No = Ref. Order Number จากไฟล์ AP Bulk)
   - *** APPEND *** ลบเฉพาะ source_file ของ SCG Home ก่อน (idempotent) ไม่แตะ Housing Expert

   DRY RUN: node scripts/import-lhs-scghome.mjs
   APPLY:   node scripts/import-lhs-scghome.mjs --apply
*/
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app";
const SCGDIR = "commission-app/LHS Commission 2026 พนักงาน/SCG Home";
const AP_FILE = "Copy of SCG Home_Template AP Bulk_Comission Netsuite LHS_20260930JV.xlsx";
const SRC = "SCG Home_สรุปรายการจ่าย_ก.ย.69";

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
const num = (v) => { if (v===undefined||v===null||v==="") return null; const n = Number(String(v).replace(/,/g,"").trim()); return Number.isFinite(n)?n:null; };
const norm = (s) => String(s ?? "").replace(/\s+/g,"").replace(/[._]/g,"").toLowerCase().trim();
const round2 = (n) => Math.round(n * 100) / 100;
const serialToDate = (v) => {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) { const dt = new Date(Math.round((n-25569)*86400*1000)); if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0,10); }
  const m = String(v??"").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : null;
};

/* ---- map Dealer Name -> dealer (Master_Dealer ทุกคอลัมน์ Dealer Name*) ---- */
const md = parseCsv(readFileSync(join(DIR, "Master_Dealer.csv"), "utf8"));
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

/* manual override: ชื่อร้านในไฟล์สะกดต่างจาก Master_Dealer เล็กน้อย
   "เอสซีจี โฮม บุญถาวรเซ็นทรัลโฮม (หัวทะเล)" (ไฟล์) = "เอสซีจี โฮม เซ็นทรัลโฮม (หัวทะเล)" (Master, code 3052659) */
const OVERRIDE = {
  "เอสซีจี โฮม บุญถาวรเซ็นทรัลโฮม (หัวทะเล)": "3052659",
};
for (const [fileName, code] of Object.entries(OVERRIDE)) {
  const hit = shopMap.get(norm(`เอสซีจี โฮม เซ็นทรัลโฮม (หัวทะเล)`)); // ดึงชื่อ dealer จริงจาก code เดียวกัน
  shopMap.set(norm(fileName), { code, name: hit ? hit.name : fileName });
}

/* ---- AP Bulk: Ref Order -> DUE_DATE ---- */
const apwb = XLSX.read(readFileSync(join(SCGDIR, AP_FILE)), { type: "buffer" });
const ap = XLSX.utils.sheet_to_json(apwb.Sheets["Template _Netsuite Upload"], { header: 1, blankrows: false });
const apH = ap[0].map((c)=>String(c??"").trim());
const iDue = apH.indexOf("DUE_DATE");
const iRef = apH.findIndex((h)=>/Ref\. Order Number/i.test(h));
const dueMap = new Map();
for (let r=1;r<ap.length;r++){ const ref=String(ap[r][iRef]??"").trim(); if(ref && !dueMap.has(ref)) dueMap.set(ref, ap[r][iDue]); }

/* ---- สรุปรายการจ่าย ---- */
const mainFile = readdirSync(SCGDIR).find((f) => /สำหรับใช้ปิดบัญชี/.test(f) && f.endsWith(".xlsx"));
const wb = XLSX.read(readFileSync(join(SCGDIR, mainFile)), { type: "buffer" });
const d = XLSX.utils.sheet_to_json(wb.Sheets["สรุปรายการจ่าย"], { header: 1, blankrows: false });
const H = d[1].map((c)=>String(c??"").trim());  // header R1
const col = (name) => H.indexOf(name);
const C = {
  payDate: col("Payment_Date"), soDate: col("SO_Date"), soNo: col("SO No"),
  dept: col("Department: Name"), project: col("Project Name"), region: col("Region"),
  shopName: col("Shop_Name"), dealerName2: col("Dealer_name"), dealerName: col("Dealer Name"),
  solution: col("Solution"), jobType: col("Job_Type"), itemName: col("Item Name"),
  docNo: col("Document Number"), custName: col("Cust_Name"),
  subExVat: col("TH Subtotal Amount Exc Vat"), comm: col("Commission_พนักงานร้าน"),
  approve: col("อนุมัติ/ไม่อนุมัติ"),
  vName: col("Vendor Name (พนักงาน)"), vCode: col("Vendor Code (พนักงาน)"),
};

const rows = [];
let grandComm = 0, grandSo = 0, grandPay = 0, dealerHit = 0;
const perMonth = new Map();
for (let r = 2; r < d.length; r++) {
  const row = d[r]; if (!row || !row.some((c)=>String(c??"").trim()!=="")) continue;
  const comm = num(row[C.comm]) ?? 0;
  const vcode = str(row[C.vCode]);
  if (comm === 0 && !vcode) continue;

  const pd = serialToDate(row[C.payDate]) || serialToDate(row[C.soDate]);
  const period = pd ? pd.slice(0,7) : "2026-09";
  const dealerNameRaw = str(row[C.dealerName]);
  const key = dealerNameRaw && shopMap.has(norm(dealerNameRaw)) ? norm(dealerNameRaw) : null;
  const dealer = key ? shopMap.get(key) : null;
  if (dealer) dealerHit++;

  const soNo = str(row[C.soNo]);
  const due = soNo && dueMap.has(soNo) ? serialToDate(dueMap.get(soNo)) : null;
  const so = num(row[C.subExVat]) ?? 0;
  const wht = round2(comm * 0.03);
  const pay = round2(comm * 0.97);
  grandComm += comm; grandSo += so; grandPay += pay;

  rows.push({
    period,
    shop_name: dealerNameRaw,
    shop_group: str(row[C.dealerName2]),
    shop_model: "SCG Home",
    region: str(row[C.region]),
    dealer_code: dealer ? dealer.code : null,
    dealer_name: dealer ? dealer.name : null,
    vendor_name: str(row[C.vName]),
    vendor_code: vcode,
    project_created_name: null,
    so_created_date: serialToDate(row[C.soDate]),
    status: null,
    bpm_so_status: null,
    project_tracking: null,
    order_number: soNo,
    company: "SCG Home",
    department_name: str(row[C.dept]),
    sub_solution_name: str(row[C.solution]) || str(row[C.itemName]),
    customer_id: null,
    customer_name: str(row[C.custName]),
    project_name: str(row[C.project]),
    approve_status: str(row[C.approve]),
    pay_process_date: serialToDate(row[C.payDate]),
    transfer_date: due,
    payment_number: str(row[C.docNo]),
    so_amount: so,
    commission: comm,
    wh_tax: wht,
    payment: pay,
    source_file: SRC,
  });
  const pm = perMonth.get(period) ?? { rows:0, comm:0, pay:0 };
  pm.rows++; pm.comm+=comm; pm.pay+=pay; perMonth.set(period, pm);
}

const f = (n) => n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
console.log("===== SCG Home (append เข้า lhs_commission_lines) =====");
[...perMonth.keys()].sort().forEach((p)=>{ const v=perMonth.get(p); console.log(`  ${p} | ${v.rows} แถว | commission ${f(v.comm)} | payment ${f(v.pay)}`); });
console.log(`\n  รวม = ${rows.length} แถว | so_amount ${f(grandSo)} | commission ${f(grandComm)} | payment ${f(grandPay)}`);
console.log(`  เป้า commission = 21,669.75 | ต่าง ${(grandComm-21669.75).toFixed(2)} ${Math.abs(grandComm-21669.75)<1?"✓":"✗"}`);
console.log(`  ร้าน (Dealer Name->dealer): ${dealerHit}/${rows.length} แถว`);
console.log(`  transfer_date (DUE): ${rows.filter(r=>r.transfer_date).length}/${rows.length}`);

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง (APPEND)"); process.exit(0); }

console.log("\nAPPLY: ลบเฉพาะ source_file SCG Home เดิม (ถ้ามี) แล้ว insert ...");
{ const { error } = await sb.from("lhs_commission_lines").delete().eq("source_file", SRC); if (error) { console.error("delete ล้มเหลว:", error.message); process.exit(1); } }
const { error } = await sb.from("lhs_commission_lines").insert(rows);
if (error) { console.error("insert ล้มเหลว:", error.message); process.exit(1); }
console.log(`DONE insert SCG Home = ${rows.length} แถว (append)`);
