/* Seed ตาราง master_aliases จากไฟล์ Master_*.csv ในเครื่อง (ใช้ตอนอัปโหลดผ่านหน้าเว็บ ซึ่งไม่มีไฟล์ในเครื่อง)
   - ba_channel : Master_Dealer.csv  "Dealer Name_BA App_N" -> Dealer Code
   - ba_emp     : Master_Member.csv  "Salesperson ID_BA App_N" -> User ID (CR)
   รันซ้ำได้ (upsert) ; ไม่ลบ alias ที่เพิ่มเองภายหลัง
   DRY RUN: node scripts/seed-master-aliases.mjs
   APPLY:   node scripts/seed-master-aliases.mjs --apply
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
function parseCsv(text) {
  const rows = []; let cur = [], f = "", q = false; text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ",") { cur.push(f); f = ""; } else if (c === "\n") { cur.push(f); rows.push(cur); cur = []; f = ""; } else if (c === "\r") { /* skip */ } else f += c; } }
  if (f.length || cur.length) { cur.push(f); rows.push(cur); }
  return rows;
}

const out = new Map(); // kind|alias -> row
const conflicts = [];
const put = (kind, alias, value, note) => {
  alias = String(alias ?? "").trim(); value = String(value ?? "").trim();
  if (!alias || !value) return;
  const k = `${kind}|${alias}`;
  const cur = out.get(k);
  // ชนกัน: ใช้ค่าหลังสุด (ตรงกับสคริปต์ import เดิมที่ Map.set ทับ)
  if (cur && cur.value !== value) conflicts.push(`${kind} "${alias}": ${cur.value} -> ${value}`);
  out.set(k, { kind, alias, value, note });
};

const md = parseCsv(readFileSync("commission-app/Master_Dealer.csv", "utf8"));
const mdh = md[0].map((c) => String(c).trim());
const iCode = mdh.findIndex((h) => /^Dealer Code$/i.test(h));
const iName = mdh.findIndex((h) => /^Dealer Name$/i.test(h));
const baCols = mdh.map((h, i) => (/^Dealer Name_BA App_\d/i.test(h) ? i : -1)).filter((i) => i >= 0);
for (let r = 1; r < md.length; r++) for (const c of baCols) put("ba_channel", md[r][c], md[r][iCode], md[r][iName]);

const mm = parseCsv(readFileSync("commission-app/Master_Member.csv", "utf8"));
const mmh = mm[0].map((c) => String(c).trim());
const iUser = mmh.findIndex((h) => /^User ID$/i.test(h));
const idCols = mmh.map((h, i) => (/^Salesperson ID_BA App_\d/i.test(h) ? i : -1)).filter((i) => i >= 0);
for (let r = 1; r < mm.length; r++) for (const c of idCols) put("ba_emp", mm[r][c], mm[r][iUser], null);

const rows = [...out.values()].map((x) => ({ ...x, updated_at: new Date().toISOString() }));
const byKind = rows.reduce((a, x) => ((a[x.kind] = (a[x.kind] ?? 0) + 1), a), {});
console.log("aliases:", JSON.stringify(byKind), "| ชนกัน (ใช้ค่าหลังสุด):", conflicts.length, conflicts.slice(0, 5));
if (!APPLY) { console.log("(DRY RUN) เพิ่ม --apply"); process.exit(0); }
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from("master_aliases").upsert(rows.slice(i, i + 500), { onConflict: "kind,alias" });
  if (error) { console.error("upsert:", error.message); process.exit(1); }
}
console.log(`DONE upsert ${rows.length}`);
