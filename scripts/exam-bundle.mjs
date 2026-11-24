/* =============================================================
   แพ็กโค้ดระบบข้อสอบ (Competency Test) ให้คนอื่นแก้ผ่าน Kiro แล้วรับโค้ดที่แก้กลับมารวมอย่างปลอดภัย
   - pack  : สร้างโฟลเดอร์ commission-app/exports/exam-code-bundle/
             * ไฟล์ที่แก้ได้ (editable) + ไฟล์อ้างอิงอ่านอย่างเดียว (readonly: ไฟล์ที่ไฟล์ข้อสอบ import ตรง ๆ)
             * MANIFEST.json (sha256 ของทุกไฟล์ ณ ตอนแพ็ก + git commit)
             * .kiro/steering/exam-handoff.md (คำแนะนำให้ Kiro ฝั่งผู้แก้)
             ไม่รวม .env / ข้อมูลพนักงาน / ไฟล์ข้อสอบต้นฉบับ (เฉลย) / บันทึกภายใน (lessons-learned)
   - apply : ตรวจโฟลเดอร์ที่ส่งกลับมา เทียบกับ MANIFEST (dry-run เป็นค่าเริ่มต้น ; --write = คัดลอกเข้าโปรเจค + สำรองของเดิม)
             * ไฟล์ที่แก้แล้ว / ไฟล์ใหม่ใต้ขอบเขตข้อสอบ  -> นำเข้าได้
             * ไฟล์ที่แก้ใน readonly หรือนอกขอบเขต       -> ปฏิเสธ
             * ไฟล์ที่ฝั่งเราก็แก้ไปแล้วหลังแพ็ก (ชนกัน)  -> ไม่เขียนทับ ให้ผสานเอง
             * พบสิ่งที่คล้ายความลับ (JWT / service key)   -> ปฏิเสธทั้งชุด
   รัน: node scripts/exam-bundle.mjs pack
        node scripts/exam-bundle.mjs apply <โฟลเดอร์ที่ได้รับกลับ> [--write]
   ============================================================= */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const BUNDLE = "commission-app/exports/exam-code-bundle";
const posix = (p) => p.split("\\").join("/");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/** ขอบเขตที่ "แก้ได้" : โฟลเดอร์ (ทั้งต้นไม้) หรือไฟล์เดี่ยว */
const EDITABLE_ROOTS = [
  "src/app/app/exam",
  "src/app/api/exam",
  "src/app/api/cron/exam-reminders",
  "src/components/commission/exam",
  "src/lib/server/exam.ts",
  "src/lib/commission/exam-store.ts",
  "scripts/import-exam-questions.mjs",
  "scripts/export-exam-gaps.mjs",
  "scripts/lib/exam-parse.mjs",
  "scripts/sql/exam-phase1.sql",
];
const STEERING = ".kiro/steering/exam-handoff.md";

const walk = (rel) => {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [rel];
  return readdirSync(abs).flatMap((n) => walk(posix(join(rel, n))));
};
const inEditableScope = (p) => EDITABLE_ROOTS.some((r) => p === r || p.startsWith(r + "/"));

const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./, "JWT / key ยาว (eyJ...)"],
  [/sb_secret_[A-Za-z0-9_-]{10,}/, "Supabase secret key"],
  [/SERVICE_ROLE_KEY\s*=\s*["']?[A-Za-z0-9._-]{20,}/, "ค่า SERVICE_ROLE_KEY"],
  [/VAPID_PRIVATE_KEY\s*=\s*["']?[A-Za-z0-9._-]{20,}/, "ค่า VAPID_PRIVATE_KEY"],
  [/CRON_SECRET\s*=\s*["']?[A-Za-z0-9._-]{12,}/, "ค่า CRON_SECRET"],
];
const scanSecrets = (path, text) => SECRET_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => `${path}: ${label}`);

/** import ตรง ๆ ของไฟล์ (@/… หรือ relative) -> path ในโปรเจค (ถ้ามีไฟล์จริง) */
function directImports(file) {
  const src = readFileSync(join(ROOT, file), "utf8");
  const out = new Set();
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
    const spec = m[1];
    let base = null;
    if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
    else if (spec.startsWith(".")) base = posix(join(dirname(file), spec));
    if (!base) continue;
    for (const cand of [base, base + ".ts", base + ".tsx", base + ".mjs", base + "/index.ts", base + "/index.tsx"]) {
      if (existsSync(join(ROOT, cand)) && statSync(join(ROOT, cand)).isFile()) {
        out.add(cand);
        break;
      }
    }
  }
  return [...out];
}

function pack() {
  const editable = EDITABLE_ROOTS.flatMap(walk).sort();
  const readonlySet = new Set();
  for (const f of editable.filter((x) => /\.(tsx?|mjs)$/.test(x))) for (const d of directImports(f)) if (!inEditableScope(d)) readonlySet.add(d);
  // ไฟล์กำหนดหน้าตา (ธีม) ให้ Kiro ฝั่งผู้แก้อ่านได้
  for (const t of ["tailwind.config.ts", "src/app/globals.css"]) if (existsSync(join(ROOT, t))) readonlySet.add(t);
  const readonly = [...readonlySet].sort();

  if (existsSync(BUNDLE)) rmSync(BUNDLE, { recursive: true, force: true });
  const manifest = { createdAt: new Date().toISOString(), gitCommit: "", editableRoots: EDITABLE_ROOTS, editable: [], readonly: [] };
  try {
    manifest.gitCommit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {}
  const problems = [];
  for (const [list, key] of [[editable, "editable"], [readonly, "readonly"]]) {
    for (const f of list) {
      const buf = readFileSync(join(ROOT, f));
      problems.push(...scanSecrets(f, buf.toString("utf8")));
      mkdirSync(dirname(join(BUNDLE, f)), { recursive: true });
      copyFileSync(join(ROOT, f), join(BUNDLE, f));
      manifest[key].push({ path: f, sha256: sha(buf), bytes: buf.length });
    }
  }
  if (problems.length) {
    rmSync(BUNDLE, { recursive: true, force: true });
    console.error("พบสิ่งที่คล้ายความลับในไฟล์ที่จะแพ็ก — ยกเลิก:\n" + problems.join("\n"));
    process.exit(2);
  }
  writeFileSync(join(BUNDLE, "MANIFEST.json"), JSON.stringify(manifest, null, 2), "utf8");
  mkdirSync(join(BUNDLE, ".kiro/steering"), { recursive: true });
  const steering = readFileSync(join(ROOT, "scripts/exam-bundle-steering.md"), "utf8").replaceAll("{{COMMIT}}", manifest.gitCommit).replaceAll("{{DATE}}", manifest.createdAt.slice(0, 10));
  writeFileSync(join(BUNDLE, STEERING), steering, "utf8");
  console.log(`แพ็กแล้ว: ${BUNDLE}`);
  console.log(`  แก้ได้ ${editable.length} ไฟล์ · อ่านอย่างเดียว ${readonly.length} ไฟล์ · commit ${manifest.gitCommit}`);
  console.log("  อ่านอย่างเดียว:\n    " + readonly.join("\n    "));
}

function lineStat(a, b) {
  try {
    const out = execFileSync("git", ["diff", "--no-index", "--numstat", "--", a, b], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out;
  } catch (e) {
    // git diff --no-index คืน exit 1 เมื่อมีความต่าง
    const m = String(e.stdout ?? "").trim().split(/\s+/);
    return m.length >= 2 ? `${m[0]}\t${m[1]}` : "";
  }
}

function apply(dirArg, write) {
  if (!dirArg || !existsSync(dirArg)) {
    console.error("ระบุโฟลเดอร์ที่ได้รับกลับมา: node scripts/exam-bundle.mjs apply <โฟลเดอร์> [--write]");
    process.exit(1);
  }
  const src = resolve(dirArg);
  const manifestPath = existsSync(join(src, "MANIFEST.json")) ? join(src, "MANIFEST.json") : join(BUNDLE, "MANIFEST.json");
  if (!existsSync(manifestPath)) {
    console.error("ไม่พบ MANIFEST.json (ต้องมีในโฟลเดอร์ที่ส่งกลับ หรือรัน pack ก่อน)");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const base = new Map([...manifest.editable, ...manifest.readonly].map((x) => [x.path, x.sha256]));
  const readonly = new Set(manifest.readonly.map((x) => x.path));
  const returned = [];
  const walkAbs = (abs) => {
    for (const n of readdirSync(abs)) {
      const p = join(abs, n);
      if (statSync(p).isDirectory()) walkAbs(p);
      else returned.push(posix(relative(src, p)));
    }
  };
  walkAbs(src);

  const res = { changed: [], added: [], conflict: [], rejected: [], unchanged: 0, secrets: [] };
  for (const f of returned) {
    if (f === "MANIFEST.json" || f.startsWith(".kiro/") || f === "CHANGES.txt" || f === "CHANGES.md") continue;
    const buf = readFileSync(join(src, f));
    res.secrets.push(...scanSecrets(f, buf.toString("utf8")));
    const baseSha = base.get(f);
    if (baseSha && sha(buf) === baseSha) {
      res.unchanged++;
      continue;
    }
    if (readonly.has(f) || (!inEditableScope(f) && !baseSha)) {
      res.rejected.push(`${f}  (${readonly.has(f) ? "ไฟล์อ่านอย่างเดียว" : "นอกขอบเขตข้อสอบ"})`);
      continue;
    }
    if (!inEditableScope(f)) {
      res.rejected.push(`${f}  (นอกขอบเขตข้อสอบ)`);
      continue;
    }
    const cur = existsSync(join(ROOT, f)) ? sha(readFileSync(join(ROOT, f))) : null;
    if (!baseSha) {
      if (cur && cur !== sha(buf)) res.conflict.push(`${f}  (ไฟล์ใหม่จากผู้แก้ แต่ฝั่งเรามีไฟล์ชื่อเดียวกันแล้ว)`);
      else res.added.push(f);
      continue;
    }
    if (cur !== baseSha) {
      res.conflict.push(`${f}  (ฝั่งเราแก้ไฟล์นี้หลังแพ็ก ต้องผสานเอง)`);
      continue;
    }
    res.changed.push(f);
  }
  const missing = [...base.keys()].filter((p) => !readonly.has(p) && !returned.includes(p));

  const show = (title, arr) => arr.length && console.log(`\n${title} (${arr.length})\n  ` + arr.join("\n  "));
  console.log(`ตรวจโฟลเดอร์: ${src}\nแพ็กต้นฉบับ commit ${manifest.gitCommit} (${manifest.createdAt.slice(0, 10)})`);
  if (res.secrets.length) {
    console.error("\nพบสิ่งที่คล้ายความลับ — ปฏิเสธทั้งชุด:\n  " + res.secrets.join("\n  "));
    process.exit(2);
  }
  const stat = (f) => {
    const s = lineStat(join(BUNDLE, f), join(src, f));
    const m = s.trim().split(/\s+/);
    return base.has(f) && existsSync(join(BUNDLE, f)) && m.length >= 2 ? `${f}  (+${m[0]} −${m[1]} บรรทัด)` : f;
  };
  show("แก้ไขแล้ว — นำเข้าได้", res.changed.map(stat));
  show("ไฟล์ใหม่ — นำเข้าได้", res.added);
  show("ชนกับฝั่งเรา — ไม่เขียนทับ", res.conflict);
  show("ปฏิเสธ", res.rejected);
  show("ไฟล์ที่ขาดหายจากชุดที่ส่งกลับ (ไม่ลบให้)", missing);
  console.log(`\nไม่เปลี่ยน ${res.unchanged} ไฟล์`);

  if (!write) {
    console.log("\n(dry-run) ยังไม่ได้คัดลอกอะไร — เพิ่ม --write เพื่อนำเข้า");
    return;
  }
  if (res.conflict.length) console.log("\nหมายเหตุ: ไฟล์ที่ชนกันจะข้ามไป");
  const backup = `commission-app/exports/exam-bundle-backup_${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}`;
  let n = 0;
  for (const f of [...res.changed, ...res.added]) {
    if (existsSync(join(ROOT, f))) {
      mkdirSync(dirname(join(backup, f)), { recursive: true });
      copyFileSync(join(ROOT, f), join(backup, f));
    }
    mkdirSync(dirname(join(ROOT, f)), { recursive: true });
    copyFileSync(join(src, f), join(ROOT, f));
    n++;
  }
  console.log(`\nนำเข้า ${n} ไฟล์แล้ว · สำรองของเดิมไว้ที่ ${backup}\nขั้นต่อไป: ตรวจ tsc + eslint แล้วทดสอบก่อน commit`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "pack") pack();
else if (cmd === "apply") apply(arg, process.argv.includes("--write"));
else console.log("ใช้: node scripts/exam-bundle.mjs pack | apply <โฟลเดอร์> [--write]");
