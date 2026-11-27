/* เครื่องมือและความรู้ประกอบการขาย — อ่านจาก Google Sheet (แชร์แบบทุกคนที่มีลิงก์) ทุก 10 นาที
   ทีมเจ้าของข้อมูลแก้ใน Sheet ได้เลย แอปเห็นเองโดยไม่ต้องนำเข้า
   คอลัมน์: ลำดับ | รายละเอียด(ชื่อ) | (คำอธิบาย) | Link เข้าถึงข้อมูล | หมวดงาน | หมายเหตุ | การใช้งาน
   แถวที่ไม่มีลำดับ = อีกเวอร์ชันของรายการก่อนหน้า (ใช้ลำดับเดียวกัน)
   การใช้งาน = "ใช้" เท่านั้นที่แสดง (ถ้าชีตไม่มีคอลัมน์นี้ = แสดงทุกแถว) */

const DEFAULT_SHEET = "1f0HVKZKNE4BZqPKyoFzl9uovQgQ78Et4Xvh69c27AWc";
const TTL = 10 * 60 * 1000;

export interface SalesTool {
  no: number | null;
  title: string;
  description: string[];
  url: string | null;
  kind: "web" | "sheet" | "file" | "video" | "none";
  category: string;
  note: string | null;
}

/** CSV -> แถว (รองรับ "..." มี , และขึ้นบรรทัดใหม่) */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const clean = (s: string | undefined) => String(s ?? "").replace(/\s+/g, " ").trim();
/** ลิงก์จาก Sheet เป็นข้อมูลภายนอก: รับเฉพาะ https (กัน javascript: / ชื่อไฟล์ที่ไม่ใช่ลิงก์) */
function safeUrl(s: string | undefined): string | null {
  const v = String(s ?? "").trim();
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
function kindOf(url: string | null, note: string | null): SalesTool["kind"] {
  if (!url) return "none";
  if (/vdo|video/i.test(note ?? "")) return "video";
  if (/docs\.google\.com\/spreadsheets/.test(url)) return "sheet";
  if (/drive\.google\.com\/file/.test(url)) return "file";
  return "web";
}

/** "ใช้" / "ใช้งาน" (รองรับพิมพ์วรรณยุกต์ซ้ำ เช่น "ใช้้" และช่องว่าง) ; "ไม่ใช้งาน" / ว่าง = false */
function isInUse(v: string | undefined): boolean {
  const s = String(v ?? "").replace(/\s+/g, "").replace(/([\u0E48-\u0E4B])\1+/g, "$1");
  return s === "ใช้" || s === "ใช้งาน";
}

let cache: { at: number; items: SalesTool[] } | null = null;

export async function loadSalesTools(): Promise<{ items: SalesTool[]; fetchedAt: string }> {
  if (cache && Date.now() - cache.at < TTL) return { items: cache.items, fetchedAt: new Date(cache.at).toISOString() };
  const sheet = process.env.SALES_TOOLS_GSHEET_ID?.trim() || DEFAULT_SHEET;
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheet)}/export?format=csv&gid=0`, { redirect: "follow", cache: "no-store" });
  if (!res.ok) {
    if (cache) return { items: cache.items, fetchedAt: new Date(cache.at).toISOString() }; // ใช้ชุดเดิมถ้าอ่าน Sheet ไม่ได้ชั่วคราว
    throw new Error(`อ่าน Google Sheet ไม่ได้ (HTTP ${res.status})`);
  }
  const rows = parseCsv(await res.text());
  // คอลัมน์ "การใช้งาน" (หาจากชื่อหัว) : แสดงเฉพาะ "ใช้" ; "ไม่ใช้งาน" / ว่าง = ไม่แสดง (ผู้ใช้ยืนยัน 27 พ.ย. 69)
  const statusCol = (rows[0] ?? []).findIndex((h) => clean(h) === "การใช้งาน");
  const items: SalesTool[] = [];
  let lastNo: number | null = null;
  for (const r of rows.slice(1)) {
    const title = clean(r[1]);
    if (!title) continue;
    const n = Number(clean(r[0]));
    const no = Number.isFinite(n) && n > 0 ? n : lastNo;
    if (Number.isFinite(n) && n > 0) lastNo = n;
    if (statusCol >= 0 && !isInUse(r[statusCol])) continue;
    const note = clean(r[5]) || null;
    const url = safeUrl(r[3]);
    items.push({
      no,
      title: title.slice(0, 200),
      description: String(r[2] ?? "").split(/\n(?=\s*-)/).map((x) => clean(x).replace(/^-\s*/, "")).filter(Boolean).slice(0, 6),
      url,
      kind: kindOf(url, note),
      category: clean(r[4]).replace(/[\s/]+$/, "") || "อื่นๆ",
      note: note?.slice(0, 120) ?? null,
    });
  }
  cache = { at: Date.now(), items };
  return { items, fetchedAt: new Date(cache.at).toISOString() };
}
