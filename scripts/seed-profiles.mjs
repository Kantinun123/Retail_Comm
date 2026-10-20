/* Auth เฟส 2: seed test users + profiles ด้วยมือ (ผ่าน service role Admin API)
   สร้าง 3 บัญชีทดสอบ: admin / sales / dealer — ตั้ง status=approved + role/emp/dealer
   รัน: node scripts/seed-profiles.mjs
   (idempotent: ถ้ามี user อีเมลนี้แล้วจะข้ามการสร้าง แล้วอัปเดต profile ให้ตรง)
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// บัญชีทดสอบ (ชื่อ/อีเมล generic ตาม policy — ไม่ใช้บุคคลจริง)
const TEST_USERS = [
  { email: "admin.demo@example.com",  password: "Demo-1234!", full_name: "Admin Demo",  role: "admin",  emp_id: null,     dealer_code: null },
  { email: "sales.demo@example.com",  password: "Demo-1234!", full_name: "Sales Demo",  role: "sales",  emp_id: "CR0162", dealer_code: "5102381" },
  { email: "dealer.demo@example.com", password: "Demo-1234!", full_name: "Dealer Demo", role: "dealer", emp_id: null,     dealer_code: "5102381" },
];

async function findUserByEmail(email) {
  // listUsers แบบง่าย (จำนวนน้อย) — หา email ตรง
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) || null;
}

for (const u of TEST_USERS) {
  let user = await findUserByEmail(u.email);
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (error) { console.error(`create ${u.email} FAIL:`, error.message); continue; }
    user = data.user;
    console.log(`created auth user: ${u.email}`);
  } else {
    console.log(`exists: ${u.email}`);
  }

  // อัปเดต profile เป็น approved + role/emp/dealer (trigger สร้าง row ไว้แล้ว)
  const { error: upErr } = await sb.from("profiles").update({
    full_name: u.full_name,
    status: "approved",
    role: u.role,
    requested_role: u.role,
    emp_id: u.emp_id,
    dealer_code: u.dealer_code,
    approved_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (upErr) { console.error(`profile ${u.email} FAIL:`, upErr.message); continue; }
  console.log(`  profile -> approved role=${u.role} emp=${u.emp_id ?? "-"} dealer=${u.dealer_code ?? "-"}`);
}

console.log("DONE seed profiles");
