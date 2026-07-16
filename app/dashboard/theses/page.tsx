// /dashboard/theses - first-class home for investment theses.
// Coexist A layout: conviction header, a shared-driver strip with an openable
// Constellation map, then the Standings (positions ranked by conviction, banded
// Strong / Holding / Under review). Click a row to expand its Why-I-Own-This.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { WhyIOwnThis } from '@/components/thesis/why-i-own-this';
import { ProBlur } from '@/components/pro-blur';
import { usePreview } from '@/lib/preview-context';
import { tierAtLeast } from '@/lib/tier-shared';
import { TierLock } from '@/components/tier-lock';
import { ThesisActions } from '@/components/thesis/thesis-actions';
import { DemoConnectCta } from '@/components/demo/demo-connect-cta';
import { RatifyQueue, type RatifyItem } from '@/components/thesis/ratify-queue';
import { DriverMap, type NodeInfo } from '@/components/thesis/driver-map';
import { ThesisCardsView, type CardThesis } from '@/components/thesis/thesis-cards-view';
import { MaxUpgradeCard } from '@/components/max-upgrade-card';
import { AgentActivity } from '@/components/thesis/agent-activity';
import { summarizePillars, effectiveStatus, type ThesisSummary } from '@/lib/thesis-summary';
import { deriveThesisVerdict, verdictSentence } from '@/lib/thesis-verdict';
import { VerdictLine } from '@/components/thesis/verdict-chip';
import { STATUS_META, dotGlow, METER_ORDER, METER_COLORS, convictionColor, type PillarStatus } from '@/lib/thesis-palette';
import { CompanyLogo } from '@/components/company-logo';

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
  status_changed_at: string | null;
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
  value?: number;
  pl?: number; // unrealised gain/loss, dollars
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SERIF: React.CSSProperties = { fontFamily: "'Instrument Serif', Georgia, serif" };

type Band = 'strong' | 'holding' | 'review';
const BAND_META: Record<Band, { label: string; color: string }> = {
  strong: { label: 'Strong conviction', color: '#4ADE80' },
  holding: { label: 'Holding', color: '#6A6A6A' },
  review: { label: 'Under review', color: '#E6B94D' },
};

interface Row {
  t: Thesis;
  summary: ThesisSummary;
  intact: number;
  total: number;
  score: number;
  band: Band;
  worst: PillarStatus | null;
  weight?: number;
  confirmedPillars: Pillar[];
  movedAt: string | null;
}

function StatusChip({ status }: { status: PillarStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border border-white/[0.07]" style={MONO}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color, boxShadow: dotGlow(status) }} />
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.15em]" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </span>
  );
}

/* ── Pillar pips: one colored tick per confirmed pillar ── */
function SparkPills({ pillars }: { pillars: Pillar[] }) {
  if (pillars.length === 0) return null;
  return (
    <span className="inline-flex gap-[3px]">
      {pillars.slice(0, 6).map((p) => {
        const s = effectiveStatus(p);
        return <span key={p.id} className="w-[11px] h-[26px] rounded-[1px]" style={{ background: STATUS_META[s].color, opacity: s === 'unverified' ? 0.5 : 1 }} />;
      })}
    </span>
  );
}

/* ── Aggregate status meter (thin flex bar) ── */
function AggregateMeter({ counts, total, height = 6 }: { counts: Record<PillarStatus, number>; total: number; height?: number }) {
  if (total === 0) return null;
  return (
    <div className="flex rounded-full overflow-hidden w-full" style={{ height }} aria-hidden>
      {METER_ORDER.map((s) => {
        const pct = (counts[s] / total) * 100;
        if (pct === 0) return null;
        const lit = s !== 'unverified';
        return <div key={s} style={{ width: `${pct}%`, background: METER_COLORS[s], opacity: 0.85, boxShadow: lit ? `0 0 8px ${METER_COLORS[s]}` : 'none' }} />;
      })}
    </div>
  );
}

function fmtScanned(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Days since a status flip — drives the recency chip + "Recently moved" strip.
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function relTime(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return 'today';
  if (d === 1) return '1d ago';
  if (d < 7) return `${d}d ago`;
  if (d < 14) return '1w ago';
  if (d < 56) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded bg-white/[0.05] animate-pulse ${className ?? ''}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-full max-w-xs" />
      <SkeletonBlock className="h-14 rounded-lg mt-6" />
      <div className="space-y-2 mt-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} className="h-12 rounded-lg" />
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
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready' | 'locked'>('loading');
  const { tier: previewTier } = usePreview();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [seedingTicker, setSeedingTicker] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [firstTicker, setFirstTicker] = useState('');
  const [forceFirstRun, setForceFirstRun] = useState(false);
  // Inline first-thesis flow: pick -> confirm reasons -> scanning -> done
  const [onboardStep, setOnboardStep] = useState<'pick' | 'confirm' | 'scanning' | 'done'>('pick');
  const [draftTicker, setDraftTicker] = useState('');
  const [draftPillars, setDraftPillars] = useState<{ id: string; claim: string }[]>([]);
  const [keptClaims, setKeptClaims] = useState<Record<string, string>>({});
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [scanEvidence, setScanEvidence] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // Standings view toggle: show only theses with a broken or weakening pillar.
  const [breakingOnly, setBreakingOnly] = useState(false);
  // Presentation: narrative cards (default) vs the dense standings table.
  const [view, setView] = useState<'cards' | 'standings'>('cards');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Dev/preview: /dashboard/theses?firstrun=1 forces the first-run onboarding state.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('firstrun') === '1') setForceFirstRun(true);
  }, []);

  const loadTheses = useCallback(async () => {
    try {
      const res = await fetch('/api/thesis');
      if (!mountedRef.current) return;
      if (res.status === 403) { setPhase('locked'); return; }
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
      // Direct fetch instead of useHoldings() - the hook drags in 15s quote polling this page does not need.
      const res = await fetch('/api/holdings');
      if (!mountedRef.current || !res.ok) return;
      const data = await res.json() as { holdings?: { ticker: string; asset_name?: string | null; total_value?: number | null; unrealised_gain?: number | null }[] };
      if (!mountedRef.current) return;
      const raw = data.holdings ?? [];
      setHoldings(raw.map((h) => ({ ticker: h.ticker, name: h.asset_name ?? h.ticker, value: h.total_value ?? undefined, pl: h.unrealised_gain ?? undefined })));
    } catch {
      // holdings section degrades gracefully - not fatal
    }
  }, []);

  useEffect(() => {
    // Non-Pro is gated — don't fetch theses/holdings just to throw the data away
    // behind the lock; the lock renders off previewTier alone.
    if (!tierAtLeast(previewTier, 'pro')) return;
    loadTheses();
    loadHoldings();
  }, [loadTheses, loadHoldings, previewTier]);

  /* ── Derived data ── */
  const summaries = theses.map((t) => ({ t, summary: summarizePillars(t.pillars) }));

  // Portfolio weights (node size + Standings weight column). Degrades to undefined.
  const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const weightByTicker = new Map<string, number>();
  if (totalValue > 0) for (const h of holdings) if (h.value) weightByTicker.set(h.ticker.toUpperCase(), (h.value / totalValue) * 100);

  // Standings rows
  const rows: Row[] = summaries.map(({ t, summary }) => {
    const sc = summary.statusCounts;
    const intact = sc.intact;
    const total = summary.confirmedCount;
    const worst: PillarStatus | null =
      sc.broken > 0 ? 'broken' : sc.weakening > 0 ? 'weakening' : intact > 0 ? 'intact' : total > 0 ? 'unverified' : null;
    const band: Band =
      sc.weakening > 0 || sc.broken > 0 || total === 0 || intact === 0
        ? 'review'
        : intact >= 3 && sc.weakening === 0 && sc.broken === 0
          ? 'strong'
          : 'holding';
    const score = intact - (sc.weakening + sc.broken) * 2 - (intact === 0 ? 0.5 : 0);
    const movedAt = t.pillars
      .filter((p) => p.confirmed && p.lifecycle !== 'dismissed' && p.status_changed_at)
      .reduce<string | null>((best, p) => (!best || p.status_changed_at! > best ? p.status_changed_at! : best), null);
    return {
      t, summary, intact, total, score, band, worst,
      weight: weightByTicker.get(t.ticker.toUpperCase()),
      confirmedPillars: t.pillars.filter((p) => p.confirmed && p.lifecycle !== 'dismissed'),
      movedAt,
    };
  });

  const sortRows = (band: Band) =>
    rows.filter((r) => r.band === band).sort((a, b) => b.score - a.score || (b.weight ?? 0) - (a.weight ?? 0) || a.t.ticker.localeCompare(b.t.ticker));
  // A thesis is "breaking" when any confirmed pillar is broken or weakening.
  const isBreaking = (r: Row) => r.summary.statusCounts.broken > 0 || r.summary.statusCounts.weakening > 0;
  const breakingCount = rows.filter(isBreaking).length;
  const bandedRows: { band: Band; rows: Row[] }[] = (['strong', 'holding', 'review'] as Band[])
    .map((band) => ({ band, rows: sortRows(band).filter((r) => !breakingOnly || isBreaking(r)) }))
    .filter((g) => g.rows.length > 0);

  // Recently moved: positions whose conviction last flipped, newest first.
  const recentMovers = rows
    .filter((r) => r.movedAt)
    .sort((a, b) => (b.movedAt! > a.movedAt! ? 1 : -1))
    .slice(0, 3);

  // node map for the Constellation
  const nameByTicker = new Map(holdings.map((h) => [h.ticker.toUpperCase(), h.name]));
  const nodeMap: Record<string, NodeInfo> = {};
  for (const r of rows) nodeMap[r.t.ticker.toUpperCase()] = { status: r.worst, intact: r.intact, total: r.total, weight: r.weight };

  // Aggregate meter totals
  const aggregateCounts: Record<PillarStatus, number> = { broken: 0, weakening: 0, unverified: 0, intact: 0 };
  let totalPillarCount = 0;
  for (const { summary } of summaries) {
    for (const s of METER_ORDER) {
      aggregateCounts[s] += summary.statusCounts[s];
      totalPillarCount += summary.statusCounts[s];
    }
  }

  const lastScanned = theses.reduce<string | null>((best, t) => {
    if (!t.last_scanned_at) return best;
    if (!best) return t.last_scanned_at;
    return t.last_scanned_at > best ? t.last_scanned_at : best;
  }, null);

  const thesisTickers = new Set(theses.map((t) => t.ticker));
  const unthesedHoldings = holdings.filter((h) => !thesisTickers.has(h.ticker));

  const ratifyItems: RatifyItem[] = [];
  for (const { t } of summaries) {
    const drafts = t.pillars.filter((p) => p.origin === 'ai_draft' && !p.confirmed && p.lifecycle !== 'dismissed');
    if (drafts.length === 0) continue;
    ratifyItems.push({ thesisId: t.id, ticker: t.ticker, draftPillarIds: drafts.map((d) => d.id), topClaim: drafts[0].claim, moreCount: drafts.length - 1 });
  }
  const confirmedThesisCount = summaries.filter(({ summary }) => summary.confirmedCount > 0).length;

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
        const data = await res.json() as { pillars?: { id: string; claim: string; confirmed: boolean }[] };
        const drafts = (data.pillars ?? []).filter((p) => !p.confirmed);
        if (!mountedRef.current) return;
        if (drafts.length === 0) {
          // Existing/confirmed thesis — skip straight to the live view.
          setForceFirstRun(false);
          await loadTheses();
          if (mountedRef.current) { setSelectedTicker(ticker); setDetailOpen(true); }
        } else {
          setDraftTicker(ticker);
          setDraftPillars(drafts.map((p) => ({ id: p.id, claim: p.claim })));
          setKeptClaims(Object.fromEntries(drafts.map((p) => [p.id, p.claim])));
          setRemovedIds([]);
          setOnboardStep('confirm');
        }
      } else {
        setSeedError(ticker);
      }
    } catch {
      if (mountedRef.current) setSeedError(ticker);
    } finally {
      if (mountedRef.current) setSeedingTicker(null);
    }
  }

  /* ── Confirm drafted pillars, track, then backfill (the aha) ── */
  async function handleConfirm() {
    const kept = draftPillars.filter((p) => !removedIds.includes(p.id) && keptClaims[p.id]?.trim());
    if (kept.length === 0) return;
    setOnboardStep('scanning');
    try {
      await Promise.all(kept.map((p) =>
        fetch(`/api/thesis/pillars/${p.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed: true, claim: keptClaims[p.id].trim() }),
        }),
      ));
      const toRemove = draftPillars.filter((p) => removedIds.includes(p.id) || !keptClaims[p.id]?.trim());
      await Promise.all(toRemove.map((p) => fetch(`/api/thesis/pillars/${p.id}`, { method: 'DELETE' })));
      await fetch(`/api/thesis/${draftTicker}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked: true }),
      });
      const br = await fetch('/api/thesis/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: draftTicker }),
      });
      const result = br.ok ? (await br.json() as { evidenceAdded?: number }) : null;
      if (!mountedRef.current) return;
      setScanEvidence(result?.evidenceAdded ?? 0);
      setOnboardStep('done');
    } catch {
      if (mountedRef.current) { setSeedError(draftTicker); setOnboardStep('confirm'); }
    }
  }

  async function finishOnboarding() {
    const tk = draftTicker;
    setOnboardStep('pick');
    setForceFirstRun(false);
    await loadTheses();
    if (mountedRef.current && tk) { setSelectedTicker(tk); setDetailOpen(true); }
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

  /* ── Gate first: non-Pro sees the lock instantly (previewTier is correct on
        first paint), never waiting on the /api/thesis fetch. ── */
  if (phase === 'loading' && tierAtLeast(previewTier, 'pro')) {
    return (
      <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
        <LoadingSkeleton />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
        <p className="font-mono text-[15px] text-[#6A6A6A]">
          Could not load theses.{' '}
          <button type="button" onClick={() => { setPhase('loading'); loadTheses(); }} className="underline hover:text-[#9A9A9A] transition-colors">
            Retry
          </button>
        </p>
      </div>
    );
  }

  if (phase === 'locked' || !tierAtLeast(previewTier, 'pro')) {
    return (
      <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
        <TierLock
          required="pro"
          label="Unlock Theses with Pro"
          blurb="Write why you own each position. Helm scores SEC filings, news and price moves against your theses every market hour, and flags what strengthens or breaks them. Sourced, dated, auditable."
        >
          {/* Preview shows only TRUE statements — no invented pillar counts or
              conviction percentages, even behind the blur. */}
          <div className="space-y-6">
            <div>
              <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2.5" style={MONO}>Theses</div>
              <h1 className="text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#FAFAFA] m-0">Every reason you own it, watched.</h1>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#0E0E0E] divide-y divide-white/[0.05]">
              {(['NVDA', 'AMD', 'PLTR', 'META'] as const).map((t) => (
                <div key={t} className="flex items-center justify-between px-5 py-3.5">
                  <span className="font-mono text-[17px] font-semibold text-[#FAFAFA]" style={MONO}>{t}</span>
                  <span className="font-mono text-[15px] text-[#9A9A9A]" style={MONO}>filings · news · price, daily</span>
                </div>
              ))}
            </div>
          </div>
        </TierLock>
      </div>
    );
  }

  const noThesesYet = theses.length === 0 || forceFirstRun;

  /* ── Conviction verdict headline ── */
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

  const unthesedListEl = (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {unthesedHoldings.map((h) => (
        <div key={h.ticker} className="rounded-lg border border-white/[0.07] bg-[#131313] p-4 flex flex-col gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[16px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA] truncate" style={MONO}>{h.ticker}</div>
            {h.name && h.name !== h.ticker && <div className="text-[15px] text-[#6A6A6A] truncate mt-0.5">{h.name}</div>}
          </div>
          <button
            type="button"
            disabled={seedingTicker === h.ticker}
            onClick={() => handleSeed(h.ticker)}
            className="w-full font-mono text-[14px] font-semibold uppercase tracking-[0.12em] px-3.5 py-2.5 rounded bg-transparent text-[#E6B94D] border border-[rgba(230,185,77,0.35)] hover:bg-[rgba(230,185,77,0.08)] transition-colors disabled:opacity-50"
            style={MONO}
          >
            {seedingTicker === h.ticker ? 'Drafting…' : 'Draft thesis'}
          </button>
          {seedError === h.ticker && <p className="font-mono text-[11.5px] text-[#F87171]" style={MONO}>Try again.</p>}
        </div>
      ))}
    </div>
  );

  const isMax = tierAtLeast(previewTier, 'max');
  const flaggedRow = rows.find((r) => r.worst === 'broken') ?? rows.find((r) => r.worst === 'weakening') ?? null;

  const plByTicker = new Map<string, number>();
  for (const h of holdings) if (h.pl != null) plByTicker.set(h.ticker.toUpperCase(), h.pl);
  const cardTheses: CardThesis[] = bandedRows.flatMap((b) => b.rows).map((r) => ({
    thesisId: r.t.id,
    ticker: r.t.ticker,
    name: nameByTicker.get(r.t.ticker.toUpperCase()),
    status: r.worst,
    intact: r.intact,
    total: r.total,
    statement: r.confirmedPillars[0]?.claim ?? r.t.notes ?? `${r.t.ticker} thesis`,
    pl: plByTicker.get(r.t.ticker.toUpperCase()) ?? null,
  }));

  let rank = 0; // global rank across bands

  return (
    <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <DemoConnectCta
        headline="Track the theses behind your real positions."
        sub="Connect your brokerages and Helm watches every pillar, alerting you the morning one cracks, with the filing that broke it."
      />

      {/* ── Section 1: Conviction header ── */}
      {noThesesYet ? (
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2.5" style={MONO}>Theses</div>
            <h1 className="text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#FAFAFA] m-0">Your conviction, watched.</h1>
          </div>
          <Link
            href="/dashboard/theses/builder"
            className="shrink-0 self-start sm:self-auto font-mono text-[14px] font-semibold uppercase tracking-[0.12em] px-4 py-2.5 rounded bg-transparent text-[#E6B94D] border border-[rgba(230,185,77,0.35)] hover:bg-[rgba(230,185,77,0.08)] transition-colors"
            style={MONO}
          >
            Research a new thesis
          </Link>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="min-w-0">
            <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-3" style={MONO}>Your conviction today</div>
            <h1 className="text-[clamp(27px,3vw,34px)] font-bold leading-[1.14] tracking-[-0.03em] text-[#FAFAFA] m-0">{verdictHeadline}</h1>
            <p className="mt-3.5 text-[16.5px] leading-[1.5] text-[#9A9A9A] max-w-[540px] m-0" style={{ ...SERIF, fontStyle: 'italic' }}>{verdictSub}</p>
            <div className="mt-4 flex items-center gap-2.5 flex-wrap">
              <Link
                href="/dashboard/theses/builder"
                className="inline-block font-mono text-[14px] font-semibold uppercase tracking-[0.12em] px-4 py-2.5 rounded bg-transparent text-[#E6B94D] border border-[rgba(230,185,77,0.35)] hover:bg-[rgba(230,185,77,0.08)] transition-colors"
                style={MONO}
              >
                Build a thesis
              </Link>
              <Link
                href="/dashboard/theses/adopt"
                className="inline-block font-mono text-[14px] font-semibold uppercase tracking-[0.12em] px-4 py-2.5 rounded bg-[var(--color-gold)] text-black hover:bg-[var(--color-gold-hi)] transition-colors"
                style={MONO}
              >
                Follow a Helm thesis
              </Link>
            </div>
          </div>

          {totalPillarCount > 0 && (
            <div className="lg:w-[300px] shrink-0 rounded-lg border border-white/[0.07] bg-[#131313] p-4 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[30px] leading-none font-semibold tabular-nums" style={{ ...MONO, color: convictionColor(aggregateCounts.intact / totalPillarCount) }}>
                  {Math.round((aggregateCounts.intact / totalPillarCount) * 100)}%
                </span>
                <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>conviction intact</span>
              </div>
              <AggregateMeter counts={aggregateCounts} total={totalPillarCount} height={8} />
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[15px]" style={MONO}>
                {(['intact', 'weakening', 'broken', 'unverified'] as PillarStatus[])
                  .filter((s) => aggregateCounts[s] > 0)
                  .map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5" style={{ color: STATUS_META[s].color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_META[s].color, boxShadow: dotGlow(s) }} />
                      {aggregateCounts[s]} {STATUS_META[s].label}
                    </span>
                  ))}
              </div>
              {lastScanned && <div className="font-mono text-[11.5px] tracking-[0.06em] text-[#4A4A4A] tabular-nums pt-0.5" style={MONO}>Last scanned {fmtScanned(lastScanned)}</div>}
            </div>
          )}
        </div>
      )}

      {/* ── The agent, surfaced (Max) / unlock nudge (Pro) ── */}
      {!noThesesYet && isMax && flaggedRow && (
        <Link
          href={`/dashboard/theses/${flaggedRow.t.id}`}
          className="block rounded-lg p-5 no-underline transition-[filter] hover:brightness-[1.05]"
          style={{ border: '1px solid rgba(230,185,77,0.25)', background: 'rgba(230,185,77,0.04)' }}
        >
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ ...MONO, color: '#FFD67A' }}>
            ✦ Investigation · the agent
          </div>
          <div className="mb-1 text-[16px] font-semibold text-[#FAFAFA]">
            Helm flagged {flaggedRow.t.ticker}: {flaggedRow.worst === 'broken' ? 'a pillar broke' : 'a pillar is weakening'}
          </div>
          <div className="text-[13.5px] text-[var(--color-text-secondary)]">
            Open the reassessment to see what changed and the evidence behind it &rarr;
          </div>
        </Link>
      )}
      {!noThesesYet && isMax && <AgentActivity />}
      {!noThesesYet && !isMax && <AgentActivity locked />}
      {!noThesesYet && <MaxUpgradeCard />}

      {/* ── Section 2: Driver strip + openable map ── */}
      {!noThesesYet && <DriverMap nodes={nodeMap} />}

      {/* ── Section 3: Standings ── */}
      {!noThesesYet && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted,#6A6A6A)]" style={MONO}>
                Standings &middot; strongest to weakest
              </span>
              {breakingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setBreakingOnly((v) => !v)}
                  aria-pressed={breakingOnly}
                  className={`font-mono text-[12px] font-semibold uppercase tracking-[0.1em] px-3 py-1.5 rounded border transition-colors ${breakingOnly ? 'text-[#060606] bg-[var(--color-gold)] border-[var(--color-gold)]' : 'text-[#CFCFCF] bg-transparent border-white/[0.12] hover:border-white/[0.25]'}`}
                  style={MONO}
                >
                  Breaking ({breakingCount})
                </button>
              )}
              <div className="inline-flex overflow-hidden rounded border border-white/[0.12]">
                {(['cards', 'standings'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${view === v ? 'bg-[var(--color-gold)] text-[#060606]' : 'text-[#9A9A9A] hover:text-[#CFCFCF]'}`}
                    style={MONO}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <span className="font-mono text-[10.5px] tracking-[0.08em] text-[#5A5A5A]" style={MONO}>
              intact pillars &middot; % of portfolio &middot; conviction
            </span>
          </div>
          {recentMovers.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]" style={MONO}>Recently moved</span>
              {recentMovers.map((r) => (
                <button
                  key={r.t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTicker(r.t.ticker);
                    setDetailOpen(true);
                    loadTheses();
                    setTimeout(() => document.getElementById(`row-${r.t.ticker}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border border-[rgba(230,185,77,0.18)] bg-[rgba(230,185,77,0.05)] hover:bg-[rgba(230,185,77,0.1)] transition-colors"
                >
                  <span className="font-mono text-[14.5px] font-semibold uppercase tracking-[0.06em] text-[#FAFAFA]" style={MONO}>{r.t.ticker}</span>
                  <span className="font-mono text-[11.5px] text-[#9A9A9A]" style={MONO}>{relTime(r.movedAt!)}</span>
                </button>
              ))}
            </div>
          )}
          {view === 'cards' ? (
            <ThesisCardsView theses={cardTheses} />
          ) : (
          <div className="rounded-lg border border-white/[0.07] bg-[#0E0E0E] overflow-hidden">
            {bandedRows.map(({ band, rows: bandRows }) => (
              <div key={band}>
                <div className="flex items-center gap-2 px-4 sm:px-5 pt-4 pb-2 border-t border-white/[0.05] first:border-t-0">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: BAND_META[band].color, boxShadow: band === 'holding' ? 'none' : `0 0 7px ${BAND_META[band].color}` }} />
                  <span className="font-mono text-[15px] font-semibold uppercase tracking-[0.14em]" style={{ ...MONO, color: BAND_META[band].color }}>{BAND_META[band].label}</span>
                  <span className="font-mono text-[15px] text-[#4A4A4A]" style={MONO}>{bandRows.length}</span>
                </div>

                {bandRows.map((r) => {
                  rank += 1;
                  const open = selectedTicker === r.t.ticker && detailOpen;
                  const name = nameByTicker.get(r.t.ticker.toUpperCase());
                  const intactFrac = r.total > 0 ? r.intact / r.total : 0;
                  const thisRank = rank;
                  return (
                    <div key={r.t.id} id={`row-${r.t.ticker}`} className="relative border-t border-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => {
                          if (open) { setDetailOpen(false); return; }
                          setSelectedTicker(r.t.ticker);
                          setDetailOpen(true);
                          loadTheses();
                        }}
                        className={`w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 text-left transition-colors ${open ? 'bg-[rgba(230,185,77,0.045)]' : 'hover:bg-white/[0.02]'}`}
                      >
                        {/* rank */}
                        <span className="text-[30px] leading-none w-[36px] shrink-0 tabular-nums" style={{ ...SERIF, color: thisRank <= 3 ? 'var(--color-gold)' : '#4A4A4A' }}>{thisRank}</span>
                        {/* logo */}
                        <CompanyLogo ticker={r.t.ticker} size={34} className="shrink-0" />
                        {/* ticker + name */}
                        <div className="w-[150px] sm:w-[220px] shrink-0 min-w-0">
                          <div className="font-mono text-[17px] font-semibold uppercase tracking-[0.06em] text-[#FAFAFA]" style={MONO}>{r.t.ticker}</div>
                          {name && name !== r.t.ticker && <div className="text-[15px] text-[#6A6A6A] truncate">{name}</div>}
                        </div>
                        {/* pillars */}
                        <div className="hidden md:block w-[80px] shrink-0">
                          {r.total > 0 ? <SparkPills pillars={r.confirmedPillars} /> : (
                            <span className="font-mono text-[14.5px] uppercase tracking-[0.1em] text-[#5F5F5F]" style={MONO}>{r.summary.draftCount > 0 ? `${r.summary.draftCount} draft${r.summary.draftCount === 1 ? '' : 's'}` : 'no pillars'}</span>
                          )}
                        </div>
                        {/* intact count */}
                        <div className="hidden sm:block w-[52px] shrink-0 text-center">
                          {r.total > 0 && <span className="font-mono text-[18px] font-semibold tabular-nums" style={{ ...MONO, color: r.intact >= 3 ? '#4ADE80' : '#9A9A9A' }}>{r.intact}/{r.total}</span>}
                        </div>
                        {/* recency chip, right-aligned in the flexible gap */}
                        <div className="flex-1 min-w-0 flex justify-end pr-1">
                          {r.movedAt && (
                            <span className="hidden lg:inline-flex items-center font-mono text-[14px] tracking-[0.03em] text-[#5A5A5A]" style={MONO}>
                              moved {relTime(r.movedAt)}
                            </span>
                          )}
                        </div>
                        {/* weight */}
                        {r.weight != null && <span className="hidden lg:block font-mono text-[15px] tabular-nums text-[#9A9A9A] w-[66px] text-right shrink-0" style={MONO}>{r.weight.toFixed(1)}%</span>}
                        {/* status chip */}
                        {r.worst && r.worst !== 'unverified' ? <div className="hidden sm:block shrink-0"><StatusChip status={r.worst} /></div> : <div className="hidden sm:block shrink-0 w-[1px]" />}
                        {/* conviction % */}
                        {r.total > 0 && <span className="font-mono text-[17px] font-semibold tabular-nums w-[54px] text-right shrink-0" style={{ ...MONO, color: convictionColor(intactFrac) }}>{Math.round(intactFrac * 100)}%</span>}
                        <ChevronDown className={`w-4 h-4 text-[#6A6A6A] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>

                      {/* One-click reassessment entry: shown beneath the collapsed row when the agent
                          flagged a move, so it never overlaps the weight / status cluster. */}
                      {!open && (r.worst === 'broken' || r.worst === 'weakening') && (
                        <div className="px-4 sm:px-5 pb-2.5 -mt-1.5">
                          <Link
                            href={`/dashboard/theses/${r.t.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[10px] font-semibold uppercase tracking-[0.1em] no-underline"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: r.worst === 'broken' ? '#F87171' : '#E6B94D',
                              background: r.worst === 'broken' ? 'rgba(248,113,113,0.10)' : 'rgba(230,185,77,0.10)',
                              border: `1px solid ${r.worst === 'broken' ? 'rgba(248,113,113,0.30)' : 'rgba(230,185,77,0.30)'}`,
                            }}
                          >
                            Reassessment &rsaquo;
                          </Link>
                        </div>
                      )}

                      {open && (
                        <div className="px-4 sm:px-5 pb-5 pt-1 bg-[#0B0B0B]">
                          <div className="flex items-center justify-between mb-3">
                            <Link href={`/dashboard/theses/${r.t.id}`} className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6A6A6A] hover:text-[#E6B94D] transition-colors" style={MONO}>
                              Open reassessment &rsaquo;
                            </Link>
                            <button type="button" onClick={() => handleDeleteThesis(r.t.ticker)} className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6A6A6A] hover:text-[#F87171] transition-colors" style={MONO}>
                              Delete thesis
                            </button>
                          </div>
                          <div className="mb-4">
                            <VerdictLine
                              verdict={deriveThesisVerdict(r.summary.statusCounts)}
                              sentence={verdictSentence(r.confirmedPillars.map((cp) => ({ claim: cp.claim, status: cp.status_override ?? cp.status })))}
                            />
                          </div>
                          <ThesisActions key={`actions-${r.t.id}`} thesisId={r.t.id} className="mb-4" />
                          <WhyIOwnThis key={r.t.ticker} ticker={r.t.ticker} bare />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          )}
        </section>
      )}

      {/* ── Bottom: start (empty state) or the ratify queue ── */}
      {noThesesYet ? (
        onboardStep === 'pick' ? (
        <section className="space-y-7">
          <div>
            <div className="font-mono text-[14px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-3" style={MONO}>Start here</div>
            <p className="text-[17.5px] leading-[1.6] text-[#B8B8B8] max-w-[700px] m-0">
              Pick a stock you have a view on. Helm drafts the reasons you might own it. You confirm or rewrite them in your own words, and it watches filings, insider activity and headlines against every one.
            </p>
          </div>

          {/* 3-step */}
          <div className="grid sm:grid-cols-3 gap-4">
            {([
              ['1', 'Name a position', 'A ticker you actually have a view on.'],
              ['2', 'Confirm the reasons', 'Helm drafts the pillars; you keep what’s right.'],
              ['3', 'Helm watches', 'Filings, news and price moves, scored hourly.'],
            ] as const).map(([n, t, d]) => (
              <div key={n} className="rounded-lg border border-white/[0.07] bg-[#131313] p-5">
                <div className="font-mono text-[15px] font-semibold text-[var(--color-gold)] mb-2" style={MONO}>{n}</div>
                <div className="text-[16.5px] font-semibold text-[#FAFAFA] mb-1.5">{t}</div>
                <div className="text-[15px] leading-[1.5] text-[#8A8A8A]">{d}</div>
              </div>
            ))}
          </div>

          {/* Ticker input — no brokerage connection required */}
          <form
            onSubmit={(e) => { e.preventDefault(); const tk = firstTicker.trim().toUpperCase(); if (tk && !seedingTicker) handleSeed(tk); }}
            className="flex items-center gap-2.5 max-w-[520px]"
          >
            <input
              value={firstTicker}
              onChange={(e) => setFirstTicker(e.target.value)}
              placeholder="Ticker, e.g. NVDA"
              maxLength={10}
              spellCheck={false}
              className="flex-1 bg-[#0E0E0E] border border-white/[0.12] rounded px-4 py-3 font-mono text-[16px] tracking-[0.06em] text-[#FAFAFA] uppercase placeholder:text-[#5A5A5A] placeholder:normal-case focus:outline-none focus:border-[rgba(230,185,77,0.5)] transition-colors"
              style={MONO}
            />
            <button
              type="submit"
              disabled={!firstTicker.trim() || seedingTicker !== null}
              className="shrink-0 font-mono text-[15px] font-semibold uppercase tracking-[0.14em] px-5 py-3 rounded bg-[var(--color-gold)] text-black border border-[var(--color-gold)] hover:bg-[#EFCB72] transition-colors disabled:opacity-50"
              style={MONO}
            >
              {seedingTicker ? 'Drafting…' : 'Draft thesis'}
            </button>
          </form>
          {seedError && (
            <p className="font-mono text-[14.5px] text-[#F87171]" style={MONO}>Could not draft a thesis for {seedError}. Check the symbol and try again.</p>
          )}

          {/* or from holdings, when connected — fills the width as a grid */}
          {unthesedHoldings.length > 0 && (
            <div className="space-y-3.5">
              <div className="font-mono text-[15px] font-semibold uppercase tracking-[0.14em] text-[#7A7A7A]" style={MONO}>Or start from a holding</div>
              {unthesedListEl}
            </div>
          )}
        </section>
        ) : onboardStep === 'confirm' ? (
        <section className="space-y-6">
          <div>
            <div className="font-mono text-[14px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-3" style={MONO}>Confirm the reasons</div>
            <h2 className="text-[24px] font-bold leading-[1.15] tracking-[-0.02em] text-[#FAFAFA] m-0">Why you own {draftTicker}</h2>
            <p className="mt-2.5 text-[15.5px] leading-[1.6] text-[#9A9A9A] max-w-[640px] m-0">Helm drafted these. Keep what is right, rewrite any in your own words, and drop the rest.</p>
          </div>

          <div className="space-y-3 max-w-[760px]">
            {draftPillars.map((p) => {
              const removed = removedIds.includes(p.id);
              return (
                <div key={p.id} className={`rounded-lg border bg-[#131313] p-4 transition-opacity ${removed ? 'border-white/[0.05] opacity-40' : 'border-white/[0.09]'}`}>
                  <div className="flex items-start gap-3">
                    <textarea
                      value={keptClaims[p.id] ?? ''}
                      onChange={(e) => setKeptClaims((m) => ({ ...m, [p.id]: e.target.value }))}
                      disabled={removed}
                      rows={2}
                      className="flex-1 bg-transparent border-0 resize-none text-[15.5px] leading-[1.5] text-[#FAFAFA] focus:outline-none disabled:line-through disabled:text-[#6A6A6A]"
                    />
                    <button
                      type="button"
                      onClick={() => setRemovedIds((ids) => removed ? ids.filter((x) => x !== p.id) : [...ids, p.id])}
                      className="shrink-0 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6A6A6A] hover:text-[#F87171] transition-colors mt-0.5"
                      style={MONO}
                    >
                      {removed ? 'Add back' : 'Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={draftPillars.every((p) => removedIds.includes(p.id) || !keptClaims[p.id]?.trim())}
              className="font-mono text-[15px] font-semibold uppercase tracking-[0.14em] px-5 py-3 rounded bg-[var(--color-gold)] text-black border border-[var(--color-gold)] hover:bg-[#EFCB72] transition-colors disabled:opacity-50"
              style={MONO}
            >
              Track this thesis
            </button>
            <span className="font-mono text-[14px] text-[#5A5A5A]" style={MONO}>Helm will scan 12 months of filings and news against these.</span>
          </div>
          {seedError && (
            <p className="font-mono text-[14.5px] text-[#F87171]" style={MONO}>Something went wrong. Try again.</p>
          )}
        </section>
        ) : onboardStep === 'scanning' ? (
        <section className="space-y-4 py-8">
          <div className="font-mono text-[14px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>Scanning</div>
          <p className="text-[17px] leading-[1.5] text-[#FAFAFA] m-0">Helm is reading the last 12 months of filings, news and price moves for {draftTicker}.</p>
          <div className="h-1 w-[260px] max-w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full w-1/3 bg-[var(--color-gold)] animate-pulse" />
          </div>
          <p className="font-mono text-[14.5px] text-[#6A6A6A] m-0" style={MONO}>This takes a few seconds.</p>
        </section>
        ) : (
        <section className="space-y-5">
          <div className="font-mono text-[14px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>Now watching {draftTicker}</div>
          {scanEvidence && scanEvidence > 0 ? (
            <>
              <h2 className="text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-[#FAFAFA] m-0">Helm already found {scanEvidence} piece{scanEvidence === 1 ? '' : 's'} of evidence.</h2>
              <p className="text-[16px] leading-[1.6] text-[#9A9A9A] max-w-[600px] m-0">Across the reasons you confirmed, going back 12 months. From here Helm scans every hour the market is open and flags anything that strengthens or breaks them.</p>
            </>
          ) : (
            <>
              <h2 className="text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-[#FAFAFA] m-0">Helm is now watching {draftTicker}.</h2>
              <p className="text-[16px] leading-[1.6] text-[#9A9A9A] max-w-[600px] m-0">Nothing in the last 12 months moved these reasons. Helm scans every hour the market is open and will surface anything that strengthens or breaks them.</p>
            </>
          )}
          <button
            type="button"
            onClick={finishOnboarding}
            className="font-mono text-[15px] font-semibold uppercase tracking-[0.14em] px-5 py-3 rounded bg-[var(--color-gold)] text-black border border-[var(--color-gold)] hover:bg-[#EFCB72] transition-colors"
            style={MONO}
          >
            See {draftTicker}
          </button>
        </section>
        )
      ) : (
        <RatifyQueue
          items={ratifyItems}
          unthesed={unthesedHoldings}
          confirmedCount={confirmedThesisCount}
          onChanged={loadTheses}
          onEdit={(tk) => { setSelectedTicker(tk); setDetailOpen(true); }}
        />
      )}
    </div>
  );
}
