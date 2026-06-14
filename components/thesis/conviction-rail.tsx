// Conviction rail - ambient right-side panel summarizing thesis health across
// all positions. Ports the "persistent conviction rail" design (placement 03)
// to live data. Self-fetching, ultrawide-only (2xl+), user-collapsible.
// Labeled "Conviction" in the UI (never a codename). No advice language.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { summarizePillars, effectiveStatus } from '@/lib/thesis-summary';
import type { PillarStatus } from '@/lib/thesis-status';

/* ── Design tokens (match the live theses page hexes) ── */
const POS = '#4ADE80', GOLD = '#E6B94D', GOLD_HI = '#FFD67A', NEG = '#F87171';
const INK = '#FAFAFA', INK2 = '#9A9A9A', INK3 = '#6A6A6A', INK4 = '#4A4A4A';
const BG_INSET = '#060606';
const BD_BASE = 'rgba(255,255,255,0.07)', BD_SUBTLE = 'rgba(255,255,255,0.04)';
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

// Attention-card accents keyed by the group's worst status.
const ACCENT_BD: Record<'weakening' | 'broken', string> = { weakening: 'rgba(230,185,77,0.18)', broken: 'rgba(248,113,113,0.20)' };
const ACCENT_BG: Record<'weakening' | 'broken', string> = { weakening: 'rgba(230,185,77,0.06)', broken: 'rgba(248,113,113,0.07)' };

const STATUS_COLOR: Record<PillarStatus, string> = {
  intact: POS, weakening: GOLD, broken: NEG, unverified: INK3,
};
const STATUS_LABEL: Record<PillarStatus, string> = {
  intact: 'intact', weakening: 'weakening', broken: 'broken', unverified: 'watching',
};
const VERDICT_META: Record<string, { color: string; glyph: string; label: string }> = {
  supports:    { color: POS,  glyph: '+', label: 'Supports' },
  contradicts: { color: NEG,  glyph: '−', label: 'Contradicts' },
  neutral:     { color: INK2, glyph: '=', label: 'Neutral' },
};

/* ── Local types (shape returned by GET /api/thesis) ── */
interface Evidence {
  id: string;
  verdict: 'supports' | 'contradicts' | 'neutral';
  source_title: string;
  source_url: string | null;
  source_published_at: string | null;
  created_at: string;
}
interface Pillar {
  id: string;
  claim: string;
  confirmed: boolean;
  status: PillarStatus;
  status_override: PillarStatus | null;
  lifecycle: string;
  latest_evidence: Evidence | null;
}
interface Thesis {
  id: string;
  ticker: string;
  last_scanned_at: string | null;
  pillars: Pillar[];
}

/* ── Shape returned by GET /api/thesis/conviction (honest 14-day history) ── */
interface Transition {
  ticker: string;
  pillarId: string;
  claim: string;
  from: PillarStatus;
  to: PillarStatus;
  movedOn: string | null;
}
interface ConvictionData {
  trend: { date: string; intact: number }[];
  transitions: Transition[];
}

/* ── Small primitives (ported from the design kit) ── */
function Dot({ status, size = 6 }: { status: PillarStatus; size?: number }) {
  const color = STATUS_COLOR[status];
  const lit = status === 'intact' || status === 'weakening' || status === 'broken';
  return (
    <span
      className="rounded-full shrink-0"
      style={{ width: size, height: size, background: color, boxShadow: lit ? `0 0 7px ${color}` : 'none' }}
    />
  );
}

function Glyph({ verdict }: { verdict: string }) {
  const v = VERDICT_META[verdict] ?? VERDICT_META.neutral;
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-[2px]"
      style={{ ...MONO, width: 15, height: 15, border: `1px solid ${v.color}`, color: v.color, fontSize: 11, lineHeight: 1 }}
    >
      {v.glyph}
    </span>
  );
}

function Meter({ counts, total }: { counts: Record<PillarStatus, number>; total: number }) {
  if (total === 0) return null;
  // Red-first to match the shipped /dashboard/theses meter (app consistency).
  const order: PillarStatus[] = ['broken', 'weakening', 'unverified', 'intact'];
  return (
    <div className="flex w-full overflow-hidden rounded-[3px]" style={{ height: 7, gap: 2 }} aria-hidden>
      {order.map((s) => {
        if (counts[s] === 0) return null;
        const lit = s !== 'unverified';
        return (
          <div
            key={s}
            style={{ flex: counts[s], background: STATUS_COLOR[s], opacity: s === 'intact' ? 0.85 : 1, boxShadow: lit ? `0 0 8px ${STATUS_COLOR[s]}` : 'none' }}
          />
        );
      })}
    </div>
  );
}

// Small conviction sparkline: intact-pillar count over the trailing window.
function Trendline({ data, w = 272, h = 30 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => h - 2 - ((v - min) / rng) * (h - 4);
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', overflow: 'visible' }} aria-hidden>
      <polyline points={pts} fill="none" stroke={GOLD} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={2.4} fill={GOLD} />
    </svg>
  );
}

function Eyebrow({ children, color = INK3 }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="font-semibold uppercase" style={{ ...MONO, fontSize: 10, letterSpacing: '0.18em', color }}>
      {children}
    </div>
  );
}

function fmtScan(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ConvictionRail({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [theses, setTheses] = useState<Thesis[] | null>(null);
  const [conviction, setConviction] = useState<ConvictionData | null>(null);
  const [errored, setErrored] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const [tRes, cRes] = await Promise.all([
          fetch('/api/thesis'),
          fetch('/api/thesis/conviction'),
        ]);
        if (!mountedRef.current) return;
        if (!tRes.ok) { setErrored(true); return; }
        const data = await tRes.json() as { theses: Thesis[] };
        if (!mountedRef.current) return;
        setTheses(data.theses);
        // Conviction history is non-critical: the rail still renders if it fails.
        if (cRes.ok) {
          const cData = await cRes.json() as ConvictionData;
          if (mountedRef.current) setConviction(cData);
        }
      } catch {
        if (mountedRef.current) setErrored(true);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  /* ── Derived (mirrors /dashboard/theses) ── */
  const list = theses ?? [];
  const summaries = list.map((t) => ({ t, summary: summarizePillars(t.pillars) }));

  const counts: Record<PillarStatus, number> = { broken: 0, weakening: 0, unverified: 0, intact: 0 };
  for (const { summary } of summaries) {
    for (const s of ['broken', 'weakening', 'unverified', 'intact'] as PillarStatus[]) counts[s] += summary.statusCounts[s];
  }
  const total = counts.broken + counts.weakening + counts.unverified + counts.intact;

  const attention: { ticker: string; pillar: Pillar }[] = [];
  for (const { t } of summaries) {
    for (const p of t.pillars) {
      if (!p.confirmed) continue;
      const s = effectiveStatus(p);
      if (s === 'weakening' || s === 'broken') attention.push({ ticker: t.ticker, pillar: p });
    }
  }
  attention.sort((a, b) => (effectiveStatus(a.pillar) === 'broken' ? 0 : 1) - (effectiveStatus(b.pillar) === 'broken' ? 0 : 1));

  /* ── Honest conviction history (from /api/thesis/conviction) ── */
  const trendValues = (conviction?.trend ?? []).map((p) => p.intact);
  const transitions = conviction?.transitions ?? [];
  const verifiedN = transitions.filter((t) => t.to === 'intact').length;
  const weakenedN = transitions.filter((t) => t.to === 'weakening' || t.to === 'broken').length;
  const movedOnByPillar = new Map(transitions.map((t) => [t.pillarId, t.movedOn] as const));
  const trendCaption = [verifiedN ? `${verifiedN} verified` : '', weakenedN ? `${weakenedN} weakened` : '']
    .filter(Boolean)
    .join(' · ');

  /* ── Group attention by position: one card per ticker, weakening pillars nested ── */
  const attnByTicker = new Map<string, Pillar[]>();
  for (const { ticker, pillar } of attention) {
    const arr = attnByTicker.get(ticker) ?? [];
    arr.push(pillar);
    attnByTicker.set(ticker, arr);
  }
  const attnGroups = [...attnByTicker.entries()].map(([ticker, pillars]) => {
    const worstS: 'weakening' | 'broken' = pillars.some((p) => effectiveStatus(p) === 'broken') ? 'broken' : 'weakening';
    const dates = pillars.map((p) => movedOnByPillar.get(p.id)).filter((d): d is string => !!d).sort();
    return { ticker, pillars, worstS, since: dates.length ? dates[dates.length - 1] : null };
  });
  const topGroups = attnGroups.slice(0, 3);

  // Newest evidence across the book (latest per pillar, deduped, most-recent first)
  const evMap = new Map<string, { ticker: string; ev: Evidence }>();
  for (const t of list) {
    for (const p of t.pillars) {
      if (p.latest_evidence) evMap.set(p.latest_evidence.id, { ticker: t.ticker, ev: p.latest_evidence });
    }
  }
  const newest = [...evMap.values()]
    .sort((a, b) => (b.ev.source_published_at ?? b.ev.created_at).localeCompare(a.ev.source_published_at ?? a.ev.created_at))
    .slice(0, 3);

  const lastScanned = list.reduce<string | null>((best, t) => {
    if (!t.last_scanned_at) return best;
    return !best || t.last_scanned_at > best ? t.last_scanned_at : best;
  }, null);

  const worst: PillarStatus | null =
    counts.broken > 0 ? 'broken' : counts.weakening > 0 ? 'weakening' : counts.intact > 0 ? 'intact' : null;
  const totalConfirmed = summaries.reduce((sum, { summary }) => sum + summary.confirmedCount, 0);

  /* ── Collapsed strip ── */
  if (collapsed) {
    return (
      <aside
        className="hidden 2xl:flex flex-col items-center fixed right-0 top-0 bottom-0 w-12 z-20 py-4 gap-4 transition-all duration-200"
        style={{ borderLeft: `1px solid ${BD_BASE}`, background: BG_INSET }}
        aria-label="Conviction (collapsed)"
      >
        <button
          type="button"
          onClick={onToggle}
          className="grid place-items-center w-8 h-8 rounded text-[color:var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.04] transition-colors"
          aria-label="Expand conviction rail"
          title="Expand conviction"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
        <HelmMark size={18} />
        {worst && <Dot status={worst} size={7} />}
        {attention.length > 0 && (
          <span className="font-semibold tabular-nums" style={{ ...MONO, fontSize: 12, color: NEG }}>
            {attention.length}
          </span>
        )}
      </aside>
    );
  }

  /* ── Expanded rail ── */
  // Recent deteriorations drive the delta hero (honest 14-day window, never "since last scan").
  const movers = transitions.filter((t) => t.to === 'weakening' || t.to === 'broken');
  const moverTickers = new Set(movers.map((t) => t.ticker));
  const anyBroke = movers.some((t) => t.to === 'broken');

  return (
    <aside
      className="hidden 2xl:flex flex-col fixed right-0 top-0 bottom-0 w-[316px] z-20 transition-all duration-200"
      style={{ borderLeft: `1px solid ${BD_BASE}`, background: BG_INSET }}
      aria-label="Conviction"
    >
      {/* Header (fixed): mark + delta hero + trend row + meter */}
      <div className="shrink-0" style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${BD_SUBTLE}` }}>
        <div className="flex items-center gap-2.5 mb-3.5">
          <HelmMark size={15} />
          <span className="font-semibold uppercase" style={{ ...MONO, fontSize: 11.5, letterSpacing: '0.18em', color: INK2 }}>
            Conviction
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5" style={{ ...MONO, fontSize: 10, color: INK3 }}>
            <span className="rounded-full" style={{ width: 5, height: 5, background: POS, boxShadow: `0 0 6px ${POS}` }} />
            live
          </span>
          <button
            type="button"
            onClick={onToggle}
            className="grid place-items-center w-6 h-6 -mr-1 rounded text-[color:var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.04] transition-colors"
            aria-label="Collapse conviction rail"
            title="Collapse"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>

        {theses === null && !errored ? (
          <div className="h-1.5 w-full rounded-full bg-white/[0.05] animate-pulse" style={{ marginTop: 8 }} />
        ) : errored ? (
          <p style={{ ...MONO, fontSize: 11, color: INK4 }}>Unavailable.</p>
        ) : total > 0 ? (
          <>
            {/* Delta hero — the lead. What changed against you, recently. */}
            {movers.length > 0 ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.25, marginBottom: 6 }}>
                  <span style={{ color: anyBroke ? NEG : GOLD }}>
                    {movers.length} pillar{movers.length === 1 ? '' : 's'} {anyBroke ? 'broke' : 'weakened'}
                  </span>
                  <span style={{ color: INK2 }}> recently</span>
                </div>
                <div style={{ fontSize: 12, color: INK3, marginBottom: 14 }}>
                  {moverTickers.size === 1
                    ? `All on ${[...moverTickers][0]}. Everything else held.`
                    : `Across ${moverTickers.size} positions in the last 14 days.`}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.25, marginBottom: 6, color: INK }}>
                  Nothing moved against you.
                </div>
                <div style={{ fontSize: 12, color: INK3, marginBottom: 14 }}>
                  {counts.intact} of {total} intact, holding.
                </div>
              </>
            )}

            {/* Trend row — mono intact ratio beside the 14-day sparkline */}
            <div className="flex items-end justify-between" style={{ gap: 12 }}>
              <div>
                <div style={{ ...MONO, fontSize: 24, fontWeight: 700, lineHeight: 1, color: INK }}>
                  {counts.intact}
                  <span style={{ fontSize: 13, color: INK3, fontWeight: 500 }}>/{total}</span>
                </div>
                <div style={{ ...MONO, fontSize: 9.5, color: INK3, marginTop: 4, letterSpacing: '0.06em' }}>INTACT · 14D</div>
              </div>
              {trendValues.length >= 2 && (
                <div style={{ width: 140, flexShrink: 0 }}>
                  <Trendline data={trendValues} w={140} h={34} />
                </div>
              )}
            </div>
            {trendCaption && (
              <div style={{ ...MONO, fontSize: 10.5, color: INK3, marginTop: 9 }}>{trendCaption} · last 14 days</div>
            )}

            {/* Meter + legend */}
            <div style={{ marginTop: 14 }}>
              <Meter counts={counts} total={total} />
              <div className="flex flex-wrap" style={{ gap: 14, marginTop: 11, ...MONO, fontSize: 11.5 }}>
                {(['intact', 'weakening', 'broken', 'unverified'] as PillarStatus[])
                  .filter((s) => counts[s] > 0)
                  .map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5" style={{ color: STATUS_COLOR[s] }}>
                      <Dot status={s} size={5} />
                      {counts[s]} {STATUS_LABEL[s]}
                    </span>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, lineHeight: 1.5, color: INK2, margin: 0 }}>
            No theses tracked yet.{' '}
            <Link href="/dashboard/theses" className="font-semibold transition-colors" style={{ color: GOLD }}>
              Set one up
            </Link>
          </p>
        )}
      </div>

      {/* Scrollable middle: what moved + attention + evidence */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {/* What moved · 14d — real status transitions (from → to), weakest first */}
        {transitions.length > 0 && (
          <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${BD_SUBTLE}` }}>
            <Eyebrow color={GOLD}>What moved · 14d</Eyebrow>
            <div style={{ marginTop: 11 }}>
              {transitions.slice(0, 5).map((t, i) => (
                <div
                  key={t.pillarId}
                  className="flex gap-2.5"
                  style={{ padding: '10px 0', borderTop: i ? `1px solid ${BD_SUBTLE}` : 'none' }}
                >
                  <div className="flex items-center gap-1 shrink-0" style={{ paddingTop: 1 }}>
                    <Dot status={t.from} size={5} />
                    <span style={{ color: INK4, fontSize: 10 }}>{'→'}</span>
                    <Dot status={t.to} size={5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                      <span className="font-bold uppercase" style={{ ...MONO, fontSize: 11, color: GOLD_HI }}>{t.ticker}</span>
                      <span style={{ ...MONO, fontSize: 10, color: STATUS_COLOR[t.to] }}>now {STATUS_LABEL[t.to]}</span>
                      {t.movedOn && (
                        <span className="ml-auto" style={{ ...MONO, fontSize: 10, color: INK4 }}>{fmtDate(t.movedOn)}</span>
                      )}
                    </div>
                    <div className="line-clamp-2" style={{ fontSize: 12.5, lineHeight: 1.42, color: INK2 }}>{t.claim}</div>
                  </div>
                </div>
              ))}
              {transitions.length > 5 && (
                <Link href="/dashboard/theses" className="inline-block transition-colors" style={{ ...MONO, fontSize: 10.5, color: INK3, marginTop: 4 }}>
                  +{transitions.length - 5} more
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Moved / attention — grouped by position, with the honest "since" date */}
        {topGroups.length > 0 ? (
          <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${BD_SUBTLE}` }}>
            <Eyebrow color={NEG}>Needs attention · {attnGroups.length} position{attnGroups.length === 1 ? '' : 's'}</Eyebrow>
            <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topGroups.map((g) => (
                <Link
                  key={g.ticker}
                  href={`/dashboard/holdings/${g.ticker}`}
                  className="block group rounded-[4px] overflow-hidden"
                  style={{ border: `1px solid ${ACCENT_BD[g.worstS]}`, background: ACCENT_BG[g.worstS] }}
                >
                  <div className="flex items-center gap-2" style={{ padding: '8px 12px', borderBottom: `1px solid ${BD_SUBTLE}` }}>
                    <span className="font-bold uppercase" style={{ ...MONO, fontSize: 12, color: GOLD_HI }}>{g.ticker}</span>
                    <span style={{ ...MONO, fontSize: 10, color: STATUS_COLOR[g.worstS] }}>
                      {g.pillars.length} {STATUS_LABEL[g.worstS]}
                    </span>
                    {g.since && (
                      <span className="ml-auto" style={{ ...MONO, fontSize: 10, color: INK4 }}>since {fmtDate(g.since)}</span>
                    )}
                  </div>
                  {g.pillars.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-start gap-2.5"
                      style={{ padding: '8px 12px', borderTop: i ? `1px solid ${BD_SUBTLE}` : 'none' }}
                    >
                      <span style={{ marginTop: 4 }}><Dot status={effectiveStatus(p)} size={5} /></span>
                      <div className="line-clamp-2" style={{ fontSize: 12.5, lineHeight: 1.4, color: INK }}>{p.claim}</div>
                    </div>
                  ))}
                </Link>
              ))}
              {attnGroups.length > topGroups.length && (
                <Link href="/dashboard/theses" className="inline-block transition-colors" style={{ ...MONO, fontSize: 10.5, color: INK3, marginTop: 2 }}>
                  +{attnGroups.length - topGroups.length} more
                </Link>
              )}
            </div>
          </div>
        ) : totalConfirmed > 0 ? (
          <div className="flex items-start gap-2.5" style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${BD_SUBTLE}` }}>
            <span style={{ marginTop: 5 }}><Dot status="intact" size={6} /></span>
            <p style={{ fontSize: 12.5, lineHeight: 1.45, color: INK2, margin: 0 }}>
              All {counts.intact} pillar{counts.intact === 1 ? '' : 's'} intact. Nothing threatens your theses right now.
            </p>
          </div>
        ) : null}

        {/* Newest evidence */}
        {newest.length > 0 && (
          <div style={{ padding: '16px 20px 8px' }}>
            <Eyebrow>Newest evidence</Eyebrow>
            <div style={{ marginTop: 6 }}>
              {newest.map(({ ticker, ev }, i) => {
                const inner = (
                  <>
                    <Glyph verdict={ev.verdict} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2" style={{ marginBottom: 5 }}>
                        <span className="font-semibold uppercase" style={{ ...MONO, fontSize: 11.5, color: GOLD_HI }}>{ticker}</span>
                        <span className="uppercase" style={{ ...MONO, fontSize: 9, letterSpacing: '0.08em', color: (VERDICT_META[ev.verdict] ?? VERDICT_META.neutral).color }}>
                          {(VERDICT_META[ev.verdict] ?? VERDICT_META.neutral).label}
                        </span>
                        {(ev.source_published_at || ev.created_at) && (
                          <span className="ml-auto" style={{ ...MONO, fontSize: 10.5, color: INK4 }}>
                            {fmtDate(ev.source_published_at ?? ev.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="line-clamp-2" style={{ fontSize: 13, lineHeight: 1.45, color: INK, marginBottom: 5 }}>
                        {ev.source_title}
                      </div>
                    </div>
                  </>
                );
                return ev.source_url ? (
                  <a
                    key={ev.id}
                    href={ev.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2.5 group"
                    style={{ padding: '12px 0', borderTop: i ? `1px solid ${BD_SUBTLE}` : 'none' }}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={ev.id} className="flex gap-2.5" style={{ padding: '12px 0', borderTop: i ? `1px solid ${BD_SUBTLE}` : 'none' }}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center gap-2.5" style={{ padding: '13px 20px', borderTop: `1px solid ${BD_SUBTLE}` }}>
        {lastScanned && (
          <>
            <span className="rounded-full" style={{ width: 5, height: 5, background: POS }} />
            <span style={{ ...MONO, fontSize: 11, color: INK3 }}>Last scan {fmtScan(lastScanned)}</span>
          </>
        )}
        <Link href="/dashboard/theses" className="ml-auto transition-colors" style={{ ...MONO, fontSize: 11, color: GOLD }}>
          Open Theses {'→'}
        </Link>
      </div>
    </aside>
  );
}
