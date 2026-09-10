// Display decisions for the overview's agent log card, kept out of the
// component so the ordering and the copy can be pinned by a test. The card
// replaced the old "Helm Brief" panel, which showed the actions inbox rather
// than the brief; the log is the one thing on the page that evidences work.

import type { WorklogStep } from '@/lib/agent/worklog';

/** Lines the card shows. Five fits the card's height beside the chart without
 *  scrolling at 1024px, which is the narrowest width the two-column row uses. */
export const AGENT_LOG_LINES = 5;

export const AGENT_LOG_COPY = {
  eyebrow: 'What Helm did',
  demoEyebrow: 'What Helm does',
  empty: 'Nothing recorded in the last 72 hours. Helm runs each weekday morning.',
  unavailable: 'The work log is unavailable right now.',
  demo: 'On a connected book this lists the real work: accounts synced, positions repriced, filings and news read, scans run, your brief written.',
  brief: 'Read full brief',
  unlock: 'Unlock the agent',
  unlockWhy: 'Thesis investigations and the hourly read are Pro.',
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
