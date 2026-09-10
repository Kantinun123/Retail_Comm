---
inclusion: manual
---

# Pre-Delivery Verification & Quality Checks

Run local verification and manual functional testing across the critical path before delivering changes.

## 1. Automated Build & Type Checks
Run the following commands to ensure no build or compilation errors exist:
```bash
pnpm lint     # ESLint validation
pnpm build    # Next.js production build & TypeScript check
```

## 2. Environment Setup Verification
Ensure required environment variables are configured in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY` (if analytics active)

## 3. Critical Path Functional Verification
Start the development server (`pnpm dev`) and verify key user flows:
1. **Landing Page (`/`)**: Page renders correctly with hero, theme switcher, and navigation links.
2. **Auth Flow (`/auth/login`)**: Login form loads without errors and authenticates via Supabase.
3. **Protected Routes (`/app`)**: Redirects unauthenticated users to login; accessible after authentication.
4. **Theme Switcher**: Dark/light mode toggles correctly across components.

## 4. Test Summary Report
Present verification results in a concise summary table:

| Feature / Check | Command / URL | Result | Notes |
| :--- | :--- | :--- | :--- |
| ESLint & Types | `pnpm lint` | ✅ Pass | Zero warnings/errors |
| Build Check | `pnpm build` | ✅ Pass | Compiled successfully |
| Landing Page | `http://localhost:3000/` | ✅ Pass | UI elements render correctly |
| Auth Login | `http://localhost:3000/auth/login` | ✅ Pass | Form submits without runtime errors |
