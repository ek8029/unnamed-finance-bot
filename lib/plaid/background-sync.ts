// The sync that follows a Plaid link, run without holding the UI.
//
// Linking creates the item and its accounts in about a second. Pulling every
// holding and transaction behind them takes one to six minutes on a real
// book. The button used to await that with a spinner, and the 8/16 Wells
// Fargo link is active in the database with no completion because the person
// left during it. Now the button hands the item back immediately and settles
// this promise later; the caller decides what to show in between.

export type BackgroundSyncResult = 'synced' | 'failed' | 'timeout';

export const BACKGROUND_SYNC_TIMEOUT_MS = 6 * 60 * 1000;

export interface BackgroundSyncOptions {
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export async function runBackgroundSync(opts: BackgroundSyncOptions = {}): Promise<BackgroundSyncResult> {
  const f = opts.fetchImpl ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = opts.timeoutMs ?? BACKGROUND_SYNC_TIMEOUT_MS;

  const work: Promise<BackgroundSyncResult> = (async () => {
    const res = await f('/api/plaid/sync', { method: 'POST' });
    if (!res.ok) return 'failed' as const;
    // Prices so the holdings that just arrived have values (sandbox sends none).
    await f('/api/market/prices/refresh', { method: 'POST' }).catch(() => undefined);
    return 'synced' as const;
  })().catch(() => 'failed' as const);

  const clock: Promise<BackgroundSyncResult> = sleep(timeoutMs).then(() => 'timeout' as const);
  return Promise.race([work, clock]);
}
