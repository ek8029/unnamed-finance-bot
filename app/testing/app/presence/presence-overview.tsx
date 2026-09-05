'use client';

// Overview, presence edition. The whole overview skeleton, in the product's
// order (hero, delta line, KPI row, book and allocation, what was flagged,
// movers), with the agent present as provenance: under every number, the
// moment Helm produced it and from how many positions. No strip, no feed, no
// first-person narration. The one Done line is the existing delta line; the
// caption under net worth is the present tense; AHEAD lives on the ledger.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TodaysDelta } from '@/components/dashboard/todays-delta';
import type { PresenceData, PresenceHolding } from '@/app/api/testing/presence/route';
import { MONO, money, clock, dayWord, calDay, plural, theses as thesesWord } from './format';

const POS = 'text-[#4ADE80]';
const NEG = 'text-[#F87171]';
const RULE = 'border-[var(--color-rule)]';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A8A8A]" style={MONO}>{children}</div>;
}

/** A number with its receipt underneath. The receipt is the presence. */
function Kpi({ label, value, tone = 'muted', receipt, href }: { label: string; value: string; tone?: 'positive' | 'negative' | 'muted' | 'gold'; receipt: string; href?: string }) {
  const color = tone === 'positive' ? POS : tone === 'negative' ? NEG : tone === 'gold' ? 'text-[var(--color-gold)]' : 'text-[#FAFAFA]';
  const body = (
    <div className="py-3.5 pr-4">
      <Eyebrow>{label}</Eyebrow>
      <div className={`mt-1.5 text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums ${color}`}>{value}</div>
      <div className="mt-1.5 text-[10.5px] leading-[1.5] text-[#6A6A6A]" style={MONO}>{receipt}</div>
    </div>
  );
  return href ? <Link href={href} className="block no-underline hover:bg-white/[0.015]">{body}</Link> : body;
}

function Bar({ pct, max }: { pct: number; max: number }) {
  const w = Math.max(2, Math.min(100, (pct / Math.max(max, 1)) * 100));
  return (
    <div className="h-[3px] w-full bg-white/[0.06]">
      <div className="h-[3px] bg-[var(--color-gold)]" style={{ width: `${w}%`, opacity: 0.85 }} />
    </div>
  );
}

function pctText(n: number | null, digits = 2): string {
  if (n === null || !isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function HoldingRow({ h, max }: { h: PresenceHolding; max: number }) {
  const tone = h.dayChangePct === null ? 'text-[#6A6A6A]' : h.dayChangePct >= 0 ? POS : NEG;
  return (
    <li className={`grid grid-cols-[64px_minmax(0,1fr)_92px_72px] items-center gap-x-4 border-b ${RULE} py-2.5 last:border-0`}>
      <span className="text-[12.5px] font-semibold text-[#FAFAFA]" style={MONO}>{h.ticker}</span>
      <div>
        <Bar pct={h.pct} max={max} />
        <div className="mt-1 text-[10px] text-[#6A6A6A]" style={MONO}>{h.pct.toFixed(1)}%{h.sector ? ` · ${h.sector}` : ''}</div>
      </div>
      <span className="text-right text-[12px] tabular-nums text-[#B8B8B8]" style={MONO}>{money(h.value)}</span>
      <span className={`text-right text-[12px] tabular-nums ${tone}`} style={MONO}>{pctText(h.dayChangePct)}</span>
    </li>
  );
}

export function PresenceOverview({ email }: { email: string }) {
  const [data, setData] = useState<PresenceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/testing/presence?email=${encodeURIComponent(email)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j as PresenceData; })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [email]);

  if (error) return <p className="text-[13px] text-[#F87171] m-0" style={MONO}>{error}</p>;

  if (!data) {
    return (
      <div className="max-w-[1080px]" aria-label="Loading overview">
        <div className="h-[10px] w-[180px] rounded bg-white/[0.05]" />
        <div className="mt-3 h-[44px] w-[260px] rounded bg-white/[0.05]" />
        <div className="mt-3 h-[12px] w-[420px] rounded bg-white/[0.04]" />
        <div className="mt-8 grid grid-cols-5 gap-4">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[64px] rounded bg-white/[0.04]" />)}</div>
      </div>
    );
  }

  const { book, run, tax, concentration, earnings, flags, sources, theses, coverage } = data;
  const priced = run.pricedAt;
  const dayTone = book.dayChangePct === null ? 'muted' : book.dayChangePct >= 0 ? 'positive' : 'negative';
  const maxPct = Math.max(...book.top.map((h) => h.pct), 1);
  const maxSector = Math.max(...book.sectors.map((s) => s.pct), 1);
  const e0 = earnings[0];
  const readTotal = sources.filings + sources.news + sources.priceMoves;
  const nextRead = `next read ${clock(run.nextRunAt)} ${dayWord(run.nextRunAt)}`;

  return (
    <div className="max-w-[1080px]">
      {/* ── Hero ── */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <Eyebrow>Net worth · all accounts · USD</Eyebrow>
          <div className="mt-2 text-[46px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[#FAFAFA]">{money(book.totalValue)}</div>
          <p className="mt-2.5 text-[11.5px] leading-[1.6] text-[#8A8A8A] m-0" style={MONO}>
            <Link href="/dashboard/holdings" className="text-[#B8B8B8] hover:text-[#FAFAFA] no-underline">{plural(book.positions, 'position')}</Link>
            {book.names !== book.positions && <><span className="text-[#3A3A3A]"> · </span>{plural(book.names, 'name')}</>}
            <span className="text-[#3A3A3A]"> · </span>{priced ? <>priced {clock(priced)} {dayWord(priced)}</> : 'not priced yet'}
            <span className="text-[#3A3A3A]"> · </span>
            <Link href="/testing/app/ledger" className="text-[#B8B8B8] hover:text-[#FAFAFA] no-underline">{nextRead}</Link>
          </p>
        </div>
        <div className="text-right pb-1">
          <div className={`text-[20px] font-bold tabular-nums tracking-[-0.02em] ${dayTone === 'positive' ? POS : dayTone === 'negative' ? NEG : 'text-[#6A6A6A]'}`}>
            {book.dayChangeValue !== null ? `${book.dayChangeValue >= 0 ? '+' : '−'}${money(Math.abs(book.dayChangeValue))}` : '—'}
            <span className="ml-2 text-[13px] font-semibold">{pctText(book.dayChangePct)}</span>
          </div>
          <div className="mt-1 text-[10.5px] text-[#6A6A6A]" style={MONO}>
            {book.pricedPositions > 0 ? `${book.pricedPositions} of ${book.positions} positions priced` : 'no price feed yet'}
          </div>
        </div>
      </div>

      {/* ── The one Done line (real component, real API) ── */}
      <div className="mt-7"><TodaysDelta /></div>

      {/* ── KPI row: numbers with receipts, ruled, no cards ── */}
      <div className={`mt-8 grid grid-cols-2 md:grid-cols-5 border-y ${RULE} divide-x divide-[var(--color-rule)]`}>
        <div className="pl-0"><Kpi label="Invested" value={money(book.totalValue)} receipt={priced ? `priced ${clock(priced)} · ${plural(book.accounts.length, 'account')}` : 'not priced'} href="/dashboard/holdings" /></div>
        <div className="pl-4"><Kpi label="Day change" value={pctText(book.dayChangePct)} tone={dayTone} receipt={`${book.pricedPositions} priced · ${book.positions - book.pricedPositions} without a feed`} href="/dashboard/portfolio" /></div>
        <div className="pl-4"><Kpi label="Harvestable" value={tax ? money(tax.harvestable) : '—'} tone={tax && tax.harvestable > 0 ? 'gold' : 'muted'} receipt={tax ? (tax.harvestable > 0 ? `${plural(tax.opportunityCount, 'lot')} · read ${clock(flags.scansRanAt ?? priced)}` : `nothing at a loss · ${plural(tax.positions, 'position')}`) : 'no book'} href="/dashboard/taxes" /></div>
        <div className="pl-4"><Kpi label="Concentration" value={concentration ? `${concentration.pct.toFixed(0)}%` : '—'} tone={concentration && concentration.pct >= 25 ? 'negative' : 'muted'} receipt={concentration ? `${concentration.ticker} · largest of ${plural(book.names, 'name')}` : 'no book'} href="/dashboard/portfolio" /></div>
        <div className="pl-4"><Kpi label="Earnings · 30d" value={String(earnings.length)} tone={earnings.length > 0 ? 'gold' : 'muted'} receipt={e0 ? `${e0.ticker} ${calDay(e0.date)} · ${e0.pct.toFixed(0)}% of book` : 'none on the calendar for your names'} href="/dashboard/earnings" /></div>
      </div>

      {/* ── Two columns: the book on the left, what Helm did with it on the right ── */}
      <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section>
          <div className={`flex items-baseline justify-between border-b ${RULE} pb-2`}>
            <Eyebrow>Book · largest positions</Eyebrow>
            <Link href="/dashboard/holdings" className="text-[10.5px] text-[#6A6A6A] hover:text-[#FAFAFA] no-underline" style={MONO}>{priced ? `priced ${clock(priced)}` : ''} · all {book.positions} →</Link>
          </div>
          <ol className="m-0 list-none p-0">{book.top.map((h) => <HoldingRow key={h.ticker} h={h} max={maxPct} />)}</ol>

          {book.sectors.length > 0 && (
            <div className="mt-8">
              <div className={`flex items-baseline justify-between border-b ${RULE} pb-2`}>
                <Eyebrow>Allocation · by sector</Eyebrow>
                <span className="text-[10.5px] text-[#6A6A6A]" style={MONO}>share of long value · {plural(book.positions, 'position')}</span>
              </div>
              <ol className="m-0 list-none p-0">
                {book.sectors.map((s) => (
                  <li key={s.sector} className={`grid grid-cols-[160px_minmax(0,1fr)_56px] items-center gap-x-4 border-b ${RULE} py-2 last:border-0`}>
                    <span className="truncate text-[12px] text-[#D4D4D4]">{s.sector || 'Unclassified'}</span>
                    <Bar pct={s.pct} max={maxSector} />
                    <span className="text-right text-[11.5px] tabular-nums text-[#B8B8B8]" style={MONO}>{s.pct.toFixed(0)}%</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section>
          <div className={`flex items-baseline justify-between border-b ${RULE} pb-2`}>
            <Eyebrow>Flagged</Eyebrow>
            <Link href="/dashboard/actions" className="text-[10.5px] text-[#6A6A6A] hover:text-[#FAFAFA] no-underline" style={MONO}>
              {flags.scansRanAt ? `7 scans · ${clock(flags.scansRanAt)} ${dayWord(flags.scansRanAt)}` : 'scans not run'} →
            </Link>
          </div>
          {flags.items.length === 0 ? (
            <p className="m-0 py-3 text-[13px] leading-[1.5] text-[#8A8A8A]">
              Nothing flagged in 72 hours. Concentration, tax, earnings, cash flow and drift were checked{flags.scansRanAt ? ` ${dayWord(flags.scansRanAt)}` : ''}. {nextRead[0].toUpperCase() + nextRead.slice(1)}.
            </p>
          ) : (
            <ol className="m-0 list-none p-0">
              {flags.items.slice(0, 5).map((f) => {
                const hot = f.priority === 'high' || f.priority === 'critical' || f.priority === '1' || f.priority === '2';
                return (
                  <li key={f.id} className={`border-b ${RULE} py-2.5 last:border-0 ${hot ? 'bg-[rgba(248,113,113,0.03)]' : ''}`} style={hot ? { boxShadow: 'inset 2px 0 0 rgba(248,113,113,0.55)' } : undefined}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] leading-[1.4] text-[#D4D4D4]">{f.title}</span>
                      <span className="shrink-0 text-[10.5px] text-[#6A6A6A]" style={MONO}>{clock(f.at)} {dayWord(f.at)}</span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-[#6A6A6A]" style={MONO}>{f.kind}{f.impact !== null ? ` · ${money(f.impact)}` : ''}{f.priority ? ` · ${f.priority}` : ''}</div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-8">
            <div className={`flex items-baseline justify-between border-b ${RULE} pb-2`}>
              <Eyebrow>Read against your names</Eyebrow>
              <Link href="/testing/app/ledger" className="text-[10.5px] text-[#6A6A6A] hover:text-[#FAFAFA] no-underline" style={MONO}>ledger →</Link>
            </div>
            <p className="m-0 py-3 text-[13px] leading-[1.55] text-[#8A8A8A]">
              {theses.tracked > 0
                ? (readTotal > 0
                    ? <>{sources.filings > 0 ? `${plural(sources.filings, 'filing')} and ` : ''}{plural(sources.news, 'article')} read against {thesesWord(theses.tracked)} in 72 hours. {sources.contradicts > 0 ? <span className={NEG}>{sources.contradicts} contradict.</span> : 'Nothing moved a pillar.'}</>
                    : <>Nothing new to read against {thesesWord(theses.tracked)} in 72 hours.</>)
                : <>No thesis under watch. Helm already covers {coverage.covered.length} of your {plural(coverage.covered.length + coverage.uncovered.length, 'name')}{coverage.covered.length > 0 ? <>: <span className="text-[#B8B8B8]" style={MONO}>{coverage.covered.slice(0, 5).join(' ')}</span>. <Link href="/dashboard/theses" className="text-[var(--color-gold)] no-underline">Adopt one</Link> and it joins tomorrow&apos;s read.</> : '.'}</>}
            </p>
          </div>

          {book.movers.length > 0 && (
            <div className="mt-8">
              <div className={`flex items-baseline justify-between border-b ${RULE} pb-2`}>
                <Eyebrow>Movers · by contribution</Eyebrow>
                <span className="text-[10.5px] text-[#6A6A6A]" style={MONO}>{priced ? `as of ${clock(priced)} ${dayWord(priced)}` : ''}</span>
              </div>
              <ol className="m-0 list-none p-0">
                {book.movers.map((h) => (
                  <li key={h.ticker} className={`flex items-baseline justify-between border-b ${RULE} py-2 last:border-0`}>
                    <span className="text-[12.5px] font-semibold text-[#FAFAFA]" style={MONO}>{h.ticker} <span className="ml-2 font-normal text-[10.5px] text-[#6A6A6A]">{h.pct.toFixed(1)}% of book</span></span>
                    <span className={`text-[12px] tabular-nums ${h.dayChangePct !== null && h.dayChangePct >= 0 ? POS : NEG}`} style={MONO}>{pctText(h.dayChangePct)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>

      {/* ── Lab note ── */}
      <div className={`mt-14 border-t ${RULE} pt-4`}>
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>Lab note</div>
        <ul className="mt-2 m-0 list-none p-0 space-y-1 text-[12px] leading-[1.55] text-[#8A8A8A]">
          <li>Same sections as the real overview, same order, minus the trend chart (no snapshot history in the lab). No strip, no heartbeat, no first-look card.</li>
          <li>Presence is provenance: every number says when Helm produced it and from how many positions. Tap a number to go where it came from.</li>
          <li>Quiet states are written, not blank: &quot;nothing flagged, five scans checked, next read tomorrow 9:15&quot;.</li>
        </ul>
        <p className="mt-3 text-[10.5px] text-[#5F5F5F] m-0" style={MONO}>fetched in {Object.values(data.ms).reduce((a, b) => a + (b ?? 0), 0)} ms</p>
      </div>
    </div>
  );
}
