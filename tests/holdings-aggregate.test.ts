import { describe, it, expect } from 'vitest';
import { aggregateHoldingLots, type HoldingLot } from '@/lib/holdings-aggregate';

const lot = (o: Partial<HoldingLot>): HoldingLot => ({
  ticker: 'AAPL', plaid_account_id: 'acct1', quantity: 1,
  institution_value: 100, close_price: 100, cost_basis: 80, ...o,
});

describe('aggregateHoldingLots', () => {
  it('merges two lots of the same security in the same account', () => {
    // Noah's case: VGFLXI held twice in one Empower account.
    const out = aggregateHoldingLots([
      lot({ ticker: 'VGFLXI', plaid_account_id: 'pLp6KE', quantity: 0.78, institution_value: 85.47, cost_basis: 70 }),
      lot({ ticker: 'VGFLXI', plaid_account_id: 'pLp6KE', quantity: 28.65, institution_value: 3137.33, cost_basis: 2500 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBeCloseTo(29.43);
    expect(out[0].institution_value).toBeCloseTo(3222.8);
    expect(out[0].cost_basis).toBeCloseTo(2570);
  });

  it('does NOT merge the same ticker across different accounts', () => {
    const out = aggregateHoldingLots([
      lot({ ticker: 'AAPL', plaid_account_id: 'a' }),
      lot({ ticker: 'AAPL', plaid_account_id: 'b' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('does NOT merge different tickers in the same account', () => {
    const out = aggregateHoldingLots([
      lot({ ticker: 'AAPL', plaid_account_id: 'a' }),
      lot({ ticker: 'MSFT', plaid_account_id: 'a' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('sums nullable value/cost_basis: null + null stays null, null + number = number', () => {
    const out = aggregateHoldingLots([
      lot({ ticker: 'CASH', plaid_account_id: 'a', quantity: 0, institution_value: null, cost_basis: null }),
      lot({ ticker: 'CASH', plaid_account_id: 'a', quantity: 5, institution_value: 5, cost_basis: null }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(5);
    expect(out[0].institution_value).toBe(5);
    expect(out[0].cost_basis).toBeNull();
  });

  it('keeps the first non-null close_price across merged lots', () => {
    const out = aggregateHoldingLots([
      lot({ ticker: 'X', plaid_account_id: 'a', close_price: null }),
      lot({ ticker: 'X', plaid_account_id: 'a', close_price: 42 }),
    ]);
    expect(out[0].close_price).toBe(42);
  });

  it('passes single-lot holdings through unchanged (no duplicate keys = no 21000)', () => {
    const input = [lot({ ticker: 'NVDA', plaid_account_id: 'a', quantity: 3 })];
    const out = aggregateHoldingLots(input);
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(3);
  });

  it('produces no duplicate (account, ticker) keys', () => {
    const out = aggregateHoldingLots([
      lot({ ticker: 'A', plaid_account_id: '1' }), lot({ ticker: 'A', plaid_account_id: '1' }),
      lot({ ticker: 'A', plaid_account_id: '2' }), lot({ ticker: 'B', plaid_account_id: '1' }),
    ]);
    const keys = out.map((h) => `${h.plaid_account_id}::${h.ticker}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
