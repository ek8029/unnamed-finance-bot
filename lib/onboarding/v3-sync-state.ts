// Pure decisions behind the v3 overlay's syncing state. Several Plaid
// connects can be in flight at once; the overlay keeps the set of account
// ids it has already seen and a FIFO list of institutions still importing.
// tests/onboarding-v3-sync-state.test.ts covers the sequences.

export type SyncAccount = { id: string; institution: string; source: 'plaid' | 'manual' };

/** Plaid accounts in `accounts` whose id has not been seen before. */
export function pickNewPlaidAccounts<A extends SyncAccount>(known: ReadonlySet<string>, accounts: A[]): A[] {
  return accounts.filter((a) => a.source === 'plaid' && !known.has(a.id));
}

/** Append institutions to the syncing list, in order, without repeats. */
export function nextSyncing(current: string[], added: string[]): string[] {
  const out = [...current];
  for (const name of added) if (!out.includes(name)) out.push(name);
  return out;
}

/** One import settled: the oldest entry leaves the list. */
export function afterSynced(current: string[]): string[] {
  return current.slice(1);
}
