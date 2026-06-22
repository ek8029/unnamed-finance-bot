// /dashboard/screener - Thesis Screener.
// Filterable + sortable view of every tracked thesis as a conviction-banded row.
// Mirrors the Theses standings styling. Filters + quick-views are client-side; each
// row links to /dashboard/theses for the full Why-I-Own-This detail.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown } from 'lucide-react';
import { ProBlur } from '@/components/pro-blur';
import { CompanyLogo } from '@/components/company-logo';
import { STATUS_META, dotGlow } from '@/lib/thesis-palette';
import type { ScreenerRow, ConvictionBand } from '@/app/api/screener/route';
import type { SynthCluster } from '@/lib/thesis-synthesis';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const SERIF: React.CSSProperties = { fontFamily: "'Instrument Serif', Georgia, serif" };

const BAND_META: Record<ConvictionBand, { label: string; color: string }> = {
  strong: { label: 'Strong conviction', color: '#4ADE80' },
  holding: { label: 'Holding', color: '#6A6A6A' },
  review: { label: 'Under review', color: '#E6B94D' },
};

type SortKey = 'score' | 'broken' | 'ticker';
type QuickView = 'all' | 'breaking' | 'cluster';

/* ── Conviction band chip ── */
function BandChip({ band }: { band: ConvictionBand }) {
  const meta = BAND_META[band];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border border-white/[0.07]" style={MONO}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color, boxShadow: band === 'holding' ? 'none' : `0 0 7px ${meta.color}` }} />
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: meta.color }}>{meta.label}</span>
    </span>
  );
}

/* ── Pillar status pips: intact / weakening / broken counts ── */
function StatusPips({ intact, weakening, broken }: { intact: number; weakening: number; broken: number }) {
  const segs: { n: number; color: string; key: string }[] = [
    { n: intact, color: STATUS_META.intact.color, key: 'intact' },
    { n: weakening, color: STATUS_META.weakening.color, key: 'weakening' },
    { n: broken, color: STATUS_META.broken.color, key: 'broken' },
  ].filter((s) => s.n > 0);
  if (segs.length === 0) return <span className="font-mono text-[12px] text-[#4A4A4A]" style={MONO}>—</span>;
  return (
    <span className="inline-flex items-center gap-2.5">
      {segs.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color, boxShadow: s.key === 'broken' || s.key === 'weakening' ? `0 0 6px ${s.color}` : 'none' }} />
          <span className="font-mono text-[13px] tabular-nums" style={{ ...MONO, color: s.color }}>{s.n}</span>
        </span>
      ))}
    </span>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded bg-white/[0.05] animate-pulse ${className ?? ''}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-8 w-56" />
      <SkeletonBlock className="h-4 w-full max-w-md" />
      <div className="space-y-2 mt-6">
        {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} className="h-14 rounded-lg" />)}
      </div>
    </div>
  );
}

/* ── A single screener row (links to the thesis detail) ── */
function Row({ r }: { r: ScreenerRow }) {
  return (
    <Link
      href="/dashboard/theses"
      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_64px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 px-4 py-3.5 rounded-lg border border-white/[0.06] bg-[#131313] hover:bg-[#181818] hover:border-white/[0.1] transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <CompanyLogo ticker={r.ticker} size={26} />
        <span className="font-mono text-[16px] font-semibold uppercase tracking-[0.06em] text-[#FAFAFA] truncate" style={MONO}>{r.ticker}</span>
      </div>
      <div><BandChip band={r.convictionBand} /></div>
      <span className="font-mono text-[14px] tabular-nums text-right text-[#9A9A9A]" style={MONO}>{r.score}</span>
      <StatusPips intact={r.intactCount} weakening={r.weakeningCount} broken={r.brokenCount} />
      <span className="text-[13px] text-[#9A9A9A] truncate">{r.sector ?? '—'}</span>
      <span className="text-[13px] text-[#9A9A9A] truncate">{r.clusterDriver ?? '—'}</span>
    </Link>
  );
}

const COL_HEAD = 'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_64px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 px-4 pb-2';

export default function ScreenerPage() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [clusters, setClusters] = useState<SynthCluster[]>([]);
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready' | 'locked'>('loading');

  // Filters
  const [bandFilter, setBandFilter] = useState<ConvictionBand | 'all'>('all');
  const [needsBroken, setNeedsBroken] = useState(false);
  const [needsWeakening, setNeedsWeakening] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [clusterFilter, setClusterFilter] = useState<string>('all');
  const [quickView, setQuickView] = useState<QuickView>('all');
  const [sortKey, setSortKey] = useState<SortKey>('score');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/screener');
      if (!mountedRef.current) return;
      if (res.status === 403) { setPhase('locked'); return; }
      if (!res.ok) { setPhase('error'); return; }
      const data = await res.json() as { rows: ScreenerRow[]; clusters: SynthCluster[] };
      if (!mountedRef.current) return;
      setRows(data.rows ?? []);
      setClusters(data.clusters ?? []);
      setPhase('ready');
    } catch {
      if (mountedRef.current) setPhase('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sectors = useMemo(
    () => [...new Set(rows.map((r) => r.sector).filter((s): s is string => !!s))].sort(),
    [rows],
  );
  const drivers = useMemo(
    () => [...new Set(rows.map((r) => r.clusterDriver).filter((d): d is string => !!d))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    let out = rows.slice();
    if (bandFilter !== 'all') out = out.filter((r) => r.convictionBand === bandFilter);
    if (needsBroken) out = out.filter((r) => r.brokenCount > 0);
    if (needsWeakening) out = out.filter((r) => r.weakeningCount > 0);
    if (sectorFilter !== 'all') out = out.filter((r) => r.sector === sectorFilter);
    if (clusterFilter !== 'all') out = out.filter((r) => r.clusterDriver === clusterFilter);
    if (quickView === 'breaking') out = out.filter((r) => r.brokenCount > 0 || r.weakeningCount > 0);
    out.sort((a, b) => {
      if (sortKey === 'ticker') return a.ticker.localeCompare(b.ticker);
      if (sortKey === 'broken') return b.brokenCount - a.brokenCount || b.score - a.score;
      return b.score - a.score || a.ticker.localeCompare(b.ticker);
    });
    return out;
  }, [rows, bandFilter, needsBroken, needsWeakening, sectorFilter, clusterFilter, quickView, sortKey]);

  // Cluster quick-view: group the filtered rows under each shared driver.
  const clusterGroups = useMemo(() => {
    if (quickView !== 'cluster') return [];
    const byTicker = new Map(filtered.map((r) => [r.ticker, r]));
    return clusters
      .map((c) => {
        const seen = new Set<string>();
        const members: ScreenerRow[] = [];
        for (const p of c.pillars ?? []) {
          const t = p.ticker.toUpperCase();
          if (seen.has(t)) continue;
          const row = byTicker.get(t);
          if (row) { seen.add(t); members.push(row); }
        }
        return { cluster: c, members };
      })
      .filter((g) => g.members.length > 0);
  }, [quickView, clusters, filtered]);

  if (phase === 'loading') {
    return <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8"><LoadingSkeleton /></div>;
  }

  if (phase === 'locked') {
    return (
      <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
        <ProBlur
          label="Unlock the Screener with Pro"
          description="Rank every position by live conviction. Filter for broken or weakening theses, group by the shared driver that moves them together, and jump straight to what changed."
          minHeight="440px"
        >
          <div className="space-y-6">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-2.5" style={MONO}>Thesis Screener</div>
              <h1 className="text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#FAFAFA] m-0">Screen your conviction, not just your prices.</h1>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#0E0E0E] divide-y divide-white/[0.05]">
              {(['NVDA', 'AMD', 'PLTR', 'META'] as const).map((t, i) => (
                <div key={t} className="flex items-center justify-between px-5 py-3.5">
                  <span className="font-mono text-[17px] font-semibold text-[#FAFAFA]" style={MONO}>{t}</span>
                  <span className="font-mono text-[15px] text-[#9A9A9A]" style={MONO}>{['Strong', 'Strong', 'Under review', 'Strong'][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </ProBlur>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
        <p className="font-mono text-[13px] text-[#F87171]" style={MONO}>Could not load the screener. Refresh to try again.</p>
      </div>
    );
  }

  // Low state: the screener only earns its keep once a few theses exist.
  if (rows.length < 2) {
    return (
      <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-3" style={MONO}>Thesis Screener</div>
        <h1 className="text-[clamp(27px,3vw,34px)] font-bold leading-[1.14] tracking-[-0.03em] text-[#FAFAFA] m-0">A screen needs theses to rank.</h1>
        <p className="mt-3.5 text-[16.5px] leading-[1.5] text-[#9A9A9A] max-w-[560px] m-0" style={{ ...SERIF, fontStyle: 'italic' }}>
          The screener gets useful as you track more positions. Once you have written down why you own a few names, this becomes the fastest way to see which theses are breaking, which sectors you lean on, and which positions move on the same driver.
        </p>
        <Link
          href="/dashboard/theses/builder"
          className="inline-flex items-center mt-6 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] px-4 py-2.5 rounded bg-transparent text-[#E6B94D] border border-[rgba(230,185,77,0.35)] hover:bg-[rgba(230,185,77,0.08)] transition-colors"
          style={MONO}
        >
          Build a thesis
        </Link>
      </div>
    );
  }

  const SELECT_CLS = 'font-mono text-[12px] text-[#CFCFCF] bg-[#131313] border border-white/[0.1] rounded px-2.5 py-1.5 focus:outline-none focus:border-[rgba(230,185,77,0.5)]';
  const TOGGLE = (active: boolean) =>
    `font-mono text-[11.5px] font-semibold uppercase tracking-[0.1em] px-3 py-1.5 rounded border transition-colors ${active ? 'text-[#060606] bg-[var(--color-gold)] border-[var(--color-gold)]' : 'text-[#CFCFCF] bg-transparent border-white/[0.12] hover:border-white/[0.25]'}`;

  return (
    <div className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 space-y-7">
      <div>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)] mb-3" style={MONO}>Thesis Screener</div>
        <h1 className="text-[clamp(27px,3vw,34px)] font-bold leading-[1.14] tracking-[-0.03em] text-[#FAFAFA] m-0">Every position, ranked by conviction.</h1>
        <p className="mt-3.5 text-[16.5px] leading-[1.5] text-[#9A9A9A] max-w-[560px] m-0" style={{ ...SERIF, fontStyle: 'italic' }}>
          Filter, sort and group your theses. Click any row to open its full Why-I-Own-This.
        </p>
      </div>

      {/* ── Quick views ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={TOGGLE(quickView === 'all')} onClick={() => setQuickView('all')} style={MONO}>All positions</button>
        <button type="button" className={TOGGLE(quickView === 'breaking')} onClick={() => setQuickView('breaking')} style={MONO}>Breaking now</button>
        <button type="button" className={TOGGLE(quickView === 'cluster')} onClick={() => setQuickView('cluster')} disabled={clusters.length === 0} style={{ ...MONO, opacity: clusters.length === 0 ? 0.4 : 1 }}>By cluster</button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select className={SELECT_CLS} style={MONO} value={bandFilter} onChange={(e) => setBandFilter(e.target.value as ConvictionBand | 'all')} aria-label="Conviction band">
          <option value="all">All bands</option>
          <option value="strong">Strong conviction</option>
          <option value="holding">Holding</option>
          <option value="review">Under review</option>
        </select>
        <select className={SELECT_CLS} style={MONO} value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} aria-label="Sector">
          <option value="all">All sectors</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={SELECT_CLS} style={MONO} value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value)} aria-label="Cluster driver" disabled={drivers.length === 0}>
          <option value="all">All clusters</option>
          {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button type="button" className={TOGGLE(needsBroken)} onClick={() => setNeedsBroken((v) => !v)} style={MONO}>Has broken</button>
        <button type="button" className={TOGGLE(needsWeakening)} onClick={() => setNeedsWeakening((v) => !v)} style={MONO}>Has weakening</button>
        <div className="ml-auto flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#6A6A6A]" />
          <select className={SELECT_CLS} style={MONO} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort by">
            <option value="score">Sort: score</option>
            <option value="broken">Sort: broken</option>
            <option value="ticker">Sort: ticker</option>
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      {quickView === 'cluster' ? (
        clusterGroups.length === 0 ? (
          <p className="font-mono text-[13px] text-[#6A6A6A]" style={MONO}>No shared-driver clusters match the current filters.</p>
        ) : (
          <div className="space-y-7">
            {clusterGroups.map(({ cluster, members }) => (
              <div key={cluster.driver}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono text-[13.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)]" style={MONO}>{cluster.driver}</span>
                  <span className="font-mono text-[13.5px] text-[#4A4A4A]" style={MONO}>{members.length}</span>
                </div>
                <p className="text-[14px] leading-[1.5] text-[#9A9A9A] mb-3 max-w-[680px] m-0" style={{ ...SERIF, fontStyle: 'italic' }}>{cluster.rationale}</p>
                <div className="space-y-2">{members.map((r) => <Row key={r.ticker} r={r} />)}</div>
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <p className="font-mono text-[13px] text-[#6A6A6A]" style={MONO}>No positions match the current filters.</p>
      ) : (
        <div>
          <div className={COL_HEAD}>
            {['Position', 'Conviction', 'Score', 'Pillars', 'Sector', 'Cluster'].map((h, i) => (
              <span key={h} className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#5A5A5A] ${i === 2 ? 'text-right' : ''}`} style={MONO}>{h}</span>
            ))}
          </div>
          <div className="space-y-2">{filtered.map((r) => <Row key={r.ticker} r={r} />)}</div>
        </div>
      )}
    </div>
  );
}
