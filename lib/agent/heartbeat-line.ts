// lib/agent/heartbeat-line.ts
// One plain line per poller heartbeat for the presence lab: "EDGAR checked
// 14:32, nothing new". Past tense, a unit word on every number, no advice
// verbs. The detail keys mirror each watcher's beat(...) call; a missing or
// malformed detail falls back to "<Label> checked <time>" and never throws.

import type { WatchName } from '@/lib/agent/heartbeat-redis';

export const WATCHER_LABEL: Record<WatchName, string> = {
  'edgar-watch': 'EDGAR',
  'news-watch': 'News',
  'judge-worker': 'Judge',
  'daily-scans': 'Scans',
  'market-morning': 'Morning prices',
  'intraday-prices': 'Prices',
};

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;

/** A finite non-negative integer from the detail, or null when the key is missing or malformed. */
function count(detail: Record<string, unknown>, key: string): number | null {
  const v = detail[key];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
}

function errorsSuffix(detail: Record<string, unknown>, key = 'errors', word = 'error'): string {
  const n = count(detail, key);
  return n && n > 0 ? `, ${plural(n, word)}` : '';
}

/**
 * One plain line for a beat, e.g. "EDGAR checked 14:32, nothing new" /
 * "EDGAR checked 14:32, 2 filings, 2 reads queued" / "News checked 14:30,
 * 3 items taken in" / "Prices checked 14:35, 12 names moved, 118 unchanged" /
 * "Judge idle 14:32" / "Judge ran 14:33, 2 done" / "Scans ran 09:15, 40 books".
 * `clock` formats the time; pass it in so the component's ET formatter is reused.
 * `withTime: false` drops the verb phrase ("checked 14:32" / "ran 14:32") for a
 * row whose time column already says it: "EDGAR, nothing new", "Judge idle",
 * "Prices, 12 names moved, 118 unchanged". State words (idle, dry run) stay, and
 * the no-detail fallback keeps its bare verb ("EDGAR checked") so a line is
 * never just a label.
 */
export function describeBeat(hb: { name: WatchName; at: string; detail: Record<string, unknown> }, clock: (iso: string) => string, opts: { withTime?: boolean } = {}): string {
  const withTime = opts.withTime ?? true;
  const label = WATCHER_LABEL[hb.name] ?? hb.name;
  const time = clock(hb.at);
  const detail = hb.detail && typeof hb.detail === 'object' ? hb.detail : {};
  // "EDGAR checked 14:32" with the time; "EDGAR" without (the body follows after a comma).
  const lead = (verb: 'checked' | 'ran') => (withTime ? `${label} ${verb} ${time}` : label);
  // A state word stands on its own: "Judge idle 14:32" / "Judge idle".
  const state = (word: string) => (withTime ? `${label} ${word} ${time}` : `${label} ${word}`);
  const fallback = withTime ? `${label} checked ${time}` : `${label} checked`;

  switch (hb.name) {
    case 'edgar-watch': {
      if (detail.dry === true) return state('dry run');
      const fresh = count(detail, 'new');
      if (fresh === null) return fallback;
      const queued = count(detail, 'queued') ?? 0;
      const body = fresh === 0 ? 'nothing new' : `${plural(fresh, 'filing')}, ${queued > 0 ? `${plural(queued, 'read')} queued` : 'none queued'}`;
      return `${lead('checked')}, ${body}${errorsSuffix(detail)}`;
    }
    case 'news-watch': {
      const inserted = count(detail, 'inserted');
      if (inserted === null) return fallback;
      const body = inserted === 0 ? 'nothing new' : `${plural(inserted, 'item')} taken in`;
      return `${lead('checked')}, ${body}${errorsSuffix(detail)}`;
    }
    case 'judge-worker': {
      if (detail.idle === true) return state('idle');
      const done = count(detail, 'done');
      if (done === null) return fallback;
      const body = done === 0 ? 'nothing new' : `${done} done`;
      const capped = detail.spendCapReached === true ? ', spend cap reached' : '';
      return `${lead('ran')}, ${body}${errorsSuffix(detail, 'failed', 'failure')}${capped}`;
    }
    case 'intraday-prices': {
      const moved = count(detail, 'updatedHoldings');
      if (moved === null) return fallback;
      const unchanged = count(detail, 'skippedHoldings') ?? 0;
      const body = moved === 0 ? 'nothing new' : `${plural(moved, 'name')} moved, ${unchanged} unchanged`;
      return `${lead('checked')}, ${body}`;
    }
    case 'daily-scans': {
      const users = count(detail, 'users');
      if (users === null) return fallback;
      const insights = count(detail, 'insights') ?? 0;
      const body = insights === 0 ? 'nothing new' : `${plural(insights, 'item')} flagged`;
      return `${lead('ran')}, ${plural(users, 'book')}, ${body}`;
    }
    case 'market-morning': {
      const refreshed = count(detail, 'pricesRefreshed');
      if (refreshed === null) return fallback;
      const body = refreshed === 0 ? 'nothing new' : `${plural(refreshed, 'price')} refreshed`;
      return `${lead('ran')}, ${body}${errorsSuffix(detail)}`;
    }
    default:
      return fallback;
  }
}
