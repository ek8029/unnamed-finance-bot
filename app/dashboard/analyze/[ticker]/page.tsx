import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { analyzeStock } from '@/lib/analyze-stock';
import { getFullTickerData } from '@/lib/financial-data';
import { createClient } from '@/lib/supabase/server';
import { AnalysisTerminal } from '@/app/analyze/[ticker]/analysis-terminal';
import { deriveThesisVerdict, VERDICT_META } from '@/lib/thesis-verdict';
import type { PillarStatus } from '@/lib/thesis-status';

// Research → thesis bridge. The research tab used to dead-end: you studied a
// name and the loop stopped there. This strip closes it — route the research
// into the builder (not held), a thesis draft (held, no reasons on record), or
// the live thesis the agent is already watching. Errors render nothing; the
// research page must never break on account state.
async function getThesisBridge(symbol: string): Promise<{
  variant: 'thesis' | 'draft' | 'held' | 'research';
  thesisId?: string;
  verdictLabel?: string;
} | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const [{ data: thesis }, { data: held }] = await Promise.all([
      supabase.from('theses').select('id, tracked').eq('user_id', user.id).eq('ticker', symbol).maybeSingle(),
      supabase.from('holdings').select('id').eq('user_id', user.id).eq('ticker', symbol).limit(1).maybeSingle(),
    ]);

    // Only a TRACKED thesis is genuinely being watched — an untracked row is a
    // draft in progress and must not be presented as agent coverage.
    if (thesis && thesis.tracked) {
      const { data: pillars } = await supabase
        .from('thesis_pillars')
        .select('status, status_override, lifecycle')
        .eq('thesis_id', thesis.id)
        .eq('confirmed', true);
      const counts: Record<PillarStatus, number> = { unverified: 0, intact: 0, weakening: 0, broken: 0 };
      for (const p of (pillars ?? []) as { status: PillarStatus; status_override: PillarStatus | null; lifecycle: string }[]) {
        if (p.lifecycle === 'dismissed') continue;
        counts[p.status_override ?? p.status]++;
      }
      const verdictLabel = VERDICT_META[deriveThesisVerdict(counts)].label;
      return { variant: 'thesis', thesisId: thesis.id as string, verdictLabel };
    }
    if (thesis) return { variant: 'draft' };
    if (held) return { variant: 'held' };
    return { variant: 'research' };
  } catch {
    return null;
  }
}

function ThesisBridge({ symbol, bridge }: { symbol: string; bridge: { variant: 'thesis' | 'draft' | 'held' | 'research'; thesisId?: string; verdictLabel?: string } }) {
  const copy = {
    thesis: {
      label: bridge.verdictLabel ? `Thesis on file · ${bridge.verdictLabel}` : 'Thesis on file',
      line: `Helm is watching your reasons for holding ${symbol} against fresh filings and news.`,
      cta: 'Open your thesis',
      href: `/dashboard/theses/${bridge.thesisId}`,
    },
    draft: {
      label: 'Draft in progress',
      line: `You started a thesis on ${symbol}. Confirm the pillars and track it, and Helm starts watching.`,
      cta: 'Finish your draft',
      href: `/dashboard/theses/builder?ticker=${symbol}`,
    },
    held: {
      label: `You hold ${symbol}`,
      line: 'No thesis on record. Write down why you own it and Helm will watch those reasons for you.',
      cta: 'Draft your thesis',
      href: `/dashboard/theses/builder?ticker=${symbol}`,
    },
    research: {
      label: `Researching ${symbol}?`,
      line: 'Stress-test it before you buy: draft the pillars, see the concentration it would add, the drivers you already lean on, and the bear case.',
      cta: 'Stress-test before you buy',
      href: `/dashboard/theses/builder?ticker=${symbol}`,
    },
  }[bridge.variant];

  return (
    <Link
      href={copy.href}
      className="mb-4 flex items-center gap-3 rounded-lg border border-white/[0.07] bg-[var(--color-bg-surface)] px-4 py-3 no-underline transition-colors hover:border-[rgba(230,185,77,0.28)]"
    >
      <span className="shrink-0 text-[12px] text-[var(--color-gold)]">✦</span>
      <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)]">
        {copy.label}
      </span>
      <span className="hidden min-w-0 flex-1 truncate text-[13px] text-[var(--color-text-secondary)] sm:block">
        {copy.line}
      </span>
      <span className="ml-auto shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]">
        {copy.cta} &rarr;
      </span>
    </Link>
  );
}

// Force dynamic rendering — quote prices must be fresh on every request
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');
  return { title: symbol ? `${symbol} Analysis` : 'Analysis' };
}

export default async function DashboardTickerAnalysisPage({ params }: Props) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');

  if (!symbol || symbol.length > 5) {
    notFound();
  }

  const [{ analysis, computedAt, dataSources, methodologyVersion }, tickerData, bridge] = await Promise.all([
    analyzeStock(symbol),
    getFullTickerData(symbol),
    getThesisBridge(symbol),
  ]);

  if (!analysis) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="text-center space-y-5 max-w-md">
          <div className="type-h1 text-[var(--color-text-primary)]">Ticker not found</div>
          <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed">
            We couldn&apos;t find data for <span className="font-bold text-[var(--color-text-primary)]">{symbol}</span>.
            Helm currently covers US-listed stocks and ETFs (NYSE, NASDAQ, AMEX).
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/dashboard/analyze"
              className="px-5 py-2 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[15px] font-semibold rounded transition-colors"
            >
              Try another ticker
            </a>
          </div>
        </div>
      </div>
    );
  }

  const computedAtIso = computedAt || new Date().toISOString();

  return (
    <div className="w-full px-3 sm:px-4 lg:px-6 py-4">
      {bridge && <ThesisBridge symbol={symbol} bridge={bridge} />}
      <AnalysisTerminal
        analysis={analysis}
        tickerData={tickerData}
        ticker={symbol}
        computedAt={computedAtIso}
        dataSources={dataSources}
        methodologyVersion={methodologyVersion}
        variant="dashboard"
      />
    </div>
  );
}
