// /dashboard/theses - first-class home for investment theses.
// Quiet state is the hero state: when nothing moved against the user's
// reasons for holding, say exactly that, with a last-scanned stamp.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { WhyIOwnThis } from '@/components/thesis/why-i-own-this';
import { VerdictCard, type ThesisIntelligenceItem } from '@/components/thesis/verdict-card';
import { CrossThesisSynthesis } from '@/components/thesis/cross-thesis-synthesis';
import { ThesisActions } from '@/components/thesis/thesis-actions';
import { RatifyQueue, type RatifyItem } from '@/components/thesis/ratify-queue';
import { summarizePillars, effectiveStatus, type ThesisSummary } from '@/lib/thesis-summary';
import { STATUS_META, dotGlow, METER_ORDER, METER_COLORS, convictionColor, type PillarStatus } from '@/lib/thesis-palette';

/* ── Local types ── */
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
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color, boxShadow: dotGlow(status) }} />
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
        const lit = s !== 'unverified';
        return (
          <div
            key={s}
            style={{ width: `${pct}%`, background: METER_COLORS[s], opacity: 0.85, boxShadow: lit ? `0 0 8px ${METER_COLORS[s]}` : 'none' }}
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
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

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

  // Group attention by ticker for the collapsed preview.
  const attnGroupsMap = new Map<string, { thesis: Thesis; pillars: Pillar[] }>();
  for (const { thesis, pillar } of attentionItems) {
    const g = attnGroupsMap.get(thesis.ticker) ?? { thesis, pillars: [] };
    g.pillars.push(pillar);
    attnGroupsMap.set(thesis.ticker, g);
  }
  const attnGroups = [...attnGroupsMap.values()];

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

  // Ratify queue: theses carrying unconfirmed AI-drafted pillars (variant A).
  const ratifyItems: RatifyItem[] = [];
  for (const { t } of summaries) {
    const drafts = t.pillars.filter(
      (p) => p.origin === 'ai_draft' && !p.confirmed && p.lifecycle !== 'dismissed',
    );
    if (drafts.length === 0) continue;
    ratifyItems.push({
      thesisId: t.id,
      ticker: t.ticker,
      draftPillarIds: drafts.map((d) => d.id),
      topClaim: drafts[0].claim,
      moreCount: drafts.length - 1,
    });
  }
  const confirmedThesisCount = summaries.filter(({ summary }) => summary.confirmedCount > 0).length;

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

  /* ── Delete thesis ── */
  async function handleDeleteThesis(ticker: string) {
    if (typeof window !== 'undefined' && !window.confirm(`Delete the ${ticker} thesis? This removes all its pillars and evidence.`)) return;
    try {
      const res = await fetch(`/api/thesis/${ticker}`, { method: 'DELETE' });
      if (!mountedRef.current) return;
      if (res.ok) {
        setDetailOpen(false);
        setSelectedTicker(null);
        await loadTheses();
      }
    } catch {
      // non-fatal
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

  /* ── Conviction verdict headline (Holdfast-style page lead) ── */
  const allIntact = totalPillarCount > 0 && aggregateCounts.intact === totalPillarCount;
  let verdictHeadline = 'Theses';
  if (totalPillarCount > 0) {
    if (allIntact) {
      verdictHeadline = `All ${totalPillarCount} pillar${totalPillarCount === 1 ? '' : 's'} intact.`;
    } else {
      verdictHeadline = `${aggregateCounts.intact} of ${totalPillarCount} pillars intact.`;
      if (aggregateCounts.weakening > 0 || aggregateCounts.broken > 0) {
        const parts: string[] = [];
        if (aggregateCounts.weakening > 0) parts.push(`${aggregateCounts.weakening} weakening`);
        parts.push(aggregateCounts.broken > 0 ? `${aggregateCounts.broken} broken` : 'none broken');
        verdictHeadline += ` ${parts.join(', ')}.`;
      }
    }
  }
  const verdictSub = allIntact
    ? 'Nothing threatens the reasons you hold what you hold.'
    : 'Helm watches filings, insider activity and headlines against every reason you hold.';

  /* Full untracked-holdings list (reused by the empty state and the drawer). */
  const unthesedListEl = (
    <div className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] divide-y divide-white/[0.05]">
      {unthesedHoldings.map((h) => (
        <div key={h.ticker} className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA]" style={MONO}>
                {h.ticker}
              </span>
              {h.name && h.name !== h.ticker && (
                <span className="ml-2 text-[13px] text-[#6A6A6A] truncate">{h.name}</span>
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
  );

  return (
    <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 space-y-10">

      {/* ── Section 1: Conviction header ── */}
      {noThesesYet ? (
        <div>
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2.5"
            style={MONO}
          >
            Theses
          </div>
          <h1 className="text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#FAFAFA] m-0">
            Your conviction, watched.
          </h1>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="min-w-0">
            <div
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-3"
              style={MONO}
            >
              Your conviction today
            </div>
            <h1 className="text-[clamp(27px,3vw,34px)] font-bold leading-[1.14] tracking-[-0.03em] text-[#FAFAFA] m-0">
              {verdictHeadline}
            </h1>
            <p
              className="mt-3.5 text-[16.5px] leading-[1.5] text-[#9A9A9A] max-w-[540px] m-0"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic' }}
            >
              {verdictSub}
            </p>
          </div>

          {totalPillarCount > 0 && (
            <div className="lg:w-[300px] shrink-0 rounded-lg border border-white/[0.07] bg-[#131313] p-4 space-y-3">
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-[26px] leading-none font-semibold tabular-nums"
                  style={{ ...MONO, color: convictionColor(aggregateCounts.intact / totalPillarCount) }}
                >
                  {Math.round((aggregateCounts.intact / totalPillarCount) * 100)}%
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>
                  conviction intact
                </span>
              </div>
              <AggregateMeter counts={aggregateCounts} total={totalPillarCount} height={8} />
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11.5px]" style={MONO}>
                {(['intact', 'weakening', 'broken', 'unverified'] as PillarStatus[])
                  .filter((s) => aggregateCounts[s] > 0)
                  .map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5" style={{ color: STATUS_META[s].color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_META[s].color, boxShadow: dotGlow(s) }} />
                      {aggregateCounts[s]} {STATUS_META[s].label}
                    </span>
                  ))}
              </div>
              {lastScanned && (
                <div
                  className="font-mono text-[10.5px] tracking-[0.06em] text-[#4A4A4A] tabular-nums pt-0.5"
                  style={MONO}
                >
                  Last scanned {fmtScanned(lastScanned)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Needs Attention (urgent, kept at top) ── */}
      {attentionItems.length > 0 && (
        <section>
          <div className="rounded-lg overflow-hidden bg-[#131313] border border-white/[0.07]" style={{ borderTop: '2px solid rgba(248,113,113,0.35)' }}>
            <button
              type="button"
              onClick={() => setAttentionOpen((o) => !o)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
            >
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F87171]" style={MONO}>
                Needs Attention
              </span>
              <span className="font-mono text-[11px] text-[#6A6A6A]" style={MONO}>
                {attnGroups.length} position{attnGroups.length === 1 ? '' : 's'} · {attentionItems.length} pillar{attentionItems.length === 1 ? '' : 's'}
              </span>
              <span className="ml-auto hidden sm:inline font-mono text-[10.5px] text-[#6A6A6A]" style={MONO}>
                {attentionOpen ? 'Hide evidence' : 'Show evidence'}
              </span>
              <ChevronDown className={`w-4 h-4 text-[#6A6A6A] transition-transform ${attentionOpen ? 'rotate-180' : ''}`} />
            </button>

            {!attentionOpen ? (
              <div className="px-5 pb-4 space-y-2.5">
                {attnGroups.map(({ thesis, pillars }) => {
                  const broken = pillars.filter((p) => effectiveStatus(p) === 'broken').length;
                  const weak = pillars.length - broken;
                  const worst: PillarStatus = broken > 0 ? 'broken' : 'weakening';
                  return (
                    <Link key={thesis.ticker} href={`/dashboard/holdings/${thesis.ticker}`} className="flex items-start gap-3 group">
                      <span className="mt-[5px] w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_META[worst].color, boxShadow: dotGlow(worst) }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA] group-hover:text-[var(--color-gold)] transition-colors" style={MONO}>
                            {thesis.ticker}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ ...MONO, color: STATUS_META[worst].color }}>
                            {[broken > 0 ? `${broken} broken` : '', weak > 0 ? `${weak} weakening` : ''].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] leading-[1.45] text-[#9A9A9A] line-clamp-1 m-0">{pillars[0].claim}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 pb-5 pt-1 border-t border-white/[0.05] grid grid-cols-1 lg:grid-cols-2 gap-5">
                {attentionItems.map(({ thesis, pillar }) => {
                  const status = effectiveStatus(pillar);
                  return (
                    <div key={pillar.id} className="rounded-lg border border-white/[0.07] bg-[#0E0E0E] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <Link
                          href={`/dashboard/holdings/${thesis.ticker}`}
                          className="font-mono text-[14px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA] hover:text-[var(--color-gold)] transition-colors"
                          style={MONO}
                        >
                          {thesis.ticker}
                        </Link>
                        <StatusChip status={status} />
                      </div>
                      <p className="text-[15px] font-medium leading-[1.5] text-[#C8C8C8] m-0">
                        {pillar.claim}
                      </p>
                      {pillar.latest_evidence && (
                        <VerdictCard
                          item={toIntelligenceItem(thesis.ticker, pillar, pillar.latest_evidence)}
                          showPillarClaim={false}
                          showTicker={false}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── All clear (compact; only when nothing needs attention) ── */}
      {!noThesesYet && totalPillarCount > 0 && attentionItems.length === 0 && (
        <section>
          <div
            className="rounded-lg bg-[#131313] border border-white/[0.07] px-5 py-4 flex items-center gap-3"
            style={{ borderTop: '2px solid rgba(74,222,128,0.35)' }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#4ADE80', boxShadow: '0 0 8px #4ADE8088' }} />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#FAFAFA]">All clear</div>
              <div className="text-[12.5px] text-[#8A8A8A]">
                {aggregateCounts.intact} pillar{aggregateCounts.intact === 1 ? '' : 's'} holding, nothing breaking.
                {lastScanned ? ` Last checked ${fmtScanned(lastScanned)}.` : ''} Helm is watching.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Your theses (grid + docked inspector) ── */}
      {!noThesesYet && (
        <section className="space-y-4">
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted,#6A6A6A)]"
            style={MONO}
          >
            YOUR THESES
          </div>
          {/* Accordion: compact rows, click expands one in place (others collapse) */}
          <div className="rounded-lg border border-white/[0.07] bg-[#0E0E0E] overflow-hidden divide-y divide-white/[0.05]">
            {summaries.map(({ t, summary }) => {
              const open = selectedTicker === t.ticker && detailOpen;
              const intactFrac = summary.confirmedCount > 0 ? summary.statusCounts.intact / summary.confirmedCount : 0;
              const worst: PillarStatus | null = summary.statusCounts.broken > 0 ? 'broken' : summary.statusCounts.weakening > 0 ? 'weakening' : null;
              return (
                <div key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (open) { setDetailOpen(false); return; }
                      setSelectedTicker(t.ticker);
                      setDetailOpen(true);
                      loadTheses();
                    }}
                    className={`w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 text-left transition-colors ${open ? 'bg-[rgba(230,185,77,0.045)]' : 'hover:bg-white/[0.02]'}`}
                  >
                    <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA] w-[58px] shrink-0" style={MONO}>
                      {t.ticker}
                    </span>
                    <div className="flex-1 min-w-0">
                      {summary.confirmedCount > 0 ? (
                        <AggregateMeter counts={summary.statusCounts} total={summary.confirmedCount} height={6} />
                      ) : summary.draftCount > 0 ? (
                        <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#E6B94D]" style={MONO}>
                          {summary.draftCount} draft{summary.draftCount === 1 ? '' : 's'} to confirm
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#5F5F5F]" style={MONO}>no pillars yet</span>
                      )}
                    </div>
                    {worst && <div className="hidden sm:block shrink-0"><StatusChip status={worst} /></div>}
                    {summary.confirmedCount > 0 && (
                      <span className="font-mono text-[13px] font-semibold tabular-nums w-[42px] text-right shrink-0" style={{ ...MONO, color: convictionColor(intactFrac) }}>
                        {Math.round(intactFrac * 100)}%
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-[#6A6A6A] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-white/[0.05]">
                      <div className="flex items-center justify-end mb-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteThesis(t.ticker)}
                          className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6A6A6A] hover:text-[#F87171] transition-colors"
                          style={MONO}
                        >
                          Delete thesis
                        </button>
                      </div>
                      <ThesisActions key={`actions-${t.id}`} thesisId={t.id} className="mb-4" />
                      <WhyIOwnThis key={t.ticker} ticker={t.ticker} bare />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Intelligence: cross-thesis synthesis (below the theses) ── */}
      {!noThesesYet && <CrossThesisSynthesis />}

      {/* ── Bottom: start (empty state) or the ratify queue ── */}
      {noThesesYet ? (
        <section className="space-y-4">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted,#6A6A6A)]" style={MONO}>
            START
          </div>
          <p className="text-[15px] leading-[1.6] text-[#9A9A9A] max-w-[560px] m-0">
            Helm drafts the reasons you might own each position. You confirm or rewrite them in your own words, and Helm watches the record for anything that breaks them.
          </p>
          {unthesedHoldings.length > 0 ? unthesedListEl : (
            <p className="font-mono text-[12px] text-[#4A4A4A]" style={MONO}>
              Connect a brokerage account to see your holdings here.
            </p>
          )}
        </section>
      ) : (
        <RatifyQueue
          items={ratifyItems}
          unthesed={unthesedHoldings}
          confirmedCount={confirmedThesisCount}
          onChanged={loadTheses}
          onEdit={(tk) => {
            setSelectedTicker(tk);
            setDetailOpen(true);
          }}
        />
      )}
    </div>
  );
}
