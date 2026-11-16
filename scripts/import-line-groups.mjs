// นำเข้า/คำนวณสถานะกลุ่ม Line ลูกค้า ของงาน ROOF SERVICE (LHS/Rudy) ร้าน Housing Expert + SCG Home
// -> ตาราง line_tracking_jobs (แทนที่ทั้งชุดด้วย batch ใหม่)
//
// แหล่งข้อมูล
//   งาน      : service_sales_lines (group3 = ROOF SERVICE, building_type OB/NONRES — เกณฑ์เดียวกับหน้ายอดขายงานบริการ)
//   ลูกค้า/OP : win_contract_all.xlsx (customer_first/last_name, customer_type, ref_opp) + CRM design_intake_lines (rudy_id, home_id)
//   กลุ่ม Line: โฟลเดอร์ --dir
//     *group_register*.xlsx       ชีต data: job_number (RD/OP คั่นด้วยจุลภาค) = ลงทะเบียนแล้ว
//     เทียบ add bot*.xlsx          ชีต "ลงทะเบียนกลุ่ม" (Register Yes/No + job_number) และชีต "Data" (Job + Add Bot + Register)
//     (*group_not_register*.xlsx ไม่มีเลขงาน/ร้าน จึงจับคู่ไม่ได้ — ไม่ใช้)
//
// กติกา
//   - เฉพาะงานช่องทาง B2C (คอลัมน์ H7 ของไฟล์ Rudy)
//   - ลูกค้าคนเดียวกัน = home_id เดียวกันใน CRM หรือ ร้านเดียวกัน + ชื่อลูกค้าเดียวกัน (ดู norm()) -> 1 กลุ่ม Line
//   - สถานะของลูกค้า = สถานะที่ดีที่สุดของงานทั้งหมด: register > not_register > no_bot ; ไม่มี = null ("ไม่มีข้อมูล")
//   - เลขใบเสนอราคา (Q...) จับคู่ไม่ได้ จึงไม่นับ
//
// ใช้: node --max-old-space-size=8192 scripts/import-line-groups.mjs [--dir <โฟลเดอร์>] [--win <win_contract_all.xlsx>] [--from 2026-01] [--apply]
import { readFileSync, readdirSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes("--apply");
const DIR = arg("--dir", "commission-app/ข้อมูลการ Add กลุ่ม Line");
const WIN = arg("--win", "D:/OneDrive - The Siam Cement Public Company Limited/RSS  System - PRD_CSD/win_contract_all.xlsx");
const FROM = arg("--from", "2026-01");
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = async (q) => { const r = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; r.push(...data); if (data.length < 1000) break; } return r; };
const mdy = (s) => { const p = String(s ?? "").trim().split("/"); if (p.length !== 3) return null; const y = Number(p[2]) < 100 ? 2000 + Number(p[2]) : Number(p[2]); return `${y}-${p[0].padStart(2, "0")}-${p[1].padStart(2, "0")}`; };

// ---------- งาน ----------
const dealers = await all(() => sb.from("dealers").select("code, model").in("model", ["Housing Expert", "SCG Home"]));
const storeOk = new Set(dealers.map((d) => d.code));
const lines = await all(() => sb.from("service_sales_lines").select("project_number, dealer_code, period, order_date, h5, sales_name, rep_code, amount_incl_vat").eq("group3", "ROOF SERVICE").in("building_type", ["OB", "NONRES"]).gte("period", FROM));
const jobs = new Map();
for (const l of lines) {
  if (!storeOk.has(l.dealer_code)) continue;
  const j = jobs.get(l.project_number);
  if (!j) jobs.set(l.project_number, { ...l, amount: Number(l.amount_incl_vat) || 0 });
  else { j.amount += Number(l.amount_incl_vat) || 0; if (l.period < j.period) Object.assign(j, { period: l.period, order_date: l.order_date, dealer_code: l.dealer_code }); }
}
console.log(`งาน ROOF SERVICE (HE+SCG Home) ตั้งแต่ ${FROM}: ${jobs.size} งาน`);

// ---------- ลูกค้า + OP ----------
const wbW = XLSX.read(readFileSync(WIN));
const raw = XLSX.utils.sheet_to_json(wbW.Sheets[wbW.SheetNames[0]], { defval: "", raw: false });
const projOpps = new Map(), custOf = new Map();
const addOpp = (p, o) => { if (!p || !o) return; p = String(p).trim().slice(0, 14); o = String(o).trim(); if (!/^OP\d{12}$/.test(o)) return; projOpps.set(p, (projOpps.get(p) ?? new Set()).add(o)); };
// ชื่อลูกค้าใน Rudy = "<ลูกค้า/บริษัท> (<บ้านคุณ…/แปลง…/ประเภทงาน>) <ต่อท้าย>"
// กติกา (ผู้ใช้ยืนยัน พ.ย. 69):
//   - ต่างกันแค่ประเภทงาน (รอบบน/รอบล่าง/หลังที่ N/Truss/ค่าแรงมุง/โรงรถ ฯลฯ) = ลูกค้าเดียวกัน
//   - บริษัทเดียวกันหลายแปลง (แปลง A1/A2, แปลง 120…) = ลูกค้าเดียวกัน
//   - บริษัทเดียวกันแต่ "บ้านคุณ…" ในวงเล็บเป็นคนละคน = คนละลูกค้า
const WORK_WORDS = /(รอบ\s*(บน|ล่าง|แรก|สอง|\d+)|หลัง\s*ที่\s*\d+|หลังที่สอง|แปลง\s*[A-Za-z0-9ก-๙\-]+|เฟส\s*\d+|phase\s*\d+|งวด\s*\d+|truss|ค่าแรง\s*มุง|เฉพาะ\s*แรง|มุง|งาน\s*เพิ่มเติม|ต่อเติม|โรง\s*(จอด)?\s*รถ|ตัวบ้าน|กันสาด|อะเส|value|type\s*[a-z0-9]+|ดาร์กเกรย์)/gi;
const TITLE = /(นางสาว|นาย|นาง|คุณ|บ้าน|บจก\.?|บริษัท|จำกัด|หจก\.?|ห้างหุ้นส่วน|บ\.(?=\s*[ก-๙A-Za-z]))/g;
const squash = (s) => s.replace(/[\s._\-()/:,+]+/g, "").toLowerCase();
const norm = (s) => {
  const full = String(s ?? "");
  // เจ้าของบ้านในวงเล็บ: "บ้านคุณกัญชพร อินธรรม" -> "กัญชพร" (ชื่อต้น)
  const owner = (full.match(/\(([^)]*)\)/g) ?? []).map((x) => x.match(/คุณ\s*([ก-๙A-Za-z]{2,})/)?.[1]).find(Boolean) ?? "";
  const base = squash(full.replace(/\(.*?\)/g, " ").replace(WORK_WORDS, " ").replace(TITLE, ""));
  return owner ? `${base}#${owner.toLowerCase()}` : base;
};
let nonB2c = 0;
for (const r of raw) {
  const p = String(r.project_number).trim();
  // ทีมที่เกี่ยวข้องให้นับเฉพาะช่องทาง B2C (H7)
  if (jobs.has(p) && String(r.H7).trim() !== "B2C") { jobs.delete(p); nonB2c++; }
  addOpp(p, r.ref_opp);
  if (!custOf.has(p)) custOf.set(p, {
    name: `${String(r.customer_first_name).trim()} ${String(r.customer_last_name).trim()}`.replace(/\s+/g, " ").trim(),
    key: norm(`${r.customer_first_name}${r.customer_last_name}`),
    type: String(r.customer_type_name || "").trim() || null,
    province: String(r.province_name || "").trim() || null,
  });
}
console.log(`ตัดงานที่ไม่ใช่ B2C (H7) ${nonB2c} งาน -> เหลือ ${jobs.size} งาน`);
const crm = await all(() => sb.from("design_intake_lines").select("opp_id, rudy_id, home_id").not("rudy_id", "is", null));
const homeOfOpp = new Map();
for (const c of crm) { String(c.rudy_id).split(/[,\s]+/).forEach((rd) => addOpp(rd, c.opp_id)); if (c.home_id) homeOfOpp.set(c.opp_id, c.home_id); }
const oppProj = new Map(); for (const [p, s] of projOpps) for (const o of s) oppProj.set(o, p);

// ---------- รวมเป็นลูกค้า (union-find) ----------
const parent = new Map([...jobs.keys()].map((p) => [p, p]));
const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
const byKey = new Map();
const link = (k, p) => { if (!byKey.has(k)) return byKey.set(k, p); const a = find(byKey.get(k)), b = find(p); if (a !== b) parent.set(b, a); };
for (const p of jobs.keys()) {
  for (const o of projOpps.get(p) ?? []) { const h = homeOfOpp.get(o); if (h) link(`H:${h}`, p); }
  const c = custOf.get(p);
  if (c && c.key.length >= 4) link(`N:${jobs.get(p).dealer_code}:${c.key}`, p);
}

// ---------- สถานะกลุ่ม Line ต่องาน ----------
const RANK = { register: 3, not_register: 2, no_bot: 1 };
const st = new Map(); // project -> { status, group, created, source }
const setSt = (p, status, info) => { if (!p || !jobs.has(p)) return; const cur = st.get(p); if (!cur || RANK[status] > RANK[cur.status]) st.set(p, { status, ...info }); };
const toProj = (t) => { t = String(t).trim().replace(/\/\d+$/, ""); if (/^RD\d{12}/.test(t)) return t.slice(0, 14); if (/^OP\d{12}/.test(t)) return oppProj.get(t.slice(0, 14)); return null; };
const tokens = (s) => String(s ?? "").split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
const files = readdirSync(DIR).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$") && !f.startsWith("สรุป"));
let latestGroup = "";
const seen = (d) => { if (d && d > latestGroup) latestGroup = d; return d; };
for (const f of files.filter((x) => /group_register/i.test(x) && !/not_register/i.test(x))) {
  const rows = XLSX.utils.sheet_to_json(XLSX.read(readFileSync(`${DIR}/${f}`)).Sheets.data, { defval: "", raw: false });
  rows.forEach((g) => tokens(g.job_number).forEach((t) => setSt(toProj(t), "register", { group: g.group_name, created: seen(mdy(g.created_at)), source: f })));
  console.log(`${f}: ${rows.length} แถว`);
}
for (const f of files.filter((x) => /^เทียบ add bot/i.test(x))) {
  const wb = XLSX.read(readFileSync(`${DIR}/${f}`));
  const gs = wb.Sheets["ลงทะเบียนกลุ่ม"] ? XLSX.utils.sheet_to_json(wb.Sheets["ลงทะเบียนกลุ่ม"], { defval: "", raw: false }) : [];
  gs.forEach((g) => tokens(g.job_number).forEach((t) => setSt(toProj(t), g.Register === "Yes" ? "register" : "not_register", { group: g.group_name, created: seen(mdy(g.created_at)), source: `${f} (ลงทะเบียนกลุ่ม)` })));
  const ds = wb.Sheets.Data ? XLSX.utils.sheet_to_json(wb.Sheets.Data, { defval: "", raw: false }) : [];
  ds.forEach((r) => {
    const s = r.Register === "Register" ? "register" : r.Register === "Not Register" ? "not_register" : r["Add Bot"] === "No" ? "no_bot" : null;
    if (s) setSt(toProj(r.Job), s, { group: r.Group_Name || null, created: mdy(r["วันที่ Add Bot"]), source: `${f} (Data)` });
  });
  console.log(`${f}: ลงทะเบียนกลุ่ม ${gs.length} แถว, Data ${ds.length} แถว`);
}

// ---------- รวมต่อลูกค้า ----------
const cust = new Map();
for (const [p, j] of jobs) {
  const r = find(p);
  const c = cust.get(r) ?? { id: r, period: j.period, dealer: j.dealer_code, best: null };
  if (j.period < c.period) { c.period = j.period; c.dealer = j.dealer_code; }
  const s = st.get(p);
  if (s && (!c.best || RANK[s.status] > RANK[c.best.status])) c.best = s;
  cust.set(r, c);
}
const batch = new Date().toISOString();
const rows = [...jobs.values()].map((j) => {
  const c = cust.get(find(j.project_number));
  const s = st.get(j.project_number);
  const info = custOf.get(j.project_number);
  return {
    batch, project_number: j.project_number, dealer_code: j.dealer_code, period: j.period, order_date: j.order_date, h5: j.h5, sales_name: j.sales_name, rep_code: j.rep_code,
    amount: Math.round(j.amount * 100) / 100, opp_ids: [...(projOpps.get(j.project_number) ?? [])].join(", ") || null,
    customer_id: c.id, customer_name: info?.name || null, customer_type: info?.type ?? null, province: info?.province ?? null,
    customer_period: c.period, customer_dealer: c.dealer,
    job_status: s?.status ?? null, customer_status: c.best?.status ?? null,
    group_name: (s ?? c.best)?.group ?? null, group_created: (s ?? c.best)?.created ?? null, status_source: (s ?? c.best)?.source ?? null,
    source_date: latestGroup || null,
  };
});
const C = [...cust.values()];
const count = (k) => C.filter((c) => (c.best?.status ?? null) === k).length;
console.log(`ลูกค้า ${C.length} ราย (หลายงาน ${C.filter((c) => [...jobs.keys()].filter((p) => find(p) === c.id).length > 1).length}) : ลงทะเบียน ${count("register")} · ไม่ลงทะเบียน ${count("not_register")} · ไม่ Add Bot ${count("no_bot")} · ไม่มีข้อมูล ${count(null)} ; ข้อมูลกลุ่มล่าสุด ${latestGroup}`);

// --debug: แสดงลูกค้าที่รวมหลายชื่อเข้าด้วยกัน ไว้ตรวจกติกา
if (process.argv.includes("--debug")) {
  const names = new Map();
  for (const p of jobs.keys()) { const r = find(p); names.set(r, (names.get(r) ?? new Set()).add(custOf.get(p)?.name ?? p)); }
  [...names.values()].filter((s) => s.size > 1).forEach((s) => console.log(`  รวม: ${[...s].join(" | ")}`));
}

if (!APPLY) { console.log("dry-run — เพิ่ม --apply เพื่อบันทึก"); process.exit(0); }
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from("line_tracking_jobs").insert(rows.slice(i, i + 500));
  if (error) { await sb.from("line_tracking_jobs").delete().eq("batch", batch); throw error; }
}
const { error: dErr } = await sb.from("line_tracking_jobs").delete().neq("batch", batch);
if (dErr) throw dErr;
console.log(`บันทึก ${rows.length} แถว (batch ${batch})`);
