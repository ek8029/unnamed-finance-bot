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
        ph.identify(session.user.id, {
          email: session.user.email,
          name: session.user.user_metadata?.full_name,
          auth_provider: session.user.app_metadata?.provider,
        })
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

if (typeof window !== 'undefined') {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (token) {
    posthog.init(token, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
    })
  } else if (process.env.NODE_ENV === 'development') {
    console.warn('[posthog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN not set — analytics disabled')
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
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
