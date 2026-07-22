import { describe, it, expect } from 'vitest';
import { planStalePrune, MAX_KEEP_LIST, type PrunableRow } from '@/lib/holdings-prune';

const row = (account_id: string, security_id: string): PrunableRow => ({ account_id, security_id });
const clean = { unmappedHoldings: 0, upsertFailed: false };

describe('planStalePrune', () => {
  it('keeps exactly what the response reported, per account', () => {
    const plan = planStalePrune([row('a1', 's1'), row('a1', 's2'), row('a2', 's3')], clean);
    expect(plan.prune).toBe(true);
    if (!plan.prune) return;
    expect(plan.keepByAccount.get('a1')).toEqual(['s1', 's2']);
    expect(plan.keepByAccount.get('a2')).toEqual(['s3']);
  });

  it('never touches an account absent from the response', () => {
    // The account Plaid omitted or errored on simply is not a key, so no delete
    // is ever issued against it.
    const plan = planStalePrune([row('a1', 's1')], clean);
    if (!plan.prune) throw new Error('expected a prune');
    expect(plan.keepByAccount.has('a2')).toBe(false);
  });

  it('refuses to prune when a holding could not be mapped', () => {
    // An unmapped row and an unreported row look identical from the database.
    // One of them is somebody's money.
    const plan = planStalePrune([row('a1', 's1')], { unmappedHoldings: 1, upsertFailed: false });
    expect(plan.prune).toBe(false);
    if (plan.prune) return;
    expect(plan.reason).toContain('could not be mapped');
  });

  it('refuses to prune when the upsert failed', () => {
    const plan = planStalePrune([row('a1', 's1')], { unmappedHoldings: 0, upsertFailed: true });
    expect(plan.prune).toBe(false);
  });

  it('refuses to prune on an empty response, which may be a failed fetch', () => {
    expect(planStalePrune([], clean).prune).toBe(false);
  });

  it('skips an account whose keep-list would overflow the query string', () => {
    const big = Array.from({ length: MAX_KEEP_LIST + 1 }, (_, i) => row('big', `s${i}`));
    const plan = planStalePrune([...big, row('small', 's1')], clean);
    if (!plan.prune) throw new Error('expected a prune');
    expect(plan.keepByAccount.has('big')).toBe(false);
    expect(plan.skippedAccounts).toEqual(['big']);
    // The small account is still cleaned; one oversized account does not block it.
    expect(plan.keepByAccount.get('small')).toEqual(['s1']);
  });

  it('does nothing at all when every account is oversized', () => {
    const big = Array.from({ length: MAX_KEEP_LIST + 1 }, (_, i) => row('big', `s${i}`));
    expect(planStalePrune(big, clean).prune).toBe(false);
  });

  it('dedupes a security reported twice in one account', () => {
    const plan = planStalePrune([row('a1', 's1'), row('a1', 's1')], clean);
    if (!plan.prune) throw new Error('expected a prune');
    expect(plan.keepByAccount.get('a1')).toEqual(['s1']);
  });

  it("reproduces Ben's case: the reported set survives, the unreported row does not", () => {
    // Ben's Schwab account reported HYNX and others on 2026-07-21 but not the
    // SKHYV row created on 2026-07-11, which sat at $4,200 as 1.9% of his book.
    const plan = planStalePrune([row('schwab', 'hynx-id'), row('schwab', 'nvdl-id')], clean);
    if (!plan.prune) throw new Error('expected a prune');
    const keep = plan.keepByAccount.get('schwab')!;
    expect(keep).toContain('hynx-id');
    expect(keep).not.toContain('skhyv-id'); // therefore deleted
  });
});
