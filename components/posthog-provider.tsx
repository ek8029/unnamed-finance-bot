'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

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

if (typeof window !== 'undefined') {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (token) {
    posthog.init(token, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: 'identified_only', // anonymous by default; only create profiles after posthog.identify()
      capture_pageview: false,             // manual capture below for SPA routing
      capture_pageleave: true,             // accurate session duration
    })
  } else if (process.env.NODE_ENV === 'development') {
    // Don't crash local dev if the key isn't set yet
    console.warn('[posthog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN not set — analytics disabled')
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
