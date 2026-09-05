import Link from 'next/link';
import { headers } from 'next/headers';

/**
 * The reasons people hold this, and what would break them.
 *
 * /analyze was a competent AI stock summary and nothing else: no pillar, no
 * thesis, no breaks-if anywhere in the route. The homepage hero promises "The
 * Read" and cites a real filing catch, then sends people here, so the promise
 * and the destination were different products. It also left 130 indexed pages
 * saying what any free chatbot says, which is why they rank and convert
 * nothing.
 *
 * The scan behind this is the same one onboarding uses, and it is already
 * public and unauthenticated. Renders nothing when there is no house thesis
 * for the ticker, which is most of them.
 */

interface Pillar {
  id: string;
  claim: string;
  status?: string;
  statusLabel?: string;
}

interface Scan {
  house: boolean;
  ticker: string;
  company?: string;
  health?: string;
  healthLabel?: string;
  asOfDate?: string;
  pillarCount?: number;
  catchCount?: number;
  pillars?: Pillar[];
}

async function getScan(ticker: string): Promise<Scan | null> {
  try {
    const h = await headers();
    const host = h.get('host');
    if (!host) return null;
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    const res = await fetch(`${proto}://${host}/api/scan/ticker?symbol=${encodeURIComponent(ticker)}`, {
      // Same cadence as the analysis on this page. A house thesis moves when
      // filings land, not per request, and this is a public page.
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Scan;
  } catch {
    return null;
  }
}

const TONE: Record<string, string> = {
  intact: 'var(--color-positive)',
  weakening: 'var(--color-gold)',
  broken: 'var(--color-negative)',
};

export async function ThesisPanel({ ticker }: { ticker: string }) {
  const scan = await getScan(ticker);
  if (!scan?.house || !scan.pillars?.length) return null;

  const name = scan.company ?? ticker;

  return (
    <section className="mt-8 border-t border-[var(--color-border-subtle)] pt-6 max-w-3xl mx-auto">
      <h2 className="type-h2 text-[var(--color-text-primary)]">
        Why people own {ticker}, and what would break it
      </h2>
      <p className="mt-2 text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
        A price target is a guess. These are the reasons {name} is held, written down as claims that
        can be tested. Helm reads filings and reporting against each one and keeps the sentence that
        changed it.
        {scan.asOfDate ? ` Last checked ${scan.asOfDate}.` : ''}
      </p>

      <ul className="mt-5 space-y-3">
        {scan.pillars.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-4"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: TONE[p.status ?? ''] ?? 'var(--color-text-muted)' }}
              />
              <div className="min-w-0">
                <p className="text-[15px] text-[var(--color-text-primary)] leading-snug mb-0">{p.claim}</p>
                {p.statusLabel && (
                  <p
                    className="mt-1.5 mb-0 text-[12px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {p.statusLabel}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {typeof scan.catchCount === 'number' && scan.catchCount > 0 && (
        <p className="mt-4 mb-0 text-[13px] text-[var(--color-text-secondary)]">
          Helm has already logged {scan.catchCount} piece{scan.catchCount === 1 ? '' : 's'} of
          evidence against {ticker}, each quoted from the document it came from.
        </p>
      )}

      <Link
        href="/signup"
        className="inline-flex items-center gap-2 mt-5 text-[14px] font-semibold text-[var(--color-gold)] hover:underline underline-offset-4"
      >
        Write your own reasons and have Helm watch them &rarr;
      </Link>
    </section>
  );
}
