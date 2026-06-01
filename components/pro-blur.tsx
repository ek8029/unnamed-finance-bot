'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { CheckoutModal } from '@/components/checkout-modal';

interface ProBlurProps {
  /** What the user sees when hovering or reading the CTA */
  label?: string;
  /** Optional inline description below the label */
  description?: string;
  /** The content to blur (not needed for inline variant) */
  children?: React.ReactNode;
  /** How many lines of blurred content to show before fade (controls min-height) */
  minHeight?: string;
  /** Whether to show the compact inline style vs the card overlay style */
  variant?: 'overlay' | 'inline';
}

export function ProBlur({
  label = 'Unlock with Pro',
  description,
  children,
  minHeight = '120px',
  variant = 'overlay',
}: ProBlurProps) {
  const [showCheckout, setShowCheckout] = useState(false);

  if (variant === 'inline') {
    return (
      <>
        <button
          onClick={() => setShowCheckout(true)}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] hover:bg-[rgba(230,185,77,0.12)] transition-colors cursor-pointer"
        >
          <Lock className="w-3 h-3 text-[var(--color-gold)]" />
          <span className="text-[12px] font-medium text-[var(--color-gold)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {label}
          </span>
        </button>

        {showCheckout && (
          <CheckoutModal
            billingPeriod="founding"
            onClose={() => setShowCheckout(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="relative rounded-[var(--radius-md)] overflow-hidden" style={{ minHeight }}>
        {/* Blurred content */}
        <div
          className="select-none pointer-events-none"
          style={{ filter: 'blur(6px)', opacity: 0.5 }}
          aria-hidden="true"
        >
          {children}
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-base)]/60 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 max-w-sm text-center">
            <div className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-[var(--color-gold)]" />
            </div>

            <div>
              <p className="text-[17px] font-semibold text-[var(--color-text-primary)] mb-1.5">
                {label}
              </p>
              {description && (
                <p className="text-[14px] text-[var(--color-text-muted)] leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            <button
              onClick={() => setShowCheckout(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[14px] rounded-[var(--radius-md)] cursor-pointer transition-colors"
            >
              Upgrade for $4.99/mo
            </button>

            <Link
              href="/pricing"
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              See all plans
            </Link>
          </div>
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
