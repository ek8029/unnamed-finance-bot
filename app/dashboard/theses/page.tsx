// /dashboard/theses - first-class home for investment theses.
// Coexist A layout: conviction header, a shared-driver strip with an openable
// Constellation map, then the Standings (positions ranked by conviction, banded
// Strong / Holding / Under review). Click a row to expand its Why-I-Own-This.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { WhyIOwnThis } from '@/components/thesis/why-i-own-this';
import { ThesisActions } from '@/components/thesis/thesis-actions';
import { RatifyQueue, type RatifyItem } from '@/components/thesis/ratify-queue';
import { DriverMap, type NodeInfo } from '@/components/thesis/driver-map';
import { summarizePillars, effectiveStatus, type ThesisSummary } from '@/lib/thesis-summary';
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
// Drag-to-resize grip for the Keel. Counter-zoomed so it stays a constant size while
// the page scales. Drag horizontally to scale 100-200%, double-click to reset.
function ZoomGrip({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  const start = useRef<{ x: number; z: number } | null>(null);
  return (
    <div
      onPointerDown={(e) => { start.current = { x: e.clientX, z: zoom }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (start.current) setZoom(Math.min(2, Math.max(1, start.current.z + (e.clientX - start.current.x) * 0.0016))); }}
      onPointerUp={(e) => { start.current = null; try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {} }}
      onDoubleClick={() => setZoom(1)}
      title="Drag to resize the Keel · double-click to reset"
      style={{
        position: 'fixed', right: 18, bottom: 18, zoom: 1 / zoom, zIndex: 50, cursor: 'ew-resize',
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 8,
        background: '#141414', border: '1px solid rgba(255,255,255,0.10)', userSelect: 'none', touchAction: 'none',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8A8A8A' }}>⟷ {Math.round(zoom * 100)}%</span>
    </div>
  );
}

export default function ThesesPage() {
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [seedingTicker, setSeedingTicker] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [zoom, setZoom] = useState(1); // Keel size: drag the grip (bottom-right) to scale everything on big displays.
  useEffect(() => {
    const z = parseFloat(localStorage.getItem('helm_keel_zoom') || '1');
    if (z >= 1 && z <= 2) setZoom(z);
  }, []);
  useEffect(() => {
    try { localStorage.setItem('helm_keel_zoom', String(zoom)); } catch {}
  }, [zoom]);

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
      // Direct fetch instead of useHoldings() - the hook drags in 15s quote polling this page does not need.
      const res = await fetch('/api/holdings');
      if (!mountedRef.current || !res.ok) return;
      const data = await res.json() as { holdings?: { ticker: string; asset_name?: string | null; total_value?: number | null }[] };
      if (!mountedRef.current) return;
      const raw = data.holdings ?? [];
      setHoldings(raw.map((h) => ({ ticker: h.ticker, name: h.asset_name ?? h.ticker, value: h.total_value ?? undefined })));
    } catch {
      // holdings section degrades gracefully - not fatal
    }
  }, []);

  useEffect(() => {
    loadTheses();
    loadHoldings();
  }, [loadTheses, loadHoldings]);

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
    return {
      t, summary, intact, total, score, band, worst,
      weight: weightByTicker.get(t.ticker.toUpperCase()),
      confirmedPillars: t.pillars.filter((p) => p.confirmed && p.lifecycle !== 'dismissed'),
    };
  });

  const sortRows = (band: Band) =>
    rows.filter((r) => r.band === band).sort((a, b) => b.score - a.score || (b.weight ?? 0) - (a.weight ?? 0) || a.t.ticker.localeCompare(b.t.ticker));
  const bandedRows: { band: Band; rows: Row[] }[] = (['strong', 'holding', 'review'] as Band[])
    .map((band) => ({ band, rows: sortRows(band) }))
    .filter((g) => g.rows.length > 0);

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
        await loadTheses();
        if (mountedRef.current) { setSelectedTicker(ticker); setDetailOpen(true); }
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
          <button type="button" onClick={() => { setPhase('loading'); loadTheses(); }} className="underline hover:text-[#9A9A9A] transition-colors">
            Retry
          </button>
        </p>
      </div>
    );
  }

  const noThesesYet = theses.length === 0;

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
    <div className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] divide-y divide-white/[0.05]">
      {unthesedHoldings.map((h) => (
        <div key={h.ticker} className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="font-mono text-[14.5px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA]" style={MONO}>{h.ticker}</span>
              {h.name && h.name !== h.ticker && <span className="ml-2 text-[13px] text-[#6A6A6A] truncate">{h.name}</span>}
            </div>
            <button
              type="button"
              disabled={seedingTicker === h.ticker}
              onClick={() => handleSeed(h.ticker)}
              className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] px-3.5 py-2 rounded bg-transparent text-[#E6B94D] border border-[rgba(230,185,77,0.35)] hover:bg-[rgba(230,185,77,0.08)] transition-colors disabled:opacity-50"
              style={MONO}
            >
              {seedingTicker === h.ticker ? 'Drafting...' : 'Draft thesis'}
            </button>
          </div>
          {seedError === h.ticker && <p className="mt-2 font-mono text-[11px] text-[#F87171]" style={MONO}>Could not draft thesis. Try again.</p>}
        </div>
      ))}
    </div>
  );

  let rank = 0; // global rank across bands

  return (
    <div style={{ zoom }} className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <ZoomGrip zoom={zoom} setZoom={setZoom} />

      {/* ── Section 1: Conviction header ── */}
      {noThesesYet ? (
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2.5" style={MONO}>Theses</div>
          <h1 className="text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#FAFAFA] m-0">Your conviction, watched.</h1>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-3" style={MONO}>Your conviction today</div>
            <h1 className="text-[clamp(27px,3vw,34px)] font-bold leading-[1.14] tracking-[-0.03em] text-[#FAFAFA] m-0">{verdictHeadline}</h1>
            <p className="mt-3.5 text-[16.5px] leading-[1.5] text-[#9A9A9A] max-w-[540px] m-0" style={{ ...SERIF, fontStyle: 'italic' }}>{verdictSub}</p>
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
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[13px]" style={MONO}>
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

      {/* ── Section 2: Driver strip + openable map ── */}
      {!noThesesYet && <DriverMap nodes={nodeMap} />}

      {/* ── Section 3: Standings ── */}
      {!noThesesYet && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted,#6A6A6A)]" style={MONO}>
              Standings &middot; strongest to weakest
            </span>
            <span className="font-mono text-[10.5px] tracking-[0.08em] text-[#5A5A5A]" style={MONO}>
              intact pillars &middot; % of portfolio &middot; conviction
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-[#0E0E0E] overflow-hidden">
            {bandedRows.map(({ band, rows: bandRows }) => (
              <div key={band}>
                <div className="flex items-center gap-2 px-4 sm:px-5 pt-4 pb-2 border-t border-white/[0.05] first:border-t-0">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: BAND_META[band].color, boxShadow: band === 'holding' ? 'none' : `0 0 7px ${BAND_META[band].color}` }} />
                  <span className="font-mono text-[13.5px] font-semibold uppercase tracking-[0.14em]" style={{ ...MONO, color: BAND_META[band].color }}>{BAND_META[band].label}</span>
                  <span className="font-mono text-[13.5px] text-[#4A4A4A]" style={MONO}>{bandRows.length}</span>
                </div>

                {bandRows.map((r) => {
                  rank += 1;
                  const open = selectedTicker === r.t.ticker && detailOpen;
                  const name = nameByTicker.get(r.t.ticker.toUpperCase());
                  const intactFrac = r.total > 0 ? r.intact / r.total : 0;
                  const thisRank = rank;
                  return (
                    <div key={r.t.id} className="border-t border-white/[0.04]">
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
                          {name && name !== r.t.ticker && <div className="text-[14px] text-[#6A6A6A] truncate">{name}</div>}
                        </div>
                        {/* pillars */}
                        <div className="hidden md:block w-[80px] shrink-0">
                          {r.total > 0 ? <SparkPills pillars={r.confirmedPillars} /> : (
                            <span className="font-mono text-[12.5px] uppercase tracking-[0.1em] text-[#5F5F5F]" style={MONO}>{r.summary.draftCount > 0 ? `${r.summary.draftCount} draft${r.summary.draftCount === 1 ? '' : 's'}` : 'no pillars'}</span>
                          )}
                        </div>
                        {/* intact count */}
                        <div className="hidden sm:block w-[52px] shrink-0 text-center">
                          {r.total > 0 && <span className="font-mono text-[18px] font-semibold tabular-nums" style={{ ...MONO, color: r.intact >= 3 ? '#4ADE80' : '#9A9A9A' }}>{r.intact}/{r.total}</span>}
                        </div>
                        {/* spacer */}
                        <div className="flex-1 min-w-0" />
                        {/* weight */}
                        {r.weight != null && <span className="hidden lg:block font-mono text-[15px] tabular-nums text-[#9A9A9A] w-[66px] text-right shrink-0" style={MONO}>{r.weight.toFixed(1)}%</span>}
                        {/* status chip */}
                        {r.worst && r.worst !== 'unverified' ? <div className="hidden sm:block shrink-0"><StatusChip status={r.worst} /></div> : <div className="hidden sm:block shrink-0 w-[1px]" />}
                        {/* conviction % */}
                        {r.total > 0 && <span className="font-mono text-[17px] font-semibold tabular-nums w-[54px] text-right shrink-0" style={{ ...MONO, color: convictionColor(intactFrac) }}>{Math.round(intactFrac * 100)}%</span>}
                        <ChevronDown className={`w-4 h-4 text-[#6A6A6A] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>

                      {open && (
                        <div className="px-4 sm:px-5 pb-5 pt-1 bg-[#0B0B0B]">
                          <div className="flex items-center justify-end mb-3">
                            <button type="button" onClick={() => handleDeleteThesis(r.t.ticker)} className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6A6A6A] hover:text-[#F87171] transition-colors" style={MONO}>
                              Delete thesis
                            </button>
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
        </section>
      )}

      {/* ── Bottom: start (empty state) or the ratify queue ── */}
      {noThesesYet ? (
        <section className="space-y-4">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted,#6A6A6A)]" style={MONO}>START</div>
          <p className="text-[15px] leading-[1.6] text-[#9A9A9A] max-w-[560px] m-0">
            Helm drafts the reasons you might own each position. You confirm or rewrite them in your own words, and Helm watches the record for anything that breaks them.
          </p>
          {unthesedHoldings.length > 0 ? unthesedListEl : (
            <p className="font-mono text-[12px] text-[#4A4A4A]" style={MONO}>Connect a brokerage account to see your holdings here.</p>
          )}
        </section>
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
