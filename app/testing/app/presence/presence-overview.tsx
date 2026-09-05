'use client';

// Overview, presence edition. The thesis of this screen: subtract, then
// annotate. No new strip. The present tense (what Helm is watching, when it
// priced this, when it reads again) lives in the caption that already sits
// under the net-worth figure. The one Done line is the existing delta line.
// AgentHeartbeat is gone; AgentFirstLook is folded into the delta line's job.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TodaysDelta } from '@/components/dashboard/todays-delta';
import type { PresenceData } from '@/app/api/testing/presence/route';
import { MONO, money, clock, dayWord, plural } from './format';

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

  const positions = data?.book.positions ?? 0;
  const names = data?.book.names ?? 0;
  const priced = data?.run.pricedAt ?? null;
  const next = data?.run.nextRunAt ?? null;

  return (
    <div className="max-w-[820px]">
      {/* ── Hero: the number, then the caption that carries the present tense ── */}
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#8A8A8A]" style={MONO}>
        Net worth · all accounts · USD
      </div>
      <div className="mt-2 text-[46px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[#FAFAFA]">
        {data ? money(data.book.totalValue) : <span className="inline-block h-[40px] w-[220px] rounded bg-white/[0.05] align-middle" aria-label="Loading net worth" />}
      </div>
      <p className="mt-2.5 text-[11.5px] leading-[1.6] text-[#8A8A8A] m-0" style={MONO}>
        {data ? (
          <>
            <Link href="/dashboard/holdings" className="text-[#B8B8B8] hover:text-[#FAFAFA] no-underline">{plural(positions, 'position')}</Link>
            {names !== positions && (<><span className="text-[#3A3A3A]"> · </span><span>{plural(names, 'name')}</span></>)}
            <span className="text-[#3A3A3A]"> · </span>
            <span>{priced ? <>priced {clock(priced)} {dayWord(priced)}</> : 'not priced yet'}</span>
            <span className="text-[#3A3A3A]"> · </span>
            <Link href="/testing/app/ledger" className="text-[#B8B8B8] hover:text-[#FAFAFA] no-underline">
              next read {clock(next)} {dayWord(next)}
            </Link>
          </>
        ) : (
          <span className="inline-block h-[12px] w-[360px] rounded bg-white/[0.04] align-middle" />
        )}
      </p>

      {/* ── The one Done line. Real component, real API, impersonated account. ── */}
      <div className="mt-7">
        <TodaysDelta />
      </div>

      {/* ── Lab note: what this screen removed. Not part of the product. ── */}
      <div className="mt-12 border-t border-[var(--color-rule)] pt-4">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#5F5F5F]" style={MONO}>Lab note · what changed on this page</div>
        <ul className="mt-2 m-0 list-none p-0 space-y-1 text-[12px] leading-[1.55] text-[#8A8A8A]">
          <li>Removed <code className="text-[#B8B8B8]" style={MONO}>AgentHeartbeat</code> (theses-only; the caption now carries what it said, for the whole book).</li>
          <li>Removed <code className="text-[#B8B8B8]" style={MONO}>AgentFirstLook</code> as a separate voice; its findings belong in the delta line&apos;s first-visit form.</li>
          <li>Added nothing. The caption is the present tense. The delta line is the past tense. The Ledger (brief) carries what is ahead.</li>
          <li>Below this point the real overview continues unchanged: sector heat, chart, KPI tiles, actions, allocation, movers.</li>
        </ul>
        {data && (
          <p className="mt-3 text-[10.5px] text-[#5F5F5F] m-0" style={MONO}>
            data: {plural(data.book.accounts.length, 'account')} · concentration {data.concentration ? `${data.concentration.ticker} ${data.concentration.pct.toFixed(0)}%` : 'n/a'} · sources 72h {data.sources.filings + data.sources.news + data.sources.priceMoves} · fetched in {Object.values(data.ms).reduce((a, b) => a + (b ?? 0), 0)} ms
          </p>
        )}
      </div>
    </div>
  );
}
