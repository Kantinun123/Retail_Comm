/* บัญชีทีม BOQ DECAAR (18 พ.ย. 69): ห้องแบบ 3 คน + Marketing 1 คน — ชื่อผู้ใช้ = อีเมล @scg.com
   - ผู้ใช้ที่มีอยู่แล้ว (อีเมลเดียวกัน): ข้าม เว้นแต่ --reset (ออกรหัสชั่วคราวใหม่) ; ไม่เปลี่ยน role ของ admin
   - ทุกบัญชีใหม่ must_change_password ; ไฟล์รหัสผ่าน commission-app/accounts-<date>/BOQ_Team.xlsx (gitignored)
   DRY RUN: node scripts/provision-boq-team.mjs   APPLY: --apply [--reset] */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const RESET = process.argv.includes("--reset");
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEAM = [
  { email: "titiporj@scg.com", role: "designer", name: "ฐิติพร จันทนพรชัย (ปลา)", phone: "094-296-2451", label: "ห้องแบบ" },
  { email: "saengtin@scg.com", role: "designer", name: "แสงทิพย์ นิรุตติรักษ์ (อิ้งค์)", phone: "098-282-1887", label: "ห้องแบบ" },
  { email: "setthakd@scg.com", role: "designer", name: "เศรษฐกิจ ดวงปิ่นคำ (แบงค์)", phone: "096-894-9591", label: "ห้องแบบ" },
  { email: "maytawek@scg.com", role: "marketing", name: "เมธาวี กิจการประพันธ์", phone: "098-280-1917", label: "Marketing (Senior Marketing and Solution Executive)" },
];
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const tempPassword = () => Array.from({ length: 10 }, () => ALPHA[randomInt(ALPHA.length)]).join("");

const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const out = [];
for (const t of TEAM) {
  const u = users.find((x) => x.email?.toLowerCase() === t.email);
  const { data: prof } = u ? await sb.from("profiles").select("role").eq("id", u.id).maybeSingle() : { data: null };
  const action = !u ? "create" : prof?.role === "admin" ? "skip-admin" : RESET || prof?.role !== t.role ? "update" : "skip";
  console.log(`${action} ${t.email} -> ${t.role} ${t.name}`);
  if (!APPLY || action.startsWith("skip")) continue;
  const password = tempPassword();
  let id = u?.id;
  if (!u) {
    const { data, error } = await sb.auth.admin.createUser({ email: t.email, password, email_confirm: true, user_metadata: { full_name: t.name } });
    if (error) throw error;
    id = data.user.id;
  } else {
    const { error } = await sb.auth.admin.updateUserById(u.id, { password, ban_duration: "none" });
    if (error) throw error;
  }
  const { error } = await sb.from("profiles").update({ role: t.role, full_name: t.name, phone: t.phone, status: "approved", must_change_password: true, approved_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    if (!u) await sb.auth.admin.deleteUser(id);
    throw error;
  }
  out.push([t.label, t.name, t.phone, t.email, password]);
}
if (APPLY && out.length) {
  const d = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  const dir = `commission-app/accounts-${d}`;
  mkdirSync(dir, { recursive: true });
  const ws = XLSX.utils.aoa_to_sheet([
    ["เข้าใช้งานที่: https://retail-comm.vercel.app/ (ชื่อผู้ใช้ = อีเมล @scg.com)"],
    ["เข้าครั้งแรกระบบจะให้ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัว) · ไฟล์นี้มีรหัสผ่าน ห้ามส่งต่อในกลุ่มแชตสาธารณะ"],
    [],
    ["บทบาท", "ชื่อ", "เบอร์", "ชื่อผู้ใช้ (อีเมล)", "รหัสผ่านชั่วคราว"],
    ...out,
  ]);
  ws["!cols"] = [{ wch: 26 }, { wch: 32 }, { wch: 14 }, { wch: 22 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BOQ Team");
  writeFileSync(`${dir}/BOQ_Team.xlsx`, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`ไฟล์: ${dir}/BOQ_Team.xlsx (${out.length} บัญชี)`);
}
if (!APPLY) console.log("dry-run — เพิ่ม --apply เพื่อทำจริง");
