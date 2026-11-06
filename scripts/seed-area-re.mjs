/* =============================================================
   Seed Area Manager / RE(Coach) จาก SE Monitor -> sale_reps + rep_store_assignments
   - สร้าง record ใน sale_reps (position = area_mng / coach) ถ้ายังไม่มี (match ด้วยชื่อ)
   - ผูก rep_store_assignments กับร้านที่ดูแล (dealer_code ที่มีจริงใน dealers)
   - idempotent: assignment ใช้ unique(rep_code, dealer_code, role_in_store) + upsert

   DRY RUN: node scripts/seed-area-re.mjs
   APPLY:   node scripts/seed-area-re.mjs --apply
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

const str = (v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const norm = (s) =>
  String(s ?? "")
    .replace(/^(นาย|นาง|นางสาว|น\.ส\.|น\.ส|คุณ)\s*/, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
function parseName(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { name: m[1].trim(), nick: m[2].trim() };
  return { name: s, nick: null };
}

/* ---- อ่านไฟล์ ---- */
const FILE = "commission-app/แต้มกิจกรรม/0.Store _ SE Data Monitor_23.04.26 (2).xlsx";
const raw = XLSX.utils.sheet_to_json(
  XLSX.read(readFileSync(FILE), { type: "buffer" }).Sheets["Store65_SE80_HS65_H15"],
  { header: 1, blankrows: false, defval: "" }
);
const C = { dealer: 0, area: 28, coach: 29 };
const rows = raw.slice(3).filter((r) => str(r[C.dealer]));

/* ---- dealers ที่มีจริง ---- */
const { data: dealers } = await sb.from("dealers").select("code");
const dealerSet = new Set((dealers ?? []).map((d) => d.code));

/* ---- sale_reps ปัจจุบัน (match ชื่อ) ---- */
const { data: reps } = await sb.from("sale_reps").select("rep_code, name, position");
const byName = new Map();
for (const r of reps) if (r.name) byName.set(norm(r.name), r);

/* ---- รวบรวม area/coach -> ร้านที่ดูแล ---- */
function collect(colIdx, position) {
  const map = new Map(); // name -> { nick, dealers:Set }
  for (const r of rows) {
    const { name, nick } = parseName(r[colIdx]);
    if (!name || name === "-") continue;
    const dealer = str(r[C.dealer]);
    if (!map.has(name)) map.set(name, { nick, dealers: new Set() });
    if (dealer && dealerSet.has(dealer)) map.get(name).dealers.add(dealer);
  }
  return [...map.entries()].map(([name, v]) => ({
    name,
    nick: v.nick,
    position,
    dealers: [...v.dealers],
  }));
}
const supervisors = [...collect(C.area, "area_mng"), ...collect(C.coach, "coach")];

/* ---- gen rep_code ---- */
let maxN = 0;
for (const r of reps) {
  const n = parseInt(String(r.rep_code).replace(/\D/g, ""), 10);
  if (Number.isFinite(n) && n > maxN) maxN = n;
}
const nextRepCode = () => `SR${String(++maxN).padStart(4, "0")}`;

/* ---- วางแผน ---- */
const plan = supervisors.map((s) => {
  const existing = byName.get(norm(s.name));
  return {
    ...s,
    repCode: existing?.rep_code ?? null, // null = สร้างใหม่
    existing: !!existing,
  };
});

console.log("================ DRY RUN ================");
console.log(`Area Manager: ${plan.filter((p) => p.position === "area_mng").length} คน`);
console.log(`RE/Coach: ${plan.filter((p) => p.position === "coach").length} คน`);
console.log(`มีใน sale_reps แล้ว: ${plan.filter((p) => p.existing).length} | สร้างใหม่: ${plan.filter((p) => !p.existing).length}`);
const totalAssign = plan.reduce((a, p) => a + p.dealers.length, 0);
console.log(`assignment (หัวหน้า x ร้าน) ที่จะผูก: ${totalAssign}`);
console.log("\nตัวอย่าง:");
plan.slice(0, 6).forEach((p) =>
  console.log(`  [${p.position}] ${p.name}${p.nick ? ` (${p.nick})` : ""} ${p.existing ? "(มีแล้ว)" : "(ใหม่)"} -> ${p.dealers.length} ร้าน`)
);

if (!APPLY) {
  console.log("\n(DRY RUN) เพิ่ม --apply เพื่อเขียน");
  process.exit(0);
}

/* ================ APPLY ================ */
console.log("\n================ APPLYING ================");
let created = 0,
  updated = 0,
  assigned = 0;

for (const p of plan) {
  let repCode = p.repCode;
  if (!repCode) {
    repCode = nextRepCode();
    const { error } = await sb.from("sale_reps").insert({
      rep_code: repCode,
      name: p.name,
      nickname: p.nick,
      position: p.position,
      skills: [],
      is_active: true,
    });
    if (error) {
      console.error(`สร้าง ${p.name} ไม่สำเร็จ:`, error.message);
      continue;
    }
    created++;
  } else {
    // มีอยู่แล้ว -> ตั้ง position ถ้ายังไม่ตั้ง
    const { error } = await sb
      .from("sale_reps")
      .update({ position: p.position })
      .eq("rep_code", repCode);
    if (!error) updated++;
  }

  // ผูก assignment (upsert กัน insert ซ้ำ)
  for (const dealer of p.dealers) {
    const role = p.position === "area_mng" ? "manager" : "coach";
    const { error } = await sb.from("rep_store_assignments").upsert(
      { rep_code: repCode, dealer_code: dealer, role_in_store: role },
      { onConflict: "rep_code,dealer_code,role_in_store", ignoreDuplicates: true }
    );
    if (!error) assigned++;
  }
  process.stdout.write(`\r  ประมวลผล ${created + updated} หัวหน้า, ${assigned} assignment`);
}
console.log("");
console.log(`DONE: สร้างใหม่ ${created} | อัปเดต position ${updated} | assignment ${assigned}`);
