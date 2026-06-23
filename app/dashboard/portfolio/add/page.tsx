'use client';

import { useRouter } from 'next/navigation';
import { ManualPortfolioForm } from '@/components/manual-portfolio-form';

export default function AddHoldingsPage() {
  const router = useRouter();

  return (
    <div className="px-6 sm:px-7 py-7 pb-16 max-w-[1100px] mx-auto">
      <div className="mb-[22px]">
        <div
          className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Manual entry
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)]">
          Add a holding by hand
        </h1>
        <p className="text-[14px] text-[var(--color-text-muted)] leading-relaxed mt-1.5">
          For assets Helm cannot sync automatically. Prices update via live market data, and cost
          basis unlocks tax-loss harvesting insights.
        </p>
        <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-[var(--color-bg-inset)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-gold)] text-[14px] mt-0.5 shrink-0">&#9432;</span>
          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed" style={{ fontFamily: 'var(--font-mono)' }}>
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
