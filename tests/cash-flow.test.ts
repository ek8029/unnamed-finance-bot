import { describe, it, expect } from 'vitest';
import { countsAsCashFlow, summarizeCashFlow } from '@/lib/cash-flow';

describe('countsAsCashFlow', () => {
  it('counts bank rows (no transaction_type)', () => {
    expect(countsAsCashFlow()).toBe(true);
    expect(countsAsCashFlow(null)).toBe(true);
    expect(countsAsCashFlow(undefined)).toBe(true);
  });

  it('excludes investment buy and sell trades', () => {
    expect(countsAsCashFlow('buy')).toBe(false);
    expect(countsAsCashFlow('sell')).toBe(false);
  });

  it('is case-insensitive when matching trade types', () => {
    expect(countsAsCashFlow('BUY')).toBe(false);
    expect(countsAsCashFlow('Sell')).toBe(false);
  });

  it('counts non-trade investment rows', () => {
    expect(countsAsCashFlow('dividend')).toBe(true);
    expect(countsAsCashFlow('deposit')).toBe(true);
    expect(countsAsCashFlow('withdrawal')).toBe(true);
    expect(countsAsCashFlow('interest')).toBe(true);
    expect(countsAsCashFlow('fee')).toBe(true);
    expect(countsAsCashFlow('transfer')).toBe(true);
  });
});

describe('summarizeCashFlow', () => {
  it('counts bank rows of both signs', () => {
    const s = summarizeCashFlow([
      { amount: 100 },
      { amount: -40 },
    ]);
    expect(s.totalIncome).toBe(100);
    expect(s.totalExpenses).toBe(40);
    expect(s.netFlow).toBe(60);
  });

  it('excludes investment buy and sell rows (both signs)', () => {
    const s = summarizeCashFlow([
      { amount: -1000, transaction_type: 'buy' }, // money out on a buy — excluded
      { amount: 1500, transaction_type: 'sell' }, // money in on a sell — excluded
    ]);
    expect(s.totalIncome).toBe(0);
    expect(s.totalExpenses).toBe(0);
    expect(s.netFlow).toBe(0);
  });

  it('buckets non-trade investment rows by sign', () => {
    const s = summarizeCashFlow([
      { amount: 25, transaction_type: 'dividend' }, // income
      { amount: 500, transaction_type: 'deposit' }, // income
      { amount: 12, transaction_type: 'interest' }, // income
      { amount: -3, transaction_type: 'fee' }, // expense
      { amount: -200, transaction_type: 'withdrawal' }, // expense
    ]);
    expect(s.totalIncome).toBe(25 + 500 + 12);
    expect(s.totalExpenses).toBe(3 + 200);
    expect(s.netFlow).toBe((25 + 500 + 12) - (3 + 200));
  });

  it('case-insensitively excludes BUY', () => {
    const s = summarizeCashFlow([
      { amount: -1000, transaction_type: 'BUY' },
      { amount: 50, transaction_type: 'DIVIDEND' },
    ]);
    expect(s.totalIncome).toBe(50);
    expect(s.totalExpenses).toBe(0);
    expect(s.netFlow).toBe(50);
  });

  it('keeps netFlow === totalIncome - totalExpenses', () => {
    const s = summarizeCashFlow([
      { amount: 300 },
      { amount: -90, transaction_type: 'fee' },
      { amount: -10000, transaction_type: 'buy' },
      { amount: 120, transaction_type: 'dividend' },
    ]);
    expect(s.netFlow).toBe(s.totalIncome - s.totalExpenses);
  });

  it('handles a mixed bank + investment array', () => {
    const s = summarizeCashFlow([
      { amount: 2000 }, // bank income (e.g. payroll)
      { amount: -650 }, // bank expense
      { amount: -5000, transaction_type: 'buy' }, // trade — excluded
      { amount: 5000, transaction_type: 'sell' }, // trade — excluded
      { amount: 80, transaction_type: 'dividend' }, // investment income
      { amount: -2, transaction_type: 'fee' }, // investment expense
    ]);
    expect(s.totalIncome).toBe(2000 + 80);
    expect(s.totalExpenses).toBe(650 + 2);
    expect(s.netFlow).toBe((2000 + 80) - (650 + 2));
  });

  it('accepts string amounts and skips non-finite values', () => {
    const s = summarizeCashFlow([
      { amount: '100' },
      { amount: '-40', transaction_type: 'fee' },
      { amount: 'not-a-number' },
    ]);
    expect(s.totalIncome).toBe(100);
    expect(s.totalExpenses).toBe(40);
    expect(s.netFlow).toBe(60);
  });
});
