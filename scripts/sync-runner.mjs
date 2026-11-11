/* ตัวรัน sync อัตโนมัติ (เรียกจาก Windows Task Scheduler)
   -------------------------------------------------------------
   กลุ่ม:
   - gsheet     : Google Sheet (ข้อมูลจากฟอร์ม เพิ่มตลอดวัน) -> ทุก 1 ชม. 08:00–19:00
   - sharepoint : ไฟล์ SharePoint ที่ sync ลงเครื่องผ่าน OneDrive -> 09:30 / 12:00 / 16:00
                  รันเฉพาะเมื่อไฟล์เปลี่ยนจากรอบที่ sync สำเร็จล่าสุด (เทียบเวลาแก้ไข+ขนาด)
                  ไฟล์เพิ่งเปลี่ยนไม่ถึง 3 นาที = ถือว่า OneDrive ยังดาวน์โหลดไม่เสร็จ -> ข้ามไปรอบหน้า
   - กันรันซ้อน: lock file ต่อกลุ่ม (lock ค้างเกิน 90 นาที = ถือว่าตายแล้ว)
   - log: logs/sync-YYYY-MM-DD.log (เก็บ 30 วัน) + ตาราง sync_runs ใน Supabase
   - สคริปต์ลูกที่ exit 2 = หยุดเพราะข้อมูลลดผิดปกติ (guard) -> ไม่บันทึกว่าสำเร็จ รอบหน้าจะลองใหม่

   ใช้: node scripts/sync-runner.mjs --group gsheet|sharepoint|all [--force] [--only <job>]
        --force = รัน sharepoint แม้ไฟล์ไม่เปลี่ยน (ไม่ใช่ --force ของสคริปต์ลูก)
*/
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const LOG_DIR = join(ROOT, "logs");
const STATE_FILE = join(LOG_DIR, "sync-state.json");
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const GROUP = arg("--group") ?? "all";
const ONLY = arg("--only");
const FORCE_RUN = process.argv.includes("--force");
const JOB_TIMEOUT_MS = 25 * 60 * 1000;
const SETTLE_MS = 3 * 60 * 1000;
const LOCK_STALE_MS = 90 * 60 * 1000;

const SP = "D:/OneDrive - The Siam Cement Public Company Limited/";
const F = {
  di: SP + "RSS  System - rawdata_di/hpb_salesout_details.csv",
  odoo: SP + "RSS  System - rawdata_odoo/odoo_hpb_vendor_sales_detail.xlsx",
  lhs: SP + "RSS  System - PRD_CSD/win_contract_all.xlsx",
  crm: SP + "RSS  System - PRD_CSD/crm_trn_opportunity.xlsx",
};
const JOBS = [
  { id: "ba", group: "gsheet", label: "ยอดขาย BA", args: ["scripts/sync-ba-service-sales-gsheet.mjs", "--apply"] },
  { id: "cust-sat", group: "gsheet", label: "ความพึงพอใจ (บริการ)", args: ["scripts/sync-cust-sat-gsheet.mjs", "--apply"] },
  { id: "scghome-sat", group: "gsheet", label: "ความพึงพอใจ SCG Home", args: ["scripts/sync-scghome-sat-gsheet.mjs", "--apply"] },
  { id: "store-eval", group: "gsheet", label: "ผลตรวจประเมินร้าน", args: ["scripts/sync-store-eval-gsheet.mjs", "--apply"] },
  { id: "product-di", group: "sharepoint", label: "ยอดขายสินค้า DI", file: F.di, args: ["scripts/sync-product-sales.mjs", "--apply", "--source", "di"] },
  { id: "product-odoo", group: "sharepoint", label: "ยอดขายสินค้า Odoo", file: F.odoo, args: ["scripts/sync-product-sales.mjs", "--apply", "--source", "odoo"] },
  { id: "lhs", group: "sharepoint", label: "ยอดขาย LHS/Rudy", file: F.lhs, args: ["scripts/import-service-sales.mjs", "--apply", "--file", F.lhs] },
  // ไฟล์เดียวกับ LHS/Rudy (PO ที่ปิดแล้ว) -> ส่วนลดช่องทาง 7% ของร้าน HE
  { id: "lhs-discount", group: "sharepoint", label: "LHS Channel Discount", file: F.lhs, args: ["scripts/import-lhs-purchase-discount.mjs", "--apply", "--file", F.lhs] },
  { id: "design-intake", group: "sharepoint", label: "แบบรับเข้า (CRM)", file: F.crm, args: ["scripts/sync-design-intake.mjs", "--apply", "--file", F.crm] },
];

/* ---------- log ---------- */
mkdirSync(LOG_DIR, { recursive: true });
const today = new Date();
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const LOG_FILE = join(LOG_DIR, `sync-${ymd(today)}.log`);
const ts = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });
const log = (msg) => { const line = `[${ts()}] ${msg}`; console.log(line); appendFileSync(LOG_FILE, line + "\n", "utf8"); };
// ลบ log เก่ากว่า 30 วัน
for (const f of readdirSync(LOG_DIR)) {
  const m = f.match(/^sync-(\d{4}-\d{2}-\d{2})\.log$/);
  if (m && (today - new Date(m[1])) / 86400000 > 30) { try { unlinkSync(join(LOG_DIR, f)); } catch { /* ignore */ } }
}

/* ---------- lock ---------- */
const LOCK = join(LOG_DIR, `sync-${GROUP}.lock`);
if (existsSync(LOCK)) {
  const age = Date.now() - statSync(LOCK).mtimeMs;
  if (age < LOCK_STALE_MS) { log(`[${GROUP}] รอบก่อนยังไม่จบ (lock ${Math.round(age / 60000)} นาที) — ข้ามรอบนี้`); process.exit(0); }
  log(`[${GROUP}] lock ค้าง ${Math.round(age / 60000)} นาที — ถือว่ารอบก่อนตายแล้ว เริ่มใหม่`);
}
writeFileSync(LOCK, String(process.pid), "utf8");
const releaseLock = () => { try { unlinkSync(LOCK); } catch { /* ignore */ } };
process.on("exit", releaseLock);

/* ---------- state + supabase ---------- */
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
const env = {};
for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;
async function record(row) {
  if (!sb) return;
  const { error } = await sb.from("sync_runs").insert({ ...row, run_group: GROUP, host: hostname() });
  if (error) log(`  (บันทึก sync_runs ไม่สำเร็จ: ${error.message})`);
}

/* ---------- รันสคริปต์ลูก ---------- */
function runChild(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let out = "";
    const onData = (b) => { const s = b.toString("utf8"); out += s; appendFileSync(LOG_FILE, s.replace(/\r(?!\n)/g, "\n"), "utf8"); };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timer = setTimeout(() => { appendFileSync(LOG_FILE, `\n!! เกินเวลา ${JOB_TIMEOUT_MS / 60000} นาที — หยุดงาน\n`, "utf8"); child.kill(); }, JOB_TIMEOUT_MS);
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out }); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: 1, out: out + String(e) }); });
  });
}
/** สรุปผลจาก output (บรรทัด DONE / → / หยุด / ผิดพลาด) */
function summarize(out) {
  const keep = out.split(/\r?\n/).filter((l) => /DONE|→|หยุด|ผิดพลาด|ไม่สำเร็จ|ยกเลิก|error/i.test(l)).map((l) => l.trim());
  return keep.join(" | ").slice(0, 900) || out.trim().split(/\r?\n/).slice(-3).join(" | ").slice(0, 900);
}

/* ---------- main ---------- */
const jobs = JOBS.filter((j) => (GROUP === "all" || j.group === GROUP) && (!ONLY || j.id === ONLY));
if (!jobs.length) { log(`ไม่มีงานในกลุ่ม "${GROUP}"${ONLY ? ` / ${ONLY}` : ""}`); process.exit(1); }
log(`===== เริ่ม sync กลุ่ม ${GROUP} (${jobs.length} งาน) =====`);
let failed = 0;
for (const j of jobs) {
  const started = new Date().toISOString();
  let mtime = null;
  if (j.file) {
    if (!existsSync(j.file)) {
      log(`✗ ${j.label}: ไม่พบไฟล์ (OneDrive ยังไม่ sync โฟลเดอร์นี้?) ${j.file}`);
      await record({ job: j.id, status: "failed", started_at: started, finished_at: new Date().toISOString(), summary: "ไม่พบไฟล์" });
      failed++; continue;
    }
    const st = statSync(j.file);
    mtime = new Date(st.mtimeMs).toISOString();
    const sig = `${st.mtimeMs}|${st.size}`;
    if (!FORCE_RUN && state[j.id]?.sig === sig) {
      log(`– ${j.label}: ไฟล์ยังไม่เปลี่ยน (แก้ไขล่าสุด ${new Date(st.mtimeMs).toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" })}) — ข้าม`);
      continue; // ไม่บันทึก sync_runs ทุกรอบที่ข้าม เพื่อไม่ให้ตารางรก
    }
    if (Date.now() - st.mtimeMs < SETTLE_MS) {
      log(`– ${j.label}: ไฟล์เพิ่งเปลี่ยน (< 3 นาที) อาจยังดาวน์โหลดไม่เสร็จ — รอรอบหน้า`);
      await record({ job: j.id, status: "skipped", started_at: started, finished_at: new Date().toISOString(), file_mtime: mtime, summary: "ไฟล์เพิ่งเปลี่ยน รอรอบหน้า" });
      continue;
    }
  }
  log(`▶ ${j.label}`);
  const t0 = Date.now();
  const { code, out } = await runChild(j.args);
  const status = code === 0 ? "ok" : code === 2 ? "guard" : "failed";
  const summary = summarize(out);
  log(`${status === "ok" ? "✓" : status === "guard" ? "⚠" : "✗"} ${j.label}: ${status} (exit ${code}, ${Math.round((Date.now() - t0) / 1000)}s) ${summary}`);
  await record({ job: j.id, status, started_at: started, finished_at: new Date().toISOString(), exit_code: code, file_mtime: mtime, summary });
  if (status === "ok" && j.file) {
    const st = statSync(j.file);
    state[j.id] = { sig: `${st.mtimeMs}|${st.size}`, syncedAt: new Date().toISOString() };
    saveState();
  }
  if (status !== "ok") failed++;
}
log(`===== จบกลุ่ม ${GROUP}: ${failed ? `มีปัญหา ${failed} งาน` : "สำเร็จทั้งหมด"} =====`);
process.exitCode = failed ? 1 : 0;
