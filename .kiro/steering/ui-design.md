---
inclusion: always
---

# UI & Visual Design System Guidelines

This application uses **Tailwind CSS 4** and **shadcn/ui** components.

## 🎨 Theme & Color Palette Customization (tweakcn)

For custom themes or ready-to-use color schemes, use **[tweakcn.com/community](https://tweakcn.com/community)**:
- Browse, customize, and preview shadcn/ui visual themes.
- Copy generated CSS variables directly into `src/app/globals.css`.

---

## 📐 Layout & Component Guidelines

### 1. General Principles
- **Responsive Grids**: Use standard CSS grids and Flexbox (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).
- **Typography**: Headings use display fonts (`Space Grotesk` / `Outfit`); body text uses readable sans-serif fonts (`DM Sans` / `Outfit`). Always import Google Fonts in `src/app/layout.tsx` using `<link>` tags.
- **Glassmorphism & Surface Elevation**: Use subtle surface borders (`border-white/10` or `border-black/10`) and backdrop blurs (`backdrop-blur-md`) for elevated card containers.
- **Interactive Feedback**: All CTA buttons and clickable cards should include subtle active/hover transitions (`hover:-translate-y-0.5 transition-all`).

### 2. Standard Page Layouts
- **Landing / Splash**: Fixed header nav, 12-column grid hero, staggered feature cards, and social proof sections.
- **Dashboard**: Fixed sidebar navigation (or responsive top bar), metric summary row, main content split view (e.g., recent transactions/activity left, progress/charts right).
- **Detail View**: Back button, clear entity header with primary values, 2-column detail breakdown.

### 3. Animations & Motion
- Use smooth entry transitions: `fadeUp` or `slideIn` with staggered delays on grid items (`stagger-1`, `stagger-2`, etc.).
- Keep micro-interactions subtle (hover lifts, color changes, smooth progress bar fills).
