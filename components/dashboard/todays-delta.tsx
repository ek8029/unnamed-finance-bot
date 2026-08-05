'use client';

// The delta line: what changed on their book since they last looked.
//
// Placed on /dashboard because that is the one page every retained user opens.
// The intelligence to write this already existed; it was sitting on surfaces
// with zero real-user pageviews. Instrumented so the question "does a finding
// in their path get touched?" becomes answerable instead of arguable.

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import posthog from 'posthog-js';
import type { DashboardDelta } from '@/app/api/dashboard/delta/route';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

export function TodaysDelta({ isDemo = false }: { isDemo?: boolean }) {
  const [data, setData] = useState<DashboardDelta | null>(null);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    fetch('/api/dashboard/delta')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || d.error) return;
        setData(d as DashboardDelta);
        posthog.capture('dashboard_delta_shown', {
          has_mover: Boolean((d as DashboardDelta).mover),
          has_headline: Boolean((d as DashboardDelta).headline),
          ticker: (d as DashboardDelta).mover?.ticker ?? null,
          session_date: (d as DashboardDelta).sessionDate,
          is_today: (d as DashboardDelta).isToday,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isDemo]);

  if (!data || data.positionsChecked === 0) return null;

  const fmt = (n: number) =>
    `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

  // Never say "Today" for a session that isn't today. Markets close, weekends
  // happen, and a stale label on a fresh-looking number is worse than no line
  // at all — it is the same class of error as the tax figures we just spent a
  // day removing.
  const label = (() => {
    if (data.isToday) return 'Today';
    if (!data.sessionDate) return 'Latest session';
    const d = new Date(data.sessionDate + 'T12:00:00Z');
    const todayET = new Date(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()) + 'T12:00:00Z',
    );
    const daysAgo = Math.round((todayET.getTime() - d.getTime()) / 86_400_000);
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo > 1 && daysAgo < 7) {
      return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  })();

  // Nothing moved: that IS the answer, and saying it plainly is the whole point
  // of putting this here. A user who checks daily wants "you're fine" as much
  // as they want news.
  if (!data.mover) {
    return (
      <div
        className="rounded-lg border border-[var(--color-border-subtle)] px-4 py-3 sm:px-5"
        style={{ background: 'var(--color-bg-surface)' }}
      >
        <p className="text-[13px] text-[var(--color-text-secondary)]" style={MONO}>
          <span className="text-[var(--color-text-muted)]">{label} · </span>
          Nothing on your book moved more than 2%
          {data.nextLargestPct != null && Math.abs(data.nextLargestPct) >= 0.1
            ? ` (largest ${data.nextLargestPct >= 0 ? '+' : ''}${data.nextLargestPct.toFixed(1)}%)`
            : ''}
          .
        </p>
      </div>
    );
  }

  const m = data.mover;
  const up = m.changePct >= 0;
  const tone = up ? 'var(--color-positive)' : 'var(--color-negative)';

  return (
    <div
      className="rounded-lg px-4 py-3 sm:px-5"
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderLeft: `3px solid ${tone}`,
      }}
    >
      <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]" style={MONO}>
        <span className="text-[var(--color-text-muted)]">{label} · </span>
        <span className="font-bold text-[var(--color-text-primary)]">{m.ticker}</span>{' '}
        <span style={{ color: tone }} className="font-semibold tabular-nums">
          {up ? '+' : ''}{m.changePct.toFixed(2)}%
        </span>
        {', '}
        <span style={{ color: tone }} className="tabular-nums">
          {up ? '+' : '−'}{fmt(m.dollarImpact)}
        </span>{' '}
        on your position.
        {data.otherMovers === 0 && (
          <span className="text-[var(--color-text-muted)]">
            {' '}Nothing else on your book moved more than 2%.
          </span>
        )}
        {!data.isToday && (
          <span className="text-[var(--color-text-muted)]">
            {' '}Markets have not moved this position since.
          </span>
        )}
        {data.otherMovers > 0 && (
          <span className="text-[var(--color-text-muted)]">
            {' '}{data.otherMovers} other position{data.otherMovers === 1 ? '' : 's'} also moved more than 2%.
          </span>
        )}
      </p>

      {data.headline && (
        <a
          href={data.headline.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            posthog.capture('dashboard_finding_clicked', {
              ticker: m.ticker,
              change_pct: m.changePct,
              source: data.headline?.source,
            })
          }
          className="group mt-2 inline-flex items-start gap-1.5 text-[12px] leading-snug text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors"
          style={MONO}
        >
          <span className="underline decoration-dotted underline-offset-2">
            {data.headline.source} reports: &ldquo;{data.headline.title}&rdquo;
          </span>
          <ArrowUpRight className="w-3 h-3 shrink-0 mt-[2px] opacity-60 group-hover:opacity-100" />
        </a>
      )}
    </div>
  );
}
