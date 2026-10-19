/* เก็บตก OLD-: อ่าน CSV ที่ HR กรอกกลับ แล้ว UPDATE emp_code บน Supabase
   -------------------------------------------------------------
   รับไฟล์: commission-app/old-employees-for-hr.csv (ที่ HR เติมคอลัมน์แล้ว)
   คอลัมน์: emp_code_old,...,สถานะ(ลาออก/ตกหล่น/อื่นๆ),cr_ใหม่(ถ้าตกหล่น)

   กติกา:
     - แถวที่ "สถานะ" = "ตกหล่น" และมี "cr_ใหม่" ที่ถูกต้อง (CRxxxx) -> remap:
         employees.emp_code : OLD-xxx -> CRxxx
         sales.emp_code      : ตาม FK on update cascade (อัตโนมัติ)
         point_employees.emp_code : UPDATE แยก (เป็น PK ไม่ใช่ FK)
     - แถว "ลาออก"/ว่าง -> ข้าม (คง OLD- ไว้เป็น historical)
     - ถ้า cr_ใหม่ ชนกับ emp_code ที่มีอยู่แล้ว -> ข้าม + เตือน (ต้อง merge ไม่ใช่ rename)

   DRY RUN เป็นค่าเริ่มต้น: node scripts/apply-old-remap.mjs
   ลงจริง: node scripts/apply-old-remap.mjs --apply
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const CSV = "commission-app/old-employees-for-hr.csv";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---- parse CSV (รองรับ quoted) ---- */
function parseCsv(text) {
  const rows = [];
  let cur = [], field = "", inQ = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

const rows = parseCsv(readFileSync(CSV, "utf8"));
const header = rows[0].map((h) => h.trim());
const iOld = header.indexOf("emp_code_old");
const iStatus = header.findIndex((h) => h.startsWith("สถานะ"));
const iNew = header.findIndex((h) => h.startsWith("cr_ใหม่"));
if (iOld < 0 || iStatus < 0 || iNew < 0) {
  console.error("หัวคอลัมน์ไม่ครบ (ต้องมี emp_code_old / สถานะ / cr_ใหม่)");
  process.exit(1);
}

/* ---- เตรียมรายการ remap ---- */
const toRemap = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || !row[iOld]) continue;
  const oldCode = row[iOld].trim();
  const status = (row[iStatus] || "").trim();
  const newCode = (row[iNew] || "").trim();
  if (status === "ตกหล่น" && /^CR\d+$/.test(newCode)) {
    toRemap.push({ oldCode, newCode });
  }
}

console.log(`${APPLY ? "APPLY" : "DRY RUN"} | พบแถว 'ตกหล่น' พร้อม cr_ใหม่: ${toRemap.length}`);
if (!toRemap.length) { console.log("ไม่มีอะไรต้องทำ"); process.exit(0); }

/* ---- ตรวจ collision: cr_ใหม่ ต้องยังไม่มีใน employees ---- */
const { data: existing, error: exErr } = await sb
  .from("employees")
  .select("emp_code")
  .in("emp_code", toRemap.map((t) => t.newCode));
if (exErr) { console.error("เช็ค collision ล้มเหลว:", exErr.message); process.exit(1); }
const taken = new Set((existing ?? []).map((e) => e.emp_code));

const safe = [];
for (const t of toRemap) {
  if (taken.has(t.newCode)) {
    console.warn(`⚠️ ข้าม ${t.oldCode} -> ${t.newCode} : ${t.newCode} มีอยู่แล้ว (ต้อง merge ไม่ใช่ rename)`);
  } else {
    safe.push(t);
  }
}

console.log(`จะ remap ปลอดภัย: ${safe.length} คน`);
safe.forEach((t) => console.log(`  ${t.oldCode} -> ${t.newCode}`));

if (!APPLY) {
  console.log("\n(DRY RUN) ยังไม่ลงจริง. เพิ่ม --apply เพื่อดำเนินการ");
  process.exit(0);
}

/* ---- ลงจริง: UPDATE employees (sales cascade) + point_employees แยก ---- */
let ok = 0;
for (const t of safe) {
  // 1) employees (sales.emp_code ตามไปอัตโนมัติด้วย FK on update cascade)
  const e1 = await sb.from("employees").update({ emp_code: t.newCode }).eq("emp_code", t.oldCode);
  if (e1.error) { console.error(`FAIL employees ${t.oldCode}:`, e1.error.message); continue; }
  // 2) point_employees (PK แยก ไม่ cascade) — update ถ้ามีแถวนั้น
  const e2 = await sb.from("point_employees").update({ emp_code: t.newCode }).eq("emp_code", t.oldCode);
  if (e2.error) { console.error(`FAIL point_employees ${t.oldCode}:`, e2.error.message); continue; }
  ok++;
  console.log(`✓ ${t.oldCode} -> ${t.newCode}`);
}
console.log(`\nDONE remapped: ${ok}/${safe.length}`);
