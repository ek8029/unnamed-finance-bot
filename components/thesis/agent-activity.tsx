'use client';

// "What Helm did" — the agent activity feed. Surfaces the monitor's real scan work
// (live pillar_evidence rows) as a timestamped stream so the product reads as an
// analyst working for you, not a dashboard you query. Two surfaces share one fetch:
//   <AgentActivity />  — full feed (Theses page, Pro).
//   <AgentHeartbeat /> — one-line teaser (Overview / Brief, everyone).
// Grounded: every line names the real source it read. No generated narrative.
// Rows expand in place to show the exact reason (pillar claim) the source was
// tested against, the verdict, and a link into the full thesis.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ActivityEvent, ActivityResponse } from '@/app/api/thesis/activity/route';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const GOLD = '#E6B94D';
const GREEN = '#4ADE80';
const RED = '#F87171';
const MUTE = '#7A7A7A';

function eventColor(e: ActivityEvent): string {
  if (e.broke || e.flagged) return RED;
  if (e.verdict === 'contradicts') return GOLD;
  if (e.verdict === 'supports') return GREEN;
  return MUTE;
}

// First-person-implied agent voice. Verb leads; ticker prominent; verdict as outcome.
// "broke" mirrors the breach email word-for-word so push and feed read as one system.
function eventLine(e: ActivityEvent): string {
  const src = e.source ?? `a new ${e.sourceType}`;
  if (e.broke) return `${src} broke one of your reasons for holding ${e.ticker}`;
  if (e.flagged) return `${src} challenges your ${e.ticker} thesis`;
  if (e.verdict === 'contradicts') return `${src} adds caution to your ${e.ticker} thesis`;
  if (e.verdict === 'supports' && e.materiality === 'material') return `${src} reinforces your ${e.ticker} thesis`;
  return `Re-read ${src} against ${e.ticker}`;
}

function eventOutcome(e: ActivityEvent): { text: string; color: string } {
  if (e.broke) return { text: 'broken', color: RED };
  if (e.flagged) return { text: 'flagged', color: GOLD };
  if (e.verdict === 'contradicts') return { text: 'watching', color: GOLD };
  return { text: 'holds', color: GREEN };
}

// Status of the pillar this source was tested against — shown as a chip in the expand.
function statusChip(status: ActivityEvent['pillarStatus']): { text: string; color: string } {
  if (status === 'broken') return { text: 'pillar broken', color: RED };
  if (status === 'weakening') return { text: 'pillar weakening', color: GOLD };
  if (status === 'intact') return { text: 'pillar intact', color: GREEN };
  return { text: 'unverified', color: MUTE };
}

function verdictChip(e: ActivityEvent): { text: string; color: string } {
  if (e.verdict === 'contradicts') return { text: e.materiality === 'material' ? 'contradicts · material' : 'contradicts', color: GOLD };
  if (e.verdict === 'supports') return { text: e.materiality === 'material' ? 'supports · material' : 'supports', color: GREEN };
  return { text: 'neutral', color: MUTE };
}

function sourceKindLabel(t: string): string {
  const m: Record<string, string> = { filing: 'SEC filing', form4: 'insider Form 4', xbrl: 'XBRL financials', news: 'news', price_move: 'price move' };
  return m[t] ?? t;
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
      style={{ ...MONO, color, background: `${color}12`, border: `1px solid ${color}30` }}
    >
      <span className="inline-block h-1 w-1 rounded-full" style={{ background: color }} />
      {text}
    </span>
  );
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function useActivity() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    fetch('/api/thesis/activity')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ActivityResponse | null) => {
        if (mounted.current && d) setData(d);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, []);
  return data;
}

/**
 * Full feed — Theses page.
 * locked=true renders a faded 2-event preview with a Pro unlock gate,
 * proving the agent is working instead of showing a blank upgrade card.
 */
export function AgentActivity({ locked = false }: { locked?: boolean }) {
  const data = useActivity();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!data) return null;
  const { heartbeat } = data;
  // Locked preview shows only the top 2 events behind a fade.
  const events = locked ? data.events.slice(0, 2) : data.events;

  // Nothing to tease: don't show an empty locked shell.
  if (locked && events.length === 0) return null;

  return (
    <section className="relative rounded-lg border border-white/[0.07] bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/[0.05]">
        <span className="text-[13px]" style={{ color: GOLD }}>✦</span>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>
          What Helm did
        </span>
        <span className="ml-auto inline-flex items-center gap-2 font-mono text-[11px] text-[#6A6A6A]" style={MONO}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: GREEN, boxShadow: `0 0 7px ${GREEN}` }} />
          watching {heartbeat.count} {heartbeat.count === 1 ? 'thesis' : 'theses'}
          {heartbeat.lastScan && <span className="text-[#4A4A4A]">· last scan {fmtWhen(heartbeat.lastScan)}</span>}
        </span>
      </div>

      {!locked && events.length === 0 ? (
        <p className="px-5 py-5 text-[14px] leading-[1.5] text-[#7A7A7A] m-0">
          No live scans yet. Helm re-checks every pillar against fresh filings and news each morning.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {events.map((e) => {
            const color = eventColor(e);
            const outcome = eventOutcome(e);
            const line = eventLine(e);
            const open = !locked && openId === e.id;
            return (
              <li key={e.id} className="border-b border-white/[0.04] last:border-0">
                {/* Row toggles an inline detail panel — no navigation until you choose to. */}
                <button
                  type="button"
                  onClick={() => !locked && setOpenId(open ? null : e.id)}
                  aria-expanded={open}
                  className={`flex w-full items-start gap-3 px-5 py-3 text-left transition-colors ${locked ? 'cursor-default' : 'hover:bg-white/[0.015]'}`}
                >
                  <span className="mt-[6px] inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10.5px] tabular-nums text-[#6A6A6A] shrink-0" style={MONO}>{fmtWhen(e.ts)}</span>
                      <span className="text-[13.5px] leading-[1.45] text-[#D4D4D4] min-w-0">{line}</span>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ ...MONO, color: outcome.color }}>
                    {outcome.text}
                  </span>
                  {!locked && (
                    <svg
                      width="12" height="12" viewBox="0 0 12 12"
                      className="mt-[5px] shrink-0 text-[#5A5A5A]"
                      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
                    >
                      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                {open && (
                  <div className="px-5 pb-4">
                    <div className="ml-[18px] space-y-3 rounded-md border border-white/[0.07] bg-black/25 px-4 py-3.5">
                      <div className="space-y-1.5">
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6A6A6A]" style={MONO}>
                          Tested against your reason
                        </div>
                        <p className="m-0 text-[13.5px] leading-[1.55] text-[#C8C8C8]">&ldquo;{e.claim}&rdquo;</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip {...statusChip(e.pillarStatus)} />
                        <Chip {...verdictChip(e)} />
                      </div>
                      {e.source && (
                        <div className="font-mono text-[11px] leading-[1.5] text-[#6A6A6A]" style={MONO}>
                          {sourceKindLabel(e.sourceType)}:{' '}
                          {e.url ? (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[#9A9A9A] underline decoration-white/20 underline-offset-2 hover:text-[var(--color-gold)]" onClick={(ev) => ev.stopPropagation()}>
                              {e.source} ↗
                            </a>
                          ) : (
                            <span className="text-[#9A9A9A]">{e.source}</span>
                          )}
                        </div>
                      )}
                      <Link
                        href={`/dashboard/theses/${e.thesisId}`}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-gold)] no-underline hover:opacity-80"
                        style={MONO}
                      >
                        Open {e.ticker} thesis <span className="text-[12px]">&rarr;</span>
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {locked && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-[54px] h-16 bg-gradient-to-t from-[var(--color-bg-surface)] to-transparent" />
          <Link
            href="/pricing"
            className="relative flex items-center justify-center gap-2 border-t border-white/[0.06] px-5 py-3.5 no-underline transition-colors hover:bg-[rgba(230,185,77,0.05)]"
          >
            <span className="text-[12px]" style={{ color: GOLD }}>✦</span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)]" style={MONO}>
              Unlock the full agent log
            </span>
            <span className="font-mono text-[11px] text-[#6A6A6A]" style={MONO}>· Pro</span>
            <span className="ml-1 text-[12px] text-[#6A6A6A]">&rarr;</span>
          </Link>
        </>
      )}
    </section>
  );
}

/** One-line teaser — Overview / Brief, all tiers. Renders nothing if no theses. */
export function AgentHeartbeat() {
  const data = useActivity();
  if (!data || data.heartbeat.count === 0) return null;
  const { heartbeat, events } = data;
  const latest = events[0];

  return (
    <Link
      href="/dashboard/theses"
      className="flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-[#101010] px-4 py-2.5 no-underline transition-colors hover:border-[rgba(230,185,77,0.28)]"
    >
      <span className="text-[12px] shrink-0" style={{ color: GOLD }}>✦</span>
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-gold)] shrink-0" style={MONO}>
        Helm
      </span>
      <span className="font-mono text-[11.5px] text-[#7A7A7A] shrink-0" style={MONO}>
        watching {heartbeat.count} {heartbeat.count === 1 ? 'thesis' : 'theses'}
      </span>
      {latest && (
        <span className="hidden sm:block min-w-0 flex-1 truncate text-[12.5px] text-[#9A9A9A]">
          · {eventLine(latest)} → <span style={{ color: eventOutcome(latest).color }}>{eventOutcome(latest).text}</span>
        </span>
      )}
      <span className="ml-auto shrink-0 font-mono text-[11px] text-[#6A6A6A]" style={MONO}>
        {latest ? fmtWhen(latest.ts) : ''} →
      </span>
    </Link>
  );
}
