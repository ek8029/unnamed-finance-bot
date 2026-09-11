// Display decisions for the overview's agent log card, kept out of the
// component so the ordering and the copy can be pinned by a test. The card
// replaced the old "Helm Brief" panel, which showed the actions inbox rather
// than the brief; the log is the one thing on the page that evidences work.

import type { WorklogStep } from '@/lib/agent/worklog';

/** Lines the card shows. Five fits the card's height beside the chart without
 *  scrolling at 1024px, which is the narrowest width the two-column row uses. */
export const AGENT_LOG_LINES = 5;

export const AGENT_LOG_COPY = {
  eyebrow: 'Updates',
  demoEyebrow: 'Updates',
  empty: 'Nothing recorded in the last 72 hours. Helm runs each weekday morning.',
  unavailable: 'The work log is unavailable right now.',
  demo: 'On a connected book this lists the real work: accounts synced, positions repriced, filings and news read, scans run, your brief written.',
  brief: 'Read full brief',
  unlock: 'Unlock the agent',
  unlockWhy: 'Thesis investigations and the hourly read are Pro.',
  /** Rendered as "3 new since your last visit". */
  newSuffix: 'new since your last visit',
  nothingNew: 'Nothing new since your last visit. These are the most recent lines.',
} as const;

/** Newest first, one line per id, capped. The builder already returns real
 *  timestamped rows; this only decides which of them fit. */
export function topSteps(steps: readonly WorklogStep[], n: number = AGENT_LOG_LINES): WorklogStep[] {
  const seen = new Set<string>();
  const unique: WorklogStep[] = [];
  for (const s of steps) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    unique.push(s);
  }
  return unique
    .slice()
    .sort((a, b) => {
      const at = a.ts ? Date.parse(a.ts) : 0;
      const bt = b.ts ? Date.parse(b.ts) : 0;
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    })
    .slice(0, Math.max(0, n));
}

/** Steps whose id says only that a job ran, naming no filing, no story and no
 *  finding. Exact ids, from the four pushes in lib/agent/worklog.ts that use a
 *  fixed id. The specific lines all carry a suffix (`filing-`, `news-`,
 *  `severe-`, `flag-`, `inv-`), but the dash is NOT the discriminator:
 *  `read-filings` and `read-news` carry one too. This set is. */
const GENERIC_STEP_IDS = new Set(['sync', 'read-filings', 'read-news', 'scan']);

/** Drop the generic lines that add nothing over the specific lines beside them.
 *
 *  The builder records everything it does, and it should: the record is the
 *  honest one. But news-watch runs every five minutes and the judge queue every
 *  minute, so there is always something recent to say, and "Ran the risk scans
 *  across your book" at 12:03 AM is a true line and an empty one. A line earns a
 *  slot when it carries a subject.
 *
 *  `scan` never earns one: it found nothing, or it found things and those are
 *  the flag lines. `read-filings` and `read-news` are counts, redundant once the
 *  filings and stories themselves are listed. `sync` is real but it is not a
 *  finding, so it never displaces a specific line.
 *
 *  The one thing `sync` beats is nothing at all, so it survives when no other
 *  line does. Input order is preserved. */
export function withNovelty(steps: readonly WorklogStep[]): WorklogStep[] {
  const hasFiling = steps.some((s) => s.id.startsWith('filing-'));
  const hasNews = steps.some((s) => s.id.startsWith('news-'));
  const earns = (s: WorklogStep) => {
    if (s.emphasis) return true; // contradictions and flagged findings, always
    if (!GENERIC_STEP_IDS.has(s.id)) return true;
    if (s.id === 'read-filings') return !hasFiling;
    if (s.id === 'read-news') return !hasNews;
    return false; // `scan` and `sync`
  };
  const kept = steps.filter(earns);
  if (kept.length > 0) return kept;
  const sync = steps.find((s) => s.id === 'sync');
  return sync ? [sync] : [];
}

export interface UpdatesView {
  /** What the card renders, newest first. */
  lines: WorklogStep[];
  /** How many lines arrived after the watermark, which can exceed what fits.
   *  Zero means the card is showing the fallback, not new work. */
  newCount: number;
  /** One quiet line above the list. Empty when there is no watermark to
   *  compare against, so the card reads as it did before this existed. */
  note: string;
}

/** Split the log against this person's watermark.
 *
 *  With new lines the card shows only those, because the overview is the page
 *  people land on and mixing new work into older lines without a boundary
 *  would blur the two. With nothing new it falls back to the most recent lines
 *  rather than leaving the best slot on the page empty, and says so. No
 *  watermark, or one that will not parse, is the old behaviour exactly.
 *
 *  Both paths run through withNovelty, and each judges redundancy against its
 *  own candidates: a new aggregate count is dropped only when a specific line
 *  is new beside it, not because one was read yesterday and is off screen.
 *  newCount counts survivors, because the card renders it as "3 new since your
 *  last visit" and the reader must be able to find all three. A "new" set that
 *  was nothing but generic lines reads as nothing new, which is the point.
 *
 *  The recent list keeps its newest line even when the filter takes everything,
 *  because the card's empty copy says nothing was recorded and something was. */
export function updatesView(
  steps: readonly WorklogStep[],
  seenAt: string | null | undefined,
  n: number = AGENT_LOG_LINES,
): UpdatesView {
  const all = topSteps(steps, steps.length);
  const novel = withNovelty(all);
  const recent = (novel.length > 0 ? novel : all.slice(0, 1)).slice(0, Math.max(0, n));
  const at = seenAt ? Date.parse(seenAt) : NaN;
  if (Number.isNaN(at)) return { lines: recent, newCount: 0, note: '' };
  const fresh = withNovelty(
    all.filter((s) => {
      const t = s.ts ? Date.parse(s.ts) : NaN;
      return !Number.isNaN(t) && t > at;
    }),
  );
  if (fresh.length === 0) {
    return { lines: recent, newCount: 0, note: AGENT_LOG_COPY.nothingNew };
  }
  return {
    lines: fresh.slice(0, Math.max(0, n)),
    newCount: fresh.length,
    note: `${fresh.length} ${AGENT_LOG_COPY.newSuffix}`,
  };
}

/** "every 5 min" reads better than "5 min" next to a past-tense line, but
 *  "hourly", "daily" and "on event" are already adverbs. */
export function cadenceLabel(cadence: WorklogStep['cadence']): string {
  return cadence === '1 min' || cadence === '5 min' ? `every ${cadence}` : cadence;
}

/** Market time, always. lib/agent/worklog.ts has its own copy of this for the
 *  lines it builds server side; this one exists because the card is a client
 *  component and must not import that module, which reaches for Supabase. */
const ET_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
});

export function clockET(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return ET_CLOCK.format(new Date(t));
}
