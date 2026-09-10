/**
 * Ghost furniture for the dashboard's route-level loading.tsx files.
 *
 * The App Router paints a segment's loading.tsx the moment a link is clicked,
 * which is the difference between a click that feels instant and the three
 * seconds of blank screen /dashboard/theses used to show. Each route shapes its
 * own first screen; only the shapes several routes share live here.
 *
 * Same two rules as components/ghost.tsx: a ghost means LOADING, never EMPTY,
 * and it shows structure, not values. No placeholder numbers, no spinners.
 */

export function GhostBlock({ className = '', dim = false }: { className?: string; dim?: boolean }) {
  return <div aria-hidden className={`rounded ${dim ? 'bg-white/[0.04]' : 'bg-white/[0.06]'} ${className}`} />;
}

/** Carries the pulse and announces the wait once, politely. */
export function GhostShell({ className = '', label, children }: {
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`animate-pulse ${className}`} role="status" aria-live="polite" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * The .helm-detail-heading block: kicker, title, subtitle, optional right-hand
 * action. The class carries the flex layout and its 32px bottom padding, so the
 * geometry matches the real heading by construction.
 */
export function GhostDetailHeading({ action = false, title = 'h-9 w-64', subtitle = 'w-[420px]' }: {
  action?: boolean;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="helm-detail-heading">
      <div className="min-w-0">
        <GhostBlock className="h-2.5 w-24" />
        <GhostBlock className={`${title} mt-[15px] mb-3`} />
        <GhostBlock dim className={`h-3.5 max-w-full ${subtitle}`} />
      </div>
      {action ? <GhostBlock className="h-8 w-24 shrink-0" /> : null}
    </div>
  );
}

/** A row of metric tiles in the house card chrome. */
export function GhostTiles({ count, className, sub = true }: { count: number; className: string; sub?: boolean }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-4 pt-4 pb-[15px]"
        >
          <GhostBlock dim className="h-2.5 w-14 mb-[11px]" />
          <GhostBlock className="h-6 w-20" />
          {sub ? <GhostBlock dim className="h-3 w-12 mt-[9px]" /> : null}
        </div>
      ))}
    </div>
  );
}

/** A stack of list cards: a title line, then two body lines. */
export function GhostCards({ count, className = 'space-y-3.5', padding = 'px-5 py-[18px]' }: {
  count: number;
  className?: string;
  padding?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] ${padding}`}
        >
          <div className="flex items-center justify-between gap-4 mb-3.5">
            <GhostBlock className="h-4 w-48" />
            <GhostBlock dim className="h-3 w-16 shrink-0" />
          </div>
          <GhostBlock dim className="h-3.5 w-full mb-2" />
          <GhostBlock dim className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** A bordered table card: a head row, then body rows on subtle rules. */
export function GhostTableCard({ cols, rows, className = '' }: { cols: number; rows: number; className?: string }) {
  const grid = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  return (
    <div
      className={`rounded-lg overflow-hidden border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] ${className}`}
    >
      <div className="grid gap-5 px-5 py-3.5 border-b border-[var(--color-border-base)]" style={grid}>
        {Array.from({ length: cols }, (_, i) => <GhostBlock key={i} dim className="h-2.5 w-16" />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-5 px-5 py-[14px] border-b border-[var(--color-border-subtle)] last:border-b-0"
          style={grid}
        >
          {Array.from({ length: cols }, (_, c) => (
            <GhostBlock key={c} dim={c > 0} className={c === 0 ? 'h-3.5 w-20' : 'h-3.5 w-14'} />
          ))}
        </div>
      ))}
    </div>
  );
}
