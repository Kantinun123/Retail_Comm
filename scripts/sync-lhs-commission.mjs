/* Sync LHS Commission (ผลประโยชน์พนักงานร้าน) จาก SharePoint -> lhs_commission_lines
   -------------------------------------------------------------
   ไฟล์ต้นทาง (โฟลเดอร์ "RSS  System - commission" ที่ sync ลงเครื่องผ่าน OneDrive):
   - --kind he      : summaryData_HousingExpert_2026.xlsx  ชีต "summarry_HEcommission"
   - --kind scghome : summaryData_SCGHome_2026.xlsx        ชีต "rawData"
   ทั้งสองไฟล์เป็นข้อมูลสะสมทั้งปี -> แทนที่ข้อมูลของ kind นั้นทั้งชุด (ไม่แตะอีก kind)

   กติกา:
   - period = คอลัมน์ Year/Month ของไฟล์ (เดือนที่ทีมเจ้าของไฟล์จัดรอบจ่าย)
   - ร้าน = Dealer Code ในไฟล์ (ตัด 0 นำหน้า) ที่มีจริงในตาราง dealers ; ไม่มี -> ชื่อร้านผ่าน master_aliases
   - rep_code = Vendor Code (พนักงาน) -> sale_reps.netsuite_id (ไม่ต้องรัน backfill-rep-code แยก)
   - HE: W/H Tax / Payment เป็นรายแถว ใช้ตามไฟล์
   - SCG Home: W/H Tax / Payment ในไฟล์เป็นยอดรวมต่อใบสำคัญจ่าย (ซ้ำทุกแถวของคนเดียวกัน) รวมไม่ได้
     -> คำนวณรายแถว: wh_tax = commission*3% , payment = commission*97% (เหมือนสคริปต์เดิม)
   - ข้ามแถวที่ไม่มีเลข order/SO (แถว placeholder)
   - ปลอดภัย: insert ชุดใหม่ก่อน แล้วค่อยลบแถวชุดเดิม (ไม่มีช่วงที่ข้อมูลหาย)
     guard: จำนวนแถวหรือยอด commission ลดเกิน 30% -> หยุด exit 2 (ใช้ --force เพื่อข้าม)

   DRY RUN: node scripts/sync-lhs-commission.mjs --kind he|scghome [--file <path>]
   APPLY:   node scripts/sync-lhs-commission.mjs --kind he|scghome --apply
*/
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const KIND = arg("--kind");
const SP_DIR = "D:/OneDrive - The Siam Cement Public Company Limited/RSS  System - commission/";
const CFG = {
  he: {
    file: SP_DIR + "summaryData_HousingExpert_2026.xlsx",
    sheet: "summarry_HEcommission",
    /* source_file เดิมทั้งหมดของ Housing Expert (CSV/xlsx ที่เคยนำเข้ามือ) */
    ownsSource: (s) => /^summaryData_HousingExpert/i.test(s),
  },
  scghome: {
    file: SP_DIR + "summaryData_SCGHome_2026.xlsx",
    sheet: "rawData",
    ownsSource: (s) => /^summaryData_SCGHome/i.test(s) || /^SCG Home_/i.test(s),
  },
};
if (!CFG[KIND]) { console.error("ต้องระบุ --kind he | scghome"); process.exit(1); }
const cfg = CFG[KIND];
const FILE = arg("--file") ?? cfg.file;
const SRC = basename(FILE);

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const str = (v) => { const s = String(v ?? "").trim(); return s === "" || /^#N\/A$/i.test(s) ? null : s; };
const num = (v) => { if (v === undefined || v === null || v === "") return null; const n = Number(String(v).replace(/,/g, "").trim()); return Number.isFinite(n) ? n : null; };
const norm = (s) => String(s ?? "").replace(/\s+/g, "").replace(/[._]/g, "").toLowerCase().trim();
const round2 = (n) => Math.round(n * 100) / 100;
const cleanCode = (v) => { const s = String(v ?? "").trim().replace(/^0+/, ""); return s === "" ? null : s; };
/* Excel serial / d/m/yyyy / yyyy-mm-dd -> YYYY-MM-DD */
const toDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" && v > 20000) {
    const dt = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

async function pageAll(table, select, orderCol = "id") {
  const out = []; const SIZE = 1000;
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await sb.from(table).select(select).order(orderCol).range(from, from + SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < SIZE) break;
  }
  return out;
}

/* ---- master: dealers, aliases, sale_reps ---- */
const { data: dealerRows, error: dErr } = await sb.from("dealers").select("code,name");
if (dErr) { console.error("โหลด dealers ไม่สำเร็จ:", dErr.message); process.exit(1); }
const dealerName = new Map(dealerRows.map((d) => [d.code, d.name]));
/* ชื่อร้าน -> รหัส (ใช้เมื่อแถวไม่มี Dealer Code): dealers.name + master_aliases(ba_channel) + Master_Dealer.csv (ถ้ามีในเครื่อง) */
const aliasMap = new Map();
for (const d of dealerRows) if (d.name) aliasMap.set(norm(d.name), d.code);
{
  const { data } = await sb.from("master_aliases").select("alias,value").eq("kind", "ba_channel");
  for (const a of data ?? []) if (a.alias && a.value) aliasMap.set(norm(a.alias), String(a.value));
}
if (existsSync("commission-app/Master_Dealer.csv")) {
  const lines = readFileSync("commission-app/Master_Dealer.csv", "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.split(","));
  const h = lines[0].map((c) => c.trim());
  const iCode = h.findIndex((x) => /^Dealer Code$/i.test(x));
  const nameCols = h.map((x, i) => (/name|ชื่อ/i.test(x) ? i : -1)).filter((i) => i >= 0);
  for (const l of lines.slice(1)) {
    const code = String(l[iCode] ?? "").trim();
    if (code) for (const c of nameCols) { const k = norm(l[c]); if (k) aliasMap.set(k, code); }
  }
}
const repByNetsuite = new Map();
for (const r of await pageAll("sale_reps", "rep_code,netsuite_id", "rep_code")) {
  if (r.netsuite_id) repByNetsuite.set(String(r.netsuite_id).trim(), r.rep_code);
}

/* ---- อ่านไฟล์ ---- */
const wb = XLSX.read(readFileSync(FILE), { type: "buffer" });
if (!wb.Sheets[cfg.sheet]) { console.error(`ไม่พบชีต "${cfg.sheet}" ใน ${SRC}`); process.exit(1); }
const d = XLSX.utils.sheet_to_json(wb.Sheets[cfg.sheet], { header: 1, blankrows: false, defval: null, raw: true });
const header = d[0].map((c) => String(c ?? "").replace(/\s+/g, " ").trim());
const col = (re) => header.findIndex((h) => (typeof re === "string" ? h === re : re.test(h)));

const C = KIND === "he" ? {
  year: col("Year"), month: col("Month"), soDate: col("So_Created_Date"), status: col("Status"),
  bpm: col("bpm_so_status"), tracking: col("Project Tracking"), order: col("order_number"),
  company: col("Company"), dept: col("Department: Name"), subsol: col("sub_solution_name_des"),
  custId: col("Customer_ID"), custName: col("Customer_name"), shopModel: col("rept_gp_shopmodel"),
  region: col("rept_sale_region_th"), dealerCode: col("Dealer Code"), shop: col("shop_name"),
  shopGroup: col("rept_gp_shopgroup"), project: col("Project Name"), projCreated: col("project_created_name"),
  soAmount: col(/^so_amount/i), commission: col(/^commission$/i), approve: col("อนุมัติ/ไม่อนุมัติ"),
  vName: col(/Vendor Name/i), vCode: col(/Vendor Code/i), payProcess: col(/วันที่ทำจ่าย/),
  transfer: col(/โอนเงินเข้าบัญชี/), payNo: col("Payment_Number"), wht: col(/^w\/h tax$/i), payment: col(/^payment$/i),
} : {
  year: col("Year"), month: col("Month"), soDate: col("SO_Date"), order: col("SO No"),
  tracking: col("Job No"), dept: col("Department: Name"), project: col("Project Name"), region: col("Region"),
  shop: col("Shop_Name"), shopGroup: col("Dealer_name"), dealerCode: col("Dealer_Code"),
  solution: col("Solution"), item: col("Type_SKU"), custId: col("Netsuite Customer Code"), custName: col("Cust_Name"),
  soAmount: col("TH Subtotal Amount Exc Vat"), commission: col("Commission_พนักงานร้าน"), approve: col("อนุมัติ/ไม่อนุมัติ"),
  vName: col(/Vendor Name/i), vCode: col(/Vendor Code/i), payProcess: col(/วันที่ทำจ่าย/),
  transfer: col(/โอนเงินเข้าบัญชี/), payNo: col("Payment_Number"),
};
const missing = Object.entries(C).filter(([, v]) => v < 0).map(([k]) => k);
if (missing.length) { console.error(`ไม่พบคอลัมน์ใน ${SRC}:`, missing.join(", ")); process.exit(1); }

const rows = [];
const perMonth = new Map();
let skipped = 0, byCode = 0, byAlias = 0, unmapped = 0, withRep = 0, noVendor = 0;
const unmappedNames = new Map();
for (let r = 1; r < d.length; r++) {
  const row = d[r];
  if (!row || !row.some((c) => String(c ?? "").trim() !== "")) continue;
  const year = num(row[C.year]); const mon = num(row[C.month]);
  const order = str(row[C.order]);
  if (!year || !mon || !order) { skipped++; continue; }
  const period = `${year}-${String(mon).padStart(2, "0")}`;

  const shop = str(row[C.shop]); const group = str(row[C.shopGroup]);
  let code = cleanCode(row[C.dealerCode]);
  if (code && dealerName.has(code)) byCode++;
  else {
    code = aliasMap.get(norm(shop)) ?? aliasMap.get(norm(group)) ?? null;
    if (code && dealerName.has(code)) byAlias++;
    else { code = null; unmapped++; const k = shop ?? group ?? "(ว่าง)"; unmappedNames.set(k, (unmappedNames.get(k) ?? 0) + 1); }
  }

  const vcode = str(row[C.vCode]);
  const rep = vcode ? repByNetsuite.get(vcode) ?? null : null;
  if (rep) withRep++;
  if (!vcode) noVendor++;
  const comm = num(row[C.commission]) ?? 0;
  const wht = KIND === "he" ? num(row[C.wht]) ?? 0 : round2(comm * 0.03);
  const pay = KIND === "he" ? num(row[C.payment]) ?? 0 : round2(comm * 0.97);

  rows.push({
    period,
    shop_name: shop,
    shop_group: group,
    shop_model: KIND === "he" ? str(row[C.shopModel]) : "SCG Home",
    region: str(row[C.region]),
    dealer_code: code,
    dealer_name: code ? dealerName.get(code) : null,
    vendor_name: str(row[C.vName]),
    vendor_code: vcode,
    rep_code: rep,
    project_created_name: KIND === "he" ? str(row[C.projCreated]) : null,
    so_created_date: toDate(row[C.soDate]),
    status: KIND === "he" ? str(row[C.status]) : null,
    bpm_so_status: KIND === "he" ? str(row[C.bpm]) : null,
    project_tracking: str(row[C.tracking]),
    order_number: order,
    company: KIND === "he" ? str(row[C.company]) : "SCG Home",
    department_name: str(row[C.dept]),
    sub_solution_name: KIND === "he" ? str(row[C.subsol]) : str(row[C.item]) ?? str(row[C.solution]),
    customer_id: str(row[C.custId]),
    customer_name: str(row[C.custName]),
    project_name: str(row[C.project]),
    approve_status: str(row[C.approve]),
    pay_process_date: toDate(row[C.payProcess]),
    transfer_date: toDate(row[C.transfer]),
    payment_number: str(row[C.payNo]),
    so_amount: num(row[C.soAmount]) ?? 0,
    commission: comm,
    wh_tax: wht,
    payment: pay,
    source_file: SRC,
  });
  const pm = perMonth.get(period) ?? { n: 0, comm: 0, mapped: 0, paid: 0 };
  pm.n++; pm.comm += comm; if (code) pm.mapped += comm; if (toDate(row[C.transfer])) pm.paid++;
  perMonth.set(period, pm);
}

/* ---- เทียบกับข้อมูลเดิมใน DB ---- */
const existing = (await pageAll("lhs_commission_lines", "id,source_file,period,commission")).filter((x) => cfg.ownsSource(x.source_file));
const oldComm = existing.reduce((s, x) => s + Number(x.commission ?? 0), 0);
const newComm = rows.reduce((s, x) => s + x.commission, 0);
const oldPer = new Map();
for (const x of existing) { const v = oldPer.get(x.period) ?? { n: 0, comm: 0 }; v.n++; v.comm += Number(x.commission ?? 0); oldPer.set(x.period, v); }

const f = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
console.log(`===== LHS Commission ${KIND === "he" ? "Housing Expert" : "SCG Home"} : ${SRC} =====`);
const periods = [...new Set([...perMonth.keys(), ...oldPer.keys()])].sort();
for (const p of periods) {
  const n = perMonth.get(p); const o = oldPer.get(p);
  console.log(`  ${p} | ไฟล์ ${n?.n ?? 0} แถว ${f(n?.comm ?? 0)} (โอนแล้ว ${n?.paid ?? 0}) | เดิม ${o?.n ?? 0} แถว ${f(o?.comm ?? 0)}`);
}
console.log(`  รวม: ไฟล์ ${rows.length} แถว ${f(newComm)} | เดิม ${existing.length} แถว ${f(oldComm)} | ข้ามแถวว่าง ${skipped}`);
console.log(`  ร้าน: Dealer Code ${byCode} | ชื่อร้าน ${byAlias} | map ไม่ได้ ${unmapped}${unmappedNames.size ? " -> " + [...unmappedNames].map(([k, v]) => `${k}(${v})`).join(", ") : ""}`);
console.log(`  พนักงาน: ผูก rep_code ได้ ${withRep}/${rows.length} | ไม่มี Vendor Code ${noVendor}`);

if (!rows.length) { console.error("หยุด: ไฟล์ไม่มีข้อมูล"); process.exit(2); }
const dropRows = existing.length ? 1 - rows.length / existing.length : 0;
const dropComm = oldComm > 0 ? 1 - newComm / oldComm : 0;
if (!FORCE && (dropRows > 0.3 || dropComm > 0.3)) {
  console.error(`หยุด: ข้อมูลลดผิดปกติ (แถว -${(dropRows * 100).toFixed(0)}%, commission -${(dropComm * 100).toFixed(0)}%) ใช้ --force ถ้าตั้งใจ`);
  process.exit(2);
}
if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

/* insert ชุดใหม่ก่อน แล้วลบชุดเดิม (ถ้า insert พัง ชุดเดิมยังอยู่ครบ) */
const newIds = [];
for (let i = 0; i < rows.length; i += 500) {
  const { data, error } = await sb.from("lhs_commission_lines").insert(rows.slice(i, i + 500)).select("id");
  if (error) {
    console.error("insert ล้มเหลว:", error.message);
    if (newIds.length) await sb.from("lhs_commission_lines").delete().in("id", newIds);
    process.exit(1);
  }
  newIds.push(...data.map((x) => x.id));
}
const oldIds = existing.map((x) => x.id);
for (let i = 0; i < oldIds.length; i += 500) {
  const { error } = await sb.from("lhs_commission_lines").delete().in("id", oldIds.slice(i, i + 500));
  if (error) { console.error("ลบชุดเดิมล้มเหลว (ข้อมูลอาจซ้ำ ต้องตรวจ):", error.message); process.exit(1); }
}
console.log(`DONE ${KIND}: ${rows.length} แถว commission ${f(newComm)} (เดิม ${existing.length} แถว ${f(oldComm)})`);
