---
inclusion: always
---

# Project Structure

## Root Layout

```
/
├── .github/
│   └── workflows/
│       └── deploy-vercel.yml  # Deployment workflow for Vercel
├── .kiro/
│   └── steering/              # Development steering and guidelines
├── public/                    # Static public assets
├── src/                       # Application source code
├── components.json            # shadcn/ui configuration
├── eslint.config.mjs          # ESLint configuration
├── next.config.ts             # Next.js configuration
├── package.json               # Project dependencies and scripts
├── pnpm-lock.yaml             # pnpm lockfile
├── pnpm-workspace.yaml        # pnpm workspace configuration
├── postcss.config.mjs         # PostCSS configuration
├── README.md                  # Project documentation
├── tailwind.config.ts         # Tailwind CSS configuration
└── tsconfig.json              # TypeScript configuration
```

## Source Structure (`src/`)

```
src/
├── app/                       # Next.js App Router routes
│   ├── globals.css            # Global CSS styles
│   ├── layout.tsx             # Root layout component
│   ├── page.tsx               # Root page component
│   ├── app/                   # Protected app routes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── auth/                  # Authentication routes
│       ├── callback/route.ts  # Auth callback handler
│       ├── error/page.tsx     # Auth error page
│       ├── login/page.tsx     # Login page
│       └── logout/route.ts    # Logout route handler
├── components/                # Application components
│   ├── auth-button.tsx
│   ├── env-var-warning.tsx
│   ├── hero.tsx
│   ├── login-form.tsx
│   ├── logout-button.tsx
│   ├── next-logo.tsx
│   ├── posthog-provider.tsx   # PostHog provider integration
│   ├── supabase-logo.tsx
│   ├── theme-dropdown-selector.tsx
│   ├── theme-switcher.tsx
│   ├── tutorial/              # Setup/tutorial components
│   └── ui/                    # Reusable shadcn/ui components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       └── label.tsx
├── lib/                       # Utility and client configurations
│   ├── config.ts
│   ├── utils.ts               # Class utility helpers (clsx, tailwind-merge)
│   └── supabase/              # Supabase clients & proxy
│       ├── client.ts          # Browser Supabase client
│       ├── proxy.ts           # Middleware proxy for session handling
│       └── server.ts          # Server-side Supabase client
└── proxy.ts                   # Next.js request proxy / middleware entry
```

## Code Organization Patterns

- **Component co-location**: General components in `src/components/`, reusable UI primitives in `src/components/ui/`.
- **Supabase Integration**: Server & client instances organized in `src/lib/supabase/`.
- **Styling**: Tailwind CSS utility classes with shadcn/ui primitives.
- **Analytics & Observability**: Integrated via `src/components/posthog-provider.tsx`.

## Key Files

- `src/app/page.tsx` - Main landing page.
- `src/lib/supabase/client.ts` - Client-side Supabase client.
- `src/lib/supabase/server.ts` - Server-side Supabase client.
- `src/proxy.ts` - Middleware handling authentication proxy and session refresh.
- `.github/workflows/deploy-vercel.yml` - Deployment action to Vercel production branch.

## Development Workflow

1. Install dependencies: `pnpm install`
2. Start development server: `pnpm dev`
3. Access application: http://localhost:3000
4. Build project: `pnpm build`
