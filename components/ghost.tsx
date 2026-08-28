/**
 * Ghost shells for sections that arrive after their surrounding page.
 *
 * The overview's primary fetch resolves and the page-level skeleton clears,
 * but several panels are fed by their own hooks and land seconds later. Until
 * now those panels returned null while loading, so the screen settled and then
 * grew: conviction, the agent's first look and the thesis strip each popped in
 * and pushed the content below them down.
 *
 * A ghost occupies the same box the real panel will, so the layout is decided
 * once. Two rules:
 *
 *   1. A ghost means LOADING, never EMPTY. A panel with nothing to show still
 *      returns null or its own empty state. Rendering a shell forever where a
 *      user genuinely has no theses would promise something that is not coming.
 *   2. The shell shows structure, not values. No placeholder numbers, no
 *      lorem tickers. It is furniture, and it is aria-hidden with the live
 *      region carrying the status instead.
 */

export function GhostBar({ w = '100%', h = 12, className = '' }: { w?: number | string; h?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`block rounded-[3px] bg-[var(--color-text-primary)] opacity-[0.07] ${className}`}
      style={{ width: w, height: h }}
    />
  );
}

/** Wrapper that carries the pulse and announces the wait once, politely. */
export function Ghost({ label, className = '', children }: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`animate-pulse ${className}`} role="status" aria-live="polite" aria-label={label}>
      {children}
    </div>
  );
}

/** Matches ThesisConvictionKpi's card: same chrome, same padding, same rows. */
export function GhostConviction() {
  return (
    <Ghost label="Loading thesis conviction">
      <div className="sovereign-card rounded border overflow-hidden p-3 md:p-5">
        <div className="flex items-center justify-between mb-1.5 md:mb-2">
          <GhostBar w={124} h={11} />
          <GhostBar w={58} h={11} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-1">
          <GhostBar w={92} h={18} />
          <GhostBar w={92} h={18} />
          <GhostBar w={78} h={18} />
        </div>
      </div>
    </Ghost>
  );
}

/** Matches AgentFirstLook's gold-bordered section. */
export function GhostFirstLook() {
  return (
    <Ghost label="Loading the agent's first look">
      <section className="mb-3.5 rounded-lg border border-[rgba(230,185,77,0.22)] bg-[rgba(230,185,77,0.04)] px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <GhostBar w={230} h={11} />
          <GhostBar w={12} h={12} />
        </div>
        <div className="space-y-2.5">
          <GhostBar w="72%" h={15} />
          <GhostBar w="54%" h={13} />
        </div>
      </section>
    </Ghost>
  );
}

/** Matches the factor lens report: tilt card beside the read card, a driver line, then the classification table. */
export function GhostFactorLens() {
  const card = 'rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)]';
  return (
    <Ghost label="Loading factor exposure">
      <div className="space-y-3.5">
        <GhostBar w={220} h={12} />
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
          <div className={`${card} p-5 sm:p-6`}>
            <GhostBar w={180} h={10} className="mb-5" />
            <div className="flex flex-col gap-[18px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <GhostBar w={88} h={11} />
                  <GhostBar w="100%" h={8} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3.5">
            <div className="rounded-lg border border-[rgba(230,185,77,0.18)] bg-[rgba(230,185,77,0.025)] p-5">
              <GhostBar w={44} h={10} className="mb-3" />
              <div className="space-y-2.5">
                <GhostBar w="92%" h={13} />
                <GhostBar w="70%" h={13} />
              </div>
            </div>
            <div className={`${card} p-5`}>
              <GhostBar w={72} h={10} className="mb-4" />
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <GhostBar key={i} w="100%" h={30} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={`${card} p-5`}>
          <GhostBar w={150} h={10} className="mb-2.5" />
          <GhostBar w="60%" h={14} />
        </div>
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-[var(--color-border-base)]">
            <GhostBar w={170} h={10} />
          </div>
          <div className="px-5">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="grid grid-cols-6 gap-5 py-3.5 border-t border-[var(--color-border-subtle)]">
                {[0, 1, 2, 3, 4, 5].map((j) => (
                  <GhostBar key={j} w={j === 0 ? 48 : '70%'} h={12} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Ghost>
  );
}
