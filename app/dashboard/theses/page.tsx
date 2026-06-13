// /dashboard/theses - first-class home for investment theses.
// Quiet state is the hero state: when nothing moved against the user's
// reasons for holding, say exactly that, with a last-scanned stamp.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { WhyIOwnThis } from '@/components/thesis/why-i-own-this';
import { VerdictCard, type ThesisIntelligenceItem } from '@/components/thesis/verdict-card';
import { summarizePillars, effectiveStatus, type ThesisSummary } from '@/lib/thesis-summary';

/* ── Local types ── */
type PillarStatus = 'unverified' | 'intact' | 'weakening' | 'broken';

interface EvidenceRow {
  id: string;
  pillar_id: string;
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  excerpt: string;
  why: string;
  what_it_means: string;
  consider: string | null;
  source_title: string;
  source_url: string | null;
  source_published_at: string | null;
  created_at: string;
}

interface Pillar {
  id: string;
  thesis_id: string;
  claim: string;
  origin: 'user' | 'ai_draft';
  confirmed: boolean;
  status: PillarStatus;
  status_override: PillarStatus | null;
  lifecycle: string;
  sort_order: number;
  latest_evidence: EvidenceRow | null;
}

interface Thesis {
  id: string;
  ticker: string;
  tracked: boolean;
  notes: string | null;
  last_scanned_at: string | null;
  pillars: Pillar[];
}

interface Holding {
  ticker: string;
  name: string;
}

/* ── Local STATUS_META (mirrors why-i-own-this.tsx, not exported from there) ── */
const STATUS_META: Record<PillarStatus, { label: string; color: string }> = {
  intact:     { label: 'Intact',     color: '#4ADE80' },
  weakening:  { label: 'Weakening',  color: '#E6B94D' },
  broken:     { label: 'Broken',     color: '#F87171' },
  unverified: { label: 'Unverified', color: '#6A6A6A' },
};

/* toIntelligenceItem - mirrors line ~62 of why-i-own-this.tsx exactly */
function toIntelligenceItem(ticker: string, pillar: Pillar, e: EvidenceRow): ThesisIntelligenceItem {
  return {
    ticker,
    pillarClaim: pillar.claim,
    verdict: e.verdict,
    materiality: e.materiality,
    what: e.excerpt,
    why: e.why,
    whatItMeans: e.what_it_means,
    consider: e.consider,
    sourceTitle: e.source_title,
    sourceUrl: e.source_url,
    sourcePublishedAt: e.source_published_at,
    statusChanged: false,
  };
}

/* StatusChip - mirrors why-i-own-this.tsx internal component */
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

function StatusChip({ status }: { status: PillarStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border border-white/[0.07]"
      style={MONO}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.15em]"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </span>
  );
}

/* ── Aggregate status meter (thin flex bar) ── */
const METER_ORDER: PillarStatus[] = ['broken', 'weakening', 'unverified', 'intact'];
const METER_COLORS: Record<PillarStatus, string> = {
  broken:     '#F87171',
  weakening:  '#E6B94D',
  unverified: '#6A6A6A',
  intact:     '#4ADE80',
};

function AggregateMeter({
  counts,
  total,
  height = 6,
}: {
  counts: Record<PillarStatus, number>;
  total: number;
  height?: number;
}) {
  if (total === 0) return null;
  return (
    <div
      className="flex rounded-full overflow-hidden w-full"
      style={{ height }}
      aria-hidden
    >
      {METER_ORDER.map((s) => {
        const pct = (counts[s] / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={s}
            style={{ width: `${pct}%`, background: METER_COLORS[s], opacity: 0.85 }}
          />
        );
      })}
    </div>
  );
}

/* ── Per-thesis card meter (same component, smaller) ── */
function CardMeter({ summary }: { summary: ThesisSummary }) {
  const total = summary.confirmedCount;
  if (total === 0) return null;
  return <AggregateMeter counts={summary.statusCounts} total={total} height={4} />;
}

/* ── Date formatting ── */
function fmtScanned(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/* ── Skeleton pulse block ── */
function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-white/[0.05] animate-pulse ${className ?? ''}`}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-full max-w-xs" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Main page
   ════════════════════════════════════════════════════════════════════ */
export default function ThesesPage() {
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [seedingTicker, setSeedingTicker] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadTheses = useCallback(async () => {
    try {
      const res = await fetch('/api/thesis');
      if (!mountedRef.current) return;
      if (!res.ok) { setPhase('error'); return; }
      const data = await res.json() as { theses: Thesis[] };
      if (!mountedRef.current) return;
      setTheses(data.theses);
      setPhase('ready');
    } catch {
      if (mountedRef.current) setPhase('error');
    }
  }, []);

  const loadHoldings = useCallback(async () => {
    try {
      // Deliberately fetching /api/holdings directly instead of useHoldings() - the hook drags in 15-second quote polling this page does not need.
      const res = await fetch('/api/holdings');
      if (!mountedRef.current || !res.ok) return;
      const data = await res.json() as { holdings?: { ticker: string; asset_name?: string | null }[] };
      if (!mountedRef.current) return;
      const raw = data.holdings ?? [];
      setHoldings(raw.map((h) => ({ ticker: h.ticker, name: h.asset_name ?? h.ticker })));
    } catch {
      // holdings section degrades gracefully - not fatal
    }
  }, []);

  useEffect(() => {
    loadTheses();
    loadHoldings();
  }, [loadTheses, loadHoldings]);

  /* ── Derived data ── */
  const summaries = theses.map((t) => ({
    t,
    summary: summarizePillars(t.pillars),
  }));
  // Master-detail: selected thesis, defaulting to the first so detail always shows.
  const activeTicker = selectedTicker ?? summaries[0]?.t.ticker ?? null;

  // Attention items: confirmed pillars whose effectiveStatus is weakening|broken
  const attentionItems: { thesis: Thesis; pillar: Pillar }[] = [];
  for (const { t } of summaries) {
    const confirmed = t.pillars.filter((p) => p.confirmed);
    for (const p of confirmed) {
      const s = effectiveStatus(p);
      if (s === 'weakening' || s === 'broken') {
        attentionItems.push({ thesis: t, pillar: p });
      }
    }
  }
  // broken first
  attentionItems.sort((a, b) => {
    const oa = effectiveStatus(a.pillar) === 'broken' ? 0 : 1;
    const ob = effectiveStatus(b.pillar) === 'broken' ? 0 : 1;
    return oa - ob;
  });

  // Aggregate meter totals
  const aggregateCounts: Record<PillarStatus, number> = { broken: 0, weakening: 0, unverified: 0, intact: 0 };
  let totalPillarCount = 0;
  for (const { summary } of summaries) {
    for (const s of METER_ORDER) {
      aggregateCounts[s] += summary.statusCounts[s];
      totalPillarCount += summary.statusCounts[s];
    }
  }

  // Last scanned
  const lastScanned = theses.reduce<string | null>((best, t) => {
    if (!t.last_scanned_at) return best;
    if (!best) return t.last_scanned_at;
    return t.last_scanned_at > best ? t.last_scanned_at : best;
  }, null);

  // Holdings without a thesis
  const thesisTickers = new Set(theses.map((t) => t.ticker));
  const unthesedHoldings = holdings.filter((h) => !thesisTickers.has(h.ticker));

  // Quiet state: no attention items AND at least one confirmed pillar
  const totalConfirmed = summaries.reduce((sum, { summary }) => sum + summary.confirmedCount, 0);
  const isQuiet = attentionItems.length === 0 && totalConfirmed > 0;

  /* ── Seed handler ── */
  async function handleSeed(ticker: string) {
    if (seedingTicker) return;
    setSeedingTicker(ticker);
    setSeedError(null);
    try {
      const res = await fetch('/api/thesis/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      if (!mountedRef.current) return;
      if (res.ok) {
        await loadTheses();
        if (mountedRef.current) setSelectedTicker(ticker);
      } else {
        setSeedError(ticker);
      }
    } catch {
      if (mountedRef.current) setSeedError(ticker);
    } finally {
      if (mountedRef.current) setSeedingTicker(null);
    }
  }

  /* ── Loading / error ── */
  if (phase === 'loading') {
    return (
      <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
        <LoadingSkeleton />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
        <p className="font-mono text-[13px] text-[#6A6A6A]">
          Could not load theses.{' '}
          <button
            type="button"
            onClick={() => { setPhase('loading'); loadTheses(); }}
            className="underline hover:text-[#9A9A9A] transition-colors"
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  /* ── Empty state: no theses yet ── */
  const noThesesYet = theses.length === 0;

  return (
    <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 space-y-10">

      {/* ── Section 1: Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-1"
            style={MONO}
          >
            THESES
          </div>
          <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[#FAFAFA] m-0">
            Theses
          </h1>
        </div>

        {lastScanned && (
          <div
            className="font-mono text-[11px] tracking-[0.06em] text-[#4A4A4A] tabular-nums self-start sm:self-end"
            style={MONO}
          >
            Last scanned {fmtScanned(lastScanned)}
          </div>
        )}
      </div>

      {/* Aggregate meter + counts (only when theses exist) */}
      {!noThesesYet && totalPillarCount > 0 && (
        <div className="space-y-2">
          <AggregateMeter counts={aggregateCounts} total={totalPillarCount} height={6} />
          <p className="font-mono text-[11px] tracking-[0.06em] text-[#6A6A6A]" style={MONO}>
            {totalPillarCount} pillar{totalPillarCount === 1 ? '' : 's'} across{' '}
            {theses.length} thesis{theses.length === 1 ? '' : 'es'}
          </p>
        </div>
      )}

      {/* ── Section 2: Needs Attention ── */}
      {attentionItems.length > 0 && (
        <section className="space-y-4">
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F87171]"
            style={MONO}
          >
            NEEDS ATTENTION
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {attentionItems.map(({ thesis, pillar }) => {
              const status = effectiveStatus(pillar);
              return (
                <div
                  key={pillar.id}
                  className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <Link
                      href={`/dashboard/holdings/${thesis.ticker}`}
                      className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA] hover:text-[var(--color-gold)] transition-colors"
                      style={MONO}
                    >
                      {thesis.ticker}
                    </Link>
                    <StatusChip status={status} />
                  </div>
                  <p className="text-[14px] font-medium leading-[1.45] text-[#9A9A9A] m-0">
                    {pillar.claim}
                  </p>
                  {pillar.latest_evidence && (
                    <VerdictCard
                      item={toIntelligenceItem(thesis.ticker, pillar, pillar.latest_evidence)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Section 3: Quiet state ── */}
      {isQuiet && (
        <div className="flex overflow-hidden rounded-[4px] border border-white/[0.06] bg-[#131313]">
          <div className="w-[3px] shrink-0 bg-[#4ADE80]" style={{ opacity: 0.7 }} />
          <div className="flex-1 px-10 py-10">
            <p
              className="m-0 mb-4 text-[32px] font-bold leading-[1.2] tracking-[-0.02em] text-[#FAFAFA]"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
            >
              Nothing moved against your theses.
            </p>
            <p
              className="m-0 mb-6 text-[17px] leading-[1.55] text-[#9A9A9A]"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic' }}
            >
              Helm scanned filings, insider activity and headlines overnight.
            </p>
            {lastScanned && (
              <div
                className="font-mono text-[11.5px] tracking-[0.06em] text-[#4A4A4A] tabular-nums"
                style={MONO}
              >
                Last scanned {fmtScanned(lastScanned)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 4: Your theses ── */}
      {!noThesesYet && (
        <section className="space-y-4">
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted,#6A6A6A)]"
            style={MONO}
          >
            YOUR THESES
          </div>
          <div className="flex flex-col 2xl:flex-row 2xl:gap-6 2xl:items-start">
            {/* Left rail: selectable thesis list (becomes a sticky sidebar on ultrawide) */}
            <div className="space-y-2.5 2xl:w-[340px] 2xl:shrink-0 2xl:sticky 2xl:top-6">
              {summaries.map(({ t, summary }) => {
                const active = activeTicker === t.ticker;
                const worst = summary.worst;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSelectedTicker(t.ticker); loadTheses(); }}
                    className={`w-full text-left rounded-lg border px-4 py-4 transition-colors ${
                      active
                        ? 'border-[rgba(230,185,77,0.4)] bg-[rgba(230,185,77,0.05)]'
                        : 'border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-mono text-[14px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA]"
                        style={MONO}
                      >
                        {t.ticker}
                      </span>
                      {summary.draftCount > 0 && (
                        <span
                          className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] px-2 py-[2px] rounded border border-[rgba(230,185,77,0.3)] text-[#E6B94D] bg-[rgba(230,185,77,0.06)]"
                          style={MONO}
                        >
                          {summary.draftCount} draft
                        </span>
                      )}
                      {t.tracked && (
                        <span
                          className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] px-2 py-[2px] rounded border border-[rgba(74,222,128,0.3)] text-[#4ADE80] bg-[rgba(74,222,128,0.06)]"
                          style={MONO}
                        >
                          Tracked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mt-1.5">
                      {worst && <StatusChip status={worst} />}
                      <span className="font-mono text-[11px] text-[#6A6A6A]" style={MONO}>
                        {summary.confirmedCount} pillar{summary.confirmedCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    {summary.confirmedCount > 0 && (
                      <div className="mt-3">
                        <CardMeter summary={summary} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right pane: selected thesis detail (fills remaining width) */}
            <div className="flex-1 min-w-0 mt-4 2xl:mt-0">
              {activeTicker && (
                <div className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] p-5 sm:p-6 2xl:p-7">
                  <WhyIOwnThis key={activeTicker} ticker={activeTicker} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Section 5: Start a thesis (unthesed holdings + empty state lead) ── */}
      {(unthesedHoldings.length > 0 || noThesesYet) && (
        <section className="space-y-4">
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted,#6A6A6A)]"
            style={MONO}
          >
            {noThesesYet ? 'START' : 'START A THESIS'}
          </div>

          {noThesesYet && (
            <p className="text-[15px] leading-[1.6] text-[#9A9A9A] max-w-[560px] m-0">
              Helm drafts the reasons you might own each position. You confirm or rewrite them in your own words, and Helm watches the record for anything that breaks them.
            </p>
          )}

          {unthesedHoldings.length > 0 && (
            <div className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] divide-y divide-white/[0.05]">
              {unthesedHoldings.map((h) => (
                <div key={h.ticker} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span
                        className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA]"
                        style={MONO}
                      >
                        {h.ticker}
                      </span>
                      {h.name && h.name !== h.ticker && (
                        <span className="ml-2 text-[13px] text-[#6A6A6A] truncate">
                          {h.name}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={seedingTicker === h.ticker}
                      onClick={() => handleSeed(h.ticker)}
                      className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] px-3 py-1.5 rounded bg-transparent text-[#E6B94D] border border-[rgba(230,185,77,0.35)] hover:bg-[rgba(230,185,77,0.08)] transition-colors disabled:opacity-50"
                      style={MONO}
                    >
                      {seedingTicker === h.ticker ? 'Drafting...' : 'Draft thesis'}
                    </button>
                  </div>
                  {seedError === h.ticker && (
                    <p className="mt-2 font-mono text-[11px] text-[#F87171]" style={MONO}>
                      Could not draft thesis. Try again.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {noThesesYet && unthesedHoldings.length === 0 && (
            <p className="font-mono text-[12px] text-[#4A4A4A]" style={MONO}>
              Connect a brokerage account to see your holdings here.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
