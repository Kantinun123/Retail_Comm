/* นำเข้ายอดขายงานบริการ -> service_sales_lines
   -------------------------------------------------------------
   - ไฟล์: ยอดขายทั้งหมด/ยอดขายงานบริการ LHS_Rudy ร้านค้า/win_contract_all.xlsx
   - ยอด = plan_amount_incl_vat (รวม VAT) ใช้ทุกสถานะ (win ทั้งหมด)
   กติกาตามรายงาน Power BI ของทีม (ตรวจ ม.ค.-ต.ค. 68/69: LY ตรง 334/374 ร้าน×เดือน ยอดรวม 254.13 / PBI 253.50 ล้าน)
   - ร้าน: channel_detail_name -> dealers/Master_Dealer (normalize + OVERRIDE) ; ไม่เจอค่อยใช้ rept_gp_shopgroup -> Master_Dealer
     * map ไม่เจอ => dealer_code = null (เก็บไว้ให้ admin เห็น "ไม่ระบุร้าน")
   - period: จาก order_created_date (YYYY-MM) ; ไม่มีค่อยใช้ project_close_date ; ข้ามแถวที่ไม่มีทั้งคู่
   - เก็บ report_gp_buildingtype ไว้ใน building_type ; view service_sales_union นับเฉพาะ OB / NONRES (HP, TP, RES — Power BI ไม่นับ)
   - 3 กลุ่มใหญ่: ROOF SERVICE / SMART SOLUTION / Qchang (ปัด OTHER ทิ้ง)
   - sync แบบ diff (ลายเซ็นทั้งแถว + จำนวนครั้ง) ไม่ล้างตาราง ; กันพังถ้าแถว/ยอดลดเกิน 30%

   DRY RUN: node scripts/import-service-sales.mjs [--file <path>]
   APPLY:   node scripts/import-service-sales.mjs --apply [--file <path>] [--force]
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

/* ---- channel_detail_name -> dealer (normalize แบบเดียวกับ sync-design-intake / import-sales-targets) ---- */
const normA = (s) => String(s ?? "").normalize("NFC")
  .replace(/บจก\.?|บริษัท|หจก\.?|ห้างหุ้นส่วนจำกัด|บ\.|จก\.?|จำกัด|\(มหาชน\)/g, " ")
  .replace(/เอสซีจี\s*โฮม|เอสซีจีโฮม|scg\s*home/gi, " ")
  .replace(/วัตถุ/g, "วัสดุ").replace(/[\s.\-_()]/g, "").toLowerCase();
const { data: dealerRows, error: dErr } = await sb.from("dealers").select("code,name");
if (dErr) { console.error("โหลด dealers ไม่สำเร็จ:", dErr.message); process.exit(1); }
const dealerName = new Map(dealerRows.map((x) => [x.code, x.name]));
const chAlias = new Map();
const addA = (n, c) => { const k = normA(n); if (!k || !dealerName.has(c)) return; (chAlias.get(k) ?? chAlias.set(k, new Set()).get(k)).add(c); };
dealerRows.forEach((x) => addA(x.name, x.code));
for (let r = 1; r < md.length; r++) { const code = String(md[r][iDCode] ?? "").trim(); for (const c of nameCols) if (String(md[r][c] ?? "").trim()) addA(md[r][c], code); }
const CH_OVERRIDE = new Map([
  ["บจก.แม็กซ์โฮม แอนด์ เดคคอร์", "5100967"],
  ["เอสซีจี โฮม แม็กซ์โฮมแอนด์เดคคอร์", "5100967"],
  ["เอสซีจี โฮม สหะชัยรีเทล (บ้านนา)", "5100974"],
  ["บริษัท นพดลพานิช จำกัด สาขา 00001", "5101685"],
  ["บจก.นพดลพานิช โฮมเอ็กซ์เปิร์ท", "5101685"],
  ["เอสซีจี โฮม แสงอุปกรณ์ (เมืองสุโขทัย)", "5100163"],
  ["เอสซีจี โฮม บุญถาวร เมืองขอนแก่น", "5100967"],
]);
const mapChannel = (n) => { if (!n) return null; if (CH_OVERRIDE.has(n)) return CH_OVERRIDE.get(n); const z = chAlias.get(normA(n)); return z && z.size === 1 ? [...z][0] : null; };
const BUILDING_KEEP = new Set(["OB", "NONRES"]);

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
let dealerHit = 0, skipNoGroup = 0, skipNoDate = 0, skipBuilding = 0;
const grp = new Map();
for (let r = 1; r < d.length; r++) {
  const row = d[r]; if (!row) continue;
  const closeDate = serialToDate(G(row, "project_close_date"));
  const orderDate = serialToDate(G(row, "order_created_date"));
  const monthDate = orderDate ?? closeDate;          // Power BI จัดเดือนตามวันที่สร้าง order
  if (!monthDate) { skipNoDate++; continue; }
  // เก็บทุก building type ไว้ในตาราง ; view service_sales_union กรองเฉพาะ OB/NONRES (ตาม Power BI)
  const bType = S(row, "report_gp_buildingtype") || null;
  if (!BUILDING_KEEP.has(bType)) skipBuilding++;
  const h3 = S(row, "H3"), h4 = S(row, "H4"), h5 = S(row, "H5");
  const group3 = groupOf(h3.toUpperCase(), h5.toUpperCase());
  if (!group3) { skipNoGroup++; continue; }

  const amt = Number(G(row, "plan_amount_incl_vat") ?? 0) || 0;
  const shop = S(row, "rept_gp_shopgroup");
  const chDetail = S(row, "channel_detail_name");
  const chCode = mapChannel(chDetail);
  const hit = chCode ? { code: chCode, name: dealerName.get(chCode) } : shopMap.get(norm(shop));
  if (hit) dealerHit++;

  // sub_group: ROOF SERVICE/SMART SOLUTION ใช้ H4, Qchang ใช้ H5 (ละเอียดกว่า)
  const subGroup = group3 === "Qchang" ? (h5 || h4 || null) : (h4 || h3 || null);

  rows.push({
    period: monthDate.slice(0, 7),
    close_date: closeDate,
    order_date: orderDate,
    building_type: bType,
    channel_detail: chDetail || null,
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
console.log(`\nแถวที่นำเข้า = ${rows.length} | ข้าม(ไม่มีวันที่) ${skipNoDate} | building type ไม่ใช่ OB/NONRES (เก็บไว้แต่ไม่นับ) ${skipBuilding} | ข้าม(OTHER) ${skipNoGroup}`);
console.log(`map ร้านเจอ = ${dealerHit}/${rows.length} | ไม่ระบุร้าน = ${rows.length - dealerHit}`);
console.log("3-group:");
[...grp.entries()].sort((a, b) => b[1].amt - a[1].amt).forEach(([k, v]) => console.log(`  ${k}: ${v.n} แถว | ${f(v.amt)}`));

/* ---- sync แบบ diff (ไม่ล้างตาราง) ----
   project_number ซ้ำได้ จึงใช้ "ลายเซ็นทั้งแถว" + จำนวนครั้ง (multiset):
   แถวที่เหมือนเดิมไม่แตะ (rep_code คงอยู่) ; ลบเฉพาะที่หายไป/เปลี่ยน ; เพิ่มเฉพาะที่ใหม่ */
const SIG_FIELDS = ["period", "close_date", "order_date", "building_type", "channel_detail", "dealer_code", "dealer_name", "shop_group", "region", "group3", "sub_group", "h3", "h4", "h5",
  "solution_name", "sub_solution_name", "project_name", "sales_name", "project_number", "province_name", "amount_incl_vat"];
const sigOf = (x) => SIG_FIELDS.map((k) => (k === "amount_incl_vat" ? Number(x[k] ?? 0).toFixed(2) : x[k] ?? "")).join("\u0001");
const db = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("service_sales_lines").select(["id", ...SIG_FIELDS].join(",")).order("id").range(from, from + 999);
  if (error) { console.error("อ่านฐานข้อมูลไม่สำเร็จ:", error.message); process.exit(1); }
  db.push(...data); if (data.length < 1000) break;
}
const dbBySig = new Map();
db.forEach((x) => { const k = sigOf(x); const a = dbBySig.get(k) ?? []; a.push(x.id); dbBySig.set(k, a); });
const toInsert = [];
const fileCount = new Map();
rows.forEach((x) => { const k = sigOf(x); fileCount.set(k, (fileCount.get(k) ?? 0) + 1); });
const toDeleteIds = [];
for (const [k, ids] of dbBySig) { const keep = fileCount.get(k) ?? 0; if (ids.length > keep) toDeleteIds.push(...ids.slice(keep)); }
{ const used = new Map(); rows.forEach((x) => { const k = sigOf(x); const n = (used.get(k) ?? 0) + 1; used.set(k, n); if (n > (dbBySig.get(k)?.length ?? 0)) toInsert.push(x); }); }
const dbTotal = db.reduce((a, x) => a + Number(x.amount_incl_vat ?? 0), 0);
const newTotal = rows.reduce((a, x) => a + x.amount_incl_vat, 0);
console.log(`\nฐานข้อมูล: ${db.length} แถว ${f(dbTotal)} → เพิ่ม ${toInsert.length} | ลบ ${toDeleteIds.length} | หลัง sync ${rows.length} แถว ${f(newTotal)}`);
const FORCE = process.argv.includes("--force");
if (db.length && (rows.length < db.length * 0.7 || newTotal < dbTotal * 0.7) && !FORCE) {
  console.error("หยุด: จำนวนแถว/ยอดลดลงเกิน 30% — ไฟล์อาจไม่ครบ ใช้ --force ถ้าตั้งใจ");
  process.exit(2);
}

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }

const CHUNK = 1000;
for (let i = 0; i < toInsert.length; i += CHUNK) {
  const { error } = await sb.from("service_sales_lines").insert(toInsert.slice(i, i + CHUNK));
  if (error) { console.error("\ninsert:", error.message); process.exit(1); }
  process.stdout.write(`\r  insert ${Math.min(i + CHUNK, toInsert.length)}/${toInsert.length}`);
}
for (let i = 0; i < toDeleteIds.length; i += 500) {
  const { error } = await sb.from("service_sales_lines").delete().in("id", toDeleteIds.slice(i, i + 500));
  if (error) { console.error("\ndelete:", error.message); process.exit(1); }
}
console.log(`\nDONE: เพิ่ม ${toInsert.length} | ลบ ${toDeleteIds.length} | service_sales_lines=${rows.length}`);
// ผูกพนักงาน (rep_code) ให้แถวใหม่
{ const { data, error } = await sb.rpc("refresh_service_sales_reps"); console.log(error ? `refresh reps ไม่สำเร็จ: ${error.message}` : `refresh reps: ${JSON.stringify(data)}`); }
