/* Sync ยอดขายงานบริการ BA จาก Google Sheet (ต้นทางของ Pending B2C Offline.xlsx) -> ba_service_sales_lines
   -------------------------------------------------------------
   กติกาเดียวกับ import-ba-service-sales.mjs:
   - ยอด = gmv ; เฉพาะ sale_status = win ; รวม type S และ I
   - dedupe job_id (เก็บแถว win_date ล่าสุด) ; ข้ามแถวไม่มี win_date ; group3 จาก service_group
   - ร้าน: dealer_code ในไฟล์ (ต้องมีใน dealers) -> ไม่งั้น map store_name ผ่าน Master_Dealer (Dealer Name_BA App_*)
   ต่างจากของเดิม: ไม่ลบทั้งตาราง แต่ "sync" ด้วย job_id
   - เพิ่มงานใหม่ / แก้งานที่ข้อมูลเปลี่ยน / ลบงานที่ไม่อยู่ในไฟล์แล้ว (เช่น เปลี่ยนจาก win เป็นสถานะอื่น)
   - กันพัง: ถ้ายอดรวมหรือจำนวนงานลดลงเกิน 30% เทียบกับฐานข้อมูล -> หยุด ไม่เขียน (ใช้ --force ถ้าตั้งใจ)

   ที่มา: env BA_GSHEET_CSV_URL (ลิงก์ export CSV) หรืออาร์กิวเมนต์ --url <ลิงก์>
   DRY RUN: node scripts/sync-ba-service-sales-gsheet.mjs
   APPLY:   node scripts/sync-ba-service-sales-gsheet.mjs --apply [--force]
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const SOURCE = "gsheet:BA Pending B2C Offline";
const MAX_DROP = 0.3;

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const urlIdx = process.argv.indexOf("--url");
const CSV_URL = urlIdx > -1 ? process.argv[urlIdx + 1] : env.BA_GSHEET_CSV_URL;
if (!CSV_URL) {
  console.error("ไม่พบลิงก์ Google Sheet: ตั้ง BA_GSHEET_CSV_URL ใน .env หรือใส่ --url");
  process.exit(1);
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function parseCsv(text) {
  const rows = [];
  let cur = [], fl = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { fl += '"'; i++; } else q = false;
      } else fl += c;
    } else if (c === '"') q = true;
    else if (c === ",") { cur.push(fl); fl = ""; }
    else if (c === "\n") { cur.push(fl); rows.push(cur); cur = []; fl = ""; }
    else if (c !== "\r") fl += c;
  }
  if (fl.length || cur.length) { cur.push(fl); rows.push(cur); }
  return rows;
}
// ค่า error ของสูตรใน Google Sheet (#N/A, #REF! ...) ถือเป็นค่าว่าง
const SHEET_ERR = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)$/i;
const str = (v) => { const s = String(v ?? "").trim(); return s === "" || SHEET_ERR.test(s) ? null : s; };
const num = (v) => Number(String(v ?? "").replace(/,/g, "")) || 0;
/** "2026-02-28 16:00:00" -> "2026-02-28" (ใช้ส่วนวันที่ตามที่อยู่ในไฟล์ เหมือนการนำเข้าเดิม) */
const datePart = (v) => String(v ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

/* ---- Master_Dealer ---- */
const md = parseCsv(readFileSync("commission-app/Master_Dealer.csv", "utf8"));
const mdh = md[0].map((c) => String(c).trim());
const iDCode = mdh.findIndex((h) => /^Dealer Code$/i.test(h));
const iDN = mdh.findIndex((h) => /^Dealer Name$/i.test(h));
const dBaCols = mdh.map((h, i) => (/^Dealer Name_BA App_\d/i.test(h) ? i : -1)).filter((i) => i >= 0);
const nameMap = new Map();
for (let r = 1; r < md.length; r++) {
  const code = String(md[r][iDCode] ?? "").trim();
  const nm = String(md[r][iDN] ?? "").trim();
  for (const c of dBaCols) { const v = String(md[r][c] ?? "").trim(); if (v) nameMap.set(v, { code, name: nm }); }
}
const { data: dealerRows, error: dErr } = await sb.from("dealers").select("code,name");
if (dErr) { console.error("โหลด dealers ไม่สำเร็จ:", dErr.message); process.exit(1); }
const dealerSet = new Map(dealerRows.map((d) => [d.code, d.name]));

/* ---- 3-group (เหมือนสคริปต์เดิม) ---- */
const GROUP3_MAP = {
  "Roofing B2C": "ROOF SERVICE", "Roof Truss B2C": "ROOF SERVICE", "Re-Roof": "ROOF SERVICE", "Metal Roof": "ROOF SERVICE",
  "Roof Repair": "ROOF SERVICE", "Roof Repaint": "ROOF SERVICE",
  "Solar Rooftop": "SMART SOLUTION", "Active Air Quality": "SMART SOLUTION", "Air system": "SMART SOLUTION",
  "AC Installation": "SMART SOLUTION", "AC Cleaning": "SMART SOLUTION", "AC Repair": "SMART SOLUTION", "Acoustic Solution": "SMART SOLUTION",
  "Renovation": "Qchang", "Carport & Awning": "Qchang", "Gutter": "Qchang", "Gutter Repair": "Qchang", "Insulation": "Qchang",
  "Ceiling": "Qchang", "Flooring": "Qchang", "Concrete Flooring": "Qchang", "Landscape": "Qchang", "Door & Window": "Qchang",
  "Painting": "Qchang", "Bathroom Renovation": "Qchang", "Bathroom": "Qchang", "Kitchen Renovation": "Qchang",
  "Ceramic Tile": "Qchang", "Electrical Repair": "Qchang", "Plumbing": "Qchang", "Void Filling": "Qchang",
  "Building Film": "Qchang", "Water Heater": "Qchang", "Fencing": "Qchang", "Washer Cleaning": "Qchang",
  "EZYBUILT": "Qchang", "Others": "Qchang",
};

/* ---- อ่าน Google Sheet ---- */
const res = await fetch(CSV_URL, { redirect: "follow" });
if (!res.ok) { console.error(`ดาวน์โหลด Google Sheet ไม่สำเร็จ: HTTP ${res.status}`); process.exit(1); }
const ctype = res.headers.get("content-type") ?? "";
const text = await res.text();
if (!/csv|text\/plain/i.test(ctype) || /^\s*<!doctype html/i.test(text)) {
  console.error("ได้หน้าเว็บแทนไฟล์ CSV (อาจถูกจำกัดสิทธิ์/ต้องล็อกอิน) — ยกเลิก");
  process.exit(1);
}
const d = parseCsv(text);
const H = {}; d[0].forEach((c, i) => (H[String(c).trim()] = i));
for (const k of ["job_id", "sale_status", "win_date", "gmv", "service_group", "store_name", "dealer_code"]) {
  if (!(k in H)) { console.error(`ไม่พบคอลัมน์ "${k}" ใน Sheet — โครงสร้างเปลี่ยน ยกเลิก`); process.exit(1); }
}
const S = (row, k) => { const s = String(row[H[k]] ?? "").trim(); return SHEET_ERR.test(s) ? "" : s; };
const allRows = d.slice(1).filter((r) => r && r.some((x) => String(x ?? "").trim() !== ""));

const byId = new Map();
for (const row of allRows) {
  const jid = S(row, "job_id"); if (!jid) continue;
  const prev = byId.get(jid);
  if (!prev || S(row, "win_date") > S(prev, "win_date")) byId.set(jid, row);
}

const rows = [];
let skipNotWin = 0, skipNoDate = 0, skipNoGroup = 0, dealerNone = 0;
const unknownGroups = new Map();
for (const row of byId.values()) {
  if (S(row, "sale_status") !== "win") { skipNotWin++; continue; }
  const winDate = datePart(S(row, "win_date"));
  if (!winDate) { skipNoDate++; continue; }
  const svc = S(row, "service_group");
  const group3 = GROUP3_MAP[svc] ?? null;
  if (!group3) { skipNoGroup++; unknownGroups.set(svc, (unknownGroups.get(svc) ?? 0) + 1); continue; }
  const storeName = S(row, "store_name");
  let dealerCode = S(row, "dealer_code");
  let dealerName = null;
  if (dealerCode && dealerSet.has(dealerCode)) dealerName = dealerSet.get(dealerCode);
  else {
    const hit = storeName ? nameMap.get(storeName) : null;
    if (hit) { dealerCode = hit.code; dealerName = hit.name; } else { dealerCode = null; dealerNone++; }
  }
  const t = S(row, "type_of_job");
  rows.push({
    job_id: S(row, "job_id"),
    job_code: str(S(row, "job_code")),
    period: winDate.slice(0, 7),
    win_date: winDate,
    dealer_code: dealerCode,
    dealer_name: dealerName,
    store_name: str(storeName),
    customer_name: str(S(row, "customer_name")),
    channel_group: str(S(row, "channel_group")),
    service_group: str(svc),
    group3,
    type_of_job: t.startsWith("S") ? "S" : t.startsWith("I") ? "I" : null,
    shop_model: str(S(row, "shop_model")),
    region: str(S(row, "region")),
    product_name: str(S(row, "product_name")),
    amount: num(S(row, "gmv")),
    source_file: SOURCE,
  });
}

/* ---- ฐานข้อมูลปัจจุบัน ---- */
const FIELDS = ["job_code", "period", "win_date", "dealer_code", "dealer_name", "store_name", "customer_name", "channel_group",
  "service_group", "group3", "type_of_job", "shop_model", "region", "product_name", "amount"];
const db = [];
for (let from = 0; ; from += 1000) {
  const { data: part, error } = await sb.from("ba_service_sales_lines").select(["job_id", ...FIELDS].join(",")).order("id").range(from, from + 999);
  if (error) { console.error("อ่านฐานข้อมูลไม่สำเร็จ:", error.message); process.exit(1); }
  db.push(...part);
  if (part.length < 1000) break;
}
const dbMap = new Map(db.map((r) => [r.job_id, r]));
const norm = (k, v) => (k === "amount" ? Math.round(Number(v ?? 0) * 100) : v === undefined || v === "" ? null : v);

const toInsert = [], toUpdate = [];
const changedFields = new Map();
for (const r of rows) {
  const cur = dbMap.get(r.job_id);
  if (!cur) { toInsert.push(r); continue; }
  const diff = FIELDS.filter((k) => norm(k, cur[k]) !== norm(k, r[k]));
  if (diff.length) { toUpdate.push({ r, cur, diff }); diff.forEach((k) => changedFields.set(k, (changedFields.get(k) ?? 0) + 1)); }
}
const newIds = new Set(rows.map((r) => r.job_id));
const toDelete = db.filter((r) => !newIds.has(r.job_id));

const f = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const dbTotal = db.reduce((s, r) => s + Number(r.amount || 0), 0);
const newTotal = rows.reduce((s, r) => s + r.amount, 0);

console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
console.log(`Sheet: ${allRows.length} แถว | job_id ไม่ซ้ำ ${byId.size} | ใช้ได้ (win) ${rows.length}`);
console.log(`  ข้าม: ไม่ใช่ win ${skipNotWin} | ไม่มี win_date ${skipNoDate} | กลุ่มงานไม่รู้จัก ${skipNoGroup}${unknownGroups.size ? " " + JSON.stringify(Object.fromEntries(unknownGroups)) : ""}`);
console.log(`  ไม่ระบุร้าน: ${dealerNone}`);
console.log(`ฐานข้อมูล: ${db.length} งาน | ยอด ${f(dbTotal)}  →  หลัง sync: ${rows.length} งาน | ยอด ${f(newTotal)}  (ต่าง ${f(newTotal - dbTotal)})`);
console.log(`\nเพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length}`);
if (changedFields.size) console.log(`  ฟิลด์ที่เปลี่ยน: ${JSON.stringify(Object.fromEntries(changedFields))}`);

const byMonth = (list, amt) => {
  const m = {};
  list.forEach((x) => { const p = x.period ?? "-"; (m[p] ??= { n: 0, a: 0 }); m[p].n++; m[p].a += Number(amt(x) || 0); });
  return Object.entries(m).sort().map(([p, v]) => `${p}: ${v.n} งาน ${f(v.a)}`).join(" | ");
};
if (toInsert.length) console.log(`  เพิ่มตามเดือน → ${byMonth(toInsert, (x) => x.amount)}`);
if (toDelete.length) {
  console.log("  ลบ (ไม่อยู่ใน Sheet แล้ว หรือไม่ใช่ win แล้ว):");
  toDelete.forEach((x) => {
    const inSheet = byId.get(x.job_id);
    const why = inSheet ? `สถานะใน Sheet = ${S(inSheet, "sale_status") || "(ว่าง)"}` : "ไม่มีใน Sheet";
    console.log(`    ${x.job_code ?? x.job_id} | ${x.period} | ${f(x.amount)} | ${x.dealer_name ?? "ไม่ระบุร้าน"} | ${why}`);
  });
}
if (toUpdate.length) {
  console.log("  แก้:");
  toUpdate.slice(0, 20).forEach(({ r, cur, diff }) =>
    console.log(`    ${r.job_code ?? r.job_id} | ${diff.map((k) => `${k}: ${cur[k] ?? "∅"} → ${r[k] ?? "∅"}`).join(" ; ")}`));
  if (toUpdate.length > 20) console.log(`    ... อีก ${toUpdate.length - 20} รายการ`);
}

/* ---- กันพัง ---- */
const dropAmt = dbTotal > 0 ? (dbTotal - newTotal) / dbTotal : 0;
const dropCnt = db.length > 0 ? (db.length - rows.length) / db.length : 0;
if ((dropAmt > MAX_DROP || dropCnt > MAX_DROP) && !FORCE) {
  console.error(`\nหยุด: ยอด/จำนวนงานลดลงเกิน ${MAX_DROP * 100}% (ยอด ${(dropAmt * 100).toFixed(1)}%, งาน ${(dropCnt * 100).toFixed(1)}%) — ไฟล์อาจไม่ครบ ใช้ --force ถ้าตั้งใจ`);
  process.exit(2);
}

if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อ sync จริง"); process.exit(0); }

/* ---- เขียน: upsert ก่อน แล้วค่อยลบ (ข้อมูลเดิมไม่หายถ้า upsert ล้มเหลว) ---- */
const upserts = [...toInsert, ...toUpdate.map((u) => u.r)];
const CHUNK = 500;
for (let i = 0; i < upserts.length; i += CHUNK) {
  const { error } = await sb.from("ba_service_sales_lines").upsert(upserts.slice(i, i + CHUNK), { onConflict: "job_id" });
  if (error) { console.error("\nupsert ไม่สำเร็จ:", error.message); process.exit(1); }
}
const delIds = toDelete.map((x) => x.job_id);
for (let i = 0; i < delIds.length; i += CHUNK) {
  const { error } = await sb.from("ba_service_sales_lines").delete().in("job_id", delIds.slice(i, i + CHUNK));
  if (error) { console.error("\nลบไม่สำเร็จ:", error.message); process.exit(1); }
}
const { count } = await sb.from("ba_service_sales_lines").select("id", { count: "exact", head: true });
console.log(`\nDONE: เพิ่ม ${toInsert.length} | แก้ ${toUpdate.length} | ลบ ${toDelete.length} | ในตารางตอนนี้ ${count} งาน`);
// ผูกพนักงาน (rep_code/sales_name จาก ba_incentive_lines ด้วย job_code) ให้งานใหม่
{ const { data, error } = await sb.rpc("refresh_service_sales_reps"); console.log(error ? `refresh reps ไม่สำเร็จ: ${error.message}` : `refresh reps: ${JSON.stringify(data)}`); }
