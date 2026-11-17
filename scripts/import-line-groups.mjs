// ติดตามกลุ่ม Line ลูกค้า — อัปเดตข้อมูลต้นทาง แล้วคำนวณใหม่ลง line_tracking_jobs
// ตรรกะการอ่านไฟล์/คำนวณอยู่ที่ src/lib/server/line-groups-compute.ts (ใช้ร่วมกับหน้าอัปโหลดในศูนย์ข้อมูล)
//
//   --win <win_contract_all.xlsx>  sync ข้อมูลลูกค้าของงาน Rudy -> rudy_job_customers (ชื่อลูกค้า, ประเภท, จังหวัด, ref_opp, H7)
//   --dir <โฟลเดอร์>               อัปโหลดไฟล์กลุ่ม Line ในโฟลเดอร์ -> line_group_entries (ชื่อไฟล์เดิม = แทนที่)
//   --no-dir / --no-win           ข้ามส่วนนั้น (sync-runner ใช้ --win อย่างเดียว)
//   --apply                       บันทึกจริง (ไม่ใส่ = dry-run)
//   --debug                       แสดงชื่อลูกค้าที่ถูกรวมเข้าด้วยกัน
//   exit 2 = ข้อมูลลดผิดปกติ (guard) — ไม่บันทึก
//
// ค่าเริ่มต้น (ไม่ใส่ flag): ทำทั้ง --win และ --dir
// ใช้: node --max-old-space-size=8192 scripts/import-line-groups.mjs [--apply]
import { readFileSync, readdirSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { computeLineTracking, parseLineGroupFile, replaceLineGroupFiles, writeLineTracking } from "../src/lib/server/line-groups-compute.ts";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const has = (k) => process.argv.includes(k);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d; };
const APPLY = has("--apply");
const WIN = has("--no-win") ? null : arg("--win", "D:/OneDrive - The Siam Cement Public Company Limited/RSS  System - PRD_CSD/win_contract_all.xlsx");
const DIR = has("--no-dir") || (has("--win") && !has("--dir")) ? null : arg("--dir", "commission-app/ข้อมูลการ Add กลุ่ม Line");
const GUARD = 0.3;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ---------- 1) ลูกค้าของงาน Rudy ---------- */
if (WIN) {
  const wb = XLSX.read(readFileSync(WIN), { sheets: undefined });
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
  const s = (v) => { const x = String(v ?? "").trim(); return x || null; };
  const want = new Map();
  for (const r of raw) {
    // เฉพาะกลุ่มงานหลังคา (ROOF SERVICE มาจาก H3 ROOF SYSTEM / METAL ROOF)
    if (!["ROOF SYSTEM", "METAL ROOF"].includes(String(r.H3).trim())) continue;
    const p = String(r.project_number).trim();
    if (!p || want.has(p)) continue;
    want.set(p, { project_number: p, customer_first: s(r.customer_first_name), customer_last: s(r.customer_last_name), customer_type: s(r.customer_type_name), province: s(r.province_name), ref_opp: s(r.ref_opp), h7: s(r.H7) });
  }
  const have = new Map();
  let last = null;
  for (;;) {
    let q = sb.from("rudy_job_customers").select("project_number, customer_first, customer_last, customer_type, province, ref_opp, h7").order("project_number").limit(1000);
    if (last) q = q.gt("project_number", last);
    const { data, error } = await q;
    if (error) throw error;
    data.forEach((r) => have.set(r.project_number, r));
    if (data.length < 1000) break;
    last = data[data.length - 1].project_number;
  }
  const keys = ["customer_first", "customer_last", "customer_type", "province", "ref_opp", "h7"];
  const changed = [...want.values()].filter((r) => { const h = have.get(r.project_number); return !h || keys.some((k) => (h[k] ?? null) !== r[k]); });
  console.log(`ลูกค้างาน Rudy (กลุ่มหลังคา): ในไฟล์ ${want.size} งาน · ในระบบ ${have.size} · เพิ่ม/แก้ ${changed.length}`);
  if (have.size && want.size < have.size * (1 - GUARD)) {
    console.log(`หยุด: จำนวนงานในไฟล์ลดลงเกิน ${GUARD * 100}% (${have.size} -> ${want.size}) — ไฟล์อาจไม่ครบ`);
    process.exit(2);
  }
  if (APPLY) {
    const now = new Date().toISOString();
    for (let i = 0; i < changed.length; i += 500) {
      const { error } = await sb.from("rudy_job_customers").upsert(changed.slice(i, i + 500).map((r) => ({ ...r, synced_at: now })), { onConflict: "project_number" });
      if (error) throw error;
    }
  }
}

/* ---------- 2) ไฟล์กลุ่ม Line ---------- */
let pendingEntries;
if (DIR) {
  const files = readdirSync(DIR).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith("~$") && !/^(สรุป|ตรวจ)/.test(f));
  const parsed = files.map((f) => parseLineGroupFile(f, new Uint8Array(readFileSync(`${DIR}/${f}`))));
  for (const p of parsed) console.log(`${p.status === "error" ? "✗" : "•"} ${p.name}: ${p.entries.length} แถว ${p.messages.length ? `(${p.messages.join("; ")})` : ""}`);
  const usable = parsed.filter((p) => p.status !== "error");
  if (APPLY && usable.length) console.log(`อัปโหลดไฟล์กลุ่ม Line ${usable.length} ไฟล์: ${await replaceLineGroupFiles(sb, usable, "script")} แถว`);
  if (!APPLY) {
    // dry-run: คำนวณด้วยไฟล์ในโฟลเดอร์แทนไฟล์ชื่อเดียวกันในระบบ
    const data = [];
    for (let lastId = 0; ; ) {
      const { data: d, error } = await sb.from("line_group_entries").select("id, source_file, kind, job_tokens, status, group_name, group_created").gt("id", lastId).order("id").limit(1000);
      if (error) throw error;
      data.push(...d);
      if (d.length < 1000) break;
      lastId = d[d.length - 1].id;
    }
    const names = new Set(usable.map((p) => p.name));
    pendingEntries = [...data.filter((e) => !names.has(e.source_file)), ...usable.flatMap((p) => p.entries)];
  }
}

/* ---------- 3) คำนวณ ---------- */
const { rows, summary: s, merged } = await computeLineTracking(sb, { entries: pendingEntries });
if (s.missingCustomer) console.log(`! ${s.missingCustomer} งานยังไม่มีข้อมูลลูกค้า (รัน --win ก่อน) — นับเป็น B2C ไว้ก่อน`);
console.log(`งาน ${s.jobs} (ตัดที่ไม่ใช่ B2C ${s.nonB2c}) -> ลูกค้า ${s.customers} ราย (หลายงาน ${s.multiJob}) : ลงทะเบียน ${s.register} · ไม่ลงทะเบียน ${s.not_register} · ไม่ Add Bot ${s.no_bot} · ไม่มีข้อมูล ${s.none} ; ข้อมูลกลุ่มล่าสุด ${s.sourceDate}`);
if (has("--debug")) merged.forEach((m) => console.log(`  รวม: ${m.join(" | ")}`));
const { count: before } = await sb.from("line_tracking_jobs").select("id", { count: "exact", head: true });
if (before && rows.length < before * (1 - GUARD)) {
  console.log(`หยุด: จำนวนงานลดลงเกิน ${GUARD * 100}% (${before} -> ${rows.length})`);
  process.exit(2);
}
if (!APPLY) { console.log("dry-run — เพิ่ม --apply เพื่อบันทึก"); process.exit(0); }
await writeLineTracking(sb, rows);
console.log(`DONE: ${rows.length} งาน · ${s.customers} ลูกค้า · ลงทะเบียน ${s.register}`);
