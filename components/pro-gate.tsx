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

const PLANS: {
  period: BillingPeriod;
  label: string;
  price: string;
  unit: string;
  note: string | null;
  save: string | null;
}[] = [
  { period: 'monthly',  label: 'Monthly',  price: '$14.99', unit: '/mo',   note: null,                save: null },
  { period: 'annual',   label: 'Annual',   price: '$9.99',  unit: '/mo',   note: 'Billed $119/year',  save: 'Save 33%' },
  { period: 'lifetime', label: 'Lifetime', price: '$249',   unit: '',      note: 'One-time payment',  save: null },
];

export function ProGate({ feature, description }: ProGateProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [selected, setSelected] = useState<BillingPeriod>('annual');

  const plan = PLANS.find(p => p.period === selected)!;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">

        {/* Eyebrow */}
        <div className="flex items-center gap-2.5 mb-6">
          <HelmMark size={18} />
          <div className="h-px flex-1 bg-[var(--color-border-base)]" />
          <span
            className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)] font-medium"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Pro
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-[22px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-2">
          {feature}
        </h2>
        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-8">
          {description}
        </p>

        {/* Plan options — radio-style list, not cards */}
        <div className="space-y-2 mb-6">
          {PLANS.map((p) => {
            const active = selected === p.period;
            return (
              <button
                key={p.period}
                onClick={() => setSelected(p.period)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius-md)] border cursor-pointer transition-colors duration-150 text-left ${
                  active
                    ? 'border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]'
                    : 'border-[var(--color-border-base)] bg-transparent hover:border-[var(--color-border-strong)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Radio dot */}
                  <div className={`w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150 ${
                    active
                      ? 'border-[var(--color-gold)]'
                      : 'border-[var(--color-border-strong)]'
                  }`}>
                    {active && (
                      <div className="w-[6px] h-[6px] rounded-full bg-[var(--color-gold)]" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-medium ${
                        active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                      }`}>
                        {p.label}
                      </span>
                      {p.save && (
                        <span
                          className="text-[9px] uppercase tracking-wider font-semibold text-[var(--color-positive)] px-1.5 py-0.5 rounded-sm bg-[rgba(74,222,128,0.08)]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {p.save}
                        </span>
                      )}
                    </div>
                    {p.note && (
                      <span className="text-[11px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                        {p.note}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <span className={`text-[15px] font-bold tabular-nums ${
                    active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`}>
                    {p.price}
                  </span>
                  <span className={`text-[11px] ${
                    active ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'
                  }`}>
                    {p.unit}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <button
          onClick={() => setShowCheckout(true)}
          className="group w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[13px] rounded-[var(--radius-md)] cursor-pointer transition-colors duration-200 mb-4"
        >
          Continue with {plan.label}
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>

        {/* Fine print */}
        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
          <Link
            href="/dashboard"
            className="hover:text-[var(--color-text-secondary)] transition-colors duration-150 cursor-pointer"
          >
            &larr; Back
          </Link>
          <span>Cancel anytime &middot; Secure via Stripe</span>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          billingPeriod={selected}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </div>
  );
}
