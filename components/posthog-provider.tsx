'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase/client'
import { startSurveyDeferral, useSurveyDeferral } from '@/components/survey-deferral'
import { isSurveySensitiveRoute } from '@/lib/survey-deferral'
import { captureBrowserPageview, setBrowserPageAnalytics } from '@/lib/browser-page-analytics'

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()
  useSurveyDeferral(isSurveySensitiveRoute(pathname))

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname
      // Query strings can contain email addresses and sign-in tokens.
      ph.capture('$pageview', { '$current_url': url })
      captureBrowserPageview()
    }
  }, [pathname, searchParams, ph])

  return null
}

function PostHogIdentify() {
  const ph = usePostHog()
  useEffect(() => {
    let generation = 0
    let owner: string | null = null
    let observedAuth = false
    let preferencePending = false
    const pause = () => { generation++; ph.opt_out_capturing(); setBrowserPageAnalytics(false) }
    const remember = (enabled: boolean) => {
      try { localStorage.setItem('helm:analytics-enabled', String(enabled)) } catch { /* optional storage */ }
    }
    const pending = () => { preferencePending = true; pause(); remember(false) }
    const load = async (userId: string | null) => {
      pause()
      const ticket = generation
      if (owner !== userId) ph.reset()
      owner = userId
      if (preferencePending) return
      if (!userId) {
        // Preserve anonymous acquisition measurement, but never override a
        // browser's saved opt-out when its account signs out.
        try {
          const saved = localStorage.getItem('helm:analytics-enabled')
          const legacy = JSON.parse(localStorage.getItem('helm-settings') || '{}')
          if (saved === 'false' || (saved === null && legacy.analyticsEnabled === false)) return
          ph.opt_in_capturing({ captureEventName: false })
          setBrowserPageAnalytics(true)
          ph.capture('$pageview', { $current_url: window.location.origin + window.location.pathname })
        } catch { /* unreadable choice stays opted out */ }
        return
      }
      try {
        const response = await fetch('/api/user/preferences', { cache: 'no-store' })
        if (!response.ok) return
        const { preferences } = await response.json()
        if (ticket !== generation || !preferences) return
        remember(preferences.analytics_enabled !== false)
        if (preferences.analytics_enabled === false) return
        ph.opt_in_capturing({ captureEventName: false })
        setBrowserPageAnalytics(true)
        ph.identify(userId)
        ph.capture('$pageview', { $current_url: window.location.origin + window.location.pathname })
      } catch { /* unreadable preference stays opted out */ }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      observedAuth = true
      void load(session?.user.id ?? null)
    })
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!observedAuth) void load(user?.id ?? null)
    }).catch(pause)
    const reload = () => { void load(owner) }
    const saved = () => { preferencePending = false; reload() }
    const foreground = () => { if (document.visibilityState === 'visible') reload() }
    window.addEventListener('helm:privacy-pending', pending)
    window.addEventListener('helm:privacy-saved', saved)
    document.addEventListener('visibilitychange', foreground)
    return () => {
      pause(); subscription.unsubscribe()
      window.removeEventListener('helm:privacy-pending', pending)
      window.removeEventListener('helm:privacy-saved', saved)
      document.removeEventListener('visibilitychange', foreground)
    }
  }, [ph])
  return null
}

let initialized = false

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { startSurveyDeferral() }, [])
  if (!initialized && typeof window !== 'undefined') {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
    if (token) {
      posthog.init(token, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
        disable_session_recording: true,
        capture_exceptions: false,
        opt_out_capturing_by_default: true,
        enable_recording_console_log: false,
        disable_surveys: true,
      })
      // Overrides a persisted opt-in from an older app version until the
      // signed-in account's current preference has actually been read.
      posthog.opt_out_capturing()
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
