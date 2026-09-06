'use client';

// Overview, presence edition, third cut. The first was a caption; the second a
// dashboard with timestamps. This one lets the analyst show up:
//   1. Its read of the morning, in its own words, at the top. It already writes
//      one every day; it was hidden on /brief.
//   2. What it did, as short first-person lines that arrive one after another.
//      Real rows, real times; the stagger is the only motion on the page.
//   3. Every position carries the last thing Helm read about it, dated.
//   4. Where the scans found nothing, it says what it checked and concluded,
//      instead of an empty box.
// Still no strip, no chart, no greeting, no homework.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TodaysDelta } from '@/components/dashboard/todays-delta';
import type { PresenceData, PresenceHolding, PresenceRead } from '@/app/api/testing/presence/route';
import { MONO, money, clock, dayWord, calDay, plural, theses as thesesWord } from './format';

const POS = 'text-[#4ADE80]';
const NEG = 'text-[#F87171]';
const GOLD = 'text-[var(--color-gold)]';
const RULE = 'border-[var(--color-rule)]';

const ARRIVE_CSS = `
@keyframes lab-arrive { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
.lab-arrive { animation: lab-arrive 320ms ease-out both; }
@media (prefers-reduced-motion: reduce) { .lab-arrive { animation: none; } }
`;

function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A8A8A] ${className}`} style={MONO}>{children}</div>;
}

function pctText(n: number | null, digits = 2): string {
  if (n === null || !isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function Bar({ pct, max }: { pct: number; max: number }) {
  const w = Math.max(2, Math.min(100, (pct / Math.max(max, 1)) * 100));
  return (
    <div className="h-[3px] w-full bg-white/[0.06]">
      <div className="h-[3px] bg-[var(--color-gold)]" style={{ width: `${w}%`, opacity: 0.85 }} />
    </div>
  );
}

/** A number with its receipt underneath. */
function Kpi({ label, value, tone = 'muted', receipt, href }: { label: string; value: string; tone?: 'positive' | 'negative' | 'muted' | 'gold'; receipt: string; href?: string }) {
  const color = tone === 'positive' ? POS : tone === 'negative' ? NEG : tone === 'gold' ? GOLD : 'text-[#FAFAFA]';
  const body = (
    <div className="py-3.5 pr-4">
      <Eyebrow>{label}</Eyebrow>
      <div className={`mt-1.5 text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums ${color}`}>{value}</div>
      <div className="mt-1.5 text-[10.5px] leading-[1.5] text-[#6A6A6A]" style={MONO}>{receipt}</div>
    </div>
  );
  return href ? <Link href={href} className="block no-underline hover:bg-white/[0.015]">{body}</Link> : body;
}

function ReadLine({ r }: { r: PresenceRead | undefined }) {
  if (!r) return <span className="text-[11px] text-[#4A4A4A]" style={MONO}>not read yet</span>;
  const v = r.verdict;
  const vColor = v === 'contradicts' ? NEG : v === 'supports' ? POS : 'text-[#6A6A6A]';
  const label = r.kind === 'evidence' ? (r.source ?? 'evidence') : r.kind === 'house' ? (r.source ?? 'house read') : (r.source ?? 'news');
  return (
    <span className="block truncate text-[11px] leading-[1.5] text-[#8A8A8A]">
      <span className="text-[#5F5F5F]" style={MONO}>{dayWord(r.at)} · {label}{v ? <> · <span className={vColor}>{v}</span></> : null} · </span>
      {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-[#B8B8B8] no-underline hover:text-[#FAFAFA]">{r.title}</a> : r.title}
    </span>
  );
}

function HoldingRow({ h, max, read }: { h: PresenceHolding; max: number; read: PresenceRead | undefined }) {
  const tone = h.dayChangePct === null ? 'text-[#6A6A6A]' : h.dayChangePct >= 0 ? POS : NEG;
  return (
    <li className={`grid grid-cols-[60px_120px_minmax(0,1fr)_88px_64px] items-center gap-x-4 border-b ${RULE} py-2.5 last:border-0`}>
      <span className="text-[12.5px] font-semibold text-[#FAFAFA]" style={MONO}>{h.ticker}</span>
      <div>
        <Bar pct={h.pct} max={max} />
        <div className="mt-1 text-[10px] text-[#6A6A6A]" style={MONO}>{h.pct.toFixed(1)}%</div>
      </div>
      <ReadLine r={read} />
      <span className="text-right text-[12px] tabular-nums text-[#B8B8B8]" style={MONO}>{money(h.value)}</span>
      <span className={`text-right text-[12px] tabular-nums ${tone}`} style={MONO}>{pctText(h.dayChangePct)}</span>
    </li>
  );
}

interface WorkLine { key: string; text: React.ReactNode; at: string | null; tone?: 'gold' | 'muted' }

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
        <div className="mt-6 h-[12px] w-[80%] rounded bg-white/[0.04]" />
        <div className="mt-2 h-[12px] w-[70%] rounded bg-white/[0.04]" />
      </div>
    );
  }

  const { book, run, tax, concentration, earnings, flags, sources, theses, coverage, reads } = data;
  const priced = run.pricedAt;
  const dayTone = book.dayChangePct === null ? 'muted' : book.dayChangePct >= 0 ? 'positive' : 'negative';
  const maxPct = Math.max(...book.top.map((h) => h.pct), 1);
  const maxSector = Math.max(...book.sectors.map((s) => s.pct), 1);
  const e0 = earnings[0];
  const readTotal = sources.filings + sources.news + sources.priceMoves;
  const totalNames = coverage.covered.length + coverage.uncovered.length;
  const nextRead = `${clock(run.nextRunAt)} ${dayWord(run.nextRunAt)}`;

  // The lead: the analyst's own paragraph for this book, written by the cron.
  const lead = data.digest ? data.digest.split('\n\n').filter((p) => p.trim())[0] ?? null : null;

  // What it did, as it happened. Real rows only.
  const work: WorkLine[] = [];
  if (priced) work.push({ key: 'priced', at: priced, text: <>I priced {plural(book.positions, 'position')} across {plural(book.accounts.length, 'account')}. {book.pricedPositions < book.positions ? `${book.positions - book.pricedPositions} have no feed.` : ''}</> });
  if (theses.tracked > 0) {
    work.push({ key: 'read', at: run.lastRunAt, text: readTotal > 0
      ? <>I read {sources.filings > 0 ? `${plural(sources.filings, 'filing')} and ` : ''}{plural(sources.news, 'article')} against your {thesesWord(theses.tracked)}. {sources.contradicts > 0 ? <span className={NEG}>{sources.contradicts} contradict a pillar.</span> : 'Nothing moved a pillar.'}</>
      : <>Nothing new to read against your {thesesWord(theses.tracked)} in 72 hours.</> });
  }
  if (reads.newsAbout.count > 0) {
    work.push({ key: 'news', at: run.lastRunAt, text: <>I took in {plural(reads.newsAbout.count, 'news item')} tagged with {reads.newsAbout.names} of your names in the last 72 hours. The latest sits on each position below.</> });
  }
  work.push({ key: 'scans', at: flags.scansRanAt, text: flags.items.length > 0
    ? <>I ran 7 scans and flagged {plural(flags.items.length, 'item')}.</>
    : <>I ran 7 scans: concentration, tax, earnings, cash flow, drift. Nothing to flag.</> });
  if (tax && tax.harvestable > 0) work.push({ key: 'tax', at: flags.scansRanAt ?? priced, tone: 'gold', text: <>Found <span className={GOLD}>{money(tax.harvestable)}</span> of harvestable losses across {plural(tax.opportunityCount, 'lot')}.</> });
  work.push({ key: 'next', at: null, tone: 'muted', text: <>Next full read {nextRead}.</> });

  // Conclusions where the scans found nothing to flag: what was checked, and what it says.
  const conclusions: { key: string; text: React.ReactNode; href?: string }[] = [];
  if (concentration) conclusions.push({ key: 'conc', href: '/dashboard/portfolio', text: <>Largest position is {concentration.ticker} at {concentration.pct.toFixed(0)}% of the book. {concentration.pct >= 25 ? <span className={NEG}>Concentrated.</span> : 'Within range.'}</> });
  if (tax) conclusions.push({ key: 'tax', href: '/dashboard/taxes', text: tax.harvestable > 0
    ? <>{money(tax.harvestable)} harvestable across {plural(tax.opportunityCount, 'lot')}.{tax.top.length > 0 ? <> The largest: {tax.top.map((t) => `${t.ticker} ${money(t.loss)}`).join(', ')}.</> : null}</>
    : <>Nothing at a loss in a taxable account across {plural(tax.positions, 'position')}.</> });
  conclusions.push({ key: 'earn', href: '/dashboard/earnings', text: e0 ? <>{plural(earnings.length, 'name')} report{earnings.length === 1 ? 's' : ''} in the next 30 days, {e0.ticker} first on {calDay(e0.date)} at {e0.pct.toFixed(0)}% of the book.</> : <>Nothing on the earnings calendar for your names in the next 30 days.</> });
  conclusions.push({ key: 'thesis', href: '/dashboard/theses', text: theses.tracked > 0
    ? <>{thesesWord(theses.tracked)} under watch. {readTotal > 0 ? `${plural(readTotal, 'source')} read against ${theses.tracked === 1 ? 'it' : 'them'} in 72 hours.` : ''}</>
    : <>No thesis under watch. I already cover {coverage.covered.length} of your {plural(totalNames, 'name')}{coverage.covered.length > 0 ? <>: <span className="text-[#B8B8B8]" style={MONO}>{coverage.covered.slice(0, 5).join(' ')}</span>. Adopt one and it joins tomorrow&apos;s read.</> : '.'}</> });

  return (
    <div className="max-w-[1080px]">
      <style>{ARRIVE_CSS}</style>

      {/* ── Hero ── */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <Eyebrow>Net worth · all accounts · USD</Eyebrow>
          <div className="mt-2 text-[46px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[#FAFAFA]">{money(book.totalValue)}</div>
          <p className="mt-2.5 text-[11.5px] leading-[1.6] text-[#8A8A8A] m-0" style={MONO}>
            <Link href="/dashboard/holdings" className="text-[#B8B8B8] hover:text-[#FAFAFA] no-underline">{plural(book.positions, 'position')}</Link>
            <span className="text-[#3A3A3A]"> · </span>{priced ? <>priced {clock(priced)} {dayWord(priced)}</> : 'not priced yet'}
            <span className="text-[#3A3A3A]"> · </span>
            <Link href="/testing/app/ledger" className="text-[#B8B8B8] hover:text-[#FAFAFA] no-underline">next read {nextRead}</Link>
          </p>
        </div>
        <div className="text-right pb-1">
          <div className={`text-[20px] font-bold tabular-nums tracking-[-0.02em] ${dayTone === 'positive' ? POS : dayTone === 'negative' ? NEG : 'text-[#6A6A6A]'}`}>
            {book.dayChangeValue !== null ? `${book.dayChangeValue >= 0 ? '+' : '−'}${money(Math.abs(book.dayChangeValue))}` : '—'}
            <span className="ml-2 text-[13px] font-semibold">{pctText(book.dayChangePct)}</span>
          </div>
          <div className="mt-1 text-[10.5px] text-[#6A6A6A]" style={MONO}>{book.pricedPositions > 0 ? `${book.pricedPositions} of ${book.positions} positions priced` : 'no price feed yet'}</div>
        </div>
      </div>

      {/* ── The read: the analyst's paragraph, then what it did, arriving line by line ── */}
      <section className={`mt-8 border-t ${RULE} pt-4`}>
        <div className="flex items-baseline justify-between">
          <Eyebrow className="!text-[var(--color-gold)]">Helm&apos;s read · {run.lastRunAt ? `${clock(run.lastRunAt)} ${dayWord(run.lastRunAt)}` : 'not written yet'}</Eyebrow>
          <Link href="/testing/app/ledger" className="text-[10.5px] text-[#6A6A6A] hover:text-[#FAFAFA] no-underline" style={MONO}>full brief and receipts →</Link>
        </div>
        <div className="mt-4 grid gap-x-12 gap-y-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div>
            {lead ? (
              <p className="m-0 text-[16px] leading-[1.6] text-[#E4E4E4]">{lead}</p>
            ) : (
              <p className="m-0 text-[15px] leading-[1.6] text-[#8A8A8A]">No brief written for this book yet. The first one lands at {nextRead}.</p>
            )}
          </div>
          <ol className="m-0 list-none p-0" aria-label="What Helm did">
            {work.map((w, i) => (
              <li key={w.key} className={`lab-arrive grid grid-cols-[64px_minmax(0,1fr)] items-baseline gap-x-3 border-b ${RULE} py-2 last:border-0`} style={{ animationDelay: `${120 + i * 140}ms` }}>
                <span className="text-[10.5px] tabular-nums text-[#5F5F5F]" style={MONO}>{w.at ? clock(w.at).replace(' ET', '') : ''}</span>
                <span className={`text-[12.5px] leading-[1.5] ${w.tone === 'muted' ? 'text-[#8A8A8A]' : 'text-[#D4D4D4]'}`}>{w.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Since you were here (real component) ── */}
      <div className="mt-7"><TodaysDelta /></div>

      {/* ── Numbers with receipts ── */}
      <div className={`mt-8 grid grid-cols-2 md:grid-cols-5 border-y ${RULE} divide-x divide-[var(--color-rule)]`}>
        <div className="pl-0"><Kpi label="Invested" value={money(book.totalValue)} receipt={priced ? `priced ${clock(priced)} · ${plural(book.accounts.length, 'account')}` : 'not priced'} href="/dashboard/holdings" /></div>
        <div className="pl-4"><Kpi label="Day change" value={pctText(book.dayChangePct)} tone={dayTone} receipt={`${book.pricedPositions} priced · ${book.positions - book.pricedPositions} without a feed`} href="/dashboard/portfolio" /></div>
        <div className="pl-4"><Kpi label="Harvestable" value={tax ? money(tax.harvestable) : '—'} tone={tax && tax.harvestable > 0 ? 'gold' : 'muted'} receipt={tax ? (tax.harvestable > 0 ? `${plural(tax.opportunityCount, 'lot')} · read ${clock(flags.scansRanAt ?? priced)}` : `nothing at a loss · ${plural(tax.positions, 'position')}`) : 'no book'} href="/dashboard/taxes" /></div>
        <div className="pl-4"><Kpi label="Concentration" value={concentration ? `${concentration.pct.toFixed(0)}%` : '—'} tone={concentration && concentration.pct >= 25 ? 'negative' : 'muted'} receipt={concentration ? `${concentration.ticker} · largest of ${plural(book.names, 'name')}` : 'no book'} href="/dashboard/portfolio" /></div>
        <div className="pl-4"><Kpi label="Earnings · 30d" value={String(earnings.length)} tone={earnings.length > 0 ? 'gold' : 'muted'} receipt={e0 ? `${e0.ticker} ${calDay(e0.date)} · ${e0.pct.toFixed(0)}% of book` : 'none on the calendar for your names'} href="/dashboard/earnings" /></div>
      </div>

      {/* ── The book, read ── */}
      <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <section>
          <div className={`flex items-baseline justify-between border-b ${RULE} pb-2`}>
            <Eyebrow>Book · largest positions · last read</Eyebrow>
            <Link href="/dashboard/holdings" className="text-[10.5px] text-[#6A6A6A] hover:text-[#FAFAFA] no-underline" style={MONO}>{priced ? `priced ${clock(priced)}` : ''} · all {book.positions} →</Link>
          </div>
          <ol className="m-0 list-none p-0">{book.top.map((h) => <HoldingRow key={h.ticker} h={h} max={maxPct} read={reads.byTicker[h.ticker]} />)}</ol>

          {book.movers.length > 0 && (
            <div className="mt-8">
              <div className={`flex items-baseline justify-between border-b ${RULE} pb-2`}>
                <Eyebrow>Movers · by contribution to the day</Eyebrow>
                <span className="text-[10.5px] text-[#6A6A6A]" style={MONO}>{priced ? `as of ${clock(priced)} ${dayWord(priced)}` : ''}</span>
              </div>
              <ol className="m-0 list-none p-0">
                {book.movers.map((h) => (
                  <li key={h.ticker} className={`grid grid-cols-[60px_minmax(0,1fr)_64px] items-center gap-x-4 border-b ${RULE} py-2 last:border-0`}>
                    <span className="text-[12.5px] font-semibold text-[#FAFAFA]" style={MONO}>{h.ticker}</span>
                    <div className="min-w-0">
                      <ReadLine r={reads.byTicker[h.ticker]} />
                      <div className="text-[10px] text-[#5F5F5F]" style={MONO}>{h.pct.toFixed(1)}% of book</div>
                    </div>
                    <span className={`text-right text-[12px] tabular-nums ${h.dayChangePct !== null && h.dayChangePct >= 0 ? POS : NEG}`} style={MONO}>{pctText(h.dayChangePct)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section>
          <div className={`flex items-baseline justify-between border-b ${RULE} pb-2`}>
            <Eyebrow>{flags.items.length > 0 ? 'Flagged' : 'Checked and concluded'}</Eyebrow>
            <Link href="/dashboard/actions" className="text-[10.5px] text-[#6A6A6A] hover:text-[#FAFAFA] no-underline" style={MONO}>{flags.scansRanAt ? `${clock(flags.scansRanAt)} ${dayWord(flags.scansRanAt)}` : ''} →</Link>
          </div>
          {flags.items.length > 0 && (
            <ol className="m-0 list-none p-0">
              {flags.items.slice(0, 4).map((f) => {
                const hot = f.priority === 'high' || f.priority === 'critical' || f.priority === '1' || f.priority === '2';
                return (
                  <li key={f.id} className={`border-b ${RULE} py-2.5 ${hot ? 'bg-[rgba(248,113,113,0.03)]' : ''}`} style={hot ? { boxShadow: 'inset 2px 0 0 rgba(248,113,113,0.55)' } : undefined}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] leading-[1.4] text-[#D4D4D4]">{f.title}</span>
                      <span className="shrink-0 text-[10.5px] text-[#6A6A6A]" style={MONO}>{clock(f.at)} {dayWord(f.at)}</span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-[#6A6A6A]" style={MONO}>{f.kind}{f.impact !== null ? ` · ${money(f.impact)}` : ''}</div>
                  </li>
                );
              })}
            </ol>
          )}
          <ol className="m-0 list-none p-0">
            {conclusions.map((c) => (
              <li key={c.key} className={`border-b ${RULE} py-2.5 last:border-0`}>
                <Link href={c.href ?? '#'} className="block text-[13px] leading-[1.5] text-[#C8C8C8] no-underline hover:text-[#FAFAFA]">{c.text}</Link>
              </li>
            ))}
          </ol>

          {book.sectors.length > 0 && (
            <div className="mt-8">
              <div className={`flex items-baseline justify-between border-b ${RULE} pb-2`}>
                <Eyebrow>Allocation · by sector</Eyebrow>
                <span className="text-[10.5px] text-[#6A6A6A]" style={MONO}>share of long value</span>
              </div>
              <ol className="m-0 list-none p-0">
                {book.sectors.map((s) => (
                  <li key={s.sector} className={`grid grid-cols-[132px_minmax(0,1fr)_44px] items-center gap-x-3 border-b ${RULE} py-2 last:border-0`}>
                    <span className="truncate text-[11.5px] text-[#D4D4D4]">{s.sector || 'Unclassified'}</span>
                    <Bar pct={s.pct} max={maxSector} />
                    <span className="text-right text-[11px] tabular-nums text-[#B8B8B8]" style={MONO}>{s.pct.toFixed(0)}%</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>

      <div className={`mt-14 border-t ${RULE} pt-4`}>
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>Lab note</div>
        <ul className="mt-2 m-0 list-none p-0 space-y-1 text-[12px] leading-[1.55] text-[#8A8A8A]">
          <li>The lead paragraph is the digest the cron already writes for this book; it was only ever shown on /brief.</li>
          <li>The work lines are real rows with real times; the arrival stagger is the only motion and respects reduced-motion.</li>
          <li>&quot;Last read&quot; per position: thesis evidence first, then a house-thesis catch, then the latest news item the classifier judged to be about the name. &quot;Not read yet&quot; is printed rather than hidden.</li>
          <li>First person is used only where Helm did the thing. Numbers still carry their receipts. Nothing is padded on a quiet day.</li>
        </ul>
        <p className="mt-3 text-[10.5px] text-[#5F5F5F] m-0" style={MONO}>fetched in {Object.values(data.ms).reduce((a, b) => a + (b ?? 0), 0)} ms</p>
      </div>
    </div>
  );
}
