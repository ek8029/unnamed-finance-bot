// tests/onboarding-v3-sync-state.test.ts
import { describe, it, expect } from 'vitest';
import { pickNewPlaidAccounts, nextSyncing, afterSynced, type SyncAccount } from '@/lib/onboarding/v3-sync-state';

const acct = (id: string, institution: string, source: SyncAccount['source'] = 'plaid'): SyncAccount => ({ id, institution, source });

/** The overlay's loop: read the book, pick what is new, extend syncing, remember the ids. */
function step(known: Set<string>, syncing: string[], accounts: SyncAccount[]) {
  const fresh = pickNewPlaidAccounts(known, accounts);
  const next = nextSyncing(syncing, fresh.map((a) => a.institution));
  for (const a of accounts) known.add(a.id);
  return next;
}

describe('v3 sync state', () => {
  it('two connects before the first refetch both land in syncing, in order', () => {
    const known = new Set<string>();
    let syncing: string[] = [];
    // Both items appear in one refetch; the book lists them in creation order.
    syncing = step(known, syncing, [acct('a1', 'Fidelity'), acct('a2', 'Schwab')]);
    expect(syncing).toEqual(['Fidelity', 'Schwab']);
    expect([...known]).toEqual(['a1', 'a2']);
  });

  it('a refetch with nothing new changes nothing', () => {
    const known = new Set(['a1']);
    const syncing = step(known, ['Fidelity'], [acct('a1', 'Fidelity')]);
    expect(syncing).toEqual(['Fidelity']);
    expect(known.size).toBe(1);
  });

  it('a repeated institution is not listed twice', () => {
    expect(nextSyncing(['Fidelity'], ['Fidelity', 'Schwab', 'Schwab'])).toEqual(['Fidelity', 'Schwab']);
  });

  it('manual accounts and known ids are never new', () => {
    const known = new Set(['p1']);
    const fresh = pickNewPlaidAccounts(known, [acct('p1', 'Fidelity'), acct('m1', 'Manual', 'manual'), acct('p2', 'Schwab')]);
    expect(fresh.map((a) => a.id)).toEqual(['p2']);
  });

  it('afterSynced removes the oldest entry first', () => {
    expect(afterSynced(['Fidelity', 'Schwab'])).toEqual(['Schwab']);
    expect(afterSynced(['Schwab'])).toEqual([]);
    expect(afterSynced([])).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const current = ['Fidelity'];
    nextSyncing(current, ['Schwab']);
    afterSynced(current);
    expect(current).toEqual(['Fidelity']);
  });
});
