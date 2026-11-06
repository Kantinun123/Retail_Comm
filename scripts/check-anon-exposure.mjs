/* ตรวจว่า "ผู้ใช้ที่ยังไม่ล็อกอิน" (public/anon key เหมือนที่ฝังในหน้าเว็บ) ดึงข้อมูลผ่าน RPC ได้ไหม
   พิมพ์เฉพาะ "จำนวนแถว/ผลสำเร็จหรือถูกปฏิเสธ" ไม่พิมพ์ข้อมูลจริง
   จัดประเภทผล:
     EXPOSED  = เรียกสำเร็จและได้ข้อมูล            (ช่องโหว่)
     DENIED   = ถูกปฏิเสธสิทธิ์ (รหัส 42501)        (ปลอดภัย)
     NO-ROWS  = เรียกได้แต่ไม่เห็นแถว (RLS กรอง)
     OTHER    = error อย่างอื่น (ไม่ใช่การปฏิเสธสิทธิ์ — ต้องดูรายละเอียด อย่าสรุปว่าปลอดภัย)
   RUN: node scripts/check-anon-exposure.mjs */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
// ใช้ publishable (anon) key เท่านั้น — ไม่ล็อกอิน ไม่ sign-in anonymous (ไม่สร้างผู้ใช้ใหม่)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tally = { EXPOSED: 0, DENIED: 0, "NO-ROWS": 0, OTHER: 0 };
async function probe(label, fn) {
  const { data, error } = await fn();
  let kind, note;
  if (error) {
    if (error.code === "42501") { kind = "DENIED"; note = "permission denied"; }
    else { kind = "OTHER"; note = `${error.code ?? ""} ${error.message.slice(0, 80)}`; }
  } else {
    const rows = Array.isArray(data) ? data.length : data ? 1 : 0;
    if (rows === 0) { kind = "NO-ROWS"; note = "0 แถว"; }
    else { kind = "EXPOSED"; note = Array.isArray(data) ? `${rows} แถว` : "ได้ข้อมูล"; }
  }
  tally[kind]++;
  console.log(`  ${kind.padEnd(8)} ${label}  -> ${note}`);
}

console.log("anon key เรียก RPC:");
await probe("store_roster('5100126')  [เบอร์/อีเมล/วันเกิด/Line พนักงาน]", () => sb.rpc("store_roster", { p_dealer: "5100126" }));
await probe("store_list_with_counts()", () => sb.rpc("store_list_with_counts"));
await probe("ba_incentive_summary(null,null)  [ทุกร้าน]", () => sb.rpc("ba_incentive_summary", { p_dealer: null, p_rep: null }));
await probe("lhs_commission_summary(null,null)", () => sb.rpc("lhs_commission_summary", { p_dealer: null, p_rep: null }));
await probe("back_margin_summary(null)", () => sb.rpc("back_margin_summary", { p_dealer: null }));
await probe("service_sales_summary('5100126',null)", () => sb.rpc("service_sales_summary", { p_dealer: "5100126", p_source: null }));
await probe("store_eval_summary(null)", () => sb.rpc("store_eval_summary", { p_dealer: null }));
await probe("cust_sat_summary(null)", () => sb.rpc("cust_sat_summary", { p_dealer: null }));
await probe("visible_events('SR0001')", () => sb.rpc("visible_events", { p_emp_id: "SR0001" }));
await probe("get_checkin_state('SR0001')", () => sb.rpc("get_checkin_state", { p_emp_id: "SR0001" }));
console.log("anon key อ่านตารางตรงๆ (ไม่ล็อกอิน / ไม่ sign-in anonymous):");
await probe("select sale_reps", () => sb.from("sale_reps").select("rep_code").limit(5));
await probe("select profiles", () => sb.from("profiles").select("id").limit(5));
console.log(`\nสรุป: EXPOSED=${tally.EXPOSED} DENIED=${tally.DENIED} NO-ROWS=${tally["NO-ROWS"]} OTHER=${tally.OTHER}`);
