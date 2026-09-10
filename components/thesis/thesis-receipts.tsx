// The receipts inside one theses-table row: pillar claims, kill criteria,
// mechanism stories and the evidence under each.
//
// Split out of components/thesis/theses-table-view so the same markup renders
// from two places without a second copy of it: the capture fixtures render it
// inline from their own data, and the app renders it from the JSON
// /api/thesis/board?ticker= returns when a row is opened. Pure presentation and
// no data fetching, so it is safe in a server or a client tree; the derivation
// it renders lives in lib/content/thesis-board.

import { STATUS_TONE, isFresh, type MechanismReceipts, type PillarReceipts } from '@/lib/content/thesis-board';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

/** One mechanism as one line: the story, how corroborated, receipts a click away. */
function StoryLine({ m }: { m: MechanismReceipts }) {
  const adverse = m.maxStatus !== 'watch';
  const tone = STATUS_TONE[m.maxStatus];
  const fresh = m.lastSeen && isFresh(m.lastSeen);
  const corroboration =
    m.sourceClasses.length >= 2 ? `${m.sourceClasses.length} independent source types` : 'single source';

  return (
    <details className="group/story">
      <summary className="list-none cursor-pointer flex items-baseline gap-2 py-1 hover:bg-white/[0.02] rounded px-1 -mx-1">
        <span className="mt-[1px] w-1 h-1 rounded-full shrink-0" style={{ background: adverse ? tone : '#3F3F3F' }} />
        <span className={`text-[13.5px] leading-[1.45] min-w-0 truncate ${adverse ? 'text-[#C8C8C8]' : 'text-[var(--color-text-secondary)]'}`}>
          {m.label}
        </span>
        {fresh && (
          <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.14em] px-1 py-[1px] rounded bg-[rgba(230,185,77,0.15)] text-[#E6B94D]" style={MONO}>
            new
          </span>
        )}
        <span className="ml-auto shrink-0 text-[11.5px] text-[var(--color-text-secondary)]" style={MONO}>
          {m.mentions} {m.mentions === 1 ? 'report' : 'reports'} · {corroboration}
        </span>
      </summary>
      <div className="ml-3 pb-1.5 space-y-1">
        {m.items.map((c) => (
          <div key={c.id} className="text-[12.5px] leading-[1.5] text-[var(--color-text-secondary)]">
            <span style={MONO} className="text-[11px] text-[var(--color-text-secondary)]">{c.dateISO} · </span>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#E6B94D] transition-colors">
                {c.title}
              </a>
            ) : (
              c.title
            )}
            {c.excerpt && (
              <span className="block text-[12px] text-[var(--color-text-secondary)] italic mt-0.5">&ldquo;{c.excerpt.slice(0, 160)}&rdquo;</span>
            )}
          </div>
        ))}
        {m.itemsTotal > m.items.length && (
          <div className="text-[11.5px] text-[var(--color-text-secondary)]" style={MONO}>+{m.itemsTotal - m.items.length} more reports</div>
        )}
      </div>
    </details>
  );
}

export function PillarLine({ p }: { p: PillarReceipts }) {
  return (
    <div className="py-2.5 border-t border-white/[0.04] first:border-t-0">
      <div className="flex items-baseline gap-2.5">
        <span className="mt-[1px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_TONE[p.status] }} />
        <span className="text-[14.5px] leading-[1.45] text-[var(--color-text-primary)] min-w-0">{p.claim}</span>
      </div>
      <div className="ml-4 mt-0.5 text-[12.5px] text-[var(--color-text-secondary)]">{p.line}</div>
      {p.breaksIf && (
        <div className="ml-4 mt-1 text-[12.5px] leading-[1.5] text-[var(--color-text-secondary)]">
          <span className="text-[#E6B94D] uppercase tracking-[0.08em] text-[10.5px] font-semibold" style={MONO}>
            Breaks if{' '}
          </span>
          {p.breaksIf}
        </div>
      )}

      {p.mechanisms.length > 0 && (
        <div className="ml-4 mt-1.5">
          {p.mechanisms.map((m, i) => (
            <StoryLine key={`${m.label}-${i}`} m={m} />
          ))}
          {p.singles > 0 && (
            <div className="text-[11.5px] text-[var(--color-text-secondary)] py-1" style={MONO}>
              +{p.singles} single mentions nothing has confirmed
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The row body before its receipts have landed: one line per pillar, at the
 *  height a pillar line occupies, reading as unknown the same way the Earnings
 *  column does until its dates arrive. Never a spinner. */
export function PillarLinesPending({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="py-2.5 border-t border-white/[0.04] first:border-t-0">
          <div className="flex items-baseline gap-2.5">
            <span className="mt-[1px] w-1.5 h-1.5 rounded-full shrink-0 bg-[#3F3F3F]" />
            <span className="text-[14.5px] leading-[1.45] text-[var(--color-text-secondary)] min-w-0" style={MONO}>&mdash;</span>
          </div>
          <div className="ml-4 mt-0.5 text-[12.5px] text-[var(--color-text-secondary)]" style={MONO}>&mdash;</div>
        </div>
      ))}
    </>
  );
}
