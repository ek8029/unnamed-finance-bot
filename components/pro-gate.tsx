'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { CheckoutModal } from '@/components/checkout-modal';

interface ProGateProps {
  feature: string;
  description: string;
}

export function ProGate({ feature, description }: ProGateProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual' | 'lifetime'>('annual');

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div
        className="rounded-sm px-8 py-16 text-center"
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-gold-border)',
        }}
      >
        <div
          className="w-14 h-14 rounded-sm mx-auto mb-5 flex items-center justify-center"
          style={{
            background: 'var(--color-gold-surface)',
            border: '1px solid var(--color-gold-border)',
          }}
        >
          <Lock className="w-6 h-6 text-[var(--color-gold)]" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)] mb-2">
          {feature}
        </h2>
        <p className="text-[13px] text-[var(--color-text-secondary)] max-w-md mx-auto mb-6 leading-relaxed">
          {description}
        </p>

        {/* Plan selector */}
        <div className="flex gap-2 justify-center mb-4">
          {[
            { period: 'monthly' as const, label: '$14.99/mo' },
            { period: 'annual' as const, label: '$9.99/mo (billed yearly)' },
            { period: 'lifetime' as const, label: '$249 one-time' },
          ].map(({ period, label }) => (
            <button
              key={period}
              onClick={() => setBillingPeriod(period)}
              className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${
                billingPeriod === period
                  ? 'border-[var(--color-gold)] bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                  : 'border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCheckout(true)}
          className="w-full max-w-sm px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded-sm transition-colors text-sm"
        >
          Upgrade to Pro
        </button>

        {showCheckout && (
          <CheckoutModal
            billingPeriod={billingPeriod}
            onClose={() => setShowCheckout(false)}
          />
        )}

        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-5 py-2.5 text-sm font-medium rounded-[2px] border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>

        <p
          className="text-[10px] text-[var(--color-text-muted)] mt-6"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Pro includes unlimited AI analysis, tax-loss harvesting, earnings impact, Portfolio Wrapped, and more.
        </p>
      </div>
    </div>
  );
}
