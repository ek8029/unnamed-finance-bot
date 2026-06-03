'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTier } from '@/hooks/use-tier';
import { CheckoutModal } from '@/components/checkout-modal';

const DISMISS_KEY = 'helm_founding_banner_dismissed';
const FOUNDING_CAP = 50;

export function FoundingMemberBanner() {
  const { isPro, loading: tierLoading } = useTier();
  const [dismissed, setDismissed] = useState(true); // Start hidden to prevent flash
  const [spotsUsed, setSpotsUsed] = useState<number | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    // Check if previously dismissed
    const wasDismissed = sessionStorage.getItem(DISMISS_KEY);
    if (!wasDismissed) setDismissed(false);
  }, []);

  useEffect(() => {
    if (isPro || tierLoading) return;

    async function fetchSpots() {
      try {
        const res = await fetch('/api/founding-member-count');
        if (res.ok) {
          const data = await res.json();
          setSpotsUsed(data.count ?? 0);
        }
      } catch {
        // Fail silently
      }
    }
    fetchSpots();
  }, [isPro, tierLoading]);

  if (tierLoading || isPro || dismissed || spotsUsed === null) return null;

  const spotsRemaining = Math.max(0, FOUNDING_CAP - spotsUsed);
  if (spotsRemaining === 0) return null;

  return (
    <>
      <div className="relative mx-3 sm:mx-4 mt-4 mb-2 rounded-[var(--radius-md)] border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-[11px] uppercase tracking-[0.15em] font-bold text-[var(--color-gold)] shrink-0"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Founding Member
          </span>
          <span className="text-[13px] text-[var(--color-text-secondary)] truncate">
            $4.99/mo locked forever.{' '}
            <span className="font-semibold text-[var(--color-text-primary)]">
              {spotsRemaining} of {FOUNDING_CAP} spots remaining.
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCheckout(true)}
            className="px-4 py-1.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[12px] font-semibold rounded-[var(--radius-md)] cursor-pointer transition-colors"
          >
            Claim your spot
          </button>
          <button
            onClick={() => {
              setDismissed(true);
              sessionStorage.setItem(DISMISS_KEY, '1');
            }}
            className="p-1 rounded-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          billingPeriod="founding"
          onClose={() => setShowCheckout(false)}
        />
      )}
    </>
  );
}
