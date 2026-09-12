import { describe, expect, it } from 'vitest';
import { importSummary, recordImportOutcome, revealViewedProperties } from '@/components/onboarding/v3/import-outcome';

describe('V3 first import outcomes', () => {
  it.each(['failed', 'timeout', 'partial'] as const)('%s stops waiting without claiming the portfolio is fully synced', (outcome) => {
    const state = recordImportOutcome({ first: 'pending' }, 'first', outcome);
    const summary = importSummary(state);
    expect(summary.pending).toBe(false);
    expect(summary.incomplete).toBe(true);
    expect(summary.retryItemId).toBe('first');
    expect(revealViewedProperties(true, false, summary.incomplete).synced).toBe(false);
  });

  it('does not let a later successful connection erase an earlier failed import', () => {
    const state = recordImportOutcome({ first: 'failed', second: 'pending' }, 'second', 'synced');
    expect(importSummary(state)).toMatchObject({ incomplete: true, retryItemId: 'first' });
  });

  it('a successful scoped retry clears only its own failure', () => {
    const retrying = recordImportOutcome({ first: 'failed', second: 'timeout' }, 'first', 'pending');
    expect(importSummary(retrying)).toMatchObject({ pending: true, incomplete: true });
    const settled = recordImportOutcome(retrying, 'first', 'synced');
    expect(importSummary(settled)).toMatchObject({ pending: false, incomplete: true, retryItemId: 'second' });
  });

  it('the completed last retry restores the fully synced state', () => {
    const state = recordImportOutcome({ first: 'pending', second: 'synced' }, 'first', 'synced');
    expect(importSummary(state)).toEqual({ pending: false, incomplete: false, retryItemId: null, issue: null });
    expect(revealViewedProperties(true, false, false)).toEqual({ top_ticker_covered: true, synced: true });
  });

  it('never offers an unscoped retry when an exchange omitted the item id', () => {
    expect(importSummary(recordImportOutcome({}, undefined, 'failed'))).toMatchObject({ incomplete: true, retryItemId: null });
  });

  it('manual-only books preserve their readiness and receipt coverage independently', () => {
    expect(importSummary({}).incomplete).toBe(false);
    expect(revealViewedProperties(false, false, false)).toEqual({ top_ticker_covered: false, synced: true });
    expect(revealViewedProperties(true, true, false).synced).toBe(false);
  });

  it('out-of-order completions preserve each pending connection without mutating state', () => {
    const original = { first: 'pending', second: 'pending' } as const;
    const next = recordImportOutcome(original, 'second', 'synced');
    expect(next).toEqual({ first: 'pending', second: 'synced' });
    expect(importSummary(next).pending).toBe(true);
    expect(original.second).toBe('pending');
  });
});
