'use client';

// The value ledger: the dollars Helm has SURFACED on this book (harvestable tax
// savings + any insight with an estimated impact). Deliberately worded as
// "surfaced / flagged", never "made" or "returns" — it's the honest,
// deterministic value claim, not performance attribution.

import type { ValueLedger } from '@/lib/research/types';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

const KIND_LABEL: Record<string, string> = {
  tax_harvest: 'Tax',
  insight: 'Insight',
};

export function ValueLedgerCard({
  ledger,
  onAsk,
}: {
  ledger: ValueLedger;
  onAsk: (q: string) => void;
}) {
  if (!ledger || ledger.surfacedTotal <= 0) return null;

  return (
    <div className="rounded-lg border border-[rgba(230,185,77,0.25)] bg-[rgba(230,185,77,0.05)] p-4 sm:p-5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#E6B94D]" style={MONO}>
          Value Helm surfaced
        </span>
      </div>
      <div className="mt-2 text-[34px] font-bold text-[#FAFAFA] leading-none" style={MONO}>
        ${ledger.surfacedTotal.toLocaleString()}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-[1.5] text-[#8A8A8A] m-0">
        Dollars flagged on your book (e.g. potential tax savings), not investment returns. Estimates before wash-sale
        checks. Not tax advice.
      </p>

      <div className="mt-3 space-y-1.5">
        {ledger.lines.map((l, i) => (
          <div key={i} className="flex items-baseline gap-2 text-[13px]">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded shrink-0" style={{ ...MONO, color: '#E6B94D', background: 'rgba(230,185,77,0.1)' }}>
              {KIND_LABEL[l.kind] ?? l.kind}
            </span>
            <span className="text-[#C8C8C8] min-w-0 truncate">{l.label}</span>
            <span className="ml-auto text-[#FAFAFA] font-semibold shrink-0" style={MONO}>${l.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onAsk('How much has Helm surfaced for me, and where does that number come from?')}
        className="mt-3 text-[11.5px] text-[#E6B94D] hover:brightness-110"
        style={MONO}
      >
        break this down →
      </button>
    </div>
  );
}
