'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { computeOverlap, OVERLAP_FUNDS } from '@/lib/etf-overlap';

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function ETFOverlapTool() {
  const [a, setA] = useState('QQQ');
  const [b, setB] = useState('VOO');

  const result = useMemo(() => computeOverlap(a, b), [a, b]);

  const selectClass =
    'w-full rounded-lg border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] px-3 py-2.5 font-mono text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-strong)] focus:outline-none';

  return (
    <section className="relative z-10 container mx-auto px-6 pt-14 pb-10 max-w-3xl">
      <h1 className="type-h1 mb-3">ETF Overlap Tool</h1>
      <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] mb-8">
        Pick two funds and see which companies they both hold. Free, no signup.
      </p>

      {/* The limit, stated before any number is shown. */}
      <div className="mb-8 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-gold)] mb-1.5">
          What this compares
        </p>
        <p className="text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
          This tool reads each fund&rsquo;s <strong className="text-[var(--color-text-primary)]">ten largest holdings</strong>,
          not its full basket. Everything below is overlap among those twenty names. A broad index fund holds
          hundreds of companies, so the real figure is higher than what you see here. Read these percentages as a
          floor, never as total overlap. Weights are as of Q2 2026.
        </p>
      </div>

      {/* Pickers */}
      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        <label className="block">
          <span className="block font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Fund A
          </span>
          <select value={a} onChange={(e) => setA(e.target.value)} className={selectClass} aria-label="Fund A">
            {OVERLAP_FUNDS.map((f) => (
              <option key={f.ticker} value={f.ticker}>
                {f.ticker} · {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Fund B
          </span>
          <select value={b} onChange={(e) => setB(e.target.value)} className={selectClass} aria-label="Fund B">
            {OVERLAP_FUNDS.map((f) => (
              <option key={f.ticker} value={f.ticker}>
                {f.ticker} · {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!result ? (
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          Constituents are not on file for one of those tickers, so there is no figure to report.
        </p>
      ) : (
        <>
          {/* The two summed figures, labelled separately. */}
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                {result.tickerA} weight in shared names
              </p>
              <p className="font-mono text-3xl text-[var(--color-gold)]">{pct(result.sharedWeightA)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                Share of {result.tickerA} itself sitting in the {result.shared.length} name
                {result.shared.length === 1 ? '' : 's'} both top tens carry.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-base)] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                {result.tickerB} weight in shared names
              </p>
              <p className="font-mono text-3xl text-[var(--color-gold)]">{pct(result.sharedWeightB)}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                Share of {result.tickerB} itself sitting in those same names. The two figures differ because each
                fund weights them differently.
              </p>
            </div>
          </div>

          {/* Shared table */}
          <h2 className="type-h2 mb-3">
            Shared among the ten largest holdings of {result.tickerA} and {result.tickerB}
          </h2>
          {result.shared.length === 0 ? (
            <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] mb-10">
              No company appears in both funds&rsquo; ten largest holdings. They can still overlap further down each
              basket, which this tool does not see.
            </p>
          ) : (
            <div className="mb-10 overflow-x-auto rounded-xl border border-[var(--color-border-base)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                      Holding
                    </th>
                    <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                      Weight in {result.tickerA}
                    </th>
                    <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                      Weight in {result.tickerB}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.shared.map((s) => (
                    <tr key={s.ticker} className="border-b border-[var(--color-border-subtle)] last:border-0">
                      <td className="px-4 py-3 font-mono text-[var(--color-text-primary)]">{s.ticker}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">
                        {s.weightA.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-text-secondary)]">
                        {s.weightB.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Unique names */}
          <div className="grid gap-4 sm:grid-cols-2 mb-12">
            <div className="rounded-xl border border-[var(--color-border-subtle)] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                In {result.tickerA} top ten only
              </p>
              <p className="font-mono text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                {result.onlyA.length ? result.onlyA.join('  ') : 'None'}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-subtle)] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                In {result.tickerB} top ten only
              </p>
              <p className="font-mono text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                {result.onlyB.length ? result.onlyB.join('  ') : 'None'}
              </p>
            </div>
          </div>
        </>
      )}

      {/* One CTA */}
      <div className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-6">
        <h2 className="type-h2 mb-2">Overlap across your own accounts</h2>
        <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)] mb-4">
          Two funds side by side is the easy case. The harder one is the same company reaching you through an index
          fund in one account, a sector fund in another, and shares you hold directly. Helm reads the positions in
          the accounts you connect and maps fund holdings back to the underlying companies, so one name showing up
          three times counts once. It works from the same look-through data as this page, which means the ten
          largest holdings of each fund rather than the full basket.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--color-gold)] hover:underline"
        >
          See it on your own accounts <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
