'use client';

// Live Read. Each step is a separate request to the lab data route; a line is
// printed the moment its response lands, stamped with the browser clock and the
// server's own duration. There is no pacing, no stagger, no spinner theatre: if
// the whole read completes in 900 ms, it prints in 900 ms. On a fresh connect
// the first step is the slow one (holdings arriving), and that wait is shown as
// work, which is the point.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { PresenceBook, PresenceRun, PresenceEarning, PresenceTax, PresencePart } from '@/app/api/testing/presence/route';
import { MONO, money, clock, dayWord, calDay, hms, plural, institutions } from '../presence/format';

interface Line { at: Date; ms: number; text: string; right?: string; href?: string; emphasis?: boolean; muted?: boolean }

type Coverage = { covered: string[]; uncovered: string[] };
type Sources = { filings: number; news: number; priceMoves: number; contradicts: number };

async function part<T>(email: string, p: PresencePart): Promise<{ value: T; ms: number }> {
  const r = await fetch(`/api/testing/presence?email=${encodeURIComponent(email)}&part=${p}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return { value: j.value as T, ms: j.ms as number };
}

export function LiveRead({ email }: { email: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef<Date | null>(null);
  const runId = useRef(0);

  const push = useCallback((l: Omit<Line, 'at'>) => setLines((xs) => [...xs, { ...l, at: new Date() }]), []);

  const run = useCallback(async () => {
    const id = ++runId.current;
    const alive = () => runId.current === id;
    setLines([]); setError(null); setRunning(true); started.current = new Date();
    try {
      const book = await part<PresenceBook>(email, 'book');
      if (!alive()) return;
      if (book.value.accounts.length === 0) {
        push({ ms: book.ms, text: 'No brokerage connected. Nothing to read yet.', right: 'connect', href: '/dashboard/accounts', muted: true });
        setRunning(false);
        return;
      }
      const inst = institutions(book.value.accounts.map((a) => a.name)).slice(0, 3).join(', ');
      push({ ms: book.ms, text: `${inst} found`, right: plural(book.value.accounts.length, 'account'), href: '/dashboard/accounts' });
      if (book.value.positions === 0) {
        push({ ms: 0, text: 'Positions still arriving', right: '0 positions in', muted: true });
        setRunning(false);
        return;
      }
      push({ ms: 0, text: `${plural(book.value.positions, 'position')} in`, right: money(book.value.totalValue), href: '/dashboard/holdings' });

      const run = await part<PresenceRun>(email, 'run');
      if (!alive()) return;
      push({ ms: run.ms, text: `Priced ${plural(book.value.positions, 'position')}`, right: run.value.pricedAt ? `as of ${clock(run.value.pricedAt)} ${dayWord(run.value.pricedAt)}` : 'not priced yet', muted: !run.value.pricedAt });

      const conc = await part<{ ticker: string; pct: number } | null>(email, 'concentration');
      if (!alive()) return;
      if (conc.value) push({ ms: conc.ms, text: `${conc.value.ticker} is ${conc.value.pct.toFixed(0)}% of the book`, right: conc.value.pct >= 25 ? 'concentrated' : 'within range', href: '/dashboard/portfolio', emphasis: conc.value.pct >= 25 });

      const earn = await part<PresenceEarning[]>(email, 'earnings');
      if (!alive()) return;
      const e0 = earn.value[0];
      push({ ms: earn.ms, text: `${plural(earn.value.length, 'earnings report')} in the next 30 days`, right: e0 ? `${e0.ticker} ${calDay(e0.date)}` : 'none held', href: earn.value.length ? '/dashboard/earnings' : undefined, muted: earn.value.length === 0 });

      const tax = await part<PresenceTax | null>(email, 'tax');
      if (!alive()) return;
      if (tax.value) {
        push(tax.value.harvestable > 0
          ? { ms: tax.ms, text: `${money(tax.value.harvestable)} harvestable across ${plural(tax.value.opportunityCount, 'lot')}`, right: 'tax', href: '/dashboard/taxes', emphasis: true }
          : { ms: tax.ms, text: `Nothing harvestable across ${plural(tax.value.positions, 'position')}`, right: money(0), href: '/dashboard/taxes' });
      }

      const cov = await part<Coverage>(email, 'coverage');
      if (!alive()) return;
      const total = cov.value.covered.length + cov.value.uncovered.length;
      push({ ms: cov.ms, text: cov.value.covered.length > 0 ? `Helm already covers ${cov.value.covered.length} of your ${plural(total, 'name')}` : `No house thesis on any of your ${plural(total, 'name')} yet`, right: cov.value.covered.slice(0, 4).join(' ') || 'adopt none', href: cov.value.covered.length ? '/dashboard/theses' : undefined, muted: cov.value.covered.length === 0 });

      const src = await part<Sources>(email, 'sources');
      if (!alive()) return;
      const readTotal = src.value.filings + src.value.news + src.value.priceMoves;
      push({ ms: src.ms, text: readTotal > 0 ? `Read ${src.value.filings > 0 ? `${plural(src.value.filings, 'filing')} and ` : ''}${plural(src.value.news, 'article')} against those names in the last 72 hours` : 'Nothing read against these names yet', right: readTotal > 0 ? (src.value.contradicts > 0 ? `${src.value.contradicts} contradict` : 'nothing contradicts') : 'no theses tracked', emphasis: src.value.contradicts > 0, muted: readTotal === 0 });

      push({ ms: 0, text: `Tomorrow ${clock(run.value.nextRunAt)} I read all of it again.`, muted: true });
    } catch (e) {
      if (alive()) setError(e instanceof Error ? e.message : 'failed');
    } finally {
      if (alive()) setRunning(false);
    }
  }, [email, push]);

  useEffect(() => { run(); }, [run]);

  const elapsed = lines.length && started.current ? Math.round((lines[lines.length - 1].at.getTime() - started.current.getTime())) : 0;

  return (
    <div className="max-w-[820px]">
      <div className="flex items-baseline justify-between pb-3 border-b border-white/[0.14]">
        <h1 className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]" style={MONO}>
          Connected · {running ? 'reading' : 'read'}
        </h1>
        <span className="text-[10.5px] text-[#6A6A6A]" style={MONO}>
          {started.current ? `started ${hms(started.current)}` : ''}{!running && lines.length > 0 ? ` · ${elapsed} ms` : ''}
        </span>
      </div>

      <ol className="m-0 list-none p-0" aria-live="polite">
        {lines.map((l, i) => (
          <li key={i} className={`grid grid-cols-[76px_minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-[var(--color-rule)] py-2.5 ${l.emphasis ? 'bg-[rgba(230,185,77,0.03)]' : ''}`} style={l.emphasis ? { boxShadow: 'inset 2px 0 0 rgba(230,185,77,0.6)' } : undefined}>
            <span className="text-[10.5px] tabular-nums text-[#6A6A6A]" style={MONO}>{hms(l.at)}</span>
            <span className={`text-[13.5px] leading-[1.45] ${l.muted ? 'text-[#8A8A8A]' : 'text-[#D4D4D4]'}`}>
              {l.text}
              {l.ms > 0 && <span className="ml-2 text-[10px] text-[#4A4A4A]" style={MONO}>{l.ms} ms</span>}
            </span>
            <span className="text-right text-[12px] tabular-nums text-[#B8B8B8]" style={MONO}>
              {l.href ? <Link href={l.href} className="text-[#B8B8B8] hover:text-[#FAFAFA] no-underline">{l.right} →</Link> : l.right}
            </span>
          </li>
        ))}
        {running && (
          <li className="grid grid-cols-[76px_minmax(0,1fr)] items-baseline gap-x-4 py-2.5">
            <span className="text-[10.5px] text-[#6A6A6A]" style={MONO}>{hms(new Date())}</span>
            <span className="text-[13px] text-[#6A6A6A]">working</span>
          </li>
        )}
      </ol>

      {error && <p className="mt-3 text-[12px] text-[#F87171] m-0" style={MONO}>{error}</p>}

      <div className="mt-6 flex items-center gap-4">
        <button type="button" onClick={run} disabled={running} className="rounded-md border border-white/[0.14] bg-transparent px-3.5 py-2 text-[12px] font-semibold text-[#FAFAFA] hover:border-white/[0.3] disabled:opacity-40 disabled:cursor-default cursor-pointer" style={MONO}>
          Read now
        </button>
        <span className="text-[11px] text-[#5F5F5F]" style={MONO}>free: 3 a week · Pro: unlimited (gate not enforced in the lab)</span>
      </div>

      <div className="mt-12 border-t border-[var(--color-rule)] pt-4">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>Lab note</div>
        <ul className="mt-2 m-0 list-none p-0 space-y-1 text-[12px] leading-[1.55] text-[#8A8A8A]">
          <li>Each line is printed when its request returns; the grey number is the server&apos;s own time for that step. No line is delayed for effect.</li>
          <li>In the product this replaces FirstRead at the connect moment. On a fresh connect the first line waits on holdings arriving and says so as work, not as a spinner.</li>
          <li>One LLM step exists in the real version (reading fresh sources against uncovered names). It is not here; the sources line reads what the crons already judged.</li>
          <li>Exposure, earnings, taxes and coverage carry equal weight. The thesis is one line, not the hero.</li>
        </ul>
      </div>
    </div>
  );
}
