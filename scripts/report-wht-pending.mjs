/* รายงานภาษีหัก ณ ที่จ่ายที่ยังไม่ได้รับเอกสาร (สถานะ "ไม่ได้รับ") ของร้าน Housing Expert / SCG Home — ระบุงานรายรายการ
   ต้นทาง:
   - WHT : commission-app/WHT/Copy of WHT_LHS  V.1 8.10.69 (003).xlsx  ชีต <ปี> (ค่าเริ่มต้น 2026) + ชีต Grop (ผู้ดูแล)
   - Invoice (NetSuite) : commission-app/WHT/KFInvoiceListPMLHSResults599.xlsx (ทุกชีต) — IV -> Created From (SO) + Project/Job (RD…)
   - งาน : Supabase service_sales_lines (project_number -> ร้าน / ผู้ขาย / ชื่อโครงการ / บริการ)
   ผูกร้าน 2 ทาง: (1) ชื่อลูกค้าในบัญชีเป็นร้านตัวแทน (ร้านเป็นผู้จ่ายเงิน) (2) งานเป็นของร้านใน service_sales_lines (ลูกค้าปลายทางของร้าน)
   อ่านอย่างเดียว ไม่เขียนฐานข้อมูล
   ใช้: node scripts/report-wht-pending.mjs [--year 2026] [--out <file.xlsx>]
*/
import { existsSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const YEAR = arg("--year") ?? "2026";
const WHT_FILE = "commission-app/WHT/Copy of WHT_LHS  V.1 8.10.69 (003).xlsx";
const INV_FILE = "commission-app/WHT/KFInvoiceListPMLHSResults599.xlsx";
const OUT = arg("--out") ?? `commission-app/WHT/WHT_${YEAR}_ค้างรับ_HE_SCGHome_รายงาน.xlsx`;

const env = {};
for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const norm = (s) => String(s ?? "").replace(/\(สาขาที่\s*\d+\)|\(สำนักงานใหญ่\)|สำนักงานใหญ่|\(มหาชน\)|มหาชน|บริษัท|บจก\.?|บจ\.|บมจ\.?|หจก\.?|ห้างหุ้นส่วนจำกัด|จำกัด|จํากัด|จก\.?|^บ\.|[\s.,()\-_]/g, "").toLowerCase();
const cleanDoc = (s) => String(s ?? "").replace(/[\s\t\r\n]/g, "").replace(/\.$/, "").toUpperCase();
const toDate = (n) => (typeof n === "number" ? new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 10) : n ? String(n).slice(0, 10) : null);
const projOf = (s) => { const m = String(s ?? "").match(/\b(E?RD\d{12}|P\d{10})/); return m ? m[1] : null; };

/* ---------- WHT ---------- */
const wb = XLSX.read(readFileSync(WHT_FILE), { type: "buffer" });
if (!wb.Sheets[YEAR]) { console.error(`ไม่พบชีต ${YEAR}`); process.exit(1); }
const pending = XLSX.utils.sheet_to_json(wb.Sheets[YEAR], { defval: null, raw: true }).filter((r) => r.Status === "ไม่ได้รับ");
const grop = new Map(XLSX.utils.sheet_to_json(wb.Sheets["Grop"], { defval: null }).map((r) => [String(r.Department).trim(), r["ผู้ดูแล"]]));

/* ---------- Invoice ---------- */
const iwb = XLSX.read(readFileSync(INV_FILE), { type: "buffer" });
const invBy = new Map();
for (const sn of iwb.SheetNames) for (const r of XLSX.utils.sheet_to_json(iwb.Sheets[sn], { defval: null, raw: true })) {
  const k = cleanDoc(r["Document Number"]); if (k && !invBy.has(k)) invBy.set(k, r);
}

/* ---------- ร้าน (HE / SCG Home) ---------- */
const { data: dealers } = await sb.from("dealers").select("code,name,model,region");
const store = new Map(dealers.filter((d) => /housing|scg home/i.test(d.model ?? "")).map((d) => [d.code, d]));
const alias = new Map(); const add = (n, c) => { const k = norm(n); const code = String(c ?? "").replace(/^0+/, ""); if (k.length >= 3 && code && !alias.has(k)) alias.set(k, code); };
if (existsSync("commission-app/Master_Dealer.csv")) {
  const md = readFileSync("commission-app/Master_Dealer.csv", "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.split(","));
  const h = md[0].map((x) => x.trim()); const ic = h.indexOf("Dealer Code");
  for (const l of md.slice(1)) h.forEach((x, i) => { if (/name/i.test(x)) add(l[i], l[ic]); });
}
for (const d of dealers) add(d.name, d.code);
/* ชื่อนิติบุคคลของร้านจากไฟล์ commission (บางร้านมีชื่อนิติบุคคลเฉพาะในไฟล์นี้ เช่น บ.ทีเค โฮมเซ็นเตอร์ = 5102714) */
const COMM_DIR = "D:/OneDrive - The Siam Cement Public Company Limited/RSS  System - commission/";
if (existsSync(COMM_DIR + "summaryData_SCGHome_2026.xlsx")) for (const r of XLSX.utils.sheet_to_json(XLSX.read(readFileSync(COMM_DIR + "summaryData_SCGHome_2026.xlsx")).Sheets["rawData"])) add(r.Dealer_name, r.Dealer_Code);
if (existsSync(COMM_DIR + "summaryData_HousingExpert_2026.xlsx")) for (const r of XLSX.utils.sheet_to_json(XLSX.read(readFileSync(COMM_DIR + "summaryData_HousingExpert_2026.xlsx")).Sheets["summarry_HEcommission"])) if (r["Dealer Code"]) add(String(r.Customer_name ?? "").replace(/^C\d+\s*/, ""), r["Dealer Code"]);

/* ---------- แถว WHT -> IV -> Project ---------- */
const rows = pending.map((r) => {
  const refs = String(r.IV ?? "").split(/[,\s]+/).map(cleanDoc).filter(Boolean);
  const invs = refs.map((x) => invBy.get(x)).filter(Boolean);
  const projects = [...new Set([...invs.map((i) => projOf(i["Project/Job (c)"]) ?? projOf(i["Created From"])), ...refs.map(projOf)].filter(Boolean))];
  const so = [...new Set(invs.map((i) => String(i["Created From"] ?? "").replace(/^Sales Order #/, "")).filter(Boolean))];
  const projText = [...new Set(invs.map((i) => String(i["Project/Job (c)"] ?? "").split(" : ").slice(1).join(" : ")).filter(Boolean))];
  return { r, refs, invs, projects, so, projText };
});

/* ---------- งานใน service_sales_lines ---------- */
const allProj = [...new Set(rows.flatMap((x) => x.projects))];
const jobBy = new Map();
for (let i = 0; i < allProj.length; i += 200) {
  const { data, error } = await sb.from("service_sales_lines").select("project_number,project_name,dealer_code,dealer_name,sales_name,rep_code,sub_solution_name,group3,order_date,amount_incl_vat").in("project_number", allProj.slice(i, i + 200));
  if (error) { console.error(error.message); process.exit(1); }
  for (const j of data ?? []) if (!jobBy.has(j.project_number)) jobBy.set(j.project_number, j);
}
const repCodes = [...new Set([...jobBy.values()].map((j) => j.rep_code).filter(Boolean))];
const repName = new Map();
if (repCodes.length) { const { data } = await sb.from("sale_reps").select("rep_code,name,nickname").in("rep_code", repCodes); for (const x of data ?? []) repName.set(x.rep_code, x.nickname ? `${x.name} (${x.nickname})` : x.name); }

/* ---------- รวมผล ---------- */
const out = [];
for (const x of rows) {
  const { r } = x;
  const custCode = alias.get(norm(r.NAME));
  const jobs = x.projects.map((p) => jobBy.get(p)).filter(Boolean);
  const jobStore = jobs.map((j) => j.dealer_code).find((c) => c && store.has(c));
  const code = custCode && store.has(custCode) ? custCode : jobStore ?? null;
  if (!code) continue;
  const s = store.get(code);
  const how = custCode && store.has(custCode) ? (jobStore && jobStore !== custCode ? "ร้านเป็นลูกค้า (งานผูกร้านอื่น)" : "ร้านเป็นลูกค้า") : "งานของร้าน (ลูกค้าปลายทาง)";
  const dept = String(r["Department: Name"] ?? "").trim();
  out.push({
    "ประเภทร้าน": s.model, "รหัสร้าน": code, "ร้าน": s.name, "ภาค": s.region ?? "", "ผูกร้านจาก": how,
    "ลูกค้าในบัญชี (ผู้หักภาษี)": r.NAME, "เดือน": toDate(r.Period)?.slice(0, 7), "วันที่เอกสาร": toDate(r.Date), "เลขเอกสาร": r["Document Number"],
    "ยอดภาษีหัก ณ ที่จ่าย": Number(r.Amount) || 0, "อ้างอิง IV": x.refs.join(", "),
    "เลข Project": x.projects.join(", "), "เลข SO": x.so.join(", "),
    "โครงการ / งาน": jobs.map((j) => j.project_name).filter(Boolean).join(" | ") || x.projText.join(" | "),
    "บริการ": [...new Set(jobs.map((j) => j.sub_solution_name).filter(Boolean))].join(", "),
    "ผู้ขาย (Rudy)": [...new Set(jobs.map((j) => j.sales_name).filter(Boolean))].join(", "),
    "พนักงานในแอป": [...new Set(jobs.map((j) => repName.get(j.rep_code)).filter(Boolean))].join(", "),
    "หน่วยงาน (ประเภทงาน)": dept, "ผู้ดูแล": grop.get(dept) ?? "",
    "สถานะการจับคู่": jobs.length ? "พบงาน (Rudy)" : x.projects.length && x.projText.length ? "พบงานจาก Invoice (ไม่อยู่ใน Rudy)" : x.projects.length ? "มีเลข Project แต่ไม่พบชื่องาน" : x.invs.length ? "พบ Invoice แต่ไม่มีเลข Project" : x.refs.length ? "ไม่พบ IV ในไฟล์ Invoice" : "ไม่มีเลขอ้างอิง",
    "หมายเหตุ": r.Memo ?? "",
  });
}
out.sort((a, b) => a["ประเภทร้าน"].localeCompare(b["ประเภทร้าน"]) || a["ร้าน"].localeCompare(b["ร้าน"]) || b["ยอดภาษีหัก ณ ที่จ่าย"] - a["ยอดภาษีหัก ณ ที่จ่าย"]);

const sum = new Map();
for (const o of out) { const k = o["รหัสร้าน"]; const v = sum.get(k) ?? { "ประเภทร้าน": o["ประเภทร้าน"], "รหัสร้าน": k, "ร้าน": o["ร้าน"], "ภาค": o["ภาค"], "จำนวนเอกสาร": 0, "ยอดภาษีรวม": 0, "ระบุงานได้": 0, _p: new Set(), _s: new Set(), _o: new Set() }; v["จำนวนเอกสาร"]++; v["ยอดภาษีรวม"] += o["ยอดภาษีหัก ณ ที่จ่าย"]; if (o["สถานะการจับคู่"].startsWith("พบงาน")) v["ระบุงานได้"]++; o["เลข Project"] && o["เลข Project"].split(", ").forEach((p) => v._p.add(p)); o["ผู้ขาย (Rudy)"] && v._s.add(o["ผู้ขาย (Rudy)"]); o["ผู้ดูแล"] && v._o.add(o["ผู้ดูแล"]); sum.set(k, v); }
const summary = [...sum.values()].map(({ _p, _s, _o, ...v }) => ({ ...v, "ยอดภาษีรวม": Math.round(v["ยอดภาษีรวม"] * 100) / 100, "จำนวนงาน (Project)": _p.size, "ผู้ขาย": [..._s].join(", "), "ผู้ดูแล": [..._o].join(", ") }))
  .sort((a, b) => a["ประเภทร้าน"].localeCompare(b["ประเภทร้าน"]) || b["ยอดภาษีรวม"] - a["ยอดภาษีรวม"]);

const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(summary), "สรุปรายร้าน");
XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(out), "รายการเอกสาร+งาน");
XLSX.writeFile(book, OUT);

const f = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
console.log(`ปี ${YEAR}: ค้างรับทั้งหมด ${pending.length} รายการ | Invoice ${invBy.size} | งานที่พบ ${jobBy.size}/${allProj.length} project`);
for (const m of ["Housing Expert", "SCG Home"]) { const r = out.filter((o) => o["ประเภทร้าน"] === m); console.log(`  ${m}: ${new Set(r.map((o) => o["รหัสร้าน"])).size} ร้าน ${r.length} เอกสาร ฿${f(r.reduce((s, o) => s + o["ยอดภาษีหัก ณ ที่จ่าย"], 0))}`); }
const byHow = {}; for (const o of out) byHow[o["ผูกร้านจาก"]] = (byHow[o["ผูกร้านจาก"]] ?? 0) + 1; console.log("  ผูกร้านจาก:", JSON.stringify(byHow));
const byMatch = {}; for (const o of out) byMatch[o["สถานะการจับคู่"]] = (byMatch[o["สถานะการจับคู่"]] ?? 0) + 1; console.log("  สถานะการจับคู่:", JSON.stringify(byMatch));
for (const s of summary) console.log("  ", JSON.stringify([s["ประเภทร้าน"], s["ร้าน"], s["จำนวนเอกสาร"], s["ยอดภาษีรวม"], s["ระบุงานได้"], s["จำนวนงาน (Project)"], s["ผู้ขาย"]]));
console.log("saved", OUT);
