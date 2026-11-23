/* บัญชีทีมแบบฟอร์มขอคืนเงินลูกค้า (23 พ.ย. 69): Finance 3 คน + บัญชี 1 + ผู้อนุมัติ Metal Roof / Smart Solution
   - ชื่อผู้ใช้ = อีเมล ; ผู้ใช้ที่มีอยู่แล้ว (อีเมลเดียวกัน): ข้าม เว้นแต่ --reset (ออกรหัสชั่วคราวใหม่) ; ไม่เปลี่ยน role ของ admin
   - ผู้อนุมัติ Metal / Smart ถูกบันทึกใน refund_approvers (job_group -> profile)
   - ทุกบัญชีใหม่ must_change_password ; ไฟล์รหัสผ่าน commission-app/accounts-<date>/Refund_Team.xlsx (gitignored)
   DRY RUN: node scripts/provision-refund-team.mjs   APPLY: --apply [--reset] */
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
  { email: "patsakob@scg.com", role: "finance", name: "พัสกร บุญญานุวัตร (แซม)", phone: "097-231-1955", label: "Finance (Financial Operation)" },
  { email: "finance_support2@scg.com", role: "finance", name: "จรรย์จุฑา พันธนิตย์ (แก่น)", phone: "088-379-2849", label: "Finance (Finance Officer)" },
  { email: "ananyapa@scg.com", role: "finance", name: "อณัญญา ปาติสัตย์ (หญิง)", phone: "097-292-2365", label: "Finance (Financial Operation Supervisor)" },
  { email: "epay_lhs@scg.com", role: "accounting", name: "บุษบาศ ซื่อสัตย์", phone: "065-719-7915", label: "บัญชี LHS" },
  { email: "nawapols@scg.com", role: "refund_approver", name: "นวพล ศิริสรรหิรัญ (แบงค์)", phone: "088-635-3945", label: "ผู้อนุมัติ Metal Roof", group: "metal", title: "Area Metal Roof" },
  { email: "pakawanp@scg.com", role: "refund_approver", name: "ภควันต์ ประคงบุญ (แบค)", phone: "085-516-0149", label: "ผู้อนุมัติ Smart Solution", group: "smart", title: "Head of Smart Solutions Business" },
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
  console.log(`${action} ${t.email} -> ${t.role}${t.group ? ` (${t.group})` : ""}`);
  if (!APPLY) continue;
  let id = u?.id;
  if (!action.startsWith("skip")) {
    const password = tempPassword();
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
  if (t.group && id) {
    const { error } = await sb.from("refund_approvers").upsert({ job_group: t.group, profile_id: id, title: t.title, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
}
if (APPLY && out.length) {
  const d = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  const dir = `commission-app/accounts-${d}`;
  mkdirSync(dir, { recursive: true });
  const ws = XLSX.utils.aoa_to_sheet([
    ["เข้าใช้งานที่: https://retail-comm.vercel.app/ (ชื่อผู้ใช้ = อีเมล)"],
    ["เข้าครั้งแรกระบบจะให้ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัว) · ไฟล์นี้มีรหัสผ่าน ห้ามส่งต่อในกลุ่มแชตสาธารณะ"],
    [],
    ["บทบาท", "ชื่อ", "เบอร์", "ชื่อผู้ใช้ (อีเมล)", "รหัสผ่านชั่วคราว"],
    ...out,
  ]);
  ws["!cols"] = [{ wch: 34 }, { wch: 30 }, { wch: 14 }, { wch: 26 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Refund Team");
  writeFileSync(`${dir}/Refund_Team.xlsx`, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`ไฟล์: ${dir}/Refund_Team.xlsx (${out.length} บัญชี)`);
}
if (!APPLY) console.log("dry-run — เพิ่ม --apply เพื่อทำจริง");
