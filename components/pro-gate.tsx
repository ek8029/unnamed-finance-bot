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

type BillingPeriod = 'monthly' | 'annual' | 'lifetime' | 'founding';

const PLANS: {
  period: BillingPeriod;
  label: string;
  price: string;
  unit: string;
  note: string | null;
  save: string | null;
  badge: string | null;
}[] = [
  { period: 'founding', label: 'Founding Member', price: '$4.99', unit: '/mo', note: 'Locked at $4.99/mo forever', save: 'Save 67%', badge: '50 spots' },
  { period: 'monthly',  label: 'Monthly',  price: '$14.99', unit: '/mo',   note: null,                save: null, badge: null },
  { period: 'annual',   label: 'Annual',   price: '$9.99',  unit: '/mo',   note: 'Billed $119/year',  save: 'Save 33%', badge: null },
  { period: 'lifetime', label: 'Lifetime', price: '$249',   unit: '',      note: 'One-time payment',  save: null, badge: null },
];

export function ProGate({ feature, description }: ProGateProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [selected, setSelected] = useState<BillingPeriod>('founding');

  const plan = PLANS.find(p => p.period === selected)!;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">

        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-8">
          <HelmMark size={24} />
          <div className="h-px flex-1 bg-[var(--color-border-base)]" />
          <span
            className="text-[12px] uppercase tracking-[0.2em] text-[var(--color-gold)] font-medium"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Pro
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-[28px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-3">
          {feature}
        </h2>
        <p className="text-[16px] text-[var(--color-text-secondary)] leading-relaxed mb-10">
          {description}
        </p>

        {/* Plan options */}
        <div className="space-y-3 mb-8">
          {PLANS.map((p) => {
            const active = selected === p.period;
            return (
              <button
                key={p.period}
                onClick={() => setSelected(p.period)}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-[var(--radius-md)] border cursor-pointer transition-colors duration-150 text-left ${
                  active
                    ? 'border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]'
                    : 'border-[var(--color-border-base)] bg-transparent hover:border-[var(--color-border-strong)]'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Radio dot */}
                  <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150 ${
                    active
                      ? 'border-[var(--color-gold)]'
                      : 'border-[var(--color-border-strong)]'
                  }`}>
                    {active && (
                      <div className="w-[8px] h-[8px] rounded-full bg-[var(--color-gold)]" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[16px] font-medium ${
                        active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                      }`}>
                        {p.label}
                      </span>
                      {p.save && (
                        <span
                          className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-positive)] px-2 py-0.5 rounded-sm bg-[rgba(74,222,128,0.08)]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {p.save}
                        </span>
                      )}
                      {p.badge && (
                        <span
                          className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-gold)] px-2 py-0.5 rounded-sm bg-[rgba(230,185,77,0.08)]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {p.badge}
                        </span>
                      )}
                    </div>
                    {p.note && (
                      <span className="text-[13px] text-[var(--color-text-muted)] mt-0.5 block" style={{ fontFamily: 'var(--font-mono)' }}>
                        {p.note}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <span className={`text-[18px] font-bold tabular-nums ${
                    active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`}>
                    {p.price}
                  </span>
                  <span className={`text-[13px] ${
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
          className="group w-full flex items-center justify-center gap-2.5 px-8 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[15px] rounded-[var(--radius-md)] cursor-pointer transition-colors duration-200 mb-6"
        >
          Continue with {plan.label}
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>

        {/* Fine print */}
        <div className="flex items-center justify-between text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
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
