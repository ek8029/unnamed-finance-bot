'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { CheckoutModal } from '@/components/checkout-modal';

interface ProGateProps {
  feature: string;
  description: string;
}

type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

const PLANS: { period: BillingPeriod; label: string; price: string; detail: string }[] = [
  { period: 'monthly',  label: 'Monthly',  price: '$14.99/mo',            detail: '' },
  { period: 'annual',   label: 'Annual',   price: '$9.99/mo',             detail: 'billed $119/yr' },
  { period: 'lifetime', label: 'Lifetime', price: '$249',                 detail: 'one-time, forever' },
];

export function ProGate({ feature, description }: ProGateProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');

  const selected = PLANS.find(p => p.period === billingPeriod)!;

  return (
    <div className="container mx-auto px-6 py-16 max-w-xl">

      {/* Gold accent line + logo */}
      <div className="border-l-2 border-[var(--color-gold)] pl-5 mb-8">
        <div className="flex items-center gap-3 mb-3">
          <HelmMark size={20} />
          <span
            className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-gold)] font-semibold"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Pro
          </span>
        </div>
        <h2 className="type-h1 text-[var(--color-text-primary)] mb-2">
          {feature}
        </h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed max-w-md">
          {description}
        </p>
      </div>

      {/* What you get — reads like a brief, not a feature list */}
      <div className="mb-8 pl-5 ml-[1px]">
        <p
          className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-3"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Included with Pro
        </p>
        <div className="text-[13px] text-[var(--color-text-secondary)] leading-[1.8] space-y-0">
          <p>Unlimited AI analysis on any US ticker &middot; Tax-loss harvesting with wash-sale detection &middot; Earnings exposure tracking with dollar impact &middot; Portfolio Wrapped &amp; full intelligence feed &middot; Priority data refresh during market hours</p>
        </div>
      </div>

      {/* Plan toggle — segmented control, not 3 competing cards */}
      <div className="mb-5 pl-5 ml-[1px]">
        <div className="inline-flex rounded-[3px] border border-[var(--color-border-base)] overflow-hidden">
          {PLANS.map((plan) => {
            const isActive = billingPeriod === plan.period;
            return (
              <button
                key={plan.period}
                onClick={() => setBillingPeriod(plan.period)}
                className={`px-4 py-2 text-[12px] font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-[var(--color-gold)] text-[var(--color-bg-base)]'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {plan.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price display */}
      <div className="mb-6 pl-5 ml-[1px]">
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-bold text-[var(--color-text-primary)] tabular-nums tracking-tight">
            {selected.price}
          </span>
          {selected.detail && (
            <span className="text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {selected.detail}
            </span>
          )}
        </div>
        {billingPeriod === 'annual' && (
          <p className="text-[11px] text-[var(--color-positive)] mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
            Save 33% vs monthly
          </p>
        )}
      </div>

      {/* CTA — the only loud element */}
      <div className="pl-5 ml-[1px] mb-8">
        <button
          onClick={() => setShowCheckout(true)}
          className="group inline-flex items-center gap-2.5 px-7 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[14px] rounded-[3px] transition-all duration-200"
        >
          Upgrade to Pro
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Trust line */}
      <div className="pl-5 ml-[1px] flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          &larr; Back
        </Link>
        <span className="text-[var(--color-border-strong)]">&middot;</span>
        <span
          className="text-[10px] text-[var(--color-text-muted)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          30-day money-back guarantee &middot; Cancel anytime &middot; Stripe checkout
        </span>
      </div>

      {showCheckout && (
        <CheckoutModal
          billingPeriod={billingPeriod}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </div>
  );
}
