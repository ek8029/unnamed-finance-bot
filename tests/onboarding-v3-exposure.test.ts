import { describe, it, expect } from 'vitest';
import { bookExposure, exposureSentence, previewSentence } from '@/lib/onboarding/v3-exposure';

const h = (ticker: string, total_value: number, account_id = 'a1') => ({ ticker, total_value, account_id });

describe('bookExposure', () => {
  it('ranks by total weight and splits direct from inside funds', () => {
    const b = bookExposure([h('NVDA', 600), h('QQQ', 400)]);
    expect(b.total).toBe(1000);
    expect(b.rows[0].ticker).toBe('NVDA');
    expect(b.rows[0].directPct).toBeCloseTo(60, 5);
    expect(b.rows[0].indirectPct).toBeGreaterThan(0); // QQQ holds NVDA
    expect(b.rows[0].funds).toEqual(['QQQ']);
  });
  it('counts the accounts that hold the top name directly', () => {
    const b = bookExposure([h('AAPL', 500, 'a1'), h('AAPL', 500, 'a2')]);
    expect(b.top?.accounts).toBe(2);
  });
  it('counts an account that holds the name only through a fund', () => {
    const b = bookExposure([h('NVDA', 500, 'a1'), h('QQQ', 500, 'a2')]);
    expect(b.rows.find((r) => r.ticker === 'NVDA')?.accounts).toBe(2);
  });
  it('returns no top for an empty book', () => {
    expect(bookExposure([]).top).toBeNull();
  });
});

describe('exposureSentence', () => {
  it('one account, no funds', () => {
    const s = exposureSentence(bookExposure([h('AAPL', 700), h('MSFT', 300)]));
    expect(s).toBe('AAPL is 70% of your book, all of it held directly. That figure comes from every account and the funds inside them.');
  });
  it('funds only', () => {
    const s = exposureSentence(bookExposure([h('QQQ', 1000)]));
    expect(s).toMatch(/^[A-Z]+ is \d+% of your book, all of it inside QQQ\./);
  });
  it('direct plus funds across two accounts', () => {
    const s = exposureSentence(bookExposure([h('NVDA', 500, 'a1'), h('QQQ', 500, 'a2')]));
    expect(s).toMatch(/^NVDA is \d+% of your book: 50% held directly, \d+% inside QQQ, across 2 accounts\./);
  });
  it('never uses advice words or em dashes', () => {
    const s = exposureSentence(bookExposure([h('NVDA', 500), h('QQQ', 500)]));
    expect(s).not.toMatch(/—|!/);
    expect(s.toLowerCase()).not.toMatch(/\b(sell|buy|trim|consider|should)\b/);
  });
});

describe('previewSentence', () => {
  it('one row', () => {
    expect(previewSentence([{ ticker: 'NVDA', value: 100 }])).toBe('NVDA is 100% of this one position.');
  });
  it('two rows', () => {
    expect(previewSentence([{ ticker: 'NVDA', value: 300 }, { ticker: 'AAPL', value: 100 }])).toBe('NVDA is 75% of these two positions.');
  });
  it('three rows with a fund adds the inside-funds share', () => {
    const s = previewSentence([{ ticker: 'NVDA', value: 300 }, { ticker: 'QQQ', value: 300 }, { ticker: 'AAPL', value: 100 }]);
    expect(s).toMatch(/^NVDA is \d+% of these three positions, \d+% of it inside QQQ\.$/);
  });
  it('no prices yet', () => {
    expect(previewSentence([{ ticker: 'NVDA', value: null }])).toBe('Prices load when the book is read.');
  });
});
