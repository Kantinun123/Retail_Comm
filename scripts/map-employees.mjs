/* วิเคราะห์การ map พนักงาน: CR เดิม (ใน SALES) <-> CR ใหม่ (Master_Member.csv)
   match ด้วย ชื่อ(normalize) + dealerCode  — อ่านอย่างเดียว ไม่แตะ raw-data
   รัน: node scripts/map-employees.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

/* ---------- helpers ---------- */
// normalize ชื่อไทย: ตัดคำนำหน้า + ช่องว่างซ้ำ + trim
function normName(s) {
  if (!s) return "";
  let t = String(s).trim();
  t = t.replace(/\(.*?\)/g, " "); // ตัดวงเล็บ เช่น (กานต์)
  t = t.replace(
    /^(นาย|นาง สาว|นางสาว|นาง|น\.ส\.|คุณ|ด\.ช\.|ด\.ญ\.)\s*/u,
    ""
  );
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

// ตรวจว่าชื่อเป็น placeholder/ชื่อเล่น/ขยะ (ไม่ควรเอาไป fuzzy)
function isJunkName(s) {
  const t = normName(s);
  if (!t) return true;
  if (t === "NULL" || t === "X") return true;
  if (/^\d/.test(t)) return true; // ขึ้นต้นด้วยตัวเลข เช่น "073253605-8"
  if (/\d{3,}/.test(t)) return true; // มีเบอร์โทร/เลขยาว
  if (!/\s/.test(t)) return true; // ชื่อเดี่ยวคำเดียว (นะ, บิลลี่, มัย) = ไม่มีนามสกุล
  return false;
}

// Levenshtein distance
function lev(a, b) {
  const al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  const dp = Array.from({ length: al + 1 }, (_, i) => [i, ...Array(bl).fill(0)]);
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[al][bl];
}

// ความคล้าย 0..1 จาก edit distance
function sim(a, b) {
  const d = lev(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - d / maxLen;
}

/* ---------- 1) อ่าน SALES จาก raw-data.ts (ดึง empId/seller/dealerCode ที่ไม่ซ้ำ) ---------- */
const raw = readFileSync("src/lib/commission/raw-data.ts", "utf8");

// ดึงทุก object ใน SALES ด้วย regex จับ field ที่ต้องใช้
const salesEmp = new Map(); // empId -> { empId, seller, dealerCode, count }
const reSale = /"empId":"(CR\d+)"[^}]*?"dealerCode":"([^"]*)"[^}]*?"seller":"([^"]*)"/g;
let m;
while ((m = reSale.exec(raw))) {
  const [, empId, dealerCode, seller] = m;
  const key = empId;
  const e = salesEmp.get(key) ?? { empId, seller, dealerCode, count: 0 };
  e.count += 1;
  salesEmp.set(key, e);
}

/* ---------- 2) parse Master_Member.csv ---------- */
function parseCsv(path) {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let cur = [],
    field = "",
    inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else if (c === "\r") {
        /* skip */
      } else field += c;
    }
  }
  if (field.length || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

const memRows = parseCsv("commission-app/Master_Member.csv");
// แถว 0 = หัวอังกฤษ, แถว 1 = หัวไทย, ข้อมูลเริ่มแถว 2
const H = memRows[0].map((h) => h.trim());
const idx = (name) => H.indexOf(name);
const iCode = idx("Dealer Code");
const iUser = idx("User ID");
const iName = idx("Salesperson Name");

const master = []; // { crNew, name, dealerCode }
for (let r = 2; r < memRows.length; r++) {
  const row = memRows[r];
  if (!row || row.length < 5) continue;
  const crNew = (row[iUser] ?? "").trim();
  const name = (row[iName] ?? "").trim();
  const dealerCode = (row[iCode] ?? "").trim();
  if (!crNew || !/^CR\d+$/.test(crNew)) continue;
  master.push({ crNew, name, dealerCode, norm: normName(name) });
}

/* ---------- 3) จับคู่ ---------- */
// index master ด้วย norm+dealerCode และ norm อย่างเดียว
const byNameDealer = new Map();
const byName = new Map();
for (const mm of master) {
  byNameDealer.set(mm.norm + "|" + mm.dealerCode, mm);
  const list = byName.get(mm.norm) ?? [];
  list.push(mm);
  byName.set(mm.norm, list);
}

const exact = []; // ชื่อ+ร้านตรง
const ambiguous = []; // ชื่อตรงแต่ร้านต่าง / ชื่อซ้ำหลายคน
const notFound = []; // หา master ไม่เจอ

for (const e of salesEmp.values()) {
  const n = normName(e.seller);
  const hitND = byNameDealer.get(n + "|" + e.dealerCode);
  if (hitND) {
    exact.push({ ...e, crNew: hitND.crNew, masterName: hitND.name });
    continue;
  }
  const byN = byName.get(n);
  if (byN && byN.length) {
    ambiguous.push({
      ...e,
      candidates: byN.map((x) => `${x.crNew}@${x.dealerCode}(${x.name})`),
    });
  } else {
    notFound.push(e);
  }
}

// master ที่ไม่มีใน sales (คนใหม่)
const salesNorms = new Set([...salesEmp.values()].map((e) => normName(e.seller)));
const masterNotInSales = master.filter((mm) => !salesNorms.has(mm.norm));

/* ---------- 3.5) FUZZY: เทียบกลุ่ม C (notFound) กับ master คนใหม่ (D) ----------
   เป้าหมาย: กู้ match ที่ชื่อสะกดต่างเล็กน้อย โดยไม่ auto-map (ให้ user ตัดสิน)
   เกณฑ์: เอาเฉพาะ C ที่มีชื่อจริง (ไม่ใช่ขยะ) และ #งาน >= FUZZY_MIN_DEALS
   คะแนน = sim(ชื่อ) + bonus 0.15 ถ้า dealerCode ตรง ; เสนอ top candidate ที่ sim >= 0.6
*/
const FUZZY_MIN_DEALS = 10;
const FUZZY_MIN_SIM = 0.6;
// เคส fuzzy ที่ user ยืนยันแล้วว่าเป็นคนเดียวกัน (ชื่อสะกดผิดเล็กน้อย ร้านตรง) -> ให้ map จริง
// key = empId เดิม, value = crNew ที่ยืนยัน
const CONFIRMED_FUZZY = new Map([
  ["CR0077", "CR0168"], // นนทวัฒน์/นทวัฒน์ แสนศรี @5100969
  ["CR0076", "CR0008"], // นเรศ สุขนิรันดร์กูล/สุขนิรันร์กุล @5100724
]);
const fuzzy = []; // { empId, seller, dealerCode, count, cand:{crNew,name,dealerCode,score,nameSim,sameDealer} }

for (const e of notFound) {
  if (isJunkName(e.seller)) continue;
  if (e.count < FUZZY_MIN_DEALS) continue;
  const n = normName(e.seller);
  let best = null;
  for (const mm of masterNotInSales) {
    if (isJunkName(mm.name)) continue;
    const nameSim = sim(n, mm.norm);
    const sameDealer = mm.dealerCode === e.dealerCode;
    const score = nameSim + (sameDealer ? 0.15 : 0);
    if (!best || score > best.score) {
      best = { crNew: mm.crNew, name: mm.name, dealerCode: mm.dealerCode, score, nameSim, sameDealer };
    }
  }
  if (best && best.nameSim >= FUZZY_MIN_SIM) {
    fuzzy.push({ ...e, cand: best });
  }
}
fuzzy.sort((a, b) => b.cand.score - a.cand.score);

/* ---------- 3.6) ย้ายเคส fuzzy ที่ยืนยันแล้วเข้า exact (A) เพื่อให้เข้า mapping CSV ---------- */
const confirmedFuzzy = []; // เก็บไว้โชว์ในรายงาน
for (let i = notFound.length - 1; i >= 0; i--) {
  const e = notFound[i];
  const crNew = CONFIRMED_FUZZY.get(e.empId);
  if (!crNew) continue;
  const mm = master.find((x) => x.crNew === crNew);
  const rec = { ...e, crNew, masterName: mm ? mm.name : "", fuzzy: true };
  exact.push(rec);
  confirmedFuzzy.push(rec);
  notFound.splice(i, 1); // เอาออกจาก C
}

/* ---------- 4) เขียนรายงาน + ไฟล์ mapping ---------- */
const lines = [];
lines.push("=== สรุปการ MAP พนักงาน CR เดิม (SALES) <-> CR ใหม่ (Master) ===");
lines.push(`พนักงานใน SALES เดิม (distinct empId): ${salesEmp.size}`);
lines.push(`พนักงานใน Master ใหม่: ${master.length}`);
lines.push("");
lines.push(`[A] MATCH ชัด (ชื่อ+ร้านตรง + fuzzy ยืนยัน): ${exact.length} (ในนี้เป็น fuzzy ยืนยัน ${confirmedFuzzy.length})`);
lines.push(`[B] คลุมเครือ (ชื่อตรง ร้านต่าง/ซ้ำ): ${ambiguous.length}`);
lines.push(`[C] หา master ไม่เจอ: ${notFound.length}`);
lines.push(`[D] master ที่ไม่มีใน SALES (คนใหม่): ${masterNotInSales.length}`);
lines.push(`[E] FUZZY น่าจะเป็นคนเดียวกัน (ต้องยืนยัน): ${fuzzy.length}`);
lines.push("");

lines.push("--- [A] MATCH ชัด (CRเดิม -> CRใหม่ | ชื่อ | ร้าน | #งาน) ---");
exact
  .sort((a, b) => a.empId.localeCompare(b.empId))
  .forEach((e) =>
    lines.push(`${e.empId} -> ${e.crNew} | ${e.seller} | ${e.dealerCode} | ${e.count}`)
  );

lines.push("");
lines.push("--- [B] คลุมเครือ (ต้องตัดสิน) ---");
ambiguous.forEach((e) =>
  lines.push(
    `${e.empId} | ${e.seller} | ร้าน ${e.dealerCode} | #${e.count} -> ผู้สมัครที่คล้าย: ${e.candidates.join(", ")}`
  )
);

lines.push("");
lines.push("--- [C] หา master ไม่เจอ (CRเดิมมีงานแต่ไม่มีใน master) ---");
notFound
  .sort((a, b) => b.count - a.count)
  .forEach((e) => lines.push(`${e.empId} | ${e.seller} | ร้าน ${e.dealerCode} | #${e.count}`));

lines.push("");
lines.push("--- [E] FUZZY: C ที่น่าจะตรงกับ master คนใหม่ (เรียงตามคะแนน, ต้องยืนยันเอง) ---");
lines.push("รูปแบบ: CRเดิม(ชื่อเดิม@ร้าน #งาน) ~= CRใหม่(ชื่อใหม่@ร้าน) | ชื่อคล้าย=xx% ร้านตรง=Y/N");
fuzzy.forEach((e) =>
  lines.push(
    `${e.empId}(${e.seller}@${e.dealerCode} #${e.count}) ~= ${e.cand.crNew}(${e.cand.name}@${e.cand.dealerCode}) | ชื่อคล้าย=${(e.cand.nameSim * 100).toFixed(0)}% ร้านตรง=${e.cand.sameDealer ? "Y" : "N"}`
  )
);

lines.push("");
lines.push("--- [D] master ที่ไม่มีใน SALES (คนใหม่ ไม่มีประวัติขาย) ---");
masterNotInSales.forEach((mm) =>
  lines.push(`${mm.crNew} | ${mm.name} | ร้าน ${mm.dealerCode}`)
);

writeFileSync("commission-app/employee-map-report.txt", lines.join("\n"), "utf8");

// mapping CSV (A + fuzzy ยืนยัน) — คอลัมน์ match_type: exact | fuzzy
const mapCsv = ["cr_old,cr_new,name,dealer_code,deal_count,match_type"];
exact
  .sort((a, b) => a.empId.localeCompare(b.empId))
  .forEach((e) =>
    mapCsv.push(
      `${e.empId},${e.crNew},"${e.seller}",${e.dealerCode},${e.count},${e.fuzzy ? "fuzzy" : "exact"}`
    )
  );
writeFileSync("commission-app/employee-map.csv", mapCsv.join("\n"), "utf8");

console.log(
  `DONE A=${exact.length}(fuzzy-confirmed ${confirmedFuzzy.length}) B=${ambiguous.length} C=${notFound.length} D=${masterNotInSales.length} E(fuzzy-shown)=${fuzzy.length} | salesEmp=${salesEmp.size} master=${master.length}`
);
