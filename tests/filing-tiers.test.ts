import { describe, it, expect } from 'vitest';
import { filingTier, EXHIBIT_ITEMS } from '@/lib/filing-tiers';

describe('filingTier', () => {
  it('reads the periodic reports within minutes, amendments included', () => {
    expect(filingTier('10-Q', [])).toBe('now');
    expect(filingTier('10-K/A', [])).toBe('now');
    expect(filingTier('10-k', [])).toBe('now');
  });

  it('reads an 8-K within minutes only for items that change the business on their own', () => {
    expect(filingTier('8-K', ['2.02', '9.01'])).toBe('now'); // results
    expect(filingTier('8-K', ['4.02'])).toBe('now'); // restatement
    expect(filingTier('8-K', ['1.01', '2.03', '3.02', '2.01'])).toBe('now'); // a completed deal among financing items
    expect(filingTier('8-K', ['3.01', '8.01'])).toBe('now'); // delisting notice
  });

  it('batches the agreements, leadership changes, decks and other events to the hour', () => {
    expect(filingTier('8-K', ['5.02', '9.01'])).toBe('hourly');
    expect(filingTier('8-K', ['1.01', '2.03'])).toBe('hourly');
    expect(filingTier('8-K', ['7.01', '9.01'])).toBe('hourly');
    expect(filingTier('8-K', ['8.01'])).toBe('hourly');
    expect(filingTier('8-K', ['3.02', '5.03'])).toBe('hourly'); // one readable item is enough
  });

  it('never reads votes, bylaws, rights tweaks or exhibit-only filings', () => {
    expect(filingTier('8-K', ['5.07', '9.01'])).toBe('never');
    expect(filingTier('8-K', ['5.03'])).toBe('never');
    expect(filingTier('8-K', ['3.03', '5.03', '9.01'])).toBe('never');
    expect(filingTier('8-K', ['9.01'])).toBe('never');
  });

  it('reads an 8-K with no parsed items at the hour rather than guessing it away', () => {
    expect(filingTier('8-K', [])).toBe('hourly');
  });

  it('leaves every other form to the hourly scan', () => {
    expect(filingTier('6-K', [])).toBe('hourly');
    expect(filingTier('4', [])).toBe('hourly');
    expect(filingTier('20-F', [])).toBe('hourly');
  });

  it('attaches the EX-99 for results, Reg FD and other events, the stub-and-exhibit items', () => {
    expect([...EXHIBIT_ITEMS].sort()).toEqual(['2.02', '7.01', '8.01']);
  });
});
