'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

interface ProGateProps {
  feature: string;
  description: string;
}

/**
 * Full-page upgrade wall shown in place of Pro-only pages for free users.
 */
export function ProGate({ feature, description }: ProGateProps) {
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

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-[2px] bg-[#B8914A] text-[#070C17] hover:bg-[#C9A45E] transition-colors"
          >
            Upgrade to Pro
          </Link>
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
