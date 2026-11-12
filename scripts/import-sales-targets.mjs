/* นำเข้าเป้าหมาย (TG) รายร้านรายเดือน -> sales_targets (แทนที่ทั้ง kind แบบ atomic ผ่าน RPC replace_sales_targets)
   -------------------------------------------------------------
   --kind design   : opbyhomedesign.xlsx sheet "opby_แบบบ้าน"  -> kind design_intake
                     target = "TG แบบบ้าน" (จำนวนแบบรับเข้า) ; เดือน = order_created_year/month
                     (ปี 2026 "TG Win แบบบ้าน" = "TG แบบบ้าน" และ "TG Win แบบเฉพาะสินค้า" = 0 จึงเก็บแค่ TG แบบบ้าน)
   --kind service  : opbychannel.xlsx sheet "Plan" (DataType02 = WIN CONTRACT, BusinessType = Service Solution) -> kind service_sales
                     target = plan_amount_excl_vat (บาท ไม่รวม VAT) ; group3 ตามกติกาเดียวกับยอดขายงานบริการ:
                       H3 ROOF SYSTEM / METAL ROOF -> ROOF SERVICE ; H3 HOME RENOVATION SYSTEM หรือ H2 3.Q-Chang -> Qchang ;
                       H2 2.Smart Solution -> SMART SOLUTION
                     หมายเหตุ: header ในไฟล์มีช่องว่าง (" plan_amount_excl_vat ") จึง trim ชื่อคอลัมน์ก่อนใช้
   --kind product  : opbychannel.xlsx sheet "Plan" (WIN CONTRACT, BusinessType = Product Material) -> kind product_sales
                     group3 = 6 กลุ่มสินค้า (H2 SCGR -> ROOF / H3 ACCESSORIES -> ROOF C&W ACCESSORIES ; CW ; LANDSCAPE ; SFG ; WINDSOR)
   ร้าน: channel_detail_name -> dealers ด้วยชื่อทุกคอลัมน์ใน Master_Dealer.csv + OVERRIDE (ชุดเดียวกับ sync-design-intake)
         map ไม่ได้ -> dealer_code = null (เก็บชื่อร้านไว้)
   DRY RUN: node scripts/import-sales-targets.mjs --kind design|service [--file <path>]
   APPLY:   เพิ่ม --apply
*/
import { readFileSync, statSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes("--apply");
const KIND = arg("--kind");
if (!["design", "service", "product"].includes(KIND)) { console.error("ระบุ --kind design | service | product"); process.exit(1); }
const DIR = "D:/OneDrive - The Siam Cement Public Company Limited/RSS  System - rawdata_op/";
const FILE = arg("--file") ?? DIR + (KIND === "design" ? "opbyhomedesign.xlsx" : "opbychannel.xlsx");
const DB_KIND = { design: "design_intake", service: "service_sales", product: "product_sales" }[KIND];

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const str = (v) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };

/* ---- ร้าน ---- */
function norm(s) {
  return String(s ?? "").normalize("NFC")
    .replace(/บจก\.?|บริษัท|หจก\.?|ห้างหุ้นส่วนจำกัด|บ\.|จก\.?|จำกัด|\(มหาชน\)/g, " ")
    .replace(/เอสซีจี\s*โฮม|เอสซีจีโฮม|scg\s*home/gi, " ")
    .replace(/วัตถุ/g, "วัสดุ").replace(/[\s.\-_()]/g, "").toLowerCase();
}
const { data: dealers, error: dErr } = await sb.from("dealers").select("code,name,model");
if (dErr) { console.error("โหลด dealers ไม่สำเร็จ:", dErr.message); process.exit(1); }
const dealerSet = new Map(dealers.map((d) => [d.code, d]));
const alias = new Map();
const addAlias = (name, code) => { const k = norm(name); if (!k || !dealerSet.has(code)) return; (alias.get(k) ?? alias.set(k, new Set()).get(k)).add(code); };
dealers.forEach((d) => addAlias(d.name, d.code));
{
  const mw = XLSX.read(readFileSync("commission-app/Master_Dealer.csv", "utf8").replace(/^\uFEFF/, ""), { type: "string", raw: true });
  for (const r of XLSX.utils.sheet_to_json(mw.Sheets[mw.SheetNames[0]], { defval: "", raw: true }))
    for (const [k, v] of Object.entries(r)) if (/^Dealer Name/.test(k.trim()) && str(v)) addAlias(v, String(r["Dealer Code"]).trim());
}
const OVERRIDE = new Map([
  ["เอสซีจี โฮม ช.โลหะกิจ (กระบี่)", "5100971"],
  ["เอสซีจี โฮม บุญถาวร (เมืองจันทบุรี)", "5102653"],
  ["เอสซีจี โฮม สหมิตร (นครศรีธรรมราช)", "5100289"],
  ["เอสซีจี โฮม เมืองอำนาจเจริญ", "5102354"],
  ["เอสซีจี โฮม บุญถาวร ฉะเชิงเทรา", "5102714"],
  ["บจก.นพดลพานิช โฮมเอ็กซ์เปิร์ท", "5101685"],
  ["บริษัท นพดลพานิช จำกัด สาขา 00001", "5101685"],
  ["เอสซีจี โฮม สหะชัยรีเทล (บ้านนา)", "5100974"],
  ["เอสซีจี โฮม แสงอุปกรณ์ (เมืองสุโขทัย)", "5100163"],
  ["เอสซีจี โฮม บุญถาวร เมืองขอนแก่น", "5100967"],
]);
const mapDealer = (name) => {
  if (!name) return null;
  if (OVERRIDE.has(name)) return OVERRIDE.get(name);
  const s = alias.get(norm(name));
  return s && s.size === 1 ? [...s][0] : null;
};

/* ---- อ่านไฟล์ ---- */
const st = statSync(FILE);
const SHEET = KIND === "design" ? "opby_แบบบ้าน" : "Plan";
const wb = XLSX.read(readFileSync(FILE), { type: "buffer", sheets: [SHEET] });
if (!wb.Sheets[SHEET]) { console.error(`ไม่พบ sheet "${SHEET}" — โครงสร้างเปลี่ยน ยกเลิก`); process.exit(1); }
const raw = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { defval: null, raw: true })
  .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), v])));
const need = KIND === "design"
  ? ["order_created_year", "order_created_month", "channel_detail_name", "TG แบบบ้าน", "rept_gp_shopmodel"]
  : ["order_created_year", "order_created_month", "channel_detail_name", "plan_amount_excl_vat", "DataType02", "BusinessType", "H2", "H3", ...(KIND === "service" ? ["H5"] : []), "rept_gp_shopmodel"];
const missing = need.filter((k) => !(k in (raw[0] ?? {})));
if (missing.length) { console.error(`ไม่พบคอลัมน์: ${missing.join(", ")} — ยกเลิก`); process.exit(1); }

const group3Of = (r) => {
  const h2 = str(r.H2), h3 = str(r.H3);
  if (h3 === "ROOF SYSTEM" || h3 === "METAL ROOF") return "ROOF SERVICE";
  if (h3 === "HOME RENOVATION SYSTEM" || h2 === "3.Q-Chang") return "Qchang";
  if (h2 === "2.Smart Solution") return "SMART SOLUTION";
  return null;
};
/* ยอดขายสินค้า: 6 กลุ่มตามรายงาน Power BI (ตรงกับ product_sales_lines.group6) — ตรวจ 2026: ตรง PBI 3,754/4,066 ร้าน×กลุ่ม×เดือน
   (WINDSOR ในไฟล์ 30.0M สูงกว่า PBI 6.3M — ยังไม่ทราบตัวกรองของ PBI จึงใช้ตามไฟล์) */
const group6Of = (r) => {
  const h2 = str(r.H2), h3 = str(r.H3);
  if (h2 === "SCGR") return h3 === "ACCESSORIES" ? "ROOF C&W ACCESSORIES" : "ROOF";
  if (h2 === "CW") return "CW";
  if (h2 === "LANDSCAPE") return "LANDSCAPE";
  if (h2 === "SFG") return "SFG";
  if (h2 === "WINDSOR") return "WINDSOR";
  return null;
};

const agg = new Map();
let skipped = 0, zero = 0;
const unknownH = new Map();
for (const r of raw) {
  const y = Number(r.order_created_year), m = Number(r.order_created_month);
  if (!(y >= 2020 && m >= 1 && m <= 12)) { skipped++; continue; }
  let group3 = null, h5 = null, target;
  if (KIND === "design") target = Number(r["TG แบบบ้าน"]) || 0;
  else {
    const wantBT = KIND === "product" ? "Product Material" : "Service Solution";
    if (r.DataType02 !== "WIN CONTRACT" || r.BusinessType !== wantBT) { skipped++; continue; }
    group3 = KIND === "product" ? group6Of(r) : group3Of(r); h5 = KIND === "product" ? null : str(r.H5);
    if (!group3) { const k = `${r.H2}/${r.H3}`; unknownH.set(k, (unknownH.get(k) ?? 0) + 1); continue; }
    target = Number(r.plan_amount_excl_vat) || 0;
  }
  if (!target) { zero++; continue; }
  const store = str(r.channel_detail_name) ?? "(ว่าง)";
  const period = `${y}-${String(m).padStart(2, "0")}`;
  const key = `${period}|${store}|${group3}|${h5}`;
  const o = agg.get(key) ?? { period, dealer_code: mapDealer(store), store_name: store, shop_model: str(r.rept_gp_shopmodel), group3, h5, target: 0, source_file: FILE.split(/[\\/]/).pop() };
  o.target += target;
  agg.set(key, o);
}
const rows = [...agg.values()].map((o) => ({ ...o, target: Math.round(o.target * 100) / 100 }));

/* ---- รายงาน ---- */
const f = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
console.log(`ไฟล์: ${FILE} (${(st.size / 1048576).toFixed(1)} MB, แก้ไข ${st.mtime.toISOString().slice(0, 16)}) | sheet ${SHEET} ${raw.length} แถว`);
console.log(`เก็บ ${rows.length} แถว (รวมรายร้าน×เดือน${KIND === "service" ? "×H5" : ""}) | ข้าม ${skipped} | เป้า 0 ${zero}${unknownH.size ? ` | ไม่รู้กลุ่ม ${JSON.stringify(Object.fromEntries(unknownH))}` : ""}`);
const noMap = new Map(); rows.filter((r) => !r.dealer_code).forEach((r) => noMap.set(`${r.store_name} (${r.shop_model})`, (noMap.get(`${r.store_name} (${r.shop_model})`) ?? new Set()).add(r.period.slice(0, 4))));
console.log(`ร้าน map ได้ ${new Set(rows.filter((r) => r.dealer_code).map((r) => r.dealer_code)).size} ร้าน | map ไม่ได้ ${noMap.size}: ${[...noMap].map(([k, y]) => `${k} [${[...y].join(",")}]`).join(" | ")}`);
const byYM = {};
rows.forEach((r) => { const mdl = dealerSet.get(r.dealer_code)?.model ?? `ไม่ระบุ(${r.shop_model})`; const k = `${r.period.slice(0, 4)} ${mdl}${r.group3 ? " " + r.group3 : ""}`; byYM[k] = (byYM[k] ?? 0) + r.target; });
Object.keys(byYM).sort().forEach((k) => console.log(`  ${k}: ${f(byYM[k])}`));
const m26 = {}; rows.filter((r) => r.period.startsWith("2026") && ["Housing Expert", "SCG Home"].includes(dealerSet.get(r.dealer_code)?.model)).forEach((r) => (m26[r.period] = (m26[r.period] ?? 0) + r.target));
console.log("  2026 HE+SCG Home รายเดือน: " + Object.keys(m26).sort().map((p) => `${p.slice(5)}: ${f(m26[p])}`).join(" | "));

const { count: before } = await sb.from("sales_targets").select("id", { count: "exact", head: true }).eq("kind", DB_KIND);
console.log(`ฐานข้อมูล ${DB_KIND}: ${before ?? 0} แถว -> ${rows.length} แถว`);
if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }
const { data, error } = await sb.rpc("replace_sales_targets", { p_kind: DB_KIND, p_rows: rows });
if (error) { console.error("นำเข้าไม่สำเร็จ:", error.message); process.exit(1); }
console.log("DONE:", JSON.stringify(data));
