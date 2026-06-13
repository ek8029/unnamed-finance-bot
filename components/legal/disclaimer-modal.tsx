'use client';

import { useEffect, useState } from 'react';
import { HelmMark } from '@/components/helm-mark';
import { DISCLAIMER_VERSION } from '@/lib/disclaimer';

const DISCLAIMER_TEXT =
  'Helm provides financial information and analytics for informational and educational purposes only. Helm is not a registered investment adviser, broker-dealer, or tax adviser. Nothing on Helm is a recommendation to buy, sell, or hold any security, or any investment, financial, or tax advice. Helm does not execute trades or manage funds. All analysis is based on public data and automated models and may contain errors. You are solely responsible for your own investment decisions. Consult a licensed financial or tax professional before acting.';

/**
 * One-time clickwrap disclaimer modal.
 *
 * On mount, checks whether the user has accepted the current disclaimer version.
 * - Accepted current version -> renders nothing.
 * - Not accepted -> blocks the screen until they click agree (no X, no escape, no
 *   outside-click dismiss).
 * - Status fetch errors -> fail open (render nothing). The persistent footer
 *   disclaimer still covers the user; we never lock anyone out on a transient error.
 */
export function DisclaimerModal() {
  // null = still checking, false = needs to accept, true = already accepted / dismissed
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const res = await fetch('/api/disclaimer/accept');
        if (!res.ok) {
          // Fail open — do not hard-block on a transient/auth error.
          if (!cancelled) setAccepted(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setAccepted(Boolean(data.accepted));
      } catch (err) {
        console.error('Failed to fetch disclaimer status:', err);
        if (!cancelled) setAccepted(true);
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  // Block background scroll while the modal is open.
  useEffect(() => {
    if (accepted === false) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [accepted]);

  async function handleAgree() {
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch('/api/disclaimer/accept', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to record acceptance');
      setAccepted(true);
    } catch (err) {
      console.error('Failed to record disclaimer acceptance:', err);
      setError(true);
      setSubmitting(false);
    }
  }

  // Still checking, already accepted, or failed open.
  if (accepted !== false) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-[#050505]/90 backdrop-blur-sm grid place-items-center p-4 sm:p-6 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div
        className="relative w-full max-w-lg my-auto bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-xl shadow-2xl p-6 sm:p-8"
        style={{ animation: 'disc-fade-up 0.4s ease-out' }}
      >
        <style jsx>{`
          @keyframes disc-fade-up {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Eyebrow */}
        <div className="flex items-center gap-2.5 mb-4">
          <HelmMark size={24} />
          <span className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
            Before you start
          </span>
        </div>

        <h2
          id="disclaimer-title"
          className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight"
        >
          Helm is information, not advice
        </h2>

        <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
          {DISCLAIMER_TEXT}
        </p>

        <button
          onClick={handleAgree}
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-[var(--color-gold)] px-5 py-3 text-[14px] font-semibold text-[#0A0A0A] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'I understand and agree'}
        </button>

        {error && (
          <p className="mt-3 text-center text-[12px] text-[var(--color-negative)]">
            Something went wrong. Please tap the button again.
          </p>
        )}
      </div>
    </div>
  );
}
