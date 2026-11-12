/* สร้างบัญชีทีม Admin จาก commission-app/Admin team/Admin Team.xlsx
   -------------------------------------------------------------
   คอลัมน์: ชื่อ-นามสกุล | ชื่อเล่น | Email | เบอร์โทร | ตำแหน่งงาน | สิทธิ์การใช้งาน
   - "ผู้ดูแลระบบ"           -> role admin (เห็นทุกร้าน + หน้าจัดการ)
   - ข้อความที่มีคำว่า "Area" -> role area_head (หัวหน้า Area: เห็นทุกร้านในมุมมองแบบ Area)
   - บัญชีที่มีอยู่แล้ว: อัปเดตชื่อ/เบอร์/role เท่านั้น ไม่เปลี่ยนรหัสผ่าน (เช่น kantinkn ที่ใช้งานอยู่)
   - บัญชีใหม่: รหัสชั่วคราว + must_change_password ; ไฟล์แจกรหัส commission-app/accounts-<date>/Admin_Team.xlsx (gitignored)
   DRY RUN: node scripts/provision-admin-team.mjs
   APPLY:   node scripts/provision-admin-team.mjs --apply
*/
import { mkdirSync, readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const SRC = "commission-app/Admin team/Admin Team.xlsx";
const LOGIN_URL = "https://retail-comm.vercel.app/";
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* รหัสชั่วคราว 10 ตัว (เหมือน src/lib/supabase/temp-password.ts — ตัดตัวที่สับสน 0/O/1/l/I) */
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const tempPassword = () => Array.from({ length: 10 }, () => ALPHA[randomInt(ALPHA.length)]).join("");
const die = (msg) => { console.error(msg); process.exit(1); };

/* ---- อ่านไฟล์ ---- */
const rows = XLSX.utils.sheet_to_json(XLSX.read(readFileSync(SRC)).Sheets["Sheet1"], { header: 1, defval: "" }).slice(1);
const people = rows
  .map((r) => r.map((c) => String(c).trim()))
  .filter((r) => r[2])
  .map(([fullName, nick, email, phone, title, perm]) => ({
    fullName, nick, email: email.toLowerCase(), phone, title, perm,
    role: /area/i.test(perm) ? "area_head" : perm === "ผู้ดูแลระบบ" ? "admin" : null,
  }));
const bad = people.filter((p) => !p.role || !/^[^@\s]+@scg\.com$/.test(p.email));
if (bad.length) die("แถวที่ตีความไม่ได้: " + bad.map((p) => `${p.email} (${p.perm})`).join(", "));

/* ---- บัญชีที่มีอยู่ ---- */
const existing = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) die(error.message);
  data.users.forEach((u) => existing.set((u.email ?? "").toLowerCase(), u.id));
  if (data.users.length < 1000) break;
}
const plan = people.map((p) => ({ ...p, userId: existing.get(p.email) ?? null, action: existing.has(p.email) ? "update" : "create" }));

console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
plan.forEach((p) => console.log(`  ${p.action.padEnd(6)} ${p.role.padEnd(9)} ${p.email}  ${p.fullName} (${p.nick})`));
if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อทำจริง"); process.exit(0); }

/* ---- ทำจริง ---- */
const now = new Date().toISOString();
const done = [];
for (const p of plan) {
  const full = p.nick ? `${p.fullName} (${p.nick})` : p.fullName;
  try {
    let id = p.userId;
    let pwd = null;
    if (p.action === "create") {
      pwd = tempPassword();
      const { data, error } = await sb.auth.admin.createUser({ email: p.email, password: pwd, email_confirm: true, user_metadata: { full_name: full } });
      if (error) throw error;
      id = data.user.id;
    }
    const patch = { role: p.role, full_name: full, phone: p.phone || null, status: "approved", approved_at: now };
    if (pwd) patch.must_change_password = true;
    const { error: e2 } = await sb.from("profiles").update(patch).eq("id", id);
    if (e2) {
      if (p.action === "create") await sb.auth.admin.deleteUser(id);
      throw e2;
    }
    done.push({ ...p, full, password: pwd });
    console.log(`  ✓ ${p.action} ${p.email}`);
  } catch (e) {
    console.error(`  ✗ ${p.email}: ${e.message}`);
  }
}
console.log(`สำเร็จ ${done.length}/${plan.length}`);

/* ---- ไฟล์แจกรหัส (เฉพาะบัญชีใหม่) ---- */
const created = done.filter((p) => p.password);
if (created.length) {
  const dir = `commission-app/accounts-${now.slice(0, 10).replace(/-/g, "")}`;
  mkdirSync(dir, { recursive: true });
  const roleLabel = { admin: "ผู้ดูแลระบบ", area_head: "หัวหน้า Area (ดูทุกร้าน)" };
  const ws = XLSX.utils.aoa_to_sheet([
    [`เข้าใช้งานที่: ${LOGIN_URL}`],
    ["เข้าครั้งแรกระบบจะให้ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัว) · ไฟล์นี้มีรหัสผ่าน ห้ามส่งต่อในกลุ่มแชตสาธารณะ"],
    [],
    ["ชื่อ", "ตำแหน่ง", "สิทธิ์", "ชื่อผู้ใช้ (อีเมล)", "รหัสผ่านชั่วคราว"],
    ...created.map((p) => [p.full, p.title, roleLabel[p.role], p.email, p.password]),
  ]);
  ws["!cols"] = [{ wch: 34 }, { wch: 44 }, { wch: 24 }, { wch: 22 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Admin Team");
  XLSX.writeFile(wb, `${dir}/Admin_Team.xlsx`);
  console.log(`ไฟล์: ${dir}/Admin_Team.xlsx (${created.length} บัญชีใหม่)`);
}
