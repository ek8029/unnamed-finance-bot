'use client'

import { SettingsProvider } from '@/contexts/settings-context'
import { ToastProvider } from '@/contexts/toast-context'
import { ResearchProvider } from '@/contexts/research-context'
import { ToastContainer } from '@/components/ui/toast'
import { PostHogProvider } from '@/components/posthog-provider'
import { PreviewProvider } from '@/lib/preview-context'
import { PreviewToggle } from '@/components/dev/preview-toggle'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <SettingsProvider>
        <ToastProvider>
          <ResearchProvider>
            <PreviewProvider>
              {children}
              {process.env.NODE_ENV !== 'production' && <PreviewToggle />}
            </PreviewProvider>
          </ResearchProvider>
          <ToastContainer />
        </ToastProvider>
      </SettingsProvider>
    </PostHogProvider>
  )
}
