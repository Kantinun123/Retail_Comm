---
inclusion: manual
---

Deploy the Next.js application:

1. Validate the build locally from the project root:
   ```bash
   pnpm install && pnpm build
   ```

2. Push changes to the `main` branch:
   ```bash
   git add .
   git commit -m "Deploy application updates"
   git push origin main
   ```

3. The GitHub Actions workflow (`.github/workflows/deploy-vercel.yml`) will automatically:
   - Sync changes to the `production` branch
   - Trigger the Vercel production deployment build

4. Monitor the deployment progress on GitHub Actions or Vercel dashboard.

5. If build fails locally or during workflow execution:
   - Check TypeScript compilation errors (`pnpm build`)
   - Check ESLint issues (`pnpm lint`)
   - Ensure environment variables for Supabase and PostHog are correctly configured in Vercel settings

