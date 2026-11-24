/* =============================================================
   นำเข้าข้อสอบ Competency SE จาก "ชุดข้อสอบ SE New Comer_Up Level.xlsx"
   -> exam_topics / exam_questions / exam_options + รูปใน bucket exam-images
   - ข้อที่อ่านไม่ครบ (ไม่มีเฉลย / ตัวเลือกไม่ครบ / ตัวเลือกเป็นรูป) -> is_active=false + เก็บเหตุผลใน problem
   - รันซ้ำได้ แต่ถ้ามีคนสอบไปแล้ว (มี attempt) จะไม่ยอมเขียนทับ (เพราะคำตอบอ้างอิง id ตัวเลือก) ยกเว้น --force
   DRY RUN: node scripts/import-exam-questions.mjs [ไฟล์.xlsx]
   APPLY:   node scripts/import-exam-questions.mjs [ไฟล์.xlsx] --apply
   ============================================================= */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp"; // มากับ next (ไม่ได้ประกาศใน package.json) ใช้เฉพาะสคริปต์นี้ ไม่ใช้ใน API
import { parseWorkbook } from "./lib/exam-parse.mjs";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const DEFAULT_FILE = "commission-app/ข้อสอบ Com/ชุดข้อสอบ SE New Comer_Up Level.xlsx";
const file = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? DEFAULT_FILE;
const BUCKET = "exam-images";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { topics } = parseWorkbook(readFileSync(file));

// ---------- รายงาน ----------
const lines = [];
let totalQ = 0;
let okQ = 0;
const bad = [];
for (const t of topics) {
  const ok = t.questions.filter((q) => q.problems.length === 0).length;
  totalQ += t.questions.length;
  okQ += ok;
  const imgs = t.questions.reduce((s, q) => s + q.images.length, 0);
  lines.push(`${String(t.sort).padStart(2)}. ${t.sheet} | ${t.title} | ข้อ ${t.questions.length} ใช้ได้ ${ok} ขาด ${t.questions.length - ok} | รูป ${imgs}`);
  for (const q of t.questions) {
    if (q.problems.length) bad.push(`   - [${t.sheet}] ข้อ ${q.sort} (แถว ${q.srcRow}): ${q.problems.join(", ")} | ${q.body.slice(0, 60)}`);
  }
}
lines.push("", `รวม ${totalQ} ข้อ ใช้ได้ ${okQ} ข้อ ขาด ${totalQ - okQ} ข้อ`, "", "ข้อที่ต้องตรวจ/ขาด:", ...bad);
writeFileSync(process.env.TEMP + "/exam-import-report.txt", lines.join("\n"), "utf8");
console.log(lines.join("\n"));

if (!APPLY) {
  console.log("\n(dry-run) ยังไม่ได้เขียนฐานข้อมูล — เพิ่ม --apply เพื่อนำเข้า");
  process.exit(0);
}

// ---------- นำเข้า ----------
const { count: attempts } = await sb.from("exam_attempts").select("id", { count: "exact", head: true });
if ((attempts ?? 0) > 0 && !FORCE) {
  console.error(`มีการสอบแล้ว ${attempts} ครั้ง — ไม่เขียนทับข้อสอบ (ใช้ --force ถ้าแน่ใจ)`);
  process.exit(2);
}

const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
let upImages = 0;
for (const t of topics) {
  const code = t.sheet;
  const { data: topic, error: te } = await sb
    .from("exam_topics")
    .upsert({ code, title: t.title, group_name: t.group, sort: t.sort, is_active: true }, { onConflict: "code" })
    .select("id")
    .single();
  if (te) throw te;
  // ข้อเดิมของหัวข้อนี้ (ล้างตัวเลือกแล้วใส่ใหม่ ; ข้อที่เกินจากไฟล์ใหม่ปิดใช้งาน)
  const { data: old } = await sb.from("exam_questions").select("id, sort").eq("topic_id", topic.id);
  const oldBySort = new Map((old ?? []).map((q) => [q.sort, q.id]));
  for (const q of t.questions) {
    const paths = [];
    for (let i = 0; i < q.images.length; i++) {
      const im = q.images[i];
      if (!mime[im.ext]) continue; // emf ฯลฯ แสดงบนเบราว์เซอร์ไม่ได้
      const path = `t${String(t.sort).padStart(2, "0")}/q${String(q.sort).padStart(3, "0")}-${i + 1}.${im.ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, Buffer.from(im.data), { contentType: mime[im.ext], upsert: true });
      if (error) throw error;
      paths.push(path);
      upImages++;
    }
    const row = {
      topic_id: topic.id,
      sort: q.sort,
      kind: q.kind,
      body: q.body,
      explanation: q.explanation,
      image_paths: paths,
      is_active: q.problems.length === 0,
      problem: q.problems.length ? q.problems.join(" ; ") : null,
      src_row: q.srcRow,
    };
    const { data: qrow, error: qe } = await sb.from("exam_questions").upsert(row, { onConflict: "topic_id,sort" }).select("id").single();
    if (qe) throw qe;
    oldBySort.delete(q.sort);
    await sb.from("exam_options").delete().eq("question_id", qrow.id);
    if (q.options.length) {
      const optRows = [];
      for (let i = 0; i < q.options.length; i++) {
        const o = q.options[i];
        let imagePath = null;
        if (o.image) {
          // ไอคอนในไฟล์เป็นรูปแถบเครื่องมือที่ถูกครอปด้วย srcRect -> ตัดตามนั้นแล้วขยายให้เห็นชัดบนมือถือ
          const src = sharp(Buffer.from(o.image.data));
          const meta = await src.metadata();
          const c = o.image.crop;
          const left = Math.round(c.l * meta.width), top = Math.round(c.t * meta.height);
          const width = Math.max(1, Math.round((1 - c.l - c.r) * meta.width)), height = Math.max(1, Math.round((1 - c.t - c.b) * meta.height));
          const png = await src.extract({ left, top, width, height }).resize({ height: height * 4, kernel: "lanczos3" }).png().toBuffer();
          imagePath = `t${String(t.sort).padStart(2, "0")}/q${String(q.sort).padStart(3, "0")}-o${i + 1}.png`;
          const { error } = await sb.storage.from(BUCKET).upload(imagePath, png, { contentType: "image/png", upsert: true });
          if (error) throw error;
          upImages++;
        }
        optRows.push({ question_id: qrow.id, sort: i + 1, body: o.body, is_correct: o.correct, image_path: imagePath });
      }
      const { error: oe } = await sb.from("exam_options").insert(optRows);
      if (oe) throw oe;
    }
  }
  for (const id of oldBySort.values()) await sb.from("exam_questions").update({ is_active: false, problem: "ไม่มีในไฟล์ล่าสุด" }).eq("id", id);
}
console.log(`\nนำเข้าเสร็จ: ${topics.length} หัวข้อ, ${totalQ} ข้อ (ใช้ได้ ${okQ}), อัปโหลดรูป ${upImages}`);
