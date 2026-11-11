/* Sync แบบรับเข้า จาก CRM Opportunity (crm_trn_opportunity.xlsx) -> design_intake_lines
   -------------------------------------------------------------
   - ต้นทาง: ไฟล์ xlsx (ดีฟอลต์ commission-app/ยอดขายทั้งหมด/แบบรับเข้า/crm_trn_opportunity.xlsx หรือ --file <path>)
     ภายหลังชี้ไปโฟลเดอร์ SharePoint ที่ sync ลงเครื่อง
   - ขอบเขต: (BU = Housing Expert (GT) / SCG Home Retail (JV) หรือ ร้านผู้สร้างเป็นร้าน HE/SCG Home) และ crm_created_date >= 2025-01-01
   - เดือน = crm_created_date (ตามรายงาน Power BI ; start_date ในไฟล์ส่วนใหญ่ว่าง/1899/ปี พ.ศ.)
   - ตัวกรอง: service_solution ต้องอยู่ในรายการ SERVICE_SOLUTION_KEEP (ตาม Power BI) ไม่งั้น design_type = null (ไม่นับ)
   - design_type: material = service_category หรือ service_sub_solution มี "ถอดแบบประมาณการ"/"ออกแบบประมาณการ"
                  solution = งานบริการอื่นที่มี service_sub_solution ; null = ไม่มีข้อมูลงานบริการ
   - ร้าน: created_by_group_name -> dealers ด้วยชื่อทุกคอลัมน์ใน Master_Dealer.csv (+ ชื่อในระบบ)
   - พนักงาน: crm_created_name -> sale_reps.email (เทียบทั้งอีเมลเต็มและส่วนหน้า @)
   - sync ด้วย opp_id: เพิ่ม / แก้ / ลบ (ในขอบเขต) ; กันพังถ้าจำนวนแถวลดเกิน 30%

   DRY RUN: node scripts/sync-design-intake.mjs [--file <path>]
   APPLY:   node scripts/sync-design-intake.mjs --apply [--force]
*/
import { readFileSync, statSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const fIdx = process.argv.indexOf("--file");
const FILE = fIdx > -1 ? process.argv[fIdx + 1] : "commission-app/ยอดขายทั้งหมด/แบบรับเข้า/crm_trn_opportunity.xlsx";
const SINCE = "2025-01-01";
const BUS = new Set(["Housing Expert (GT)", "SCG Home Retail (JV)"]);
const MAX_DROP = 0.3;
const MATERIAL_RE = /(ถอด|ออก)แบบประมาณการ/;
/* ตัวกรอง service_solution ตามรายงาน Power BI ของทีมเจ้าของข้อมูล (Table.SelectRows หลัง "Added Custom4")
   นอกรายการ (เช่น Roof Renovation, โซลาร์, ระบบอากาศ) = ไม่นับเป็นแบบรับเข้า (design_type = null)
   null = ไม่มีงานบริการ (โอกาสขายสินค้า เช่น SCG Roof) -> Power BI นับเป็น "แบบ Material" (Estimate Service)
   ตรวจกับ Power BI: ร้าน 5100895 ต.ค. 69 = 64 (M30/S34) และ HE ทุกร้าน ต.ค. 69 = 1,006 (M820/S186) ตรงราย Opp_id */
const SERVICE_SOLUTION_KEEP = new Set([
  "Metal Roof", "Roof Installation", "Roof-สินค้า Installation",
  "งานถอดแบบประมาณการ", "งานถอดแบบประมาณการสินค้า", "งานถอดแบบประมาณการสินค้า_inactive",
  "งานออกแบบประมาณการสินค้า", "งานออกแบบประมาณการสินค้า.", "งานงานออกแบบประมาณการสินค้า",
  "งานโครงการ - บริการติดตั้งหลังคาบ้านใหม่", "งานโครงการ - บริการติดตั้งหลังคาบ้านใหม่ (มุง)",
  "งานโครงการ - บริการติดตั้งโครงหลังคาสำเร็จรูป", "งานโครงการ - บริการติดตั้งโครงหลังคาสำเร็จรูป (Truss)",
  "งานโครงการ - บริการมุงหลังคา เมทัล เอสซีจี", "งานโครงการ - สินค้า เมทัล เอสซีจี",
  "งานโครงการ - หลังคาเมทัล เอสซีจี (สินค้าพร้อมติดตั้ง)", "ถอดแบบประมาณการสินค้า",
  "บริการ Premium (Marine Grade)", "บริการ Saver Roof", "บริการงานหลังคา Shingle Roof",
  "บริการติดตั้งหลังคาบ้านใหม่", "หลังคาบ้านใหม่", "หลังคาเมทัลชีท", "เมทัลรูฟ",
  "เหมามุงหลังคา เอสซีจี แบบเบ็ดเสร็จ", "โครงหลังคาสำเร็จรูป",
]);

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const str = (v) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };
const numv = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const isoTs = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1900 ? d.toISOString() : null);
/* วันที่ตามค่าในไฟล์ (เวลาไทย) — SheetJS cellDates สร้าง Date ด้วย local time จึงใช้ getter แบบ local
   ห้ามใช้ toISOString().slice (UTC) เพราะงานที่เปิด 00:00-07:00 จะเลื่อนไปวันก่อน/เดือนก่อน */
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function norm(s) {
  return String(s ?? "")
    .normalize("NFC")
    .replace(/บจก\.?|บริษัท|หจก\.?|ห้างหุ้นส่วนจำกัด|บ\.|จก\.?|จำกัด|\(มหาชน\)/g, " ")
    .replace(/เอสซีจี\s*โฮม|เอสซีจีโฮม|scg\s*home/gi, " ")
    .replace(/วัตถุ/g, "วัสดุ")
    .replace(/[\s.\-_()]/g, "")
    .toLowerCase();
}
function parseCsv(text) {
  const rows = []; let cur = [], f = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { cur.push(f); f = ""; }
    else if (c === "\n") { cur.push(f); rows.push(cur); cur = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f.length || cur.length) { cur.push(f); rows.push(cur); }
  return rows;
}

/* ---- ร้าน: ชื่อทุกรูปแบบ -> code ---- */
const { data: dealers, error: dErr } = await sb.from("dealers").select("code,name,model");
if (dErr) { console.error("โหลด dealers ไม่สำเร็จ:", dErr.message); process.exit(1); }
const dealerSet = new Map(dealers.map((d) => [d.code, d]));
const alias = new Map(); // norm(name) -> Set(code)
const addAlias = (name, code) => { const k = norm(name); if (!k || !dealerSet.has(code)) return; (alias.get(k) ?? alias.set(k, new Set()).get(k)).add(code); };
dealers.forEach((d) => addAlias(d.name, d.code));
{
  const md = parseCsv(readFileSync("commission-app/Master_Dealer.csv", "utf8"));
  const h = md[0].map((x) => String(x).trim());
  const iCode = h.indexOf("Dealer Code");
  const nameCols = h.map((x, i) => (/^Dealer Name/.test(x) ? i : -1)).filter((i) => i >= 0);
  for (const r of md.slice(1)) { const code = String(r[iCode] ?? "").trim(); for (const c of nameCols) if (str(r[c])) addAlias(r[c], code); }
}
/* ชื่อใน CRM ที่ไม่ตรงชื่อใดใน Master_Dealer — จับคู่ด้วยชื่อร้าน + จังหวัดที่ตรงกับร้านเดียวในระบบ
   (ร้านที่ไม่มีในแอป เช่น กิจเจริญโฮม อุบลฯ, บุญถาวร เมืองขอนแก่น ปล่อยเป็นไม่ระบุร้าน) */
const OVERRIDE = new Map([
  ["เอสซีจี โฮม ช.โลหะกิจ (กระบี่)", "5100971"],        // เอสซีจี โฮม บุญถาวร ช.โลหะกิจ (กระบี่)
  ["เอสซีจี โฮม บุญถาวร (เมืองจันทบุรี)", "5102653"],     // เอสซีจีโฮม บุญถาวร (จันทบุรี) — ร้านเดียวในจันทบุรี
  ["เอสซีจี โฮม สหมิตร (นครศรีธรรมราช)", "5100289"],    // เอสซีจี โฮม บุญถาวร สหมิตร (นครศรีธรรมราช)
  ["เอสซีจี โฮม เมืองอำนาจเจริญ", "5102354"],           // เอสซีจี โฮม โฮมมาสเตอร์ (เมืองอำนาจเจริญ)
  ["เอสซีจี โฮม บุญถาวร ฉะเชิงเทรา", "5102714"],         // เอสซีจี โฮม บุญถาวร ทีเค โฮมเซ็นเตอร์ (ฉะเชิงเทรา) — ร้านเดียวในฉะเชิงเทรา
  ["บจก.นพดลพานิช โฮมเอ็กซ์เปิร์ท", "5101685"],         // บ.นพดลพานิช จก.
  ["บริษัท นพดลพานิช จำกัด สาขา 00001", "5101685"],     // บ.นพดลพานิช จก.
  ["เอสซีจี โฮม สหะชัยรีเทล (บ้านนา)", "5100974"],      // ตามที่ใช้ใน import-cust-sat (สหะชัยรีเทล บ้านนา -> 5100974)
  ["เอสซีจี โฮม แสงอุปกรณ์ (เมืองสุโขทัย)", "5100163"],  // หจก.สุโขทัยแสงอุปกรณ์
  ["เอสซีจี โฮม บุญถาวร เมืองขอนแก่น", "5100967"],      // Power BI จัดเป็น บจก.แม็กซ์โฮม แอนด์ เดคคอร์ (82/82 รายการ ม.ค.-ต.ค. 69)
]);
/* BU อื่น (เช่น HomeSmile, SCG Solar Roof) นับด้วยถ้าร้านผู้สร้างเป็นร้าน HE / SCG Home — Power BI กรองตามโมเดลร้าน ไม่ใช่ BU */
const STORE_MODELS = new Set(["Housing Expert", "SCG Home"]);
function mapDealer(name) {
  if (!name) return null;
  if (OVERRIDE.has(name)) return OVERRIDE.get(name);
  const set = alias.get(norm(name));
  return set && set.size === 1 ? [...set][0] : null;
}

/* ---- พนักงาน: อีเมล / ส่วนหน้า @ -> rep_code ---- */
const { data: reps } = await sb.from("sale_reps").select("rep_code,email,dealer_code,is_active");
const repByKey = new Map();
const dupKey = new Set();
for (const r of reps ?? []) {
  const e = String(r.email ?? "").trim().toLowerCase();
  if (!e) continue;
  for (const k of [e, e.split("@")[0]]) {
    if (repByKey.has(k) && repByKey.get(k) !== r.rep_code) dupKey.add(k);
    else repByKey.set(k, r.rep_code);
  }
}
function mapRep(creator) {
  const c = String(creator ?? "").trim().toLowerCase().replace(/^old\d*_/, "");
  if (!c) return null;
  for (const k of [c, c.split("@")[0]]) if (repByKey.has(k) && !dupKey.has(k)) return repByKey.get(k);
  return null;
}

/* ---- อ่านไฟล์ ---- */
const st = statSync(FILE);
const wb = XLSX.read(readFileSync(FILE), { type: "buffer", cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
const need = ["id", "business_unit", "crm_created_date", "created_by_group_name", "service_category", "service_sub_solution", "stage", "crm_created_name"];
const missing = need.filter((k) => !(k in (raw[0] ?? {})));
if (missing.length) { console.error(`ไม่พบคอลัมน์: ${missing.join(", ")} — โครงสร้างเปลี่ยน ยกเลิก`); process.exit(1); }

const rows = [];
const seen = new Set();
let outBu = 0, outDate = 0, dup = 0;
const missStore = new Map();
let repHit = 0;
for (const r of raw) {
  const group = str(r.created_by_group_name);
  const dealer_code = mapDealer(group);
  if (!BUS.has(r.business_unit) && !STORE_MODELS.has(dealerSet.get(dealer_code)?.model)) { outBu++; continue; }
  const ts = isoTs(r.crm_created_date);
  const day = ts ? localDate(r.crm_created_date) : null;
  if (!ts || day < SINCE) { outDate++; continue; }
  const id = str(r.id);
  if (!id || seen.has(id)) { dup++; continue; }
  seen.add(id);
  if (!dealer_code) missStore.set(group ?? "(ว่าง)", (missStore.get(group ?? "(ว่าง)") ?? 0) + 1);
  const cat = str(r.service_category), sub = str(r.service_sub_solution);
  const sol = str(r.service_solution);
  const inScope = !!sol && SERVICE_SOLUTION_KEEP.has(sol);
  // service_solution ว่าง + สินค้า Roof = Power BI จัดเป็น "แบบ Material" (Service categor-II = บริการงานออกแบบประมาณการ (Estimate Service))
  // ว่าง + สินค้าอื่น (Smartwood, SFG, Q-con ...) = ไม่นับ (ตรวจ ม.ค.-ต.ค. 69: Roof 961/961 อยู่ใน Power BI, อื่นๆ 0/15)
  const design_type = !sol ? (str(r.product_solution) === "Roof" ? "material" : null) : !inScope ? null : MATERIAL_RE.test(`${cat ?? ""} ${sub ?? ""} ${sol}`) ? "material" : sub ? "solution" : null;
  const rep_code = mapRep(r.crm_created_name);
  if (rep_code) repHit++;
  rows.push({
    opp_id: id,
    created_at_crm: ts,
    created_date: day,
    period: day.slice(0, 7),
    business_unit: r.business_unit,
    store_group_name: group,
    dealer_code,
    design_type,
    service_category: cat,
    service_solution: str(r.service_solution),
    service_sub_solution: sub,
    product_category: str(r.product_category),
    product_solution: str(r.product_solution),
    product_sub_solution: str(r.product_sub_solution),
    stage: str(r.stage),
    reason: str(r.reason),
    origin: str(r.origin),
    sub_origin: str(r.sub_origin),
    creator: str(r.crm_created_name),
    rep_code,
    expected_product: numv(r.product_expected_sale_vol),
    expected_service: numv(r.service_expected_sale_vol),
    actual_sale: numv(r.actual_sale),
    actual_close_date: isoTs(r.actual_close_date) ? localDate(r.actual_close_date) : null,
    rudy_id: str(r.rudy_id),
    home_id: str(r.home_id),
    crm_modified_at: isoTs(r.modified_date),
    source_file: FILE.split(/[\\/]/).pop(),
  });
}

/* ---- รายงาน ---- */
const cnt = (arr, f) => { const m = {}; arr.forEach((x) => { const k = f(x) ?? "(ว่าง)"; m[k] = (m[k] ?? 0) + 1; }); return m; };
const fmtM = (m) => Object.keys(m).sort().map((k) => `${k}:${m[k]}`).join(" ");
const modelOf = (x) => dealerSet.get(x.dealer_code)?.model ?? "ไม่ระบุร้าน";
console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
console.log(`ไฟล์: ${FILE} (${(st.size / 1048576).toFixed(1)} MB, แก้ไข ${st.mtime.toISOString().slice(0, 16)}) | แถวดิบ ${raw.length}`);
console.log(`ในขอบเขต: ${rows.length} | นอก BU ${outBu} | ก่อน ${SINCE}/ไม่มีวันที่ ${outDate} | id ซ้ำ ${dup}`);
console.log(`ร้าน: map ได้ ${rows.length - [...missStore.values()].reduce((a, b) => a + b, 0)}/${rows.length} | ต่อ Model ${JSON.stringify(cnt(rows, modelOf))}`);
console.log(`พนักงาน (SE): map ได้ ${repHit}/${rows.length} (${((repHit / (rows.length || 1)) * 100).toFixed(1)}%)`);
console.log(`ประเภท: ${JSON.stringify(cnt(rows, (x) => x.design_type))} | stage: ${JSON.stringify(cnt(rows, (x) => x.stage))}`);
for (const y of ["2025", "2026"]) {
  const yr = rows.filter((x) => x.period.startsWith(y) && x.dealer_code);
  const per = {};
  yr.forEach((x) => { const p = x.period; per[p] ??= { m: 0, s: 0, n: 0 }; if (x.design_type === "material") per[p].m++; else if (x.design_type === "solution") per[p].s++; else per[p].n++; });
  console.log(`  ${y} (ร้านที่ map ได้) เดือน: Material / Solution / ไม่มีงานบริการ`);
  console.log("    " + Object.keys(per).sort().map((p) => `${p.slice(5)}: ${per[p].m}/${per[p].s}/${per[p].n}`).join(" | "));
}
console.log(`ร้านที่ map ไม่ได้ (${missStore.size} ชื่อ):`);
[...missStore.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  "${k}" x${v}`));

/* ---- เทียบฐานข้อมูล ---- */
const FIELDS = ["created_at_crm", "period", "business_unit", "store_group_name", "dealer_code", "design_type", "service_category", "service_solution",
  "service_sub_solution", "product_category", "product_solution", "product_sub_solution", "stage", "reason", "origin", "sub_origin", "creator",
  "rep_code", "expected_product", "expected_service", "actual_sale", "actual_close_date", "rudy_id", "home_id", "crm_modified_at"];
const db = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("design_intake_lines").select(["id", "opp_id", ...FIELDS].join(",")).order("id").range(from, from + 999);
  if (error) { console.error("อ่านฐานข้อมูลไม่สำเร็จ:", error.message); process.exit(1); }
  db.push(...data); if (data.length < 1000) break;
}
const dbMap = new Map(db.map((x) => [x.opp_id, x]));
const NUM = new Set(["expected_product", "expected_service", "actual_sale"]);
const TS = new Set(["created_at_crm", "crm_modified_at"]);
const nv = (k, v) => (v == null || v === "" ? null : NUM.has(k) ? Number(v) : TS.has(k) ? new Date(v).getTime() : v);
const toInsert = [], toUpdate = [];
for (const r of rows) {
  const cur = dbMap.get(r.opp_id);
  if (!cur) { toInsert.push(r); continue; }
  if (FIELDS.some((k) => nv(k, cur[k]) !== nv(k, r[k]))) toUpdate.push(r);
}
const keys = new Set(rows.map((r) => r.opp_id));
const toDelete = db.filter((x) => !keys.has(x.opp_id));
console.log(`\nฐานข้อมูล: ${db.length} แถว → เพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length}`);

if (db.length && rows.length < db.length * (1 - MAX_DROP) && !FORCE) {
  console.error(`หยุด: จำนวนแถวลดลงเกิน ${MAX_DROP * 100}% (${db.length} → ${rows.length}) ใช้ --force ถ้าตั้งใจ`);
  process.exit(2);
}
if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อ sync จริง"); process.exit(0); }

const ups = [...toInsert, ...toUpdate].map((r) => ({ ...r, synced_at: new Date().toISOString() }));
for (let i = 0; i < ups.length; i += 1000) {
  const { error } = await sb.from("design_intake_lines").upsert(ups.slice(i, i + 1000), { onConflict: "opp_id" });
  if (error) { console.error("upsert ไม่สำเร็จ:", error.message); process.exit(1); }
  process.stdout.write(`\r  upsert ${Math.min(i + 1000, ups.length)}/${ups.length}`);
}
const delIds = toDelete.map((x) => x.id);
for (let i = 0; i < delIds.length; i += 500) {
  const { error } = await sb.from("design_intake_lines").delete().in("id", delIds.slice(i, i + 500));
  if (error) { console.error("\nลบไม่สำเร็จ:", error.message); process.exit(1); }
}
const { count } = await sb.from("design_intake_lines").select("id", { count: "exact", head: true });
console.log(`\nDONE: เพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length} | ทั้งตาราง ${count} แถว`);
