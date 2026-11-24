/* =============================================================
   สรุปรายชื่อ โมเดลร้าน / ร้าน / SE / Area / Coach เป็น Excel (ส่งให้หน่วยงานอื่น)
   - ร้านที่เปิดอยู่ (dealers.is_active) ; SE = sale_reps.position='se' และยังทำงาน (is_active)
   - 1 แถวต่อ SE 1 คน (Area/Coach ซ้ำตามร้าน) ; ร้านที่ไม่มี SE มี 1 แถว ช่อง SE ว่าง
   - Area / Coach ของร้านมาจาก rep_store_assignments (manager = Area, coach = Coach) ที่ยังมีผล ; ร้านที่มีหลายคนคั่นด้วย " / "
   - ไม่ส่งข้อมูลติดต่อ (เบอร์/อีเมล/Line/วันเกิด) ออกไป
   รัน: node scripts/export-store-team.mjs [ไฟล์ผลลัพธ์.xlsx]
   --photos : ทำโฟลเดอร์ commission-app/exports/se-photos_<วันที่>/ = Excel (เพิ่มคอลัมน์ รหัสพนักงาน + ไฟล์รูป) + photos/<รหัสพนักงาน>.jpg
              (รูปมาจากข้อมูลพนักงาน sale_reps.photo_url ; คนที่ไม่มีรูปปล่อยช่องไฟล์รูปว่าง)
   ============================================================= */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = async (t, sel) => {
  let out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(t).select(sel).range(from, from + 999);
    if (error) throw error;
    out = out.concat(data);
    if (data.length < 1000) break;
  }
  return out;
};

const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const PHOTOS = process.argv.includes("--photos");
const posArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const stamp = today.replaceAll("-", "");
const PHOTO_DIR = `commission-app/exports/se-photos_${stamp}`;
const OUT = posArg ?? (PHOTOS ? `${PHOTO_DIR}/รายชื่อ-SE-พร้อมรูป_${stamp}.xlsx` : `commission-app/exports/รายชื่อร้าน-SE-Area-Coach_${stamp}.xlsx`);

const [dealers, reps, asg] = await Promise.all([
  all("dealers", "code, name, model, is_active"),
  all("sale_reps", "rep_code, name, nickname, position, dealer_code, is_active, photo_url"),
  all("rep_store_assignments", "rep_code, dealer_code, role_in_store, effective_from, effective_to"),
]);

// ชื่อเล่นบางคนถูกใส่ไว้ในช่องชื่อแล้ว (เช่น "ชุลีพร ... (อาร์มี่)") -> ไม่ต่อซ้ำ
const full = (r) => (r.nickname && !r.name.includes(`(${r.nickname})`) ? `${r.name} (${r.nickname})` : r.name);
const repBy = new Map(reps.map((r) => [r.rep_code, r]));
const live = (a) => (!a.effective_from || a.effective_from <= today) && (!a.effective_to || a.effective_to >= today);

// Area / Coach ต่อร้าน (ซ้ำคนเดียวกันตัดออก ; ข้ามคนที่เลิกทำงานแล้ว)
const team = new Map();
for (const a of asg.filter(live)) {
  const r = repBy.get(a.rep_code);
  if (!r || r.is_active === false) continue;
  const role = a.role_in_store === "manager" ? "area" : a.role_in_store === "coach" ? "coach" : null;
  if (!role) continue;
  if (!team.has(a.dealer_code)) team.set(a.dealer_code, { area: [], coach: [] });
  const list = team.get(a.dealer_code)[role];
  if (!list.includes(full(r))) list.push(full(r));
}
const ses = new Map();
// ในฐานข้อมูลมี SE ที่ชื่อ "N/A" (ตัวแทนที่ยังไม่มี SE ตอนนำเข้าข้อมูล) -> ถือว่าร้านนั้นไม่มี SE
const isPlaceholder = (n) => !n || /^\s*(n\/?a|-|–)?\s*$/i.test(n);
for (const r of reps.filter((x) => x.position === "se" && x.is_active !== false && x.dealer_code && !isPlaceholder(x.name))) {
  if (!ses.has(r.dealer_code)) ses.set(r.dealer_code, []);
  ses.get(r.dealer_code).push(r);
}

const th = (a, b) => String(a).localeCompare(String(b), "th");
const stores = dealers.filter((d) => d.is_active).sort((a, b) => th(a.model, b.model) || th(a.name, b.name));
const rows = [["โมเดลร้าน", "ชื่อร้าน", "ชื่อ-นามสกุล (ชื่อเล่น) SE", "ชื่อ-นามสกุล (ชื่อเล่น) Area", "ชื่อ-นามสกุล (ชื่อเล่น) โค้ช", ...(PHOTOS ? ["รหัสพนักงาน SE", "ไฟล์รูป SE"] : [])]];
const photoJobs = []; // { rep_code, url }
let noSe = 0, noArea = 0, noCoach = 0, seCount = 0;
for (const d of stores) {
  const t = team.get(d.code) ?? { area: [], coach: [] };
  const area = t.area.join(" / ");
  const coach = t.coach.join(" / ");
  if (!area) noArea++;
  if (!coach) noCoach++;
  const list = (ses.get(d.code) ?? []).sort((a, b) => th(a.name, b.name));
  if (!list.length) {
    noSe++;
    rows.push([d.model, d.name, "", area, coach, ...(PHOTOS ? ["", ""] : [])]);
  } else {
    for (const s of list) {
      seCount++;
      rows.push([d.model, d.name, full(s), area, coach, ...(PHOTOS ? [s.rep_code, s.photo_url ? `${s.rep_code}.__EXT__` : ""] : [])]);
      if (PHOTOS && s.photo_url) photoJobs.push({ rep_code: s.rep_code, url: s.photo_url, row: rows.length - 1 });
    }
  }
}

// ---- ดาวน์โหลดรูป (เฉพาะโหมด --photos) : ตั้งชื่อ <รหัสพนักงาน>.<นามสกุลไฟล์จริง> ----
let photoOk = 0;
const photoFail = [];
if (PHOTOS) {
  mkdirSync(join(dirname(OUT), "photos"), { recursive: true });
  const extOf = (ct) => ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[ct?.split(";")[0].trim()] ?? null;
  const queue = [...photoJobs];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        try {
          const res = await fetch(j.url, { signal: AbortSignal.timeout(20000) });
          const ext = extOf(res.headers.get("content-type"));
          if (!res.ok || !ext) throw new Error(`HTTP ${res.status} ${res.headers.get("content-type")}`);
          writeFileSync(join(dirname(OUT), "photos", `${j.rep_code}.${ext}`), Buffer.from(await res.arrayBuffer()));
          rows[j.row][6] = `${j.rep_code}.${ext}`;
          photoOk++;
        } catch (e) {
          rows[j.row][6] = "";
          photoFail.push(`${j.rep_code}: ${e.message}`);
        }
      }
    })
  );
  for (const r of rows.slice(1)) if (typeof r[6] === "string" && r[6].includes("__EXT__")) r[6] = "";
}

const ws = XLSX.utils.aoa_to_sheet(rows);
ws["!cols"] = [{ wch: 16 }, { wch: 46 }, { wch: 38 }, { wch: 38 }, { wch: 38 }, ...(PHOTOS ? [{ wch: 16 }, { wch: 18 }] : [])];
ws["!autofilter"] = { ref: `A1:${PHOTOS ? "G" : "E"}${rows.length}` };
ws["!freeze"] = { xSplit: 0, ySplit: 1 };
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "รายชื่อ");
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log(`เขียน ${OUT}`);
console.log(`ร้านที่เปิดอยู่ ${stores.length} ร้าน | แถว ${rows.length - 1} | SE ${seCount} คน | ร้านไม่มี SE ${noSe} | ร้านไม่มี Area ${noArea} | ร้านไม่มีโค้ช ${noCoach}`);
const byModel = {};
for (const d of stores) byModel[d.model] = (byModel[d.model] ?? 0) + 1;
console.log("แยกโมเดล:", JSON.stringify(byModel));
if (PHOTOS) {
  const seRows = rows.slice(1).filter((r) => r[5]);
  console.log(`รูป SE: ดาวน์โหลดสำเร็จ ${photoOk} รูป | SE ในไฟล์ ${seRows.length} คน | ไม่มีรูป ${seRows.filter((r) => !r[6]).length} คน | ดาวน์โหลดไม่สำเร็จ ${photoFail.length}`);
  for (const f of photoFail) console.log("  ✗", f);
}
process.exit(0);
