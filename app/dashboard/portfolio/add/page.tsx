'use client';

import { useRouter } from 'next/navigation';
import { ManualPortfolioForm } from '@/components/manual-portfolio-form';

export default function AddHoldingsPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-[90vw] sm:max-w-xl lg:max-w-2xl">
      <div className="space-y-2 mb-8">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[var(--color-text-muted)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            HELM
          </span>
          <span className="text-[11px] text-[var(--color-text-muted)]">/</span>
          <span
            className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[var(--color-text-muted)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            ADD HOLDINGS
          </span>
        </div>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-[var(--color-text-primary)]">
          Add your holdings
        </h1>
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
          Enter your positions below. Prices update automatically via live market data.
          Cost basis is optional but unlocks tax-loss harvesting insights.
        </p>
      </div>

      <ManualPortfolioForm
        onComplete={() => router.push('/dashboard/portfolio')}
      />
    </div>
  );
}
