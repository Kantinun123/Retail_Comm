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

