---
inclusion: always
---

# Tech Stack

## Framework & Core Libraries

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript (strict mode enabled)
- **Database & Auth**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **Analytics**: PostHog (`posthog-js`)
- **Theme**: `next-themes`
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (`@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`)
- **Icons**: Lucide React
- **Package Manager**: pnpm

### Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint
```

## Architecture

- **Full-stack Application**: Next.js App Router with Server Components, Client Components, and Route Handlers.
- **Backend & Auth Integration**: Supabase client/server authentication and database helpers (`src/lib/supabase/`).
- **Analytics & Tracking**: PostHog provider integration (`src/components/posthog-provider.tsx`).
- **Deployment**: Automatic deployment to Vercel via GitHub Actions (`.github/workflows/deploy-vercel.yml` pushing to `production` branch).

## Key Dependencies

- next: ^16.3.1
- react: ^19.2.8
- react-dom: ^19.2.8
- @supabase/ssr: ^0.12.4
- @supabase/supabase-js: ^2.112.3
- posthog-js: ^1.417.1
- lucide-react: ^1.31.0
- tailwindcss: ^4.3.3
- next-themes: ^0.4.6
