// A whole account's theses through the Thesis v2 model — the body shared by the
// standalone lab page (/testing/theses) and the lab shell (/testing/app/theses).
// Server component; caller supplies the account email and the surrounding chrome.

import { createStaticServiceClient } from '@/lib/supabase/server';
import { getScoringThesisData, type ScoringThesisData } from '@/lib/content/scoring-thesis';
import { PillarBlock, SectionLabel, Chip, MONO, LADDER_TONE, LADDER_LABEL, topCeiling } from '@/components/testing/thesis-v2-blocks';
import type { LadderStatus } from '@/lib/content/mechanism-cluster';

const MAX_THESES = 8;

function thesisCeiling(d: ScoringThesisData): LadderStatus {
  return d.pillars.reduce<LadderStatus>((worst, p) => {
    const c = topCeiling(p.mechanisms);
    const rank = { watch: 0, weakening: 1, broken: 2 } as const;
    return rank[c] > rank[worst] ? c : worst;
  }, 'watch');
}

export async function ThesesV2Body({ email }: { email: string }) {
  const target = email.trim().toLowerCase();
  if (!target) {
    return (
      <p className="text-[14px] text-[#8A8A8A] m-0">
        Pick an account to see its theses through the v2 model.
      </p>
    );
  }

  const db = createStaticServiceClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('id, email')
    .eq('email', target)
    .maybeSingle();
  if (!profile) return <p className="text-[14px] text-[#FAFAFA] m-0">No account for {target}</p>;

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
    <div>
      <div>
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
  );
}
