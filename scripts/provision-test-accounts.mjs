// สร้างบัญชีทดสอบที่ "ผูกกับคนจริง" ไว้เช็คหน้าจอ (profiles.is_test = true)
//   test.area     -> Area แดง (SR0229)
//   test.coach    -> Coach เนม (SR0239)
//   test.areahead -> หัวหน้า Area (เห็นทุกร้านที่มี Area ดูแล ไม่ต้องผูก rep)
// ใช้: node scripts/provision-test-accounts.mjs          (dry-run)
//      node scripts/provision-test-accounts.mjs --apply  (สร้าง/รีเซ็ตรหัส + เขียนไฟล์รหัสผ่านใน commission-app/, gitignored)
// รันซ้ำได้: บัญชีที่มีอยู่แล้ว -> อัปเดตโปรไฟล์ + ตั้งรหัสชั่วคราวใหม่
//      --only test.coach  = ทำเฉพาะบัญชีนั้น (ไฟล์รหัสผ่านจะมีเฉพาะบัญชีที่รีเซ็ต)
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const APPLY = process.argv.includes("--apply");
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ACCOUNTS = [
  { username: "test.area", role: "area", rep: "SR0229", label: "Area แดง" },
  { username: "test.coach", role: "coach", rep: "SR0239", label: "Coach เนม" },
  { username: "test.areahead", role: "area_head", rep: null, label: "หัวหน้า Area" },
];

function tempPassword() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ", a = "abcdefghijkmnpqrstuvwxyz", d = "23456789";
  const all = A + a + d;
  const pick = (s) => s[randomInt(s.length)];
  const chars = [pick(A), pick(a), pick(d), ...Array.from({ length: 9 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx > 0 ? process.argv[onlyIdx + 1] : null;
const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
const out = [];
for (const acc of ACCOUNTS.filter((a) => !ONLY || a.username === ONLY)) {
  const email = `${acc.username}@retail-comm.local`;
  let repName = null;
  if (acc.rep) {
    const { data: rep } = await sb.from("sale_reps").select("name, nickname, position").eq("rep_code", acc.rep).single();
    const ok = (acc.role === "area" && rep?.position === "area_mng") || (acc.role === "coach" && rep?.position === "coach");
    if (!ok) throw new Error(`${acc.rep} ไม่ใช่ตำแหน่ง ${acc.role}`);
    repName = rep.nickname ? `${rep.name} (${rep.nickname})` : rep.name;
  }
  const fullName = `[ทดสอบ] ${acc.label}${repName ? ` · ${repName}` : ""}`;
  const existing = list.users.find((u) => u.email === email);
  console.log(`${existing ? "update" : "create"} ${acc.username} role=${acc.role} rep=${acc.rep ?? "-"} name="${fullName}"`);
  if (!APPLY) continue;

  const password = tempPassword();
  let userId = existing?.id;
  if (existing) {
    const { error } = await sb.auth.admin.updateUserById(existing.id, { password, ban_duration: "none" });
    if (error) throw error;
  } else {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) throw error;
    userId = data.user.id;
  }
  const { error: pErr } = await sb
    .from("profiles")
    .update({ full_name: fullName, role: acc.role, rep_code: acc.rep, status: "approved", is_test: true, must_change_password: true, approved_at: new Date().toISOString() })
    .eq("id", userId);
  if (pErr) {
    if (!existing) await sb.auth.admin.deleteUser(userId); // ไม่ให้เหลือ auth user ค้าง
    throw pErr;
  }
  out.push({ "บัญชี": acc.label, "ผูกกับ": repName ?? "ทุกร้านที่มี Area ดูแล", "ชื่อผู้ใช้": acc.username, "รหัสผ่านชั่วคราว": password });
}

if (APPLY && out.length) {
  const d = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  const dir = `commission-app/accounts-${d}`;
  mkdirSync(dir, { recursive: true });
  const ws = XLSX.utils.aoa_to_sheet([
    ["เข้าใช้งานที่: https://retail-comm.vercel.app/ (ใส่ชื่อผู้ใช้ได้เลย ไม่ต้องมี @)"],
    ["บัญชีทดสอบ: เห็นหน้าจอเหมือนคนจริงที่ผูกไว้ · เข้าครั้งแรกต้องตั้งรหัสผ่านใหม่ · ไฟล์นี้มีรหัสผ่าน ห้ามส่งต่อ"],
    [],
    Object.keys(out[0]),
    ...out.map((r) => Object.values(r)),
  ]);
  ws["!cols"] = [{ wch: 16 }, { wch: 34 }, { wch: 16 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Test accounts");
  writeFileSync(`${dir}/Test_Accounts${ONLY ? `_${ONLY}` : ""}.xlsx`, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`เขียนไฟล์รหัสผ่าน: ${dir}/Test_Accounts${ONLY ? `_${ONLY}` : ""}.xlsx (${out.length} บัญชี)`);
}
if (!APPLY) console.log("dry-run — เพิ่ม --apply เพื่อสร้างจริง");
