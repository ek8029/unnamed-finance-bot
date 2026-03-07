'use client'

import { SettingsProvider } from '@/contexts/settings-context'
import { ToastProvider } from '@/contexts/toast-context'
import { ToastContainer } from '@/components/ui/toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        {children}
        <ToastContainer />
      </ToastProvider>
    </SettingsProvider>
  )
}
