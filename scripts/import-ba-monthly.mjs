/* นำเข้าไฟล์ BA รายเดือนแบบแยกรายร้าน (ทั้งโฟลเดอร์) — แทนที่ทั้งเดือนใน transaction เดียว
   -------------------------------------------------------------
   --kind incentive : BA Incentive_พนักงาน  I-<MMM><YY>_*.xlsx -> ba_incentive_lines
                       ตัวอ่านเดียวกับหน้าศูนย์ข้อมูล (src/lib/server/ba-commission-parse.ts)
                       win_date จาก ba_service_sales_lines ; หลังบันทึก -> refresh_service_sales_reps()
   --kind profit    : BA Profit Share_ร้านค้า  P-<MMM><YY>_*.xlsx -> ba_profit_share_lines
                       ร้าน: channel_name -> store_name ผ่าน master_aliases (ba_channel)
                       sale_rep_name = assignee_sales_team จาก Google Sheet BA (job_code) เหมือน backfill-ps-sales
   --period YYYY-MM (ไม่ใส่ = เดาจากชื่อไฟล์) ; --dir <โฟลเดอร์> (อ่านโฟลเดอร์ย่อยด้วย)
   บันทึกประวัติลง data_uploads (uploaded_by = script) ; เตือนถ้ายอดต่างจากเดือนก่อนเกิน ±40%

   DRY RUN: node scripts/import-ba-monthly.mjs --kind incentive --dir "commission-app/BA Incentive_พนักงาน/OCT"
   APPLY:   ... --apply
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { parseBaFile, periodFromFileName } from "../src/lib/server/ba-commission-parse.ts";

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes("--apply");
const KIND = arg("--kind");
const DIR = arg("--dir");
if (!["incentive", "profit"].includes(KIND) || !DIR) { console.error("ใช้: --kind incentive|profit --dir <โฟลเดอร์> [--period YYYY-MM] [--apply]"); process.exit(1); }

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const f2 = (n) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const prevPeriod = (p) => { const [y, m] = p.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
async function pageAll(build) { const out = []; for (let from = 0; ; from += 1000) { const { data, error } = await build().range(from, from + 999); if (error) throw new Error(error.message); out.push(...data); if (data.length < 1000) break; } return out; }

/* ---- ไฟล์ในโฟลเดอร์ (รวมโฟลเดอร์ย่อย) ---- */
function listXlsx(dir) { const out = []; for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) out.push(...listXlsx(p)); else if (/\.xlsx?$/i.test(n) && !n.startsWith("~$")) out.push(p); } return out; }
const files = listXlsx(DIR);
const guessed = [...new Set(files.map((p) => periodFromFileName(basename(p).replace(/^P-/i, "I-"))).filter(Boolean))];
const PERIOD = arg("--period") ?? (guessed.length === 1 ? guessed[0] : null);
if (!PERIOD || !/^\d{4}-\d{2}$/.test(PERIOD)) { console.error(`ระบุเดือนไม่ได้ (จากชื่อไฟล์ได้ ${JSON.stringify(guessed)}) — ใส่ --period YYYY-MM`); process.exit(1); }
console.log(`${KIND === "incentive" ? "BA Incentive (Commission)" : "BA Profit Share"} | เดือน ${PERIOD} | ${files.length} ไฟล์ จาก ${DIR}`);

/* ---- lookups จาก DB ---- */
const aliases = await pageAll(() => sb.from("master_aliases").select("kind,alias,value").in("kind", ["ba_channel", "ba_emp"]));
const dealers = await pageAll(() => sb.from("dealers").select("code,name"));
const dealerName = new Map(dealers.map((d) => [d.code, d.name]));
const channelToDealer = new Map(aliases.filter((a) => a.kind === "ba_channel").map((a) => [a.alias, a.value]));

const TABLE = KIND === "incentive" ? "ba_incentive_lines" : "ba_profit_share_lines";
const AMT = KIND === "incentive" ? "total_incentive" : "profit_share_amount";
let rows = [];
const fileReport = [];

if (KIND === "incentive") {
  const reps = await pageAll(() => sb.from("sale_reps").select("rep_code,ba_app_id_1,ba_app_id_2"));
  const empToRep = new Map();
  reps.forEach((r) => { if (r.ba_app_id_1) empToRep.set(String(r.ba_app_id_1).trim(), r.rep_code); if (r.ba_app_id_2) empToRep.set(String(r.ba_app_id_2).trim(), r.rep_code); });
  const L = { channelToDealer, dealerName, empToCr: new Map(aliases.filter((a) => a.kind === "ba_emp").map((a) => [a.alias, a.value])), empToRep };
  for (const p of files) {
    const r = parseBaFile(basename(p), readFileSync(p), PERIOD, L);
    fileReport.push(r);
    if (r.status !== "error") rows.push(...r.rows);
  }
  // win_date จากยอดขายงานบริการ BA (sync จาก Google Sheet)
  const codes = [...new Set(rows.map((r) => r.job_code))];
  const win = new Map();
  for (let i = 0; i < codes.length; i += 300) {
    const { data, error } = await sb.from("ba_service_sales_lines").select("job_code,win_date").in("job_code", codes.slice(i, i + 300));
    if (error) throw new Error(error.message);
    data.forEach((x) => x.win_date && !win.has(x.job_code) && win.set(x.job_code, x.win_date));
  }
  rows.forEach((r) => (r.win_date = win.get(r.job_code) ?? null));
} else {
  // assignee_sales_team จาก Google Sheet BA (เหมือน backfill-ps-sales.mjs)
  const assignee = new Map();
  if (env.BA_GSHEET_CSV_URL) {
    const text = await (await fetch(env.BA_GSHEET_CSV_URL, { redirect: "follow" })).text();
    const wb = XLSX.read(text, { type: "string", raw: true });
    const d = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, raw: true });
    const h = d[0].map((x) => String(x).trim()), ij = h.indexOf("job_code"), ia = h.indexOf("assignee_sales_team");
    if (ij >= 0 && ia >= 0) d.slice(1).forEach((r) => { const k = String(r[ij] ?? "").trim(), v = String(r[ia] ?? "").trim(); if (k && v && !assignee.has(k)) assignee.set(k, v); });
  }
  const str = (v) => { if (v == null) return null; const s = String(v).trim(); return s === "" || s === "NULL" ? null : s; };
  const num = (v) => { if (v == null || v === "" || v === "NULL") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
  const toDate = (v) => {
    if (v == null || v === "") return null;
    const s = String(v).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    const n = Number(v); if (!Number.isFinite(n) || n <= 0) return null;
    const dt = new Date(Math.round((n - 25569) * 86400 * 1000)); return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  };
  const NEED = ["channel_name", "store_name", "job_code", "profit_share_amount"];
  for (const p of files) {
    const name = basename(p);
    const rep = { name, status: "ok", messages: [], rows: [], amount: 0 };
    fileReport.push(rep);
    const fp = periodFromFileName(name.replace(/^P-/i, "I-"));
    if (fp && fp !== PERIOD) rep.messages.push(`ชื่อไฟล์เป็นเดือน ${fp}`);
    const wb = XLSX.read(readFileSync(p), { type: "buffer" });
    const d = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
    const H = new Map((d[0] ?? []).map((c, i) => [String(c ?? "").trim(), i]));
    const miss = NEED.filter((k) => !H.has(k));
    if (miss.length) { rep.status = "error"; rep.messages.push(`ไม่ใช่รูปแบบ Profit Share: ไม่พบ ${miss.join(", ")}`); continue; }
    const G = (row, k) => (H.has(k) ? row[H.get(k)] : undefined);
    const unknown = new Set();
    for (const row of d.slice(1)) {
      const jobCode = str(G(row, "job_code")); if (!jobCode) continue;
      const channel = str(G(row, "channel_name")), storeNm = str(G(row, "store_name"));
      const dealer = (channel && channelToDealer.get(channel)) || (storeNm && channelToDealer.get(storeNm)) || null;
      if (!dealer && channel) unknown.add(channel);
      const ps = num(G(row, "profit_share_amount")) ?? 0;
      rep.rows.push({
        period: PERIOD, channel_name: channel, store_name: storeNm, store_model: str(G(row, "store_model")),
        dealer_code: dealer, dealer_name: dealer ? dealerName.get(dealer) ?? null : null,
        sale_order_no: str(G(row, "sale_order_no")), customer_name: str(G(row, "customer_name")), invoice_no: str(G(row, "invoice_no")),
        discount_code: str(G(row, "discount_code")), job_code: jobCode, job_type: str(G(row, "job_type")), worktype_name: str(G(row, "worktype_name")),
        product_code: str(G(row, "product_code")), product_name: str(G(row, "product_name")),
        product_brand: str(G(row, "service_brand")) ?? str(G(row, "product_brand")),
        sku_code: str(G(row, "sku_code")), sku_name: str(G(row, "sku_name")), job_status: str(G(row, "job_status")),
        payment_date: toDate(G(row, "payment_date")), customer_accepted_date: toDate(G(row, "customer_accepted_date")),
        actual_paid: num(G(row, "actual_paid")), jo_amount: num(G(row, "jo_amount")), margin: num(G(row, "margin")),
        profit_share_rate: num(G(row, "profit_share_rate")), profit_share_amount: ps,
        sale_model: str(G(row, "sale_model")), job_id: str(G(row, "job_id")), adj_shop_service_name: str(G(row, "adj_shop_service_name")),
        shop_condition: null, mou_type: null, store_format: null, source_file: name,
        sale_rep_name: assignee.get(jobCode) ?? null,
      });
      rep.amount += ps;
    }
    if (unknown.size) { rep.status = "warn"; rep.messages.push(`map ร้านไม่ได้: ${[...unknown].join(", ")} → "ไม่ระบุร้าน"`); }
    if (!rep.rows.length) { rep.status = "error"; rep.messages.push("ไม่มีรายการ"); }
    if (rep.status !== "error") rows.push(...rep.rows);
  }
}

/* ---- รายงาน ---- */
const amount = rows.reduce((a, r) => a + Number(r[AMT] ?? 0), 0);
const st = fileReport.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
console.log(`ไฟล์: ${JSON.stringify(st)}`);
fileReport.filter((r) => r.status !== "ok").forEach((r) => console.log(`  ${r.status === "error" ? "✗" : "⚠"} ${r.name}: ${r.messages.join(" / ")}`));
const before = await pageAll(() => sb.from(TABLE).select(`dealer_code,${AMT}`).eq("period", PERIOD));
const prev = await pageAll(() => sb.from(TABLE).select(AMT).eq("period", prevPeriod(PERIOD)));
const sum = (arr) => arr.reduce((a, r) => a + Number(r[AMT] ?? 0), 0);
const prevAmt = sum(prev);
console.log(`\nข้อมูลเดิมเดือน ${PERIOD}: ${before.length} แถว ${f2(sum(before))}  →  ใหม่: ${rows.length} แถว ${f2(amount)}`);
console.log(`เดือนก่อน (${prevPeriod(PERIOD)}): ${prev.length} แถว ${f2(prevAmt)} | ต่าง ${prevAmt ? (((amount - prevAmt) / prevAmt) * 100).toFixed(1) + "%" : "-"}`);
console.log(`ร้าน ${new Set(rows.map((r) => r.dealer_code).filter(Boolean)).size} ร้าน | ไม่ระบุร้าน ${rows.filter((r) => !r.dealer_code).length} แถว (${f2(rows.filter((r) => !r.dealer_code).reduce((a, r) => a + Number(r[AMT] ?? 0), 0))})`);
if (KIND === "incentive") console.log(`ผูกพนักงานในระบบ ${rows.filter((r) => r.rep_code).length}/${rows.length} | CR ${rows.filter((r) => r.emp_code).length} | win_date ${rows.filter((r) => r.win_date).length}`);
else console.log(`sale_rep_name (assignee) ${rows.filter((r) => r.sale_rep_name).length}/${rows.length}`);
if (prevAmt && Math.abs(amount - prevAmt) / prevAmt > 0.4) console.log("⚠ ยอดต่างจากเดือนก่อนเกิน 40% — ตรวจว่าไฟล์ครบ/ถูกเดือน");

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อนำเข้าจริง"); process.exit(0); }
if (!rows.length) { console.error("ไม่มีรายการให้บันทึก"); process.exit(1); }

const rpc = KIND === "incentive" ? "replace_ba_incentive_period" : "replace_ba_profit_share_period";
const { data: res, error } = await sb.rpc(rpc, { p_period: PERIOD, p_rows: rows });
if (error) { console.error("บันทึกไม่สำเร็จ (ข้อมูลเดิมไม่ถูกแก้):", error.message); process.exit(1); }
await sb.from("data_uploads").insert({
  source: KIND === "incentive" ? "ba-commission" : "profit-share-ba", period: PERIOD, status: "applied",
  file_names: files.map((p) => basename(p)), file_count: files.length,
  rows_before: before.length, rows_after: rows.length, amount_before: sum(before), amount_after: amount,
  message: "นำเข้าด้วยสคริปต์จากโฟลเดอร์ในเครื่อง", uploaded_by: "script",
});
if (KIND === "incentive") { const { data } = await sb.rpc("refresh_service_sales_reps"); console.log("refresh reps:", JSON.stringify(data)); }
console.log(`\nDONE ${JSON.stringify(res)}`);
