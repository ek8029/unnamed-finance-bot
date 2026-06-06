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
        <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-gold)] text-[13px] mt-0.5 shrink-0">&#9432;</span>
          <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed" style={{ fontFamily: 'var(--font-mono)' }}>
            Manual holdings let you see positions immediately without waiting for brokerage sync. If you connect a brokerage via Plaid that holds the same tickers, the manual entries will be automatically replaced with your real brokerage data on the next sync.
          </p>
        </div>
      </div>

      <ManualPortfolioForm
        onComplete={() => router.push('/dashboard/portfolio')}
      />
    </div>
  );
}
