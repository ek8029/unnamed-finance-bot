'use client';

// The Ledger. Three blocks on one spine: OVERNIGHT (done), AHEAD (will do),
// THE BRIEF (the prose, as one entry). Every OVERNIGHT line is a real cron row
// with a real timestamp and a number on the right; clicking a line opens its
// receipt. Quiet days are designed, not empty: "read 41 sources, nothing moved
// a pillar" is a line with numbers in it.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { PresenceData } from '@/app/api/testing/presence/route';
import { MONO, money, clock, dayWord, calDay, plural, theses as thesesWord } from '../presence/format';

interface Row {
  id: string;
  ts: string | null;
  label: string;
  right: string;
  href?: string;
  emphasis?: boolean;
  receipt?: React.ReactNode;
}

const RULE = 'border-b border-[var(--color-rule)]';

function Block({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between pb-2 border-b border-white/[0.14]">
        <h2 className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]" style={MONO}>{title}</h2>
        {meta && <span className="text-[10.5px] text-[#6A6A6A]" style={MONO}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function LedgerRow({ row, open, onToggle, timeCol }: { row: Row; open: boolean; onToggle: () => void; timeCol: string }) {
  const clickable = !!row.receipt;
  return (
    <li className={`${RULE} last:border-0`}>
      <div
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? onToggle : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
        className={`grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-x-4 py-2.5 ${clickable ? 'cursor-pointer hover:bg-white/[0.015]' : ''} ${row.emphasis ? 'bg-[rgba(248,113,113,0.03)]' : ''}`}
        style={row.emphasis ? { boxShadow: 'inset 2px 0 0 rgba(248,113,113,0.55)' } : undefined}
      >
        <span className="text-[10.5px] tabular-nums text-[#6A6A6A]" style={MONO}>{timeCol}</span>
        <span className="text-[13.5px] leading-[1.45] text-[#D4D4D4]">
          {row.label}
          {clickable && <span className="ml-2 text-[10px] text-[#5A5A5A]" style={MONO}>{open ? 'close' : 'receipt'}</span>}
        </span>
        <span className="text-right text-[12px] tabular-nums text-[#B8B8B8]" style={MONO}>
          {row.href ? <Link href={row.href} className="text-[#B8B8B8] hover:text-[#FAFAFA] no-underline" onClick={(e) => e.stopPropagation()}>{row.right} →</Link> : row.right}
        </span>
      </div>
      {open && row.receipt && (
        <div className="ml-[80px] mb-3 mt-1 border-l border-[var(--color-rule)] pl-4 text-[11.5px] leading-[1.6] text-[#8A8A8A]" style={MONO}>
          {row.receipt}
        </div>
      )}
    </li>
  );
}

export function Ledger({ email }: { email: string }) {
  const [data, setData] = useState<PresenceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    fetch(`/api/testing/presence?email=${encodeURIComponent(email)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j as PresenceData; })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [email]);

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const overnight = useMemo<Row[]>(() => {
    if (!data) return [];
    const rows: Row[] = [];
    const { book, run, sources, tax, concentration, worklog } = data;

    if (run.pricedAt) {
      rows.push({
        id: 'priced', ts: run.pricedAt,
        label: `Priced ${plural(book.positions, 'position')} across ${plural(book.accounts.length, 'account')}`,
        right: money(book.totalValue),
        receipt: (
          <>
            {book.accounts.map((a) => <div key={a.name}>{a.name} · synced {a.lastSyncedAt ? `${clock(a.lastSyncedAt)} ${dayWord(a.lastSyncedAt)}` : 'never'}</div>)}
            <div className="mt-1 text-[#5F5F5F]">largest: {book.top.map((t) => `${t.ticker} ${t.pct.toFixed(0)}%`).join(' · ')}</div>
          </>
        ),
      });
    }

    const readTotal = sources.filings + sources.news + sources.priceMoves;
    const readStep = worklog.steps.find((s) => s.kind === 'read');
    if (readTotal > 0) {
      rows.push({
        id: 'read', ts: readStep?.ts ?? run.lastRunAt,
        label: `Read ${sources.filings > 0 ? `${plural(sources.filings, 'filing')} and ` : ''}${plural(sources.news, 'article')} against ${thesesWord(data.theses.tracked)}`,
        right: sources.contradicts > 0 ? `${sources.contradicts} contradict` : 'nothing moved a pillar',
        emphasis: sources.contradicts > 0,
        receipt: (
          <>
            {sources.items.slice(0, 12).map((s, i) => (
              <div key={i} className="truncate">
                <span className="text-[#5F5F5F]">{clock(s.at)} {dayWord(s.at)}</span> · {s.ticker ?? ''} · {s.type} · <span className={s.verdict === 'contradicts' ? 'text-[#F87171]' : s.verdict === 'supports' ? 'text-[#4ADE80]' : ''}>{s.verdict}</span> · {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-[#B8B8B8] hover:text-[#FAFAFA]">{s.title}</a> : s.title}
              </div>
            ))}
            {sources.items.length > 12 && <div className="text-[#5F5F5F]">and {sources.items.length - 12} more</div>}
          </>
        ),
      });
    } else if (data.theses.tracked > 0) {
      rows.push({ id: 'read', ts: run.lastRunAt, label: `Nothing new to read against ${thesesWord(data.theses.tracked)} in 72 hours`, right: '0 sources' });
    } else {
      const total = data.coverage.covered.length + data.coverage.uncovered.length;
      rows.push({
        id: 'read', ts: run.lastRunAt, label: 'No thesis under watch, so nothing was read against your names',
        right: data.coverage.covered.length > 0 ? `Helm covers ${data.coverage.covered.length} of ${total} · adopt` : `0 of ${total} names covered`,
        href: '/dashboard/theses',
      });
    }

    const scan = worklog.steps.find((s) => s.kind === 'scan');
    if (concentration) {
      rows.push({
        id: 'conc', ts: scan?.ts ?? run.pricedAt,
        label: 'Concentration',
        right: `${concentration.ticker} ${concentration.pct.toFixed(0)}% of book`,
        href: '/dashboard/portfolio',
      });
    }
    if (tax) {
      rows.push({
        id: 'tax', ts: scan?.ts ?? run.pricedAt,
        label: tax.harvestable > 0 ? 'Tax loss harvesting' : `Tax: nothing harvestable across ${plural(tax.positions, 'position')}`,
        right: tax.harvestable > 0 ? `${money(tax.harvestable)} harvestable · ${plural(tax.opportunityCount, 'lot')}` : money(0),
        receipt: tax.harvestable > 0 ? (
          <>
            {tax.top.map((t, i) => <div key={i}>{t.ticker} · {money(t.loss)}{t.account ? ` · ${t.account}` : ''}</div>)}
            {tax.disclaimer && <div className="mt-1 text-[#5F5F5F]">{tax.disclaimer}</div>}
          </>
        ) : undefined,
      });
    }
    for (const s of worklog.steps.filter((x) => x.kind === 'flag')) {
      rows.push({ id: s.id, ts: s.ts, label: s.label, right: s.detail ?? 'needs your review', href: s.href ?? undefined, emphasis: true });
    }
    if (run.lastRunAt) {
      rows.push({ id: 'brief', ts: run.lastRunAt, label: 'Wrote your brief', right: 'below' });
    }
    // Oldest first: a ledger reads as the run happened (priced, read, scanned, wrote).
    rows.sort((a, b) => ((a.ts ?? '') < (b.ts ?? '') ? -1 : (a.ts ?? '') > (b.ts ?? '') ? 1 : 0));
    return rows;
  }, [data]);

  const ahead = useMemo<Row[]>(() => {
    if (!data) return [];
    const rows: Row[] = [];
    for (const e of data.earnings.slice(0, 5)) {
      rows.push({ id: `earn-${e.ticker}`, ts: e.date, label: `${e.ticker} reports`, right: `${e.pct.toFixed(0)}% of book · re-read after the call`, href: '/dashboard/earnings' });
    }
    if (data.theses.tracked === 0 && data.coverage.covered.length > 0) {
      rows.push({ id: 'adopt', ts: null, label: "Adopt a house thesis and it joins tomorrow's read", right: data.coverage.covered.slice(0, 4).join(' '), href: '/dashboard/theses' });
    }
    for (const p of data.theses.pillars.filter((x) => x.breaksIf).slice(0, 3)) {
      rows.push({ id: `pillar-${p.ticker}-${p.claim.slice(0, 12)}`, ts: null, label: `${p.ticker}: watching "${p.claim.slice(0, 80)}${p.claim.length > 80 ? '…' : ''}"`, right: `breaks if ${p.breaksIf!.slice(0, 60)}${p.breaksIf!.length > 60 ? '…' : ''}` });
    }
    // Only when it is literally true: the poller stamped a heartbeat inside the last two minutes.
    const checked = data.worklog.watch.checkedAt;
    if (checked && Date.now() - new Date(checked).getTime() < 2 * 60_000) {
      rows.unshift({ id: 'poll', ts: null, label: 'Next filing poll', right: 'in 1 min · EDGAR feed, every minute through the session' });
    }
    rows.push({ id: 'next', ts: data.run.nextRunAt, label: 'Next full read', right: `${clock(data.run.nextRunAt)} · ${data.book.positions > 0 ? `all ${plural(data.book.positions, 'position')}` : thesesWord(data.theses.tracked)}` });
    return rows;
  }, [data]);

  if (error) return <p className="text-[13px] text-[#F87171] m-0" style={MONO}>{error}</p>;
  if (!data) {
    return (
      <div className="max-w-[860px]" aria-label="Loading the ledger">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className={`${RULE} py-3`}><div className="h-[12px] w-[60%] rounded bg-white/[0.04]" /></div>)}
      </div>
    );
  }

  const readTotal = data.sources.filings + data.sources.news + data.sources.priceMoves;
  // What the morning email would carry above the prose: the first three OVERNIGHT lines and the AHEAD "next" line.
  const emailRows = [...overnight.filter((r) => r.id !== 'brief').slice(0, 3), ...ahead.filter((r) => r.id === 'next')];
  const lead = data.digest ? (data.digest.split('\n\n').find((p) => p.trim()) ?? '') : '';

  return (
    <div className="max-w-[860px]">
      <div className="mb-8">
        <h1 className="m-0 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-[#FAFAFA]">The Ledger</h1>
        <p className="mt-1.5 m-0 text-[11.5px] text-[#8A8A8A]" style={MONO}>
          {data.run.lastRunAt ? <>ran {clock(data.run.lastRunAt)} {dayWord(data.run.lastRunAt)}</> : 'no run recorded'}
          <span className="text-[#3A3A3A]"> · </span>{plural(readTotal, 'source')}
          <span className="text-[#3A3A3A]"> · </span>{plural(data.book.positions, 'position')}
          <span className="text-[#3A3A3A]"> · </span>{thesesWord(data.theses.tracked)} watched
        </p>
      </div>

      <Block title="Overnight" meta={data.run.lastRunAt ? dayWord(data.run.lastRunAt) : undefined}>
        {overnight.length === 0 ? (
          <p className="py-3 m-0 text-[13px] text-[#8A8A8A]">No cron rows for this account in the last 72 hours.</p>
        ) : (
          <ol className="m-0 list-none p-0">
            {overnight.map((r) => (
              <LedgerRow key={r.id} row={r} open={open.has(r.id)} onToggle={() => toggle(r.id)} timeCol={r.ts ? clock(r.ts).replace(' ET', '') : ''} />
            ))}
          </ol>
        )}
      </Block>

      <Block title="Ahead">
        <ol className="m-0 list-none p-0">
          {ahead.map((r) => (
            <LedgerRow key={r.id} row={r} open={false} onToggle={() => {}} timeCol={r.ts ? (r.id === 'next' ? dayWord(r.ts) : calDay(r.ts)) : 'standing'} />
          ))}
        </ol>
      </Block>

      <Block title="As the email" meta="the first block of The Current, above the prose · same rows">
        <div className="mt-4 max-w-[520px] rounded-[8px] bg-[#1E1E1E] px-9 py-8" style={{ boxShadow: 'inset 0 2px 0 var(--color-gold)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>The Current</div>
          <div className="mt-3 text-[20px] font-bold leading-[1.3] text-[#FAFAFA]">Good morning.</div>
          <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>Overnight</div>
          <ol className="mt-2 m-0 list-none p-0">
            {emailRows.map((r) => (
              <li key={r.id} className="grid grid-cols-[76px_minmax(0,1fr)] items-baseline gap-x-3 py-1">
                <span className="text-[11px] text-[#6A6A6A]" style={MONO}>{r.id === 'next' ? 'next' : r.ts ? clock(r.ts) : ''}</span>
                <span className="text-[13px] leading-[1.5] text-[#D4D4D4]">{r.label}<span className="text-[#8F8F8F]"> · {r.right}</span></span>
              </li>
            ))}
          </ol>
          {lead && <p className="mt-5 m-0 text-[15px] leading-[1.7] text-[#8F8F8F]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{lead.slice(0, 200)}...</p>}
          <div className="mt-6 inline-block rounded-[6px] bg-[var(--color-gold)] px-7 py-3 text-[14px] font-bold text-[#0A0A0A]">Read full brief →</div>
        </div>
      </Block>

      <Block title="The brief" meta={data.run.lastRunAt ? `written ${clock(data.run.lastRunAt)}` : undefined}>
        {data.digest ? (
          <div className="pt-3">
            {data.digest.split('\n\n').map((para, i) => (
              <p key={i} className="m-0 mb-3.5 text-[15px] leading-[1.65] text-[#D4D4D4]">{para}</p>
            ))}
          </div>
        ) : (
          <p className="py-3 m-0 text-[13px] text-[#8A8A8A]">No personal brief stored for this account (free tier, or the digest has not generated).</p>
        )}
      </Block>

      <div className="border-t border-[var(--color-rule)] pt-4">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>Lab note</div>
        <ul className="mt-2 m-0 list-none p-0 space-y-1 text-[12px] leading-[1.55] text-[#8A8A8A]">
          <li>Every OVERNIGHT line is a real row; no line is padded. A quiet day reads as numbers, not as an empty state.</li>
          <li>Receipts open in place. Nothing animates. The interactivity is the record.</li>
          <li>AHEAD only lists what the crons literally do: the 9:15 read, earnings re-reads, pillar kill criteria that exist on this account.</li>
          <li>The morning email would carry the first three OVERNIGHT lines and the AHEAD next line above the prose; the card above is that block, from the same rows. Nothing is sent from here.</li>
        </ul>
        <p className="mt-3 text-[10.5px] text-[#5F5F5F] m-0" style={MONO}>fetched in {Object.values(data.ms).reduce((a, b) => a + (b ?? 0), 0)} ms · coverage {data.coverage.covered.length}/{data.coverage.covered.length + data.coverage.uncovered.length} names</p>
      </div>
    </div>
  );
}
