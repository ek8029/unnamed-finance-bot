'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase/client'

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname
      const search = searchParams.toString()
      if (search) url += '?' + search
      ph.capture('$pageview', { '$current_url': url })
    }
  }, [pathname, searchParams, ph])

  return null
}

function PostHogIdentify() {
  const ph = usePostHog()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user
        ph.identify(user.id, {
          email: user.email,
          name: user.user_metadata?.full_name,
          auth_provider: user.app_metadata?.provider,
        })
        // signup_completed for OAuth users is captured server-side in
        // app/auth/callback/route.ts. It lived here behind a "created_at
        // within 60 s" check, which depended on this listener observing the
        // SDK's own SIGNED_IN emission: a race at init, a repeat on every tab
        // refocus.
      } else if (event === 'SIGNED_OUT') {
        ph.reset()
      }
    })

    // Also identify on mount if already logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        ph.identify(user.id, {
          email: user.email,
          name: user.user_metadata?.full_name,
          auth_provider: user.app_metadata?.provider,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [ph])

  return null
}

let initialized = false

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!initialized && typeof window !== 'undefined') {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
    if (token) {
      posthog.init(token, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
        enable_recording_console_log: false,
      })
      initialized = true
    }
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  )
}
