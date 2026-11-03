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
