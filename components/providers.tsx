'use client'

import { SettingsProvider } from '@/contexts/settings-context'
import { ToastProvider } from '@/contexts/toast-context'
import { ResearchProvider } from '@/contexts/research-context'
import { ToastContainer } from '@/components/ui/toast'
import { PostHogProvider } from '@/components/posthog-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <SettingsProvider>
        <ToastProvider>
          <ResearchProvider>
            {children}
          </ResearchProvider>
          <ToastContainer />
        </ToastProvider>
      </SettingsProvider>
    </PostHogProvider>
  )
}
