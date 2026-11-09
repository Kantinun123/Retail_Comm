---
inclusion: always
---

# Development Guidelines: Lessons Learned

> **Purpose**: Actionable guidelines to follow during implementation to avoid common errors and maximize efficiency.

---

## 🚀 PERFORMANCE RULES (Follow Every Time)

### Rule 1: ALWAYS Execute Tools in Parallel
**Before every tool invocation, ask: "Can these run in parallel?"**

```typescript
// ❌ SLOW - Sequential tool calls
readFile("file1.ts")
readFile("file2.ts")

// ✅ FAST - Parallel tool calls in a single turn
```

**Impact**: 5-10x faster execution

### Rule 2: Trust Context - Don't Re-Read
**Read once, trust the result. Only re-read on actual errors.**

```typescript
// ❌ SLOW - Re-reading unnecessarily
readFile("App.tsx")
// ... make edit ...
readFile("App.tsx") // Wasteful re-read

// ✅ FAST - Read once, apply edit, trust the result
```

### Rule 3: Verify Once at the End
**Make all changes first, then run build or check once.**

```bash
# ❌ SLOW - Verify after each single edit
# Edit 1 → pnpm build
# Edit 2 → pnpm build

# ✅ FAST - Complete edits, then verify once
# Edit 1, 2, 3 → pnpm build
```

### Rule 4: Use Line Ranges and Search
**Don't read entire large files when you need specific sections.**

```typescript
// ❌ SLOW - Read 500 lines to check one function
readFile("large_file.ts")

// ✅ FAST - Search first, then read targeted range
grepSearch(query="functionName", includePattern="**/*.ts")
readFile("large_file.ts", startLine=100, endLine=120)
```

---

## 🐛 COMMON ERRORS & RECOVERIES

### TypeScript & React Guidelines

**React Named Imports**
```typescript
// ✅ Named imports (React 17+)
import { useState, useEffect } from 'react'

// ❌ Avoid default React import unless needed
import React from 'react'
```

**Null Safety**
```typescript
// ✅ Use optional chaining and nullish coalescing
const name = user?.name ?? 'Unknown'
```

---

### Tailwind CSS 4 & Font Loading

**Avoid `@import url()` in CSS Files**
```css
/* ❌ FAILS - Tailwind CSS 4 strips external @import url() in CSS */
@import "tailwindcss";
@import url('https://fonts.googleapis.com/...');

/* ✅ Load Google Fonts via <link> tags in layout.tsx */
```

```tsx
// src/app/layout.tsx
<html lang="en">
  <head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet" />
  </head>
  ...
</html>
```

**Recovery**: Always load Google Fonts using `<link>` tags inside `layout.tsx` when working with Tailwind CSS 4.

---

### Large Component Editing

**Incremental Append Corruption**
```
# ❌ FAILS - Modifying a 500+ line TSX file via many small append calls
# Result: Duplicated functions, misaligned JSX, syntax errors

# ✅ Replace targeted sections cleanly with context or rewrite large files in structured chunks
```

**Recovery**: When editing large single-file components (>200 lines), make precise replacements including surrounding line context. If errors occur, rewrite the file in a single structured operation.

---

## 🔧 QUICK COMMANDS

```bash
pnpm dev       # Start development server
pnpm build     # Verify TypeScript & Next.js production build
pnpm lint      # Run ESLint validation
```

---

## 📋 DEVELOPMENT CHECKLIST

- [ ] Execute independent tools in parallel.
- [ ] Read files once and trust edit operations.
- [ ] Use line ranges or grep search for quick navigation.
- [ ] Verify build cleanly with `pnpm build` at the end of feature implementation.


---

## 🧾 Session Log: Porting commission-app (static HTML) → Next.js

### Encoding: preserve Thai (UTF-8) when extracting data via PowerShell
```
# ❌ FAILS - Set-Content default encoding mangled Thai into mojibake (เธ...)
Set-Content -Path out.ts -Value $data -Encoding UTF8   # still added BOM / wrong page

# ✅ Use .NET UTF8Encoding($false) for both read and write
$utf8 = New-Object System.Text.UTF8Encoding($false)
$c = [System.IO.File]::ReadAllText($path, $utf8)
[System.IO.File]::WriteAllText($out, $content, $utf8)
```
**Recovery**: When copying Thai/Unicode data literals out of source files, always read AND write with `System.Text.UTF8Encoding($false)`.

### Type exports: import types from where they are declared
- `MonthBucket`, `GroupAgg`, `SolutionAgg` were declared in `logic.ts`, not `types.ts`.
- **Recovery**: `import { fn, type TypeName } from "./logic"` — don't assume all types live in `types.ts`.

### sessionStorage in React 19: use useSyncExternalStore, not setState-in-effect
```
// ❌ ESLint error react-hooks/set-state-in-effect (cascading renders)
useEffect(() => { setSession(readSession()); setReady(true); }, []);

// ✅ External store pattern for sessionStorage-backed state
const session = useSyncExternalStore(subscribe, getSnapshot, () => null);
// getServerSnapshot returns null so `ready = session !== null` guards SSR/hydration
```
**Recovery**: For any browser-only external store (sessionStorage/localStorage), read via `useSyncExternalStore` with a server snapshot of `null`.

### Toolchain: pnpm not on PATH on Windows
```
corepack enable
corepack prepare pnpm@latest --activate   # then `pnpm install` / `pnpm build`
```

### Environment note
- `pnpm dev` may report "Another next dev server is already running" on port 3000; a server can already be up. Verify against the existing server instead of forcing a new one.

---

## 🔐 Supabase RLS vs Session Model (Phase ง)

**อาการ**: ย้าย data layer ให้ hydrate จาก Supabase ฝั่ง client แล้วข้อมูลว่าง (ทุก query คืน `[]` แม้ตารางมีข้อมูล)

**สาเหตุ**: ตารางเปิด RLS policy เป็น `to authenticated` (เฉพาะผู้ล็อกอินผ่าน Supabase Auth) แต่แอปนี้ล็อกอินด้วย `sessionStorage` (dropdown role แบบ MVP) ไม่ใช่ Supabase Auth จริง → browser client เป็น `anon` → RLS บล็อก คืน 0 แถว (status ยังเป็น 200 ทำให้เข้าใจผิดว่าสำเร็จ)

**วิธีเช็คเร็ว**: ยิง REST ตรงด้วย publishable (anon) key:
```
Invoke-WebRequest "$url/rest/v1/<table>?select=*&limit=1" -Headers @{ apikey=$key; Authorization="Bearer $key" }
```
ถ้า body = `[]` ทั้งที่มีข้อมูล = RLS บล็อก anon

**ทางแก้ (เลือกตามบริบท)**:
- ปลอดภัยสุด: เชื่อม Supabase Auth จริงก่อน แล้วค่อยเปิด client-side hydration (เลือกทางนี้ — เก็บโค้ด hydration ไว้แบบ dormant)
- เดโมเร็ว: เพิ่ม policy `to anon` สำหรับ SELECT (⚠️ ข้อมูลกลายเป็น public เพราะ publishable key เปิดเผยฝั่ง client)
- กลาง: ดึงผ่าน server action/route ด้วย service role (bypass RLS) ไม่เปิด anon

**บทเรียน**: ก่อนออกแบบ client-side fetch จาก Supabase ให้เช็คก่อนว่า auth model ของแอปตรงกับ RLS policy หรือไม่ — session แบบ custom (sessionStorage) ไม่ทำให้ Supabase client เป็น authenticated

---

## 🔐 SECURITY DEFINER function ที่ใช้ใน RLS ต้อง GRANT EXECUTE (Auth เฟส 2)

**อาการ**: หลัง `revoke execute ... from anon, authenticated` บน helper functions ที่ใช้ใน RLS policy → ทุก query พังด้วย `permission denied for function my_emp_id` (code 42501)

**สาเหตุ**: RLS policy เรียก helper function (เช่น `my_emp_id()`, `is_admin()`) ตอนประเมินสิทธิ์ — caller (anon/authenticated) ต้องมี **EXECUTE** ถึงจะเรียกได้ แม้ function เป็น `SECURITY DEFINER` ก็ตาม (definer เปลี่ยนแค่ "บริบทตอนรัน" ไม่ใช่ "สิทธิ์เรียก")

**วิธีแก้**: `grant execute on function ... to anon, authenticated` — ต้องให้ role ที่อยู่ใน policy เรียก function ได้เสมอ

**หมายเหตุ advisor**: Supabase advisor จะเตือน WARN `anon/authenticated_security_definer_function_executable` สำหรับ helper เหล่านี้ — เป็น WARN ที่ยอมรับได้ (functions จำเป็นต้อง callable เพื่อให้ RLS ทำงาน) ไม่ใช่ ERROR อย่าไป revoke execute ออกเพื่อปิด warning เพราะจะทำ RLS พัง

**ทางเลือกถ้าอยากปิด warning จริง ๆ**: inline logic ใน policy (ไม่ใช้ function) หรือย้าย helper ไป schema ที่ไม่ expose ผ่าน PostgREST (เช่น schema `private`)

---

### Next.js 16 cacheComponents: ห้าม `export const dynamic` ใน Route Handler

```ts
// ❌ FAILS — build error: "Route segment config 'dynamic' is not compatible with nextConfig.cacheComponents"
export const dynamic = "force-dynamic";

// ✅ ลบออก — route handler ที่อ่าน query string / cookies / request body
//    ถูก Next.js ถือเป็น dynamic โดยอัตโนมัติอยู่แล้ว ไม่ต้องประกาศ
```

**สาเหตุ**: โปรเจคเปิด `cacheComponents` ใน `next.config.ts` ซึ่ง incompatible กับ route segment config `dynamic` (เหมือนกรณี page ที่ต้องใช้ `export const instant = false` + `<Suspense>` แทน `force-static`).

**Recovery**: เอา `export const dynamic = ...` ออกจาก route handler ทั้งหมด. ถ้าต้องการบังคับ dynamic ให้พึ่งพฤติกรรมอัตโนมัติ (อ่าน `req.nextUrl.searchParams` / `cookies()` / `req.json()` ก็เพียงพอ).

---

## 🐛 Store-Eval Sub-Items: ต้องเก็บทุกคน (People categories ประเมินรายบุคคล)

**อาการ**: modal "คะแนนรายด้าน" แสดงข้อย่อยเป็น ✓ ครบทุกข้อ ทั้งที่คะแนนหมวดไม่เต็ม (เช่น "ทักษะพนักงานขาย 27.5/35")

**สาเหตุ**: หมวด People (s4_staff, s5_estimate, s6_sales) ในชีตประเมินแยกเป็นรายคน (คนที่ 1/2/3 คนละชุดคอลัมน์) แต่ import เดิมเก็บเฉพาะคนที่ 1 ซึ่งผ่านครบ → คนที่ 2 ที่ตกบางข้อหายไป ทำให้ผลรวมหมวดไม่ตรงกับข้อย่อยที่แสดง

**วิธีแก้**:
1. เพิ่มคอลัมน์ `staff_no` ใน `store_eval_items` (null = หมวดร้าน/Physical, 1/2/3 = พนักงานคนที่ N)
2. แก้ `scripts/import-eval-items.mjs`: แยก PHYSICAL (staff_no=null) กับ PEOPLE (วน person 1/2/3 ตาม column group, ข้ามคนที่ทุกคอลัมน์ว่าง)
3. RPC `store_eval_items` คืน `staff_no` + `order by category_key, staff_no nulls first, item_no`
4. store client: เพิ่ม `staffNo` ใน `EvalItem`; UI `CategoryRow` จัดกลุ่มด้วย `groupByStaff()` แล้วแสดงหัวข้อ "พนักงานคนที่ N" + จำนวนข้อที่ตกต่อคน

**บทเรียน**: ก่อน import ข้อมูลแบบตรวจที่มีหลาย entity (เช่นหลายคน/หลายรายการต่อ 1 submission) ให้ตรวจ layout คอลัมน์ว่ามีการซ้ำกลุ่มต่อ entity หรือไม่ อย่าเก็บแค่ entity แรก

---

## 🧭 Cust. Sat.: ไม่มีคอมเมนต์แยกรายด้าน + กรอง insight ด้วยคะแนน < 7

**บริบท**: ผู้ใช้ขอให้ "เมื่อหัวข้อใดต่ำกว่า 7 ให้แสดงคอมเมนต์ว่าเรื่องอะไร" แต่ `cust_sat_lines` มีคอมเมนต์แค่ 2 ช่องต่อรีวิว (impress_text/improve_text) เป็นความเห็นรวมของทั้งรีวิว **ไม่มีคอมเมนต์ผูกกับด้านที่ได้คะแนนต่ำ** (sheet DATA คอลัมน์ 10-13,15,17 เป็นตัวเลขล้วน; คอมเมนต์อยู่ col 18-19)

**วิธีแก้ (ทำได้จริงตามข้อมูล)**:
1. MonthDetailModal: ด้านที่คะแนนเฉลี่ย < 7 แสดงแดง + ป้าย "ต้องปรับปรุง"
2. เพิ่มปุ่ม "ดูรีวิวของด้านที่คะแนนต่ำ" ใน modal → เปิด ReviewsModal พร้อม filter "low" (lowCats ไม่ว่าง) เพื่อให้อ่าน improve_text เป็นบริบท
3. ReviewsModal: แต่ละรีวิวแสดง chip ด้านที่ < 7 (lowCats) ที่คำนวณฝั่ง client จาก q_* ที่ RPC ส่งมา
4. insight band: กรอง improve_text เฉพาะรีวิวที่ `least(q_welcome..q_refer) < 7` + เพิ่มฟิลด์ `insight_total` แยกจาก `improve_total`

**Data note**: ไฟล์ "Cus Sat - Housing Expert & SCG HOME.xlsx" ให้ใช้ **เฉพาะ sheet DATA** (2,536 แถว) — sheet "Cus Sat - New" เป็น subset ที่รวมอยู่ใน DATA แล้ว (เดิม import รวมทั้งสองทำให้ซ้ำ 300 แถว) ลบ block การอ่าน "Cus Sat - New" ออกจาก import-cust-sat.mjs

**บทเรียน**: เมื่อผู้ใช้ขอฟีเจอร์ที่ data ไม่รองรับตรงๆ ให้ตรวจ schema ก่อน แล้วเสนอทางเลือกที่ data รองรับ (ไฮไลต์ + ลิงก์ไปบริบท + กรอง) แทนการ fabricate การ map ที่ไม่มีจริง

---

## 💰 Service Sales (ยอดขายงานบริการ) — win_contract_all.xlsx

**ไฟล์**: `commission-app/ยอดขายทั้งหมด/ยอดขายงานบริการ LHS_Rudy ร้านค้า/win_contract_all.xlsx` (Sheet1, 38,917 แถว, 103 คอลัมน์)

**ข้อควรรู้เรื่องการ map ร้าน**:
- **อย่าใช้ BPNO** เป็นรหัสร้าน — 90% เป็น "None" ไม่ผูกร้าน
- รหัสร้านจริงได้จาก `rept_gp_shopgroup` → map กับ `Master_Dealer.csv` (normalize ชื่อ, เหมือน `import-lhs-purchase-discount.mjs`)
- ยอดที่ map เข้าร้าน dealer ได้ = ~23% (9,188 แถว) ที่เหลือเป็น shopgroup อื่น (Onetime, SCG Home, บริษัทติดตั้ง) → เก็บเป็น `dealer_code = null` ให้ admin เห็นเป็น "ไม่ระบุร้าน"

**ยอดขาย**: `plan_amount_incl_vat` (รวม VAT), ใช้ทุกสถานะ (ไฟล์เป็น win ทั้งหมด)

**period**: จาก `project_close_date` (serial → YYYY-MM) ข้ามแถวที่ไม่มีวันปิด (381 แถว)

**3-group rollup** (จาก hierarchy H3/H5):
- SMART SOLUTION = H3 ∈ {AIR SOLUTION, SOLAR ROOF, HOME AUTOMATION, CEILING & WALL PERFORMANCE}
- Qchang = H3=HOME RENOVATION SYSTEM หรือ H5 ∈ {ROOF REPAIR, REROOF, ROOF REPAINT, ROOF RENEW, TOP UP ROOF}
- ROOF SERVICE = H3 ∈ {ROOF SYSTEM, METAL ROOF} (ที่เหลือ)
- sub_group: ROOF/SMART ใช้ H4, Qchang ใช้ H5

**Scope ใน RPC**: `p_dealer null` = admin (รวมทุกแถว incl. unmapped) ; `code` = เฉพาะ `dealer_code = code` (dealer เห็นเฉพาะร้านตัวเอง, ไม่เห็น unmapped)

**ของที่สร้าง**: ตาราง `service_sales_lines` + `import-service-sales.mjs` + RPC `service_sales_summary`/`service_sales_groups` + `/api/service-sales` + `service-sales-store.ts` + `service-sales-screen.tsx` (hero + YearChips + 3-group accordion) + page `/app/service-sales` + หัวข้อ "ยอดขาย" ในหน้าหลัก + nav admin

---

## 🔄 Dev server 404 ทุกหน้า หลังสลับ build/dev (Turbopack cache เพี้ยน)

**อาการ**: หลังรัน `pnpm build` แล้ว restart `pnpm dev` → ทุกหน้า (รวมหน้าที่มีมานาน เช่น /app/home) ตอบ 404 ทั้งที่ไฟล์ route มีจริงและ build ผ่าน

**สาเหตุ**: `pnpm build` กับ `pnpm dev` (Turbopack) ใช้ cache ใน `.next` คนละชุด สลับกันไปมาทำให้ manifest เพี้ยน

**วิธีแก้**: หยุด dev server → `Remove-Item -Recurse -Force .next` → เปิด `pnpm dev` ใหม่ (ยืนยันด้วยการยิง request เห็น 200)

**ป้องกัน**: หลังตรวจ build เสร็จ ถ้าจะ restart dev อยู่เรื่อยๆ ควรเลี่ยงการ build ทับ dev หรือ clear `.next` ก่อนเปิด dev

---

## 📊 BA Service Sales — Pending B2C Offline.xlsx (แหล่งที่ 2 ของยอดขายงานบริการ)

**ไฟล์**: `commission-app/ยอดขายทั้งหมด/ยอดขายงานบริการ BA ร้านค้า/Pending B2C Offline.xlsx` sheet "raw data" (7,867 แถว)

**ข้อควรรู้**:
- **job_id ซ้ำ 76 กลุ่ม** (เนื้อหาเหมือนกันทุกช่อง) → ต้อง dedupe ด้วย `job_id` ก่อนสรุปยอด (ไม่ใช่ `job_code` เพราะ 1 job_code มีได้ทั้งแถว S และ I)
- **type_of_job**: `S` = สำรวจหน้างาน (survey), `I` = ติดตั้งหน้างาน (installation) — ตามคำสั่งผู้ใช้ **รวมทั้ง S และ I เป็นยอดขาย** (S มักมี gmv เป็นค่าสำรวจหลักร้อย/พัน แต่ก็ถือเป็นยอดขาย)
- **ยอด** = `gmv`, สถานะ = `sale_status = win`, period จาก `win_date`
- **map ร้าน 2 ชั้น**: (1) ใช้ `dealer_code` ที่ติดมาในไฟล์ตรง ๆ ก่อน (เช็คกับตาราง `dealers` จริงใน Supabase — ตรงเกือบ 100%) (2) ถ้าไม่มี ลอง map `store_name` ผ่าน `Dealer Name_BA App_1-4` ใน Master_Dealer.csv (3) map ไม่ได้ → `dealer_code = null` เก็บไว้ให้ admin เห็น "ไม่ระบุร้าน" (ส่วนใหญ่เป็นชื่อ Q-CHANG/GT ที่ไม่ตรง format)
- **ไม่ซ้ำกับไฟล์ Rudy** (win_contract_all.xlsx) — ตรวจด้วย job_code และยอดเงินที่มีเศษสตางค์ ไม่พบ overlap นัย่สำคัญ → เป็นแหล่งข้อมูลคนละชุดจริง

**สถาปัตยกรรมรวม 2 แหล่ง**: สร้าง view `service_sales_union` (security_invoker, revoke anon/authenticated) รวม `service_sales_lines` (source='rudy') + `ba_service_sales_lines` (source='ba') คอลัมน์ให้ตรงกัน แล้ว RPC ทุกตัว (`service_sales_summary/groups/month_groups/jobs`) เพิ่ม param `p_source` (null = รวมทั้งคู่) อ่านจาก view นี้แทนตารางเดิมตรง ๆ — ทำให้ของเดิม (`/app/service-sales`) ใช้งานต่อได้แบบไม่พังพร้อมรวมแหล่งใหม่เข้าไปอัตโนมัติ

**UI**: หน้ารวม `/app/service-sales` (source=null) มีการ์ดย่อย 2 ใบแยกไปหน้า `/app/service-sales/lhs` และ `/app/service-sales/ba` (คนละ URL แต่ใช้ component เดียวกันผ่าน prop `source`) หน้าแรกก็เหมือนกัน: กล่องรวม + การ์ดย่อย 2 ใบ

---

## 🔁 อัปเดตไฟล์ LHS Commission (Housing Expert) — ขั้นตอนอัปเดตข้อมูลรอบถัดไป

**หลักการ**: ผู้ใช้วางไฟล์ใหม่ (ชื่อใหม่) ในโฟลเดอร์เดิมแล้วแจ้ง → เทียบกับไฟล์เดิม → dry-run → apply (ไม่วางทับชื่อเดิม)

**ความเสี่ยงที่เจอ (อย่าพลาดซ้ำ)**:
1. `lhs_commission_lines` ถูกเขียนจาก 2 สคริปต์: `import-lhs-commission.mjs` (Housing Expert) และ `import-lhs-scghome.mjs` (SCG Home, **append**) — สคริปต์เดิมล้างทั้งตารางด้วย `delete().neq("id",0)` ซึ่ง **จะลบแถว SCG Home ทิ้งไปด้วย** → แก้เป็นลบเฉพาะ `source_file` ของ Housing Expert (`.in("source_file",[OLD_CSV, NEW_XLSX])`)
2. `rep_code` ไม่ได้มาจากไฟล์ แต่ถูกเติมภายหลังด้วย `backfill-rep-code.mjs` (vendor_code -> sale_reps.netsuite_id) → หลัง re-import ต้องรัน `node scripts/backfill-rep-code.mjs` ทุกครั้ง ไม่งั้นหน้าพนักงานรายคน (`p_rep`) ว่างเปล่า
3. ไฟล์ CSV เดิมมีแถว placeholder (มีแค่ Year/Month ไม่มี order_number) ของ ต.ค./พ.ย./ธ.ค. เดือนละ 100 แถว ถูกนำเข้าเป็นแถวว่าง 300 แถว → สคริปต์ใหม่ข้ามแถวที่ไม่มี order_number (RPC กรอง dealer_code is not null อยู่แล้ว หน้าจอจึงไม่เปลี่ยน)

**ไฟล์ใหม่ (summaryData_HousingExpert_2026 (1).xlsx)**: อ่านชีต `summarry_HEcommission`; วันที่เป็น Excel serial (ไม่ใช่ d/m/yyyy แล้ว); มีคอลัมน์ใหม่ `Dealer Code` (เช่น "0005100071" ตัด 0 นำหน้า) ใช้ map ร้านก่อนชื่อร้าน — ตรง dealers ใน Supabase 100% และไม่ขัดแย้งกับ map ด้วยชื่อ; เป็นข้อมูลสะสม (ครอบคลุมของเดิม 100 order_number, ยอด commission ไม่เปลี่ยน) + ต.ค. เพิ่ม 49 แถว

**ผล**: HE 149 แถว commission 287,984.14 + SCG Home 20 แถว 21,669.75 = 309,653.89 (ตรงกับ `lhs_commission_summary`); rep_code เติมได้ 147/149 (เหลือ V041942, V070278 ที่ไม่อยู่ใน sale_reps)


---

## 👁 Admin "ดูในมุมมอง" ร้านค้า/พนักงาน (view-as) + ตัวกรองประเภท/ภาค

**แนวคิด**: admin ดูหน้าเหมือนบัญชีร้านค้า (`/app/home`) หรือพนักงาน (`/app/home-staff`) โดยไม่ต้องสลับบัญชี ใช้กลไก scope เดิม (dealerCode / repCode) ที่หน้าจอรองรับอยู่แล้ว

**session (client-only, เหมือน storeFilter)**: เพิ่ม `adminViewMode` ('admin'|'store'|'staff'), `adminViewDealer`, `adminViewRep`, `adminViewRepName` + setters `enterStoreView/enterStaffView/exitAdminView` ใน `session.ts` — ล้างทั้งตอน login และ logout

**การเชื่อม 3 หน้า**:
- `view-mode-bar.tsx` โผล่เฉพาะ admin บน dashboard/home/home-staff; กรองร้าน ประเภท(model)→ภาค(region)→ร้าน แล้วเลือกระดับ ทั้งร้าน/รายพนักงาน
- **ผูกกับ storeFilter**: แถบใช้ `storeFilter` เป็นค่าตั้งต้น และตอนเลือกร้านในแถบก็ `setStoreFilter` ด้วย → ช่องเลือกร้านที่เดียว ไม่ซ้ำซ้อน (storeFilter เดิมคงไว้ ทำหน้าที่ขอบเขตของตาราง/ภาพรวม admin)
- `home-hub-screen` / `home-staff-hub-screen`: ยอมให้ admin render เมื่ออยู่ในมุมมอง (เดิม redirect ออก) + resolve dealerCode/repCode จาก adminView* + แถบ "กำลังดูมุมมอง…"
- `bottom-nav`: admin ในมุมมอง store/staff เมนูล่างเปลี่ยนเป็นแบบ role ที่ดู (หน้าหลัก+สอบถาม)

**ข้อมูล**: เพิ่มคอลัมน์ `region`/`province` ใน `dealers` + `sync-dealer-region.mjs` (จับ Dealer Code กับ Master_Dealer) — 65/68 ร้าน map ได้ 8 ภาค; 3 ร้านที่เพิ่มเองไม่มีใน Master (region ว่าง); `Dealer` type ใน client ตั้ง region/province เป็น optional เพราะ static fallback (raw-data.ts) ไม่มี

**หมายเหตุ dashboard hub-header (ข้อ 3)**: ไม่ได้ยกเครื่อง เพราะ hero เดิมของ dashboard แสดง commission/sales/paid-pending ครบอยู่แล้ว การเพิ่มการ์ด hub จะซ้ำข้อมูล — เลือกคงโครงเดิมไว้ ความสอดคล้องได้จากแถบมุมมอง + one-tap เข้า Hub จริง


---

## 🏠 Admin ใช้ Hub ร่วมกับร้านค้า (เลิกใช้หน้า dashboard วิเคราะห์เป็นหน้าแรก)

**เหตุผล**: dashboard เดิมเปิดมาคำนวณงานทุกแถวทั้งระบบ → หนัก + รก ; เปลี่ยนให้ admin เปิดมาเจอ Hub (`/app/home`) แบบ "ทุกร้าน" ซึ่งดึงแค่ยอดสรุป (summary API, dealerCode=null) → เบากว่ามาก และหน้าตาสอดคล้องกับ dealer/sales

**ยืนยันแล้ว**: summary API ทุกตัว (back-margin / ba-profit-share / service-sales / store-eval / cust-sat / commission / lhs / ba) คืนยอด "รวมทุกร้าน" เมื่อ dealerCode ว่าง → Hub ใช้ fetch ชุดเดิมได้เลย ไม่ต้องแก้ API

**การเปลี่ยน**:
- `home-hub-screen`: admin ไม่ redirect ไป dashboard แล้ว ; dealerCode = storeFilter (null=ทุกร้าน) หรือ adminViewDealer เมื่ออยู่ในมุมมองร้าน ; Back Margin/LHS Discount แสดงเมื่อ admin ดูทุกร้าน (adminAllStores) หรือร้าน HE
- เพิ่มการ์ด "เครื่องมือผู้ดูแล" บน Hub (staff-incentive, database, redemptions, points) เพราะเมนูล่าง admin ถูกย่อ
- `bottom-nav`: admin เมนูล่าง = หน้าหลัก + สอบถาม (+ กระดิ่ง + ฉัน เหมือน dealer) — เมนูจัดการย้ายไปการ์ด
- `useHomeHref()` + login-screen + exitAdminView → admin ไป `/app/home` (ไม่ใช่ /app/dashboard)
- **หน้า dashboard เดิมไม่ลบ** (route ยังอยู่ กันพัง) แค่ไม่ใช้เป็นหน้าแรก — ถ้าอยากกลับมาใช้ภายหลังได้

**ยังไม่ทำ (รอตัดสินใจ)**: ยัง ไม่ได้ commit ; ยังไม่ได้ลบ/ซ่อน route /app/dashboard อย่างเป็นทางการ


---

## 🧭 หน้าแรก admin = การ์ด launcher (ไม่ดึงตัวเลข เบาสุด)

**โครง**: `/app/home` แยก component ตาม role ผ่าน `home-router.tsx`:
- admin (ไม่อยู่ในมุมมองร้าน) → `admin-home-screen.tsx` (การ์ด launcher 4 ใบ ไม่ fetch ตัวเลข)
- admin กำลังดูมุมมองร้าน (adminViewMode=store) หรือ dealer → `home-hub-screen.tsx`
- sales → HomeHubScreen redirect ไป /app/home-staff

**4 การ์ด** แบ่ง 2 กลุ่ม: ดูข้อมูล (มุมมองร้านค้า / มุมมองพนักงาน — กดแล้ว picker โผล่ในหน้าเดียวกัน) + จัดการระบบ (ฐานข้อมูล / อนุมัติแลกของรางวัล). เอาออกตามที่ผู้ใช้สั่ง: staff-incentive, points (route ยังอยู่)

**ค้นหาร้านแบบพิมพ์ได้**: ดึง combobox จาก login-screen มาเป็น component กลาง `searchable-select.tsx` (`SearchableSelect` + `ComboOption`) ใช้ทั้ง picker ร้านและพนักงาน (กรองด้วย label/sub/value, cap 80 รายการ). ตัวกรองประเภท/ภาคเป็น native select, ส่วนร้าน/พนักงานเป็น SearchableSelect

**picker flow**: มุมมองร้านค้า = เลือกร้าน → `enterStoreView` → /app/home (HomeHubScreen store view) ; มุมมองพนักงาน = เลือกร้าน → โหลด sale_reps → เลือกคน → `enterStaffView` → /app/home-staff

**หมายเหตุ**: ควรรีสตาร์ท dev process ใหม่ (ไม่ reuse) หลังสลับ branch/แก้ไฟล์เยอะ ไม่งั้น Turbopack อาจค้าง module เก่า (เคยเจอ error หา dealer-login-form ไม่เจอทั้งที่ลบแล้ว)

---

## 👥 Store & Employee Master (ฐานข้อมูลร้าน+พนักงาน) — Phase 1

**เป้าหมาย**: ทำ `sale_reps` ให้เป็น employee master เต็มตัว + 2 View (Store Roster การ์ดรูป / Org Chart) + admin CRUD + อัปโหลดรูป โดยใช้เป็นแกน map ยอดขาย/ผลประโยชน์

**ตัดสินใจเชิงออกแบบ**:
- ไม่สร้างตารางพนักงานใหม่ — ขยาย `sale_reps` (มี netsuite_id/ba_app_id/di_id ที่ `backfill-rep-code.mjs` ใช้ map ยอดอยู่แล้ว ถ้าสร้างใหม่ต้องรื้อ RPC+backfill ทั้งหมด)
- `position` (store_exec/area_mng/coach/se/sale_floor) กับ `level` (B=Beginner1 / S=Standard2 / A=Advance3) แยกมิติกัน
- หัวหน้า (area/coach) ดูแลหลายร้าน → ตารางเชื่อม many-to-many `rep_store_assignments` (มี effective_from/to เผื่ออนาคต แต่ phase 1 ใช้แค่ปัจจุบัน)
- ไม่ลบจริง → `is_active=false`
- `employees` เดโมเก่า (187 แถว) ไม่แตะ (กันหน้าเดโมเกมพัง)

**DDL gotcha**: `position` เป็น reserved keyword ใน `RETURNS TABLE (...)` ของ Postgres → ต้อง quote `"position"`/`"level"` ทั้งใน column list และ ORDER BY ไม่งั้น `42601 syntax error at or near "position"`

**RLS**: ตารางเดิมใช้ helper fn (`is_admin()`, `my_dealer_code()`, `my_role()`, `is_anon_demo()`, `my_emp_id()`) ไม่ใช่แค่ `to authenticated` — ตารางใหม่ต้อง mirror pattern นี้ (ดู `read sale_reps scoped`). RPC อ่านหลักยังผ่าน server service-role (bypass RLS) อยู่แล้ว RLS รอบนี้แค่กัน client อ่านข้ามร้าน

**Supabase Storage (ครั้งแรกของโปรเจค)**: เดิมไม่มีโค้ด storage เลย (grep `storage.from`/`.upload`/`getPublicUrl` = 0) — avatars เดิมเป็น base64 data URL ใน localStorage. Phase นี้สร้าง bucket `employee-photos` (public read, 5MB, image mime) + อัปโหลดผ่าน **server route service-role** (ไม่ใช่ browser client) เพราะ login เป็น sessionStorage ไม่ใช่ Supabase Auth จริง → browser client เป็น anon เขียน Storage ไม่ได้. path คงที่ `{repCode}.{ext}` + upsert + cache-bust `?v=timestamp`

**ของที่สร้าง**:
- DB: ALTER `dealers`(+logo_url,is_active) / `sale_reps`(+position,level,photo_url,line_id,birth_date,start_date,skills[],notes,is_active) ; ตาราง `rep_positions`,`rep_store_assignments` ; RPC `store_list_with_counts()`,`store_roster(p_dealer)` ; bucket `employee-photos`
- API: `/api/employees` (GET stores/roster), `/api/employees/admin` (POST/PATCH gen SR####), `/api/employees/admin/photo` (upload)
- Store: `src/lib/commission/employee-store.ts` (POSITION_LABEL/SHORT, LEVEL_META, isNewEmployee ≤90วัน)
- UI: `store-roster-screen.tsx` (View B การ์ดรูป), `employee-admin-screen.tsx` (CRUD+อัปรูป) + pages `/app/store-roster`,`/app/employee-admin` + launcher cards ใน admin-home
- Phase 2 (ยังไม่ทำ): Org Chart view + Excel bulk import + script `import-employees.mjs`

**Build verify gotcha (Windows PowerShell)**: `pnpm build` ของ Next.js พ่นตัวอักษรกล่อง (box-drawing) ทาง stderr ทำให้ PowerShell โยน `NativeCommandError` + exit 1 ทั้งที่ build สำเร็จ (เห็น "Compiled successfully" + "Finished TypeScript" + static 55/55). ยืนยันจริงด้วย `corepack pnpm build *> $null; "LASTEXITCODE=$LASTEXITCODE"` → ต้องได้ 0

---

## 👥 Employee Master Phase 1.1 — nickname / age / phone2 + import 2 ไฟล์

**เพิ่มฟิลด์**: `nickname`, `phone2` ใน `sale_reps` (อายุไม่เก็บ — คำนวณ `ageFromBirthDate()` จาก `birth_date` ตอนแสดงผล เพราะอายุเปลี่ยนทุกปี เก็บแล้ว outdated)

**DDL gotcha ซ้ำ**: เปลี่ยน RETURNS TABLE ของ RPC (เพิ่มคอลัมน์ nickname/phone2) → ต้อง `drop function ... first` ก่อน recreate (`42P13 cannot change return type`). ต้องแก้ทุกจุดที่ส่งต่อ field: supabase RPC + store type/RawEmployee/mapEmployee + EmployeeInput + API buildRow + ฟอร์ม(toForm/emptyForm/onSave) + การ์ด roster

**xlsx ใน ESM (Windows)**: `XLSX.readFile` ใช้ไม่ได้ (ไม่มีใน ESM build) → ต้อง `XLSX.read(readFileSync(path), { type: "buffer" })` เหมือน import scripts เดิม

**PowerShell อ่าน Thai จาก console ของ node**: ต้อง `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` ก่อนรัน ไม่งั้น Thai เพี้ยน (header อังกฤษยังอ่านได้ แต่ค่า Thai เป็น เธ...)

**Import ข้อมูลพนักงาน 2 ไฟล์** (`scripts/import-employee-data.mjs`, dry-run/apply):
- แหล่ง A = SE Monitor (`0.Store _ SE Data Monitor...xlsx` sheet `Store65_SE80_HS65_H15`): header อยู่ row index 1, data เริ่ม row 3 (row 2 เป็น sub-header merged). คอลัมน์: Dealer Code(0), SE ชื่อ(30), ชื่อเล่น(31), Tel(32), วันที่เข้างาน serial(41), **Level 2025 ประเมิน(47)** = Competency grade → map `Begin`→B `Standard`→S `Advance`→A, `N/A`/ว่าง→null. เป็น SE ทั้ง sheet → สร้างใหม่ตั้ง `position='se'`
- แหล่ง B = Training Reward (`20261022_SCG Training Reward Points.xlsx` sheet `members`, 510 แถว): First/Last name, Phone number, `Date of Birth (dd-mm-yyyy)`(col7), `ชื่อไลน์ตัวเอง`(col19). **ไม่มี dealer code ที่เชื่อถือได้** → ใช้เติม field เท่านั้น ไม่สร้างใหม่. 1 คนมีหลายแถว = หลายเบอร์ → dedup เบอร์แล้วใส่ phone(เบอร์แรก)/phone2(เบอร์ที่ต่าง)
- **match ด้วยชื่อ** normalize = ตัดคำนำหน้า (นาย/นาง/นางสาว/น.ส./คุณ) + ตัดช่องว่างทั้งหมด + lowercase → SE Monitor match 79/118, Reward match 83/489
- **กฎทับข้อมูล**: เติมเฉพาะช่องว่างใน DB (`queuePatch` ข้ามถ้า field มีค่าแล้ว) ไม่ทับที่ admin กรอกเอง ; ลำดับแหล่ง level/start/nickname/phone←SE Monitor, birth/line←Reward
- **sanity วันเกิด**: Excel/ไฟล์กรอกผิดทำให้ได้ birth_date ปี 2015 (อายุ 11) → `dmyToIso` กรองอายุนอกช่วง 15-70 ปีทิ้ง (คืน null)
- **Excel serial → date**: `new Date(Math.round((n-25569)*86400*1000))` ; เบอร์ที่ xlsx ตัด 0 นำหน้า (9 หลัก) → เติม "0"
- **ผล**: sale_reps 189→223 (สร้างใหม่ 34 SE) ; อัปเดต 95 คน (nickname 71, level 52, start 67, birth 76, line 82, phone 15, phone2 3) ; level dist A16/B9/S43 ตรงไฟล์

**หมายเหตุ map ยอด**: พนักงานสร้างใหม่ 34 คนยังไม่มี netsuite_id/ba_app_id → ยัง map ยอดขายไม่ได้จนกว่าจะเติมรหัสระบบ (เป็นแค่ข้อมูล roster/ทีมงานก่อน)

---

## 👥 Employee Phase 1.2 — StorePicker, อายุงาน, สถานะ Active/Non-active, ย้ายร้าน

**StorePicker (component กลาง)**: `store-picker.tsx` chip ภาค + chip model + ช่องค้นหา ทำงาน AND, นับจำนวนบน chip (`countBy` เรียงมาก→น้อย ข้ามค่าว่าง), ปุ่มล้างตัวกรอง. ใช้ซ้ำทั้ง `store-roster-screen` + `employee-admin-screen` (ลบ picker ซ้ำออกจากทั้งคู่ เหลือ `<StorePicker>`). ทำ client ล้วน region/model มาจาก `fetchStores()` ไม่แตะ DB/API. ข้อมูลจริง: 8 ภาค (ใต้2/ตะวันออก 11, อีสาน2/นครหลวง 9, ตะวันตก 8, เหนือ/อีสาน1 7, ใต้1 3, ไม่มีภาค 3), model HE 49/SCG Home 19

**อายุงาน**: `tenureFromStartDate()` คำนวณ "X ปี Y เดือน" จาก `start_date` (คิดเดือนด้วย getMonth diff + ลบ 1 ถ้ายังไม่ถึงวันที่ของเดือน, <1 เดือน = "น้อยกว่า 1 เดือน", วันอนาคต = null). เหมือนอายุ/อายุ — คำนวณตอนแสดงผล ไม่เก็บ DB

**ลำดับแสดงวันเกิด/อายุ**: ผู้ใช้ขอให้วันเกิดขึ้นก่อน → "เกิด dd/mm/yyyy · อายุ N ปี" + เปลี่ยนเงื่อน render จาก `age !== null` เป็น `emp.birthDate` (แสดงวันเกิดได้แม้คำนวณอายุไม่ได้)

**สถานะ Active/Non-active + ย้ายร้าน (แบบ A — ไม่เก็บประวัติ)**:
- ใช้ `is_active` + `dealer_code` ที่มีอยู่แล้ว (API PATCH รองรับทั้งคู่) ไม่แตะ DB
- ฟอร์ม admin: dropdown "ร้านที่สังกัด (ย้ายร้าน)" เลือกร้านใหม่ → เปลี่ยน dealer_code ; toggle switch Active/Non-active (เห็นชัดกว่า checkbox เดิม) ; เตือน "จะย้ายเมื่อกดบันทึก" ถ้า dealerCode ต่างจากร้านเดิม (`currentDealerOf` อ่านจาก roster)
- onSave: detect `moved` (repCode เดิม + dealerCode เปลี่ยน) → หลังบันทึกปิดฟอร์ม + `fetchStores()` refresh empCount (คนย้ายออกจาก roster ร้านปัจจุบัน)
- รายการ admin: ตัวนับ "ทำงาน X · พักงาน Y" + ปุ่ม toggle แสดงทั้งหมด/เฉพาะทำงาน + ปุ่ม pill พักงาน/ทำงาน (toggle_on/off) + ป้าย Active/Non-active ในแต่ละแถว
- หน้า roster (ฝั่งดู): default **ซ่อน** inactive (`showInactive=false`), ตัวนับ "(N ทำงาน · M พักงาน)", ปุ่มแสดง/ซ่อนพักงาน (โผล่เฉพาะเมื่อ inactiveCount>0), `hasSE`/"ไม่มี SE" คิดจาก activeMembers เท่านั้น

**ประวัติย้ายร้าน (แบบ B)**: ยังไม่ทำ — ยอดขาย map ผ่าน rep_code (ตัวคน) ไม่ผูกร้านในประวัติ การย้ายร้านจึงกระทบแค่ "คนแสดงในร้านไหน" ไม่กระทบยอด. ถ้าต้องการยอดย้อนหลังตามร้าน ณ เวลานั้น ค่อยทำ effective_from/to ใน rep_store_assignments + รื้อ RPC commission

---

## 🏪 จัดการร้านค้า Active/Non-active (Phase 1.3)

**บริบท**: ร้านมีเปิด-ปิด (ยกเลิก/มาใหม่) เหมือนพนักงาน. ใช้ `dealers.is_active` ที่เพิ่มไว้ตั้งแต่แรก ไม่แตะ DB

**ตรวจพบตอนเช็ค Master_Dealer**: `dealers` ใน DB = 68 ร้าน แต่ `Master_Dealer.csv` มีแค่ 65 code จริง (67 บรรทัด - header - 1 บรรทัดที่ col[3] เป็นหัว "รหัสร้านค้า"). มี 3 ร้าน region=null ที่ไม่อยู่ใน CSV (5100761 วัฒนาโฮมเซ็นเตอร์, 5100975 ไถ่เชียงหลังสวน, 5102009 ทรีเค หาดใหญ่) — น่าจะมาจาก import ยอดขาย BA/service-sales สร้าง dealer_code เอง. `store_list_with_counts()` ใช้ left join → **แสดงร้าน 0 คนด้วย** (66 มีคน + 2 ไม่มีคน)

**ของที่สร้าง**:
- API `/api/stores/admin` PATCH { code, isActive } (verifyAdmin + service-role update dealers.is_active)
- store helper `setStoreActive(code, isActive)`
- หน้า `store-admin-screen.tsx` (การ์ดร้าน + toggle switch + filter Model→ภาค→ค้นหา + ตัวนับ ร้านทั้งหมด/เปิด/ปิด + ซ่อน/แสดง inactive) + page `/app/store-admin` + launcher card
- **StorePicker กรอง inactive ออก**: `activeStores = stores.filter(isActive)` ร้านที่ปิดจะไม่โผล่ในหน้าดู/จัดการพนักงาน (จัดการที่หน้า store-admin เท่านั้น) — ต้องเปลี่ยนทั้ง models/regions/filtered/total ให้อิง activeStores

**หมายเหตุ**: toggle switch pattern (w-14 h-7 rounded-full + span เลื่อน left-0.5/left-7) ใช้ซ้ำจากฟอร์มพนักงาน. ร้าน 0 คนยังแสดงในหน้า store-admin (admin ต้องเห็นเพื่อจัดการ)

---

## ✏️ EmployeeEditModal — แก้ไขพนักงานจบในหน้าเดียว (Phase 1.4)

**โจทย์**: หน้า store-roster ดูพนักงานแล้วอยากแก้ได้เลย ไม่ต้องสลับไปหน้า employee-admin

**ข้อควรระวังเรื่องสิทธิ์**: store-roster เข้าได้ทั้ง admin + dealer/sales (เห็นร้านตัวเอง) → ปุ่มแก้ไข/modal ต้องเปิด**เฉพาะ admin** (`session.isAdmin`) ไม่งั้น dealer แก้ข้อมูลพนักงานได้

**ของที่ทำ**:
- แยกฟอร์มเป็น component กลาง `employee-edit-modal.tsx` (modal เต็มจอ sm:center, backdrop blur) self-contained: form state + save + อัปรูป + toggle active + ย้ายร้าน. props: `employee`(null=เพิ่มใหม่), `stores`, `defaultDealer`, `onClose`, `onSaved(moved)`
- `store-roster-screen`: state `editing` (undefined=ปิด/null=เพิ่ม/Employee=แก้), ปุ่ม edit มุมขวาบนการ์ด + ปุ่ม "เพิ่ม" ใน header (เฉพาะ admin), `reloadRoster()` callback, เพิ่ม `pr-9` ให้เนื้อการ์ดไม่ชนปุ่ม edit
- `employee-admin-screen`: **rewrite ทั้งไฟล์** (จาก ~700 → ~320 บรรทัด) ใช้ modal ตัวเดียวกันแทนฟอร์ม inline เดิม — ตามหลัก lessons-learned "ไฟล์ใหญ่ >200 บรรทัดให้ rewrite ทั้งไฟล์แทนแก้ทีละจุด" ป้องกัน JSX เพี้ยน
- การสร้างใหม่ใน modal: บันทึกแล้วไม่ปิด (เก็บ repCode ให้อัปรูปต่อได้) เรียก onSaved(false) ; แก้ไข/ย้ายร้าน: บันทึกแล้วปิด modal + onSaved(moved)

**pattern modal**: `fixed inset-0 z-50` + backdrop `bg-black/40 backdrop-blur-sm` (onClick ปิด) + panel `max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl` + sticky header. ย้าย `<style jsx global>.form-in` เข้า modal component

---

## 🏬 หน้ารายละเอียดร้าน + seed Area/RE (Phase 1.5)

**เป้าหมาย**: กดการ์ดร้าน → หน้า detail รวม ข้อมูลร้าน + Area Manager + RE/Coach + พนักงานขาย ; Area/RE ใช้ฟอร์มย่อ(field น้อยกว่า SE)

**Seed Area/RE จาก SE Monitor** (`scripts/seed-area-re.mjs` dry-run/apply):
- คอลัมน์ Area Manager(28) + RE/Coach(29) ต่อแถว SE ในชีต Store65_SE80_HS65_H15
- Area มีชื่อเต็ม+ชื่อเล่นในวงเล็บ "ธรรมนูญ แสงพุ่มพงษ์ (หน่อง)" → `parseName()` แยกชื่อ/เล่น ; Coach มีแค่ชื่อต้น (คมสัน/ปราโมทย์) ไม่มีนามสกุล
- ไม่มีใครอยู่ใน sale_reps → สร้างใหม่ทั้ง 19 คน (11 area_mng + 8 coach) position ตั้งตามคอลัมน์
- ผูก `rep_store_assignments` (role_in_store: area→'manager', coach→'coach') เฉพาะ dealer ที่มีจริงใน dealers → 131 assignment ; upsert `onConflict: rep_code,dealer_code,role_in_store ignoreDuplicates` = idempotent รันซ้ำได้
- ยืนยัน: `store_roster('5100126')` คืน area+coach เป็น is_supervisor=true + SE ปกติ

**ฟอร์มย่อ Area/RE** (EmployeeEditModal): `isSupervisorPos = position in (area_mng,coach)` → ซ่อน level/วันเกิด/วันเข้างาน/skills/ย้ายร้าน (Area/Coach ผูกหลายร้านผ่าน assignment ไม่ใช่ dealer_code เดียว) เหลือ ชื่อ/ชื่อเล่น/ตำแหน่ง/เบอร์1-2/Line/email/รูป/หมายเหตุ/สถานะ

**หน้า store detail** (`store-detail-screen.tsx` + `/app/store/[code]/page.tsx`):
- page เป็น async อ่าน `params: Promise<{code}>` (Next 16) → `const {code} = await params`
- ข้อมูลร้าน (hero) + SupervisorSection ×2 (Area/Coach การ์ดย่อ + ปุ่มโทร + edit) + StaffCard (เต็มแบบ roster) ; admin กด edit/เพิ่ม เปิด EmployeeEditModal จบในหน้าเดียว ; dealer/sales ดูอย่างเดียว
- store-admin: เนื้อการ์ด (ชื่อ/รหัส) ครอบ `<Link href=/app/store/{code}>` + chevron ; toggle switch แยกเป็นปุ่มนอก Link

---

## 📇 Enrich Area/Coach จาก Master_Member.csv (Phase 1.5b)

**โจทย์**: Area/Coach ที่ seed จาก SE Monitor มีแค่ชื่อ (Coach เป็นชื่อต้นล้วน) ไม่มีนามสกุล/เบอร์/email → enrich จาก Master_Member.csv

**ค้นพบใน Master_Member.csv** (192 แถว, header 2 แถว — row0 อังกฤษ row1 ไทย): มีคอลัมน์ Area/Coach ครบในตัว
- Area: col 23 (Area ชื่อ+เล่นในวงเล็บ), 24 (Email Area), 25 (Tel. Area)
- Coach: col 26 (Coach ชื่อ+เล่น), 27 (Email Coach), 28 (Tel.Coach)
- **Coach ในไฟล์นี้มีชื่อเต็ม** (ต่างจาก SE Monitor ที่มีแค่ชื่อต้น) เช่น "พงษ์พัฒน์ แช่มขุนทด (เอ็ม)"

**match strategy** (`scripts/enrich-area-re.mjs`): record ใน DB ชื่ออาจเป็นชื่อต้นล้วน → match ด้วย `position + normFirst(name)` (คำแรก lowercase) ; เก็บตัวที่ชื่อยาวที่สุดใน Master (มีนามสกุล) ; patch: name(ถ้า Master ยาวกว่า=มีนามสกุล), nickname/email/phone(เติมถ้า DB ว่าง)

**ผล**: enrich 14/19 คน (Coach ได้ชื่อเต็ม+นามสกุล+เล่น+เบอร์+email ครบ). **5 คน match ไม่ได้** (area: ณัฐพล เต่าทอง, เศรษฐา ศรีใส, เผ่าพันธ์ เทียบศรไชย, ชวพณ จรุ่มเครือ ; coach: จักรี) — ยืนยันด้วย grep ว่า **ไม่มีใน Master_Member เลย** (0 matches) เป็น Area/Coach ที่อยู่ใน SE Monitor แต่ไม่อยู่ใน Master → ข้อจำกัดข้อมูล ให้ admin กรอกเองผ่านฟอร์ม store detail (คนพวกนี้ดูแลร้านน้อย 1-2 ร้าน)

**บทเรียน**: เมื่อ enrich ชื่อที่มีแค่ชื่อต้น ให้ match ด้วยคำแรก + position ไม่ใช่ชื่อเต็ม ; ก่อนสรุปว่า "match ไม่ได้" ให้ grep ทั้งไฟล์ยืนยันว่าไม่มีจริง ไม่ใช่สะกดต่าง

---

## 🐛 Area/Coach ไปโผล่เป็น "พนักงานในร้าน" หลังแก้ข้อมูล (Phase 1.5c)

**อาการ**: แก้ข้อมูล Area/Coach ผ่านฟอร์มแล้วเขาหลุดจากส่วน "Area Manager"/"RE Coach" ไปโผล่ในส่วน "พนักงานขาย" แทน

**สาเหตุ**: `store_roster` แยก supervisor/member ด้วย 2 branch UNION — branch member = `sale_reps.dealer_code = p_dealer` (is_supervisor=false), branch supervisor = ผูกผ่าน `rep_store_assignments` AND `r.dealer_code is distinct from p_dealer` (is_supervisor=true). **ฟอร์มแก้ข้อมูลส่ง `dealerCode` (ค่าที่ toForm โหลดมา) กลับมาตอน save เสมอ** → Area/Coach ถูกเซ็ต `dealer_code` เท่ากับร้านที่กำลังดู → ตกไป branch member (เพราะ dealer_code ตรง p_dealer เงื่อน `is distinct from` false) → โผล่เป็นพนักงานขาย. เจอ 4 คน (2 area + 2 coach) ที่ถูกเซ็ต dealer_code ผิด

**แก้ 2 ชั้น**:
1. ข้อมูล: `update sale_reps set dealer_code = null where position in ('area_mng','coach') and dealer_code is not null` (Area/Coach ผูกร้านผ่าน assignment เท่านั้น ไม่ควรมี dealer_code เดียว)
2. ต้นเหตุ (กันซ้ำ):
   - API `buildRow`: ถ้า `row.position in (area_mng,coach)` → บังคับ `row.dealer_code = null`
   - modal onSave: `dealerCode: isSupervisorPos ? null : form.dealerCode`

**บทเรียน use-before-declaration**: ย้าย `const isSupervisorPos = ...` ขึ้นไปก่อน `onSave()` ที่ใช้มัน — const ไม่ hoist เหมือน function ถ้า onSave อ้างก่อนประกาศจะ ReferenceError ตอน runtime (build ผ่านแต่จะ error ตอนกดบันทึก)

**หลักการ**: ตำแหน่งที่ผูกร้านแบบ many-to-many (area/coach ผ่าน assignment) ต้องไม่มี single dealer_code — ทุก write path (API + ทุกฟอร์ม) ต้อง enforce null ให้ตรงกัน ไม่งั้น RPC ที่แยกด้วย dealer_code จะจัดกลุ่มผิด

---

## 🧩 รวม 3 หน้า (ทีมงานรายร้าน / จัดการร้านค้า / จัดการพนักงาน) เป็น "ร้านค้าและทีมงาน"

**โครงสร้างใหม่**: `/app/stores` (รายการร้าน + สรุป + ตัวกรอง) -> `/app/store/[code]` (แก้ทุกอย่างของร้านที่เดียว). หน้าเดิมสามหน้า (`store-admin`, `store-roster`, `employee-admin`) เหลือแค่ `redirect("/app/stores")` ; ร้านค้า/พนักงานที่เข้า `/app/stores` ถูกพาไป `/app/store/{ร้านตัวเอง}` (ดูอย่างเดียว) และเปิดร้านอื่นไม่ได้
- สิทธิ์ที่หน้าจอรวมไว้ที่เดียว: `src/lib/commission/permissions.ts` -> `getStoreTeamCaps(session)` (canViewAllStores / canEditEmployee / canToggleStore / canManageSupervisors) ตอนนี้ตัดสินจาก `isAdmin`. **เป็นการซ่อนปุ่มที่หน้าจอเท่านั้น** ฝั่ง API ยังไม่ตรวจสิทธิ์ในโหมดเดโม (verifyAdmin คืน ok เมื่อ `NEXT_PUBLIC_REAL_AUTH != 1`)
- ไฟล์คอมโพเนนต์เดิม `store-roster-screen.tsx`, `employee-admin-screen.tsx`, `store-picker.tsx` ยังอยู่แต่ไม่มีใครเรียกแล้ว — ไม่ลบเพราะงานทั้งหมดยังไม่ได้ commit (ลบแล้วกู้จาก git ไม่ได้) ลบได้หลัง commit

**บทเรียน 1 — ตรวจ DB ห้ามสั่งพร้อมกับการเขียน**: ตอนทดสอบ API ตั้ง Area/Coach ผมวางคำสั่ง PATCH กับ SELECT ตรวจผลไว้ในชุด tool call เดียวกัน มันรันขนานกัน SELECT เลยเห็นช่วงที่ API ลบแล้วแต่ยังไม่ insert ทำให้เข้าใจผิดว่าข้อมูลหาย (และเผลอสั่ง insert กู้คืนซ้ำ). ต้องเรียก API ให้เสร็จก่อน แล้วค่อยตรวจในขั้นตอนถัดไปเสมอ

**บทเรียน 2 — อย่า "ลบก่อนแล้วค่อยเพิ่ม" กับข้อมูลที่ต้องมีเสมอ**: API `/api/stores/admin/supervisor` เดิมลบ assignment ของ role นั้นก่อนแล้วค่อย insert — มีช่วงที่ร้านไม่มี Area/Coach และถ้า insert พังหลังลบ ข้อมูลหาย. แก้เป็น upsert (ignoreDuplicates) คนใหม่ก่อน แล้ว `delete ... neq(rep_code, ใหม่)` ; เรียกซ้ำด้วยคนเดิมต้องไม่เปลี่ยนรหัสแถว (id)

**บทเรียน 3 — ตรวจนับให้ตรงคำพูด**: เคยสรุปว่า "ทุกร้านมี Area/Coach อย่างละ 1 คน" แต่นับแค่ "มีอย่างน้อย 1" จริงๆ ร้าน 5100975 (บ.ไถ่เชียงหลังสวน จก. — ร้านที่ไม่อยู่ใน Master_Dealer) มี Area 2 + Coach 2 (มาจากไฟล์ SE Monitor ที่ระบุต่างกันแต่ละแถว). ต้อง `group by ... having count(*) > 1` เมื่อจะพูดว่า "อย่างละ 1"

**lint vs build**: `pnpm build` ของโปรเจกต์ไม่รัน ESLint -> `react-hooks/set-state-in-effect` (เช่น `setLoading(true)` ต้นเอฟเฟกต์) ไม่เคยถูกจับ. ให้รัน `pnpm exec eslint <ไฟล์>` แยก ; แก้โดยตั้ง loading เริ่มต้น true + ใส่ `key={code}` ที่ page เพื่อ remount เมื่อเปลี่ยนร้าน. ขณะ dev server เปิดอยู่ใช้ `tsc --noEmit` แทน `pnpm build` (ไม่ทับ cache ของ dev)

**Next 16 redirect()**: ใน page ที่เป็น server component `redirect()` ตอบ HTTP 200 + ฝัง `NEXT_REDIRECT` ในเนื้อหา (ไม่มี Location header) ให้เบราว์เซอร์พาไปเอง — ตรวจด้วยการหา `NEXT_REDIRECT` ใน body ไม่ใช่ดูสถานะ 30x

---

## 📷 รูปร้านค้า (dealers.photo_url + bucket store-photos)

**ของที่สร้าง**: migration `store_photos` (คอลัมน์ `dealers.photo_url` แยกจาก `logo_url`, bucket `store-photos` public/5MB/jpeg-png-webp, RPC `store_list_with_counts` คืน `photo_url` เพิ่ม — ต้อง drop/create ใหม่เพราะเปลี่ยน RETURNS TABLE) ; API `POST /api/stores/admin/photo` (multipart dealerCode+file, ตรวจร้านมีอยู่จริง -> 404, mime -> 400, upsert `<รหัสร้าน>.<ext>` แล้วลบนามสกุลอื่นกันไฟล์ตกค้าง, ใส่ `?v=timestamp` กันแคช) ; `uploadStorePhoto()` + `fileToResizedBlob()` (ย่อด้านยาวสุด 1600px JPEG q0.85 ที่เบราว์เซอร์ก่อนส่ง รูปมือถือไม่ติดลิมิต 5MB) ; สิทธิ์ `canEditStore` ใน permissions.ts ; หน้า detail มีส่วน "รูปร้าน" (+เปลี่ยนรูป, กดขยายเต็มจอ) ; การ์ดรายการร้านมีรูปเล็ก `loading="lazy"`

**ข้อมูลรูปจริง** (`commission-app/รูปร้านค้าและพนักงาน/ร้านค้า/<ภาค>/<ชื่อร้าน>.jpg`): 63 ไฟล์ .jpg/.JPG ตั้งชื่อ**เป็นชื่อร้าน ไม่ใช่รหัสร้าน** -> ต้องจับคู่ด้วยชื่อ. รูปมีทั้งแนวตั้ง 38 / แนวนอน 24 / จัตุรัส 1 (ส่วนใหญ่ 1108x1477) และรูปที่เปิดดูเป็น**ป้ายใหญ่ริมถนน** (ไม่ใช่ตัวร้านทั้งหลัง) => ห้ามใช้แบนเนอร์กว้างตัดภาพ ใช้การ์ด `object-contain` สูงไม่เกิน max-h-80 + กดขยาย ; ไฟล์ >5MB มีแค่ 1 (เคยบอกผิดว่า 3)
- ชื่อไฟล์ลงท้าย `จก..jpg` (จุดซ้อน) -> ตัดนามสกุลด้วย `basename(f, extname(f))` ก่อน normalize
- ชื่อไฟล์ vs ชื่อใน DB ต่างกัน: `วัตถุ` vs `วัสดุ`, `บ.`/`บจก.`, ต่อท้าย ` +` -> normalize (ตัดช่องว่าง/จุด/วงเล็บ, วัตถุ->วัสดุ) + Dice bigram similarity ; ยอมรับเมื่อเป๊ะ หรือ >=90% และห่างอันดับสอง >=5% ; ที่เหลือ**ไม่เดา** ให้ผู้ใช้ยืนยันแล้วใส่ใน `MANUAL` (เช่น `บ.อุดมชัยสมุทรสงครามซิเมนต์ จก.` -> 5100119 ซึ่งชื่อใน DB เป็น `บ.อุดมชัยกู๊ดโฮมสมุทรสงคราม จก.`)
- รูปจากกล้องมือถือมี EXIF orientation -> สคริปต์ใช้ `sharp(...).rotate()` ก่อน resize ; เบราว์เซอร์วาดลง canvas ได้ทิศถูกเอง
- `sharp` ติดมากับ next (0.35.x) แต่**ไม่ได้ประกาศใน package.json** ใช้ในสคริปต์ได้ แต่อย่าพึ่งมันใน API route ของแอป

**ข้อจำกัดที่รู้**: การ์ดรายการใช้ไฟล์เดิมขนาด ~0.1-0.4MB เป็นรูปเล็ก (ไม่มี thumbnail แยก ; Supabase image transform เป็นฟีเจอร์เสียเงิน) พึ่ง lazy-load ; รูปพนักงาน (`uploadEmployeePhoto`) ยังไม่ได้ย่อที่เบราว์เซอร์ (ลิมิต 5MB เดิม) ใช้ `fileToResizedBlob` ได้ถ้าต้องการ

---

## 🔐 ตรวจระบบก่อนทำ login จริง — ช่องโหว่ที่พบ (ยังไม่ได้แก้ รอยืนยัน)

**สถานะ**: โหมดเดโมยังเป็นค่าเริ่มต้น (`NEXT_PUBLIC_REAL_AUTH` ไม่มีใน .env ; ค่าบน Vercel ตรวจจากเครื่องนี้ไม่ได้). auth.users 23 (20 anonymous จาก demo bridge, 3 จริง = admin/sales/dealer ที่ approved), profiles 3 แถว, trigger `handle_new_user` สร้าง profile (status default `pending`) เฉพาะผู้สมัครจริง

**ช่องโหว่ที่ยืนยันจากนโยบาย/สิทธิ์ใน DB (ยังไม่ได้ทดสอบโจมตีจริง)**:
1. **ยกสิทธิ์ตัวเองเป็น admin ได้**: `profiles` มี policy "update own profile" (`id = auth.uid()`) + role `authenticated` มีสิทธิ์ UPDATE ทุกคอลัมน์ (role, status, dealer_code, emp_id, approved_*) + **ไม่มี trigger** กันคอลัมน์ -> ผู้ใช้ที่ล็อกอินแล้วแก้ role/status ของตัวเองได้ -> `is_admin()` เป็นจริง และ `verifyAdmin()` ใน API ผ่านด้วย. ต้องแก้ก่อนเปิด REAL_AUTH (revoke UPDATE รายคอลัมน์ เหลือแค่ full_name หรือ trigger กัน)
2. **RPC ข้อมูลเปิดให้ anon เรียกผ่าน public key**: advisor เตือน 41 ฟังก์ชัน SECURITY DEFINER ที่ `anon` execute ได้ (ยืนยันด้วย has_function_privilege: ba_incentive_summary, lhs_commission_summary, service_sales_summary, back_margin_summary ฯลฯ) -> เรียก `/rest/v1/rpc/...` ด้วย p_dealer = null ได้ (= ทุกร้าน) โดยไม่ล็อกอิน
3. **ความผิดพลาดของผมเอง**: `store_roster()` และ `store_list_with_counts()` ผม `grant execute ... to anon, authenticated` ไว้ -> ใครก็ได้ที่มี public key ดึง **เบอร์โทร/อีเมล/วันเกิด/Line ของพนักงานทั้งหมด** ได้ ทั้งที่ API ของแอปใช้ service-role อยู่แล้วจึงไม่จำเป็นต้อง grant. ตารางพนักงาน (`sale_reps`) ก็อยู่หลัง policy ที่มี `is_anon_demo()` (anonymous sign-in เปิดอยู่ ใครก็ขอ session แบบ anonymous ได้) ทั้งที่ผมเพิ่มคอลัมน์ข้อมูลส่วนตัวเข้าไปในตารางนั้น
4. Anonymous sign-ins เปิดอยู่ ; Leaked password protection ปิดอยู่ ; 5 ตารางเปิด RLS แต่ไม่มี policy (ตั้งใจ — ใช้ผ่าน service-role เท่านั้น ไม่ใช่ปัญหา)

**บทเรียน**: ห้าม `grant execute ... to anon/authenticated` ให้ฟังก์ชัน SECURITY DEFINER ที่คืนข้อมูลจริง — เฉพาะฟังก์ชันช่วยของ RLS (`is_admin`, `my_role`, `my_dealer_code`, `my_emp_id`, `is_anon_demo`) เท่านั้นที่ต้อง grant (ดูหัวข้อ "SECURITY DEFINER function ที่ใช้ใน RLS" ด้านบน). RPC ที่ API route เรียกผ่าน service-role ควร revoke จาก `public, anon, authenticated` (ต้อง revoke จาก `public` ด้วย เพราะ default ของ Postgres ให้ PUBLIC execute) ; อย่าอ้างว่า "WARN ยอมรับได้" ใช้กับ RPC ข้อมูลที่ไม่ใช่ helper

**✅ ข้อ 0 แก้แล้ว** (migration `security_hardening_step0`, SQL เก็บที่ `scripts/sql/security-hardening-step0.sql`):
- trigger `protect_profile_privileged_columns` : ผู้ใช้ authenticated/anon ที่ไม่ใช่ admin แก้ role/status/dealer_code/emp_id/approved_* ไม่ได้ (service_role/postgres/admin ยังแก้ได้ ; แก้ full_name/note ของตัวเองได้) + `revoke update on profiles from anon`
- revoke execute ของ RPC ข้อมูล 36 ตัวจาก `public, anon, authenticated` แล้ว grant ให้ `service_role` ; เก็บไว้เฉพาะ `is_admin, is_anon_demo, my_dealer_code, my_emp_id, my_role, my_dealer_access, handle_new_user`
- **พิสูจน์ก่อน-หลัง**: ยกสิทธิ์ตัวเองด้วย session ของ sales ในทรานแซกชันที่ rollback (`do $$ ... raise exception 'TEST_RESULT => ...' $$`) ก่อนแก้ = `NOT BLOCKED rows=1 is_admin=t` หลังแก้ = `BLOCKED permission denied` ; `scripts/check-anon-exposure.mjs` (ใช้ public key ล้วนๆ) ก่อน EXPOSED=10 -> หลัง DENIED=10 EXPOSED=0 ; advisor `anon_security_definer_function_executable` 41 -> 5 (เหลือเฉพาะที่ตั้งใจ)
- ตรวจแอปไม่พัง: ยิง 27 API route ผ่าน dev server ผ่านหมด (ok=true, ได้ข้อมูลจริง เช่น service-sales count=45566) ; ฝั่งเบราว์เซอร์ไม่มีโค้ดเรียก `.rpc(` เลย (grep) จึงถอน anon ได้
- **ยังเปิดอยู่ (ตั้งใจเลื่อนไป cutover)**: policy ของ ~20 ตารางที่ใช้ `is_anon_demo()` ยังให้ session นิรนามอ่านตารางตรงๆ ได้ รวม `sale_reps` (เบอร์/อีเมล/วันเกิด/Line) และตารางค่าคอมมิชชัน — anonymous sign-in เปิดอยู่ใครก็ขอ session ได้ด้วย public key ; โหมดเดโมพึ่งสิ่งนี้ในการ hydrate ข้อมูล (`dataset.ts`) จึงปิดทันทีไม่ได้ ; Leaked password protection ยังปิด (ตั้งใน dashboard)

**บทเรียนการทดสอบ**: (1) สคริปต์ตรวจต้องแยก "ถูกปฏิเสธสิทธิ์" (รหัส 42501) ออกจาก error อื่น — รอบแรกผมป้าย PGRST203 (ชื่อฟังก์ชันกำกวมเพราะ overload) และ 57014 (statement timeout) เป็น DENIED ทั้งที่ฟังก์ชันเรียกได้ ; (2) อย่าสั่งคำสั่งเขียนกับคำสั่งตรวจผลใน tool call ชุดเดียวกัน (รันขนาน) ; (3) `service_sales_summary` แบบทุกร้านเคย statement timeout เป็นบางครั้งตอนเรียกครั้งแรก (พบทั้งก่อนและหลังแก้ ไม่เกี่ยวกับการถอนสิทธิ์) — ควรทำ index/cache ภายหลัง

**ช่องว่างเชิงสถาปัตยกรรมของ login จริง**: API route อ่านขอบเขตร้านจาก query string (`?dealerCode=`) ที่ client ส่งมา แล้วเรียก RPC ด้วย service-role -> แม้ล็อกอินจริงแล้ว ผู้ใช้ก็เปลี่ยน dealerCode ดูร้านอื่นได้. ต้องย้ายการหาขอบเขตไปฝั่งเซิร์ฟเวอร์ (อ่าน session cookie -> profile -> รายการร้านที่อนุญาต) ทุก route ; Area/Coach ดูหลายร้าน -> ใช้ `profiles.emp_id` (rep_code) -> `rep_store_assignments`

---

## 🔑 Microsoft (Azure) login รอบ 1 — โครงที่วางไว้ (ยังไม่เปิดใช้จนกว่าตั้ง Azure provider)

- `profiles.emp_id` มี FK ไป `employees(emp_code)` (ตารางเดิม) ใส่ rep_code ของ `sale_reps` ไม่ได้ -> เพิ่มคอลัมน์ `profiles.rep_code` (ไม่มี FK) และใส่ใน trigger `protect_profile_privileged_columns` ด้วย
- คำเชิญ: ตาราง `user_invites` (RLS เปิด ไม่มี policy = service_role เท่านั้น) ; `handle_new_user` ใช้คำเชิญ **เฉพาะ provider = azure** กัน email/password สมัครด้วยอีเมลคนอื่นแล้วแย่งสิทธิ์ (SQL: `scripts/sql/auth-msft-invites.sql`)
- flow: ปุ่ม Microsoft -> `/auth/callback?redirect_to=/auth/bridge` -> `/auth/bridge` เรียก `/api/me` -> `doLogin` (admin หรือ area) ; role ใหม่ `"area"` ใน session (เก็บ `areaStores`)
- `getAuthContext()` (`src/lib/supabase/auth-context.ts`): มี session จริง -> บังคับขอบเขตร้านฝั่ง server ; ไม่มี (เดโม) -> พฤติกรรมเดิม ใช้แล้วที่ `GET /api/employees`
- `/auth/callback` เดิมต่อ `redirect_to` ตรง ๆ (open redirect `//evil.com`) -> ตรวจให้เป็น path ภายในเท่านั้น และถ้า exchange code ล้มเหลวให้ไป `/auth/error`
- `server-only` ไม่ได้ติดตั้งในโปรเจค อย่า import
- ยังไม่ได้ทดสอบ OAuth จริง (รอ Tenant/Client ID) ; ตรวจแล้วเฉพาะ tsc, `/api/me` ไม่ login = 401, callback กัน `//evil.com`

---

## 🏪 ร้านค้าสมัครเอง + admin อนุมัติ (email/password, 1 บัญชีต่อร้าน)

- flow: `/auth/signup` (`supabase.auth.signUp` + user_metadata: full_name/phone/requested_dealer_code) -> ยืนยันอีเมล -> `/auth/callback` -> `/auth/bridge` -> (pending) `/auth/pending` ; admin อนุมัติที่ `/app/admin-users` (`/api/admin/users` GET/POST)
- trigger `handle_new_user` เก็บคำขอไว้ใน `profiles.requested_dealer_code` / `phone` (ไม่ตั้ง role/dealer_code จนกว่า admin อนุมัติ) ; ตรวจว่ารหัสร้านมีจริง ; ทดสอบด้วย DO block ที่ insert ลง auth.users แล้ว `raise exception` เพื่อ rollback (ได้ status=pending, req_dealer ตรง)
- 1 บัญชีต่อร้าน: partial unique index `profiles_one_dealer_account_per_store` + API ตรวจก่อน (409) ; ต้อง "ระงับ" บัญชีเดิมก่อน
- `/api/admin/users` ใช้ `getAuthContext()` ต้องเป็น admin **session จริงเสมอ** (ไม่ผูก flag REAL_AUTH) -> admin ที่เข้าแบบเดโมใช้หน้านี้ไม่ได้ (จะได้ 401 พร้อมข้อความอธิบาย) ต้อง login ด้วย Microsoft หรือ `/auth/email`
- ESLint `set-state-in-effect`: อย่าเรียกฟังก์ชัน async ที่ setState จาก useEffect ผ่าน useCallback ; เขียน `fetch().then()` ใน effect ตรง ๆ + ตัวนับ `reload` สำหรับรีเฟรช, และ setLoading(true) ใน event handler แทน
- ต้องเปิด "Confirm email" ใน Supabase Auth (Providers > Email) เองใน dashboard ; SMTP เริ่มต้นของ Supabase จำกัดจำนวนอีเมลต่อชั่วโมง ควรตั้ง custom SMTP ก่อนเปิดจริง (ยังไม่ได้ตรวจค่าที่ตั้งไว้)

---

## 🔐 แจกบัญชีร้าน + เปลี่ยนรหัสผ่าน (must_change_password)

- admin สร้างบัญชีที่ `/app/admin-users` (`POST /api/admin/users {action:'create'}`): `auth.admin.createUser(email_confirm:true)` + อัปเดต profile เป็น dealer/approved/`must_change_password=true` ; ถ้าอัปเดต profile ล้มเหลวต้อง `deleteUser` ย้อนกลับ ไม่ให้เหลือ auth user ค้าง ; ไม่ระบุอีเมล -> `<รหัสร้าน>@retail-comm.local` (รีเซ็ตทางอีเมลไม่ได้ ต้องให้ admin รีเซ็ต)
- รหัสชั่วคราวสุ่มด้วย `crypto.randomInt` (`src/lib/supabase/temp-password.ts`) แสดงให้ admin ครั้งเดียว ไม่ log ไม่เก็บ
- เปลี่ยนรหัสผ่านผ่าน `POST /api/account/password` (service_role `updateUserById` แล้วเคลียร์ flag) ไม่ใช้ `auth.updateUser` ฝั่ง client เพราะผู้ใช้เคลียร์ flag เองไม่ได้ (trigger ป้องกันคอลัมน์ ตอบ 42501) ; ทดสอบแล้ว: login รหัสชั่วคราวได้, เคลียร์ flag เองถูกบล็อก, เปลี่ยนรหัสแล้วรหัสเก่าใช้ไม่ได้
- การบังคับเปลี่ยนรหัสเป็นระดับหน้าจอ (sessionStorage `mustChangePw` + `AppGuard` redirect) ; API อื่นยังไม่ปฏิเสธจนกว่าจะเปลี่ยน (`/api/me` ส่ง `mustChangePassword` ไว้ให้บังคับฝั่ง server ภายหลัง)
- `doLogout()` เดิมล้างแค่ sessionStorage ไม่ได้ออกจาก Supabase session จริง -> cookie ผู้ใช้เก่ายังอยู่ ทำให้ API ที่ใช้ `getAuthContext()` scope ตามคนเดิมหลังสลับบัญชีเดโม ; แก้ให้ `doLogout` signOut เฉพาะ session ที่ไม่ใช่ anonymous
- ESLint `set-state-in-effect` ที่ `home-hub-screen.tsx:207` เป็นของเดิม ไม่เกี่ยวกับงานนี้

---

## 🔁 คำขอรีเซ็ตรหัสผ่านจากร้านค้า (ไม่ต้อง SMTP)

- ร้านส่งที่ `/auth/forgot` -> `POST /api/public/reset-request` (ไม่ต้อง login) -> ตาราง `password_reset_requests` (RLS เปิดไม่มี policy, เข้าถึงผ่าน service_role) -> admin ดูและกด "รีเซ็ตรหัสผ่าน"/"ปิดคำขอ" ใน `/app/admin-users` (`/api/admin/reset-requests`)
- API สาธารณะตอบ `ok:true` เหมือนกันทั้งกรณีร้านไม่มีจริง/ซ้ำ (ไม่เปิดเผยว่าร้านมีบัญชีไหม) ; unique index ร้านละ 1 คำขอที่ค้าง (23505 ถือว่าสำเร็จ) ; ตัดความยาวชื่อ/เบอร์/หมายเหตุ
- ทดสอบ: ส่งซ้ำแล้วเหลือ 1 แถว, ร้านไม่มีจริงไม่สร้างแถว, ชื่อว่างได้ 400 ; ลบแถวทดสอบแล้ว ; ส่วน admin ต้องใช้ session จริงจึงยังไม่ได้ทดสอบผ่านหน้าจอ (ไม่ login ได้ 401)
- PowerShell: ส่ง body ภาษาไทยด้วย `Invoke-WebRequest` ให้แปลงเป็น bytes UTF-8 (`[Text.Encoding]::UTF8.GetBytes`) ; ฟังก์ชันชื่อ `Post` ใน script ยาว ๆ ทำให้ output หาย ใช้ชื่ออื่น เช่น `Send`

---

## 🖼️ รูปพนักงาน SE จาก PowerPoint (รายชื่อ SE_...pptx) — จับคู่ตามตำแหน่งผิดได้ ต้องให้คนตรวจ

- pptx = zip: รูปอยู่ `ppt/media/`, ตำแหน่งใน `ppt/slides/slideN.xml` (`<p:pic>` + `a:off/a:ext`, `r:embed` -> `_rels`) ; ข้อความกล่องร้านมีชื่อ/ชื่อเล่น/วันเข้างาน/Tel/Email แต่ **รูปไม่ได้ผูกกับชื่อ** ต้องเดาจากตำแหน่ง (คอลัมน์เดียวกัน เรียงบนลงล่าง)
- รูปถูกครอปบนสไลด์ด้วย `<a:srcRect l t r b>` (หน่วย 1/1000 %) — ต้อง extract ตามนี้ ไม่งั้นได้รูปเต็มตัว+ชื่อใต้รูป
- **จับคู่ตามตำแหน่งผิด 8 คน** (สไลด์ที่กล่องร้านซ้อนกัน/รูปวางข้ามคอลัมน์) แม้หลายรายได้ "ความมั่นใจสูง" -> ต้องสร้างภาพรวมพร้อมชื่อ (`--sheet`) ให้ผู้ใช้ตรวจด้วยตาก่อน apply เสมอ ; ผลการตรวจเก็บเป็น `OVERRIDE`/`EXCLUDE` ในสคริปต์ให้รันซ้ำได้
- สคริปต์: `scripts/import-se-photos-pptx.mjs` (dry-run เป็นค่าเริ่มต้น, ไม่เขียนทับรูปเดิมเว้นแต่ `--overwrite`, `--include-review` เมื่อผู้ใช้ยืนยันภาพรวมแล้ว) ; อัปโหลด 61 คน -> bucket `employee-photos/<rep_code>.jpg` (≤800px)
- PowerShell: ห้ามส่งสตรีม progress ของ `Expand-Archive` ปน stdout (ตั้ง `$ProgressPreference='SilentlyContinue'`) ; อ่านผลจากไฟล์ log แทน console เมื่อ output ยาว/มีภาษาไทย
