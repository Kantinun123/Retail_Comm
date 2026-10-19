/* Phase ค: แปลง raw-data.ts (หลัง remap) -> ไฟล์ SQL batch สำหรับ insert ขึ้น Supabase
   อ่าน export arrays ด้วย dynamic import (ไฟล์เป็น TS แต่ค่าเป็น literal ล้วน -> ใช้ regex ตัดเอา)
   แต่เพื่อความแม่น ใช้วิธี transpile ง่าย ๆ: strip type import + export const -> global
   เขียนไฟล์ SQL ลง scripts/out/ (gitignored ภายหลัง)
   รัน: node scripts/export-for-supabase.mjs
*/
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const RAW = "src/lib/commission/raw-data.ts";
const OUT = "scripts/out";
mkdirSync(OUT, { recursive: true });

// CSV parser (รองรับ quoted fields + escaped quotes)
function parseCsv(path) {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let cur = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

/* ---------- โหลด arrays จาก raw-data.ts ----------
   ไฟล์มีแต่ literal + 1 import type -> ลบ import, เปลี่ยน export const เป็น var,
   แล้ว eval ใน sandbox function เพื่อดึงค่าออกมา
*/
let src = readFileSync(RAW, "utf8");
src = src.replace(/^import\s+type[^;]*;/m, ""); // ลบ import type
// export const NAME: Type[] = -> const NAME =   (strip type annotation)
src = src.replace(/export\s+const\s+(\w+)\s*:\s*[A-Za-z0-9_]+\[\]\s*=/g, "const $1 =");
const factory = new Function(
  src +
    "\nreturn { DEALERS, SOLUTIONS, SALES_TEAM, SALES, POINT_COMPANIES, POINT_EMPLOYEES };"
);
const data = factory();

/* ---------- helpers ---------- */
// q: text ธรรมดา (NOT NULL) -> empty/undefined เก็บเป็น '' , ไม่ใช่ NULL
const q = (v) => {
  if (v === null || v === undefined) return "''";
  return "'" + String(v).replace(/'/g, "''") + "'";
};
// qn: nullable (เช่น FK dealer_code/company_code) -> empty/undefined -> NULL
const qn = (v) => {
  if (v === null || v === undefined || v === "") return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const num = (v) => (v === null || v === undefined || v === "" ? "NULL" : Number(v));
// แปลง DD/MM/YY หรือ YYYY-MM-DD -> YYYY-MM-DD (date). ถ้า parse ไม่ได้ -> NULL
const dateOrNull = (v) => {
  if (!v) return "NULL";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return q(v);
  return "NULL";
};

function batchInsert(table, cols, rows, toValues, batchSize = 500) {
  const stmts = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const values = chunk.map((r) => "(" + toValues(r).join(",") + ")").join(",\n");
    stmts.push(
      `insert into public.${table} (${cols.join(",")}) values\n${values}\non conflict do nothing;`
    );
  }
  return stmts;
}

/* ---------- dealers ---------- */
const dealerSql = batchInsert(
  "dealers",
  ["code", "name", "branch", "tax_id", "tier", "model", "point_company_code"],
  data.DEALERS,
  (d) => [q(d.code), q(d.name), q(d.branch), q(d.taxId), q(d.tier), q(d.model), q(d.pointCompanyCode)]
);

/* ---------- solutions ---------- */
const solSql = batchInsert(
  "solutions",
  ["id", '"group"', "name", "category", "rate", "icon"],
  data.SOLUTIONS,
  (s) => [q(s.id), q(s.group), q(s.name), q(s.category), num(s.rate), q(s.icon)]
);

/* ---------- point_companies ---------- */
const pcSql = batchInsert(
  "point_companies",
  ["code", "name", "model", "region", "points"],
  data.POINT_COMPANIES,
  (c) => [q(c.code), q(c.name), q(c.model), q(c.region), num(c.points)]
);

/* ---------- employees (SALES_TEAM) ----------
   SALES_TEAM เดิมมีเรคคอร์ดซ้ำ (คนเดียวกัน CR เดิม 2 ตัว) -> หลัง remap จะได้ emp_code ซ้ำ
   dedupe ให้เหลือ 1 แถวต่อ emp_code และใช้ชื่อ/ร้านจาก Master_Member.csv เป็น source of truth
   (เฉพาะ emp_code ที่เป็น CR ใหม่; ตัว OLD- ใช้ค่าจาก SALES_TEAM เดิม)
*/
// โหลด master: crNew -> { name, dealerCode }
function loadMaster() {
  const rows = parseCsv("commission-app/Master_Member.csv");
  const h = rows[0].map((x) => x.trim());
  const iUser = h.indexOf("User ID");
  const iName = h.indexOf("Salesperson Name");
  const iDealer = h.indexOf("Dealer Code");
  const mm = new Map();
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 10) continue;
    const cr = (row[iUser] ?? "").trim();
    if (!/^CR\d+$/.test(cr)) continue;
    mm.set(cr, { name: (row[iName] ?? "").trim(), dealerCode: (row[iDealer] ?? "").trim() });
  }
  return mm;
}
const masterByCr = loadMaster();

const empSeen = new Set();
const empRows = [];
for (const e of data.SALES_TEAM) {
  if (empSeen.has(e.id)) continue; // dedupe: เก็บแถวแรกของแต่ละ emp_code
  empSeen.add(e.id);
  const m = masterByCr.get(e.id); // ถ้าเป็น CR ใหม่ -> ใช้ชื่อ/ร้านจาก master
  empRows.push({
    emp_code: e.id,
    name: m?.name || e.name,
    role: e.role,
    avatar: e.avatar,
    phone: e.phone,
    dealer_code: m?.dealerCode || e.dealerCode,
    photo_url: e.photoUrl,
  });
}
const empSql = batchInsert(
  "employees",
  ["emp_code", "name", "role", "avatar", "phone", "dealer_code", "photo_url"],
  empRows,
  (e) => [q(e.emp_code), q(e.name), q(e.role), q(e.avatar), q(e.phone), qn(e.dealer_code), qn(e.photo_url)]
);

/* ---------- point_employees (dedupe เช่นเดียวกับ employees) ---------- */
const peSeen = new Set();
const peRows = [];
for (const p of data.POINT_EMPLOYEES) {
  if (peSeen.has(p.empCode)) continue;
  peSeen.add(p.empCode);
  const m = masterByCr.get(p.empCode);
  peRows.push({
    empCode: p.empCode,
    name: m?.name || p.name,
    companyCode: p.companyCode,
    avatar: p.avatar,
    points: p.points,
  });
}
const peSql = batchInsert(
  "point_employees",
  ["emp_code", "name", "company_code", "avatar", "points"],
  peRows,
  (p) => [q(p.empCode), q(p.name), qn(p.companyCode), q(p.avatar), num(p.points)]
);

/* ---------- sales ---------- */
const saleSql = batchInsert(
  "sales",
  [
    "id", "period", "emp_code", "sol_id", "dealer_code", "sale_date", "sold_date",
    "customer", "amount", "comm", "inc", "status", "project_id", "tracking",
    "src", "seller", "ben_group", "close_range", "close_date_raw", "pay_date_raw",
    "comm_rate", "inc_rate",
  ],
  data.SALES,
  (s) => [
    q(s.id), q(s.period), qn(s.empId), qn(s.solId), qn(s.dealerCode),
    dateOrNull(s.date), dateOrNull(s.soldDate), q(s.customer), num(s.amount),
    num(s.comm), num(s.inc), q(s.status), q(s.projectId), q(s.tracking),
    qn(s.src), qn(s.seller), qn(s.benGroup), qn(s.closeRange), qn(s.closeDateRaw),
    qn(s.payDateRaw), qn(s.commRate), qn(s.incRate),
  ],
  400 // sales มี field เยอะ ลด batch size
);

/* ---------- เขียนไฟล์ ----------
   เรียงตาม dependency: dealers/solutions/point_companies ก่อน -> employees/point_employees -> sales
*/
const files = {
  "01-dealers.sql": dealerSql,
  "02-solutions.sql": solSql,
  "03-point_companies.sql": pcSql,
  "04-employees.sql": empSql,
  "05-point_employees.sql": peSql,
  "06-sales.sql": saleSql,
};
let totalStmts = 0;
for (const [fname, stmts] of Object.entries(files)) {
  writeFileSync(`${OUT}/${fname}`, stmts.join("\n\n"), "utf8");
  totalStmts += stmts.length;
}

console.log(
  `counts: dealers=${data.DEALERS.length} solutions=${data.SOLUTIONS.length} ` +
    `point_companies=${data.POINT_COMPANIES.length} ` +
    `employees=${empRows.length} (จาก SALES_TEAM ${data.SALES_TEAM.length}, dedupe -${data.SALES_TEAM.length - empRows.length}) ` +
    `point_employees=${peRows.length} (จาก ${data.POINT_EMPLOYEES.length}, dedupe -${data.POINT_EMPLOYEES.length - peRows.length}) ` +
    `sales=${data.SALES.length}`
);
console.log(
  `SQL files written to ${OUT}/ : ` +
    Object.entries(files).map(([f, s]) => `${f}(${s.length} stmt)`).join(", ")
);
console.log(`total statements: ${totalStmts}`);
