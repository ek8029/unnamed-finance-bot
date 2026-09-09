'use client';
// The receipt on the largest name: a verbatim dated citation with its verdict
// from /api/scan/ticker, or the honest fallback. The route answers 200 with
// `house: false` when Helm has no thesis on the ticker; that is the fallback,
// not an error. A network failure or a non-2xx status throws for the caller.
import { V3_COPY } from '@/lib/onboarding/v3-copy';

export type Receipt = {
  claim: string | null;
  verdict: 'supports' | 'contradicts';
  verbatimCite: string;
  dateISO: string;
  sourceLabel: string;
  sourceUrl: string | null;
};

type ScanBody = {
  house: boolean;
  pillar?: { claim: string } | null;
  receipt?: { verbatimCite: string; dateISO: string; sourceLabel: string; sourceUrl: string | null; verdict: 'supports' | 'contradicts' } | null;
};

/** Resolves to the receipt, or null when the ticker is outside coverage or has no catch yet. */
export async function fetchReceipt(ticker: string): Promise<Receipt | null> {
  const r = await fetch(`/api/scan/ticker?symbol=${encodeURIComponent(ticker)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as ScanBody;
  if (!d.house || !d.receipt) return null;
  return { claim: d.pillar?.claim ?? null, ...d.receipt };
}

export function ReceiptCard({ ticker, receipt, className }: {
  ticker: string;
  /** undefined while loading; null when nothing cites the ticker. */
  receipt: Receipt | null | undefined;
  className: string;
}) {
  const copy = V3_COPY.reveal;
  return (
    <article className={className}>
      <h3 className="text-[14px] font-medium text-[var(--color-text-primary)]">{copy.receiptHeading(ticker)}</h3>
      {receipt === undefined ? (
        <div className="mt-3 grid gap-2" aria-hidden="true">
          <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--color-surface-tint)]" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--color-surface-tint)]" />
        </div>
      ) : receipt === null ? (
        <p className="mt-3 text-[13px] text-[var(--color-text-secondary)]">{copy.receiptFallback(ticker)}</p>
      ) : (
        <div className="mt-3">
          <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${receipt.verdict === 'supports' ? 'border-[var(--color-positive)] text-[var(--color-positive)]' : 'border-[var(--color-negative)] text-[var(--color-negative)]'}`}>
            {receipt.verdict}
          </span>
          {receipt.claim && <p className="mt-2 text-[13px] text-[var(--color-text-primary)]">{receipt.claim}</p>}
          <blockquote className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">&ldquo;{receipt.verbatimCite}&rdquo;</blockquote>
          <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
            {receipt.sourceUrl ? (
              <a href={receipt.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{receipt.sourceLabel}</a>
            ) : receipt.sourceLabel}
            {' '}{receipt.dateISO}
          </p>
        </div>
      )}
    </article>
  );
}
