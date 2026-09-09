'use client'

import posthog from 'posthog-js'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasEnvVars } from '@/lib/utils'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost'
      
      // 3. do not track if localhost
      if (isLocalhost) {
        console.log('PostHog: Tracking disabled on localhost')
        return
      }

      const token = process.env.NEXT_PUBLIC_POSTHOG_TOKEN
      const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
      const appName = process.env.NEXT_PUBLIC_POSTHOG_APP

      if (token && host) {
        posthog.init(token, {
          api_host: host,
          person_profiles: 'always',
          // 2. tracking only when logged-in (initially opted out)
          opt_out_capturing_by_default: true,
          capture_pageview: false, // We will manually handle or opt-in
          loaded: (ph) => {
            // 1. posthog.register({ app: NEXT_PUBLIC_POSTHOG_APP });
            if (appName) {
              ph.register({ app: appName })
            }
          }
        })
      }

      if (!hasEnvVars) {
        return
      }

      const supabase = createClient()
      
      // Initial check
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) {
          const email = user.email.toLowerCase();
          posthog.identify(email, { email, supabase_id: user.id })
          posthog.opt_in_capturing()
          posthog.capture('$pageview')
        }
      })

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (session?.user?.email) {
            const email = session.user.email.toLowerCase();
            // 1. identity = email
            posthog.identify(email, {
              email: email,
              supabase_id: session.user.id
            })
            // 2. tracking only when logged-in
            posthog.opt_in_capturing()
          } else {
            posthog.opt_out_capturing()
            posthog.reset()
          }
        }
      )

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [])

  return <>{children}</>
}
