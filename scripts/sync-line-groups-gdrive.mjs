/* ดึงไฟล์กลุ่ม Line (bot sentiment) จากโฟลเดอร์ Google Drive แล้วนำเข้าด้วย import-line-groups.mjs
   - โฟลเดอร์: env LINE_GROUPS_GDRIVE_FOLDER_ID (แชร์แบบ "ทุกคนที่มีลิงก์ดูได้") ; อ่านรายชื่อไฟล์จากหน้า embeddedfolderview
   - เลือกไฟล์ .xlsx ล่าสุดของแต่ละชนิดจากชื่อไฟล์: "ยังไม่ลงทะเบียน" -> not_register, "ลงทะเบียนแล้ว" -> register
     (ชื่อไฟล์ใน Drive เปลี่ยนตามช่วงวันที่ เช่น ..._1_มกราคม_-_22_พฤศจิกายน_2569.xlsx -> เลือกวันสิ้นสุดล่าสุด)
   - บันทึกเป็นชื่อคงที่ gdrive_group_register.xlsx / gdrive_group_not_register.xlsx ในโฟลเดอร์เดิม
     -> นำเข้าแทนที่ชุดเดิมทุกครั้ง (line_group_entries แทนที่ตามชื่อไฟล์) ไม่เกิดชุดซ้ำ
   - เนื้อไฟล์ไม่เปลี่ยน (sha256) = ไม่นำเข้า ; --force = นำเข้าแม้ไม่เปลี่ยน
   - exit 2 = guard ของ import-line-groups (ข้อมูลลดผิดปกติ) ส่งต่อให้ sync-runner
   ใช้: node scripts/sync-line-groups-gdrive.mjs [--apply] [--force] */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const DIR = "commission-app/ข้อมูลการ Add กลุ่ม Line";
const STATE = `${DIR}/.gdrive-state.json`;
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const FOLDER = env.LINE_GROUPS_GDRIVE_FOLDER_ID;
if (!FOLDER) { console.error("ไม่มี LINE_GROUPS_GDRIVE_FOLDER_ID ใน .env"); process.exit(1); }
if (!existsSync(DIR)) { console.error(`ไม่พบโฟลเดอร์ ${DIR}`); process.exit(1); }

/* ---------- 1) รายชื่อไฟล์ในโฟลเดอร์ ---------- */
const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(FOLDER)}`, { redirect: "follow" });
if (!res.ok) { console.error(`อ่านโฟลเดอร์ไม่ได้ (HTTP ${res.status}) — ตรวจว่าโฟลเดอร์แชร์แบบทุกคนที่มีลิงก์`); process.exit(1); }
const html = await res.text();
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const files = [...html.matchAll(/href="https:\/\/drive\.google\.com\/file\/d\/([\w-]+)[^"]*"[\s\S]*?flip-entry-title">([^<]+)</g)].map((m) => ({ id: m[1], name: decode(m[2]).trim() }));
if (!files.length) { console.error("ไม่พบไฟล์ในโฟลเดอร์ (โฟลเดอร์ว่าง หรือ Google เปลี่ยนหน้าเว็บ)"); process.exit(1); }

/* วันสิ้นสุดจากชื่อไฟล์ "..._-_22_พฤศจิกายน_2569" -> เรียงหาไฟล์ล่าสุด (ไม่มีวันที่ = 0) */
const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const endDate = (name) => {
  const all = [...name.matchAll(/(\d{1,2})[_\s]+([ก-๙]+)[_\s]+(\d{4})/g)].map((m) => {
    const mo = TH_MONTH.indexOf(m[2]);
    return mo < 0 ? 0 : (Number(m[3]) - 543) * 10000 + (mo + 1) * 100 + Number(m[1]);
  });
  return all.length ? Math.max(...all) : 0;
};
const kindOf = (name) => (!/\.xlsx$/i.test(name) ? null : /ยังไม่ลงทะเบียน|not[_\s-]?regist/i.test(name) ? "not_register" : /ลงทะเบียน|regist/i.test(name) ? "register" : null);
const pick = {};
for (const f of files) {
  const k = kindOf(f.name);
  if (!k) { console.log(`  ข้าม ${f.name}`); continue; }
  if (!pick[k] || endDate(f.name) > endDate(pick[k].name)) pick[k] = f;
}
if (!pick.register) { console.error("ไม่พบไฟล์ 'กลุ่มที่ลงทะเบียนแล้ว' ในโฟลเดอร์ — ไม่นำเข้า"); process.exit(1); }

/* ---------- 2) ดาวน์โหลด + เทียบกับครั้งก่อน ---------- */
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
let changed = false;
const next = { ...state };
for (const [k, f] of Object.entries(pick)) {
  const r = await fetch(`https://drive.google.com/uc?export=download&id=${f.id}`, { redirect: "follow" });
  const buf = Buffer.from(await r.arrayBuffer());
  if (!r.ok || buf[0] !== 0x50 || buf[1] !== 0x4b) { console.error(`ดาวน์โหลด ${f.name} ไม่ได้ (HTTP ${r.status}, ไม่ใช่ไฟล์ Excel)`); process.exit(1); }
  const sha = createHash("sha256").update(buf).digest("hex");
  const same = state[k]?.sha === sha;
  console.log(`${same ? "=" : "*"} ${k}: ${f.name} (${(buf.length / 1024).toFixed(0)} KB)${same ? " ไม่เปลี่ยน" : " มีการเปลี่ยนแปลง"}`);
  if (!same) changed = true;
  if (APPLY) writeFileSync(`${DIR}/gdrive_group_${k}.xlsx`, buf);
  next[k] = { sha, name: f.name, id: f.id, at: new Date().toISOString() };
}
if (!changed && !FORCE) { console.log("ไม่มีไฟล์เปลี่ยน — ไม่นำเข้า"); process.exit(0); }
if (!APPLY) { console.log("dry-run — เพิ่ม --apply เพื่อดาวน์โหลดและนำเข้า"); process.exit(0); }

/* ---------- 3) นำเข้าด้วยสคริปต์เดิม (เฉพาะไฟล์ในโฟลเดอร์ ไม่อ่านไฟล์ Rudy) ---------- */
const run = spawnSync(process.execPath, ["--max-old-space-size=8192", "scripts/import-line-groups.mjs", "--no-win", "--dir", DIR, "--apply"], { stdio: "inherit" });
if (run.status !== 0) process.exit(run.status ?? 1); // ไม่บันทึก state -> รอบหน้าลองใหม่
writeFileSync(STATE, JSON.stringify(next, null, 2));
console.log("บันทึกสถานะแล้ว");
