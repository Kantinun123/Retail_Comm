/* สร้างบัญชีพนักงานขาย SE รายคน (18 พ.ย. 69) + ไฟล์แจกรหัส แยก Area -> ร้าน
   -------------------------------------------------------------
   - กลุ่ม: sale_reps position = 'se', is_active, อยู่ในร้านที่ active
   - ชื่อผู้ใช้ = รหัสพนักงาน (เช่น SR0067) -> อีเมลภายใน sr0067@retail-comm.local (พิมพ์เล็ก/ใหญ่ได้)
   - profiles: role = sales, rep_code, dealer_code (ข้อมูลประกอบ — ตอน login ร้านอ่านจาก sale_reps ปัจจุบัน),
     status approved, must_change_password = true
   - SE ที่มีบัญชีอยู่แล้ว (role sales + rep_code เดียวกัน) -> ข้าม (ไม่รีเซ็ตรหัส) เว้นแต่ --reset
   - ไฟล์: commission-app/accounts-<date>/SE/<Area>/<รหัสร้าน>_<ชื่อร้าน>.xlsx + SE_ทั้งหมด.xlsx (gitignored)
   DRY RUN: node scripts/provision-se-accounts.mjs
   APPLY:   node scripts/provision-se-accounts.mjs --apply [--reset]
*/
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const RESET = process.argv.includes("--reset");
const DOMAIN = "retail-comm.local";
const LOGIN_URL = "https://retail-comm.vercel.app/";
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const die = (msg) => { console.error(msg); process.exit(1); };

/* รหัสชั่วคราว 10 ตัว (ตัดตัวที่สับสน 0/O/1/l/I) */
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const tempPassword = () => Array.from({ length: 10 }, () => ALPHA[randomInt(ALPHA.length)]).join("");
const safeName = (s) => String(s ?? "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);

const { data: dealers, error: dErr } = await sb.from("dealers").select("code,name,model,is_active").eq("is_active", true);
if (dErr) die(dErr.message);
const dealerByCode = new Map(dealers.map((d) => [d.code, d]));
const { data: reps, error: rErr } = await sb.from("sale_reps").select("rep_code,name,nickname,position,dealer_code,is_active,phone");
if (rErr) die(rErr.message);
const repByCode = new Map(reps.map((r) => [r.rep_code, r]));
const { data: assigns, error: aErr } = await sb.from("rep_store_assignments").select("rep_code,dealer_code");
if (aErr) die(aErr.message);
const { data: profiles, error: pErr } = await sb.from("profiles").select("id,email,role,rep_code,is_test");
if (pErr) die(pErr.message);
const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) die(error.message);
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const userByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));

const areaOf = (dealerCode) =>
  assigns.filter((a) => a.dealer_code === dealerCode).map((a) => repByCode.get(a.rep_code)).find((r) => r?.position === "area_mng") ?? null;

const se = reps
  .filter((r) => r.position === "se" && r.is_active && dealerByCode.has(r.dealer_code))
  .sort((a, b) => a.dealer_code.localeCompare(b.dealer_code) || a.rep_code.localeCompare(b.rep_code));

const plan = se.map((r) => {
  const username = r.rep_code.toUpperCase();
  const email = `${r.rep_code.toLowerCase()}@${DOMAIN}`;
  const prof = profiles.find((p) => !p.is_test && p.role === "sales" && p.rep_code === r.rep_code);
  const existingUser = userByEmail.get(email);
  const action = prof ? (RESET ? "reset" : "skip") : existingUser ? "attach" : "create";
  return { rep: r, dealer: dealerByCode.get(r.dealer_code), area: areaOf(r.dealer_code), username, email, action, userId: prof?.id ?? existingUser?.id };
});

const cnt = {};
plan.forEach((p) => (cnt[p.action] = (cnt[p.action] ?? 0) + 1));
console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
console.log(`SE ที่ใช้งานอยู่ในร้าน active: ${plan.length} คน · ${new Set(plan.map((p) => p.dealer.code)).size} ร้าน`);
console.log("แผน:", JSON.stringify(cnt));
const noArea = [...new Set(plan.filter((p) => !p.area).map((p) => p.dealer.code))];
if (noArea.length) console.log("ร้านที่ไม่มี Area ดูแล (ไฟล์อยู่โฟลเดอร์ 'ไม่มี Area'):", noArea.join(", "));
plan.slice(0, 5).forEach((p) => console.log(`  ${p.action} ${p.username} ${p.rep.name} · ${p.dealer.code} ${p.dealer.name} · Area ${p.area?.nickname ?? p.area?.name ?? "-"}`));
if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อทำจริง"); process.exit(0); }

const now = new Date().toISOString();
const done = [];
for (const p of plan) {
  if (p.action === "skip") continue;
  const pwd = tempPassword();
  const fullName = p.rep.nickname ? `${p.rep.name} (${p.rep.nickname})` : p.rep.name;
  try {
    let id = p.userId;
    if (p.action === "create") {
      const { data: created, error } = await sb.auth.admin.createUser({ email: p.email, password: pwd, email_confirm: true, user_metadata: { full_name: fullName } });
      if (error) throw error;
      id = created.user.id;
    } else {
      const { error } = await sb.auth.admin.updateUserById(id, { password: pwd, ban_duration: "none" });
      if (error) throw error;
    }
    const { error: e2 } = await sb
      .from("profiles")
      .update({ role: "sales", rep_code: p.rep.rep_code, dealer_code: p.rep.dealer_code, full_name: fullName, status: "approved", must_change_password: true, approved_at: now })
      .eq("id", id);
    if (e2) {
      if (p.action === "create") await sb.auth.admin.deleteUser(id); // ไม่ให้เหลือ auth user ค้าง
      throw e2;
    }
    done.push({ ...p, password: pwd });
    process.stdout.write(`\r  ทำแล้ว ${done.length}`);
  } catch (e) {
    console.error(`\n  ผิดพลาด ${p.username}: ${e.message}`);
  }
}
console.log(`\nสำเร็จ ${done.length}/${plan.filter((p) => p.action !== "skip").length}`);
if (!done.length) process.exit(0);

/* ---- ไฟล์แจกรหัส ---- */
const stamp = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
const root = `commission-app/accounts-${stamp}/SE`;
const note = [
  [`เข้าใช้งานที่: ${LOGIN_URL}`],
  ["ชื่อผู้ใช้ = รหัสพนักงาน (พิมพ์เล็กหรือใหญ่ก็ได้) · เข้าครั้งแรกระบบจะให้ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"],
  ["ลืมรหัสผ่าน: หน้าเข้าสู่ระบบ > ลืมรหัสผ่าน > แท็บ พนักงาน · ไฟล์นี้มีรหัสผ่าน ห้ามส่งต่อในกลุ่มแชตสาธารณะ"],
  [],
];
const header = ["รหัสร้าน", "ชื่อร้าน", "ชื่อ-นามสกุล", "ชื่อเล่น", "ชื่อผู้ใช้", "รหัสผ่านชั่วคราว"];
const toRow = (p) => [p.dealer.code, p.dealer.name, p.rep.name, p.rep.nickname ?? "", p.username, p.password];
const writeBook = (path, rows, sheet) => {
  const ws = XLSX.utils.aoa_to_sheet([...note, header, ...rows]);
  ws["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  writeFileSync(path, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
};
const byStore = new Map();
for (const p of done) {
  if (!byStore.has(p.dealer.code)) byStore.set(p.dealer.code, []);
  byStore.get(p.dealer.code).push(p);
}
for (const [, list] of byStore) {
  const p0 = list[0];
  const areaDir = `${root}/${safeName(p0.area ? `Area_${p0.area.nickname ?? p0.area.name}` : "ไม่มี Area")}`;
  mkdirSync(areaDir, { recursive: true });
  writeBook(`${areaDir}/${p0.dealer.code}_${safeName(p0.dealer.name)}.xlsx`, list.map(toRow), "SE");
}
mkdirSync(root, { recursive: true });
writeBook(`${root}/SE_ทั้งหมด.xlsx`, done.map((p) => toRow(p)), "SE ทั้งหมด");
console.log(`ไฟล์: ${root} (${byStore.size} ร้าน + SE_ทั้งหมด.xlsx)`);
