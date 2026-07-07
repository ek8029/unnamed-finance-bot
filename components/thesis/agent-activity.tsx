'use client';

// "What Helm did" — the agent activity feed. Surfaces the monitor's real scan work
// (live pillar_evidence rows) as a timestamped stream so the product reads as an
// analyst working for you, not a dashboard you query. Two surfaces share one fetch:
//   <AgentActivity />  — full feed (Theses page, Max).
//   <AgentHeartbeat /> — one-line teaser (Overview / Brief, everyone).
// Grounded: every line names the real source it read. No generated narrative.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ActivityEvent, ActivityResponse } from '@/app/api/thesis/activity/route';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const GOLD = '#E6B94D';
const GREEN = '#4ADE80';
const RED = '#F87171';

function eventColor(e: ActivityEvent): string {
  if (e.broke || e.flagged) return RED;
  if (e.verdict === 'contradicts') return GOLD;
  if (e.verdict === 'supports') return GREEN;
  return '#7A7A7A';
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
 * locked=true renders a faded 2-event preview with a Max unlock gate (pro tier),
 * proving the agent is working instead of showing a blank upgrade card.
 */
export function AgentActivity({ locked = false }: { locked?: boolean }) {
  const data = useActivity();
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
            const body = (
              <div className="flex items-start gap-3 px-5 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.015] transition-colors">
                <span className="mt-[6px] inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10.5px] tabular-nums text-[#6A6A6A] shrink-0" style={MONO}>{fmtWhen(e.ts)}</span>
                    <span className="text-[13.5px] leading-[1.45] text-[#D4D4D4] min-w-0">{line}</span>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ ...MONO, color: outcome.color }}>
                  {outcome.text}{e.flagged || e.broke ? ' →' : ''}
                </span>
              </div>
            );
            return (
              <li key={e.id}>
                {/* Every activity row jumps to its thesis — not just broken/flagged ones. */}
                <Link href={`/dashboard/theses/${e.thesisId}`} className="block no-underline">{body}</Link>
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
            <span className="font-mono text-[11px] text-[#6A6A6A]" style={MONO}>· Max</span>
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
