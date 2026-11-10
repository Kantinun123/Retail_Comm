/* อ่าน xlsx ขนาดใหญ่แบบ stream (ไม่ต้องติดตั้งเพิ่ม) — ใช้กับชีตที่ใหญ่เกินกว่า SheetJS จะโหลดทั้งก้อนได้
   - เปิด zip เอง (central directory) แล้ว inflate เฉพาะ entry ของชีตด้วย zlib แบบ stream
   - แปลง <row>/<c> เป็นอาร์เรย์ค่า (รองรับ sharedStrings, inlineStr, ตัวเลข) ; วันที่คืนเป็นตัวเลข serial ของ Excel
   ใช้: for await (const row of streamXlsxRows(path)) { ... }  // row = array ตามคอลัมน์ (index 0 = A) */
import { openSync, readSync, closeSync, fstatSync, createReadStream } from "node:fs";
import { createInflateRaw } from "node:zlib";

function readZipEntries(fd) {
  const size = fstatSync(fd).size;
  const tailLen = Math.min(size, 65557);
  const tail = Buffer.alloc(tailLen);
  readSync(fd, tail, 0, tailLen, size - tailLen);
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("ไม่ใช่ไฟล์ zip/xlsx");
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOff = tail.readUInt32LE(eocd + 16);
  let count = tail.readUInt16LE(eocd + 10);
  // ZIP64
  if (cdOff === 0xffffffff || cdSize === 0xffffffff || count === 0xffff) {
    const loc = eocd - 20;
    if (loc >= 0 && tail.readUInt32LE(loc) === 0x07064b50) {
      const z64Off = Number(tail.readBigUInt64LE(loc + 8));
      const z = Buffer.alloc(56);
      readSync(fd, z, 0, 56, z64Off);
      count = Number(z.readBigUInt64LE(32));
      cdSize = Number(z.readBigUInt64LE(40));
      cdOff = Number(z.readBigUInt64LE(48));
    }
  }
  const cd = Buffer.alloc(cdSize);
  readSync(fd, cd, 0, cdSize, cdOff);
  const entries = new Map();
  let p = 0;
  for (let i = 0; i < count && p < cd.length; i++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) break;
    const method = cd.readUInt16LE(p + 10);
    let csize = cd.readUInt32LE(p + 20);
    let usize = cd.readUInt32LE(p + 24);
    const nlen = cd.readUInt16LE(p + 28), elen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32);
    let lho = cd.readUInt32LE(p + 42);
    const name = cd.toString("utf8", p + 46, p + 46 + nlen);
    // ZIP64 extra field
    let e = p + 46 + nlen;
    const eEnd = e + elen;
    while (e + 4 <= eEnd) {
      const id = cd.readUInt16LE(e), len = cd.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (lho === 0xffffffff) { lho = Number(cd.readBigUInt64LE(q)); q += 8; }
      }
      e += 4 + len;
    }
    entries.set(name, { method, csize, usize, lho });
    p += 46 + nlen + elen + clen;
  }
  return entries;
}

function entryStream(path, fd, ent) {
  const lh = Buffer.alloc(30);
  readSync(fd, lh, 0, 30, ent.lho);
  const start = ent.lho + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
  const raw = createReadStream(path, { start, end: start + ent.csize - 1 });
  if (ent.method === 0) return raw;
  if (ent.method !== 8) throw new Error(`zip method ${ent.method} ไม่รองรับ`);
  return raw.pipe(createInflateRaw());
}

async function readEntryText(path, fd, ent) {
  const chunks = [];
  for await (const c of entryStream(path, fd, ent)) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const unxml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
   .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
   .replace(/&amp;/g, "&");
const colIndex = (ref) => {
  let n = 0;
  for (const ch of ref) { const c = ch.charCodeAt(0); if (c < 65 || c > 90) break; n = n * 26 + (c - 64); }
  return n - 1;
};

/** คืน async iterator ของแถว (array) จากชีตแรก หรือชีตตาม sheetPath */
export async function* streamXlsxRows(path, { sheetPath = "xl/worksheets/sheet1.xml" } = {}) {
  const fd = openSync(path, "r");
  try {
    const entries = readZipEntries(fd);
    const ent = entries.get(sheetPath);
    if (!ent) throw new Error(`ไม่พบ ${sheetPath} ใน xlsx`);
    const shared = [];
    const ss = entries.get("xl/sharedStrings.xml");
    if (ss) {
      const xml = await readEntryText(path, fd, ss);
      for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
        shared.push(unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
      }
    }
    const dec = new TextDecoder("utf-8");
    let buf = "";
    for await (const chunk of entryStream(path, fd, ent)) {
      buf += dec.decode(chunk, { stream: true });
      let end;
      while ((end = buf.indexOf("</row>")) >= 0) {
        const startIdx = buf.lastIndexOf("<row", end);
        const rowXml = buf.slice(startIdx, end);
        buf = buf.slice(end + 6);
        const row = [];
        for (const c of rowXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attrs = c[1], inner = c[2] ?? "";
          const r = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
          const t = attrs.match(/\bt="([^"]+)"/)?.[1];
          const idx = r ? colIndex(r) : row.length;
          let v = null;
          if (t === "inlineStr") v = unxml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
          else {
            const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
            if (vm) {
              if (t === "s") v = shared[Number(vm[1])] ?? null;
              else if (t === "str" || t === "e") v = unxml(vm[1]);
              else if (t === "b") v = vm[1] === "1";
              else { const n = Number(vm[1]); v = Number.isFinite(n) ? n : unxml(vm[1]); }
            }
          }
          row[idx] = v;
        }
        yield row;
      }
      if (buf.length > 4_000_000) buf = buf.slice(buf.lastIndexOf("<row") >= 0 ? buf.lastIndexOf("<row") : 0);
    }
  } finally {
    closeSync(fd);
  }
}

/** Excel serial -> "YYYY-MM-DD" (null ถ้าไม่ใช่วันที่) */
export const excelDate = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return null;
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
};
