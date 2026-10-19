/* Phase ข: remap CR เดิม -> CR ใหม่ ใน raw-data.ts
   - อ่าน mapping จาก commission-app/employee-map.csv (cr_old,cr_new,...)
   - remap field: "empId":"CRxxxx" (SALES), "id":"CRxxxx" (SALES_TEAM), "empCode":"CRxxxx" (POINT_EMPLOYEES)
   - CR ที่อยู่ใน map -> CR ใหม่ ; CR ที่ไม่อยู่ใน map -> ใส่ prefix "OLD-"
   - backup ไฟล์เดิมเป็น raw-data.ts.bak ก่อนเขียนทับ
   รัน: node scripts/remap-raw-data.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const RAW = "src/lib/commission/raw-data.ts";
const MAP = "commission-app/employee-map.csv";

/* ---------- 1) โหลด mapping cr_old -> cr_new ---------- */
const csv = readFileSync(MAP, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
const map = new Map(); // crOld -> crNew
for (let i = 1; i < csv.length; i++) {
  const line = csv[i].trim();
  if (!line) continue;
  // cr_old,cr_new เป็น 2 คอลัมน์แรก ไม่มี comma ภายใน
  const crOld = line.slice(0, line.indexOf(","));
  const rest = line.slice(line.indexOf(",") + 1);
  const crNew = rest.slice(0, rest.indexOf(","));
  if (/^CR\d+$/.test(crOld) && /^CR\d+$/.test(crNew)) map.set(crOld, crNew);
}

/* ---------- 2) อ่าน raw-data + backup ---------- */
const raw = readFileSync(RAW, "utf8");
writeFileSync(RAW + ".bak", raw, "utf8");

/* ---------- 3) remap ----------
   แปลงค่า CR เดิมเป็นค่าใหม่ (atomic: อ่าน original ทุกครั้ง ไม่ chain)
*/
const stats = { mapped: 0, old: 0, byField: {} };
function convert(crOld) {
  const n = map.get(crOld);
  if (n) {
    stats.mapped++;
    return n;
  }
  stats.old++;
  return "OLD-" + crOld;
}

// จับเฉพาะ field ที่ value ขึ้นต้น CR ตามด้วยตัวเลข เท่านั้น
// รองรับทั้ง "field":"CR..." (SALES) และ "field": "CR..." (pretty-printed) โดยรักษา separator เดิม
function remapField(text, field) {
  const re = new RegExp(`("${field}":\\s*")(CR\\d+)(")`, "g");
  let count = 0;
  const out = text.replace(re, (_, pre, cr, post) => {
    count++;
    return pre + convert(cr) + post;
  });
  stats.byField[field] = count;
  return out;
}

let out = raw;
out = remapField(out, "empId"); // SALES
out = remapField(out, "id"); // SALES_TEAM (value เป็น CRxxxx เท่านั้นที่ถูกจับ; TX-xxxx ไม่โดน)
out = remapField(out, "empCode"); // POINT_EMPLOYEES

writeFileSync(RAW, out, "utf8");

/* ---------- 4) ตรวจสอบว่าไม่มี CR เดิมหลงเหลือแบบ bare (ไม่ใช่ OLD- และไม่ใช่ CR ใหม่ที่ map มา) ---------- */
// นับ CR code ที่เหลือใน 3 field
const remain = {};
for (const field of ["empId", "id", "empCode"]) {
  const re = new RegExp(`"${field}":\\s*"(CR\\d+)"`, "g");
  const set = new Set();
  let m;
  while ((m = re.exec(out))) set.add(m[1]);
  remain[field] = set.size;
}

console.log("MAP size:", map.size);
console.log("byField matched:", JSON.stringify(stats.byField));
console.log("values converted -> new:", stats.mapped, " | -> OLD-:", stats.old);
console.log("distinct CR (non-OLD) remaining per field:", JSON.stringify(remain));
