'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ManualPortfolioForm } from '@/components/manual-portfolio-form';
import { PortfolioImport } from '@/components/portfolio-import';
import { ManualHoldingsEditor } from '@/components/manual-holdings-editor';
import type { ImportedRow } from '@/lib/portfolio-import';

export default function AddHoldingsPage() {
  const router = useRouter();
  // An import SEEDS the form; it never saves. The key remount is what lets a
  // second import replace the first instead of stacking onto it.
  const [seed, setSeed] = useState<{ rows: ImportedRow[]; n: number } | null>(null);

  return (
    <div className="px-6 sm:px-7 py-7 pb-16 max-w-[1100px] mx-auto">
      <div className="mb-[22px]">
        <div
          className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Import or manual entry
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)]">
          Add holdings
        </h1>
        {/* Said both ways on purpose. The page has always led with the importer
            and was headed "Add a holding by hand", so anyone arriving from a
            link that offered to import their book was told at the door that
            this was not the place. It is the place. */}
        <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed mt-1.5">
          For brokers Plaid does not reach, and anything else Helm cannot sync. Start from a
          screenshot or a CSV export, or type positions in by hand. Prices update via live market
          data, and cost basis is what makes the tax figure possible.
        </p>
        <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-[var(--color-bg-inset)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-gold)] text-[15px] mt-0.5 shrink-0">&#9432;</span>
          <p className="text-[14px] text-[var(--color-text-muted)] leading-relaxed" style={{ fontFamily: 'var(--font-mono)' }}>
            Manual holdings let you see positions immediately without waiting for brokerage sync. They stay yours to manage: connecting a brokerage later does not remove them, so if that broker already holds the same ticker, remove the hand-entered copy above to avoid counting one position twice.
          </p>
        </div>
      </div>

      {/* Settings has linked here as "Add or edit" all along; this is the edit
          half. It renders nothing when there is nothing hand-entered. */}
      <ManualHoldingsEditor />

      <PortfolioImport onExtracted={(rows) => setSeed(prev => ({ rows, n: (prev?.n ?? 0) + 1 }))} />

      {seed && seed.rows.length > 0 && (
        <p className="mb-3 text-[14px] text-[var(--color-text-secondary)]">
          Found {seed.rows.length} position{seed.rows.length === 1 ? '' : 's'}. Check them against
          your account, fix anything wrong, then save.
        </p>
      )}

      <ManualPortfolioForm
        key={seed?.n ?? 0}
        seedRows={seed?.rows}
        onComplete={() => router.push('/dashboard/portfolio')}
      />
    </div>
  );
}
