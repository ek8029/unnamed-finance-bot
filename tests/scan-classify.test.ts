import { describe, it, expect } from 'vitest';
import { rankCompanyMatches, classifyScanSymbol } from '../lib/scan-classify';

const ENTRIES = [
  { ticker: 'AAPL', title: 'Apple Inc.' },
  { ticker: 'APLE', title: 'Apple Hospitality REIT, Inc.' },
  { ticker: 'HEI', title: 'HEICO CORP' },
  { ticker: 'HEI-A', title: 'HEICO CORP' },
  { ticker: 'MU', title: 'MICRON TECHNOLOGY INC' },
  { ticker: 'MELI', title: 'MercadoLibre, Inc.' },
  { ticker: 'TTWO', title: 'TAKE-TWO INTERACTIVE SOFTWARE, INC.' },
  { ticker: 'SPY', title: 'SPDR S&P 500 ETF TRUST' },
];

describe('rankCompanyMatches', () => {
  it('a typo like APPL finds Apple by name prefix, ranked above the REIT', () => {
    const r = rankCompanyMatches('APPL', ENTRIES, 3);
    expect(r[0]).toEqual({ ticker: 'AAPL', title: 'Apple Inc.' });
  });
  it('a company name typed as a ticker resolves: HEICO -> HEI, MICRON -> MU, MERCADOLIB -> MELI', () => {
    expect(rankCompanyMatches('HEICO', ENTRIES, 3)[0].ticker).toBe('HEI');
    expect(rankCompanyMatches('MICRON', ENTRIES, 3)[0].ticker).toBe('MU');
    expect(rankCompanyMatches('MERCADOLIB', ENTRIES, 3)[0].ticker).toBe('MELI');
  });
  it('an exact ticker outranks everything and duplicates by title collapse', () => {
    const r = rankCompanyMatches('HEI', ENTRIES, 3);
    expect(r[0].ticker).toBe('HEI');
    expect(r.filter((x) => x.title === 'HEICO CORP')).toHaveLength(1);
  });
  it('gibberish returns nothing rather than the alphabetically nearest company', () => {
    expect(rankCompanyMatches('XAUUSD', ENTRIES, 3)).toEqual([]);
    expect(rankCompanyMatches('ZZQ', ENTRIES, 3)).toEqual([]);
  });
});

describe('classifyScanSymbol', () => {
  it('a house name is house, whatever else is true', () => {
    expect(classifyScanSymbol({ house: true, filer: true, suggestions: [] }).kind).toBe('house');
  });
  it('an SEC filer outside the house list is draftable', () => {
    expect(classifyScanSymbol({ house: false, filer: true, suggestions: [] }).kind).toBe('filer');
  });
  it('not a filer but the name matches something: suggest, never draft', () => {
    const c = classifyScanSymbol({ house: false, filer: false, suggestions: [{ ticker: 'AAPL', title: 'Apple Inc.' }] });
    expect(c.kind).toBe('suggest');
  });
  it('gold, forex, futures, foreign listings: unreadable, with the reason', () => {
    expect(classifyScanSymbol({ house: false, filer: false, suggestions: [] }).kind).toBe('unreadable');
  });
});
