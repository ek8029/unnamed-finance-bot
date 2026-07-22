// /testing/thesis-v2/compare — the shipped status engine beside the v2 ladder,
// run over identical real evidence.
//
// Dev only (404s in production), read-only. The point is not to show that v2
// differs; it is to show every pillar where it differs together with the
// evidence, so each disagreement can be judged on the merits rather than taken
// on trust. Several of them the shipped engine gets right.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getScoringThesisData, type ScoredCatch } from '@/lib/content/scoring-thesis';
import { comparePillar, type PillarComparison } from '@/lib/content/status-compare';
import { SOURCE_CLASS_LABEL } from '@/lib/content/mechanism-cluster';

export const metadata = { title: 'Thesis v2 · engine comparison', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MONO = { fontFamily: 'var(--font-mono)' } as const;
const PICKS = ['AAPL', 'NVDA', 'PLTR', 'MSFT', 'META', 'TSLA', 'PRIM', 'AMZN', 'JPM', 'AVGO', 'MU', 'GOOGL'];

const STATUS_TONE: Record<string, string> = {
  broken: '#F87171', weakening: '#E6B94D', intact: '#4ADE80', unverified: '#6A6A6A',
};

function StatusChip({ label, status }: { label: string; status: string }) {
  const tone = STATUS_TONE[status] ?? '#8A8A8A';
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[#6A6A6A] w-[54px]" style={MONO}>{label}</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] px-2 py-1 rounded"
        style={{ ...MONO, color: tone, background: `${tone}14` }}>
        {status}
      </span>
    </div>
  );
}

function EvidenceLine({ c }: { c: ScoredCatch }) {
  return (
    <li className="py-2 border-t border-white/[0.05] first:border-t-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#E6B94D]" style={MONO}>
          {SOURCE_CLASS_LABEL[c.sourceClass]}
        </span>
        <span className="text-[10.5px] text-[#5F5F5F]" style={MONO}>{c.dateISO}</span>
        {c.severe && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-[#F87171]" style={MONO}>severe</span>
        )}
      </div>
      <p className="mt-0.5 text-[13.5px] leading-[1.45] text-[#D8D8D8] m-0">{c.title}</p>
      <p className="mt-0.5 text-[12.5px] leading-[1.45] text-[#7A7A7A] m-0">{c.excerpt.slice(0, 170)}</p>
    </li>
  );
}

function Row({ ticker, claim, cmp, against }: { ticker: string; claim: string; cmp: PillarComparison; against: ScoredCatch[] }) {
  return (
    <section className={`mt-4 rounded-lg border bg-[#0B0B0B] px-4 sm:px-5 py-4 ${
      cmp.changed ? 'border-[rgba(230,185,77,0.3)]' : 'border-white/[0.07]'
    }`}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[12px] font-semibold text-[#E6B94D]" style={MONO}>{ticker}</span>
        <p className="text-[15px] leading-[1.4] font-semibold text-[#FAFAFA] m-0 flex-1 min-w-[240px]">{claim}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <StatusChip label="shipped" status={cmp.shipped} />
        <StatusChip label="v2" status={cmp.v2} />
        <span className="text-[11px] text-[#6A6A6A]" style={MONO}>
          {cmp.shippedIndependent} distinct {cmp.shippedIndependent === 1 ? 'URL' : 'URLs'} ·{' '}
          {cmp.v2Confirmations} source {cmp.v2Confirmations === 1 ? 'class' : 'classes'}
        </span>
      </div>

      <p className="mt-2.5 text-[13px] leading-[1.5] text-[#9A9A9A] m-0">{cmp.reason}</p>

      {against.length > 0 && (
        <details className="group mt-2.5">
          <summary className="list-none cursor-pointer min-h-[44px] flex items-center text-[12px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>
            <span className="group-open:rotate-90 transition-transform inline-block mr-1.5">▸</span>
            the {against.length} contradictions both engines were handed
          </summary>
          <ul className="mt-1 mb-0 pl-0 list-none">
            {against.map((c) => <EvidenceLine key={c.id} c={c} />)}
          </ul>
        </details>
      )}
    </section>
  );
}

export default async function CompareEngines({ searchParams }: { searchParams: Promise<{ t?: string; all?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { t, all } = await searchParams;
  const ticker = (t ?? 'AAPL').toUpperCase();
  const showAll = all === '1';

  const data = await getScoringThesisData(ticker);
  const cutoff = Date.now() - 30 * 86400_000;
  const rows = data.pillars.map((p) => ({
    claim: p.claim,
    cmp: comparePillar(p.catches, p.mechanisms),
    against: p.catches.filter(
      (c) =>
        c.verdict === 'contradicts' &&
        c.materiality === 'material' &&
        !c.isBackfill &&
        new Date(c.createdAt).getTime() >= cutoff,
    ),
  }));
  const shown = showAll ? rows : rows.filter((r) => r.cmp.changed || r.against.length > 0);

  return (
    <div className="min-h-dvh bg-[#060606] px-4 sm:px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/testing" className="inline-flex items-center min-h-[44px] text-[12px] text-[#6A6A6A] hover:text-[#FAFAFA]" style={MONO}>
          ← Testing
        </Link>

        <div className="mt-1 flex flex-wrap gap-2">
          {PICKS.map((p) => (
            <Link key={p} href={`/testing/thesis-v2/compare?t=${p}`}
              className={`px-3 min-h-[44px] inline-flex items-center rounded-full border text-[12px] tracking-[0.1em] ${
                p === ticker
                  ? 'border-[rgba(230,185,77,0.4)] bg-[rgba(230,185,77,0.08)] text-[#E6B94D]'
                  : 'border-white/[0.08] text-[#8A8A8A] hover:text-[#FAFAFA]'
              }`} style={MONO}>
              {p}
            </Link>
          ))}
        </div>

        <h1 className="mt-5 text-[26px] font-bold tracking-tight text-[#FAFAFA] m-0">
          Shipped engine vs the v2 ladder
        </h1>
        <p className="mt-2 text-[13.5px] leading-[1.6] text-[#8A8A8A]">
          Both run over the same evidence, the same 30-day window, and the same severity flag. The shipped engine counts
          an independent contradiction as a distinct URL, so one story carried by four outlets escalates a pillar. The
          ladder counts independence by source class within a mechanism. It can only hold a status down, never lift one.
        </p>
        <p className="mt-2 text-[13.5px] leading-[1.6] text-[#8A8A8A]">
          Measured across 22 tickers: <strong className="text-[#FAFAFA]">7 of 80 pillars change</strong>, all downward,
          every one of them from a single source class. Open the evidence and judge each on the merits. On some of these
          the shipped engine is right, and the reason is always the same: a wire report of a real event that reached us
          through a syndicator is being classed as opinion.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/testing/thesis-v2/compare?t=${ticker}${showAll ? '' : '&all=1'}`}
            className="inline-flex items-center min-h-[44px] px-3 rounded-md border border-white/[0.1] text-[12px] text-[#8A8A8A] hover:text-[#FAFAFA]" style={MONO}>
            {showAll ? 'hide pillars with no contradictions' : 'show every pillar'}
          </Link>
          <Link href={`/testing/thesis-v2?t=${ticker}`}
            className="inline-flex items-center min-h-[44px] px-3 rounded-md border border-white/[0.1] text-[12px] text-[#8A8A8A] hover:text-[#FAFAFA]" style={MONO}>
            open the v2 page for {ticker}
          </Link>
        </div>

        {shown.length === 0 ? (
          <p className="mt-10 text-[15px] text-[#8A8A8A]">
            Nothing contradicts any {data.ticker} pillar in the last 30 days, so the two engines have nothing to
            disagree about.
          </p>
        ) : (
          shown.map((r, i) => <Row key={i} ticker={data.ticker} claim={r.claim} cmp={r.cmp} against={r.against} />)
        )}
      </div>
    </div>
  );
}
