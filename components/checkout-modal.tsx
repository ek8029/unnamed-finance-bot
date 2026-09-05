'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { X, Loader2, Check } from 'lucide-react';
import posthog from 'posthog-js';
import { signupUrlForIntent } from '@/lib/checkout-intent';

// Initialize once at module level
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

// A local copy on purpose: lib/stripe.ts pulls in the server SDK and cannot be
// imported from a client component. Keep it in step with BillingPeriod there.
// 'max' was retired Aug 2026 and is gone from both.
type BillingPeriod = 'pro' | 'pro_annual';
type Mode = 'loading' | 'checkout' | 'upgraded' | 'error';

interface CheckoutModalProps {
  billingPeriod: BillingPeriod;
  onClose: () => void;
  /** Stacking override. The onboarding overlay is z-[100], so a card form
   *  opened on the dashboard has to be told to sit above it. */
  zClassName?: string;
}

export function CheckoutModal({ billingPeriod, onClose, zClassName = 'z-50' }: CheckoutModalProps) {
  const tierName = 'Pro';
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
          // A logged-out visitor clicking the buy button used to be shown the
          // literal string "Unauthorized" with nowhere to go. Send them to
          // sign up and resume the same purchase on the other side.
          if (res.status === 401) {
            window.location.href = signupUrlForIntent(billingPeriod);
            return;
          }
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

  // Dialog behaviour. This had role="dialog" and aria-modal but none of what
  // those promise: focus stayed on the trigger behind the backdrop, Tab walked
  // the page underneath, Escape did nothing, and the background scrolled. On the
  // one surface where someone hands over a card, that is worth getting right.
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Move focus in, and put it back where it came from on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Trap. Stripe renders its card fields in a cross-origin iframe, which
      // browsers keep inside this cycle, so the wrap only needs to cover our
      // own focusables.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className={`fixed inset-0 ${zClassName} flex items-center justify-center bg-black/60 backdrop-blur-sm`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="checkout-modal-title"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg mx-4 rounded-sm overflow-hidden"
        style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border-base)' }}
        >
          <span id="checkout-modal-title" className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Upgrade to Helm {tierName}
          </span>
          <button
            ref={closeRef}
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
