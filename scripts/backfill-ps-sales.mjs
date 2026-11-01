/* backfill sale_rep_name ใน ba_profit_share_lines จาก Pending B2C Offline (job_code -> assignee_sales_team)
   ต้องมีคอลัมน์ sale_rep_name ในตารางก่อน (ผ่าน migration)
   RUN: node scripts/backfill-ps-sales.mjs
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const BADIR = "commission-app/BA Incentive_พนักงาน";
const WINFILE = "Pending B2C Offline.xlsx";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* job_code -> assignee_sales_team */
const wb = XLSX.read(readFileSync(join(BADIR, WINFILE)), { type: "buffer" });
const sn = wb.SheetNames.find((s) => /raw/i.test(s)) || "raw data";
const d = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false });
const header = d[0].map((c) => String(c ?? "").trim());
const iJob = header.findIndex((h) => /^job_code$/i.test(h));
const iSales = header.findIndex((h) => /^assignee_sales_team$/i.test(h));
const jobToSales = new Map();
for (let r = 1; r < d.length; r++) {
  const job = String(d[r][iJob] ?? "").trim();
  const sales = String(d[r][iSales] ?? "").trim();
  if (job && sales && !jobToSales.has(job)) jobToSales.set(job, sales);
}
console.log(`job_code -> sales map = ${jobToSales.size}`);

/* ดึงแถวทั้งหมดที่มี job_code (page ทีละ 1000 เพราะ default limit) */
const data = [];
{
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data: chunk, error } = await sb
      .from("ba_profit_share_lines")
      .select("id, job_code")
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    data.push(...chunk);
    if (chunk.length < PAGE) break;
  }
}
console.log(`ดึงแถวทั้งหมด = ${data.length}`);

/* จัดกลุ่ม id ตามชื่อพนักงาน แล้ว update เป็นชุด (ทีละ sales) */
const byName = new Map();
let matched = 0;
for (const row of data) {
  const job = String(row.job_code ?? "").trim();
  const name = job ? jobToSales.get(job) : null;
  if (!name) continue;
  matched++;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(row.id);
}
console.log(`แถวที่ match = ${matched}/${data.length} | พนักงาน distinct ${byName.size}`);

let done = 0;
for (const [name, ids] of byName) {
  // update ทีละ chunk 500 id
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { error: uErr } = await sb.from("ba_profit_share_lines").update({ sale_rep_name: name }).in("id", chunk);
    if (uErr) { console.error("update ล้มเหลว:", uErr.message); process.exit(1); }
    done += chunk.length;
    process.stdout.write(`\r  update ${done}/${matched}`);
  }
}
console.log(`\nDONE backfill sale_rep_name = ${matched} แถว`);
