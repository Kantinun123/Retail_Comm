/* Phase ค: insert ตาราง sales (10,274 แถว) ขึ้น Supabase ผ่าน supabase-js + service role (bypass RLS)
   อ่านข้อมูลจาก raw-data.ts (หลัง remap) โดยตรง แล้ว upsert เป็น chunk
   ใช้ env จาก .env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
   รัน: node scripts/seed-sales.mjs
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* ---------- โหลด env จาก .env เอง (ไม่พึ่ง dotenv) ---------- */
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("ขาด env: NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

/* ---------- โหลด SALES จาก raw-data.ts ---------- */
let src = readFileSync("src/lib/commission/raw-data.ts", "utf8");
src = src.replace(/^import\s+type[^;]*;/m, "");
src = src.replace(/export\s+const\s+(\w+)\s*:\s*[A-Za-z0-9_]+\[\]\s*=/g, "const $1 =");
const data = new Function(src + "\nreturn { SALES };")();

const dateOrNull = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const emptyNull = (v) => (v === undefined || v === "" ? null : v);

const rows = data.SALES.map((s) => ({
  id: s.id,
  period: s.period,
  emp_code: emptyNull(s.empId),
  sol_id: emptyNull(s.solId),
  dealer_code: emptyNull(s.dealerCode),
  sale_date: dateOrNull(s.date),
  sold_date: dateOrNull(s.soldDate),
  customer: s.customer ?? "",
  amount: s.amount ?? 0,
  comm: s.comm ?? null,
  inc: s.inc ?? null,
  status: s.status ?? "pending",
  project_id: s.projectId ?? "",
  tracking: s.tracking ?? "",
  src: emptyNull(s.src),
  seller: emptyNull(s.seller),
  ben_group: emptyNull(s.benGroup),
  close_range: emptyNull(s.closeRange),
  close_date_raw: emptyNull(s.closeDateRaw),
  pay_date_raw: emptyNull(s.payDateRaw),
  comm_rate: emptyNull(s.commRate),
  inc_rate: emptyNull(s.incRate),
}));

/* ---------- upsert เป็น chunk ---------- */
const CHUNK = 500;
let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const { error } = await sb.from("sales").upsert(chunk, { onConflict: "id" });
  if (error) {
    console.error(`chunk ${i}-${i + chunk.length} ERROR:`, error.message);
    process.exit(1);
  }
  done += chunk.length;
  process.stdout.write(`\rupserted ${done}/${rows.length}`);
}
console.log(`\nDONE sales upserted: ${done}`);
