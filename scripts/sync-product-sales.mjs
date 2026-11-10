/* Sync ยอดขายสินค้า (สรุปรายเดือน) -> product_sales_lines
   -------------------------------------------------------------
   แหล่ง (เลือกด้วย --source di|odoo ; ไม่ใส่ = ทั้งสอง):
   - di   : hpb_salesout_details.csv  (คั่นด้วย ; , ภาษาไทย windows-874) — Housing Expert
            วันที่ ReformatSalesDate (YYYYMMDD), ยอด Netamount, จำนวน Qty, กลุ่ม MISL5_Name, พนักงาน SaleName (สำรอง SaleCode)
            แถวที่คอลัมน์ไม่ครบ (ต้นทางส่งออกขาด): ใช้เฉพาะช่องที่ยังอยู่ตำแหน่งเดิม ช่องที่ไม่แน่ใจ -> "ไม่ระบุ"
   - odoo : odoo_hpb_vendor_sales_detail.xlsx (อ่านแบบ stream) — SCG Home
            วันที่ date, ยอด sales, จำนวน qty, กลุ่ม MCH2, พนักงาน sale_pc_name
   - ระดับ: เดือน × ร้าน × กลุ่มสินค้า × พนักงาน ; ตั้งแต่ 2025-01 ; ไม่เก็บลูกค้า/เลขบิล
   - sync ด้วย row_key (เพิ่ม/แก้/ลบ ต่อแหล่ง) ; กันพัง: ยอดรวมของแหล่งลดลงเกิน 30% -> หยุด (--force)
   ไฟล์ดีฟอลต์อยู่ในโฟลเดอร์ OneDrive ที่ sync จาก SharePoint RFS ; เปลี่ยนด้วย --di <path> / --odoo <path>

   DRY RUN: node scripts/sync-product-sales.mjs [--source di|odoo]
   APPLY:   node scripts/sync-product-sales.mjs --apply [--source di|odoo] [--force]
*/
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { streamXlsxRows, excelDate } from "./lib/xlsx-stream.mjs";

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const ONLY = arg("--source");
const BASE = "D:/OneDrive - The Siam Cement Public Company Limited/";
const DI_FILE = arg("--di") ?? BASE + "RSS  System - rawdata_di/hpb_salesout_details.csv";
const ODOO_FILE = arg("--odoo") ?? BASE + "RSS  System - rawdata_odoo/odoo_hpb_vendor_sales_detail.xlsx";
const SINCE = "2025-01";
const MAX_DROP = 0.3;
const NA = "ไม่ระบุ";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: dealers, error: dErr } = await sb.from("dealers").select("code,name,model");
if (dErr) { console.error("โหลด dealers ไม่สำเร็จ:", dErr.message); process.exit(1); }
const dealerSet = new Map(dealers.map((d) => [d.code, d]));

const clean = (v) => { const s = String(v ?? "").replace(/\s+/g, " ").trim(); return s || null; };
const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };

/** เพิ่มยอดเข้ากลุ่มสรุป */
function makeAgg(source) {
  const map = new Map();
  const stat = { lines: 0, before: 0, badDate: 0, unknownDealer: new Map(), shifted: 0, naGroup: 0, naSales: 0, amount: 0 };
  const add = ({ date, dealer, group, sales, amount, qty }) => {
    stat.lines++;
    const period = date.slice(0, 7);
    const code = dealerSet.has(dealer) ? dealer : null;
    if (!code) stat.unknownDealer.set(dealer ?? "(ว่าง)", (stat.unknownDealer.get(dealer ?? "(ว่าง)") ?? 0) + 1);
    const g = group ?? NA, s = sales ?? NA;
    if (!group) stat.naGroup++;
    if (!sales) stat.naSales++;
    stat.amount += amount;
    const key = [source, period, code ?? `?${dealer ?? ""}`, g, s].join("|");
    let a = map.get(key);
    if (!a) {
      a = { row_key: key, source, period, dealer_code: code, source_dealer: dealer, product_group: g, salesperson: s, amount: 0, qty: 0, line_count: 0, last_sale_date: null };
      map.set(key, a);
    }
    a.amount += amount; a.qty += qty; a.line_count++;
    if (!a.last_sale_date || date > a.last_sale_date) a.last_sale_date = date;
  };
  return { map, stat, add };
}

/* ---------------- DI ---------------- */
async function readDi() {
  const agg = makeAgg("di");
  const split = (line) => { const r = []; let f = "", q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ";") { r.push(f); f = ""; } else f += c; } r.push(f); return r; };
  const TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  let head = null, I = null;
  const onLine = (line) => {
    if (!line) return;
    if (!head) {
      head = split(line.replace(/^\uFEFF/, "")).map((h) => h.trim());
      I = Object.fromEntries(head.map((h, i) => [h, i]));
      for (const k of ["DealerCode", "ReformatSalesDate", "Netamount", "Qty", "MISL5_Name", "SaleName", "SaleCode"]) if (!(k in I)) throw new Error(`DI: ไม่พบคอลัมน์ ${k}`);
      return;
    }
    const r = split(line);
    // แถวไม่ครบ: ถ้าช่องท้ายเป็น timestamp แปลว่า 2 ช่องท้าย = created/modified -> ช่องที่เชื่อได้ = ก่อนหน้านั้น
    let valid = r.length;
    if (r.length !== head.length) {
      agg.stat.shifted++;
      if (TS.test((r[r.length - 1] ?? "").trim())) valid = r.length - 2;
    }
    const at = (k) => (I[k] < valid ? r[I[k]] : null);
    const d = String(at("ReformatSalesDate") ?? "").trim();
    if (!/^\d{8}$/.test(d)) { agg.stat.badDate++; return; }
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    if (date.slice(0, 7) < SINCE) { agg.stat.before++; return; }
    agg.add({
      date,
      dealer: clean(at("DealerCode")),
      group: clean(at("MISL5_Name")),
      sales: clean(at("SaleName")) ?? clean(at("SaleCode")),
      amount: num(at("Netamount")),
      qty: num(at("Qty")),
    });
  };
  const dec = new TextDecoder("windows-874");
  let buf = "";
  await new Promise((res, rej) => {
    const st = createReadStream(DI_FILE);
    st.on("data", (c) => {
      buf += dec.decode(c, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { try { onLine(buf.slice(0, i).replace(/\r$/, "")); } catch (e) { st.destroy(); rej(e); return; } buf = buf.slice(i + 1); }
    });
    st.on("end", () => { buf += dec.decode(); if (buf) onLine(buf.replace(/\r$/, "")); res(); });
    st.on("error", rej);
  });
  return agg;
}

/* ---------------- Odoo ---------------- */
async function readOdoo() {
  const agg = makeAgg("odoo");
  let I = null;
  for await (const r of streamXlsxRows(ODOO_FILE)) {
    if (!I) {
      I = Object.fromEntries(r.map((h, i) => [String(h ?? "").trim(), i]));
      for (const k of ["date", "dealer_code", "MCH2", "sales", "qty", "sale_pc_name"]) if (!(k in I)) throw new Error(`Odoo: ไม่พบคอลัมน์ ${k}`);
      continue;
    }
    const date = excelDate(r[I.date]);
    if (!date) { agg.stat.badDate++; continue; }
    if (date.slice(0, 7) < SINCE) { agg.stat.before++; continue; }
    agg.add({
      date,
      dealer: clean(r[I.dealer_code]),
      group: clean(r[I.MCH2]),
      sales: clean(r[I.sale_pc_name]),
      amount: num(r[I.sales]),
      qty: num(r[I.qty]),
    });
  }
  return agg;
}

/* ---------------- sync ต่อแหล่ง ---------------- */
const f0 = (n) => Math.round(n).toLocaleString("en-US");
async function syncSource(source, file, reader) {
  const st = statSync(file);
  const t0 = Date.now();
  const agg = await reader();
  const rows = [...agg.map.values()].map((a) => ({ ...a, amount: Math.round(a.amount * 100) / 100, qty: Math.round(a.qty * 1000) / 1000 }));
  const s = agg.stat;
  console.log(`\n===== ${source.toUpperCase()} | ${file.split("/").pop()} (${(st.size / 1048576).toFixed(0)} MB, แก้ไข ${st.mtime.toISOString().slice(0, 16)}) | อ่าน ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`รายการที่ใช้ ${s.lines.toLocaleString()} | ก่อน ${SINCE} ${s.before.toLocaleString()} | วันที่อ่านไม่ได้ ${s.badDate} | แถวคอลัมน์ไม่ครบ ${s.shifted.toLocaleString()}`);
  console.log(`ยอดรวม ฿${f0(s.amount)} | กลุ่มไม่ระบุ ${s.naGroup.toLocaleString()} | พนักงานไม่ระบุ ${s.naSales.toLocaleString()} รายการ`);
  console.log(`ร้านที่ไม่อยู่ในระบบ: ${s.unknownDealer.size ? [...s.unknownDealer.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" ") : "ไม่มี"}`);
  const per = {};
  rows.forEach((r) => (per[r.period] = (per[r.period] ?? 0) + r.amount));
  console.log("ยอดต่อเดือน (ล้าน): " + Object.keys(per).sort().map((p) => `${p.slice(2)}:${(per[p] / 1e6).toFixed(1)}`).join(" "));
  const groups = new Set(rows.map((r) => r.product_group)), people = new Set(rows.map((r) => `${r.dealer_code}|${r.salesperson}`));
  console.log(`แถวสรุป ${rows.length.toLocaleString()} | กลุ่มสินค้า ${groups.size} | พนักงาน (ร้าน×ชื่อ) ${people.size}`);

  // DB
  const db = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("product_sales_lines").select("id,row_key,amount,qty,line_count,last_sale_date,dealer_code").eq("source", source).order("id").range(from, from + 999);
    if (error) throw new Error("อ่านฐานข้อมูลไม่สำเร็จ: " + error.message);
    db.push(...data); if (data.length < 1000) break;
  }
  const dbMap = new Map(db.map((x) => [x.row_key, x]));
  const toUp = rows.filter((r) => {
    const c = dbMap.get(r.row_key);
    return !c || Number(c.amount) !== r.amount || Number(c.qty) !== r.qty || c.line_count !== r.line_count || c.last_sale_date !== r.last_sale_date || c.dealer_code !== r.dealer_code;
  });
  const keys = new Set(rows.map((r) => r.row_key));
  const toDel = db.filter((x) => !keys.has(x.row_key));
  const dbTotal = db.reduce((a, x) => a + Number(x.amount), 0);
  const newTotal = rows.reduce((a, x) => a + x.amount, 0);
  console.log(`ฐานข้อมูล: ${db.length.toLocaleString()} แถว ฿${f0(dbTotal)} → เพิ่ม/แก้ ${toUp.length.toLocaleString()} | ลบ ${toDel.length.toLocaleString()} | หลัง sync ฿${f0(newTotal)}`);
  if (dbTotal > 0 && newTotal < dbTotal * (1 - MAX_DROP) && !FORCE) {
    console.error(`หยุด ${source}: ยอดรวมลดลงเกิน ${MAX_DROP * 100}% — ไฟล์อาจไม่ครบ ใช้ --force ถ้าตั้งใจ`);
    return 2;
  }
  if (!APPLY) return 0;
  const now = new Date().toISOString();
  for (let i = 0; i < toUp.length; i += 1000) {
    const { error } = await sb.from("product_sales_lines").upsert(toUp.slice(i, i + 1000).map((r) => ({ ...r, synced_at: now })), { onConflict: "row_key" });
    if (error) throw new Error("upsert ไม่สำเร็จ: " + error.message);
    process.stdout.write(`\r  upsert ${Math.min(i + 1000, toUp.length)}/${toUp.length}`);
  }
  const ids = toDel.map((x) => x.id);
  for (let i = 0; i < ids.length; i += 500) {
    const { error } = await sb.from("product_sales_lines").delete().in("id", ids.slice(i, i + 500));
    if (error) throw new Error("ลบไม่สำเร็จ: " + error.message);
  }
  console.log(`\nDONE ${source}: เพิ่ม/แก้ ${toUp.length} | ลบ ${toDel.length}`);
  return 0;
}

console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
let code = 0;
try {
  if (!ONLY || ONLY === "di") code = Math.max(code, await syncSource("di", DI_FILE, readDi));
  if (!ONLY || ONLY === "odoo") code = Math.max(code, await syncSource("odoo", ODOO_FILE, readOdoo));
} catch (e) {
  console.error("ผิดพลาด:", e.message);
  process.exit(1);
}
if (!APPLY) console.log("\n(DRY RUN) เพิ่ม --apply เพื่อ sync จริง");
process.exit(code);
