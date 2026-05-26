'use client'

import { useToast } from '@/contexts/toast-context'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 md:left-auto z-50 p-4 md:p-6 pointer-events-none">
      <div className="flex flex-col gap-3 w-full md:min-w-[320px] max-w-[420px] ml-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto',
              'bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)]',
              'rounded-md shadow-lg',
              'p-4 pr-10',
              'relative',
              'animate-slide-in-bottom',
              'transition-[opacity,transform] duration-200'
            )}
          >
            <button
              onClick={() => removeToast(toast.id)}
              className="absolute top-3 right-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[var(--color-positive)]" />}
                {toast.type === 'error' && <XCircle className="w-5 h-5 text-[var(--color-negative)]" />}
                {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-[var(--color-gold)]" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="type-h3 mb-1">{toast.title}</div>
                {toast.message && <div className="type-body text-[var(--color-text-secondary)]">{toast.message}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
