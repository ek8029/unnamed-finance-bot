// The sync that follows a Plaid link, run without holding the UI.
//
// Linking creates the item and its accounts in about a second. Pulling every
// holding and transaction behind them takes one to six minutes on a real
// book. The button used to await that with a spinner, and the 8/16 Wells
// Fargo link is active in the database with no completion because the person
// left during it. Now the button hands the item back immediately and settles
// this promise later; the caller decides what to show in between.

import { requestConnectionSync } from '@/lib/plaid/sync-client';

export type BackgroundSyncResult = 'synced' | 'partial' | 'failed' | 'timeout';

export const BACKGROUND_SYNC_TIMEOUT_MS = 6 * 60 * 1000;

export interface BackgroundSyncOptions {
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  itemId?: string;
}

export async function runBackgroundSync(opts: BackgroundSyncOptions = {}): Promise<BackgroundSyncResult> {
  const f = opts.fetchImpl ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = opts.timeoutMs ?? BACKGROUND_SYNC_TIMEOUT_MS;

  const work: Promise<BackgroundSyncResult> = (async () => {
    const outcome = await requestConnectionSync({ itemId: opts.itemId, fetchImpl: f });
    return outcome.status === 'empty' ? 'failed' : outcome.status;
  })().catch(() => 'failed' as const);

  const clock: Promise<BackgroundSyncResult> = sleep(timeoutMs).then(() => 'timeout' as const);
  return Promise.race([work, clock]);
}
