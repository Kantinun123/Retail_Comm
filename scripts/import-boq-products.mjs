/* รายการสินค้า DECAAR สำหรับฟอร์มขอ BOQ (boq_products)
   - ต้นทาง: commission-app/แบบฟอร์มonline/Maketing/น้องเมย์ 11.2026/1CeilingWall_LP_Update_20260731.xlsx
     อ่านทุก sheet (รวม MTO) แล้วจัดเข้า 18 กลุ่ม dropdown (boq_products.menu) ตาม MENUS ด้านล่าง
     (รายการกลุ่มจาก Marketing 20 พ.ย. 69 ; ผู้ใช้ยืนยัน: รวม MTO, โมดิน่ารวม Lite, ALU-X กล่องรวม ECO)
   - ไม่นำเข้า: อุปกรณ์/สี (คลิป กาว สกรู สีซ่อม Sealant ฯลฯ — ห้องแบบใส่ใน BOQ เอง) และสินค้าที่ไม่อยู่ใน 18 กลุ่ม
   - หน่วย: ไม้เชิงชาย / ซีชาแนล / บัวผนัง = m (ความยาว) ; ที่เหลือ = area (กว้าง x ยาว)
   - upsert ตามรหัส S4 ; รหัสที่ไม่อยู่ใน 18 กลุ่ม -> is_active = false (ไม่ลบ เพราะคำขอเก่าอ้างอยู่)
   - --report <file.xlsx> เขียนไฟล์ตรวจ mapping ทุก SKU
   DRY RUN: node scripts/import-boq-products.mjs [--file <path>] [--report <out.xlsx>]
   APPLY:   node scripts/import-boq-products.mjs --apply
*/
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes("--apply");
const FILE = arg("--file") ?? "commission-app/แบบฟอร์มonline/Maketing/น้องเมย์ 11.2026/1CeilingWall_LP_Update_20260731.xlsx";
const REPORT = arg("--report");
const LINE = "decaar";

/* 18 กลุ่ม dropdown (ลำดับ = ลำดับที่แสดง) ; test(p) รับ { sheet, k: "grp|sub" lowercase, name } */
const MENUS = [
  { label: "กรุผนัง – SCG DECAAR ไม้ผนัง NEX", unit: "area", test: (p) => p.sheet === "Core Wood_1" && /nex/.test(p.k) },
  { label: "กรุผนัง/ฝ้า – SCG DECAAR บังใบ NEX", unit: "area", test: (p) => /บังใบ nex/.test(p.k) },
  { label: "กรุผนัง – SCG DECAAR โมดิน่า", unit: "area", test: (p) => /modeena/.test(p.k) },
  { label: "กรุผนัง – SCG DECAAR โมดิช", unit: "area", test: (p) => /modish/.test(p.k) },
  { label: "กรุผนัง/ฝ้า – SCG DECAAR โคเต้", unit: "area", test: (p) => /coate/.test(p.k) },
  { label: "กรุผนัง/ฝ้า – SCG DECAAR ไม้ไลน์", unit: "area", test: (p) => /plank-line/.test(p.k) },
  { label: "กรุผนัง/ฝ้า – SCG DECAAR วูดดี", unit: "area", test: (p) => p.sheet === "DECAAR_WOOD-D" && /digital/.test(p.k) },
  { label: "กรุผนัง – SCG DECAAR สโตเนวา", unit: "area", test: (p) => /stoneva/.test(p.k) },
  { label: "กรุผนัง – SCG DECAAR เคมิว", unit: "area", test: (p) => p.sheet === "KMEW" },
  { label: "กรุผนัง/ฝ้า – SCG DECAAR ALU-X แบบกล่อง", unit: "area", test: (p) => /alu-x box/.test(p.k) || (p.sheet === "MTO" && /alu-x/.test(p.k) && !/cw100/i.test(p.name)) },
  { label: "กรุผนัง/ฝ้า – SCG DECAAR ALU-X CW100", unit: "area", test: (p) => /alu-x siding/.test(p.k) || (p.sheet === "MTO" && /alu-x/.test(p.k) && /cw100/i.test(p.name)) },
  { label: "กรุพื้น – ไม้พื้น SCG เซฟเวอร์ สีซีเมนต์", unit: "area", test: (p) => /floor\|saver/.test(p.k) },
  { label: "กรุพื้น – ไม้พื้น SCG DECAAR ทีคลิปซีลด์", unit: "area", test: (p) => /floor\|t-clip/.test(p.k) },
  { label: "กรุพื้น – ไม้พื้น SCG DECAAR WOODSENSE (WPC)", unit: "area", test: (p) => /wpc|woodsense/.test(p.k) },
  { label: "เอนกประสงค์ – ไม้เชิงชาย SCG", unit: "m", test: (p) => /fascia/.test(p.k) && p.sheet !== "Sun" },
  { label: "เอนกประสงค์ – SCG DECAAR ซีชาแนลไฟเบอร์ซีเมนต์", unit: "m", test: (p) => /\|c-channel$/.test(p.k) },
  { label: "เอนกประสงค์ – SCG DECAAR ซีชาแนล ไพร์ม", unit: "m", test: (p) => /c-channel prime/.test(p.k) },
  { label: "เอนกประสงค์ – SCG DECAAR บัวผนัง", unit: "m", test: (p) => /wall trim/.test(p.k) },
];
const ACC_SHEETS = new Set(["Smart Board Accessories", "สีย้อมไม้", "WoodSUB Accessories", "DECAAR_ALU-X ACC"]);
const isAccessory = (p) => ACC_SHEETS.has(p.sheet) || /accessor|อุปกรณ์|touch up|sealant|screw|สีเก็บงาน|ไม้ปิดขอบ|soffit/i.test(p.k);

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const wb = XLSX.read(readFileSync(FILE));
const clean = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v);
const out = new Map();
const report = [];
let sort = 0;
for (const n of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" }).map((r) => r.map(clean));
  const hi = rows.findIndex((r) => r.some((c) => c === "ชื่อสินค้า"));
  if (hi < 0) continue;
  const h = rows[hi].map(String);
  const I = (re) => h.findIndex((c) => re.test(c));
  const iName = I(/^ชื่อสินค้า$/), iS4 = I(/S4/), iR3 = I(/R3/), iSize = I(/^ขนาด|กว้างxยาว/);
  let g = "", s = "";
  for (const r of rows.slice(hi + 1)) {
    if (r[0] !== "" && iName !== 0) g = String(r[0]);
    if (r[1] !== "" && iName !== 1) s = String(r[1]);
    const name = String(r[iName] || "");
    const code = String(r[iS4] || "").trim();
    if (!name || !/^\d{6,}$/.test(code) || out.has(code) || report.some((x) => x.code === code)) continue;
    const p = { sheet: n, k: `${g}|${s}`.toLowerCase(), name };
    const mi = isAccessory(p) ? -1 : MENUS.findIndex((m) => m.test(p));
    report.push({ code, name, sheet: n, grp: g, sub: s, menu: mi >= 0 ? MENUS[mi].label : isAccessory(p) ? "(อุปกรณ์/สี)" : "(ไม่อยู่ใน 18 กลุ่ม)" });
    if (mi < 0) continue;
    out.set(code, {
      code, line: LINE, r3: String(r[iR3] || "") || null, name, grp: g || null, sub: s || null,
      size: String(r[iSize] || "") || null, unit: MENUS[mi].unit, menu: MENUS[mi].label, menu_sort: mi + 1,
      is_active: true, sort: 0, _seq: ++sort, updated_at: new Date().toISOString(),
    });
  }
}
/* เรียงตามกลุ่ม dropdown แล้วตามลำดับในไฟล์ */
const list = [...out.values()].sort((a, b) => a.menu_sort - b.menu_sort || a._seq - b._seq).map((p, i) => { const { _seq, ...rest } = p; return { ...rest, sort: i + 1 }; });

const { data: existing, error } = await sb.from("boq_products").select("code,is_active").eq("line", LINE);
if (error) { console.error(error.message); process.exit(1); }
const had = new Set((existing ?? []).map((e) => e.code));
const gone = (existing ?? []).filter((e) => e.is_active && !out.has(e.code)).map((e) => e.code);
console.log(`${APPLY ? "APPLY" : "DRY RUN"} · ในกลุ่ม dropdown ${list.length} (ใหม่ ${list.filter((p) => !had.has(p.code)).length}) · ในฐานข้อมูลเดิม ${existing?.length ?? 0} · จะซ่อน ${gone.length}`);
MENUS.forEach((m, i) => console.log(`  ${String(i + 1).padStart(2)}. ${m.label} : ${list.filter((p) => p.menu_sort === i + 1).length}`));
if (REPORT) {
  const w = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(w, XLSX.utils.json_to_sheet(report), "mapping");
  XLSX.writeFile(w, REPORT);
  console.log("report ->", REPORT);
}
if (!APPLY) process.exit(0);
for (let i = 0; i < list.length; i += 200) {
  const { error: e } = await sb.from("boq_products").upsert(list.slice(i, i + 200), { onConflict: "code" });
  if (e) { console.error(e.message); process.exit(1); }
}
if (gone.length) {
  const { error: e } = await sb.from("boq_products").update({ is_active: false, menu: null, menu_sort: null }).in("code", gone);
  if (e) { console.error(e.message); process.exit(1); }
}
console.log("เสร็จ");
