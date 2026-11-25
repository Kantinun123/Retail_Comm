/* นำเข้ายอดจ่าย back margin จริง จากไฟล์สรุป data (22).xlsx (ชีต "backmargin") -> back_margin_payouts
   -------------------------------------------------------------
   ชีต "backmargin" (header แถว 1): วันที่ดึงข้อมูล | Region | Dealer Code2 | Dealer Name | Rebate Amount | วันที่ทำจ่าย
   - วันที่ดึงข้อมูล / วันที่ทำจ่าย = เลขวันที่ Excel (serial) ; เดือน (period) = เดือนของ "วันที่ดึงข้อมูล" (สิ้นเดือนขาย)
   - Rebate Amount ว่าง / " - " = 0 ; วันที่ทำจ่ายที่เป็นข้อความ (เช่น "ระหว่างดำเนินการ") หรือว่าง = ยังไม่มีวันที่จ่าย (null)
   - ชีตเดิม "Sheet1" (รูปแบบเก่า) ไม่ใช้แล้ว
   - ไฟล์มีย้อนหลังถึงปี 2567 แต่แอปมีรายการขายเฉพาะปี 2569 -> นำเข้าตั้งแต่ --from (ค่าเริ่มต้น 2026-01)
     (นำเข้าเดือนที่ไม่มีรายการขาย = แอปแสดงเป็นเดือนที่มีแต่ยอดจ่าย และยอดรวมของหน้าสรุปผลประโยชน์จะรวมไปด้วย)
   - เขียนแบบปลอดภัยต่อระบบที่ใช้งานอยู่: upsert ก่อน (period,dealer_code) แล้วลบเฉพาะแถวในช่วง >= --from ที่ไม่อยู่ในไฟล์แล้ว
     (ไม่ลบทั้งตารางก่อนใส่ ไม่มีช่วงที่ตารางว่าง) ; แถวก่อน --from ไม่ถูกแตะ
   - region / dealer_name ในตารางนี้แอปไม่ได้ใช้ (ใช้แค่ period, dealer_code, rebate_amount, paid_date)
   DRY RUN: node scripts/import-backmargin-payouts.mjs [--from=2026-01]
   APPLY:   node scripts/import-backmargin-payouts.mjs [--from=2026-01] --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
const APPLY = process.argv.includes("--apply");
const FROM = (process.argv.find((a) => a.startsWith("--from=")) ?? "--from=2026-01").slice("--from=".length).trim();
if (!/^\d{4}-\d{2}$/.test(FROM)) { console.error("--from ต้องเป็นรูปแบบ YYYY-MM"); process.exit(1); }
const DIR = "commission-app/back margin 2026";
const FILE = "data (22).xlsx";
const SHEET = "backmargin";
/* ---- env ---- */
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const str = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s === "" ? null : s; };
// เลขวันที่ Excel -> YYYY-MM-DD (ไม่ใช่ตัวเลข = null)
const serial = (v) => {
  if (typeof v !== "number") return null;
  const d = XLSX.SSF.parse_date_code(v);
  return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
};
/* ---- อ่านไฟล์ ---- */
const wb = XLSX.read(readFileSync(join(DIR, FILE)), { type: "buffer" });
if (!wb.Sheets[SHEET]) { console.error(`ไม่พบชีต "${SHEET}" ในไฟล์ (มี: ${wb.SheetNames.join(", ")})`); process.exit(1); }
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, blankrows: false });
const H = {};
(rows[0] ?? []).forEach((c, i) => (H[String(c).trim()] = i));
for (const k of ["วันที่ดึงข้อมูล", "Dealer Code2", "Rebate Amount", "วันที่ทำจ่าย"]) {
  if (H[k] === undefined) { console.error(`ชีต "${SHEET}" ขาดคอลัมน์ "${k}"`); process.exit(1); }
}
const merged = new Map(); // period|dealer -> rec
let skippedBefore = 0, skippedBad = 0, zeroAmt = 0, textDate = 0, noDate = 0, mergedDup = 0;
const weird = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const pull = serial(row[H["วันที่ดึงข้อมูล"]]);
  const code = str(row[H["Dealer Code2"]]);
  if (!pull || !code) { skippedBad++; continue; }
  const period = pull.slice(0, 7);
  if (period < FROM) { skippedBefore++; continue; }
  // ยอด: ว่าง / " - " = 0 ; ข้อความอื่นที่แปลงไม่ได้ = แจ้งเตือน (นับเป็น 0)
  const raw = row[H["Rebate Amount"]];
  let amount = 0;
  if (typeof raw === "number") amount = raw;
  else {
    const t = String(raw ?? "").replace(/[,\s]/g, "");
    if (t === "" || t === "-") zeroAmt++;
    else if (Number.isFinite(Number(t))) amount = Number(t);
    else { zeroAmt++; weird.push(`แถว ${r + 1}: ยอด "${raw}"`); }
  }
  amount = Math.round(amount * 100) / 100;
  const rawPaid = row[H["วันที่ทำจ่าย"]];
  const paid = serial(rawPaid);
  if (!paid) { if (rawPaid === undefined || rawPaid === null || rawPaid === "") noDate++; else textDate++; }
  const key = `${period}|${code}`;
  const old = merged.get(key);
  if (old) {
    mergedDup++;
    old.rebate_amount = Math.round((old.rebate_amount + amount) * 100) / 100;
    if (paid && (!old.paid_date || paid > old.paid_date)) old.paid_date = paid;
  } else {
    merged.set(key, { period, dealer_code: code, dealer_name: str(row[H["Dealer Name"]]), region: str(row[H["Region"]]), rebate_amount: amount, paid_date: paid });
  }
}
const recs = [...merged.values()].sort((a, b) => a.period.localeCompare(b.period) || a.dealer_code.localeCompare(b.dealer_code));
const perMonth = new Map();
for (const r of recs) {
  const p = perMonth.get(r.period) ?? { rows: 0, amt: 0, dates: new Set() };
  p.rows++; p.amt += r.rebate_amount; p.dates.add(r.paid_date ?? "(ยังไม่มี)"); perMonth.set(r.period, p);
}
console.log(`${APPLY ? "APPLY" : "DRY RUN"} | ไฟล์ ${FILE} ชีต "${SHEET}" | นำเข้าตั้งแต่ ${FROM} | อ่านได้ ${recs.length} แถว`);
console.log(`  ข้าม: ก่อน ${FROM} = ${skippedBefore} แถว, ไม่มีวันที่/รหัสร้าน = ${skippedBad} | ยอดว่าง/ขีด (นับ 0) = ${zeroAmt} | วันที่จ่ายเป็นข้อความ = ${textDate}, ว่าง = ${noDate} | รวมแถวซ้ำ (เดือน+ร้านเดียวกัน) = ${mergedDup}`);
weird.forEach((w) => console.log("  ⚠", w));
console.log("\n=== ยอดจ่ายต่อเดือน ===");
let grand = 0;
for (const p of [...perMonth.keys()].sort()) {
  const v = perMonth.get(p);
  console.log(`  ${p} | ร้าน ${String(v.rows).padStart(2)} | ยอดจ่าย ${v.amt.toLocaleString(undefined, { maximumFractionDigits: 2 }).padStart(12)} | วันที่จ่าย ${[...v.dates].sort().join(", ")}`);
  grand += v.amt;
}
console.log(`  รวม: ${grand.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

/* ---- เทียบกับข้อมูลในฐานข้อมูลช่วงเดียวกัน ---- */
const existing = [];
for (let f = 0; ; f += 1000) {
  const { data, error } = await sb.from("back_margin_payouts").select("id,period,dealer_code,rebate_amount,paid_date").gte("period", FROM).order("id").range(f, f + 999);
  if (error) { console.error("อ่านข้อมูลเดิมล้มเหลว:", error.message); process.exit(1); }
  existing.push(...data);
  if (data.length < 1000) break;
}
const exMap = new Map(existing.map((e) => [`${e.period}|${e.dealer_code}`, e]));
let same = 0, changed = 0, added = 0;
const changes = [];
for (const r of recs) {
  const e = exMap.get(`${r.period}|${r.dealer_code}`);
  if (!e) { added++; continue; }
  if (Math.abs(Number(e.rebate_amount) - r.rebate_amount) > 0.005 || (e.paid_date ?? null) !== r.paid_date) {
    changed++;
    changes.push(`${r.period} ${r.dealer_code}: ${e.rebate_amount}/${e.paid_date} -> ${r.rebate_amount}/${r.paid_date}`);
  } else same++;
}
const stale = existing.filter((e) => !merged.has(`${e.period}|${e.dealer_code}`));
console.log(`\n=== เทียบกับฐานข้อมูล (ช่วง >= ${FROM}, เดิม ${existing.length} แถว) ===`);
console.log(`  เหมือนเดิม ${same} | แก้ไข ${changed} | เพิ่มใหม่ ${added} | จะถูกลบ (ไม่อยู่ในไฟล์แล้ว) ${stale.length}`);
changes.slice(0, 10).forEach((c) => console.log("   แก้:", c));
stale.slice(0, 10).forEach((e) => console.log("   ลบ:", e.period, e.dealer_code, e.rebate_amount));
if (!APPLY) {
  console.log("\n(DRY RUN) ยังไม่เขียน DB. เพิ่ม --apply เพื่อนำเข้าจริง");
  process.exit(0);
}
/* ---- APPLY: upsert ก่อน แล้วลบเฉพาะแถวตกค้าง (ตารางไม่มีช่วงที่ว่าง) ---- */
const CHUNK = 500;
let done = 0;
for (let i = 0; i < recs.length; i += CHUNK) {
  const { error } = await sb.from("back_margin_payouts").upsert(recs.slice(i, i + CHUNK), { onConflict: "period,dealer_code" });
  if (error) { console.error("upsert ล้มเหลว:", error.message); process.exit(1); }
  done += Math.min(CHUNK, recs.length - i);
}
console.log(`\nupserted ${done} แถว`);
if (stale.length) {
  const ids = stale.map((e) => e.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await sb.from("back_margin_payouts").delete().in("id", ids.slice(i, i + CHUNK));
    if (error) { console.error("ลบแถวตกค้างล้มเหลว:", error.message); process.exit(1); }
  }
  console.log(`ลบแถวที่ไม่อยู่ในไฟล์แล้ว ${ids.length} แถว`);
}
console.log("DONE back_margin_payouts");
