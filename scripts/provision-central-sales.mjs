/* บัญชีพนักงานขายส่วนกลาง (role sales_central) — ใช้ร่วมกันหลายคน ไม่ผูกร้าน ใช้ได้เฉพาะคำขอคืนเงิน
   - ผู้ขอกรอกชื่อ / ชื่อเล่น / อีเมล / เบอร์ / หน่วยงานเองทุกคำขอ (ไม่มี rep_code / dealer_code)
   - ชื่อผู้ใช้ central.sales1, central.sales2 -> อีเมลภายใน <ชื่อผู้ใช้>@retail-comm.local
   - มีอยู่แล้ว: ข้าม เว้นแต่ --reset ; บัญชีใหม่ must_change_password
   - --test = สร้างบัญชีทดสอบ test.central (is_test, ผู้อนุมัติเป็น Area ทดสอบ) แทน
   - ไฟล์รหัสผ่าน commission-app/accounts-<date>/Central_Sales[_test].xlsx (gitignored) ; ไม่เขียนทับไฟล์เดิม
   DRY RUN: node scripts/provision-central-sales.mjs   APPLY: --apply [--reset] [--test] */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
const APPLY = process.argv.includes("--apply");
const RESET = process.argv.includes("--reset");
const TEST = process.argv.includes("--test");
const DOMAIN = "retail-comm.local";
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ACCOUNTS = TEST
  ? [{ username: "test.central", name: "[ทดสอบ] พนักงานขายส่วนกลาง" }]
  : [
      { username: "central.sales1", name: "พนักงานขายส่วนกลาง 1" },
      { username: "central.sales2", name: "พนักงานขายส่วนกลาง 2" },
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
const d = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
const dir = `commission-app/accounts-${d}`;
const file = `${dir}/Central_Sales${TEST ? "_test" : ""}.xlsx`;
const out = [];
for (const a of ACCOUNTS) {
  const email = `${a.username}@${DOMAIN}`;
  const u = users.find((x) => x.email?.toLowerCase() === email);
  const { data: prof } = u ? await sb.from("profiles").select("role").eq("id", u.id).maybeSingle() : { data: null };
  const action = !u ? "create" : prof?.role === "admin" ? "skip-admin" : RESET || prof?.role !== "sales_central" ? "update" : "skip";
  console.log(`${action} ${a.username} (${a.name})`);
  if (!APPLY || action.startsWith("skip")) continue;
  const password = tempPassword();
  let id = u?.id;
  if (!u) {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: a.name } });
    if (error) throw error;
    id = data.user.id;
  } else {
    const { error } = await sb.auth.admin.updateUserById(u.id, { password, ban_duration: "none" });
    if (error) throw error;
  }
  const { error } = await sb
    .from("profiles")
    .update({ role: "sales_central", full_name: a.name, rep_code: null, dealer_code: null, status: "approved", is_test: TEST, must_change_password: !TEST, approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (!u) await sb.auth.admin.deleteUser(id);
    throw error;
  }
  out.push([a.name, a.username, password]);
}
if (APPLY && out.length) {
  if (existsSync(file)) {
    // ไม่เขียนทับไฟล์รหัสเดิม — แสดงทางหน้าจอแทน
    console.log(`มีไฟล์ ${file} อยู่แล้ว ไม่เขียนทับ รหัสใหม่:`);
    out.forEach((r) => console.log(`  ${r[1]}  ${r[2]}`));
  } else {
    mkdirSync(dir, { recursive: true });
    const ws = XLSX.utils.aoa_to_sheet([
      ["เข้าใช้งานที่: https://retail-comm.vercel.app/ · ใช้ได้เฉพาะเมนูขอคืนเงินลูกค้า"],
      ["บัญชีใช้ร่วมกันหลายคน · ทุกคำขอต้องกรอกชื่อ / อีเมล / เบอร์ / หน่วยงานของผู้ขอเอง · เข้าครั้งแรกระบบจะให้ตั้งรหัสผ่านใหม่"],
      ["ไฟล์นี้มีรหัสผ่าน ห้ามส่งต่อในกลุ่มแชตสาธารณะ"],
      [],
      ["บัญชี", "ชื่อผู้ใช้", "รหัสผ่านชั่วคราว"],
      ...out,
    ]);
    ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Central Sales");
    writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    console.log(`ไฟล์: ${file} (${out.length} บัญชี)`);
  }
}
if (!APPLY) console.log("dry-run — เพิ่ม --apply เพื่อทำจริง");
