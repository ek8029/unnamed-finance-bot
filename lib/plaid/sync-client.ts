export type SyncOutcome = {
  status: 'synced' | 'partial' | 'empty' | 'failed';
  synced: number;
  failed: number;
  message: string;
};
export type SyncFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** HTTP 207 is successful transport, not proof every institution refreshed. */
export async function readSyncResponse(response: Response): Promise<SyncOutcome> {
  const data = await response.json().catch(() => null);
  const results = Array.isArray(data?.results) ? data.results : null;
  const synced = results ? results.filter((result: { success?: boolean }) => result?.success === true).length : Number.isInteger(data?.synced) && data.synced >= 0 ? data.synced : 0;
  const failed = results ? results.length - synced : Number.isInteger(data?.failed) && data.failed >= 0 ? data.failed : 0;
  const status = synced > 0 ? (failed > 0 || data?.success === false || response.status === 207 || data?.warning || !response.ok ? 'partial' : 'synced')
    : response.ok && data?.synced === 0 && failed === 0 ? 'empty' : 'failed';
  return {
    status, synced, failed,
    message: data?.error || data?.warning || data?.message || (status === 'synced' ? 'Your connected accounts have been refreshed.'
      : status === 'partial' ? `${synced} connection${synced === 1 ? '' : 's'} refreshed; some connections could not refresh.`
      : status === 'empty' ? 'No connections available to refresh. Add or reconnect an account.'
      : 'Could not refresh connected accounts. Please try again.'),
  };
}

type SyncRequestOptions = { itemId?: string; fetchImpl?: SyncFetch };
const itemRequests = new Map<string, Promise<SyncOutcome>>();

export function requestConnectionSync(options: SyncRequestOptions = {}): Promise<SyncOutcome> {
  // A link's FirstRead and background callback can request the same import.
  // Never dedupe the unscoped request: it could outlive a change of user.
  const existing = options.itemId ? itemRequests.get(options.itemId) : undefined;
  if (existing) return existing;
  const work = performConnectionSync(options);
  if (options.itemId) {
    itemRequests.set(options.itemId, work);
    void work.finally(() => itemRequests.delete(options.itemId!));
  }
  return work;
}

async function performConnectionSync(options: SyncRequestOptions): Promise<SyncOutcome> {
  const f = options.fetchImpl ?? fetch;
  try {
    const response = await f('/api/plaid/sync', {
      method: 'POST',
      ...(options.itemId ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: options.itemId }) } : {}),
    });
    const outcome = await readSyncResponse(response);
    if (outcome.synced > 0) {
      // A successful import needs prices even if another institution failed.
      await f('/api/market/prices/refresh', { method: 'POST' }).catch(() => undefined);
    }
    return outcome;
  } catch {
    return { status: 'failed', synced: 0, failed: 0, message: 'Could not reach the sync service. Please try again.' };
  }
}

export const AUTO_SYNC_ATTEMPT_KEY = 'helm_last_auto_sync_attempt';
const SUCCESS_KEY = 'helm_last_auto_sync';
export const AUTO_SYNC_RETRY_MS = 5 * 60 * 1000;

export async function runAutomaticSync(options: {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  fetchImpl?: SyncFetch;
  now?: () => number;
  onRefresh: () => Promise<void>;
}): Promise<SyncOutcome | null> {
  const now = options.now ?? Date.now;
  const timestamp = now();
  try {
    const lastSuccess = Number(options.storage.getItem(SUCCESS_KEY));
    const lastAttempt = Number(options.storage.getItem(AUTO_SYNC_ATTEMPT_KEY));
    if ((lastSuccess > 0 && timestamp - lastSuccess < 60 * 60 * 1000) || (lastAttempt > 0 && timestamp - lastAttempt < AUTO_SYNC_RETRY_MS)) return null;
    // Claim before network work, including failed attempts/overlapping mounts.
    options.storage.setItem(AUTO_SYNC_ATTEMPT_KEY, String(timestamp));
  } catch { return null; }
  const outcome = await requestConnectionSync({ fetchImpl: options.fetchImpl });
  if (outcome.synced > 0) {
    try { options.storage.setItem(SUCCESS_KEY, String(now())); } catch {}
    const f = options.fetchImpl ?? fetch;
    await f('/api/insights/generate', { method: 'POST' }).catch(() => undefined);
    await options.onRefresh();
  }
  return outcome;
}
