/* สร้างบัญชีร้านค้าให้ทุกร้านที่ยังไม่มีบัญชี (email = <รหัสร้าน>@retail-comm.local)
   + สร้างบัญชี admin แบบอีเมล/รหัสผ่านชั่วคราว (--admin อีเมล)
   -------------------------------------------------------------
   - รหัสผ่านสุ่มต่อบัญชี ; ทุกบัญชี must_change_password = true (ต้องเปลี่ยนตอนเข้าครั้งแรก)
   - ข้ามร้านที่มีบัญชี dealer ที่อนุมัติแล้ว ; ไม่แตะบัญชีเดิม
   - ผลลัพธ์ (รหัสผ่านชั่วคราว) เขียนเป็น CSV ใน commission-app/ (gitignored) ห้าม commit/ห้ามแชร์ต่อ
   DRY RUN: node scripts/create-dealer-accounts.mjs
   APPLY:   node scripts/create-dealer-accounts.mjs --apply [--admin you@scg.com]
*/
import { readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const adminIdx = process.argv.indexOf("--admin");
const ADMIN_EMAIL = adminIdx > -1 ? process.argv[adminIdx + 1]?.toLowerCase() : null;

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const genPwd = (n = 10) => Array.from({ length: n }, () => CHARS[randomInt(CHARS.length)]).join("");
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const { data: dealers, error: dErr } = await sb.from("dealers").select("code, name, is_active").order("name");
if (dErr) throw dErr;
const { data: existing } = await sb
  .from("profiles")
  .select("dealer_code")
  .eq("role", "dealer")
  .eq("status", "approved");
const taken = new Set((existing ?? []).map((p) => p.dealer_code));

const targets = dealers.filter((d) => d.is_active !== false && !taken.has(d.code));
console.log(`ร้านที่เปิดใช้งาน: ${dealers.filter((d) => d.is_active !== false).length} | มีบัญชีแล้ว: ${taken.size} | จะสร้างใหม่: ${targets.length}`);
if (ADMIN_EMAIL) console.log(`admin: ${ADMIN_EMAIL}`);
if (!APPLY) {
  console.log("DRY RUN — ยังไม่ได้สร้าง (ใส่ --apply เพื่อสร้างจริง)");
  process.exit(0);
}

const rows = [];
const failed = [];

async function createAccount({ email, role, dealerCode, label }) {
  const password = genPwd();
  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  if (error || !created.user) throw new Error(error?.message ?? "createUser failed");
  const { error: pErr } = await sb
    .from("profiles")
    .update({
      role,
      dealer_code: dealerCode ?? null,
      status: "approved",
      must_change_password: true,
      approved_at: new Date().toISOString(),
    })
    .eq("id", created.user.id);
  if (pErr) {
    await sb.auth.admin.deleteUser(created.user.id); // ย้อนกลับ ไม่ให้เหลือบัญชีค้าง
    throw new Error(pErr.message);
  }
  return password;
}

if (ADMIN_EMAIL) {
  try {
    const password = await createAccount({ email: ADMIN_EMAIL, role: "admin", dealerCode: null, label: "admin" });
    rows.push({ type: "admin", code: "", name: "ผู้ดูแลระบบ", email: ADMIN_EMAIL, password });
    console.log("สร้าง admin แล้ว");
  } catch (e) {
    failed.push({ code: "admin", reason: e.message });
  }
}

for (const d of targets) {
  const email = `${d.code}@retail-comm.local`;
  try {
    const password = await createAccount({ email, role: "dealer", dealerCode: d.code, label: d.name });
    rows.push({ type: "dealer", code: d.code, name: d.name, email, password });
  } catch (e) {
    failed.push({ code: d.code, reason: e.message });
  }
}

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const out = `commission-app/บัญชีร้านค้า_${stamp}.csv`;
const header = ["ประเภท", "รหัสร้าน", "ชื่อร้าน", "ผู้ใช้ (อีเมล)", "รหัสผ่านชั่วคราว"];
const csv =
  "\uFEFF" +
  [header, ...rows.map((r) => [r.type, r.code, r.name, r.email, r.password])]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");
writeFileSync(out, csv, "utf8");

console.log(`สร้างสำเร็จ ${rows.length} บัญชี | ล้มเหลว ${failed.length}`);
if (failed.length) console.log(failed);
console.log(`ไฟล์: ${out}`);
