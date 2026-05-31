'use client';

import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { X, Loader2 } from 'lucide-react';

// Initialize once at module level
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type BillingPeriod = 'monthly' | 'annual' | 'lifetime' | 'founding';

interface CheckoutModalProps {
  billingPeriod: BillingPeriod;
  onClose: () => void;
}

export function CheckoutModal({ billingPeriod, onClose }: CheckoutModalProps) {
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    setFetchError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingPeriod }),
      });

      const data = await res.json();

      if (!res.ok) {
        const message =
          res.status === 410
            ? 'Lifetime deal is sold out.'
            : (data?.error as string) || 'Something went wrong. Please try again.';
        setFetchError(message);
        throw new Error(message);
      }

      if (!data?.clientSecret) {
        const message = 'Something went wrong. Please try again.';
        setFetchError(message);
        throw new Error(message);
      }

      return data.clientSecret as string;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setFetchError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [billingPeriod]);

  // Prevent body scroll while modal is open
  // (handled via Tailwind overflow-hidden on the overlay)

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* Modal panel — stop propagation so clicks inside don't close */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-sm overflow-hidden"
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-base)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border-base)' }}
        >
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Upgrade to Helm Pro
          </span>
          <button
            onClick={onClose}
            aria-label="Close checkout"
            className="flex items-center justify-center w-7 h-7 rounded-sm transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Checkout body */}
        <div className="p-5">
          {/* Stripe key missing */}
          {!stripePromise && (
            <div
              className="rounded-sm px-4 py-3 text-sm"
              style={{
                background: 'rgba(230,185,77,0.08)',
                border: '1px solid rgba(230,185,77,0.2)',
                color: 'var(--color-gold)',
              }}
            >
              Checkout is not available right now. Please contact support.
            </div>
          )}

          {/* Fetch error */}
          {fetchError && (
            <div
              className="rounded-sm px-4 py-3 text-sm"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
            >
              {fetchError}
            </div>
          )}

          {/* Embedded Checkout */}
          {stripePromise && !fetchError && (
            <div className="relative min-h-[320px]">
              {/* Loading overlay — hidden once EmbeddedCheckout fires its own ready state */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2
                    className="w-5 h-5 animate-spin"
                    style={{ color: 'var(--color-gold)' }}
                  />
                </div>
              )}

              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
