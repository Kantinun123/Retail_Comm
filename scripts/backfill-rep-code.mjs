/* backfill rep_code (SR####) ลง 3 ตาราง commission โดย join ผ่านรหัสระบบใน sale_reps
   - BA incentive: emp_id (BA App) -> ba_app_id_1/2 -> rep_code
   - LHS: vendor_code -> netsuite_id -> rep_code
   - Product: sale_name (ชื่อ) -> name -> rep_code  (เท่าที่ match ได้)
   RUN: node scripts/backfill-rep-code.mjs
*/
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const norm=(s)=>String(s??"").replace(/\s+/g,"").toLowerCase().trim();

async function pageAll(table, cols, filter) {
  const out=[]; for(let from=0;;from+=1000){ let q=sb.from(table).select(cols).range(from,from+999); if(filter)q=filter(q); const{data,error}=await q; if(error){console.error(table,error.message);process.exit(1);} out.push(...data); if(data.length<1000)break; } return out;
}

/* ---- sale_reps -> lookup maps ---- */
const reps = await pageAll("sale_reps", "rep_code,name,netsuite_id,ba_app_id_1,ba_app_id_2");
const byBA=new Map(), byNet=new Map(), byName=new Map();
for(const r of reps){
  if(r.ba_app_id_1) byBA.set(String(r.ba_app_id_1).trim(), r.rep_code);
  if(r.ba_app_id_2) byBA.set(String(r.ba_app_id_2).trim(), r.rep_code);
  if(r.netsuite_id) byNet.set(String(r.netsuite_id).trim(), r.rep_code);
  if(r.name && !byName.has(norm(r.name))) byName.set(norm(r.name), r.rep_code);
}
console.log(`sale_reps=${reps.length} | byBA=${byBA.size} byNetsuite=${byNet.size} byName=${byName.size}`);

/* update ทีละ rep_code: รวม id แล้ว update เป็นชุด */
async function applyUpdates(table, idToRep) {
  const byRep=new Map();
  for(const [id,rep] of idToRep){ if(!byRep.has(rep))byRep.set(rep,[]); byRep.get(rep).push(id); }
  let done=0, total=idToRep.size;
  for(const [rep,ids] of byRep){
    for(let i=0;i<ids.length;i+=500){ const chunk=ids.slice(i,i+500);
      const {error}=await sb.from(table).update({rep_code:rep}).in("id",chunk);
      if(error){console.error(table,"update",error.message);process.exit(1);}
      done+=chunk.length; process.stdout.write(`\r  ${table} ${done}/${total}`);
    }
  }
  console.log("");
}

/* ---- BA incentive: emp_id -> rep ---- */
{
  const rows = await pageAll("ba_incentive_lines","id,emp_id");
  const idToRep=new Map(); let miss=0;
  for(const r of rows){ const k=String(r.emp_id??"").trim(); const rep=k?byBA.get(k):null; if(rep)idToRep.set(r.id,rep); else miss++; }
  console.log(`BA: match ${idToRep.size}/${rows.length} (miss ${miss})`);
  await applyUpdates("ba_incentive_lines", idToRep);
}
/* ---- LHS: vendor_code -> rep ---- */
{
  const rows = await pageAll("lhs_commission_lines","id,vendor_code");
  const idToRep=new Map(); let miss=0;
  for(const r of rows){ const k=String(r.vendor_code??"").trim(); const rep=k?byNet.get(k):null; if(rep)idToRep.set(r.id,rep); else miss++; }
  console.log(`LHS: match ${idToRep.size}/${rows.length} (miss ${miss})`);
  await applyUpdates("lhs_commission_lines", idToRep);
}
/* ---- Product: vendor_name (ผู้รับเงิน) -> rep  (match ด้วยชื่อ 98.1%) ---- */
{
  const rows = await pageAll("commission_product_lines","id,vendor_name");
  const idToRep=new Map(); let miss=0;
  for(const r of rows){ const rep=byName.get(norm(r.vendor_name)); if(rep)idToRep.set(r.id,rep); else miss++; }
  console.log(`Product (ผู้รับเงิน): match ${idToRep.size}/${rows.length} (miss ${miss})`);
  await applyUpdates("commission_product_lines", idToRep);
}
console.log("DONE backfill rep_code");
