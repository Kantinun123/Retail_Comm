/* ติดตามกลุ่ม Line ลูกค้า — อ่านไฟล์กลุ่ม Line + คำนวณสถานะต่อลูกค้า
   ใช้ร่วมกันทั้ง API (อัปโหลดในศูนย์ข้อมูล) และสคริปต์ scripts/import-line-groups.mjs
   ห้าม import ผ่าน alias "@/..." (สคริปต์ node เรียกไฟล์นี้ตรง ๆ)

   กติกา (ผู้ใช้ยืนยัน พ.ย. 69)
   - งาน = (1) Rudy: service_sales_lines กลุ่ม ROOF SERVICE + Roof Reno เฉพาะ H5 REROOF (building_type OB/NONRES)
           (2) BA : ba_service_sales_lines กลุ่ม ROOF SERVICE + Roof Reno เฉพาะ Re-Roof ; เฉพาะงานติดตั้ง (type_of_job I) — เลขงาน = เลขใบเสนอราคา Q…
     Roof Reno อื่น (Roof Repair / Repaint / Top up / Renew) ไม่นับ (ผู้ใช้ยืนยัน 23 พ.ย. 69)
     ร้าน Housing Expert + SCG Home ตั้งแต่ FROM
   - เฉพาะช่องทาง B2C (คอลัมน์ H7 ของไฟล์ Rudy -> rudy_job_customers.h7)
   - ลูกค้าคนเดียวกัน = home_id เดียวกันใน CRM หรือ ร้านเดียวกัน + ชื่อเดียวกันตาม normName()
       ต่างกันแค่ประเภทงาน / หลายแปลงของบริษัทเดียวกัน = รวม ; "บ้านคุณ…" คนละคน = แยก
   - สถานะลูกค้า = ดีที่สุดของทุกงาน: register > not_register > no_bot ; ไม่มี = null (ไม่มีข้อมูล)
   - เลขใบเสนอราคา (Q…) ในไฟล์กลุ่ม Line = งาน BA (job_code) */
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LineStatusKey = "register" | "not_register" | "no_bot";
export interface LineGroupEntry {
  source_file: string;
  kind: "register" | "groups" | "data";
  job_tokens: string | null;
  status: LineStatusKey;
  group_name: string | null;
  group_created: string | null;
}
export interface ParsedLineFile {
  name: string;
  status: "ok" | "warn" | "error";
  messages: string[];
  entries: LineGroupEntry[];
  counts: { register: number; groups: number; data: number };
}

export const FROM_PERIOD = "2026-01";
/** Roof Reno ที่นับ = งานเปลี่ยนหลังคาเท่านั้น (Rudy H5 / BA service_group) */
export const RUDY_REROOF = "REROOF";
export const BA_REROOF = "Re-Roof";
const RANK: Record<LineStatusKey, number> = { register: 3, not_register: 2, no_bot: 1 };

/** "10/24/26" (m/d/yy) หรือ "2026-10-24 04:13:46" (ไฟล์จาก Google Drive) -> "2026-10-24" */
function mdy(s: unknown): string | null {
  const raw = String(s ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const p = raw.split(" ")[0].split("/");
  if (p.length !== 3) return null;
  const y = Number(p[2]) < 100 ? 2000 + Number(p[2]) : Number(p[2]);
  const m = Number(p[0]), d = Number(p[1]);
  if (!y || !m || !d || m > 12 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const str = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 300) : null;
};

/** อ่านไฟล์กลุ่ม Line 1 ไฟล์ — รู้จักจากหัวคอลัมน์ ไม่ใช่ชื่อไฟล์
 *  - ชีตที่มี group_name + job_number (+ Register Yes/No) = รายการกลุ่ม ; ไม่มีคอลัมน์ Register = ลงทะเบียนทั้งหมด
 *  - ชีตที่มี Job + Add Bot + Register = ตารางเทียบรายงาน (Data) */
export function parseLineGroupFile(name: string, buf: Uint8Array): ParsedLineFile {
  const out: ParsedLineFile = { name, status: "ok", messages: [], entries: [], counts: { register: 0, groups: 0, data: 0 } };
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch {
    return { ...out, status: "error", messages: ["เปิดไฟล์ไม่ได้ (ไม่ใช่ไฟล์ Excel?)"] };
  }
  let emptyJobSheets = 0;
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sn], { defval: "", raw: false });
    if (!rows.length) continue;
    const cols = new Set(Object.keys(rows[0]).map((c) => c.trim()));
    if (cols.has("group_name") && cols.has("job_number")) {
      const hasReg = cols.has("Register");
      const withJob = rows.filter((r) => str(r.job_number));
      if (!withJob.length) {
        emptyJobSheets++;
        continue;
      }
      for (const r of withJob) {
        const status: LineStatusKey = !hasReg || String(r.Register).trim() === "Yes" ? "register" : "not_register";
        out.entries.push({ source_file: name, kind: hasReg ? "groups" : "register", job_tokens: str(r.job_number), status, group_name: str(r.group_name), group_created: mdy(r.created_at) });
        out.counts[hasReg ? "groups" : "register"]++;
      }
      const skipped = rows.length - withJob.length;
      if (skipped) out.messages.push(`ชีต "${sn}": ข้าม ${skipped} แถวที่ไม่มีเลขงาน`);
    } else if (cols.has("Job") && cols.has("Add Bot") && cols.has("Register")) {
      for (const r of rows) {
        const reg = String(r.Register).trim();
        const status: LineStatusKey | null = reg === "Register" ? "register" : reg === "Not Register" ? "not_register" : String(r["Add Bot"]).trim() === "No" ? "no_bot" : null;
        if (!status || !str(r.Job)) continue;
        out.entries.push({ source_file: name, kind: "data", job_tokens: str(r.Job), status, group_name: str(r.Group_Name), group_created: mdy(r["วันที่ Add Bot"]) });
        out.counts.data++;
      }
    }
  }
  if (!out.entries.length) {
    out.status = "error";
    out.messages.unshift(
      emptyJobSheets
        ? "ไฟล์นี้ไม่มีเลขงาน (เช่น group_not_register) จึงจับคู่กับงานไม่ได้"
        : "ไม่พบชีตที่รู้จัก (ต้องมีคอลัมน์ group_name + job_number หรือ Job + Add Bot + Register)"
    );
  } else if (out.messages.length) out.status = "warn";
  const q = out.entries.filter((e) => /^Q\d{4}-/i.test(e.job_tokens ?? "")).length;
  if (q) out.messages.push(`${q} แถวใช้เลขใบเสนอราคา (Q…) จับคู่ไม่ได้`);
  return out;
}

/* ---------------- ชื่อลูกค้า ---------------- */
const WORK_WORDS = /(รอบ\s*(บน|ล่าง|แรก|สอง|\d+)|หลัง\s*ที่\s*\d+|หลังที่สอง|แปลง\s*[A-Za-z0-9ก-๙-]+|เฟส\s*\d+|phase\s*\d+|งวด\s*\d+|truss|ค่าแรง\s*มุง|เฉพาะ\s*แรง|มุง|งาน\s*เพิ่มเติม|ต่อเติม|โรง\s*(จอด)?\s*รถ|ตัวบ้าน|กันสาด|อะเส|value|type\s*[a-z0-9]+|ดาร์กเกรย์)/gi;
const TITLE = /(นางสาว|นาย|นาง|คุณ|บ้าน|บจก\.?|บริษัท|จำกัด|หจก\.?|ห้างหุ้นส่วน|บ\.(?=\s*[ก-๙A-Za-z]))/g;
const squash = (s: string) => s.replace(/[\s._\-()/:,+]+/g, "").toLowerCase();
export function normName(s: string | null | undefined): string {
  let full = String(s ?? "");
  // ร้านใส่ชื่อร้านตัวเองแล้วใส่ลูกค้าจริงในวงเล็บ เช่น "พัฒนาดีโฮมมาร์ท (บจก.ทูพีเฮ้า)" -> ใช้บริษัทในวงเล็บเป็นลูกค้า
  const company = (full.match(/\(([^)]*)\)/g) ?? []).map((x) => x.slice(1, -1)).find((x) => /(บจก|บริษัท|หจก|ห้างหุ้นส่วน)/.test(x));
  if (company) full = company;
  // เจ้าของบ้านในวงเล็บ "บ้านคุณกัญชพร อินธรรม" -> "กัญชพร"
  const owner = (full.match(/\(([^)]*)\)/g) ?? []).map((x) => x.match(/คุณ\s*([ก-๙A-Za-z]{2,})/)?.[1]).find(Boolean) ?? "";
  const base = squash(full.replace(/\(.*?\)/g, " ").replace(WORK_WORDS, " ").replace(TITLE, ""));
  return owner ? `${base}#${owner.toLowerCase()}` : base;
}

/* ---------------- คำนวณ ---------------- */
type Sb = SupabaseClient;
/** อ่านทีละ 1,000 แถวแบบ keyset (offset ลึก ๆ ทำให้ statement timeout) — build(last) ต้อง order + limit(1000) + gt(key,last) เอง */
async function keyset<T>(label: string, key: keyof T & string, build: (last: unknown) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  let last: unknown = null;
  for (;;) {
    const { data, error } = await build(last);
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
    last = rows[rows.length - 1][key];
  }
  return out;
}

export interface LineTrackingRow {
  batch: string; source: "rudy" | "ba"; project_number: string; dealer_code: string; period: string; order_date: string | null; h5: string | null; sales_name: string | null; rep_code: string | null;
  amount: number; opp_ids: string | null; customer_id: string; customer_name: string | null; customer_type: string | null; province: string | null;
  customer_period: string; customer_dealer: string; job_status: LineStatusKey | null; customer_status: LineStatusKey | null;
  group_name: string | null; group_created: string | null; status_source: string | null; source_date: string | null;
}
export interface LineTrackingSummary {
  jobs: number; baJobs: number; nonB2c: number; missingCustomer: number; customers: number; multiJob: number;
  register: number; not_register: number; no_bot: number; none: number; sourceDate: string | null;
}

/** คำนวณสถานะทั้งหมด ; entries = ใช้ชุดนี้แทนข้อมูลใน line_group_entries (ใช้ตอน preview การอัปโหลด) */
export async function computeLineTracking(sb: Sb, opts: { entries?: LineGroupEntry[]; from?: string } = {}): Promise<{ rows: LineTrackingRow[]; summary: LineTrackingSummary; merged: string[][] }> {
  const from = opts.from ?? FROM_PERIOD;
  const { data: dealers, error: dErr } = await sb.from("dealers").select("code").in("model", ["Housing Expert", "SCG Home"]);
  if (dErr) throw new Error(dErr.message);
  const storeOk = new Set((dealers ?? []).map((d) => d.code as string));

  type L = { id: number; project_number: string; dealer_code: string | null; period: string; order_date: string | null; h5: string | null; sales_name: string | null; rep_code: string | null; amount_incl_vat: number | null };
  // Rudy: กลุ่ม ROOF SERVICE + Roof Reno เฉพาะงานเปลี่ยนหลังคา (กลุ่ม Qchang H5 = REROOF) ; Roof Reno อื่นไม่นับ (ผู้ใช้ยืนยัน 23 พ.ย. 69)
  const rudyLines = (filter: { group3: string; h5?: string }) =>
    keyset<L>("service_sales_lines", "id", (last) => {
      let q = sb.from("service_sales_lines").select("id, project_number, dealer_code, period, order_date, h5, sales_name, rep_code, amount_incl_vat").eq("group3", filter.group3).in("building_type", ["OB", "NONRES"]).gte("period", from).order("id").limit(1000);
      if (filter.h5) q = q.eq("h5", filter.h5);
      if (last !== null) q = q.gt("id", last);
      return q;
    });
  const lines = [...(await rudyLines({ group3: "ROOF SERVICE" })), ...(await rudyLines({ group3: "Qchang", h5: RUDY_REROOF }))];
  const jobs = new Map<string, L & { amount: number; source: "rudy" | "ba"; ba_customer?: string | null }>();
  for (const l of lines) {
    if (!l.dealer_code || !storeOk.has(l.dealer_code)) continue;
    const j = jobs.get(l.project_number);
    if (!j) jobs.set(l.project_number, { ...l, amount: Number(l.amount_incl_vat) || 0, source: "rudy" });
    else {
      j.amount += Number(l.amount_incl_vat) || 0;
      if (l.period < j.period) Object.assign(j, { period: l.period, order_date: l.order_date, dealer_code: l.dealer_code });
    }
  }

  // ลูกค้า + H7 + ref_opp ของงาน Rudy
  const codes = [...jobs.keys()];
  type C = { project_number: string; customer_first: string | null; customer_last: string | null; customer_type: string | null; province: string | null; ref_opp: string | null; h7: string | null };
  const custRows: C[] = [];
  for (let i = 0; i < codes.length; i += 200) {
    const { data, error } = await sb.from("rudy_job_customers").select("project_number, customer_first, customer_last, customer_type, province, ref_opp, h7").in("project_number", codes.slice(i, i + 200));
    if (error) throw new Error(`rudy_job_customers: ${error.message}`);
    custRows.push(...((data ?? []) as C[]));
  }
  const custOf = new Map(custRows.map((c) => [c.project_number, c]));
  let nonB2c = 0, missingCustomer = 0;
  for (const p of codes) {
    const c = custOf.get(p);
    if (!c) missingCustomer++;
    else if ((c.h7 ?? "").trim() && c.h7!.trim() !== "B2C") { jobs.delete(p); nonB2c++; }
  }

  // งาน BA กลุ่ม ROOF SERVICE + Roof Reno เฉพาะ Re-Roof (งานเปลี่ยนหลังคา) — เฉพาะงานติดตั้ง (I) ; งานสำรวจ (S) ไม่นับ (ผู้ใช้ยืนยัน พ.ย. 69)
  type B = { id: number; job_code: string; period: string; win_date: string | null; dealer_code: string | null; customer_name: string | null; type_of_job: string | null; service_group: string | null; amount: number | null; rep_code: string | null; sales_name: string | null; seller_name: string | null };
  const baQuery = (filter: { group3: string; serviceGroup?: string }) =>
    keyset<B>("ba_service_sales_lines", "id", (last) => {
      let q = sb.from("ba_service_sales_lines").select("id, job_code, period, win_date, dealer_code, customer_name, type_of_job, service_group, amount, rep_code, sales_name, seller_name").eq("group3", filter.group3).eq("type_of_job", "I").gte("period", from).order("id").limit(1000);
      if (filter.serviceGroup) q = q.eq("service_group", filter.serviceGroup);
      if (last !== null) q = q.gt("id", last);
      return q;
    });
  const baLines = [...(await baQuery({ group3: "ROOF SERVICE" })), ...(await baQuery({ group3: "Qchang", serviceGroup: BA_REROOF }))];
  let baJobs = 0;
  for (const b of baLines) {
    const code = String(b.job_code ?? "").trim().toUpperCase();
    if (!code || !b.dealer_code || !storeOk.has(b.dealer_code)) continue;
    const j = jobs.get(code);
    if (!j) {
      baJobs++;
      jobs.set(code, {
        id: b.id, project_number: code, dealer_code: b.dealer_code, period: b.period, order_date: b.win_date, h5: b.service_group,
        sales_name: b.seller_name || b.sales_name, rep_code: b.rep_code, amount_incl_vat: null, amount: Number(b.amount) || 0, source: "ba", ba_customer: b.customer_name,
      });
    } else {
      j.amount += Number(b.amount) || 0;
      if (b.period < j.period) Object.assign(j, { period: b.period, order_date: b.win_date, dealer_code: b.dealer_code });
    }
  }

  // เลข OP <-> เลขงาน (Rudy ref_opp + CRM rudy_id) และ home_id
  const projOpps = new Map<string, Set<string>>();
  const addOpp = (p: string | null | undefined, o: string | null | undefined) => {
    const pp = String(p ?? "").trim().slice(0, 14), oo = String(o ?? "").trim();
    if (!pp || !/^OP\d{12}$/.test(oo)) return;
    projOpps.set(pp, (projOpps.get(pp) ?? new Set()).add(oo));
  };
  custRows.forEach((c) => addOpp(c.project_number, c.ref_opp));
  const crm = await keyset<{ id: number; opp_id: string; rudy_id: string | null; home_id: string | null }>("design_intake_lines", "id", (last) => {
    let q = sb.from("design_intake_lines").select("id, opp_id, rudy_id, home_id").not("rudy_id", "is", null).order("id").limit(1000);
    if (last !== null) q = q.gt("id", last);
    return q;
  });
  const homeOfOpp = new Map<string, string>();
  for (const c of crm) {
    String(c.rudy_id).split(/[,\s]+/).forEach((rd) => addOpp(rd, c.opp_id));
    if (c.home_id) homeOfOpp.set(c.opp_id, c.home_id);
  }
  const oppProj = new Map<string, string>();
  for (const [p, s] of projOpps) for (const o of s) oppProj.set(o, p);

  // รวมเป็นลูกค้า (union-find)
  const parent = new Map([...jobs.keys()].map((p) => [p, p]));
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  const byKey = new Map<string, string>();
  const link = (k: string, p: string) => {
    if (!byKey.has(k)) return void byKey.set(k, p);
    const a = find(byKey.get(k)!), b = find(p);
    if (a !== b) parent.set(b, a);
  };
  const nameOf = (p: string) => {
    const bj = jobs.get(p);
    if (bj?.source === "ba") return String(bj.ba_customer ?? "").replace(/[\s.\-]+$/g, "").replace(/\s+/g, " ").trim();
    const c = custOf.get(p);
    return c ? `${(c.customer_first ?? "").trim()} ${(c.customer_last ?? "").trim()}`.replace(/\s+/g, " ").trim() : "";
  };
  for (const p of jobs.keys()) {
    for (const o of projOpps.get(p) ?? []) {
      const h = homeOfOpp.get(o);
      if (h) link(`H:${h}`, p);
    }
    const c = custOf.get(p);
    const key = jobs.get(p)!.source === "ba" ? normName(jobs.get(p)!.ba_customer) : c ? normName(`${c.customer_first ?? ""} ${c.customer_last ?? ""}`) : "";
    // ชื่อสั้นมาก (< 4 ตัวรวมชื่อเจ้าของบ้าน) ไม่ใช้รวม กันรวมผิดคน
    if (key.length >= 4) link(`N:${jobs.get(p)!.dealer_code}:${key}`, p);
  }

  // สถานะกลุ่ม Line ต่องาน
  let entries = opts.entries;
  if (!entries)
    entries = await keyset<LineGroupEntry & { id: number }>("line_group_entries", "id", (last) => {
      let q = sb.from("line_group_entries").select("id, source_file, kind, job_tokens, status, group_name, group_created").order("id").limit(1000);
      if (last !== null) q = q.gt("id", last);
      return q;
    });
  type StInfo = { status: LineStatusKey; group: string | null; created: string | null; source: string };
  const st = new Map<string, StInfo>();
  const toProj = (t: string) => {
    t = t.trim().replace(/\/\d+$/, "");
    if (/^RD\d{12}/.test(t)) return t.slice(0, 14);
    if (/^OP\d{12}/.test(t)) return oppProj.get(t.slice(0, 14)) ?? null;
    const q = t.match(/^Q\d{4}-\d{6}/i)?.[0];
    if (q) return q.toUpperCase();
    return null;
  };
  let sourceDate: string | null = null;
  for (const e of entries) {
    if (e.group_created && (!sourceDate || e.group_created > sourceDate)) sourceDate = e.group_created;
    for (const t of String(e.job_tokens ?? "").split(/[,\s]+/).filter(Boolean)) {
      const p = toProj(t);
      if (!p || !jobs.has(p)) continue;
      const cur = st.get(p);
      if (!cur || RANK[e.status] > RANK[cur.status]) st.set(p, { status: e.status, group: e.group_name, created: e.group_created, source: `${e.source_file}${e.kind === "groups" ? " (ลงทะเบียนกลุ่ม)" : e.kind === "data" ? " (Data)" : ""}` });
    }
  }

  // รวมต่อลูกค้า
  const cust = new Map<string, { id: string; period: string; dealer: string; best: StInfo | null; jobs: string[] }>();
  for (const [p, j] of jobs) {
    const r = find(p);
    const c = cust.get(r) ?? { id: r, period: j.period, dealer: j.dealer_code!, best: null, jobs: [] };
    c.jobs.push(p);
    if (j.period < c.period) { c.period = j.period; c.dealer = j.dealer_code!; }
    const s = st.get(p);
    if (s && (!c.best || RANK[s.status] > RANK[c.best.status])) c.best = s;
    cust.set(r, c);
  }

  const batch = new Date().toISOString();
  const rows: LineTrackingRow[] = [...jobs.values()].map((j) => {
    const c = cust.get(find(j.project_number))!;
    const s = st.get(j.project_number);
    const info = custOf.get(j.project_number);
    const shown = s ?? c.best;
    return {
      batch, source: j.source, project_number: j.project_number, dealer_code: j.dealer_code!, period: j.period, order_date: j.order_date, h5: j.h5, sales_name: j.sales_name, rep_code: j.rep_code,
      amount: Math.round(j.amount * 100) / 100, opp_ids: [...(projOpps.get(j.project_number) ?? [])].join(", ") || null,
      customer_id: c.id, customer_name: nameOf(j.project_number) || null, customer_type: info?.customer_type ?? null, province: info?.province ?? null,
      customer_period: c.period, customer_dealer: c.dealer,
      job_status: s?.status ?? null, customer_status: c.best?.status ?? null,
      group_name: shown?.group ?? null, group_created: shown?.created ?? null, status_source: shown?.source ?? null,
      source_date: sourceDate,
    };
  });
  const C = [...cust.values()];
  const n = (k: LineStatusKey | null) => C.filter((c) => (c.best?.status ?? null) === k).length;
  const merged = C.filter((c) => c.jobs.length > 1).map((c) => [...new Set(c.jobs.map(nameOf))]).filter((x) => x.length > 1);
  return {
    rows,
    merged,
    summary: { jobs: jobs.size, baJobs, nonB2c, missingCustomer, customers: C.length, multiJob: C.filter((c) => c.jobs.length > 1).length, register: n("register"), not_register: n("not_register"), no_bot: n("no_bot"), none: n(null), sourceDate },
  };
}

/** บันทึกชุดใหม่: insert batch ใหม่ก่อน แล้วลบ batch อื่น (insert พัง -> ลบ batch ใหม่ทิ้ง ข้อมูลเดิมอยู่ครบ) */
export async function writeLineTracking(sb: Sb, rows: LineTrackingRow[]): Promise<void> {
  if (!rows.length) throw new Error("ไม่มีงานให้บันทึก — หยุดไว้ก่อนเพื่อไม่ลบข้อมูลเดิม");
  const batch = rows[0].batch;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("line_tracking_jobs").insert(rows.slice(i, i + 500));
    if (error) {
      await sb.from("line_tracking_jobs").delete().eq("batch", batch);
      throw new Error(error.message);
    }
  }
  const { error } = await sb.from("line_tracking_jobs").delete().neq("batch", batch);
  if (error) throw new Error(error.message);
}

/** แทนที่แถวของไฟล์ที่อัปโหลด (ชื่อไฟล์เดิม = แทนที่) — เพิ่มแถวใหม่ก่อนแล้วค่อยลบแถวเก่า */
export async function replaceLineGroupFiles(sb: Sb, files: ParsedLineFile[], uploadedBy: string | null): Promise<number> {
  const names = files.map((f) => f.name);
  const { data: maxRow } = await sb.from("line_group_entries").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  const maxBefore = (maxRow?.id as number | undefined) ?? 0;
  const rows = files.flatMap((f) => f.entries.map((e) => ({ ...e, uploaded_by: uploadedBy })));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("line_group_entries").insert(rows.slice(i, i + 500));
    if (error) {
      await sb.from("line_group_entries").delete().in("source_file", names).gt("id", maxBefore);
      throw new Error(error.message);
    }
  }
  const { error } = await sb.from("line_group_entries").delete().in("source_file", names).lte("id", maxBefore);
  if (error) throw new Error(error.message);
  return rows.length;
}
