/* =============================================================
   Import ข้อมูลพนักงานจาก 2 ไฟล์ -> sale_reps
   แหล่ง:
     A) SE Monitor (0.Store _ SE Data Monitor_23.04.26 (2).xlsx / sheet Store65_SE80_HS65_H15)
        -> level (Level 2025), start_date (วันเข้างาน), nickname, phone(Tel), dealer_code
        -> สร้างพนักงานใหม่ถ้า match ไม่ได้ (มี dealer code ชัดเจน) = "เพิ่มพนักงานร้านที่เหลือ"
     B) Training Reward (20261022_SCG Training Reward Points.xlsx / sheet members)
        -> birth_date, line_id, phone/phone2 (เฉพาะคนที่ match ได้ ไม่สร้างใหม่)

   กฎ: เติมเฉพาะช่องที่ว่างใน DB (ไม่ทับที่ admin กรอกเอง)
   ลำดับ field: level/start_date/nickname/phone <- SE Monitor ; birth_date/line_id <- Reward

   DRY RUN: node scripts/import-employee-data.mjs
   APPLY:   node scripts/import-employee-data.mjs --apply
   ============================================================= */
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---------- helpers ---------- */
const str = (v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const normName = (s) =>
  String(s ?? "")
    .replace(/^(นาย|นาง|นางสาว|น\.ส\.|น\.ส|คุณ)\s*/, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();

/** Excel serial -> YYYY-MM-DD */
function serialToDate(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
/** 'dd-mm-yyyy' -> 'yyyy-mm-dd' ; กรองวันเกิดที่ให้อายุนอกช่วง 15-70 ปี (ข้อมูลเพี้ยน) */
function dmyToIso(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  // sanity: อายุต้องอยู่ช่วง 15-70 ปี ไม่งั้นถือว่ากรอกผิด
  const age = (Date.now() - dt.getTime()) / (365.25 * 86400 * 1000);
  if (age < 15 || age > 70) return null;
  return iso;
}
/** normalize เบอร์ -> ตัวเลขล้วน (เทียบ dedup) ; คืน null ถ้าว่าง */
function normPhone(v) {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (!digits) return null;
  // เติม 0 นำหน้าถ้าหลุด (เลข 9 หลักจากไฟล์ที่ xlsx ตัด 0)
  return digits.length === 9 ? "0" + digits : digits;
}
/** map Level 2025 -> B/S/A ; อื่น ๆ (N/A, ว่าง) -> null */
function mapLevel(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.startsWith("begin")) return "B";
  if (s.startsWith("standard")) return "S";
  if (s.startsWith("advance")) return "A";
  return null;
}
/** format phone ให้สวย (เก็บแบบมีขีดถ้าไฟล์ให้มา ไม่งั้นเลขล้วน) */
function displayPhone(raw) {
  const s = String(raw ?? "").trim();
  return s || null;
}

function xlsx(file) {
  return XLSX.read(readFileSync(file), { type: "buffer" });
}

/* ---------- โหลด sale_reps ปัจจุบัน ---------- */
const { data: reps, error: repErr } = await sb
  .from("sale_reps")
  .select(
    "rep_code, name, dealer_code, nickname, level, start_date, birth_date, phone, phone2, line_id"
  );
if (repErr) {
  console.error(repErr.message);
  process.exit(1);
}
const byName = new Map();
for (const r of reps) if (r.name) byName.set(normName(r.name), r);

// dealer codes ที่มีจริง (กันสร้างพนักงานผูกร้านที่ไม่มี)
const { data: dealers } = await sb.from("dealers").select("code");
const dealerSet = new Set((dealers ?? []).map((d) => d.code));

/* =============================================================
   A) SE Monitor
   ============================================================= */
const SE_FILE = "commission-app/แต้มกิจกรรม/0.Store _ SE Data Monitor_23.04.26 (2).xlsx";
const seRaw = XLSX.utils.sheet_to_json(xlsx(SE_FILE).Sheets["Store65_SE80_HS65_H15"], {
  header: 1,
  blankrows: false,
  defval: "",
});
const SC = { dealer: 0, seName: 30, nick: 31, tel: 32, startSerial: 41, level2025: 47 };
const seRows = seRaw.slice(3).filter((r) => str(r[SC.seName]));

// patch สะสมต่อ rep_code (merge 2 แหล่ง) + รายการสร้างใหม่
const patches = new Map(); // rep_code -> {field: value}
const creates = []; // {name, dealer_code, nickname, level, start_date, phone}
let seMatched = 0,
  seCreate = 0,
  seNoDealer = 0;

function queuePatch(rep, field, value) {
  if (value == null) return;
  // เติมเฉพาะช่องว่างใน DB
  if (rep[field] != null && String(rep[field]).trim() !== "") return;
  if (!patches.has(rep.rep_code)) patches.set(rep.rep_code, {});
  const p = patches.get(rep.rep_code);
  // ถ้า field นี้ถูก queue ไว้แล้วจากแหล่งก่อน (ลำดับสูงกว่า) อย่าทับ
  if (p[field] === undefined) p[field] = value;
}

for (const r of seRows) {
  const hit = byName.get(normName(r[SC.seName]));
  const dealer = str(r[SC.dealer]);
  const nickname = str(r[SC.nick]);
  const level = mapLevel(r[SC.level2025]);
  const startDate = serialToDate(r[SC.startSerial]);
  const phone = displayPhone(r[SC.tel]);

  if (hit) {
    seMatched++;
    queuePatch(hit, "nickname", nickname);
    queuePatch(hit, "level", level);
    queuePatch(hit, "start_date", startDate);
    queuePatch(hit, "phone", phone);
    // เติม dealer_code ถ้า rep ยังไม่มีร้าน (ไม่ทับร้านเดิม)
    if (dealer && dealerSet.has(dealer)) queuePatch(hit, "dealer_code", dealer);
  } else {
    // สร้างใหม่ (เฉพาะมี dealer code ที่มีจริง)
    if (!dealer || !dealerSet.has(dealer)) {
      seNoDealer++;
      continue;
    }
    seCreate++;
    creates.push({
      name: str(r[SC.seName]),
      dealer_code: dealer,
      nickname,
      level,
      start_date: startDate,
      phone,
      position: "se", // ไฟล์นี้เป็น SE ทั้ง sheet
    });
  }
}

/* =============================================================
   B) Training Reward (เฉพาะคนที่ match ได้ -> birth_date, line_id, phone/phone2)
   ============================================================= */
const TR_FILE = "commission-app/แต้มกิจกรรม/20261022_SCG Training Reward Points.xlsx";
const trRows = XLSX.utils.sheet_to_json(xlsx(TR_FILE).Sheets["members"], { defval: "" });
const fullName = (r) =>
  `${String(r["First name"] ?? "").trim()} ${String(r["Last name"] ?? "").trim()}`.trim();

// รวมหลายแถวต่อคน -> เก็บเบอร์ทั้งหมด (dedup)
const trByName = new Map();
for (const r of trRows) {
  const k = normName(fullName(r));
  if (!k) continue;
  if (!trByName.has(k)) trByName.set(k, { rows: [], phones: new Set() });
  const g = trByName.get(k);
  g.rows.push(r);
  const p = normPhone(r["Phone number"]);
  if (p) g.phones.add(p);
}

let trMatched = 0;
for (const [k, g] of trByName) {
  const hit = byName.get(k);
  if (!hit) continue;
  trMatched++;
  const r0 = g.rows[0];
  queuePatch(hit, "birth_date", dmyToIso(r0["Date of Birth (dd-mm-yyyy)"]));
  queuePatch(hit, "line_id", str(r0["ชื่อไลน์ตัวเอง"]));
  // เบอร์: ถ้า DB ยังไม่มี phone -> ใส่เบอร์แรก ; เบอร์ที่ 2 (ถ้าต่าง) -> phone2
  const phones = [...g.phones];
  if (phones[0]) queuePatch(hit, "phone", phones[0]);
  if (phones[1]) queuePatch(hit, "phone2", phones[1]);
}

/* =============================================================
   รายงาน
   ============================================================= */
console.log("================ DRY RUN SUMMARY ================");
console.log(`sale_reps ปัจจุบัน: ${reps.length} | dealers: ${dealerSet.size}`);
console.log(`\n[A] SE Monitor: ${seRows.length} SE`);
console.log(`    match เดิม: ${seMatched} | สร้างใหม่: ${seCreate} | ข้าม(ไม่มี dealer code ที่ถูกต้อง): ${seNoDealer}`);
console.log(`\n[B] Training Reward: ${trByName.size} ชื่อไม่ซ้ำ -> match เดิม: ${trMatched}`);
console.log(`\nรวม: จะอัปเดต ${patches.size} คน | สร้างใหม่ ${creates.length} คน`);

// breakdown field ที่จะเติม
const fieldCount = {};
for (const [, p] of patches)
  for (const f of Object.keys(p)) fieldCount[f] = (fieldCount[f] || 0) + 1;
console.log("\nField ที่จะเติม (เฉพาะช่องว่าง):");
Object.entries(fieldCount).forEach(([f, c]) => console.log(`  ${c.toString().padStart(3)}  ${f}`));

console.log("\nตัวอย่าง patch 5 คนแรก:");
let shown = 0;
for (const [rc, p] of patches) {
  const rep = reps.find((x) => x.rep_code === rc);
  console.log(`  ${rc} ${rep?.name}: ${JSON.stringify(p)}`);
  if (++shown >= 5) break;
}
console.log("\nตัวอย่างสร้างใหม่ 5 คนแรก:");
creates.slice(0, 5).forEach((c) =>
  console.log(`  + ${c.name} (ร้าน ${c.dealer_code}) nick=${c.nickname} level=${c.level} เข้างาน=${c.start_date}`)
);

if (!APPLY) {
  console.log("\n(DRY RUN) เพิ่ม --apply เพื่อเขียนลง sale_reps");
  process.exit(0);
}

/* =============================================================
   APPLY
   ============================================================= */
console.log("\n================ APPLYING ================");

// gen rep_code ถัดไป
function nextRepCodeFactory(existing) {
  let max = 0;
  for (const r of existing) {
    const n = parseInt(String(r.rep_code).replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return () => `SR${String(++max).padStart(4, "0")}`;
}
const nextRepCode = nextRepCodeFactory(reps);

// 1) สร้างใหม่
let created = 0;
for (const c of creates) {
  const rep_code = nextRepCode();
  const row = {
    rep_code,
    name: c.name,
    dealer_code: c.dealer_code,
    nickname: c.nickname,
    level: c.level,
    start_date: c.start_date,
    phone: c.phone,
    position: c.position,
    skills: [],
    is_active: true,
  };
  const { error } = await sb.from("sale_reps").insert(row);
  if (error) {
    console.error(`สร้าง ${c.name} ไม่สำเร็จ:`, error.message);
    continue;
  }
  created++;
  process.stdout.write(`\r  สร้างใหม่ ${created}/${creates.length}`);
}
console.log("");

// 2) อัปเดต patch
let updated = 0;
for (const [rc, p] of patches) {
  if (Object.keys(p).length === 0) continue;
  const { error } = await sb.from("sale_reps").update(p).eq("rep_code", rc);
  if (error) {
    console.error(`อัปเดต ${rc} ไม่สำเร็จ:`, error.message);
    continue;
  }
  updated++;
  process.stdout.write(`\r  อัปเดต ${updated}/${patches.size}`);
}
console.log("");
console.log(`DONE: สร้างใหม่ ${created} | อัปเดต ${updated}`);
