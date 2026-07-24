// /testing/theses — a real account's theses, rendered through the Thesis v2
// model (scoring pipeline → mechanisms → corroboration ladder) instead of the
// shipped status engine. This is the "whole theses page, v2": every thesis the
// account tracks, stacked, each collapsed into mechanisms with receipts.
//
// Dev only (404s in production). Pass ?email= to pick the account (kept out of
// code — public repo). Evidence is pooled across every Helm user tracking a
// ticker, the same honest behaviour as /testing/thesis-v2; a claim only merges
// with an identical claim, so a solo tracker sees only their own pillars.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createStaticServiceClient } from '@/lib/supabase/server';
import { getScoringThesisData, type ScoringThesisData } from '@/lib/content/scoring-thesis';
import { PillarBlock, SectionLabel, Chip, MONO, LADDER_TONE, LADDER_LABEL, topCeiling } from '@/components/testing/thesis-v2-blocks';
import type { LadderStatus } from '@/lib/content/mechanism-cluster';

export const metadata = { title: 'Theses v2', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MAX_THESES = 8;

function thesisCeiling(d: ScoringThesisData): LadderStatus {
  return d.pillars.reduce<LadderStatus>((worst, p) => {
    const c = topCeiling(p.mechanisms);
    const rank = { watch: 0, weakening: 1, broken: 2 } as const;
    return rank[c] > rank[worst] ? c : worst;
  }, 'watch');
}

export default async function ThesesV2Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { email } = await searchParams;
  const target = email?.trim().toLowerCase();
  if (!target) {
    return (
      <div className="min-h-dvh bg-[#060606] p-10 text-[#FAFAFA]">
        <Link href="/testing" className="text-[12px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>← Testing</Link>
        <p className="mt-6 text-[14px] m-0">
          Pass an account, e.g. <span style={MONO}>/testing/theses?email=someone@example.com</span>
        </p>
      </div>
    );
  }

  const db = createStaticServiceClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('id, email')
    .eq('email', target)
    .maybeSingle();
  if (!profile) {
    return <div className="min-h-dvh bg-[#060606] p-10 text-[#FAFAFA]">No account for {target}</div>;
  }

  const { data: theses } = await db
    .from('theses')
    .select('ticker, tracked')
    .eq('user_id', profile.id)
    .order('tracked', { ascending: false });

  const tickers = [...new Set((theses ?? []).map((t) => String(t.ticker).toUpperCase()))].slice(0, MAX_THESES);
  const data = await Promise.all(tickers.map((t) => getScoringThesisData(t)));

  const totalPillars = data.reduce((s, d) => s + d.pillars.length, 0);
  const totalMechanisms = data.reduce((s, d) => s + d.pillars.reduce((n, p) => n + p.mechanisms.length, 0), 0);

  return (
    <div className="min-h-dvh bg-[#060606] px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/testing" className="inline-flex items-center min-h-[44px] text-[12px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>
          ← Testing
        </Link>

        <div className="mt-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D]" style={MONO}>
            Theses · v2 model
          </div>
          <h1 className="mt-2 text-[30px] font-bold tracking-tight text-[#FAFAFA]">Your theses</h1>
          <p className="mt-2 text-[13px] text-[#8A8A8A]">
            {profile.email} · {tickers.length} {tickers.length === 1 ? 'thesis' : 'theses'} · {totalPillars} pillars ·{' '}
            {totalMechanisms} mechanisms after clustering
          </p>
        </div>

        {tickers.length === 0 ? (
          <p className="mt-8 text-[14px] text-[#8A8A8A]">This account has no theses.</p>
        ) : (
          <>
            {/* overview: one line per thesis, worst ceiling first */}
            <section className="mt-6 rounded-lg border border-white/[0.07] bg-[#0B0B0B] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.05]">
                <SectionLabel>Standings</SectionLabel>
              </div>
              {data
                .map((d) => ({ d, ceiling: thesisCeiling(d) }))
                .sort((a, b) => {
                  const rank = { broken: 0, weakening: 1, watch: 2 } as const;
                  return rank[a.ceiling] - rank[b.ceiling];
                })
                .map(({ d, ceiling }) => {
                  const movers = d.pillars.reduce(
                    (n, p) => n + p.mechanisms.filter((m) => m.maxStatus !== 'watch').length,
                    0,
                  );
                  return (
                    <a
                      key={d.ticker}
                      href={`#${d.ticker}`}
                      className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <span className="w-[64px] shrink-0 text-[14px] font-semibold text-[#FAFAFA]" style={MONO}>{d.ticker}</span>
                      <Chip tone={LADDER_TONE[ceiling]}>{LADDER_LABEL[ceiling]}</Chip>
                      <span className="ml-auto text-[11px] text-[#6A6A6A]" style={MONO}>
                        {d.pillars.length} pillars · {movers} moving
                      </span>
                    </a>
                  );
                })}
            </section>

            {/* full theses, stacked */}
            <div className="mt-8 space-y-10">
              {data.map((d) => (
                <section key={d.ticker} id={d.ticker} className="scroll-mt-4">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h2 className="text-[24px] font-bold tracking-tight text-[#FAFAFA] m-0">{d.ticker}</h2>
                    {d.company && <span className="text-[13px] text-[#8A8A8A]">{d.company}</span>}
                    <Chip tone={LADDER_TONE[thesisCeiling(d)]}>{LADDER_LABEL[thesisCeiling(d)]}</Chip>
                    <span className="ml-auto text-[11px] text-[#6A6A6A]" style={MONO}>
                      {d.dedupedRows} findings · last scan {d.lastScan ? d.lastScan.slice(0, 10) : 'never'}
                    </span>
                  </div>
                  {d.pillars.length === 0 ? (
                    <p className="mt-3 text-[13px] text-[#7A7A7A]">No scored evidence on this thesis yet.</p>
                  ) : (
                    d.pillars.map((p) => <PillarBlock key={p.key} p={p} />)
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
