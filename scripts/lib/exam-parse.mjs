// ตัวอ่านไฟล์ "ชุดข้อสอบ SE New Comer_Up Level.xlsx" -> { topics: [...] }
// - เฉลย = เซลล์ที่มีสีพื้น (เขียว/เหลือง) ในแถวเดียวกับตัวเลือกที่ถูก ; ชีตบ้านใหม่มีบรรทัด "ตอบ n" ด้วย ; Proactive ใช้บรรทัดซ้ำท้ายข้อ
// - ข้อที่อ่านไม่ครบ (ไม่มีเฉลย / ตัวเลือกไม่ครบ) ใส่ problem ไว้ แล้วไม่เปิดใช้ (is_active=false)
// - รูปในชีตผูกกับข้อด้วยแถวที่รูปวางอยู่ (anchor) อยู่ในช่วงแถวของข้อนั้น
import XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";

export const TOPIC_META = {
  "1.Product Metal": ["Product หลังคาเมทัล (METALUXE)", "Product"],
  "1.Metal Install": ["งานติดตั้งหลังคาเมทัล", "งานติดตั้ง"],
  "1.Product Board Wood": ["Product บอร์ดและไม้ตกแต่ง", "Product"],
  "1.Product Decaar": ["Product DECAAR", "Product"],
  "1.Product SFG": ["Product SFG (โปร่งแสง ฉนวน อะคูสติก)", "Product"],
  "2.Solution Roof บ้านใหม่": ["Solution Roof บ้านใหม่ (Roof Installation)", "Solution"],
  "2.Product roof": ["Product กระเบื้องหลังคา", "Product"],
  "2.Product อุปกรณ์หลังคา": ["Product อุปกรณ์หลังคา", "Product"],
  "2.ติดตั้งกระเบื้องและอุปกรณ์": ["งานติดตั้งกระเบื้องและอุปกรณ์", "งานติดตั้ง"],
  "2.Product Truss": ["Product โครงหลังคาสำเร็จรูป (Truss)", "Product"],
  "2.Truss Install": ["งานติดตั้งโครงหลังคา Truss", "งานติดตั้ง"],
  "2.Roof Install": ["งานติดตั้งหลังคา (Sarking และแรงลม)", "งานติดตั้ง"],
  "2.Roof smart&speedy": ["Roof Smart & Speedy", "ระบบงาน"],
  "3.Solution Roof บ้านเก่า": ["Solution Roof บ้านเก่า (RE-ROOF)", "Solution"],
  "4,5.process&system": ["Process & System (CRM / Rudy)", "ระบบงาน"],
  "6.การอ่านแบบ": ["การอ่านแบบ", "ระบบงาน"],
  Proactive: ["Proactive Selling (Mindset)", "ทักษะ"],
  safety: ["Safety", "ทักษะ"],
};

const LABEL_RE = /^\s*(?:[A-D]\s*[:：]|[ก-ง]\s*[.．])/;
const LABEL_STRIP = /^\s*(?:[A-D]\s*[:：]|[ก-ง]\s*[.．])\s*/;
const POINT_ONLY = /^\(?\s*\d+\s*(?:Point|point|คะแนน)s?\s*\)?$/;
const NOISE = /\s*Required to answer\.?(?:\s*Single choice\.?)?\s*/gi;

const clean = (s) => String(s ?? "").replace(NOISE, " ").replace(/\s+/g, " ").trim();
const stripPoint = (s) => s.replace(/\s*\(\s*\d+\s*(?:Point|point|คะแนน)s?\s*\)\s*$/, "").trim();
const norm = (s) => clean(s).replace(LABEL_STRIP, "").replace(/\s+/g, "").toLowerCase();

/** ตารางเซลล์ของชีต -> แถวละ { r (1-based), cells: Map(col -> {v, fill}), text, star } */
function sheetRows(ws) {
  const ref = XLSX.utils.decode_range(ws["!ref"]);
  const rows = [];
  for (let R = ref.s.r; R <= ref.e.r; R++) {
    const cells = new Map();
    let star = false;
    const parts = [];
    for (let C = ref.s.c; C <= ref.e.c; C++) {
      const c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (!c) continue;
      const fill = !!(c.s && c.s.fgColor && c.s.fgColor.rgb);
      if (fill) star = true;
      const v = c.v === undefined || c.v === null ? "" : String(c.v);
      if (v.trim() !== "") {
        cells.set(C, { v, fill });
        parts.push(v);
      } else if (fill) cells.set(C, { v: "", fill });
    }
    rows.push({ r: R + 1, cells, text: clean(parts.join(" ")), star });
  }
  return rows;
}

/** รูปของชีต: [{ row (1-based), ext, data }] จาก drawing -> media */
function sheetImages(files, sheetIndex) {
  const out = [];
  const relPath = `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`;
  if (!files[relPath]) return out;
  const m = /Target="\.\.\/drawings\/([^"]+\.xml)"/.exec(strFromU8(files[relPath]));
  if (!m) return out;
  const dpath = `xl/drawings/${m[1]}`;
  const drel = `xl/drawings/_rels/${m[1]}.rels`;
  if (!files[dpath] || !files[drel]) return out;
  const rels = new Map();
  for (const x of strFromU8(files[drel]).matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(x[0])?.[1];
    const tg = /Target="([^"]+)"/.exec(x[0])?.[1];
    if (id && tg) rels.set(id, tg);
  }
  const xml = strFromU8(files[dpath]);
  for (const a of xml.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor)[\s>][\s\S]*?<\/xdr:\1>/g)) {
    const v = a[0];
    if (!v.includes("<xdr:pic>")) continue;
    const row0 = /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/.exec(v)?.[1];
    const pos = /<xdr:from><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(-?\d+)<\/xdr:colOff><xdr:row>\d+<\/xdr:row><xdr:rowOff>(-?\d+)<\/xdr:rowOff>/.exec(v);
    const sr = /<a:srcRect([^/]*)\/>/.exec(v)?.[1] ?? "";
    const crop = Object.fromEntries(["l", "t", "r", "b"].map((k) => [k, Number(new RegExp(`${k}="(-?\\d+)"`).exec(sr)?.[1] ?? 0) / 100000]));
    const rid = /r:embed="([^"]+)"/.exec(v)?.[1];
    const tg = rid && rels.get(rid);
    if (row0 === undefined || !tg) continue;
    const media = `xl/${tg.replace(/^\.\.\//, "")}`;
    const ext = media.split(".").pop().toLowerCase();
    if (!files[media]) continue;
    out.push({ row: Number(row0) + 1, col: Number(pos?.[1] ?? 0), colOff: Number(pos?.[2] ?? 0), rowOff: Number(pos?.[3] ?? 0), crop, ext, data: files[media] });
  }
  return out;
}

/** รายการคำถามแบบบล็อก (ข้อ + ตัวเลือกบรรทัดละข้อ) ใช้กับเกือบทุกชีต */
function parseBlocks(rows, { bullet = false } = {}) {
  const labelled = rows.filter((x) => LABEL_RE.test(x.text)).length >= 10;
  const qs = [];
  let cur = null;
  let expected = 1;
  for (const row of rows) {
    const t = row.text;
    if (!t) continue;
    if (POINT_ONLY.test(t)) continue;
    let qm = null;
    if (bullet) {
      if (/^•/.test(t)) qm = { n: expected, rest: t.replace(/^•\s*/, "") };
    } else {
      const m = /^\s*(\d+)\s*[.)](?!\d)\s*(.*)$/.exec(t);
      if (m && Number(m[1]) === expected && !row.star) qm = { n: expected, rest: m[2] };
    }
    if (qm) {
      cur = { n: qm.n, startRow: row.r, body: stripPoint(clean(qm.rest)), options: [], stars: 0, endRow: row.r };
      qs.push(cur);
      expected++;
      continue;
    }
    if (!cur) continue;
    cur.endRow = row.r;
    const isLabel = LABEL_RE.test(t);
    if (labelled && !isLabel && !row.star) {
      // บรรทัดต่อของข้อความ (ตัวเลือกยาวหลายบรรทัด หรือคำถามต่อหลายบรรทัด)
      if (cur.options.length) cur.options[cur.options.length - 1].body += " " + t;
      else cur.body = stripPoint(clean(cur.body + " " + t));
      continue;
    }
    cur.options.push({ body: t.replace(LABEL_STRIP, "").trim(), correct: row.star, row: row.r });
    if (row.star) cur.stars++;
  }
  // ช่วงแถวของแต่ละข้อ = จากแถวเริ่มจนก่อนข้อถัดไป (ใช้ผูกรูป)
  qs.forEach((q, i) => (q.rangeEnd = i + 1 < qs.length ? qs[i + 1].startRow - 1 : Number.MAX_SAFE_INTEGER));
  return qs;
}

/** ชีตที่ไม่มีสีเฉลย แต่ซ้ำตัวเลือกที่ถูกไว้ท้ายข้อ (Proactive) */
function applyTrailingAnswer(qs) {
  for (const q of qs) {
    if (q.stars > 0 || q.options.length < 3) continue;
    const last = q.options[q.options.length - 1];
    const idx = q.options.slice(0, -1).findIndex((o) => norm(o.body) === norm(last.body));
    if (idx >= 0) {
      q.options.pop();
      q.options[idx].correct = true;
      q.stars = 1;
    }
  }
}

/** ชีตบ้านใหม่: เลขข้อ(คอลัมน์ B) + ข้อความ(C) + "ตอบ n" + คำอธิบาย */
function parseSolutionNew(rows) {
  const qs = [];
  let cur = null;
  let lastDone = null;
  for (const row of rows) {
    // ข้อ: A = เลขข้อ, B = คำถาม ; ตัวเลือก: B = เลขตัวเลือก (หรือว่าง), C = ข้อความ ; "ตอบ n" อยู่ B/C
    const qNum = row.cells.get(0)?.v?.trim() ?? "";
    const isQuestionRow = /^\d+$/.test(qNum) && !!row.cells.get(1)?.v?.trim();
    const num = isQuestionRow ? qNum : (/^\d+$/.test(row.cells.get(1)?.v?.trim() ?? "") ? row.cells.get(1).v.trim() : "");
    const txt = isQuestionRow
      ? clean(row.cells.get(1).v)
      : clean(row.cells.get(2)?.v ?? (num ? "" : row.cells.get(1)?.v ?? ""));
    if (!txt && !num) continue;
    if (/^ตอบ/.test(txt)) {
      if (cur) {
        cur.answer = txt.replace(/^ตอบ\s*/, "").trim();
        cur.endRow = row.r;
        lastDone = cur;
        cur = null;
      }
      continue;
    }
    if (!cur) {
      if (isQuestionRow && txt) {
        cur = { n: qs.length + 1, startRow: row.r, body: stripPoint(txt), options: [], stars: 0, endRow: row.r };
        qs.push(cur);
      } else if (lastDone && txt) {
        lastDone.explanation = clean((lastDone.explanation ?? "") + " " + txt);
      }
      continue;
    }
    cur.endRow = row.r;
    cur.options.push({ body: txt.replace(LABEL_STRIP, "").trim(), correct: row.star, row: row.r });
    if (row.star) cur.stars++;
  }
  const letters = ["ก", "ข", "ค", "ง"];
  for (const q of qs) {
    const a = q.answer ?? "";
    let idx = -1;
    if (/^\d/.test(a)) idx = Number(a.match(/^\d/)[0]) - 1;
    else {
      const li = letters.indexOf(a.replace(/[.\s]/g, "").charAt(0));
      if (li >= 0) idx = li;
    }
    const starIdx = q.options.findIndex((o) => o.correct);
    if (idx >= 0 && starIdx >= 0 && idx !== starIdx) q.conflict = `เฉลยสีกับ "ตอบ ${a}" ไม่ตรงกัน`;
    if (starIdx < 0 && idx >= 0 && q.options[idx]) {
      q.options[idx].correct = true;
      q.stars = 1;
    }
  }
  return qs;
}

/** ชีต Roof smart & speedy: ตาราง เลขข้อ | คำถาม | ตัวเลือก (1. 2. 3. ในช่องเดียว) | เฉลย */
const DEFAULT_ROW_EMU = 234950; // 18.5pt = ความสูงแถวปกติของชีตนี้ ; รูปที่ rowOff เกินแถว = วางเลื่อนลงแถวถัดไป
const effRow = (im) => im.row + Math.floor(im.rowOff / DEFAULT_ROW_EMU); // 1-based
const slotOf = (off) => (off < 700000 ? 1 : off < 1500000 ? 2 : 3);

function parseRoofSmart(rows, imgs = []) {
  const qs = [];
  let section = "";
  for (const row of rows) {
    const a = row.cells.get(0)?.v?.trim() ?? "";
    const b = clean(row.cells.get(1)?.v ?? "");
    const c = clean(row.cells.get(2)?.v ?? "");
    const d = clean(row.cells.get(3)?.v ?? "");
    if (a && !b && !c && /^(Roof smart|Speedy)/i.test(a)) {
      section = /speedy/i.test(a) ? "Speedy" : "Roof Smart Design";
      continue;
    }
    if (!a && /^(Roof smart|Speedy)/i.test(b)) {
      section = /speedy/i.test(b) ? "Speedy" : "Roof Smart Design";
      continue;
    }
    if (!/^\d+$/.test(a) || !b || b === "คำถาม") continue;
    // แยกตัวเลือกตามลำดับ 1. 2. 3. (ไม่ตัดทศนิยมอย่าง 1.50)
    const marks = [];
    let from = 0;
    for (let k = 1; k <= 4; k++) {
      const re = new RegExp(`(?<![\\d.])${k}\\s*\\.(?!\\d)`, "g");
      re.lastIndex = from;
      const m = re.exec(c);
      if (!m) break;
      marks.push({ k, start: m.index, end: m.index + m[0].length });
      from = m.index + m[0].length;
    }
    let options = marks.map((m, i) => ({
      body: c.slice(m.end, i + 1 < marks.length ? marks[i + 1].start : c.length).trim(),
      correct: false,
    }));
    const am = /^(\d)\s*(?:\.|$)/.exec(d);
    const ansIdx = am ? Number(am[1]) - 1 : -1;
    if (options[ansIdx]) options[ansIdx].correct = true;
    // ตัวเลือกเป็นไอคอน: ไอคอนในคอลัมน์ตัวเลือก (C) เรียงตามตำแหน่ง ; เฉลยคือไอคอนในช่องที่ตรงกับเลขเฉลย
    // และต้องหน้าตาเดียวกับไอคอนในคอลัมน์เฉลย (D) — ไอคอนที่ซ้อน/เกินมาในแถวเดียวกันใส่เป็นตัวเลือกหลอก
    const textless = options.length === 0 || options.every((o) => !o.body);
    const mine = imgs.filter((im) => effRow(im) === row.r);
    const optIcons = mine.filter((im) => im.col === 2).sort((x, y) => x.colOff - y.colOff);
    const ansIcons = mine.filter((im) => im.col === 3);
    let iconProblem = "";
    if (textless && optIcons.length >= 2) {
      const sameIcon = (x, y) => ["l", "t", "r", "b"].every((k) => Math.abs(x.crop[k] - y.crop[k]) < 0.0005);
      const target = optIcons.find((im) => slotOf(im.colOff) === ansIdx + 1);
      if (!target) iconProblem = "หาไอคอนเฉลยในช่องที่ " + (ansIdx + 1) + " ไม่เจอ";
      else if (!ansIcons.some((a) => sameIcon(a, target))) iconProblem = "ไอคอนเฉลยในไฟล์ไม่ตรงกับตัวเลือกที่ " + (ansIdx + 1);
      options = optIcons.map((im) => ({ body: "", correct: im === target, image: { ext: im.ext, data: im.data, crop: im.crop } }));
    }
    qs.push({
      n: qs.length + 1,
      startRow: row.r,
      endRow: row.r,
      rangeEnd: row.r,
      body: `${section ? `[${section}] ` : ""}${b}`,
      options,
      stars: options.some((o) => o.correct) ? 1 : 0,
      iconProblem,
    });
  }
  return qs;
}

export function parseWorkbook(buf) {
  const wb = XLSX.read(buf, { type: "buffer", cellStyles: true });
  const files = unzipSync(new Uint8Array(buf));
  const topics = [];
  wb.SheetNames.forEach((name, si) => {
    const meta = TOPIC_META[name];
    const ws = wb.Sheets[name];
    const rows = sheetRows(ws);
    let qs;
    if (name === "2.Solution Roof บ้านใหม่") qs = parseSolutionNew(rows);
    else if (name === "2.Roof smart&speedy") qs = parseRoofSmart(rows, sheetImages(files, si + 1));
    else {
      qs = parseBlocks(rows, { bullet: name === "4,5.process&system" });
      if (name === "Proactive") applyTrailingAnswer(qs);
    }
    const imgs = sheetImages(files, si + 1);
    const questions = qs.map((q, i) => {
      const end = q.rangeEnd ?? q.endRow;
      const images = name === "2.Roof smart&speedy" ? [] : imgs.filter((im) => im.row >= q.startRow && im.row <= end);
      const problems = [];
      const emptyOpts = q.options.filter((o) => !o.body && !o.image).length;
      if (q.iconProblem) problems.push(q.iconProblem);
      if (q.options.length > 0 && emptyOpts === q.options.length) problems.push("ตัวเลือกเป็นรูปในไฟล์ (อ่านเป็นข้อความไม่ได้)");
      else if (q.options.length < 2) problems.push(`ตัวเลือกไม่ครบ (มี ${q.options.length})`);
      if (!q.options.some((o) => o.correct)) problems.push("ไม่มีเฉลย");
      if (q.conflict) problems.push(q.conflict);
      return {
        sort: i + 1,
        kind: q.options.filter((o) => o.correct).length > 1 ? "multi" : "single",
        body: q.body,
        explanation: q.explanation ?? null,
        options: q.options.map((o) => ({ body: o.body, correct: !!o.correct, image: o.image ?? null })),
        images: images.map((im) => ({ ext: im.ext, data: im.data })),
        problems,
        srcRow: q.startRow,
      };
    });
    topics.push({ sheet: name, title: meta?.[0] ?? name, group: meta?.[1] ?? "อื่นๆ", sort: si + 1, questions });
  });
  return { topics };
}
