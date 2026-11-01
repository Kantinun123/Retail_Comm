/* สร้าง sale_reps จาก Master_Member — rep_code auto (SR####) เรียงตาม CR#
   เก็บ cr_code + dealer + รหัสระบบ (netsuite/ba/di) ไว้ re-map
   รายงาน match กับ BA/LHS/Product

   DRY RUN: node scripts/build-sale-reps.mjs
   APPLY:   node scripts/build-sale-reps.mjs --apply
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const DIR = "commission-app";
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
function parseCsv(text){const rows=[];let cur=[],f="",q=false;text=text.replace(/^\uFEFF/,"");for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else{if(c==='"')q=true;else if(c===","){cur.push(f);f="";}else if(c==="\n"){cur.push(f);rows.push(cur);cur=[];f="";}else if(c==="\r"){}else f+=c;}}if(f.length||cur.length){cur.push(f);rows.push(cur);}return rows;}
const str=(v)=>{const s=String(v??"").trim();return s===""?null:s;};

/* Master_Dealer: Dealer Code -> Dealer Name */
const md = parseCsv(readFileSync(join(DIR,"Master_Dealer.csv"),"utf8"));
const mdh = md[0].map(c=>String(c).trim());
const iDC=mdh.findIndex(h=>/^Dealer Code$/i.test(h)), iDN=mdh.findIndex(h=>/^Dealer Name$/i.test(h)), iDType=mdh.findIndex(h=>/^Dealer Type$/i.test(h));
const dealerName=new Map(), dealerModel=new Map();
for(let r=1;r<md.length;r++){const c=String(md[r][iDC]??"").trim();if(c){dealerName.set(c,String(md[r][iDN]??"").trim());dealerModel.set(c,String(md[r][iDType]??"").trim());}}

/* Master_Member */
const mm = parseCsv(readFileSync(join(DIR,"Master_Member.csv"),"utf8"));
const mh = mm[0].map(c=>String(c).trim());
const col=(re)=>mh.findIndex(h=>re.test(h));
const iUser=col(/^User ID$/i), iName=col(/^Salesperson Name$/i), iDealer=col(/^Dealer Code$/i),
  iStatus=col(/^User Status$/i), iNet=col(/^Salesperson ID_Netsuite App$/i),
  iBA1=col(/^Salesperson ID_BA App_1$/i), iBA2=col(/^Salesperson ID_BA App_2$/i),
  iDI=col(/^Salesperson ID_DI App$/i), iPhone=col(/^Salesperson Phone$/i), iEmail=col(/^Salesperson Email$/i);

/* เก็บพนักงานที่มี User ID = CR# จริง (ข้ามแถว header ปลอม) เรียงตาม CR# */
const emps=[];
for(let r=1;r<mm.length;r++){
  const row=mm[r]; if(!row) continue;
  const cr=String(row[iUser]??"").trim();
  if(!/^CR\d+/i.test(cr)) continue;       // เฉพาะ CR#### จริง
  emps.push({
    cr_code: cr,
    name: str(row[iName]) ?? cr,
    dealer_code: str(row[iDealer]),
    status: str(row[iStatus]),
    netsuite_id: str(row[iNet]),
    ba_app_id_1: str(row[iBA1]),
    ba_app_id_2: str(row[iBA2]),
    di_id: iDI>=0?str(row[iDI]):null,
    phone: iPhone>=0?str(row[iPhone]):null,
    email: iEmail>=0?str(row[iEmail]):null,
  });
}
emps.sort((a,b)=>a.cr_code.localeCompare(b.cr_code,undefined,{numeric:true}));
/* generate SR#### */
const reps=emps.map((e,i)=>({ rep_code:`SR${String(i+1).padStart(4,"0")}`, ...e, dealer_name: e.dealer_code?dealerName.get(e.dealer_code)??null:null, dealer_model: e.dealer_code?dealerModel.get(e.dealer_code)??null:null }));

console.log(`สร้าง sale_reps = ${reps.length} คน (จาก Master_Member CR#)`);
console.log(`  มี netsuite_id ${reps.filter(r=>r.netsuite_id).length} | ba_app ${reps.filter(r=>r.ba_app_id_1||r.ba_app_id_2).length} | di ${reps.filter(r=>r.di_id).length}`);
console.log(`  ตัวอย่าง:`, reps.slice(0,3).map(r=>`${r.rep_code}=${r.cr_code}/${r.name}/ร้าน ${r.dealer_code}`));

if(!APPLY){ console.log("\n(DRY RUN) เพิ่ม --apply เพื่อเขียน sale_reps"); process.exit(0); }

console.log("\nAPPLY: ล้าง sale_reps แล้ว insert...");
{ const {error}=await sb.from("sale_reps").delete().neq("rep_code",""); if(error){console.error(error.message);process.exit(1);} }
const CHUNK=500; let done=0;
for(let i=0;i<reps.length;i+=CHUNK){ const {error}=await sb.from("sale_reps").insert(reps.slice(i,i+CHUNK)); if(error){console.error(error.message);process.exit(1);} done+=Math.min(CHUNK,reps.length-i); process.stdout.write(`\r  insert ${done}/${reps.length}`); }
console.log(`\nDONE sale_reps=${reps.length}`);
