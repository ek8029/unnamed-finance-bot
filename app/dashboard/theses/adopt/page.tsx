'use client';

// FOLLOW a house thesis — the cold-start bridge. One click puts Helm's
// hand-authored thesis (pillars + the live evidence machine behind it) to work
// on a name the user owns. Provenance is explicit everywhere: this is Helm's
// reasoning being followed, not the user's own history.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HOUSE_THESES } from '@/lib/content/house-theses';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

export default function AdoptThesisPage() {
  const router = useRouter();
  const [held, setHeld] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState<string | null>(null);

  // Rank the grid: names the user actually holds first.
  useEffect(() => {
    let active = true;
    fetch('/api/dashboard/holdings-tickers')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { tickers?: string[] } | null) => {
        if (active && d?.tickers) setHeld(new Set(d.tickers.map((t) => t.toUpperCase())));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const sorted = [...HOUSE_THESES].sort((a, b) => {
    const ah = held.has(a.ticker) ? 0 : 1;
    const bh = held.has(b.ticker) ? 0 : 1;
    return ah !== bh ? ah - bh : a.ticker.localeCompare(b.ticker);
  });

  async function follow(ticker: string) {
    if (busy) return;
    setBusy(ticker);
    setNote(null);
    try {
      const res = await fetch('/api/thesis/adopt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      const d = await res.json();
      if (!res.ok) { setNote(d?.error ?? 'Could not follow. Try again.'); return; }
      setDone((prev) => new Set(prev).add(ticker));
      setNote(`Following Helm's ${ticker} thesis. The agent tests new filings and news against it from the next scan.`);
    } catch {
      setNote('Could not follow. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <header className="mb-8">
        <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2.5" style={MONO}>
          Follow a thesis
        </div>
        <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--color-text-primary)] m-0 mb-2">
          Put Helm&apos;s reasoning to work on names you own.
        </h1>
        <p className="text-[14px] leading-[1.6] text-[var(--color-text-secondary)] m-0 max-w-2xl">
          These are Helm&apos;s house theses: hand-written reasons to own each name, watched against
          filings, news and price every market day. Follow one and the agent tests the same reasons
          on your behalf. You can edit the pillars any time; edits make the thesis yours.
        </p>
        {note && (
          <p className="mt-4 text-[13px] text-[var(--color-gold)]" style={MONO}>{note}</p>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {sorted.map((t) => {
          const owned = held.has(t.ticker);
          const followed = done.has(t.ticker);
          return (
            <div key={t.ticker} className="rounded-lg border border-white/[0.07] bg-[#131313] px-5 py-4 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[16px] font-bold text-[var(--color-text-primary)]" style={MONO}>{t.ticker}</span>
                {owned && (
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded bg-[rgba(74,222,128,0.12)] text-[#4ADE80]" style={MONO}>
                    You own this
                  </span>
                )}
              </div>
              <div className="text-[13px] text-[var(--color-text-muted)] mb-2">{t.company}</div>
              <ul className="m-0 mb-4 list-none p-0 space-y-1 flex-1">
                {t.pillars.map((p) => (
                  <li key={p.id} className="text-[12.5px] leading-[1.45] text-[var(--color-text-secondary)] pl-3 relative">
                    <span aria-hidden className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-[var(--color-gold)]" />
                    {p.claim}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                {followed ? (
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#4ADE80]" style={MONO}>✓ Following</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy === t.ticker}
                    onClick={() => follow(t.ticker)}
                    className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] px-3 py-1.5 rounded border transition-colors disabled:opacity-60"
                    style={{ ...MONO, color: '#E6B94D', borderColor: 'rgba(230,185,77,0.35)', background: 'rgba(230,185,77,0.07)' }}
                  >
                    {busy === t.ticker ? 'Following…' : 'Follow'}
                  </button>
                )}
                <Link
                  href={`/thesis/${t.ticker.toLowerCase()}`}
                  className="font-mono text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  style={MONO}
                >
                  Track record ↗
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => router.push('/dashboard/theses')}
          className="font-mono text-[12px] text-[var(--color-gold)] hover:underline"
          style={MONO}
        >
          ← Back to your theses
        </button>
      </div>
    </div>
  );
}
