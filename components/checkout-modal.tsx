'use client';

import { useState, useCallback, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { X, Loader2, Check } from 'lucide-react';
import posthog from 'posthog-js';

// Initialize once at module level
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type BillingPeriod = 'pro' | 'max';
type Mode = 'loading' | 'checkout' | 'upgraded' | 'error';

interface CheckoutModalProps {
  billingPeriod: BillingPeriod;
  onClose: () => void;
}

export function CheckoutModal({ billingPeriod, onClose }: CheckoutModalProps) {
  const tierName = billingPeriod === 'max' ? 'Max' : 'Pro';
  const [mode, setMode] = useState<Mode>('loading');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hit the checkout endpoint once. It either returns a clientSecret (new
  // subscription -> embedded checkout) or { upgraded: true } (in-place Pro->Max
  // price swap, no checkout needed).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The gap between paywall_cta_clicked and this is the pricing page;
        // the gap between this and trial_started is the Stripe form itself.
        posthog.capture('checkout_started', { plan: billingPeriod });
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billingPeriod }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError((data?.error as string) || 'Something went wrong. Please try again.');
          setMode('error');
          return;
        }
        if (data?.upgraded) {
          setMode('upgraded');
          return;
        }
        if (data?.clientSecret) {
          setClientSecret(data.clientSecret as string);
          setMode('checkout');
          return;
        }
        setError('Something went wrong. Please try again.');
        setMode('error');
      } catch {
        if (!cancelled) {
          setError('Something went wrong. Please try again.');
          setMode('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [billingPeriod]);

  // EmbeddedCheckout pulls its secret from here (already fetched above).
  const fetchClientSecret = useCallback(
    () => Promise.resolve(clientSecret ?? ''),
    [clientSecret],
  );

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-sm overflow-hidden"
        style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border-base)' }}
        >
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Upgrade to Helm {tierName}
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

        {/* Body */}
        <div className="p-5">
          {!stripePromise && (
            <div
              className="rounded-sm px-4 py-3 text-[15px]"
              style={{ background: 'rgba(230,185,77,0.08)', border: '1px solid rgba(230,185,77,0.2)', color: 'var(--color-gold)' }}
            >
              Checkout is not available right now. Please contact support.
            </div>
          )}

          {stripePromise && mode === 'loading' && (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-gold)' }} />
            </div>
          )}

          {stripePromise && mode === 'error' && (
            <div
              className="rounded-sm px-4 py-3 text-[15px]"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
            >
              {error}
            </div>
          )}

          {stripePromise && mode === 'upgraded' && (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div
                className="flex items-center justify-center w-12 h-12 rounded-full"
                style={{ background: 'rgba(255,214,122,0.12)', border: '1px solid #FFD67A' }}
              >
                <Check className="w-6 h-6" style={{ color: '#FFD67A' }} />
              </div>
              <div>
                <div className="text-[17px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  You&apos;re on Max
                </div>
                <p className="mt-1.5 text-[14px] leading-[1.55]" style={{ color: 'var(--color-text-muted)' }}>
                  Your plan was upgraded and prorated. The analyst, factor lens, and builder are unlocked.
                </p>
              </div>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-md font-semibold text-[14px]"
                style={{ background: '#FFD67A', color: 'var(--color-bg-base)' }}
              >
                Go to dashboard
              </a>
            </div>
          )}

          {stripePromise && mode === 'checkout' && clientSecret && (
            <div className="relative min-h-[320px]">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
