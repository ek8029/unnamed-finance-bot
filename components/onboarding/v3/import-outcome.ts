import type { BackgroundSyncResult } from '@/lib/plaid/background-sync';

type ImportOutcome = BackgroundSyncResult | 'pending';
export type ImportOutcomes = Readonly<Record<string, ImportOutcome>>;
const UNKNOWN_ITEM = 'unknown-item';

export function recordImportOutcome(current: ImportOutcomes, itemId: string | undefined, outcome: ImportOutcome): ImportOutcomes {
  return { ...current, [itemId || UNKNOWN_ITEM]: outcome };
}

export function importSummary(outcomes: ImportOutcomes) {
  const entries = Object.entries(outcomes);
  const incomplete = entries.filter(([, outcome]) => outcome !== 'pending' && outcome !== 'synced');
  return {
    pending: entries.some(([, outcome]) => outcome === 'pending'),
    incomplete: incomplete.length > 0,
    retryItemId: incomplete.find(([id]) => id !== UNKNOWN_ITEM)?.[0] ?? null,
    issue: incomplete[0]?.[1] ?? null,
  };
}

/** An ended request is not proof of a successful import. Manual-only books
 * retain the existing ready meaning; a failed Plaid import never inherits it. */
export function revealViewedProperties(covered: boolean, pending: boolean, incomplete: boolean) {
  return { top_ticker_covered: covered, synced: !pending && !incomplete };
}
