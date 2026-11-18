/* รายการสินค้า DECAAR สำหรับฟอร์มขอ BOQ (boq_products)
   - ต้นทาง: commission-app/แบบฟอร์มonline/Maketing/น้องเมย์ 11.2026/1CeilingWall_LP_Update_20260731.xlsx
     เฉพาะ sheet ที่ชื่อมี DECAAR
   - หน่วยพื้นที่: มี "ราคาต่อ ม." = m (ความยาว) ; มี "ราคาขาย บ./ตรม." = area (กว้าง x ยาว)
     ไม่มีทั้งคู่ = อุปกรณ์ (คลิป กาว สีซ่อม ฯลฯ) -> ไม่นำเข้า (ห้องแบบใส่ใน BOQ เอง)
     ยกเว้น sheet "DECAAR _1" (ผนังทั้งหมด = area แม้ช่องราคา/ตรม. เป็น "-")
   - upsert ตามรหัส S4 ; รหัสที่หายจากไฟล์ -> is_active = false (ไม่ลบ เพราะคำขอเก่าอ้างอยู่)
   DRY RUN: node scripts/import-boq-products.mjs [--file <path>]
   APPLY:   node scripts/import-boq-products.mjs --apply
*/
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const fi = process.argv.indexOf("--file");
const FILE = fi > 0 ? process.argv[fi + 1] : "commission-app/แบบฟอร์มonline/Maketing/น้องเมย์ 11.2026/1CeilingWall_LP_Update_20260731.xlsx";
const LINE = "decaar";
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const wb = XLSX.read(readFileSync(FILE));
const out = new Map();
let skipped = 0;
let sort = 0;
for (const n of wb.SheetNames.filter((s) => /decaar/i.test(s))) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" }).map((r) => r.map((v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v)));
  const hi = rows.findIndex((r) => r.some((c) => c === "ชื่อสินค้า"));
  if (hi < 0) continue;
  const h = rows[hi].map(String);
  const I = (re) => h.findIndex((c) => re.test(c));
  const iName = I(/^ชื่อสินค้า$/), iS4 = I(/S4/), iR3 = I(/R3/), iSize = I(/^ขนาด|กว้างxยาว/), iSqm = I(/ราคาขาย บ\.\/ตรม/), iM = I(/ราคาต่อ ม/);
  let g = "", s = "";
  for (const r of rows.slice(hi + 1)) {
    if (r[0]) g = String(r[0]);
    if (r[1]) s = String(r[1]);
    const name = String(r[iName] || "");
    const code = String(r[iS4] || "").trim();
    if (!name || !/^\d{6,}$/.test(code)) continue;
    const num = (i) => i >= 0 && typeof r[i] === "number" && r[i] > 0;
    const unit = num(iM) ? "m" : num(iSqm) || n === "DECAAR _1" ? "area" : null;
    if (!unit) { skipped++; continue; }
    if (out.has(code)) continue; // รหัสซ้ำข้าม sheet ใช้ตัวแรก
    out.set(code, { code, line: LINE, r3: String(r[iR3] || "") || null, name, grp: g || null, sub: s || null, size: String(r[iSize] || "") || null, unit, is_active: true, sort: ++sort, updated_at: new Date().toISOString() });
  }
}
const list = [...out.values()];
const { data: existing, error } = await sb.from("boq_products").select("code,is_active").eq("line", LINE);
if (error) { console.error(error.message); process.exit(1); }
const gone = (existing ?? []).filter((e) => e.is_active && !out.has(e.code)).map((e) => e.code);
const units = list.reduce((a, p) => ((a[p.unit] = (a[p.unit] ?? 0) + 1), a), {});
console.log(`${APPLY ? "APPLY" : "DRY RUN"} · สินค้า ${list.length} (${JSON.stringify(units)}) · อุปกรณ์ที่ไม่นำเข้า ${skipped} · ในฐานข้อมูลเดิม ${existing?.length ?? 0} · จะปิด ${gone.length}`);
if (!APPLY) process.exit(0);
for (let i = 0; i < list.length; i += 200) {
  const { error: e } = await sb.from("boq_products").upsert(list.slice(i, i + 200), { onConflict: "code" });
  if (e) { console.error(e.message); process.exit(1); }
}
if (gone.length) {
  const { error: e } = await sb.from("boq_products").update({ is_active: false }).in("code", gone);
  if (e) { console.error(e.message); process.exit(1); }
}
console.log("เสร็จ");
