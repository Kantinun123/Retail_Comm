/* สร้าง/ปรับบัญชีผู้ใช้ชุดแรก (12 พ.ย. 69) + ออกไฟล์แจกรหัสแยกตาม Area
   -------------------------------------------------------------
   - ร้านค้า (64 ร้าน): ชื่อผู้ใช้ = รหัสร้าน + ชื่อย่อ 4 ตัว (แบบเข้ม) -> อีเมลภายใน <username>@retail-comm.local
       * บัญชีเดิม (<code>@retail-comm.local) -> เปลี่ยนอีเมลเป็นชื่อผู้ใช้ใหม่ + ออกรหัสชั่วคราวใหม่
       * ร้าน 5102381 ผูกกับบัญชีทดสอบ dealer.demo@example.com -> ระงับบัญชีทดสอบ แล้วสร้างบัญชีจริง
   - Area (7) / Coach (7): ชื่อผู้ใช้ = อีเมลบริษัท (ตัวพิมพ์เล็ก) ; role area / coach ; rep_code จาก sale_reps
   - ทุกบัญชี: รหัสชั่วคราวใหม่ + must_change_password (ต้องตั้งรหัสใหม่ตอนเข้าครั้งแรก)
   - ไฟล์: commission-app/accounts-<date>/ (gitignored) — Area ละ 1 ไฟล์ (ร้านที่ดูแล + บัญชีของ Area) + ไฟล์ Coach
   DRY RUN: node scripts/provision-accounts.mjs
   APPLY:   node scripts/provision-accounts.mjs --apply
*/
import { mkdirSync, readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DOMAIN = "retail-comm.local";
const LOGIN_URL = "https://retail-comm.vercel.app/auth/email";
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ชื่อย่อร้าน (ผู้ใช้ตรวจแล้ว) */
const ABBR = {
  "5100011": "wiwa", "5100014": "sang", "5100034": "sasi", "5100042": "nawa", "5100071": "rosa", "5100074": "kitp", "5100786": "boon", "5100895": "smrt", "5100902": "cent",
  "5100044": "wora", "5100119": "good", "5100126": "jamn", "5100129": "supa", "5100142": "chwi", "5100910": "patt", "5100915": "sara", "5100974": "sach", "5101001": "uesu", "5100657": "wood", "5100973": "ront",
  "5100088": "ungy", "5100090": "bamp", "5100804": "thac", "5100846": "rayo", "5100980": "chai", "5100724": "bach", "5102653": "chan", "5102714": "chcs",
  "5100163": "sukh", "5100186": "lamp", "5100808": "tang", "5100887": "weer", "5101685": "nopp", "5100811": "tuek", "5101027": "crai",
  "5100215": "angk", "5100236": "nong", "5100250": "suih", "5100252": "kuyo", "5100266": "chpp", "5100908": "abrg", "5100967": "deco", "5100968": "udon", "5100969": "ying", "5102381": "chol",
  "3052659": "huat", "5100782": "teer", "5101021": "prem", "5102354": "hmst", "5102652": "wari",
  "5100311": "thch", "5100350": "saen", "5100676": "wana", "5100710": "yong", "5100755": "hmax", "5100779": "kien", "5100817": "chom", "5101025": "rano", "5100928": "chee", "5100971": "loha", "5101733": "tkhb",
  "5100751": "jiab", "5100289": "sahm", "5100962": "siri",
};
/* Area / Coach (อีเมลที่ผู้ใช้ส่งมา) */
const STAFF = [
  ["chanarow@scg.com", "area"], ["chuleeps@scg.com", "area"], ["thummans@scg.com", "area"], ["phinyadb@scg.com", "area"],
  ["manaschb@scg.com", "area"], ["somphone@scg.com", "area"], ["anuchity@scg.com", "area"],
  ["komsanpi@scg.com", "coach"], ["narongrn@scg.com", "coach"], ["thanayut@scg.com", "coach"], ["pramotch@scg.com", "coach"],
  ["pongpatc@scg.com", "coach"], ["peerasas@scg.com", "coach"], ["witsarpl@scg.com", "coach"],
];

/* รหัสชั่วคราว 10 ตัว (เหมือน src/lib/supabase/temp-password.ts — ตัดตัวที่สับสน 0/O/1/l/I) */
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const tempPassword = () => Array.from({ length: 10 }, () => ALPHA[randomInt(ALPHA.length)]).join("");

const die = (msg) => { console.error(msg); process.exit(1); };

/* ---- ข้อมูลอ้างอิง ---- */
const { data: dealers, error: dErr } = await sb.from("dealers").select("code,name,model,is_active").eq("is_active", true);
if (dErr) die(dErr.message);
const { data: reps, error: rErr } = await sb.from("sale_reps").select("rep_code,name,nickname,position,email");
if (rErr) die(rErr.message);
const { data: assigns, error: aErr } = await sb.from("rep_store_assignments").select("rep_code,dealer_code");
if (aErr) die(aErr.message);
const { data: profiles, error: pErr } = await sb.from("profiles").select("id,email,role,status,dealer_code,rep_code");
if (pErr) die(pErr.message);
const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) die(error.message);
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const userByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));
const repByEmail = new Map(reps.filter((r) => r.email).map((r) => [r.email.trim().toLowerCase(), r]));
const repByCode = new Map(reps.map((r) => [r.rep_code, r]));

// ตรวจชื่อย่อ: ครบทุกร้าน active + ไม่ซ้ำ
const missing = dealers.filter((d) => !ABBR[d.code]).map((d) => d.code);
if (missing.length) die(`ร้าน active ที่ยังไม่มีชื่อย่อ: ${missing.join(", ")}`);
const abbrs = Object.values(ABBR);
if (new Set(abbrs).size !== abbrs.length) die("ชื่อย่อซ้ำกัน");
if (abbrs.some((a) => !/^[a-z]{4}$/.test(a))) die("ชื่อย่อต้องเป็นตัวพิมพ์เล็ก a-z 4 ตัว");

/* ---- แผน ---- */
const plan = [];
for (const d of dealers.sort((a, b) => a.code.localeCompare(b.code))) {
  const username = `${d.code}${ABBR[d.code]}`;
  const email = `${username}@${DOMAIN}`;
  const prof = profiles.find((p) => p.role === "dealer" && p.status === "approved" && p.dealer_code === d.code);
  const area = assigns.filter((a) => a.dealer_code === d.code).map((a) => repByCode.get(a.rep_code)).find((r) => r?.position === "area_mng");
  const coach = assigns.filter((a) => a.dealer_code === d.code).map((a) => repByCode.get(a.rep_code)).find((r) => r?.position === "coach");
  const base = { kind: "dealer", code: d.code, name: d.name, model: d.model, username, email, area, coach };
  if (prof && prof.email?.toLowerCase().endsWith(`@${DOMAIN}`)) plan.push({ ...base, action: "update", userId: prof.id, oldEmail: prof.email });
  else if (prof) plan.push({ ...base, action: "replace-test", revokeId: prof.id, oldEmail: prof.email });
  else plan.push({ ...base, action: "create" });
}
for (const [email, role] of STAFF) {
  const rep = repByEmail.get(email);
  if (!rep) die(`ไม่พบ ${email} ใน sale_reps`);
  const existing = userByEmail.get(email);
  plan.push({ kind: role, email, username: email, rep, action: existing ? "reset" : "create", userId: existing?.id });
}

const cnt = {};
plan.forEach((p) => (cnt[`${p.kind}:${p.action}`] = (cnt[`${p.kind}:${p.action}`] ?? 0) + 1));
console.log(APPLY ? "================ APPLY ================" : "================ DRY RUN ================");
console.log("แผน:", JSON.stringify(cnt));
plan.filter((p) => p.action !== "update").forEach((p) => console.log(`  ${p.kind} ${p.action} ${p.username}${p.oldEmail ? ` (แทน ${p.oldEmail})` : ""}`));
console.log("ตัวอย่างร้าน:", plan.filter((p) => p.kind === "dealer").slice(0, 3).map((p) => `${p.oldEmail ?? "-"} -> ${p.username}`).join(" | "));
const noArea = plan.filter((p) => p.kind === "dealer" && !p.area);
if (noArea.length) console.log("ร้านที่ไม่มี Area ดูแล:", noArea.map((p) => p.code).join(", "));
if (!APPLY) { console.log("\n(DRY RUN) เพิ่ม --apply เพื่อทำจริง"); process.exit(0); }

/* ---- ทำจริง ---- */
const now = new Date().toISOString();
const done = [];
for (const p of plan) {
  const pwd = tempPassword();
  try {
    if (p.kind === "dealer" && p.action === "update") {
      const { error } = await sb.auth.admin.updateUserById(p.userId, { email: p.email, password: pwd, email_confirm: true });
      if (error) throw error;
      const { error: e2 } = await sb.from("profiles").update({ email: p.email, must_change_password: true }).eq("id", p.userId);
      if (e2) throw e2;
    } else if (p.kind === "dealer") {
      if (p.action === "replace-test") {
        const { error } = await sb.from("profiles").update({ status: "rejected", role: null, dealer_code: null, reject_reason: "บัญชีทดสอบ — แทนด้วยบัญชีจริง" }).eq("id", p.revokeId);
        if (error) throw error;
      }
      const { data: created, error } = await sb.auth.admin.createUser({ email: p.email, password: pwd, email_confirm: true, user_metadata: { full_name: p.name } });
      if (error) throw error;
      const { error: e2 } = await sb.from("profiles").update({ role: "dealer", dealer_code: p.code, status: "approved", must_change_password: true, approved_at: now }).eq("id", created.user.id);
      if (e2) { await sb.auth.admin.deleteUser(created.user.id); throw e2; }
    } else {
      let id = p.userId;
      const fullName = p.rep.nickname ? `${p.rep.name} (${p.rep.nickname})` : p.rep.name;
      if (p.action === "create") {
        const { data: created, error } = await sb.auth.admin.createUser({ email: p.email, password: pwd, email_confirm: true, user_metadata: { full_name: fullName } });
        if (error) throw error;
        id = created.user.id;
      } else {
        const { error } = await sb.auth.admin.updateUserById(id, { password: pwd });
        if (error) throw error;
      }
      const { error: e2 } = await sb.from("profiles").update({ role: p.kind, rep_code: p.rep.rep_code, full_name: fullName, status: "approved", must_change_password: true, approved_at: now }).eq("id", id);
      if (e2) throw e2;
    }
    done.push({ ...p, password: pwd });
    process.stdout.write(`\r  ทำแล้ว ${done.length}/${plan.length}`);
  } catch (e) {
    console.error(`\n  ผิดพลาด ${p.username}: ${e.message}`);
  }
}
console.log(`\nสำเร็จ ${done.length}/${plan.length}`);

/* ---- ไฟล์แจกรหัส ---- */
const dir = `commission-app/accounts-${now.slice(0, 10).replace(/-/g, "")}`;
mkdirSync(dir, { recursive: true });
const areaReps = reps.filter((r) => r.position === "area_mng" && STAFF.some(([e]) => e === r.email?.trim().toLowerCase()));
const note = [
  [`เข้าใช้งานที่: ${LOGIN_URL}`],
  ["เข้าครั้งแรกระบบจะให้ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัว) — รหัสชั่วคราวใช้ได้ครั้งแรกเท่านั้น"],
  ["ชื่อผู้ใช้พิมพ์ตัวเล็กหรือตัวใหญ่ก็ได้ · ไฟล์นี้มีรหัสผ่าน ห้ามส่งต่อในกลุ่มแชตสาธารณะ"],
  [],
];
for (const ar of areaReps) {
  const label = ar.nickname ?? ar.name;
  const mine = done.filter((p) => p.kind === "dealer" && p.area?.rep_code === ar.rep_code);
  const self = done.find((p) => p.kind === "area" && p.rep.rep_code === ar.rep_code);
  const wb = XLSX.utils.book_new();
  const rows = [...note, ["รหัสร้าน", "ชื่อร้าน", "ประเภท", "Coach", "ชื่อผู้ใช้", "รหัสผ่านชั่วคราว"],
    ...mine.map((p) => [p.code, p.name, p.model, p.coach?.nickname ?? p.coach?.name ?? "", p.username, p.password])];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 10 }, { wch: 44 }, { wch: 15 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, "ร้านค้า");
  if (self) {
    const ws2 = XLSX.utils.aoa_to_sheet([...note, ["ชื่อ", "ชื่อผู้ใช้ (อีเมล)", "รหัสผ่านชั่วคราว"], [`${ar.name} (${label})`, self.username, self.password]]);
    ws2["!cols"] = [{ wch: 32 }, { wch: 24 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "บัญชี Area");
  }
  XLSX.writeFile(wb, `${dir}/Area_${label}.xlsx`);
  console.log(`  ไฟล์ Area_${label}.xlsx: ร้าน ${mine.length}${self ? " + บัญชี Area" : ""}`);
}
const coaches = done.filter((p) => p.kind === "coach");
{
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([...note, ["ชื่อ", "ชื่อผู้ใช้ (อีเมล)", "รหัสผ่านชั่วคราว", "ร้านที่ดูแล"],
    ...coaches.map((p) => [`${p.rep.name} (${p.rep.nickname ?? ""})`, p.username, p.password, assigns.filter((a) => a.rep_code === p.rep.rep_code).length])]);
  ws["!cols"] = [{ wch: 32 }, { wch: 24 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, "Coach");
  XLSX.writeFile(wb, `${dir}/Coach.xlsx`);
  console.log(`  ไฟล์ Coach.xlsx: ${coaches.length} คน`);
}
const orphan = done.filter((p) => p.kind === "dealer" && !areaReps.some((a) => a.rep_code === p.area?.rep_code));
if (orphan.length) console.log("  ร้านที่ไม่อยู่ในไฟล์ Area ใด:", orphan.map((p) => p.username).join(", "));
console.log(`โฟลเดอร์: ${dir}`);
