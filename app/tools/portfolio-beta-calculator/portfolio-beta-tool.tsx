'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Shield, X } from 'lucide-react';
import { computePortfolioBeta, MAX_ROWS, type BetaRow } from '@/lib/portfolio-beta';
import { parseAmount } from '@/lib/wash-sale';

interface Row {
  id: number;
  label: string;
  marketValue: string;
  beta: string;
}

// The reader-facing parser lives in lib/wash-sale.ts so it can be tested.
const num = parseAmount;

/** Beta can be negative, unlike a dollar amount, so it gets its own parser. */
function parseBeta(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Typed something, and it is not a number this page will price. */
const unreadable = (raw: string) => raw.trim() !== '' && num(raw) === null;
const betaUnreadable = (raw: string) => raw.trim() !== '' && parseBeta(raw) === null;

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const pct = (n: number) => `${(n * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
const beta2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FIELD_ERROR = 'mt-1.5 block text-[12.5px] text-[var(--color-negative)]';
const BAD_NUMBER = 'Enter a number, like 4200 or 4,200.50.';
const BAD_BETA = 'Enter a number, like 1.2 or -0.8.';

const LABEL =
  'block font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2';
const INPUT =
  'w-full min-h-[44px] rounded-lg border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] px-3 py-2.5 font-mono text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-gold)] focus:outline-none transition-colors';
const TH = 'px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]';
const TD = 'px-4 py-3 font-mono';

let idCounter = 3;

export function PortfolioBetaTool() {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, label: 'VOO', marketValue: '40000', beta: '1.0' },
    { id: 2, label: 'QQQ', marketValue: '20000', beta: '1.2' },
  ]);
  const [cash, setCash] = useState('10000');

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    setRows([...rows, { id: idCounter++, label: '', marketValue: '', beta: '' }]);
  };
  const patch = (id: number, next: Partial<Row>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...next } : r)));

  const complete = rows.filter(
    (r) => r.label.trim() !== '' && num(r.marketValue) !== null && parseBeta(r.beta) !== null,
  );
  const skipped = rows.length - complete.length;

  const cashValue = cash.trim() === '' ? 0 : num(cash);

  const result = useMemo(() => {
    if (cashValue === null) return null;
    const betaRows: BetaRow[] = complete.map((r) => ({
      label: r.label.trim(),
      marketValue: num(r.marketValue) as number,
      beta: parseBeta(r.beta) as number,
    }));
    return computePortfolioBeta({ rows: betaRows, cash: cashValue });
  }, [complete, cashValue]);

  const blocker = (() => {
    if (result) return null;
    if (cashValue === null) return 'The cash amount is not a number this page can read.';
    if (rows.some((r) => (r.marketValue.trim() !== '' || r.beta.trim() !== '') && r.label.trim() === '')) {
      return 'Give each row with a value a label so the results can name it.';
    }
    if (complete.length === 0 && cashValue === 0) {
      return 'Add at least one holding with a market value and a beta, or a cash amount.';
    }
    return 'Enter at least one holding with a market value and a beta.';
  })();

  const topThree = result
    ? [...result.rows].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3)
    : [];

  return (
    <section className="relative z-10 container mx-auto px-6 pt-14 pb-10 max-w-3xl">
      <h1 className="type-h1 mb-3">Portfolio Beta Calculator</h1>
      <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
        Enter each holding&rsquo;s market value and its beta, and this works out the weighted-average beta of the
        whole book: how much the portfolio should move for a given move in the index, based on the numbers typed
        in. Free, no signup.
      </p>

      {/* The limit, stated before any number is shown. */}
      <div className="mb-8 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-gold)] mb-1.5">
          Where the beta figures come from
        </p>
        <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">This tool does not fetch beta.</strong> Beta is
          typed in per holding, read off a brokerage position page or a data site such as a broker&rsquo;s research
          tab or a financial data provider. Different sources compute beta over different lookback windows and
          against different benchmarks, so the same ticker can show a different beta in two places. Cash is always
          treated as beta 0. Up to {MAX_ROWS} holdings.
        </p>
      </div>

      {/* ── Inputs ── */}
      <h2 className="type-h2 mb-1.5">Your holdings</h2>
      <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
        Market value is what that position is worth today. Beta can be negative, for something like an inverse
        fund that moves opposite the index.
      </p>

      <div className="space-y-3 mb-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-[var(--color-border-base)] p-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <label className="block">
              <span className={LABEL}>Label</span>
              <input
                type="text"
                value={r.label}
                onChange={(e) => patch(r.id, { label: e.target.value })}
                placeholder="VOO"
                className={INPUT}
                aria-label="Holding label"
              />
            </label>
            <label className="block">
              <span className={LABEL}>Market value ($)</span>
              <input
                type="text"
                inputMode="decimal"
                value={r.marketValue}
                onChange={(e) => patch(r.id, { marketValue: e.target.value })}
                placeholder="40000"
                className={INPUT}
                aria-label="Market value in dollars"
                aria-invalid={unreadable(r.marketValue)}
              />
              {unreadable(r.marketValue) && <span className={FIELD_ERROR}>{BAD_NUMBER}</span>}
            </label>
            <label className="block">
              <span className={LABEL}>Beta</span>
              <input
                type="text"
                inputMode="decimal"
                value={r.beta}
                onChange={(e) => patch(r.id, { beta: e.target.value })}
                placeholder="1.0"
                className={INPUT}
                aria-label="Beta"
                aria-invalid={betaUnreadable(r.beta)}
              />
              {betaUnreadable(r.beta) && <span className={FIELD_ERROR}>{BAD_BETA}</span>}
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                aria-label="Remove this holding"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_ROWS}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--color-border-base)] px-4 text-[14px] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add another holding
        </button>
        {skipped > 0 && (
          <span className="text-[12.5px] text-[var(--color-text-muted)]">
            {skipped} row{skipped === 1 ? '' : 's'} with a blank label, value or beta{' '}
            {skipped === 1 ? 'is' : 'are'} not counted.
          </span>
        )}
      </div>

      <label className="block mb-10 max-w-sm">
        <span className={LABEL}>Cash and cash equivalents ($)</span>
        <input
          type="text"
          inputMode="decimal"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          placeholder="10000"
          className={INPUT}
          aria-label="Cash and cash equivalents in dollars"
          aria-invalid={unreadable(cash)}
        />
        {unreadable(cash) ? (
          <span className={FIELD_ERROR}>{BAD_NUMBER}</span>
        ) : (
          <span className="mt-1.5 block text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
            Treated as beta 0. Leave at 0 if the book is fully invested.
          </span>
        )}
      </label>

      {/* ── Result ── */}
      {!result ? (
        <p className="mb-10 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{blocker}</p>
      ) : (
        <>
          <h2 className="type-h2 mb-3">Portfolio beta: {beta2(result.portfolioBeta)}</h2>

          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Portfolio beta</p>
              <p className="font-mono text-2xl text-[var(--color-gold)]">{beta2(result.portfolioBeta)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                The weighted average of every row&rsquo;s beta, cash included at 0.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>Cash weight</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">{pct(result.cashWeight)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {money(result.cash)} of {money(result.totalValue)} total, diluting the beta above toward zero.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className={`${LABEL} mb-2`}>From the top 3 holdings</p>
              <p className="font-mono text-2xl text-[var(--color-text-primary)]">
                {result.portfolioBeta === 0 ? 'n/a' : pct(result.topThreeShare)}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {result.portfolioBeta === 0
                  ? 'Not meaningful when the portfolio beta itself is zero.'
                  : `Share of the ${beta2(result.portfolioBeta)} portfolio beta coming from ${topThree
                      .map((r) => r.label)
                      .join(', ')}.`}
              </p>
            </div>
          </div>

          {/* Where each holding contributes */}
          <h2 className="type-h2 mb-1.5">Where each holding contributes</h2>
          <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
            Contribution is a holding&rsquo;s weight times its beta. The contributions, including cash at zero, sum
            to the portfolio beta above.
          </p>
          <div className="mb-8 overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                  <th className={TH}>Holding</th>
                  <th className={`${TH} text-right`}>Market value</th>
                  <th className={`${TH} text-right`}>Weight</th>
                  <th className={`${TH} text-right`}>Beta</th>
                  <th className={`${TH} text-right`}>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={`${r.label}-${i}`} className="border-b border-[var(--color-border-base)]">
                    <td className={`${TD} text-[var(--color-text-primary)]`}>{r.label}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(r.marketValue)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{pct(r.weight)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{beta2(r.beta)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-primary)]`}>{beta2(r.contribution)}</td>
                  </tr>
                ))}
                {result.cash > 0 && (
                  <tr className="border-b border-[var(--color-border-base)]">
                    <td className={`${TD} text-[var(--color-text-primary)]`}>Cash</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(result.cash)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{pct(result.cashWeight)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>0.00</td>
                    <td className={`${TD} text-right text-[var(--color-text-primary)]`}>0.00</td>
                  </tr>
                )}
                <tr className="bg-[var(--color-surface-tint)]">
                  <td className={`${TD} text-[var(--color-text-primary)]`}>Total</td>
                  <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>{money(result.totalValue)}</td>
                  <td className={`${TD} text-right text-[var(--color-text-secondary)]`}>100%</td>
                  <td className={TD} />
                  <td className={`${TD} text-right text-[var(--color-gold)]`}>{beta2(result.portfolioBeta)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Implied move */}
          <h2 className="type-h2 mb-1.5">What that beta implies</h2>
          <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
            A linear approximation only: multiplying the index move by the portfolio beta above. It says nothing
            about a single position moving on its own news, and it does not hold in a market that moves in a way
            this book&rsquo;s history did not capture.
          </p>
          <div className="mb-10 overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                  <th className={TH}>If the index moves</th>
                  <th className={`${TH} text-right`}>The portfolio implies</th>
                </tr>
              </thead>
              <tbody>
                {result.impliedMoves.map((m) => (
                  <tr key={m.indexMove} className="border-b border-[var(--color-border-base)] last:border-0">
                    <td className={`${TD} text-[var(--color-text-primary)]`}>{pct(m.indexMove)}</td>
                    <td className={`${TD} text-right text-[var(--color-text-primary)]`}>{pct(m.portfolioMove)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Disclaimer */}
      <div className="mb-12 flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
        <Shield className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Not investment advice. Beta figures are typed in, not fetched, and are only as current and as
          benchmark-consistent as the source they came from. Beta is a historical measure computed over a specific
          lookback window against a specific index. It changes as that window rolls forward and it can differ
          meaningfully between sources. This page computes a weighted average and a linear implied move; it does
          not model idiosyncratic risk, non-linear behavior, or a change in market regime.
        </span>
      </div>

      {/* One CTA */}
      <div className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-6">
        <h2 className="type-h2 mb-2">The part a calculator cannot do</h2>
        <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
          This page weights beta figures typed in by hand. The harder part is keeping the market values current
          across every account and knowing which few positions are actually driving that number. Helm reads the
          holdings in the accounts you connect, read-only, and shows exposure and concentration by position, so the
          weights behind a figure like this stay current without retyping them.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--color-gold)] hover:underline"
        >
          See your own exposure <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
