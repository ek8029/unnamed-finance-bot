'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Crown,
  Zap,
  TrendingDown,
  BarChart3,
  Sparkles,
  Shield,
  Check,
  ArrowRight,
} from 'lucide-react';
import { CheckoutModal } from '@/components/checkout-modal';

interface ProGateProps {
  feature: string;
  description: string;
}

const PRO_BENEFITS = [
  { icon: Zap, text: 'Unlimited AI stock analysis' },
  { icon: TrendingDown, text: 'Tax-loss harvesting with wash-sale detection' },
  { icon: BarChart3, text: 'Earnings exposure tracking' },
  { icon: Sparkles, text: 'Portfolio Wrapped & full intelligence feed' },
  { icon: Shield, text: '30-day money-back guarantee' },
];

const PLANS = [
  {
    period: 'monthly' as const,
    label: 'Monthly',
    price: '$14.99',
    unit: '/mo',
    sublabel: null,
  },
  {
    period: 'annual' as const,
    label: 'Annual',
    price: '$9.99',
    unit: '/mo',
    sublabel: 'Billed $119/yr — save 33%',
    recommended: true,
  },
  {
    period: 'lifetime' as const,
    label: 'Lifetime',
    price: '$249',
    unit: ' once',
    sublabel: 'Pay once, yours forever',
  },
];

export function ProGate({ feature, description }: ProGateProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual' | 'lifetime'>('annual');

  const selectedPlan = PLANS.find(p => p.period === billingPeriod)!;

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="rounded-lg overflow-hidden border border-[var(--color-gold-border)]"
        style={{ background: 'var(--color-bg-surface)' }}
      >
        {/* Header — what they're trying to access */}
        <div className="px-8 pt-10 pb-6 text-center">
          <div
            className="w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center shadow-glow-gold"
            style={{
              background: 'var(--color-gold-surface)',
              border: '1px solid var(--color-gold-border)',
            }}
          >
            <Crown className="w-5 h-5 text-[var(--color-gold)]" />
          </div>

          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] mb-1.5">
            Unlock {feature}
          </h2>
          <p className="text-[13px] text-[var(--color-text-secondary)] max-w-lg mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Plan selector cards */}
        <div className="px-6 pb-2">
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map((plan) => {
              const isSelected = billingPeriod === plan.period;
              return (
                <button
                  key={plan.period}
                  onClick={() => setBillingPeriod(plan.period)}
                  className={`relative rounded-md p-3 text-center transition-all duration-200 border ${
                    isSelected
                      ? 'border-[var(--color-gold)] bg-[var(--color-gold-surface)] shadow-glow-gold'
                      : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  {plan.recommended && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-[var(--color-gold)] text-[var(--color-bg-base)] rounded-full whitespace-nowrap">
                      Best Value
                    </span>
                  )}
                  <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${
                    isSelected ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
                  }`} style={{ fontFamily: 'var(--font-mono)' }}>
                    {plan.label}
                  </div>
                  <div className="flex items-baseline justify-center gap-0.5">
                    <span className={`text-xl font-bold tabular-nums ${
                      isSelected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}>
                      {plan.price}
                    </span>
                    <span className={`text-[11px] ${
                      isSelected ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'
                    }`}>
                      {plan.unit}
                    </span>
                  </div>
                  {plan.sublabel && (
                    <div className={`text-[10px] mt-1 ${
                      isSelected ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
                    }`}>
                      {plan.sublabel}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* CTA button */}
        <div className="px-6 py-4">
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full py-3.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-bold rounded-md transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-glow-gold hover:shadow-[0_0_30px_rgba(230,185,77,0.25)]"
          >
            Upgrade to Pro — {selectedPlan.price}{selectedPlan.unit}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Benefits list */}
        <div className="px-6 pb-6">
          <div className="border-t border-[var(--color-border-subtle)] pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {PRO_BENEFITS.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    style={{ background: 'var(--color-gold-surface)' }}
                  >
                    <Check className="w-3 h-3 text-[var(--color-gold)]" />
                  </div>
                  <span className="text-[12px] text-[var(--color-text-secondary)]">
                    {benefit.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            &larr; Back to Dashboard
          </Link>
          <span className="text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            Cancel anytime &middot; Secure checkout via Stripe
          </span>
        </div>
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
